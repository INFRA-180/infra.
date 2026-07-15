#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const CORE_PATH = path.join(ROOT, "public/assets/js/audio-core.js");
const RADIO_PATH = path.join(ROOT, "public/assets/js/audio-radio.js");
const PREFETCH_PATH = path.join(ROOT, "public/assets/js/audio-prefetch.js");
const ALBUM_UI_PATH = path.join(ROOT, "public/assets/js/album-player-ui.js");
const NOW_PLAYING_PATH = path.join(ROOT, "public/assets/js/now-playing.js");
const TRANSPORT_UI_PATH = path.join(ROOT, "public/assets/js/transport-ui.js");
const STYLES_PATH = path.join(ROOT, "public/assets/css/styles.css");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      const normalized = String(key);
      return values.has(normalized) ? values.get(normalized) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    }
  };
}

function createSandbox(overrides) {
  const timerCalls = [];
  const root = { appendChild() {} };
  const sandbox = {
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    Promise,
    console: {
      info() {},
      warn() {},
      error() {},
      log() {}
    },
    location: { href: "https://site.test/index.html", origin: "https://site.test" },
    navigator: {
      userActivation: { isActive: true, hasBeenActive: true },
      mediaSession: null
    },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    document: {
      visibilityState: "visible",
      body: {
        classList: { contains: (name) => name === "home-screen" },
        appendChild() {}
      },
      documentElement: { appendChild() {} },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
      createElement() {
        throw new Error("The runtime test must reuse its stubbed audio element");
      }
    },
    setTimeout(callback, delay) {
      const normalizedDelay = Number(delay) || 0;
      timerCalls.push(normalizedDelay);
      const handle = setTimeout(callback, normalizedDelay);
      if (handle && typeof handle.unref === "function") handle.unref();
      return handle;
    },
    clearTimeout,
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    performance: { now: () => Date.now() },
    fetch: () => Promise.reject(new Error("Unexpected network request"))
  };
  Object.assign(sandbox, overrides || {});
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.__timerCalls = timerCalls;
  sandbox.__root = root;
  vm.createContext(sandbox);
  return sandbox;
}

function loadScript(sandbox, filePath) {
  vm.runInContext(fs.readFileSync(filePath, "utf8"), sandbox, { filename: filePath });
}

function makeTracks(count) {
  return Array.from({ length: count }, (_unused, index) => ({
    src: `https://media.test/track-${index}.m4a`,
    name: `Track ${index}`,
    album: "Runtime test",
    artist: "INFRA."
  }));
}

function hashString(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeAudio(onPlay) {
  return {
    paused: true,
    currentTime: 0,
    duration: 180,
    readyState: 0,
    networkState: 0,
    volume: 1,
    src: "",
    currentSrc: "",
    preload: "none",
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    pause() { this.paused = true; },
    play() {
      if (typeof onPlay === "function") onPlay();
      this.paused = false;
      this.currentSrc = this.src;
      return Promise.resolve();
    }
  };
}

function createCoreHarness(options) {
  const opts = options || {};
  const sandbox = createSandbox();
  loadScript(sandbox, CORE_PATH);
  let playCalls = 0;
  const playlist = opts.playlist || makeTracks(11);
  const audio = makeAudio(() => { playCalls += 1; });
  const state = {
    audio,
    playlist,
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    currentIndex: Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0,
    activeLogicalSrc: playlist[Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0].src,
    homeMode: "album",
    shuffleOn: Boolean(opts.shuffleOn),
    recentPlayed: [],
    recentPlayedLimit: 20,
    startRequestToken: 0,
    trackStartInFlight: false
  };
  audio.src = state.activeLogicalSrc;
  audio.currentSrc = state.activeLogicalSrc;

  const api = sandbox.InfraAudioCore.createAudioCore({
    audioState: state,
    PREFETCH_NEXT_ENABLED: false,
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    getCurrentPlayableAudioSrc: (element) => state.activeLogicalSrc || element.currentSrc || element.src || "",
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    extractFilenameFromSrc: (src) => String(src || "").split("/").pop(),
    hashString,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    toAbsoluteUrlOrEmpty: (src) => String(src || ""),
    getAudioTelemetryNow: () => Date.now(),
    getAudioAssetPath: (src) => String(src || ""),
    getAudioSource: () => "r2dev",
    getTrackByIndex: () => null,
    getAutoPrefetchedNextIndex: () => -1,
    ensureRadioPlaylistForNavigation: () => true,
    ensurePlayablePlaylistContext() {},
    savePlaybackQueueContext() {},
    maybePrefetchNextTrack() {},
    revokeActiveBlobUrl() {},
    clearFadeTimer() {},
    clearWaitingRecovery() {},
    clearOtherTrackStatuses() {},
    clearTrackStatus() {},
    setTrackStatus() {},
    syncAudioUi() {},
    syncMediaSessionMetadata() {},
    scheduleMediaSessionResync() {},
    bindMediaSessionActions() {},
    startAudioRaf() {},
    clearTrackFailure() {},
    forceAudioFullVolume() {},
    fadeInAudio() {},
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {},
    logAudioAuditEvent() {},
    extendAlbumPlaylistToNextAlbum: () => -1
  });

  return { api, audio, state, sandbox, getPlayCalls: () => playCalls };
}

function testPreparedColdPlayIsSynchronous() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const startCalls = [];
  const prepared = makeTracks(8);
  const audio = makeAudio();
  const state = {
    audio,
    homeModeInitialized: true,
    homeModeStorageKey: "infra_home_mode_test",
    queueStorageKey: "infra_queue_test",
    resumeStorageKey: "infra_resume_test",
    initialRandomReady: true,
    initialRandomPlaylist: prepared.slice(),
    initialRandomFirstSrc: prepared[0].src,
    initialRandomPrepareToken: 1,
    globalRandomStartInFlight: false,
    playlist: [],
    playlistKind: "album",
    currentIndex: -1,
    recentPlayed: [],
    radioQueue: [],
    radioQueueCursor: -1,
    radioQueueBatchSize: 25,
    radioQueueExtendBy: 12,
    radioQueueMinRemaining: 7
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    getSpaPersistRoot: () => sandbox.__root,
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    getCurrentPlayableAudioSrc: (element) => element.currentSrc || element.src || "",
    normalizeAudioSourceUrl: (src) => String(src || ""),
    toAbsoluteUrlOrEmpty: (src) => String(src || ""),
    toAbsoluteUrl: (src) => String(src || ""),
    normalizeTrackTitle: (value) => String(value || ""),
    normalizeAlbumTitle: (value) => String(value || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    syncPlaylistContext() {},
    syncMediaSessionMetadata() {},
    syncAudioUi() {},
    bindMediaSessionActions() {},
    ensureGlobalTransportUi() {},
    syncTransportUi() {},
    startTrack(index, startOptions) {
      startCalls.push({ index, options: startOptions });
    }
  });

  const timersBefore = sandbox.__timerCalls.length;
  const result = radio.startGlobalRandomPlayback();
  assert.strictEqual(result, true, "A prepared cold tap must report a synchronous start");
  assert.strictEqual(result && typeof result.then, "undefined", "The cold-tap result must not be a Promise");
  assert.strictEqual(startCalls.length, 1, "startTrack must run before the cold-tap handler returns");
  assert.strictEqual(startCalls[0].index, 0);
  assert.strictEqual(startCalls[0].options.immediatePlay, true);
  assert.strictEqual(startCalls[0].options.userGesture, true);
  assert.strictEqual(startCalls[0].options.coldStart, true);
  assert.strictEqual(
    sandbox.__timerCalls.length,
    timersBefore,
    "A prepared first tap must not insert a readiness timeout"
  );
  assert.strictEqual(state.homeMode, "radio");
  assert.strictEqual(state.playlist, state.radioQueue, "The real Radio queue must become authoritative");

  const coreHarness = createCoreHarness({ playlist: prepared, currentIndex: 0 });
  coreHarness.state.activeLogicalSrc = "";
  coreHarness.audio.src = "";
  coreHarness.audio.currentSrc = "";
  const coreTimersBefore = coreHarness.sandbox.__timerCalls.length;
  coreHarness.api.startTrack(0, {
    seamless: true,
    initialRandom: true,
    immediatePlay: true,
    userGesture: true,
    coldStart: true
  });
  assert.strictEqual(coreHarness.getPlayCalls(), 1, "audio.play() must execute in the same user-gesture stack");
  assert.strictEqual(
    coreHarness.sandbox.__timerCalls.length,
    coreTimersBefore,
    "The immediate user-gesture path must bypass the 110/220 ms readiness wait"
  );
}

async function testCachedTrackIsPromotedBeforeColdTap() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const sourceTracks = makeTracks(6);
  const inspectedWindows = [];
  const startCalls = [];
  const state = {
    audio: makeAudio(),
    homeModeInitialized: true,
    homeModeStorageKey: "infra_home_mode_test",
    queueStorageKey: "infra_queue_test",
    resumeStorageKey: "infra_resume_test",
    initialRandomPlaylist: [],
    initialRandomFirstSrc: "",
    initialRandomReady: false,
    initialRandomPreparing: false,
    initialRandomPreparePromise: null,
    initialRandomPrepareToken: 0,
    globalRandomStartInFlight: false,
    playlist: [],
    playlistKind: "album",
    currentIndex: -1,
    recentPlayed: [],
    radioQueue: [],
    radioQueueCursor: -1,
    radioQueueBatchSize: 6,
    radioQueueExtendBy: 6,
    radioQueueMinRemaining: 5
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    prefetchApi: {
      findFirstValidCachedSegment(sources) {
        inspectedWindows.push(sources.slice());
        return Promise.resolve({ src: sources[2], valid: true, bytes: 1024 });
      }
    },
    loadTracksData: () => Promise.resolve({
      albums: [{
        title: "Runtime test",
        page: "music/runtime.html",
        cover: "assets/runtime.webp",
        tracks: sourceTracks.map((track) => ({ src: track.src, title: track.name }))
      }]
    }),
    resolveManagedAudioSrc: (src) => String(src || ""),
    getAudioAssetPathKey: (src) => String(src || ""),
    toRuntimeAbsoluteUrl: (value) => String(value || ""),
    normalizeAudioSourceUrl: (src) => String(src || ""),
    toAbsoluteUrlOrEmpty: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    getCurrentPlayableAudioSrc: (audio) => audio.currentSrc || audio.src || "",
    syncAudioUi() {},
    syncPlaylistContext() {},
    syncMediaSessionMetadata() {},
    startTrack(index, options) { startCalls.push({ index, options }); }
  });

  await radio.prepareInitialGlobalRandomPlayback("cached_first_test");
  await flushAsyncWork();
  assert.strictEqual(inspectedWindows.length, 1, "Cold metadata preparation must inspect v7 once");
  const cachedSrc = inspectedWindows[0][2];
  assert.strictEqual(
    state.initialRandomFirstSrc,
    cachedSrc,
    "A valid existing v7 segment must be promoted to the prepared Radio head"
  );
  assert.strictEqual(state.initialRandomPlaylist[0].src, cachedSrc);

  const timersBeforeTap = sandbox.__timerCalls.length;
  assert.strictEqual(radio.startGlobalRandomPlayback(), true);
  assert.strictEqual(startCalls.length, 1);
  assert.strictEqual(state.playlist[0].src, cachedSrc, "The synchronous tap must consume the promoted cached head");
  assert.strictEqual(
    sandbox.__timerCalls.length,
    timersBeforeTap,
    "The cache lookup must finish before the tap and never be awaited from the gesture stack"
  );
}

function testAuthoritativeRollingWindow() {
  const harness = createCoreHarness({ playlist: makeTracks(11), currentIndex: 0 });
  assert.deepStrictEqual(
    Array.from(harness.api.getQueuePreviewIndices(5)),
    [1, 2, 3, 4, 5],
    "The first authoritative window must be N+1 through N+5"
  );

  for (let expected = 1; expected <= 5; expected += 1) {
    harness.api.playNext({ fromMediaSession: true, seamless: true });
    assert.strictEqual(harness.state.currentIndex, expected, `Next must consume planned index ${expected}`);
  }
  assert.deepStrictEqual(
    Array.from(harness.api.getQueuePreviewIndices(5)),
    [6, 7, 8, 9, 10],
    "After five changes the window must roll to N+6 through N+10"
  );
}

function testMaterializedShuffleOrder() {
  const harness = createCoreHarness({ playlist: makeTracks(12), currentIndex: 0, shuffleOn: true });
  const preview = Array.from(harness.api.getQueuePreviewIndices(5));
  assert.strictEqual(preview.length, 5, "Shuffle must materialize five upcoming tracks");
  assert.strictEqual(new Set(preview).size, 5, "The materialized Shuffle window must not contain duplicates");

  harness.api.playNext({ fromMediaSession: true, seamless: true });
  assert.strictEqual(
    harness.state.currentIndex,
    preview[0],
    "Next must consume the same Shuffle head exposed to prefetch"
  );
  assert.deepStrictEqual(
    Array.from(harness.api.getQueuePreviewIndices(4)),
    preview.slice(1),
    "The remaining materialized Shuffle order must survive consumption of its head"
  );
}

function validSegmentResponse() {
  const bytes = new Uint8Array(1024);
  return new Response(bytes, {
    status: 206,
    headers: {
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-1023/8192",
      "Content-Type": "audio/mp4"
    }
  });
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 10));
}

function createPrefetchRehydrationHarness(inspectCachedSegment) {
  const fetchUrls = [];
  const putSources = [];
  const events = [];
  const sandbox = createSandbox({
    fetch(request) {
      fetchUrls.push(request && request.url ? request.url : String(request || ""));
      return Promise.resolve(validSegmentResponse());
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(8);
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 10;
  audio.duration = 180;
  audio.buffered = { length: 1, end: () => 30 };
  const state = {
    audio,
    playlist,
    currentIndex: 0,
    activeLogicalSrc: playlist[0].src,
    homeMode: "album",
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    recentPlayed: [],
    mediaSessionAudioPlaying: true,
    trackStartInFlight: false,
    activeAudioRecovery: null,
    nextPrefetchGeneration: 0
  };
  const prefetchApi = {
    isSupported: () => true,
    createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-4194303" } }),
    getContentLength: (response) => Number(response.headers.get("Content-Length") || 0),
    inspectCachedSegment,
    putSingle(src) {
      putSources.push(src);
      return Promise.resolve(true);
    },
    pruneCache: () => Promise.resolve(true)
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    prefetchApi,
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    isCloudflareAudioUrl: () => true,
    getCurrentPlaylistIndexSafe: () => state.currentIndex,
    getQueuePreviewIndices(limit) {
      const indices = [];
      for (let index = state.currentIndex + 1; index < playlist.length && indices.length < limit; index += 1) {
        indices.push(index);
      }
      return indices;
    },
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent(name, payload) {
      events.push({ name, payload });
    }
  });

  return { radio, state, playlist, audio, fetchUrls, putSources, events };
}

async function testPrefetchCacheRehydrationAndCorruptFallback() {
  const inspected = [];
  const cachedHarness = createPrefetchRehydrationHarness(function (src) {
    inspected.push(src);
    return Promise.resolve({ src, found: true, valid: true, bytes: 1024 });
  });
  cachedHarness.radio.maybePrefetchNextTrack("cache_rehydration_test");
  assert.strictEqual(cachedHarness.fetchUrls.length, 0, "Network must wait for v7 cache inspection");
  await flushAsyncWork();
  assert.deepStrictEqual(
    inspected,
    cachedHarness.playlist.slice(1, 6).map((track) => track.src),
    "The complete N+1 through N+5 window must be inspected in queue order"
  );
  assert.deepStrictEqual(
    Array.from(cachedHarness.state.nextPrefetchReadySrcs),
    cachedHarness.playlist.slice(1, 6).map((track) => track.src),
    "Valid cached v7 segments must rehydrate the ready window"
  );
  assert.strictEqual(cachedHarness.fetchUrls.length, 0, "A valid rehydrated window must not be refetched");
  assert.strictEqual(cachedHarness.putSources.length, 0, "A valid rehydrated window must not be rewritten");
  assert(
    cachedHarness.events.some((entry) => entry.name === "prefetch_cache_rehydrated"),
    "Cache reuse must remain observable"
  );

  const corruptHarness = createPrefetchRehydrationHarness(function (src) {
    const isCorruptNPlusOne = src === corruptHarness.playlist[1].src;
    return Promise.resolve({
      src,
      found: true,
      valid: !isCorruptNPlusOne,
      bytes: isCorruptNPlusOne ? 0 : 1024,
      reason: isCorruptNPlusOne ? "cache_corrupt" : "cache_hit"
    });
  });
  corruptHarness.radio.maybePrefetchNextTrack("cache_corrupt_test");
  await flushAsyncWork();
  assert.deepStrictEqual(
    corruptHarness.fetchUrls,
    [corruptHarness.playlist[1].src],
    "A corrupt N+1 cache entry must fall back to one bounded network request"
  );
  assert.deepStrictEqual(
    corruptHarness.putSources,
    [corruptHarness.playlist[1].src],
    "Only the corrupt segment must be normalized back into v7"
  );
}

function createDeferredCacheInspectionHarness() {
  const pending = [];
  const harness = createPrefetchRehydrationHarness(function (src) {
    return new Promise((resolve) => {
      pending.push({ src, resolve });
    });
  });
  return { harness, pending };
}

async function resolveDeferredCacheWindow(pending) {
  await Promise.resolve();
  pending.slice().forEach(function (entry) {
    entry.resolve({ src: entry.src, found: true, valid: true, bytes: 1024 });
  });
  await flushAsyncWork();
}

async function testPrefetchCacheRehydrationRejectsStaleSnapshots() {
  const staleGeneration = createDeferredCacheInspectionHarness();
  staleGeneration.harness.radio.maybePrefetchNextTrack("stale_generation_test");
  await Promise.resolve();
  assert.strictEqual(staleGeneration.pending.length, 5);
  staleGeneration.harness.state.nextPrefetchGeneration += 1;
  await resolveDeferredCacheWindow(staleGeneration.pending);
  assert.strictEqual(
    staleGeneration.harness.state.nextPrefetchReadySrcs.size,
    0,
    "A stale generation must never rehydrate ready sources"
  );
  assert.strictEqual(staleGeneration.harness.fetchUrls.length, 0);

  const stalePlan = createDeferredCacheInspectionHarness();
  stalePlan.harness.radio.maybePrefetchNextTrack("stale_plan_test");
  await Promise.resolve();
  assert.strictEqual(stalePlan.pending.length, 5);
  stalePlan.harness.state.nextPrefetchPlanKey += "|superseded";
  await resolveDeferredCacheWindow(stalePlan.pending);
  assert.strictEqual(
    stalePlan.harness.state.nextPrefetchReadySrcs.size,
    0,
    "A stale plan key must never rehydrate ready sources"
  );
  assert.strictEqual(stalePlan.harness.fetchUrls.length, 0);
}

async function testPrefetchCacheRehydrationSkipsSourceThatBecameCurrent() {
  const deferred = createDeferredCacheInspectionHarness();
  const harness = deferred.harness;
  harness.radio.maybePrefetchNextTrack("became_current_test");
  await Promise.resolve();
  assert.strictEqual(deferred.pending.length, 5);
  const becameCurrent = harness.playlist[1].src;
  harness.state.activeLogicalSrc = becameCurrent;
  harness.audio.src = becameCurrent;
  harness.audio.currentSrc = becameCurrent;
  await resolveDeferredCacheWindow(deferred.pending);
  assert.strictEqual(
    harness.state.nextPrefetchReadySrcs.has(becameCurrent),
    false,
    "An async cache hit must not re-add the source that became current"
  );
  assert.strictEqual(
    (harness.state.nextPrefetchPlan || []).some((target) => target.src === becameCurrent),
    false,
    "The reconciled rolling window must exclude the current source"
  );
  assert.strictEqual(harness.fetchUrls.length, 0);
  assert.strictEqual(harness.putSources.length, 0);
}

async function testPrefetchGatePriorityAndConcurrency() {
  const pendingFetches = [];
  const pruneCalls = [];
  const sandbox = createSandbox({
    fetch(request) {
      return new Promise((resolve, reject) => {
        pendingFetches.push({
          url: request && request.url ? request.url : String(request || ""),
          resolve,
          reject
        });
      });
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(11);
  let bufferedEnd = 20;
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 12;
  audio.duration = 180;
  audio.buffered = { length: 1, end: () => bufferedEnd };
  const state = {
    audio,
    playlist,
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    currentIndex: 0,
    activeLogicalSrc: playlist[0].src,
    homeMode: "album",
    shuffleOn: false,
    recentPlayed: [],
    mediaSessionAudioPlaying: false,
    trackStartInFlight: false,
    activeAudioRecovery: null,
    nextPrefetchToken: 0,
    nextPrefetchGeneration: 0
  };
  const prefetchApi = {
    isSupported: () => true,
    createRequest: (src) => new Request(src, {
      headers: { Range: "bytes=0-4194303" }
    }),
    getContentLength: (response) => Number(response.headers.get("Content-Length") || 0),
    putSingle: () => Promise.resolve(true),
    pruneCache(options) {
      pruneCalls.push(options);
      return Promise.resolve(true);
    }
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    prefetchApi,
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    isCloudflareAudioUrl: () => true,
    getCurrentPlaylistIndexSafe: () => state.currentIndex,
    getQueuePreviewIndices(limit) {
      const result = [];
      for (let index = state.currentIndex + 1; index < playlist.length && result.length < limit; index += 1) {
        result.push(index);
      }
      return result;
    },
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {}
  });

  radio.maybePrefetchNextTrack("before_playing");
  assert.strictEqual(pendingFetches.length, 0, "Prefetch must not start before the playing confirmation");

  state.mediaSessionAudioPlaying = true;
  bufferedEnd = audio.currentTime + 7.99;
  radio.maybePrefetchNextTrack("buffer_too_short");
  assert.strictEqual(pendingFetches.length, 0, "Prefetch must wait for at least eight buffered seconds");

  bufferedEnd = audio.currentTime + 8;
  radio.maybePrefetchNextTrack("buffer_stable");
  assert.deepStrictEqual(
    pendingFetches.map((entry) => entry.url),
    [playlist[1].src],
    "N+1 must be the only first request"
  );
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 1);

  pendingFetches[0].resolve(validSegmentResponse());
  await flushAsyncWork();
  assert.deepStrictEqual(
    pendingFetches.slice(1).map((entry) => entry.url),
    [playlist[2].src, playlist[3].src],
    "Once N+1 is ready, the remaining window may fill two lanes"
  );
  assert.strictEqual(
    state.nextPrefetchInFlightSrcs.size,
    2,
    "No more than two segment downloads may be active"
  );
  assert.strictEqual(
    state.nextPrefetchPlan.length,
    5,
    "The prefetch plan must retain the complete N+1 through N+5 window"
  );

  radio.clearNextTrackPrefetch("runtime_test");
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 0);
  assert(pruneCalls.length > 0, "A normal clear may perform bounded selective pruning");
  const lastPrune = pruneCalls[pruneCalls.length - 1];
  assert.deepStrictEqual(
    Array.from(lastPrune.keepSources),
    [playlist[0].src],
    "A normal clear must preserve the current track instead of emptying CacheStorage"
  );
}

async function testPrefetchTimeoutRetriesOnce() {
  const fetchUrls = [];
  const sandbox = createSandbox({
    fetch(request) {
      fetchUrls.push(request && request.url ? request.url : String(request || ""));
      return new Promise((_resolve, reject) => {
        const signal = request && request.signal;
        if (!signal || typeof signal.addEventListener !== "function") return;
        signal.addEventListener("abort", function () {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(7);
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 10;
  audio.duration = 180;
  audio.buffered = { length: 1, end: () => 30 };
  const state = {
    audio,
    playlist,
    currentIndex: 0,
    activeLogicalSrc: playlist[0].src,
    homeMode: "album",
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    recentPlayed: [],
    mediaSessionAudioPlaying: true,
    trackStartInFlight: false,
    activeAudioRecovery: null,
    nextPrefetchGeneration: 0
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    PREFETCH_REQUEST_TIMEOUT_MS: 5,
    PREFETCH_MAX_ATTEMPTS: 2,
    prefetchApi: {
      isSupported: () => true,
      createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-4194303" } }),
      getContentLength: () => 0,
      putSingle: () => Promise.resolve(true),
      pruneCache: () => Promise.resolve(true)
    },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    isCloudflareAudioUrl: () => true,
    getCurrentPlaylistIndexSafe: () => state.currentIndex,
    getQueuePreviewIndices: (limit) => Array.from({ length: Math.min(5, limit) }, (_unused, offset) => offset + 1),
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {}
  });

  radio.maybePrefetchNextTrack("timeout_test");
  await new Promise((resolve) => setTimeout(resolve, 360));
  await flushAsyncWork();
  assert.strictEqual(
    fetchUrls.filter((url) => url === playlist[1].src).length,
    2,
    "A timed-out N+1 segment must retry exactly once"
  );
  assert.strictEqual(state.nextPrefetchAttemptCounts.get(playlist[1].src), 2);
  assert.strictEqual(state.nextPrefetchFailureReason, "timeout");
  assert(
    fetchUrls.includes(playlist[2].src) && fetchUrls.includes(playlist[3].src),
    "An exhausted N+1 must not starve N+2 through N+5"
  );
}

function extractFunctionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Missing ${name}() implementation`);
  const open = source.indexOf("{", start + marker.length);
  assert(open >= 0, `Missing ${name}() body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unterminated ${name}() body`);
}

function testNoGlobalPrefetchClear() {
  const radioSource = fs.readFileSync(RADIO_PATH, "utf8");
  const clearBody = extractFunctionBody(radioSource, "clearNextTrackPrefetch");
  assert(!/caches\s*\.\s*(?:delete|keys)\s*\(/.test(clearBody));
  assert(!/clearCache\s*\(/.test(clearBody));

  const sandbox = createSandbox({
    caches: { open: () => Promise.resolve(null) }
  });
  loadScript(sandbox, PREFETCH_PATH);
  assert.strictEqual(
    sandbox.InfraAudioPrefetch.clearCache,
    undefined,
    "The v7 prefetch API must not expose a global clear operation"
  );
}

function testPersistentAlbumAndFullscreenContracts() {
  const albumUiSource = fs.readFileSync(ALBUM_UI_PATH, "utf8");
  assert(!albumUiSource.includes("cleanupForeignAlbumAudioWhenIdle"));
  assert(!albumUiSource.includes('className = "track-controls"'));
  assert(!albumUiSource.includes("data-track-prev"));
  assert(!albumUiSource.includes("data-track-next"));
  assert(
    albumUiSource.includes('audioState.playlistKind === "album"'),
    "An album page may rebind only an already-active album queue"
  );
  assert(
    albumUiSource.includes("if (matchIndex >= 0)"),
    "An album route must preserve a foreign active queue instead of replacing it"
  );

  const nowPlayingSource = fs.readFileSync(NOW_PLAYING_PATH, "utf8");
  assert(
    nowPlayingSource.includes("animation.onfinish = finalize") &&
      nowPlayingSource.includes("animation.oncancel = finalize"),
    "Fullscreen completion and cancellation must share the mini-player restoration finalizer"
  );

  const transportSource = fs.readFileSync(TRANSPORT_UI_PATH, "utf8");
  const transportSyncBody = extractFunctionBody(transportSource, "syncTransportUi");
  assert(
    transportSyncBody.includes('const isAlbum = document.body.classList.contains("album-screen")') &&
      transportSyncBody.includes("isHome || isAlbum || hasPlaybackSessionActive"),
    "The cold mini-player must remain visible on album routes"
  );
  assert(
    transportSyncBody.includes("const canOpenNowPlaying = Boolean(hasPlaybackSessionActive)"),
    "A cold album route must not make fullscreen available before a playback session exists"
  );

  const miniSyncBody = extractFunctionBody(transportSource, "syncTransportMiniUi");
  assert(
    transportSource.includes("data-transport-mini-duration>0:00</span>") &&
      !miniSyncBody.includes('"--:--"') &&
      miniSyncBody.includes("audio.currentTime > 0"),
    "The mini-player duration placeholder must be 0:00 while metadata is unavailable"
  );

  const stylesSource = fs.readFileSync(STYLES_PATH, "utf8");
  const coverWrapBlock = stylesSource.match(/\.now-playing-cover-wrap\s*\{([^}]*)\}/);
  const coverBlock = stylesSource.match(/\.now-playing-cover\s*\{([^}]*)\}/);
  assert(coverWrapBlock && /overflow:\s*hidden/.test(coverWrapBlock[1]));
  assert(coverWrapBlock && /transform:\s*translateZ\(0\)/.test(coverWrapBlock[1]));
  assert(coverWrapBlock && /backface-visibility:\s*hidden/.test(coverWrapBlock[1]));
  assert(coverBlock && /border-radius:\s*0/.test(coverBlock[1]));
  assert(coverBlock && /transform:\s*translateZ\(0\) scale\(1\.002\)/.test(coverBlock[1]));
  assert(coverBlock && /backface-visibility:\s*hidden/.test(coverBlock[1]));
}

(async function run() {
  testPreparedColdPlayIsSynchronous();
  await testCachedTrackIsPromotedBeforeColdTap();
  testAuthoritativeRollingWindow();
  testMaterializedShuffleOrder();
  await testPrefetchCacheRehydrationAndCorruptFallback();
  await testPrefetchCacheRehydrationRejectsStaleSnapshots();
  await testPrefetchCacheRehydrationSkipsSourceThatBecameCurrent();
  await testPrefetchGatePriorityAndConcurrency();
  await testPrefetchTimeoutRetriesOnce();
  testNoGlobalPrefetchClear();
  testPersistentAlbumAndFullscreenContracts();
  console.log("audiofix332 runtime checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
