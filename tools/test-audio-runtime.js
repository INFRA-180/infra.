#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  AbortController,
  Promise,
  Map,
  Set,
  Date,
  Math,
  console,
  performance: { now: () => 0 },
  location: { href: "https://example.test/", origin: "https://example.test" },
  navigator: { userAgent: "", platform: "", maxTouchPoints: 0 },
  document: { body: { classList: { contains: () => true } } },
  matchMedia: () => ({ matches: false }),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(relative) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  vm.runInContext(source, sandbox, { filename: relative });
}

function createAudio() {
  const listeners = new Map();
  let source = "";
  return {
    paused: true,
    volume: 1,
    currentTime: 0,
    duration: NaN,
    readyState: 0,
    networkState: 0,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    get src() { return source; },
    set src(value) { source = String(value || ""); this.currentSrc = source; },
    currentSrc: "",
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); },
    pause() { this.pauseCalls += 1; this.paused = true; },
    load() { this.loadCalls += 1; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    dispatch(type) { const handler = listeners.get(type); if (handler) handler({ type }); }
  };
}

load("public/assets/js/audio-prefetch.js");
const warmupRequest = sandbox.InfraAudioPrefetch.createRequest("https://media.test/warm.m4a", {
  warmupBytes: 512 * 1024
});
assert.strictEqual(warmupRequest.headers.get("Range"), "bytes=0-524287", "audio warmup must request only the startup segment");

load("public/assets/js/audio-core.js");
load("public/assets/js/audio-radio.js");
load("public/assets/js/media-session.js");
load("public/assets/js/now-playing.js");

const audio = createAudio();
const audioState = {
  audio,
  playlist: [
    { src: "https://media.test/a.m4a", name: "A" },
    { src: "https://media.test/b.m4a", name: "B" }
  ],
  currentIndex: 0,
  homeMode: "radio",
  radioQueue: [],
  recentPlayed: [],
  recentPlayedLimit: 12,
  startRequestToken: 0,
  activeLogicalSrc: "",
  trackFailureCounts: new Map()
};
let prefetchCancels = 0;
const core = sandbox.InfraAudioCore.createAudioCore({
  audioState,
  PREFETCH_NEXT_ENABLED: true,
  normalizeAudioSourceUrl: (value) => String(value || ""),
  getCurrentLogicalAudioSrc: () => audioState.activeLogicalSrc,
  getCurrentPlayableAudioSrc: (item) => item.currentSrc || item.src || "",
  srcMatches: (left, right) => String(left || "") === String(right || ""),
  getAutoPrefetchedNextIndex: () => -1,
  clearNextTrackPrefetch: () => { prefetchCancels += 1; },
  getAudioTelemetryNow: () => 0,
  getAudioAssetPath: (value) => String(value || ""),
  getTrackByIndex: (index) => audioState.playlist[index] || null
});

core.startTrack(1, { fromTransportControl: true, seamless: true });
assert.strictEqual(audio.playCalls, 0, "unprepared transport next must wait for media readiness");
assert.strictEqual(prefetchCancels, 1, "an incomplete N+1 must be cancelled");
assert.strictEqual(audioState.activeMediaRequest.index, 1, "the active media request must follow the target track");
audio.readyState = 2;
audio.dispatch("canplay");

const preparedAudio = createAudio();
const preparedState = {
  audio: preparedAudio,
  playlist: [
    { src: "https://media.test/a.m4a", name: "A" },
    { src: "https://media.test/b.m4a", name: "B" }
  ],
  currentIndex: 0,
  homeMode: "album",
  recentPlayed: [],
  recentPlayedLimit: 12,
  startRequestToken: 0,
  activeLogicalSrc: "https://media.test/a.m4a",
  trackFailureCounts: new Map()
};
const preparedCore = sandbox.InfraAudioCore.createAudioCore({
  audioState: preparedState,
  PREFETCH_NEXT_ENABLED: true,
  normalizeAudioSourceUrl: (value) => String(value || ""),
  getCurrentLogicalAudioSrc: () => preparedState.activeLogicalSrc,
  getCurrentPlayableAudioSrc: (item) => item.currentSrc || item.src || "",
  srcMatches: (left, right) => String(left || "") === String(right || ""),
  getAutoPrefetchedNextIndex: () => 1,
  getAudioTelemetryNow: () => 0,
  getAudioAssetPath: (value) => String(value || ""),
  getTrackByIndex: (index) => preparedState.playlist[index] || null
});
preparedCore.startTrack(1, { fromTransportControl: true, seamless: true });
assert.strictEqual(preparedAudio.playCalls, 1, "prepared transport next may use the synchronous fast path");
assert.strictEqual(preparedAudio.pauseCalls, 0, "prepared transport next must not pause the old source");

const coldAudio = createAudio();
let radioStarts = 0;
let randomStarts = 0;
const radioState = { audio: coldAudio, homeMode: "radio", globalRandomStartInFlight: false };
const radio = sandbox.InfraAudioRadio.createAudioRadio({
  audioState: radioState,
  ensureGlobalAudio: () => coldAudio,
  getCurrentPlayableAudioSrc: () => "",
  startRadioPlaybackFromIdle: () => { radioStarts += 1; },
  startGlobalRandomPlayback: () => { randomStarts += 1; }
});
radio.handleGlobalTransportToggle();
assert.strictEqual(radioStarts, 1, "cold transport play must start the radio queue");
assert.strictEqual(randomStarts, 0, "cold transport play must not leave radio mode");

const warmAudio = createAudio();
warmAudio.paused = false;
warmAudio.duration = 240;
warmAudio.currentTime = 1;
warmAudio.src = "https://media.test/current.m4a";
const prefetchRadio = sandbox.InfraAudioRadio.createAudioRadio({
  audioState: { audio: warmAudio },
  PREFETCH_NEXT_ENABLED: true,
  getCurrentPlayableAudioSrc: (item) => item.currentSrc || item.src || ""
});
assert.strictEqual(prefetchRadio.shouldPrefetchNextTrackNow("playing"), true, "N+1 warmup must start as soon as playback is real");

let queuedTimers = [];
sandbox.setTimeout = (handler) => { queuedTimers.push(handler); return queuedTimers.length; };
sandbox.clearTimeout = () => {};
const recoveryAudio = createAudio();
recoveryAudio.paused = false;
recoveryAudio.currentTime = 1;
recoveryAudio.src = "https://media.test/c.m4a";
const recoveryState = {
  audio: recoveryAudio,
  startRequestToken: 5,
  currentIndex: 2,
  activeLogicalSrc: recoveryAudio.src,
  trackStartInFlight: false,
  waitingRecoveryTimer: null
};
const mediaRuntime = sandbox.InfraMediaSession.createMediaSessionRuntime({
  audioState: recoveryState,
  srcMatches: (left, right) => String(left || "") === String(right || ""),
  getCurrentLogicalAudioSrc: () => recoveryState.activeLogicalSrc
});

mediaRuntime.scheduleWaitingRecovery({ requestToken: 5, index: 2, src: recoveryAudio.src, currentTime: 0, hadProgress: false });
assert.strictEqual(queuedTimers.length, 0, "cold startup waiting must not schedule audio.load()");

mediaRuntime.scheduleWaitingRecovery({ requestToken: 4, index: 2, src: recoveryAudio.src, currentTime: 1, hadProgress: true });
queuedTimers.shift()();
assert.strictEqual(recoveryAudio.loadCalls, 0, "a stale recovery must not reload the current source");

queuedTimers = [];
mediaRuntime.scheduleWaitingRecovery({ requestToken: 5, index: 2, src: recoveryAudio.src, currentTime: 1, hadProgress: true });
queuedTimers.shift()();
assert.strictEqual(recoveryAudio.loadCalls, 1, "a confirmed same-track mid-play stall may recover once");

const radioDurationState = { radioPlaylist: [], radioLoadingPromise: null };
const radioDurations = sandbox.InfraAudioRadio.createAudioRadio({
  audioState: radioDurationState,
  runtime: { baseUrl: { href: "https://example.test/" } },
  loadTracksData: () => Promise.resolve({
    albums: [{
      title: "Album",
      page: "music/album.html",
      cover: "cover.webp",
      tracks: [{ src: "assets/music/streams/a/01.m4a", title: "One", duration: "3:21", seconds: 201 }]
    }]
  }),
  toRuntimeAbsoluteUrl: (value) => `https://example.test/${value}`,
  resolveManagedAudioSrc: (value) => `https://media.test/${value}`,
  normalizeAlbumTitle: (value) => String(value || "").toUpperCase(),
  normalizeTrackTitle: (value) => String(value || "").toUpperCase(),
  formatTrackDuration: (seconds) => {
    const total = Math.round(Number(seconds) || 0);
    return total ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}` : "";
  }
});
radioDurations.ensureRadioPlaylistLoaded().then((radioList) => {
  assert.strictEqual(radioList[0].duration, "3:21", "radio tracks must keep catalog duration");
  assert.strictEqual(radioList[0].seconds, 201, "radio tracks must keep catalog seconds");

  const overlayCurrent = { textContent: "" };
  const overlayDuration = { textContent: "" };
  const overlayFill = { style: { width: "" } };
  const overlayProgress = { disabled: false };
  const nowPlayingState = {
    audio: { duration: NaN, currentTime: 0, src: "https://media.test/a.m4a", currentSrc: "https://media.test/a.m4a" },
    transport: {
      overlay: {},
      overlayCurrent,
      overlayDuration,
      overlayFill,
      overlayProgress
    },
    nowPlayingSeeking: false
  };
  const nowPlaying = sandbox.InfraNowPlaying.createNowPlaying({
    audioState: nowPlayingState,
    getCurrentPlayableAudioSrc: (item) => item && (item.currentSrc || item.src) || "",
    getCurrentPlaylistTrack: () => ({ src: "https://media.test/a.m4a", duration: "3:21", seconds: 201 }),
    formatTrackDuration: (seconds) => {
      const total = Math.round(Number(seconds) || 0);
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    }
  });
  nowPlaying.syncNowPlayingOverlayProgress();
  assert.strictEqual(overlayCurrent.textContent, "0:00", "catalog fallback keeps current time at zero before metadata");
  assert.strictEqual(overlayDuration.textContent, "-3:21", "fullscreen player must show catalog duration before audio metadata");
  assert.strictEqual(overlayProgress.disabled, true, "catalog duration must not enable seeking before media metadata");

  console.log(JSON.stringify({ ok: true, checks: 17 }, null, 2));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
