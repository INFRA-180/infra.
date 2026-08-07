#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const requests = [];
const windowListeners = new Map();
const documentListeners = new Map();
const databases = new Map();
let uuidCounter = 0;
let fetchOk = true;
let deferNextFetch = false;
const deferredFetches = [];
let intervalCalls = 0;
let indexedDbPutCalls = 0;
let clockMs = 1784243000000;

class FakeDate extends Date {
  constructor(...args) {
    super(args.length ? args[0] : clockMs);
  }
  static now() { return clockMs; }
}

function tick(ms = 1) {
  clockMs += ms;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function addListener(registry, type, callback) {
  if (!registry.has(type)) registry.set(type, []);
  registry.get(type).push(callback);
}

function dispatch(registry, type, details) {
  (registry.get(type) || []).slice().forEach((callback) => callback(Object.assign({ type }, details || {})));
}

function createIndexedDbMock() {
  function open(name) {
    const request = { result: null };
    queueMicrotask(() => {
      const isNew = !databases.has(name);
      if (isNew) databases.set(name, { stores: new Map() });
      const data = databases.get(name);
      const db = {
        objectStoreNames: {
          contains(storeName) { return data.stores.has(storeName); }
        },
        createObjectStore(storeName) {
          if (!data.stores.has(storeName)) data.stores.set(storeName, new Map());
        },
        transaction(storeName) {
          const transaction = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore() {
              if (!data.stores.has(storeName)) data.stores.set(storeName, new Map());
              const values = data.stores.get(storeName);
              return {
                getAll() { return { result: Array.from(values.values()).map(clone) }; },
                put(value) {
                  indexedDbPutCalls += 1;
                  const key = value.session_id;
                  values.set(key, clone(value));
                  return { result: key };
                },
                delete(key) {
                  values.delete(key);
                  return { result: undefined };
                }
              };
            }
          };
          queueMicrotask(() => {
            if (typeof transaction.oncomplete === "function") transaction.oncomplete();
          });
          return transaction;
        }
      };
      request.result = db;
      if (isNew && typeof request.onupgradeneeded === "function") request.onupgradeneeded();
      if (typeof request.onsuccess === "function") request.onsuccess();
    });
    return request;
  }

  return {
    open,
    deleteDatabase(name) {
      databases.delete(name);
      return {};
    }
  };
}

const audioState = {
  playRequestToken: 1,
  startRequestToken: 1,
  playRequestTs: clockMs,
  audioClickPerfTs: clockMs,
  homeMode: "radio",
  playlistKind: "radio",
  shuffleOn: false,
  nextPrefetchReadySrcs: new Set(),
  audio: {
    paused: false,
    currentTime: 1,
    duration: 180,
    readyState: 4,
    networkState: 1,
    buffered: { length: 0 }
  }
};

const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  Blob,
  Promise,
  Date: FakeDate,
  Math,
  TextEncoder,
  console,
  performance: { now: () => clockMs },
  crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}` },
  indexedDB: createIndexedDbMock(),
  navigator: {
    userAgent: "SECRET FULL USER AGENT",
    onLine: true,
    connection: { effectiveType: "4g" },
    sendBeacon() { throw new Error("sendBeacon must not be used"); }
  },
  document: {
    visibilityState: "visible",
    addEventListener(type, callback) { addListener(documentListeners, type, callback); }
  },
  addEventListener(type, callback) { addListener(windowListeners, type, callback); },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() {
    intervalCalls += 1;
    return 1;
  },
  clearInterval() {},
  fetch(url, options) {
    requests.push({
      url,
      options: Object.assign({}, options),
      payload: JSON.parse(String(options && options.body || "{}"))
    });
    if (deferNextFetch) {
      deferNextFetch = false;
      const responseOk = fetchOk;
      return new Promise((resolve) => deferredFetches.push(() => resolve({ ok: responseOk })));
    }
    return Promise.resolve({ ok: fetchOk });
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/assets/js/audio-telemetry.js"), "utf8"),
  sandbox
);

function createTelemetry() {
  return sandbox.InfraAudioTelemetry.createTelemetry({
    fineTelemetryEnabled: true,
    isTelemetryOriginAllowed: () => true,
    getWorkerUrl: () => "https://worker.test",
    getRuntimeVersion: () => "audiofix-session-v4-test",
    getAudioState: () => audioState,
    getAudio: () => audioState.audio,
    getAudioSource: () => "r2dev",
    isIosDevice: () => true,
    isStandaloneDisplayMode: () => true,
    isAndroidDevice: () => false,
    buildMonitorPayload: () => ({
      track: "Safe title",
      album: "Safe album",
      track_path: "assets/music/streams/private/path.m4a",
      src: "https://secret.example/private/path.m4a"
    })
  });
}

async function settle(turns = 20) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

(async function () {
  const telemetry = createTelemetry();
  telemetry.initLifecycle();
  await settle();

  telemetry.startHeartbeat();
  telemetry.trackRuntimeEvent("heartbeat", { track: "Must stay local", album: "Album" });
  assert.strictEqual(intervalCalls, 0, "Session v4 must not install a heartbeat interval");

  for (let index = 0; index < 60; index += 1) {
    telemetry.enqueue({
      event: "playing",
      timestamp_ms: Date.now() + index,
      track: `Track ${index}`,
      album: "Album",
      browser: "SECRET FULL USER AGENT",
      local_time: "SECRET LOCAL TIME",
      ts_client: "SECRET ISO TIME",
      session_id: "SECRET SESSION",
      track_path: "assets/music/streams/private/path.m4a",
      src: "https://secret.example/private/path.m4a?token=secret",
      from_url: "https://secret.example/from?token=secret",
      to_url: "https://secret.example/to#secret",
      message: "SECRET MESSAGE",
      _telemetry_id: "SECRET LOCAL ID",
      duration_before_play_ms: index
    });
  }
  await settle();
  assert.strictEqual(requests.length, 0, "Active sessions must remain local");
  assert.strictEqual(await telemetry.flushQueue(), false, "Manual flush must not send an active session");

  audioState.audio.paused = true;
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 1, "Hidden must perform one session delivery");
  const firstRequest = requests[0];
  assert.strictEqual(firstRequest.options.credentials, "omit");
  assert.strictEqual(firstRequest.options.keepalive, true);
  assert.strictEqual(firstRequest.payload.schema_version, 4);
  assert.strictEqual(firstRequest.payload.reports.length, 1);
  assert.strictEqual(firstRequest.payload.reports[0].events.length, 48, "Local journal must be capped at 48 events");
  assert.strictEqual(firstRequest.payload.reports[0].dropped_events, 13);
  assert.strictEqual(firstRequest.payload.reports[0].events[0].track, "Track 13");
  assert.strictEqual(
    firstRequest.payload.reports[0].events.at(-1).event,
    "session_summary",
    "The protected summary must survive a full 48-event journal"
  );
  assert(Buffer.byteLength(firstRequest.options.body) <= 32 * 1024, "Session envelope must stay below 32 KiB");

  const forbidden = [
    "browser", "local_time", "ts_client", "session_id", "track_path", "src",
    "from_url", "to_url", "message", "_telemetry_id"
  ];
  firstRequest.payload.reports[0].events.forEach((event) => {
    forbidden.forEach((key) => assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, key),
      false,
      `${key} leaked`
    ));
  });

  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 1, "pagehide must not duplicate the hidden delivery");

  sandbox.document.visibilityState = "visible";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 1, "Visible must start locally without a network flush");

  audioState.audio.paused = false;
  audioState.audio.currentTime = 1;
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  dispatch(windowListeners, "pagehide", { persisted: true });
  await settle();
  assert.strictEqual(requests.length, 1, "Hidden + playing and BFCache pagehide must remain local");
  audioState.audio.currentTime = 31;
  tick(30000);
  telemetry.trackRuntimeEvent("background_progress", {
    track: "Background track",
    album: "Background album",
    current_time: 31,
    paused: false
  });
  telemetry.trackRuntimeEvent("audio_interruption", {
    interruption_token: "interruption-safe-1",
    interruption_kind: "system_midtrack",
    phase: "paused",
    outcome: "detected"
  });
  await settle();
  assert.strictEqual(requests.length, 1, "Background progress and interruption must not hit the Worker");
  audioState.audio.currentTime = 32;
  sandbox.document.visibilityState = "visible";
  dispatch(windowListeners, "pageshow", { persisted: true });
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 1, "Returning from BFCache must keep the same local session");

  telemetry.trackRuntimeEvent("launch_summary", {
    launch_head_ms: 2,
    dom_ready_ms: 180,
    first_contentful_paint_ms: 140,
    first_app_frame_ms: 260,
    init_done_ms: 230,
    catalog_ready_ms: 220,
    catalog_ready: true,
    service_worker_controlled: true,
    app_frame_ready: true
  });
  telemetry.trackRuntimeEvent("album_swipe", {
    gesture_token: "swipe-safe-1",
    album: "Target",
    direction: "left",
    axis: "horizontal",
    input_type: "touch",
    dx: -72,
    dy: 4,
    card_rank: 24,
    handler_ready: false,
    navigation_started: false,
    result: "cancelled",
    cancel_reason: "handler_not_ready"
  });
  telemetry.trackRuntimeEvent("queue_reorder", {
    queue_token: "queue-safe-1",
    input_type: "touch",
    source_index: 5,
    target_index: 2,
    ghost_created: true,
    lift_animated: true,
    lift_finished: true,
    shifted_row_count: 2,
    flip_started: true,
    flip_finished: true,
    flip_animation_count: 3,
    result: "committed"
  });
  telemetry.trackRuntimeEvent("queue_reorder", {
    queue_token: "queue-safe-1",
    input_type: "touch",
    source_index: 5,
    target_index: 2,
    flip_started: true,
    flip_finished: true,
    flip_animation_count: 3,
    result: "preview"
  });
  await settle();

  const preparedSrc = "https://audio.test/assets/album-one/04-favora.m4a";
  const sameBasenameOtherAlbum = "https://audio.test/assets/album-two/04-favora.m4a";
  const cachePreparedSrc = "https://audio.test/assets/album-three/cache-ready.m4a";
  const putsBeforeRawPrefetch = indexedDbPutCalls;
  for (let index = 0; index < 20; index += 1) {
    telemetry.trackRuntimeEvent("prefetch_plan", {
      track: "prefetch-window",
      album: "Album one",
      generation: index,
      sources: [preparedSrc]
    });
  }
  telemetry.trackRuntimeEvent("prefetch_start", {
    src: preparedSrc,
    track: "FAVORA ONE",
    album: "Album one",
    rank: 1,
    attempt: 1
  });
  await settle();
  assert.strictEqual(
    indexedDbPutCalls,
    putsBeforeRawPrefetch,
    "Raw prefetch plans and starts must stay in memory instead of writing IndexedDB"
  );
  tick(80);
  telemetry.trackRuntimeEvent("prefetch_done", {
    src: preparedSrc,
    track: "FAVORA ONE",
    album: "Album one",
    rank: 1,
    attempt: 1,
    response_ms: 20,
    body_ms: 30,
    cache_ms: 10
  });
  await settle();
  assert.strictEqual(
    indexedDbPutCalls,
    putsBeforeRawPrefetch + 1,
    "A completed prefetch must persist its compact summary exactly once"
  );
  telemetry.trackRuntimeEvent("prefetch_cache_rehydrated", {
    track: "prefetch-window",
    album: "Album three",
    restored_count: 1,
    sources: [cachePreparedSrc]
  });

  const sources = [
    preparedSrc,
    sameBasenameOtherAlbum,
    cachePreparedSrc,
    "https://audio.test/assets/album-four/a.m4a",
    "https://audio.test/assets/album-five/b.m4a",
    "https://audio.test/assets/album-six/c.m4a"
  ];
  sources.forEach((src, index) => {
    const requestToken = 10 + index;
    audioState.playRequestToken = requestToken;
    audioState.startRequestToken = requestToken;
    const base = {
      request_token: requestToken,
      src,
      source: "r2dev",
      track: `Compact ${index}`,
      album: `Album ${index}`,
      trigger: "transport"
    };
    [
      "startTrack_enter",
      "click_track",
      "source_resolved",
      "play_request",
      "source_assigned",
      "play_call",
      "first_byte",
      "canplay",
      "play_resolved"
    ].forEach((eventName) => {
      telemetry.trackRuntimeEvent(eventName, base);
      tick(10);
    });
    if (index === 0) {
      telemetry.trackRuntimeEvent("waiting", base);
      telemetry.trackRuntimeEvent("served_from_prefetch", Object.assign({}, base, {
        src: sameBasenameOtherAlbum,
        range: true
      }));
      telemetry.trackRuntimeEvent("served_from_prefetch", Object.assign({}, base, {
        range: true,
        client_id: "SECRET CLIENT"
      }));
    }
    if (index === 1) telemetry.trackRuntimeEvent("stalled", base);
    if (index === sources.length - 1) tick(1100);
    telemetry.trackRuntimeEvent("playing", base);
    if (index === 3) {
      telemetry.trackRuntimeEvent("error", Object.assign({}, base, { error_message: "MEDIA_ERR_NETWORK" }));
      telemetry.trackRuntimeEvent("error", Object.assign({}, base, { error_message: "MEDIA_ERR_NETWORK" }));
    }
    tick(10);
  });

  const rejectedBase = {
    request_token: 20,
    src: "https://audio.test/assets/failures/rejected.m4a",
    source: "r2dev",
    track: "Rejected",
    album: "Failures"
  };
  audioState.playRequestToken = 20;
  telemetry.trackRuntimeEvent("startTrack_enter", rejectedBase);
  telemetry.trackRuntimeEvent("play_call", rejectedBase);
  tick(1500);
  telemetry.trackRuntimeEvent("play_rejected", Object.assign({}, rejectedBase, { reason: "NotAllowedError" }));

  const errorBase = Object.assign({}, rejectedBase, {
    request_token: 21,
    src: "https://audio.test/assets/failures/error.m4a",
    track: "Error"
  });
  audioState.playRequestToken = 21;
  telemetry.trackRuntimeEvent("startTrack_enter", errorBase);
  telemetry.trackRuntimeEvent("play_call", errorBase);
  tick(2000);
  telemetry.trackRuntimeEvent("error", Object.assign({}, errorBase, { error_message: "MEDIA_ERR_NETWORK" }));

  const sealedBase = Object.assign({}, rejectedBase, {
    request_token: 22,
    src: "https://audio.test/assets/failures/sealed.m4a",
    track: "Sealed"
  });
  audioState.playRequestToken = 22;
  telemetry.trackRuntimeEvent("startTrack_enter", sealedBase);
  telemetry.trackRuntimeEvent("play_call", sealedBase);
  tick(2500);

  const navBase = {
    track: "album_open",
    album: "Target",
    from_album: "Home",
    to_album: "Target",
    from_url: "https://secret.example/home?token=secret",
    to_url: "https://secret.example/music/target.html?token=secret",
    cached: true
  };
  telemetry.recordCacheObservation("html", "hit");
  telemetry.recordCacheObservation("cover", "hit");
  telemetry.recordCacheObservation("cover", "miss");
  telemetry.recordStorageSnapshot({
    storage_persisted_state: 2,
    storage_persist_request_count: 1,
    storage_persist_granted_count: 1,
    storage_usage_mb: 18,
    storage_quota_mb: 4096,
    storage_shell_present: 1,
    storage_sw_controlled: 1,
    storage_cover_entries: 31,
    storage_audio_entries: 6,
    storage_catalog_entries: 1
  });
  telemetry.trackRuntimeEvent("visualizer_health", {
    reason: "activation",
    result: "ready",
    state: "running",
    visualizer_open_count: 1,
    visualizer_activation_count: 1,
    visualizer_activation_success_count: 1,
    visualizer_frame_count: 2,
    visualizer_nonzero_frame_count: 2,
    visualizer_zero_frame_count: 0,
    visualizer_max_rms_milli: 210,
    visualizer_energy_range_milli: 80,
    visualizer_max_amplitude_px: 18,
    visualizer_canvas_width: 720,
    visualizer_canvas_height: 220,
    visualizer_canvas_opacity_milli: 1000,
    visualizer_audio_advanced_ms: 80,
    visualizer_context_supported: 1,
    visualizer_context_running: 1,
    visualizer_analyser_ready: 1,
    visualizer_canvas_visible: 1
  });
  telemetry.trackRuntimeEvent("visualizer_health", {
    reason: "active_probe",
    result: "ready",
    state: "running",
    visualizer_open_count: 1,
    visualizer_activation_count: 1,
    visualizer_activation_success_count: 1,
    visualizer_frame_count: 42,
    visualizer_nonzero_frame_count: 40,
    visualizer_zero_frame_count: 2,
    visualizer_max_rms_milli: 640,
    visualizer_max_bass_milli: 780,
    visualizer_max_mid_milli: 520,
    visualizer_max_treble_milli: 310,
    visualizer_energy_range_milli: 390,
    visualizer_max_amplitude_px: 31,
    visualizer_canvas_width: 720,
    visualizer_canvas_height: 220,
    visualizer_canvas_opacity_milli: 1000,
    visualizer_audio_advanced_ms: 1500,
    visualizer_context_supported: 1,
    visualizer_context_running: 1,
    visualizer_analyser_ready: 1,
    visualizer_canvas_visible: 1
  });
  telemetry.trackRuntimeEvent("nav:album_start", navBase);
  tick(20);
  telemetry.trackRuntimeEvent("album_open_tap", navBase);
  tick(40);
  telemetry.trackRuntimeEvent("cover_decode_duration", Object.assign({}, navBase, {
    album_cover_only: true,
    duration_ms: 40,
    timed_out: false
  }));
  telemetry.trackRuntimeEvent("spa_swap_start", navBase);
  tick(30);
  telemetry.trackRuntimeEvent("spa_swap_done", Object.assign({}, navBase, {
    duration_ms: 30,
    first_paint_wait_ms: 18,
    paint_relevant_cover_count: 1,
    paint_relevant_cover_ready_count: 1,
    paint_relevant_cover_ready: true,
    second_paint_wait_ms: 34,
    second_paint_relevant_cover_count: 1,
    second_paint_relevant_cover_ready_count: 1,
    second_paint_relevant_cover_ready: true,
    cover_render_width_px: 358,
    cover_render_height_px: 358,
    cover_aspect_ratio_milli: 1000,
    cover_geometry_ok: true,
    cover_object_fit: "contain"
  }));
  telemetry.trackRuntimeEvent("spa_render_done", Object.assign({}, navBase, { duration_ms: 90 }));
  telemetry.trackRuntimeEvent("album_open_done", navBase);
  telemetry.trackRuntimeEvent("nav:album_done", navBase);

  telemetry.trackRuntimeEvent("mini_player_visibility", {
    state: "visible",
    reason: "initial",
    route_kind: "album",
    has_playback_session: true,
    src: "https://secret.example/private/audio.m4a"
  });
  telemetry.trackRuntimeEvent("mini_player_visibility", { state: "visible", reason: "duplicate" });
  telemetry.trackRuntimeEvent("mini_player_visibility", {
    state: "hidden",
    reason: "route_swap",
    navigation_active: true,
    has_playback_session: true
  });
  telemetry.trackRuntimeEvent("mini_player_visibility", { state: "hidden", reason: "duplicate" });
  telemetry.trackRuntimeEvent("mini_player_visibility", { state: "visible", reason: "route_ready" });
  telemetry.trackRuntimeEvent("media_capabilities", {
    track: "media-session",
    album: "session",
    supported_actions: "play,pause,previoustrack,nexttrack,seekto",
    unsupported_actions: "seekbackward,seekforward",
    registration_result: "partial",
    handler_play: true,
    handler_pause: true,
    handler_previous: true,
    handler_next: true,
    handler_seekto: true
  });
  const commandToken = "cmd-play-safe-1";
  telemetry.trackRuntimeEvent("media_command", {
    command_token: commandToken,
    command_sequence: 1,
    action: "play",
    origin: "media_session",
    surface_hint: "remote_hidden",
    decision: "resume",
    outcome: "dispatched",
    before_paused: true,
    before_current_time: 41.5
  });
  telemetry.trackRuntimeEvent("media_command", {
    command_token: commandToken,
    action: "play",
    origin: "media_session",
    surface_hint: "remote_hidden",
    decision: "resume",
    outcome: "no_progress",
    probe_1500_ms: 120,
    recovery_attempted: true
  });
  telemetry.trackRuntimeEvent("media_command", {
    command_token: commandToken,
    action: "play",
    origin: "media_session",
    surface_hint: "remote_hidden",
    decision: "resume",
    outcome: "recovered",
    probe_3000_ms: 1400,
    after_paused: false,
    after_current_time: 42.9
  });
  telemetry.trackRuntimeEvent("audio_interruption", {
    interruption_token: "interruption-safe-1",
    interruption_kind: "system_midtrack",
    phase: "paused",
    outcome: "detected",
    surface_hint: "remote_hidden"
  });
  telemetry.trackRuntimeEvent("audio_interruption", {
    interruption_token: "interruption-safe-1",
    interruption_kind: "system_midtrack",
    phase: "resumed",
    outcome: "success",
    surface_hint: "remote_hidden",
    command_token: commandToken,
    resume_gate_reason: "sampled_active",
    position_delta_ms: 120,
    native_play_observed: true
  });
  await settle();
  const putsBeforePrefetchError = indexedDbPutCalls;
  telemetry.trackRuntimeEvent("prefetch_error", {
    src: "https://secret.example/assets/missed.m4a?token=secret",
    track: "MISS",
    album: "Album",
    reason: "timeout"
  });
  await settle();
  assert.strictEqual(
    indexedDbPutCalls,
    putsBeforePrefetchError + 1,
    "A direct prefetch error and its summary must share one IndexedDB write"
  );

  fetchOk = false;
  telemetry.trackRuntimeEvent("waiting", { track: "Retry track", album: "Album" });
  audioState.audio.paused = true;
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 2);
  const compactReport = requests[1].payload.reports[0];
  const compactEvents = compactReport.events;
  assert.strictEqual(compactReport.dropped_events, 0, "the representative iPhone campaign must fit without drops");
  const compactTrackTransitions = compactEvents.filter((event) => event.event === "track_transition");
  assert.strictEqual(compactTrackTransitions.length, 9);
  assert.strictEqual(
    new Set(compactTrackTransitions.map((event) => event.request_token)).size,
    compactTrackTransitions.length,
    "Each request token must produce at most one compact track transition"
  );
  assert.strictEqual(compactEvents.filter((event) => event.event === "spa_navigation").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "mini_player_visibility").length, 3);
  assert.strictEqual(
    compactEvents.filter((event) => event.event === "visualizer_health").length,
    1,
    "Visualizer probes must update one compact event instead of appending per frame"
  );
  assert.strictEqual(compactEvents.filter((event) => event.event === "session_summary").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "media_capabilities").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "media_command").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "audio_interruption").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "background_window").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "launch_summary").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "album_swipe").length, 1);
  assert.strictEqual(compactEvents.filter((event) => event.event === "queue_reorder").length, 1);
  const geometryNavigation = compactEvents.find((event) => event.event === "spa_navigation");
  assert.strictEqual(geometryNavigation.cover_render_width_px, 358);
  assert.strictEqual(geometryNavigation.cover_render_height_px, 358);
  assert.strictEqual(geometryNavigation.cover_aspect_ratio_milli, 1000);
  assert.strictEqual(geometryNavigation.cover_geometry_ok, true);
  assert.strictEqual(geometryNavigation.cover_object_fit, "contain");
  const compactInterruption = compactEvents.find((event) => event.event === "audio_interruption");
  assert.strictEqual(compactInterruption.resume_gate_reason, "sampled_active");
  assert.strictEqual(compactInterruption.position_delta_ms, 120);
  assert.strictEqual(compactInterruption.native_play_observed, true);
  const compactQueue = compactEvents.find((event) => event.event === "queue_reorder");
  assert.strictEqual(compactQueue.lift_finished, true);
  assert.strictEqual(compactQueue.flip_started, true);
  assert.strictEqual(compactQueue.flip_finished, true);
  assert.strictEqual(compactQueue.flip_animation_count, 3);
  const compactBackground = compactEvents.find((event) => event.event === "background_window");
  assert.strictEqual(compactBackground.progress_observed, true);
  assert.strictEqual(compactBackground.return_observed, true);
  assert.strictEqual(compactBackground.bfcache, true);
  assert(compactBackground.advanced_ms >= 30000);
  const compactCommand = compactEvents.find((event) => event.event === "media_command");
  assert.strictEqual(compactCommand.command_token, commandToken);
  assert.strictEqual(compactCommand.outcome, "recovered");
  assert.strictEqual(compactCommand.probe_1500_ms, 120);
  assert.strictEqual(compactCommand.probe_3000_ms, 1400);
  assert.strictEqual(compactCommand.surface_hint, "remote_hidden");
  assert.strictEqual(
    compactEvents.some((event) => [
      "startTrack_enter", "click_track", "source_assigned", "play_call", "playing",
      "prefetch_start", "prefetch_done", "spa_swap_start", "spa_swap_done"
    ].includes(event.event)),
    false,
    "Raw lifecycle stages must not saturate remote telemetry"
  );
  const preparedTransition = compactEvents.find((event) => event.track === "Compact 0");
  const basenameCollision = compactEvents.find((event) => event.track === "Compact 1");
  const cachePrepared = compactEvents.find((event) => event.track === "Compact 2");
  assert.strictEqual(preparedTransition.prepared, true);
  assert.strictEqual(preparedTransition.served_from_prefetch, true);
  assert.strictEqual(basenameCollision.prepared, false, "Same basename in another album must not inherit prefetch readiness");
  assert.strictEqual(basenameCollision.served_from_prefetch, false);
  assert.strictEqual(cachePrepared.prepared, true);
  const rejectedTransition = compactEvents.find((event) => event.track === "Rejected");
  const errorTransition = compactEvents.find((event) => event.track === "Error");
  const sealedTransition = compactEvents.find((event) => event.track === "Sealed");
  assert.strictEqual(rejectedTransition.error, true);
  assert.strictEqual(rejectedTransition.error_name, "NotAllowedError");
  assert.strictEqual(errorTransition.error, true);
  assert.strictEqual(errorTransition.error_name, "MEDIA_ERR_NETWORK");
  assert.strictEqual(sealedTransition.result, "sealed");
  assert.strictEqual(sealedTransition.error, false);
  const compactSummary = compactEvents.find((event) => event.event === "session_summary");
  assert.strictEqual(compactSummary.track_transition_count, 9);
  assert.strictEqual(compactSummary.track_playing_count, 6);
  assert.strictEqual(compactSummary.track_rejected_count, 1);
  assert.strictEqual(compactSummary.track_error_count, 2);
  assert.strictEqual(compactSummary.prepared_count, 2);
  assert.strictEqual(compactSummary.unprepared_count, 7);
  assert.strictEqual(compactSummary.served_from_prefetch_count, 1);
  assert.strictEqual(compactSummary.waiting_count, 2);
  assert.strictEqual(compactSummary.stalled_count, 1);
  assert.strictEqual(compactSummary.spa_navigation_count, 1);
  assert.strictEqual(compactSummary.spa_cover_not_ready_count, 0);
  assert.strictEqual(compactSummary.spa_second_cover_not_ready_count, 0);
  assert.strictEqual(compactSummary.max_first_paint_ms, 18);
  assert.strictEqual(compactSummary.max_second_paint_ms, 34);
  assert.strictEqual(compactSummary.mini_visibility_change_count, 3);
  assert.strictEqual(compactSummary.mini_unexpected_hidden_count, 1);
  assert.strictEqual(compactSummary.html_cache_hit_count, 1);
  assert.strictEqual(compactSummary.html_cache_miss_count, 0);
  assert.strictEqual(compactSummary.cover_cache_hit_count, 1);
  assert.strictEqual(compactSummary.cover_cache_miss_count, 1);
  assert.strictEqual(compactSummary.storage_probe_count, 1);
  assert.strictEqual(compactSummary.storage_persisted_state, 2);
  assert.strictEqual(compactSummary.storage_persist_request_count, 1);
  assert.strictEqual(compactSummary.storage_persist_granted_count, 1);
  assert.strictEqual(compactSummary.storage_usage_mb, 18);
  assert.strictEqual(compactSummary.storage_quota_mb, 4096);
  assert.strictEqual(compactSummary.storage_shell_present, 1);
  assert.strictEqual(compactSummary.storage_sw_controlled, 1);
  assert.strictEqual(compactSummary.storage_cover_entries, 31);
  assert.strictEqual(compactSummary.storage_audio_entries, 6);
  assert.strictEqual(compactSummary.storage_catalog_entries, 1);
  assert.strictEqual(compactSummary.visualizer_open_count, 1);
  assert.strictEqual(compactSummary.visualizer_activation_success_count, 1);
  assert.strictEqual(compactSummary.visualizer_frame_count, 42);
  assert.strictEqual(compactSummary.visualizer_nonzero_frame_count, 40);
  assert.strictEqual(compactSummary.visualizer_zero_frame_count, 2);
  assert.strictEqual(compactSummary.visualizer_max_rms_milli, 640);
  assert.strictEqual(compactSummary.visualizer_energy_range_milli, 390);
  assert.strictEqual(compactSummary.visualizer_audio_advanced_ms, 1500);
  assert.strictEqual(compactSummary.visualizer_context_running, 1);
  assert.strictEqual(compactSummary.visualizer_analyser_ready, 1);
  assert.strictEqual(compactSummary.visualizer_canvas_visible, 1);
  assert.strictEqual(compactSummary.media_command_count, 1);
  assert.strictEqual(compactSummary.media_play_count, 1);
  assert.strictEqual(compactSummary.media_command_no_progress_count, 1);
  assert.strictEqual(compactSummary.media_command_recovered_count, 1);
  assert.strictEqual(compactSummary.audio_interruption_count, 1);
  assert.strictEqual(compactSummary.launch_summary_count, 1);
  assert.strictEqual(compactSummary.background_window_count, 1);
  assert.strictEqual(compactSummary.album_swipe_count, 1);
  assert.strictEqual(compactSummary.album_swipe_cancel_count, 1);
  assert.strictEqual(compactSummary.queue_reorder_count, 1);
  assert.strictEqual(compactSummary.queue_reorder_success_count, 1);
  const compactVisualizer = compactEvents.find((event) => event.event === "visualizer_health");
  assert.strictEqual(compactVisualizer.result, "ready");
  assert.strictEqual(compactVisualizer.state, "running");
  assert.strictEqual(compactVisualizer.visualizer_frame_count, 42);
  const compactNavigation = compactEvents.find((event) => event.event === "spa_navigation");
  assert.strictEqual(compactNavigation.cover_ready_at_first_paint, true);
  assert.strictEqual(compactNavigation.first_paint_ms, 18);
  assert.strictEqual(compactNavigation.cover_ready_at_second_paint, true);
  assert.strictEqual(compactNavigation.second_paint_ms, 34);
  const playingLatencies = compactEvents
    .filter((event) => event.event === "track_transition" && event.result === "playing")
    .map((event) => Number(event.delta_ms));
  assert.strictEqual(
    compactSummary.total_play_to_playing_ms,
    playingLatencies.reduce((total, value) => total + value, 0),
    "Rejected, error and sealed transitions must not pollute audible latency totals"
  );
  assert.strictEqual(compactSummary.max_play_to_playing_ms, Math.max(...playingLatencies));
  assert.strictEqual(
    compactEvents.filter((event) => event.event === "error" && event.error === true).length,
    1,
    "A post-playing media error must be retained once with error=true"
  );
  compactEvents.forEach((event) => {
    ["src", "track_path", "client_id", "from_url", "to_url"].forEach((field) => {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(event, field), false, `${field} leaked from compact telemetry`);
    });
  });
  const failedSessionId = requests[1].payload.reports[0].session_id;
  assert.strictEqual(telemetry.hasPendingEvents(), true, "Failed delivery must remain in IndexedDB");
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 2, "Failed hidden delivery must not retry again on pagehide");

  fetchOk = true;
  deferNextFetch = true;
  sandbox.document.visibilityState = "visible";
  const telemetryAfterRelaunch = createTelemetry();
  telemetryAfterRelaunch.initLifecycle();
  await settle(40);
  assert.strictEqual(requests.length, 3, "Next launch must retry pending sealed sessions once");
  assert.strictEqual(requests[2].options.keepalive, false);
  assert.strictEqual(requests[2].payload.reports.length, 1);
  assert.strictEqual(requests[2].payload.reports[0].session_id, failedSessionId);
  assert.strictEqual(requests[2].payload.reports[0].close_reason, "visibility_hidden");

  telemetryAfterRelaunch.trackRuntimeEvent("playing", { track: "Closing during retry", album: "Album" });
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 3, "Hidden must wait for the in-flight startup retry");
  assert.strictEqual(deferredFetches.length, 1);

  deferredFetches.shift()();
  await settle(40);
  assert.strictEqual(requests.length, 4, "Hidden during startup retry must coalesce one follow-up delivery");
  assert.strictEqual(requests[3].options.keepalive, true);
  assert.strictEqual(requests[3].payload.reports.length, 1);
  assert.notStrictEqual(requests[3].payload.reports[0].session_id, failedSessionId);
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 4, "pagehide must not duplicate the coalesced delivery");

  databases.clear();
  const legacyStartedAt = Date.now() - 5000;
  const legacySessionId = `s-${legacyStartedAt.toString(36)}-legacy-v3-session`;
  databases.set("infra_audio_telemetry_v2", {
    stores: new Map([["sessions", new Map([[legacySessionId, {
      schema_version: 3,
      session_id: legacySessionId,
      status: "active",
      build: "audiofix388-20260807",
      ua_class: "ios_pwa",
      effective_type: "4g",
      started_at_ms: legacyStartedAt,
      last_at_ms: legacyStartedAt + 1000,
      ended_at_ms: 0,
      close_reason: "",
      dropped_events: 0,
      summary: {},
      events: [{
        event: "playing",
        timestamp_ms: legacyStartedAt + 1000,
        track: "Legacy v3",
        album: "Legacy"
      }]
    }]])]])
  });
  sandbox.document.visibilityState = "visible";
  const requestsBeforeLegacyRetry = requests.length;
  const telemetryWithLegacyV3 = createTelemetry();
  telemetryWithLegacyV3.initLifecycle();
  await settle(40);
  assert.strictEqual(requests.length, requestsBeforeLegacyRetry + 1, "An abandoned v3 session must retry on v4 startup");
  assert.strictEqual(requests.at(-1).payload.schema_version, 3, "A v3 retry must keep its original envelope schema");
  assert.strictEqual(requests.at(-1).payload.reports[0].session_id, legacySessionId);

  console.log("Audio telemetry session v4 lifecycle/privacy checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
