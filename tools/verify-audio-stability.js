#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`Audio stability check failed: ${message}`);
  process.exitCode = 1;
};

const scripts = read("public/assets/js/scripts.js");
const radio = read("public/assets/js/audio-radio.js");
const core = read("public/assets/js/audio-core.js");
const sw = read("public/sw.js");
const styles = read("public/assets/css/styles.css");
const release = "audiofix322-20260714";

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) {
    fail(`unable to isolate ${name}()`);
    return "";
  }
  return source.slice(start, end);
}

const stallRecovery = functionBody(scripts, "recoverPlaybackFromStall", "scheduleWaitingRecovery");
if (/\.load\s*\(/.test(stallRecovery)) fail("stall recovery must not call audio.load()");
if (/\.play\s*\(/.test(stallRecovery)) fail("stall recovery must stay passive");
if (!stallRecovery.includes('"stall_passive_wait"')) fail("passive stall telemetry is missing");

const waitingRecovery = functionBody(scripts, "scheduleWaitingRecovery", "isIOSStandaloneMediaSession");
if (/\.load\s*\(/.test(waitingRecovery)) fail("waiting recovery must not call audio.load()");
if (!waitingRecovery.includes('"startup_waiting_passive"')) fail("startup waiting telemetry is missing");

if (!scripts.includes("window.location.reload()")) fail("safe Service Worker reload is missing");
if (!scripts.includes("function isServiceWorkerReloadSafe")) fail("safe Service Worker reload guard is missing");
if (!scripts.includes('"sw_reload_executed"')) fail("executed Service Worker reload telemetry is missing");
const deferredReload = functionBody(scripts, "scheduleDeferredServiceWorkerReload", "markServiceWorkerReloadPendingForRuntime");
if (!deferredReload.includes("getDeferredServiceWorkerReloadDelayMs")) {
  fail("safe Service Worker reload must wait for the idle safety window");
}
if (!scripts.includes('"startup_cls"')) fail("startup layout-shift telemetry is missing");
if (/PREFETCH_NEXT_ENABLED[\s\S]{0,180}!isIosDevice\(\)/.test(scripts)) {
  fail("next-track prefetch must remain enabled on iOS");
}
if (!radio.includes('reason === "canplay" || reason === "playing" || reason === "queue_continue"')) {
  fail("Radio must begin filling its prefetch queue as soon as the active track can play");
}
const canplayHandlerStart = radio.indexOf('audio.addEventListener("canplay"');
const canplayHandlerEnd = radio.indexOf('audio.addEventListener("canplaythrough"', canplayHandlerStart);
const canplayHandler = radio.slice(canplayHandlerStart, canplayHandlerEnd);
if (canplayHandlerStart < 0 || canplayHandlerEnd < 0 || !canplayHandler.includes('maybePrefetchNextTrack("canplay")')) {
  fail("canplay must trigger next-track prefetch before playing");
}
if (!radio.includes("peekNextIndicesForPrefetch(depth)")) {
  fail("Radio must prepare more than a single N+1 track");
}
if (!scripts.includes("PREFETCH_NEXT_QUEUE_DEPTH") || !scripts.includes("PREFETCH_NEXT_CONCURRENCY")) {
  fail("multi-track prefetch depth/concurrency is not wired into the runtime");
}
if (!radio.includes("response_ms") || !radio.includes("ready_count")) {
  fail("prefetch network timing telemetry is incomplete");
}
if (!styles.includes("padding: 9px 10px calc(9px + env(safe-area-inset-bottom));")) {
  fail("mobile transport must protect the Home indicator inside the dock");
}
if (/bottom:\s*calc\(-1\s*\*\s*env\(safe-area-inset-bottom\)\)/.test(styles) || /100dvh\s*\+\s*env\(safe-area-inset-bottom\)/.test(styles)) {
  fail("Now Playing must not extend beyond the viewport by the bottom safe area");
}
if (!styles.includes("margin-top: auto;") || !styles.includes("padding-bottom: var(--mobile-player-space, 0px) !important;")) {
  fail("mobile bottom layout must anchor Up Next and count the safe area only once");
}
if (!core.includes("isAutoAdvance || isFromMediaSession || isFromTransportControl")) {
  fail("transport navigation must use the immediate source-switch path");
}
if (!core.includes("hasRelevantTransportPrefetch") || !core.includes("nextPrefetchInFlightSrcs")) {
  fail("transport navigation must preserve a still-relevant in-flight prefetch");
}
if (!radio.includes("function prepareRadioColdStart")) {
  fail("Radio must prepare its first startup segment before the cold Play tap");
}
const coldToggleStart = radio.indexOf("function handleGlobalTransportToggle");
const coldToggleEnd = radio.indexOf("function ensureGlobalAudio", coldToggleStart);
const coldToggle = radio.slice(coldToggleStart, coldToggleEnd);
if (coldToggleStart < 0 || coldToggle.includes('setHomePlayMode("radio"')) {
  fail("cold-start transport must not asynchronously rebuild the prepared Radio queue");
}
const telemetry = read("public/assets/js/audio-telemetry.js");
for (const eventName of ["startup_cls", "startup_waiting_passive", "sw_reload_executed", "sw_runtime_state"]) {
  if (!telemetry.includes(`"${eventName}"`)) fail(`${eventName} is not exported by fine telemetry`);
}

const playHandlerStart = radio.indexOf('audio.addEventListener("play"');
const playingHandlerStart = radio.indexOf('audio.addEventListener("playing"');
const playHandler = radio.slice(playHandlerStart, playingHandlerStart);
if (playHandlerStart < 0 || playingHandlerStart < 0) fail("audio play/playing handlers are missing");
if (playHandler.includes("trackStartInFlight = false")) fail("play must not confirm a pending start");
if (!radio.slice(playingHandlerStart).includes("playbackConfirmedToken = audioState.playRequestToken")) {
  fail("playing must confirm the active request token");
}
if (!radio.includes("function primeRadioPlaylistFromLoadedTracks")) {
  fail("cold-start Radio must support synchronous queue preparation from loaded tracks");
}
if (!core.includes("primeRadioPlaylistFromLoadedTracks();")) {
  fail("cold-start playback does not use synchronous Radio queue preparation");
}

const r2FetchGuard = sw.indexOf("url.hostname === R2_AUDIO_HOST");
if (r2FetchGuard < 0 || !sw.slice(r2FetchGuard, r2FetchGuard + 220).includes("servePrefetchedAudioOrNetwork")) {
  fail("R2 audio requests must consult the startup-segment cache");
}
if (!sw.includes("buildRangeResponseFromCachedAudio")) fail("startup segment Range reconstruction is missing");
if (core.includes("queueIosTransportNavigation")) {
  fail("user transport navigation must never be deferred");
}
const installBlock = sw.slice(sw.indexOf('self.addEventListener("install"'), sw.indexOf('self.addEventListener("activate"'));
if (!installBlock.includes("skipWaiting")) fail("Service Worker updates must activate without remaining stuck in waiting");
if (!installBlock.includes("cache.addAll(CRITICAL_SHELL_ASSETS)")) {
  fail("Service Worker critical shell assets must remain atomic");
}
if (!installBlock.includes("Promise.allSettled") || !installBlock.includes("OPTIONAL_SHELL_ASSETS")) {
  fail("Service Worker optional shell assets must not block installation");
}
if (!scripts.includes('registration.waiting.postMessage({ type: "SKIP_WAITING" })')) {
  fail("an already-waiting Service Worker must be released without reloading playback");
}

const publicFiles = ["public/index.html", "public/sw.js"]
  .concat(fs.readdirSync(path.join(root, "public/music"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/music/${name}`));
for (const relativePath of publicFiles) {
  const source = read(relativePath);
  if (!source.includes(release) && relativePath !== "public/sw.js") {
    fail(`${relativePath} does not reference ${release}`);
  }
  if (/audiofix(?:304|311|312|313|314)-2026071[34]/.test(source)) {
    fail(`${relativePath} still references an obsolete audio runtime`);
  }
}
if (!sw.includes("infra-shell-20260714-audio322")) fail("Service Worker cache version is not audio322");

if (!process.exitCode) console.log("Audio stability checks passed.");
