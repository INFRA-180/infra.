#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sandbox = {
  URL,
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
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); }
  };
}

load("public/assets/js/audio-core.js");
load("public/assets/js/audio-radio.js");
load("public/assets/js/media-session.js");

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
assert.strictEqual(audio.playCalls, 1, "transport next must call play synchronously");
assert.strictEqual(audio.pauseCalls, 0, "transport next must not pause the old source");
assert.strictEqual(prefetchCancels, 1, "an incomplete N+1 must be cancelled");
assert.strictEqual(audioState.activeMediaRequest.index, 1, "the active media request must follow the target track");

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

console.log(JSON.stringify({ ok: true, checks: 9 }, null, 2));
