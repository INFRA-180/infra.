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
const COVERS_PATH = path.join(ROOT, "public/assets/js/covers.js");
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

function testSameOriginRootArtworkRepair() {
  const sandbox = createSandbox({
    location: {
      href: "https://infra-180.github.io/infra./music/v-23pi56-infra.html",
      origin: "https://infra-180.github.io"
    }
  });
  loadScript(sandbox, COVERS_PATH);
  const options = {
    baseUrl: "https://infra-180.github.io/infra./",
    currentHref: sandbox.location.href,
    currentOrigin: sandbox.location.origin,
    fallbackArtwork: "https://infra-180.github.io/infra./assets/pwa/icon.png"
  };
  assert.strictEqual(
    sandbox.InfraCovers.normalizeArtworkUrl(
      "https://infra-180.github.io/assets/music/v-23pi56-cover.jpg",
      options
    ),
    "https://infra-180.github.io/infra./assets/music/v-23pi56-cover.jpg"
  );
  assert.strictEqual(
    sandbox.InfraCovers.normalizeArtworkUrl(
      "https://infra-180.github.io/music/assets/music/v-23pi56-cover.jpg",
      options
    ),
    "https://infra-180.github.io/infra./assets/music/v-23pi56-cover.jpg"
  );
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
  const bindCalls = [];
  const playlist = opts.playlist || makeTracks(11);
  const audio = makeAudio(() => { playCalls += 1; });
  const state = {
    audio,
    playlist,
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    currentIndex: Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0,
    activeLogicalSrc: playlist[Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0].src,
    homeMode: opts.homeMode === "radio" ? "radio" : "album",
    shuffleOn: Boolean(opts.shuffleOn),
    shuffleHistory: opts.shuffleOn ? [playlist[Number.isInteger(opts.currentIndex) ? opts.currentIndex : 0].src] : [],
    shuffleHistoryCursor: opts.shuffleOn ? 0 : -1,
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
    ensureRadioQueue: opts.ensureRadioQueue || (() => false),
    syncRadioQueueToPlaylist: opts.syncRadioQueueToPlaylist || function () {},
    ensureRadioPlaylistLoaded: opts.ensureRadioPlaylistLoaded || (() => Promise.resolve([])),
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
    bindMediaSessionActions(options) { bindCalls.push(options); },
    startAudioRaf() {},
    clearTrackFailure() {},
    forceAudioFullVolume() {},
    fadeInAudio() {},
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {},
    logAudioAuditEvent() {},
    extendAlbumPlaylistToNextAlbum: opts.extendAlbumPlaylistToNextAlbum || (() => -1),
    extendAlbumPlaylistToPreviousAlbum: opts.extendAlbumPlaylistToPreviousAlbum || (() => -1)
  });

  return { api, audio, state, sandbox, getPlayCalls: () => playCalls, getBindCalls: () => bindCalls.slice() };
}

function testRadioIdlePlayUsesSynchronousPreparedQueueAndDedupesPendingPlay() {
  const playlist = makeTracks(8);
  let harness = null;
  harness = createCoreHarness({
    playlist,
    currentIndex: 0,
    homeMode: "radio",
    ensureRadioQueue: () => true,
    syncRadioQueueToPlaylist() {
      harness.state.playlist = harness.state.radioQueue;
      harness.state.currentIndex = harness.state.radioQueueCursor;
    }
  });
  harness.state.radioPlaylist = playlist.slice();
  harness.state.radioQueue = playlist.slice();
  harness.state.radioQueueCursor = 0;
  harness.state.playlist = [];
  harness.state.currentIndex = -1;
  harness.state.activeLogicalSrc = "";
  harness.audio.src = "";
  harness.audio.currentSrc = "";
  harness.audio.paused = true;
  harness.api.togglePlayPause();
  assert.strictEqual(harness.getPlayCalls(), 1, "A prepared Radio queue must play inside the tap stack");
  assert.strictEqual(harness.state.currentIndex, 0);

  harness.audio.paused = true;
  harness.state.trackStartInFlight = true;
  harness.state.playRequestTs = Date.now();
  harness.api.togglePlayPause();
  assert.strictEqual(harness.getPlayCalls(), 1, "A second Play during startup must not call audio.play twice");
  harness.state.playRequestTs = Date.now() - 1000;
  harness.api.togglePlayPause();
  assert.strictEqual(harness.getPlayCalls(), 2, "A genuinely stalled startup must not lock the Play control forever");
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

function testInMemoryColdPlayIsSynchronous() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const sourceTracks = makeTracks(8);
  const startCalls = [];
  let metadataLoadCalls = 0;
  const audio = makeAudio();
  const state = {
    audio,
    tracksData: {
      albums: [{
        title: "Runtime test",
        page: "music/runtime.html",
        cover: "assets/runtime.webp",
        tracks: sourceTracks.map((track) => ({ src: track.src, title: track.name }))
      }]
    },
    homeModeInitialized: true,
    homeModeStorageKey: "infra_home_mode_memory_test",
    queueStorageKey: "infra_queue_memory_test",
    resumeStorageKey: "infra_resume_memory_test",
    initialRandomReady: false,
    initialRandomPlaylist: [],
    initialRandomFirstSrc: "",
    initialRandomPreparing: false,
    initialRandomPreparePromise: null,
    initialRandomPrepareToken: 0,
    globalRandomStartInFlight: false,
    playlist: [],
    playlistKind: "album",
    currentIndex: -1,
    recentPlayed: [],
    radioPlaylist: [],
    radioQueue: [],
    radioQueueCursor: -1,
    radioQueueBatchSize: 8,
    radioQueueExtendBy: 4,
    radioQueueMinRemaining: 5
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    loadTracksData() {
      metadataLoadCalls += 1;
      return Promise.reject(new Error("The in-memory cold tap must not reload metadata"));
    },
    resolveManagedAudioSrc: (src) => String(src || ""),
    getAudioAssetPathKey: (src) => String(src || ""),
    toRuntimeAbsoluteUrl: (value) => String(value || ""),
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

  assert.strictEqual(
    radio.canStartInitialGlobalRandomPlayback(),
    true,
    "In-memory catalogue metadata must make the cold transport actionable"
  );
  const timersBefore = sandbox.__timerCalls.length;
  const result = radio.startGlobalRandomPlayback();
  assert.strictEqual(result, true, "A cold tap backed by tracksData must start synchronously");
  assert.strictEqual(result && typeof result.then, "undefined", "The in-memory cold path must not return a Promise");
  assert.strictEqual(metadataLoadCalls, 0, "The gesture stack must not await or restart catalogue loading");
  assert.strictEqual(startCalls.length, 1, "The first tap must reach startTrack before returning");
  assert.strictEqual(startCalls[0].index, 0);
  assert.strictEqual(startCalls[0].options.immediatePlay, true);
  assert.strictEqual(startCalls[0].options.userGesture, true);
  assert.strictEqual(startCalls[0].options.coldStart, true);
  assert.strictEqual(sandbox.__timerCalls.length, timersBefore, "The in-memory cold path must not insert a timer");
  assert.strictEqual(state.homeMode, "radio");
  assert.strictEqual(state.playlist, state.radioQueue);
  assert.strictEqual(state.playlist.length, sourceTracks.length);
}

function createDeferredRadioNavigationHarness() {
  let resolveTracksData;
  const tracksDataPromise = new Promise((resolve) => {
    resolveTracksData = resolve;
  });
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const calls = [];
  const state = {
    audio: makeAudio(),
    homeMode: "radio",
    modeTransitionToken: 7,
    homeModeStorageKey: "infra_home_mode_navigation_test",
    queueStorageKey: "infra_queue_navigation_test",
    resumeStorageKey: "infra_resume_navigation_test",
    playlist: [],
    playlistKind: "radio",
    currentIndex: -1,
    recentPlayed: [],
    radioPlaylist: [],
    radioLoadingPromise: null,
    radioNavigationRequest: null,
    radioNavigationPromise: null,
    radioQueue: [],
    radioQueueCursor: -1,
    radioQueueBatchSize: 8,
    radioQueueExtendBy: 4,
    radioQueueMinRemaining: 5
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    loadTracksData: () => tracksDataPromise,
    resolveManagedAudioSrc: (src) => String(src || ""),
    toRuntimeAbsoluteUrl: (value) => String(value || ""),
    normalizeTrackTitle: (value) => String(value || ""),
    normalizeAlbumTitle: (value) => String(value || ""),
    toAbsoluteUrlOrEmpty: (value) => String(value || ""),
    toAbsoluteUrl: (value) => String(value || ""),
    normalizeAudioSourceUrl: (value) => String(value || ""),
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    syncPlaylistContext() {},
    syncMediaSessionMetadata() {},
    syncAudioUi() {},
    playNext(options) { calls.push({ direction: "next", options }); },
    playPrevious(options) { calls.push({ direction: "previous", options }); }
  });
  const tracks = makeTracks(10);
  const resolve = () => resolveTracksData({
    albums: [{
      title: "Runtime test",
      page: "music/runtime.html",
      cover: "assets/runtime.webp",
      tracks: tracks.map((track) => ({ src: track.src, title: track.name }))
    }]
  });
  return { radio, state, calls, resolve };
}

async function testQueuedRadioNavigationReplaysInOrderAndInvalidatesOnModeChange() {
  const queued = createDeferredRadioNavigationHarness();
  assert.strictEqual(queued.radio.ensureRadioPlaylistForNavigation("next", { surface: "mini" }), false);
  assert.strictEqual(queued.radio.ensureRadioPlaylistForNavigation("previous", { surface: "fullscreen" }), false);
  assert.strictEqual(queued.radio.ensureRadioPlaylistForNavigation("next", { surface: "media_session" }), false);
  assert.strictEqual(queued.state.radioNavigationRequest.commands.length, 3);
  queued.resolve();
  await flushAsyncWork();
  assert.deepStrictEqual(
    queued.calls.map((call) => call.direction),
    ["next", "previous", "next"],
    "Commands accepted while Radio metadata loads must replay exactly in tap order"
  );
  assert.deepStrictEqual(
    queued.calls.map((call) => call.options.surface),
    ["mini", "fullscreen", "media_session"],
    "Queued navigation must preserve each command's transport options"
  );
  assert(queued.calls.every((call) => call.options.radioNavigationRetry === true));
  assert.strictEqual(queued.state.radioNavigationRequest, null);
  assert.strictEqual(queued.state.radioNavigationPromise, null);

  const invalidated = createDeferredRadioNavigationHarness();
  invalidated.radio.ensureRadioPlaylistForNavigation("next", { surface: "mini" });
  const tokenBeforeModeChange = invalidated.state.modeTransitionToken;
  invalidated.radio.setHomePlayMode("album", { force: true });
  assert.strictEqual(invalidated.state.homeMode, "album");
  assert.strictEqual(invalidated.state.modeTransitionToken, tokenBeforeModeChange + 1);
  invalidated.resolve();
  await flushAsyncWork();
  assert.deepStrictEqual(
    invalidated.calls,
    [],
    "A Radio command waiting on metadata must be discarded after leaving Radio mode"
  );

  const reanchored = createDeferredRadioNavigationHarness();
  reanchored.radio.ensureRadioPlaylistForNavigation("next", { surface: "old_source" });
  reanchored.state.startRequestToken = 1;
  reanchored.state.activeLogicalSrc = "https://media.test/selected-during-load.m4a";
  reanchored.radio.ensureRadioPlaylistForNavigation("previous", { surface: "new_source" });
  reanchored.resolve();
  await flushAsyncWork();
  assert.deepStrictEqual(
    reanchored.calls.map((call) => call.options.surface),
    ["new_source"],
    "A track selection during Radio loading must invalidate commands captured for the old source"
  );
}

async function testCachedPrefixIsMaterializedBeforeColdTap() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const sourceTracks = makeTracks(12);
  const inspectedWindows = [];
  let cachedPrefix = [];
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
      findFirstValidCachedSegment() {
        throw new Error("The grouped v9 helper must own cold Radio restoration");
      },
      findValidCachedSegments(sources, limit) {
        inspectedWindows.push(sources.slice());
        assert.strictEqual(limit, 6);
        cachedPrefix = [sources[8], sources[2], sources[10]];
        return Promise.resolve(cachedPrefix.map((src) => ({
          src,
          valid: true,
          bytes: 1024
        })));
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
  assert.strictEqual(inspectedWindows.length, 1, "Cold metadata preparation must inspect v9 once");
  assert.strictEqual(
    inspectedWindows[0].length,
    sourceTracks.length,
    "Cold Radio must inspect the complete global catalogue without fetching audio"
  );
  assert.strictEqual(
    state.initialRandomFirstSrc,
    cachedPrefix[0],
    "The first valid v9 segment must remain the synchronous cold-play target"
  );
  assert.deepStrictEqual(
    Array.from(state.initialRandomPlaylist.slice(0, cachedPrefix.length), (track) => track.src),
    cachedPrefix,
    "Every valid v9 segment must form one contiguous Radio prefix"
  );
  assert.strictEqual(state.initialRandomPlaylist.length, 6, "Cached prefix insertion must preserve queue length");
  assert.strictEqual(
    new Set(state.initialRandomPlaylist.map((track) => track.src)).size,
    state.initialRandomPlaylist.length,
    "Cached prefix insertion must not duplicate tracks"
  );

  const timersBeforeTap = sandbox.__timerCalls.length;
  assert.strictEqual(radio.startGlobalRandomPlayback(), true);
  assert.strictEqual(startCalls.length, 1);
  assert.deepStrictEqual(
    Array.from(state.playlist.slice(0, cachedPrefix.length), (track) => track.src),
    cachedPrefix,
    "The synchronous tap must consume the complete cached Radio prefix"
  );
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

function testAlbumContinuesChronologicallyPastItsLastTrack() {
  const playlist = makeTracks(3);
  let extensionCalls = 0;
  const harness = createCoreHarness({
    playlist,
    currentIndex: playlist.length - 1,
    extendAlbumPlaylistToNextAlbum() {
      extensionCalls += 1;
      if (extensionCalls > 1) return -1;
      const firstNextIndex = playlist.length;
      playlist.push(...Array.from({ length: 5 }, (_unused, index) => ({
        src: `https://media.test/next-album-${index}.m4a`,
        name: `Next album ${index}`,
        album: "Next album"
      })));
      return firstNextIndex;
    }
  });

  assert.deepStrictEqual(
    Array.from(harness.api.getQueuePreviewIndices(5)),
    [3, 4, 5, 6, 7],
    "The final album track must expose the next chronological album as N+1"
  );
  harness.api.playNext({ fromMediaSession: true, seamless: true });
  assert.strictEqual(harness.state.currentIndex, 3, "Next must consume the same chronological N+1 exposed to prefetch");
  assert.strictEqual(extensionCalls, 1, "The next album must be appended only once");
  assert.strictEqual(playlist.length, 8, "The existing album queue must be extended without replacing the current track");
}

async function testTransportMediaSessionActionsAreReassertedPerTrack() {
  const harness = createCoreHarness({ playlist: makeTracks(3), currentIndex: 0 });
  harness.api.playNext({ fromMediaSession: true, seamless: true });
  await Promise.resolve();
  await Promise.resolve();
  assert(
    harness.getBindCalls().some((options) => options && options.force === true && options.quiet === true),
    "A successful track change must quietly reassert Media Session handlers for WebKit"
  );
}

function testSameSourceRetryKeepsMetadataPending() {
  const harness = createCoreHarness({ playlist: makeTracks(2), currentIndex: 0 });
  harness.state.sourceMetadataPending = true;
  harness.api.startTrack(0, { seamless: true });
  assert.strictEqual(
    harness.state.sourceMetadataPending,
    true,
    "A same-source retry after reset must keep 0:00 until new metadata arrives"
  );
}

function testRestoredNonRadioQueueIsScopedToCurrentAlbum() {
  for (const persistedKind of ["album", "global", "favorites"]) {
    const sandbox = createSandbox();
    loadScript(sandbox, RADIO_PATH);
    const albumA = [
      { src: "https://media.test/a-1.m4a", name: "A1", album: "Album A", page: "https://site.test/music/a.html" },
      { src: "https://media.test/a-2.m4a", name: "A2", album: "Album A", page: "https://site.test/music/a.html" }
    ];
    const albumB = [
      { src: "https://media.test/b-1.m4a", name: "B1", album: "Album B", page: "https://site.test/music/b.html" },
      { src: "https://media.test/b-2.m4a", name: "B2", album: "Album B", page: "https://site.test/music/b.html" }
    ];
    const state = {
      audio: makeAudio(),
      playlist: [],
      playlistKind: "album",
      currentIndex: -1,
      activeLogicalSrc: albumA[1].src,
      homeMode: "album",
      homeModeStorageKey: "infra_home_mode_test",
      queueStorageKey: "infra_queue_test",
      resumeStorageKey: "infra_resume_test",
      radioQueue: [],
      radioQueueCursor: -1,
      radioQueueMinRemaining: 5
    };
    sandbox.sessionStorage.setItem(state.queueStorageKey, JSON.stringify({
      playlist: albumA.concat(albumB),
      currentIndex: 3,
      currentSrc: albumA[1].src,
      homeMode: "album",
      playlistKind: persistedKind,
      shuffleOn: persistedKind !== "album"
    }));
    const radio = sandbox.InfraAudioRadio.createAudioRadio({
      audioState: state,
      runtime: { baseUrl: new URL("https://site.test/") },
      getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
      toAbsoluteUrlOrEmpty: (value) => String(value || ""),
      toAbsoluteUrl: (value) => String(value || ""),
      normalizeAudioSourceUrl: (value) => String(value || ""),
      normalizeTrackTitle: (value) => String(value || ""),
      normalizeAlbumTitle: (value) => String(value || ""),
      srcMatches: (left, right) => String(left || "") === String(right || ""),
      syncPlaylistContext() {},
      syncMediaSessionMetadata() {},
      syncAudioUi() {}
    });

    assert.strictEqual(radio.restorePlaybackQueueContext(), true);
    assert.deepStrictEqual(
      Array.from(state.playlist, (track) => track.src),
      albumA.map((track) => track.src),
      `A persisted ${persistedKind} queue with Radio off must be migrated to the active album only`
    );
    assert.strictEqual(state.playlistKind, "album", "A non-Radio restore must persist as an album queue");
    assert.strictEqual(state.currentIndex, 1, "The restored current index must be recalculated inside the scoped album");
  }
}

function testLargeRadioQueuePersistenceRetainsActiveTrack() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const queue = makeTracks(283);
  const activeIndex = 275;
  const activeSrc = queue[activeIndex].src;
  const state = {
    audio: makeAudio(),
    playlist: queue,
    playlistKind: "radio",
    currentIndex: activeIndex,
    activeLogicalSrc: activeSrc,
    homeMode: "radio",
    shuffleOn: false,
    homeModeStorageKey: "infra_home_mode_large_queue_test",
    queueStorageKey: "infra_queue_large_queue_test",
    resumeStorageKey: "infra_resume_large_queue_test",
    radioPlaylist: queue.slice(),
    radioQueue: queue,
    radioQueueCursor: activeIndex,
    recentPlayed: [],
    lastSavedQueueSignature: ""
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    toAbsoluteUrlOrEmpty: (value) => String(value || ""),
    toAbsoluteUrl: (value) => String(value || ""),
    normalizeAudioSourceUrl: (value) => String(value || ""),
    normalizeTrackTitle: (value) => String(value || ""),
    normalizeAlbumTitle: (value) => String(value || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    getCurrentTrackArtwork: () => ""
  });

  radio.savePlaybackQueueContext();
  const payload = JSON.parse(sandbox.sessionStorage.getItem(state.queueStorageKey));
  assert.strictEqual(payload.playlist.length, 260, "Session storage must remain bounded to 260 tracks");
  assert.strictEqual(payload.currentSrc, activeSrc, "The active source must survive bounded persistence");
  assert(payload.currentIndex >= 0 && payload.currentIndex < payload.playlist.length);
  assert.strictEqual(
    payload.playlist[payload.currentIndex].src,
    activeSrc,
    "An active Radio track beyond index 260 must remain addressable after windowing"
  );
  assert(
    payload.playlist.some((track) => track.src === activeSrc),
    "The bounded persistence window must be centered around, not truncate before, the active track"
  );
}

function testShuffleScopesTheCurrentAlbumWhenRadioIsOff() {
  let randomCursor = 0;
  const controlledMath = Object.create(Math);
  controlledMath.random = () => [0.125, 0.625, 0.875][randomCursor++ % 3];
  const sandbox = createSandbox({ Math: controlledMath });
  loadScript(sandbox, RADIO_PATH);
  const globalPlaylist = [
    { src: "https://media.test/a-1.m4a", name: "A1", album: "Album A", page: "https://site.test/music/a.html" },
    { src: "https://media.test/a-2.m4a", name: "A2", album: "Album A", page: "https://site.test/music/a.html" },
    { src: "https://media.test/b-1.m4a", name: "B1", album: "Album B", page: "https://site.test/music/b.html" },
    { src: "https://media.test/b-2.m4a", name: "B2", album: "Album B", page: "https://site.test/music/b.html" }
  ];
  const state = {
    audio: makeAudio(),
    playlist: globalPlaylist.slice(),
    playlistKind: "global",
    currentIndex: 1,
    activeLogicalSrc: globalPlaylist[1].src,
    homeMode: "album",
    shuffleOn: false,
    homeModeStorageKey: "infra_home_mode_test",
    queueStorageKey: "infra_queue_test",
    resumeStorageKey: "infra_resume_test",
    radioQueue: [],
    radioQueueCursor: -1,
    radioPlaylist: []
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlaylistTrack: () => state.playlist[state.currentIndex] || null,
    buildPreservedTrack: (track, src) => Object.assign({}, track || { src }),
    toAbsoluteUrlOrEmpty: (value) => String(value || ""),
    toAbsoluteUrl: (value) => String(value || ""),
    normalizeAudioSourceUrl: (value) => String(value || ""),
    normalizeTrackTitle: (value) => String(value || ""),
    normalizeAlbumTitle: (value) => String(value || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    syncPlaylistContext() {},
    syncMediaSessionMetadata() {},
    syncAudioUi() {}
  });

  radio.toggleAlbumShuffleMode();
  assert.strictEqual(state.shuffleOn, true);
  const firstShuffleSeed = state.shuffleSessionSeed;
  assert(firstShuffleSeed, "Shuffle activation must create a session seed");
  assert.strictEqual(state.playlistKind, "album");
  assert.deepStrictEqual(
    Array.from(state.playlist, (track) => track.src),
    globalPlaylist.slice(0, 2).map((track) => track.src),
    "Shuffle with Radio off must be restricted to the selected track's album"
  );
  assert.strictEqual(state.currentIndex, 1);
  assert.strictEqual(state.activeLogicalSrc, globalPlaylist[1].src, "Mode changes must not replace the current source");

  radio.toggleAlbumShuffleMode();
  assert.strictEqual(state.shuffleOn, false);
  assert.strictEqual(state.shuffleSessionSeed, "", "Disabling Shuffle must close the seeded ordering session");
  assert.deepStrictEqual(Array.from(state.playlist, (track) => track.src), globalPlaylist.slice(0, 2).map((track) => track.src));

  radio.toggleAlbumShuffleMode();
  const secondShuffleSeed = state.shuffleSessionSeed;
  assert(state.shuffleOn);
  assert(secondShuffleSeed && secondShuffleSeed !== firstShuffleSeed, "Each Shuffle activation must materialize a fresh order");
  assert.deepStrictEqual(Array.from(state.shuffleHistory), [globalPlaylist[1].src]);
  assert.strictEqual(state.shuffleHistoryCursor, 0);
  const persisted = JSON.parse(sandbox.sessionStorage.getItem(state.queueStorageKey));
  assert.strictEqual(persisted.shuffleSeed, secondShuffleSeed, "The materialized Shuffle order seed must survive session persistence");
}

function testShuffleFromRadioSwitchesToCurrentAlbumWithoutRestart() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  const radioPlaylist = [
    { src: "https://media.test/a-1.m4a", name: "A1", album: "Album A", page: "https://site.test/music/a.html" },
    { src: "https://media.test/a-2.m4a", name: "A2", album: "Album A", page: "https://site.test/music/a.html" },
    { src: "https://media.test/b-1.m4a", name: "B1", album: "Album B", page: "https://site.test/music/b.html" }
  ];
  const audio = makeAudio();
  audio.src = radioPlaylist[0].src;
  audio.currentSrc = radioPlaylist[0].src;
  const state = {
    audio,
    playlist: radioPlaylist.slice(),
    playlistKind: "radio",
    currentIndex: 0,
    activeLogicalSrc: radioPlaylist[0].src,
    homeMode: "radio",
    shuffleOn: false,
    homeModeStorageKey: "infra_home_mode_test",
    queueStorageKey: "infra_queue_test",
    resumeStorageKey: "infra_resume_test",
    radioPlaylist: [],
    radioQueue: radioPlaylist.slice(),
    radioQueueCursor: 0,
    upcomingTrackPlan: { mode: "linear", entries: [] },
    tracksData: {
      albums: [
        {
          title: "Album A",
          page: "https://site.test/music/a.html",
          cover: "https://site.test/assets/a.webp",
          tracks: radioPlaylist.slice(0, 2).map((track) => ({ src: track.src, title: track.name }))
        },
        {
          title: "Album B",
          page: "https://site.test/music/b.html",
          cover: "https://site.test/assets/b.webp",
          tracks: [{ src: radioPlaylist[2].src, title: radioPlaylist[2].name }]
        }
      ]
    }
  };
  let startCalls = 0;
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlaylistTrack: () => state.playlist[state.currentIndex] || null,
    toAbsoluteUrlOrEmpty: (value) => String(value || ""),
    toAbsoluteUrl: (value) => String(value || ""),
    normalizeAudioSourceUrl: (value) => String(value || ""),
    normalizeTrackTitle: (value) => String(value || ""),
    normalizeAlbumTitle: (value) => String(value || ""),
    resolveManagedAudioSrc: (value) => String(value || ""),
    getAudioAssetPathKey: (value) => String(value || ""),
    toRuntimeAbsoluteUrl: (value) => String(value || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    syncPlaylistContext() {},
    syncMediaSessionMetadata() {},
    syncAudioUi() {},
    maybePrefetchNextTrack() {},
    startTrack() { startCalls += 1; }
  });

  radio.toggleAlbumShuffleMode();
  assert.strictEqual(state.homeMode, "album", "Shuffle must explicitly leave Radio mode");
  assert.strictEqual(state.shuffleOn, true);
  assert.strictEqual(state.playlistKind, "album");
  assert.deepStrictEqual(
    Array.from(state.playlist, (track) => track.src),
    radioPlaylist.slice(0, 2).map((track) => track.src),
    "Shuffle activated from Radio must remain inside the current album"
  );
  assert.strictEqual(state.activeLogicalSrc, radioPlaylist[0].src);
  assert.strictEqual(startCalls, 0, "Changing mode must not restart the current audio source");
  assert.deepStrictEqual(Array.from(state.shuffleHistory), [radioPlaylist[0].src]);
  assert.strictEqual(state.radioPlaylist.length, 3, "A restored Radio session must rebuild album context from tracksData");
}

function testPendingSourceShowsZeroTimeInMiniAndOverlay() {
  const sandbox = createSandbox();
  loadScript(sandbox, NOW_PLAYING_PATH);
  loadScript(sandbox, TRANSPORT_UI_PATH);
  const audio = makeAudio();
  audio.src = "https://media.test/new-track.m4a";
  audio.currentSrc = audio.src;
  audio.currentTime = 37;
  audio.duration = 180;
  const state = {
    audio,
    sourceMetadataPending: true,
    nowPlayingSeeking: false,
    transport: {
      nowMini: { hidden: true },
      miniCurrent: { textContent: "" },
      miniDuration: { textContent: "" },
      miniFill: { style: {} },
      miniProgress: { disabled: false },
      overlay: {},
      overlayCurrent: { textContent: "" },
      overlayDuration: { textContent: "" },
      overlayFill: { style: {} },
      overlayProgress: { disabled: false }
    }
  };
  const format = function (seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const nowPlaying = sandbox.InfraNowPlaying.createNowPlaying({
    audioState: state,
    getCurrentPlayableAudioSrc: () => audio.src,
    formatTrackDuration: format
  });
  const transport = sandbox.InfraTransportUi.createTransportUi({
    audioState: state,
    getCurrentPlayableAudioSrc: () => audio.src,
    formatTrackDuration: format,
    syncNowPlayingOverlayProgress: nowPlaying.syncNowPlayingOverlayProgress
  });

  transport.syncTransportMiniUi();
  assert.strictEqual(state.transport.miniCurrent.textContent, "0:00");
  assert.strictEqual(state.transport.miniDuration.textContent, "0:00");
  assert.strictEqual(state.transport.miniFill.style.width, "0%");
  assert.strictEqual(state.transport.miniProgress.disabled, true);
  assert.strictEqual(state.transport.overlayCurrent.textContent, "0:00");
  assert.strictEqual(state.transport.overlayDuration.textContent, "-0:00");
  assert.strictEqual(state.transport.overlayFill.style.width, "0%");
  assert.strictEqual(state.transport.overlayProgress.disabled, true);

  state.sourceMetadataPending = false;
  transport.syncTransportMiniUi();
  assert.strictEqual(state.transport.miniCurrent.textContent, "0:37");
  assert.strictEqual(state.transport.miniDuration.textContent, "3:00");
  assert.strictEqual(state.transport.overlayDuration.textContent, "-2:23");
  assert.strictEqual(state.transport.miniProgress.disabled, false);
}

async function testIntegratedFivePreparedTransportSkips() {
  const sandbox = createSandbox();
  loadScript(sandbox, RADIO_PATH);
  loadScript(sandbox, CORE_PATH);

  const playlist = makeTracks(11);
  let playCalls = 0;
  let globalClearCalls = 0;
  let fadeCalls = 0;
  const audio = makeAudio(() => { playCalls += 1; });
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 12;
  audio.duration = 180;
  audio.buffered = { length: 1, start: () => 0, end: () => 24 };
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
    recentPlayedLimit: 20,
    mediaSessionAudioPlaying: true,
    trackStartInFlight: false,
    activeAudioRecovery: null,
    startRequestToken: 0,
    nextPrefetchGeneration: 0
  };

  let core;
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    prefetchApi: {
      isSupported: () => true,
      inspectCachedSegment: (src) => Promise.resolve({
        src,
        found: true,
        valid: true,
        probeReady: true,
        bytes: 2 * 1024 * 1024
      }),
      createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-2097151" } }),
      getContentLength: (response) => Number(response.headers.get("Content-Length") || 0),
      putSingle: () => Promise.resolve(true),
      pruneCache: () => Promise.resolve(true)
    },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc || "",
    normalizeAudioSourceUrl: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    isCloudflareAudioUrl: () => true,
    getCurrentPlaylistIndexSafe: () => state.currentIndex,
    getQueuePreviewIndices: (limit) => core.getQueuePreviewIndices(limit),
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {}
  });

  core = sandbox.InfraAudioCore.createAudioCore({
    audioState: state,
    PREFETCH_NEXT_ENABLED: true,
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc || "",
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc || "",
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    extractFilenameFromSrc: (src) => String(src || "").split("/").pop(),
    hashString,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    toAbsoluteUrlOrEmpty: (src) => String(src || ""),
    getAudioTelemetryNow: () => Date.now(),
    getAudioAssetPath: (src) => String(src || ""),
    getAudioSource: () => "r2dev",
    getTrackByIndex: () => null,
    getAutoPrefetchedNextIndex: () => radio.getAutoPrefetchedNextIndex(),
    clearNextTrackPrefetch(reason) {
      globalClearCalls += 1;
      radio.clearNextTrackPrefetch(reason);
    },
    maybePrefetchNextTrack: (reason) => radio.maybePrefetchNextTrack(reason),
    ensureRadioPlaylistForNavigation: () => true,
    ensurePlayablePlaylistContext() {},
    savePlaybackQueueContext() {},
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
    fadeOutAudio() {
      fadeCalls += 1;
      return Promise.resolve();
    },
    isIosDevice: () => true,
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {},
    logAudioAuditEvent() {},
    extendAlbumPlaylistToNextAlbum: () => -1
  });

  radio.maybePrefetchNextTrack("integrated_cache_prepare");
  await flushAsyncWork();
  assert.deepStrictEqual(
    Array.from(state.nextPrefetchReadySrcs),
    playlist.slice(1, 6).map((track) => track.src),
    "The integrated Radio scheduler must expose a ready N+1 through N+5 window to core"
  );

  const timersBefore = sandbox.__timerCalls.length;
  for (let expected = 1; expected <= 5; expected += 1) {
    core.playNext({ fromTransportControl: true, seamless: true, surface: "test" });
    assert.strictEqual(state.currentIndex, expected, `Transport tap ${expected} must consume the prepared queue head`);
    assert.strictEqual(playCalls, expected, `Transport tap ${expected} must call audio.play() synchronously`);
  }
  assert.strictEqual(globalClearCalls, 0, "Five transport taps must not clear the rolling prefetch state globally");
  assert.strictEqual(fadeCalls, 0, "Transport skips must not wait for a fade");
  assert.strictEqual(sandbox.__timerCalls.length, timersBefore, "Transport skips must bypass the iOS readiness timer");
  assert.deepStrictEqual(
    Array.from(core.getQueuePreviewIndices(5)),
    [6, 7, 8, 9, 10],
    "After five prepared skips the authoritative window must roll to N+6 through N+10"
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
  harness.api.playPrevious({ fromMediaSession: true, seamless: true });
  assert.strictEqual(
    harness.state.currentIndex,
    0,
    "Previous in Shuffle must walk the materialized history instead of choosing another random track"
  );
  harness.api.playNext({ fromMediaSession: true, seamless: true });
  assert.strictEqual(
    harness.state.currentIndex,
    preview[0],
    "Next after Shuffle Previous must walk forward through the same history"
  );
  assert.deepStrictEqual(
    Array.from(harness.api.getQueuePreviewIndices(4)),
    preview.slice(1),
    "The remaining materialized Shuffle order must survive consumption of its head"
  );

  harness.api.playPrevious({ fromMediaSession: true, seamless: true });
  assert.strictEqual(harness.state.currentIndex, 0);
  assert.strictEqual(harness.state.shuffleHistoryCursor, 0);
  assert.deepStrictEqual(
    Array.from(harness.state.shuffleHistory),
    [harness.state.playlist[0].src, harness.state.playlist[preview[0]].src],
    "Previous must move the cursor inside the existing Shuffle history without rewriting it"
  );
  harness.audio.currentTime = 17;
  const playCallsAtHistoryStart = harness.getPlayCalls();
  harness.api.playPrevious({ fromMediaSession: true, seamless: true });
  assert.strictEqual(harness.state.currentIndex, 0, "Previous at the start of Shuffle history must not select a random track");
  assert.strictEqual(harness.state.shuffleHistoryCursor, 0);
  assert.strictEqual(harness.audio.currentTime, 0, "Previous at the history boundary may restart only the current track");
  assert.strictEqual(
    harness.getPlayCalls(),
    playCallsAtHistoryStart,
    "The Shuffle history boundary must not create a second source load or play call"
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
  audio.buffered = { length: 1, start: () => 0, end: () => 30 };
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
    createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-2097151" } }),
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
  assert.strictEqual(cachedHarness.fetchUrls.length, 0, "Network must wait for v9 cache inspection");
  await flushAsyncWork();
  assert.deepStrictEqual(
    inspected,
    cachedHarness.playlist.slice(1, 6).map((track) => track.src),
    "The complete N+1 through N+5 window must be inspected in queue order"
  );
  assert.deepStrictEqual(
    Array.from(cachedHarness.state.nextPrefetchReadySrcs),
    cachedHarness.playlist.slice(1, 6).map((track) => track.src),
    "Valid cached v9 segments must rehydrate the ready window"
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
    "Only the corrupt segment must be normalized back into v9"
  );

  const legacyProbeHarness = createPrefetchRehydrationHarness(function (src) {
    const lacksProbeHeader = src === legacyProbeHarness.playlist[1].src;
    return Promise.resolve({
      src,
      found: true,
      valid: true,
      probeReady: !lacksProbeHeader,
      bytes: 1024,
      reason: "cache_hit"
    });
  });
  legacyProbeHarness.radio.maybePrefetchNextTrack("legacy_probe_test");
  await flushAsyncWork();
  assert.deepStrictEqual(
    legacyProbeHarness.fetchUrls,
    [legacyProbeHarness.playlist[1].src],
    "An older v9 N+1 entry must be refreshed once to gain the WebKit probe fast path"
  );
  assert.deepStrictEqual(legacyProbeHarness.putSources, [legacyProbeHarness.playlist[1].src]);
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
  assert.strictEqual(staleGeneration.pending.length, 1, "N+1 cache inspection must run before the tail window");
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
  assert.strictEqual(stalePlan.pending.length, 1, "A stale plan must not have started four unnecessary inspections");
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
  assert.strictEqual(deferred.pending.length, 1, "The authoritative N+1 must be inspected first");
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
        const pending = {
          url: request && request.url ? request.url : String(request || ""),
          range: request && request.headers ? request.headers.get("Range") : "",
          resolve,
          reject
        };
        pendingFetches.push(pending);
        const signal = request && request.signal;
        if (signal && typeof signal.addEventListener === "function") {
          signal.addEventListener("abort", function () {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        }
      });
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(11);
  let bufferedEnd = 19.99;
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 12;
  audio.duration = 180;
  audio.buffered = { length: 1, start: () => 0, end: () => bufferedEnd };
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
    trackStartInFlight: true,
    activeAudioRecovery: null,
    nextPrefetchToken: 0,
    nextPrefetchGeneration: 0
  };
  const prefetchApi = {
    isSupported: () => true,
    createRequest: (src) => new Request(src, {
      headers: { Range: "bytes=0-2097151" }
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

  radio.maybePrefetchNextTrack("before_playing_buffer_short");
  assert.strictEqual(pendingFetches.length, 0, "Early prefetch must still wait for eight buffered seconds");

  bufferedEnd = audio.currentTime + 7.99;
  radio.maybePrefetchNextTrack("buffer_too_short");
  assert.strictEqual(pendingFetches.length, 0, "Prefetch must wait for at least eight buffered seconds");

  bufferedEnd = audio.currentTime + 8;
  radio.maybePrefetchNextTrack("buffer_stable");
  assert.deepStrictEqual(
    pendingFetches.map((entry) => entry.url),
    [playlist[1].src],
    "A stable mobile buffer must reserve the first request for N+1"
  );
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 1);
  assert.strictEqual(
    pendingFetches[0].range,
    "bytes=0-2097151",
    "Every runtime prefetch target must request the bounded 2 MiB v9 segment"
  );

  pendingFetches[0].resolve(validSegmentResponse());
  await flushAsyncWork();
  assert.deepStrictEqual(
    pendingFetches.slice(1).map((entry) => entry.url),
    [playlist[2].src, playlist[3].src],
    "Once N+1 is ready, both lanes must advance through N+2 and N+3"
  );
  assert.strictEqual(
    state.nextPrefetchInFlightSrcs.size,
    2,
    "No more than two segment downloads may be active"
  );
  assert(
    pendingFetches.slice(1, 3).every((entry) => entry.range === "bytes=0-2097151"),
    "The N+2/N+3 lanes must use the same bounded 2 MiB segment"
  );
  assert.strictEqual(
    state.nextPrefetchPlan.length,
    5,
    "The prefetch plan must retain the complete N+1 through N+5 window"
  );

  const generationBeforeSkip = state.nextPrefetchGeneration;
  state.currentIndex = 1;
  state.activeLogicalSrc = playlist[1].src;
  audio.src = playlist[1].src;
  audio.currentSrc = playlist[1].src;
  radio.maybePrefetchNextTrack("track_change", { consumedPrepared: true });
  assert(state.nextPrefetchGeneration > generationBeforeSkip, "A fast skip must rebase the rolling window");
  assert.deepStrictEqual(
    Array.from(state.nextPrefetchInFlightSrcs).sort(),
    [playlist[2].src, playlist[3].src].sort(),
    "A fast skip must preserve useful in-flight N+2 and N+3 requests"
  );
  assert.strictEqual(
    state.nextPrefetchControllers.get(playlist[2].src).generation,
    state.nextPrefetchGeneration,
    "A preserved request must complete against the rebased generation"
  );

  pendingFetches[1].resolve(validSegmentResponse());
  pendingFetches[2].resolve(validSegmentResponse());
  await flushAsyncWork();
  assert(state.nextPrefetchReadySrcs.has(playlist[2].src));
  assert(state.nextPrefetchReadySrcs.has(playlist[3].src));

  radio.clearNextTrackPrefetch("runtime_test");
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 0);
  assert(pruneCalls.length > 0, "A normal clear may perform bounded selective pruning");
  const lastPrune = pruneCalls[pruneCalls.length - 1];
  assert.deepStrictEqual(
    Array.from(lastPrune.keepSources),
    [playlist[1].src],
    "A normal clear must preserve the current track instead of emptying CacheStorage"
  );

  const restartOffset = pendingFetches.length;
  radio.maybePrefetchNextTrack("buffer_stable");
  const unpreparedFetch = pendingFetches[restartOffset];
  assert(unpreparedFetch, "A new speculative request must start after the reset");
  const unpreparedIndex = playlist.findIndex((track) => track.src === unpreparedFetch.url);
  assert(unpreparedIndex > state.currentIndex);
  const speculativeRecords = Array.from(state.nextPrefetchControllers.values());
  assert.strictEqual(speculativeRecords.length, 2, "Both mobile lanes must be active before the unprepared skip");
  const obsoleteCurrentRecord = state.nextPrefetchControllers.get(unpreparedFetch.url);
  const usefulRecord = speculativeRecords.find((record) => record !== obsoleteCurrentRecord);
  state.currentIndex = unpreparedIndex;
  state.activeLogicalSrc = unpreparedFetch.url;
  audio.src = unpreparedFetch.url;
  audio.currentSrc = unpreparedFetch.url;
  radio.maybePrefetchNextTrack("track_change");
  assert(obsoleteCurrentRecord.controller.signal.aborted, "The duplicate prefetch for the new current track must be aborted");
  assert(usefulRecord && usefulRecord.controller.signal.aborted, "An unprepared skip must stop every speculative lane");
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 0, "The native request must own all mobile bandwidth for an unprepared track");
  await flushAsyncWork();
}

async function testPrefetchReorderPreemptsWeakestLaneForNewNPlusOne() {
  const pendingFetches = [];
  const sandbox = createSandbox({
    fetch(request) {
      return new Promise((resolve, reject) => {
        const pending = {
          url: request && request.url ? request.url : String(request || ""),
          resolve,
          reject,
          aborted: false
        };
        pendingFetches.push(pending);
        const signal = request && request.signal;
        if (signal && typeof signal.addEventListener === "function") {
          signal.addEventListener("abort", function () {
            pending.aborted = true;
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        }
      });
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(8);
  let previewOrder = [1, 2, 3, 4, 5];
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 10;
  audio.duration = 180;
  audio.buffered = { length: 1, start: () => 0, end: () => 30 };
  const state = {
    audio,
    playlist,
    currentIndex: 0,
    activeLogicalSrc: playlist[0].src,
    homeMode: "album",
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    activeAudioRecovery: null,
    nextPrefetchGeneration: 0
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    prefetchApi: {
      isSupported: () => true,
      createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-2097151" } }),
      getContentLength: (response) => Number(response.headers.get("Content-Length") || 0),
      putSingle: () => Promise.resolve(true),
      pruneCache: () => Promise.resolve(true)
    },
    getCurrentLogicalAudioSrc: () => state.activeLogicalSrc,
    getCurrentPlayableAudioSrc: () => state.activeLogicalSrc,
    normalizeAudioSourceUrl: (src) => String(src || ""),
    srcMatches: (left, right) => String(left || "") === String(right || ""),
    isCloudflareAudioUrl: () => true,
    getCurrentPlaylistIndexSafe: () => state.currentIndex,
    getQueuePreviewIndices: (limit) => previewOrder.slice(0, limit),
    buildAudioMonitorPayload: () => ({}),
    trackAudioRuntimeEvent() {}
  });

  radio.maybePrefetchNextTrack("initial_order");
  pendingFetches[0].resolve(validSegmentResponse());
  await flushAsyncWork();
  assert.deepStrictEqual(
    Array.from(state.nextPrefetchInFlightSrcs).sort(),
    [playlist[2].src, playlist[3].src].sort(),
    "The original lower-priority lanes must be active before the reorder"
  );

  previewOrder = [4, 2, 3, 5, 6];
  radio.maybePrefetchNextTrack("shuffle_reordered");
  await flushAsyncWork();
  assert.strictEqual(
    pendingFetches.find((entry) => entry.url === playlist[3].src).aborted,
    true,
    "The weakest still-useful old lane must be preempted"
  );
  assert.deepStrictEqual(
    Array.from(state.nextPrefetchInFlightSrcs).sort(),
    [playlist[2].src, playlist[4].src].sort(),
    "The new N+1 must start immediately beside the strongest preserved lane"
  );
  assert.strictEqual(state.nextPrefetchInFlightSrcs.size, 2, "Priority preemption must keep the two-lane bound");
  radio.clearNextTrackPrefetch("reorder_test_complete");
  await flushAsyncWork();
}

function testServedMarkerCannotAuthorizeFutureGenerationReadiness() {
  const harness = createPrefetchRehydrationHarness(function () {
    return Promise.resolve({ found: false, valid: false });
  });
  harness.state.nextPrefetchServedSrc = harness.playlist[1].src;
  assert.strictEqual(
    harness.radio.getAutoPrefetchedNextIndex(),
    -1,
    "A stale Service Worker hit must not make a future N+1 look prepared"
  );
  assert.strictEqual(
    harness.state.nextPrefetchServedSrc,
    "",
    "A new prefetch generation must invalidate the consumed served marker"
  );
}

async function testCacheTimeoutInspectsSerializedPutBeforeNetworkRetry() {
  const fetchUrls = [];
  const inspections = [];
  let cacheReady = false;
  let firstPut = true;
  let releaseMutationIdle = null;
  const mutationIdle = new Promise((resolve) => { releaseMutationIdle = resolve; });
  const sandbox = createSandbox({
    fetch(request) {
      fetchUrls.push(request && request.url ? request.url : String(request || ""));
      return Promise.resolve(validSegmentResponse());
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
  audio.buffered = { length: 1, start: () => 0, end: () => 30 };
  const state = {
    audio,
    playlist,
    currentIndex: 0,
    activeLogicalSrc: playlist[0].src,
    homeMode: "album",
    playlistKind: "album",
    playlistToken: playlist.map((track) => track.src).join("|"),
    activeAudioRecovery: null,
    nextPrefetchGeneration: 0
  };
  const radio = sandbox.InfraAudioRadio.createAudioRadio({
    audioState: state,
    runtime: { baseUrl: new URL("https://site.test/") },
    PREFETCH_NEXT_ENABLED: true,
    PREFETCH_MAX_ATTEMPTS: 2,
    PREFETCH_RETRY_BASE_MS: 20,
    PREFETCH_RETRY_MAX_MS: 20,
    prefetchApi: {
      isSupported: () => true,
      createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-2097151" } }),
      getContentLength: (response) => Number(response.headers.get("Content-Length") || 0),
      inspectCachedSegment(src) {
        inspections.push(src);
        return Promise.resolve({
          src,
          found: cacheReady,
          valid: cacheReady,
          probeReady: cacheReady,
          bytes: cacheReady ? 1024 : 0
        });
      },
      waitForMutationIdle() {
        return mutationIdle;
      },
      putSingle(src) {
        if (src === playlist[1].src && firstPut) {
          firstPut = false;
          setTimeout(function () {
            cacheReady = true;
            releaseMutationIdle(true);
          }, 45);
          return Promise.reject(new Error("prefetch_cache_timeout"));
        }
        return Promise.resolve(true);
      },
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

  radio.maybePrefetchNextTrack("cache_timeout_test");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.strictEqual(
    inspections.filter((src) => src === playlist[1].src).length,
    1,
    "The cache-timeout retry must wait for the still-running serialized mutation"
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushAsyncWork();
  assert.strictEqual(
    fetchUrls.filter((src) => src === playlist[1].src).length,
    1,
    "A timed-out CacheStorage caller must not duplicate the still-serialized network segment"
  );
  assert(
    inspections.filter((src) => src === playlist[1].src).length >= 2,
    "The retry path must inspect N+1 again after the cache mutation backoff"
  );
  assert(state.nextPrefetchReadySrcs.has(playlist[1].src), "The completed serialized put must rehydrate N+1 readiness");
}

async function testPrefetchNPlusOneRetriesAfterTwoTransientFailures() {
  const fetchUrls = [];
  let bufferedEnd = 30;
  let nPlusOneUrl = "";
  const sandbox = createSandbox({
    fetch(request) {
      const url = request && request.url ? request.url : String(request || "");
      fetchUrls.push(url);
      return new Promise((_resolve, reject) => {
        const signal = request && request.signal;
        if (!signal || typeof signal.addEventListener !== "function") return;
        signal.addEventListener("abort", function () {
          if (url === nPlusOneUrl && fetchUrls.filter((entry) => entry === nPlusOneUrl).length === 2) {
            bufferedEnd = 10;
          }
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
  });
  loadScript(sandbox, RADIO_PATH);

  const playlist = makeTracks(7);
  nPlusOneUrl = playlist[1].src;
  const audio = makeAudio();
  audio.paused = false;
  audio.src = playlist[0].src;
  audio.currentSrc = playlist[0].src;
  audio.currentTime = 10;
  audio.duration = 180;
  audio.buffered = { length: 1, start: () => 0, end: () => bufferedEnd };
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
    PREFETCH_RETRY_BASE_MS: 5,
    PREFETCH_RETRY_MAX_MS: 10,
    prefetchApi: {
      isSupported: () => true,
      createRequest: (src) => new Request(src, { headers: { Range: "bytes=0-2097151" } }),
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
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(
    fetchUrls.filter((url) => url === playlist[1].src).length,
    2,
    "The bounded third N+1 attempt must wait while the current buffer is unstable"
  );
  bufferedEnd = 30;
  radio.maybePrefetchNextTrack("buffer_recovered");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await flushAsyncWork();
  assert.strictEqual(
    fetchUrls.filter((url) => url === playlist[1].src).length,
    3,
    "N+1 must receive one bounded recovery attempt after two transient timeouts"
  );
  assert.strictEqual(state.nextPrefetchAttemptCounts.get(playlist[1].src), 3);
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
    "The v9 prefetch API must not expose a global clear operation"
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
  assert(miniSyncBody.includes("audioState.sourceMetadataPending"));
  const nowPlayingProgressBody = extractFunctionBody(nowPlayingSource, "syncNowPlayingOverlayProgress");
  assert(nowPlayingProgressBody.includes("audioState.sourceMetadataPending"));
  assert(nowPlayingProgressBody.includes("formatPlaybackTime"));

  const coreSource = fs.readFileSync(CORE_PATH, "utf8");
  const coreStartBody = extractFunctionBody(coreSource, "startTrack");
  assert(coreStartBody.includes("bindMediaSessionActions({ force: true, quiet: true })"));
  const playResolvedBody = extractFunctionBody(coreSource, "handlePlayResolved");
  assert(!playResolvedBody.includes("clearTrackFailure("));
  const ensureCurrentIndexBody = extractFunctionBody(coreSource, "ensureCurrentIndexFromAudio");
  assert(!ensureCurrentIndexBody.includes("extractFilenameFromSrc"));
  const queuePreviewBody = extractFunctionBody(coreSource, "getQueuePreviewIndices");
  const resolveIndexBody = extractFunctionBody(coreSource, "resolveIndex");
  assert(queuePreviewBody.includes("extendAlbumPlaylistToNextAlbum"));
  assert(resolveIndexBody.includes("extendAlbumPlaylistToNextAlbum"));

  assert(albumUiSource.includes("immediatePlay: true"));
  assert(albumUiSource.includes("userGesture: true"));
  assert(!albumUiSource.includes("resetAudioElementForSource(audio, track.src)"));

  assert(transportSource.includes('root.dataset.controlsBound === "1"'));
  assert(transportSource.includes('root.dataset.controlsBound = "1"'));

  const scriptsSource = fs.readFileSync(path.join(ROOT, "public/assets/js/scripts.js"), "utf8");
  const srcMatchesBody = extractFunctionBody(scriptsSource, "srcMatches");
  assert(srcMatchesBody.includes("getAudioAssetPathKey"));
  assert(!srcMatchesBody.includes("endsWith("));
  assert(!srcMatchesBody.includes("extractFilenameFromSrc"));
  const coverNormalizeBody = extractFunctionBody(scriptsSource, "normalizeCoverElementsForBase");
  assert(coverNormalizeBody.includes('getAttribute("onerror")'));
  assert(coverNormalizeBody.includes("normalizeUrlAgainstBase(fallbackMatch[2], baseUrl)"));
  const nextAlbumBody = extractFunctionBody(scriptsSource, "findNextAlbumForContinuity");
  const previousAlbumBody = extractFunctionBody(scriptsSource, "findPreviousAlbumForContinuity");
  assert(!nextAlbumBody.includes("% catalogAlbums.length"));
  assert(!nextAlbumBody.includes("% tracksAlbums.length"));
  assert(!previousAlbumBody.includes("% catalogAlbums.length"));
  assert(!previousAlbumBody.includes("% tracksAlbums.length"));
  const stallRecoveryBody = extractFunctionBody(scriptsSource, "recoverPlaybackFromStall");
  assert(
    stallRecoveryBody.indexOf('audio.addEventListener("canplay", resume') < stallRecoveryBody.indexOf("audio.load()"),
    "Stall recovery must bind its guarded listener before reloading the source"
  );
  const failureRecoveryBody = extractFunctionBody(scriptsSource, "failAudioRecovery");
  assert(failureRecoveryBody.includes("clearWaitingRecovery()"));
  const continuityRetryBody = extractFunctionBody(scriptsSource, "scheduleAlbumContinuityNavigationRetry");
  assert(continuityRetryBody.includes("startRequestToken"));
  assert(continuityRetryBody.includes("modeTransitionToken"));
  assert(continuityRetryBody.includes("activeRequest.commands.length < 8"));
  assert(continuityRetryBody.includes("request.commands.splice"));
  assert(continuityRetryBody.includes("playNext(command.options)"));
  const coverSessionWarmupBody = extractFunctionBody(scriptsSource, "prepareAlbumCoversForSession");
  const coverFallbackWarmupBody = extractFunctionBody(scriptsSource, "warmAlbumCoverCache");
  const coverScheduleBody = extractFunctionBody(scriptsSource, "scheduleAlbumCoverCacheWarmup");
  assert(
    !coverSessionWarmupBody.includes("scheduleAlbumCoverCacheWarmup") &&
      !coverFallbackWarmupBody.includes("scheduleAlbumCoverCacheWarmup") &&
      !coverScheduleBody.includes("scheduleAlbumCoverCacheWarmup("),
    "A paused cover warmup must record pending work instead of recursively scheduling idle callbacks"
  );
  assert(coverSessionWarmupBody.includes("albumCoverWarmupResumePending = true"));
  assert(coverFallbackWarmupBody.includes("albumCoverWarmupResumePending = true"));
  assert(coverScheduleBody.includes("albumCoverWarmupResumePending = false"));

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
  testSameOriginRootArtworkRepair();
  testPreparedColdPlayIsSynchronous();
  testInMemoryColdPlayIsSynchronous();
  testRadioIdlePlayUsesSynchronousPreparedQueueAndDedupesPendingPlay();
  await testQueuedRadioNavigationReplaysInOrderAndInvalidatesOnModeChange();
  await testCachedPrefixIsMaterializedBeforeColdTap();
  testAuthoritativeRollingWindow();
  testAlbumContinuesChronologicallyPastItsLastTrack();
  await testTransportMediaSessionActionsAreReassertedPerTrack();
  testSameSourceRetryKeepsMetadataPending();
  testRestoredNonRadioQueueIsScopedToCurrentAlbum();
  testLargeRadioQueuePersistenceRetainsActiveTrack();
  testShuffleScopesTheCurrentAlbumWhenRadioIsOff();
  testShuffleFromRadioSwitchesToCurrentAlbumWithoutRestart();
  testPendingSourceShowsZeroTimeInMiniAndOverlay();
  await testIntegratedFivePreparedTransportSkips();
  testMaterializedShuffleOrder();
  await testPrefetchCacheRehydrationAndCorruptFallback();
  await testPrefetchCacheRehydrationRejectsStaleSnapshots();
  await testPrefetchCacheRehydrationSkipsSourceThatBecameCurrent();
  await testPrefetchGatePriorityAndConcurrency();
  await testPrefetchReorderPreemptsWeakestLaneForNewNPlusOne();
  testServedMarkerCannotAuthorizeFutureGenerationReadiness();
  await testCacheTimeoutInspectsSerializedPutBeforeNetworkRetry();
  await testPrefetchNPlusOneRetriesAfterTwoTransientFailures();
  testNoGlobalPrefetchClear();
  testPersistentAlbumAndFullscreenContracts();
  console.log("audiofix353 runtime checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
