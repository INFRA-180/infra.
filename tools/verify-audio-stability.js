#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`Audio stability check failed: ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const release = "audiofix332-20260716";
const shellRelease = "infra-shell-20260716-audio332";
const coverCssRelease = "audiofix332-20260716";
const frozenCssSha256 = "2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb";
const scripts = read("public/assets/js/scripts.js");
const radio = read("public/assets/js/audio-radio.js");
const core = read("public/assets/js/audio-core.js");
const prefetch = read("public/assets/js/audio-prefetch.js");
const catalogLoader = read("public/assets/js/catalog-loader.js");
const albumUi = read("public/assets/js/album-player-ui.js");
const nowPlaying = read("public/assets/js/now-playing.js");
const telemetry = read("public/assets/js/audio-telemetry.js");
const sphragis = read("public/assets/js/sphragis.js");
const sw = read("public/sw.js");
const styles = read("public/assets/css/styles.css");

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) {
    fail(`unable to isolate ${name}()`);
    return "";
  }
  return source.slice(start, end);
}

expect(scripts.includes(`window.INFRA_BUILD_TAG = "${release}"`), "runtime build tag is not audiofix332");
expect(scripts.includes(`const runtimeVersion = "${release}"`), "runtime query version is not audiofix332");
expect(sw.includes(`const VERSION = "${shellRelease}"`), "Service Worker cache version is not audio332");
expect(sw.includes('const NEXT_TRACK_CACHE = "infra-next-track-segments-v7"'), "Service Worker does not use segment cache v7");

const coldPreparation = functionBody(radio, "prepareInitialGlobalRandomPlayback", "scheduleInitialGlobalRandomPreparation");
expect(coldPreparation.includes("buildRadioQueue"), "cold startup does not materialize the Radio queue");
expect(coldPreparation.includes("audio_fetch: false"), "cold metadata preparation is not explicitly audio-free");
expect(!/\bfetch\s*\(/.test(coldPreparation), "cold metadata preparation must not download audio");
expect(!coldPreparation.includes("startNextTrackPrefetch"), "cold metadata preparation must not prefetch a media segment");
expect(coldPreparation.includes("promoteCachedPreparedInitialTrack"), "cold Radio preparation does not reuse an existing v7 segment");
expect(prefetch.includes("findFirstValidCachedSegment"), "v7 cache does not expose ordered cached-source lookup");

const coldActivation = functionBody(radio, "activatePreparedInitialRadioPlayback", "startGlobalRandomPlayback");
for (const invariant of [
  'audioState.homeMode = "radio"',
  'audioState.playlistKind = "radio"',
  "audioState.radioQueueCursor = 0",
  "immediatePlay: true",
  "userGesture: true"
]) {
  expect(coldActivation.includes(invariant), `cold Radio activation is missing ${invariant}`);
}
const coldStart = functionBody(radio, "startGlobalRandomPlayback", "resetPreparedInitialGlobalRandomPlayback");
expect(coldStart.includes("activatePreparedInitialRadioPlayback()"), "cold Play does not consume the prepared Radio queue synchronously");
expect(!coldStart.includes(".then("), "cold Play must not wait on a Promise before startTrack");
expect(!coldStart.includes("setTimeout"), "cold Play must not wait on a timer before startTrack");

const startTrack = functionBody(core, "startTrack", "getRandomIndex");
expect(startTrack.includes("opts.immediatePlay && opts.userGesture"), "startTrack lacks the guarded immediate user-gesture path");
expect(startTrack.includes("attemptPlay({ sync: true, immediate: isImmediateUserGesture })"), "immediate Play does not call audio.play() directly");
const beginPlaybackStart = startTrack.indexOf("function beginPlayback");
const beginPlaybackEnd = startTrack.indexOf("if (sameTrack)", beginPlaybackStart);
const beginPlayback = startTrack.slice(beginPlaybackStart, beginPlaybackEnd);
expect(beginPlayback.indexOf("attemptPlay({ sync: true, immediate: isImmediateUserGesture })") < beginPlayback.indexOf("waitForAudioReadiness(audio"), "immediate Play is ordered after the readiness wait");

const playHandlerStart = radio.indexOf('audio.addEventListener("play"');
const playingHandlerStart = radio.indexOf('audio.addEventListener("playing"');
expect(playHandlerStart >= 0 && playingHandlerStart > playHandlerStart, "play/playing event handlers are missing");
expect(!radio.slice(playHandlerStart, playingHandlerStart).includes("trackStartInFlight = false"), "play must not confirm a pending start");
expect(radio.slice(playingHandlerStart, playingHandlerStart + 1400).includes("trackStartInFlight = false"), "playing must confirm the pending start");

for (const invariant of [
  "PREFETCH_NEXT_QUEUE_DEPTH",
  "PREFETCH_NEXT_CONCURRENCY",
  "PREFETCH_BUFFER_STABLE_SECONDS",
  "PREFETCH_MAX_ATTEMPTS",
  "reconcileNextTrackPrefetchPlan",
  "prefetch_window_ready"
]) {
  expect(radio.includes(invariant) || scripts.includes(invariant), `rolling prefetch is missing ${invariant}`);
}
expect(prefetch.includes('CACHE_NAME: "infra-next-track-segments-v7"'), "prefetch cache is not v7");
expect(prefetch.includes('headers.set("X-Infra-Body-Validated", "1")'), "v7 writes lack an integrity-at-write marker");
expect(prefetch.includes("PREFETCH_SEGMENT_SIZE: 4 * 1024 * 1024"), "prefetch segment is not 4 MiB");
expect(prefetch.includes("QUEUE_DEPTH: 5"), "prefetch depth is not five");
expect(prefetch.includes("CONCURRENCY: 2"), "prefetch concurrency is not two");
expect(prefetch.includes("MAX_ENTRIES: 6"), "prefetch cache is not capped at six entries");
expect(!radio.includes("clearCache("), "normal playback still performs a global prefetch-cache clear");
expect(!prefetch.includes("function clearCache"), "segment cache still exposes destructive global clearing");

const playNext = functionBody(core, "playNext", "playPrevious");
expect(playNext.includes("getQueuePreviewIndices(1)"), "Next does not consume the authoritative lookahead order");
expect(core.includes("const planDepth = Math.max(requested, 5)"), "authoritative lookahead is not materialized to five tracks");
expect(core.includes('mode: "shuffle"'), "Shuffle lookahead is not materialized");

expect(!albumUi.includes('className = "track-controls"'), "album top transport controls are still injected");
expect(!albumUi.includes("data-track-prev"), "album Previous control is still present");
expect(!albumUi.includes("data-track-next"), "album Next control is still present");
expect(!radio.includes("cleanupForeignAlbumAudioWhenIdle"), "foreign-album cleanup can still destroy the active player");
expect(!radio.includes("cleanupIdleAudioContext"), "route lifecycle can still clear a paused player session");
expect(nowPlaying.includes("animation.oncancel = finalize"), "fullscreen cancellation does not finalize mini-player restoration");

expect(sw.includes("buildRangeResponseFromCachedAudio"), "Service Worker Range reconstruction is missing");
expect(sw.includes("responseEnd = Math.min(range.end, metadata.cachedEnd)"), "open-ended Range is not bounded to the cached segment");
expect(sw.includes("new Response(cached.body"), "full cached segments still require an arrayBuffer copy");
expect(sw.includes("metadata.bodyValidated"), "zero-copy 206 is not restricted to bodies validated at write time");
expect(sw.includes("cachedValidatorMatchesIfRange"), "If-Range compatibility guard is missing");
expect(sw.includes("isAudioPrefetchCache(key) && key !== NEXT_TRACK_CACHE"), "old audio caches are not migrated on activation");
expect(sw.includes("event.clientId"), "prefetch-hit telemetry is not scoped to the requesting client");
expect(sw.includes('request.mode === "cors" && isSingleRange'), "Service Worker can still intercept a no-cors media request");
expect(sw.includes('headers.set("Access-Control-Allow-Origin", self.location.origin)'), "cached 206 does not use the active PWA origin");
expect(sw.includes('headers.set("Vary", "Origin")'), "cached 206 lacks Vary: Origin");
expect(prefetch.includes('mode: "cors"'), "prefetch request is not explicitly CORS");
expect(!radio.includes('removeAttribute("crossorigin")'), "global audio still removes crossorigin");
expect(!albumUi.includes('removeAttribute("crossorigin")'), "album audio still removes crossorigin");
expect(radio.includes('audio.crossOrigin = "anonymous"'), "global audio is not configured for anonymous CORS");
expect(core.includes('audio.crossOrigin = "anonymous"'), "source assignment does not reaffirm anonymous CORS");
expect(telemetry.includes("const QUEUE_CAP = 100"), "telemetry queue is not capped at 100 events");
expect(telemetry.includes("const QUEUE_TTL_MS = 24 * 60 * 60 * 1000"), "telemetry queue lacks the 24-hour TTL");
expect(!telemetry.includes("navigator.userAgent"), "full user-agent is still transmitted");
expect(!telemetry.includes("local_time:"), "local time is still transmitted");
expect(!telemetry.includes("session_id:"), "global session identifier is still transmitted");
expect(scripts.includes('window.location.origin === "https://infra-180.github.io"'), "telemetry is not restricted to the official origin client-side");
expect(scripts.includes('https://infra180-api.pages.dev'), "runtime does not use the neutral API hostname");
expect(sphragis.includes('https://infra180-api.pages.dev'), "Sphragis does not use the neutral API hostname");
expect(!scripts.includes('workers.dev'), "a Workers account hostname remains in the runtime");
expect(!sphragis.includes('workers.dev'), "a Workers account hostname remains in Sphragis");
expect(!telemetry.includes('"cover_prepare_item"'), "cover loading still floods remote audio telemetry");
expect(sw.includes("htmlCacheFirst(request, SHELL_CACHE"), "PWA navigation is not shell cache-first");
expect(catalogLoader.includes("readCachedLiveCatalogLatest()"), "validated live CacheStorage is not consulted at startup");
expect(catalogLoader.includes('catalogState.catalogBundleSource = cachedLive ? "live-cache" : "local"'), "catalogue startup does not preserve cached live releases");
expect(catalogLoader.includes("fetchLiveCatalogLatest().catch(function () {})"), "live catalogue refresh is not detached from startup");

const cssHash = crypto.createHash("sha256").update(styles).digest("hex");
expect(cssHash === frozenCssSha256, "styles.css differs from the frozen geometry plus the isolated cover clip fix");
expect(!styles.includes("100lvh"), "forbidden 100lvh geometry was introduced");
expect(styles.includes("transform: translateZ(0) scale(1.002)"), "WebKit cover seam guard is missing");

const htmlFiles = ["public/index.html"]
  .concat(fs.readdirSync(path.join(root, "public/music"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/music/${name}`))
  .concat(fs.readdirSync(path.join(root, "public/apps"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/apps/${name}`));
expect(htmlFiles.length === 35, `expected 35 player documents, found ${htmlFiles.length}`);
for (const relativePath of htmlFiles) {
  const source = read(relativePath);
  expect(source.includes(release), `${relativePath} does not reference ${release}`);
  expect(source.includes(coverCssRelease), `${relativePath} does not reference ${coverCssRelease}`);
  expect(!source.includes("audiofix326-20260715"), `${relativePath} still references audiofix326 JavaScript`);
}

if (!process.exitCode) console.log("Audio stability checks passed for audiofix332.");
