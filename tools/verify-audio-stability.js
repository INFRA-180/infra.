#!/usr/bin/env node

const { codeHas, codeIndexOf, codeMatch, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const loadScript = require("./lib/load-script.js"); // scripts construits comme app.js (lot B)

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`Audio stability check failed: ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const scripts = require("./build/app-sources.js").runtimeSource();
const radio = loadScript.sourceText("src/js/audio-radio.js");
const core = read("src/js/audio-core.js");
const mediaSession = read("src/js/media-session.js");
const prefetch = read("src/js/audio-prefetch.js");
const catalogLoader = read("src/js/catalog-loader.js");
const albumUi = read("src/js/album-player-ui.js");
const nowPlaying = read("src/js/now-playing.js");
const transport = loadScript.sourceText("src/js/transport-ui.js");
const visualizer = read("src/js/audio-visualizer.js");
const telemetry = read("src/js/audio-telemetry.js");
const covers = read("src/js/covers.js");
const homeCatalog = read("src/js/home-catalog.js");
const spa = read("src/js/spa-renderer.js");
const spaRouter = read("src/js/spa-router.js");
const sphragis = read("public/assets/js/sphragis.js");
const sphragisPage = read("public/sphragis/index.html");
const sw = read("public/sw.js");
const styles = read("public/assets/css/styles.css");
const release = (codeMatch(scripts, /window\.INFRA_BUILD_TAG = "([^"]+)";/) || [])[1] || "";
const shellRelease = (codeMatch(sw, /const VERSION = "([^"]+)";/) || [])[1] || "";
const cssRelease = release;
const catalogAlbumCount = (JSON.parse(read("public/data/tracks.json")).albums || []).length;

function functionBody(source, name, nextName) {
  const start = codeIndexOf(source, `function ${name}`);
  const end = codeIndexOf(source, `function ${nextName}`, start + 1);
  if (start < 0 || end < 0) {
    fail(`unable to isolate ${name}()`);
    return "";
  }
  return source.slice(start, end);
}

expect(codeTest(/^audiofix\d+-\d{8}$/, release), "runtime build tag is invalid");
expect(codeHas(scripts, `const runtimeVersion = "${release}"`), "runtime query version is stale");
expect(codeTest(/^infra-shell-\d{8}-audio\d+$/, shellRelease), "Service Worker cache version is invalid");
expect(codeHas(scripts, `const SPA_SHELL_VERSION = "${shellRelease}"`), "runtime shell version is stale");
expect(codeHas(sw, 'const NEXT_TRACK_CACHE = "infra-next-track-segments-v9"'), "Service Worker does not use segment cache v9");
expect(codeHas(covers, 'CANONICAL_WIDTH: 1200'), "album artwork is not canonicalized to 1200 px");
expect(codeHas(covers, 'CACHE_NAME: "infra-covers-v2"'), "canonical covers do not use the isolated cache v2");
expect(codeHas(covers, "adc-13-6e983f31-cover-1200.webp"), "stale ADC13 artwork is not rewritten to the new canonical cover");
expect(codeHas(catalogLoader, 'normalizeCoverUrl", rawThumb, { width: 1200 }'), "live catalogue can reintroduce a non-canonical album cover");
expect(codeHas(sw, 'const COVERS_CACHE = "infra-covers-v2"'), "Service Worker does not share the canonical cover cache");
expect(codeHas(sw, "cover-1200\\.webp"), "Service Worker does not cache the canonical cover URL");
expect(codeHas(sw, `const MAX_COVER_CACHE_ENTRIES = ${catalogAlbumCount}`), "Service Worker cover cache is not capped to the canonical inventory");
expect(codeHas(sw, "await reconcileCoverCache()"), "Service Worker activation does not purge stale cover entries");
expect(codeHas(scripts, "const ALBUM_COVER_IMAGE_CACHE_LIMIT = 4"), "cover memory cache is not minimal");
expect(codeHas(scripts, "const ALBUM_COVER_PREPARE_LIMIT = 2"), "cover warmup is not bounded");
expect(codeHas(homeCatalog, 'querySelectorAll("img[data-cover-src]")'), "offscreen home covers are not explicitly deferred");
expect(codeHas(homeCatalog, 'rootMargin: "320px 0px"'), "home cover observer has no bounded preload margin");
expect(!codeHas(transport, "nowPlayingMetaIdleTimer"), "desktop metadata idle timer is still present");
expect(!codeHas(transport, "is-meta-idle"), "desktop metadata idle state is still present");
expect(!codeHas(styles, "is-meta-idle"), "desktop metadata idle opacity rule is still present");
expect(codeHas(transport, "data-now-playing-visual-canvas"), "desktop fullscreen has no visual canvas");
expect(codeHas(transport, "ensureDesktopAudioVisualizer"), "desktop fullscreen does not own the visualizer lifecycle");
expect(codeHas(transport, "visualizer.activate()"), "desktop fullscreen click does not unlock live audio analysis");
expect(codeHas(transport, 'trackAudioRuntimeEvent("visualizer_health"'), "desktop visualizer has no compact health telemetry");
expect(codeHas(visualizer, "FRAME_INTERVAL_MS = 1000 / 30"), "desktop visualizer is not capped at 30 fps");
expect(codeHas(visualizer, "ENERGY_ATTACK_SECONDS = 0.045"), "desktop visualizer has no fast rhythmic attack");
expect(codeHas(visualizer, "ENERGY_RELEASE_SECONDS = 0.26"), "desktop visualizer has no controlled energy release");
expect(codeHas(visualizer, "SPECTRUM_ATTACK_SECONDS = 0.035"), "desktop frequency spectrum has no fast per-point attack");
expect(codeHas(visualizer, "SPECTRUM_RELEASE_SECONDS = 0.18"), "desktop frequency spectrum has no controlled per-point release");
expect(codeHas(visualizer, "SPECTRUM_SPATIAL_KERNEL = Object.freeze([1, 4, 6, 4, 1])"), "desktop frequency spectrum has no five-band spatial smoothing");
expect(codeHas(visualizer, "smoothSpectrumSpatially(points)"), "desktop frequency spectrum does not smooth raw logarithmic bands");
expect(codeHas(visualizer, "FFT_SIZE = 2048"), "desktop frequency spectrum has insufficient FFT resolution");
expect(codeHas(visualizer, "MIN_FREQUENCY_HZ = 40"), "desktop frequency spectrum has no low-frequency boundary");
expect(codeHas(visualizer, "MAX_FREQUENCY_HZ = 16000"), "desktop frequency spectrum has no high-frequency boundary");
expect(codeHas(visualizer, "Math.pow(ratioRange"), "desktop visualizer x-axis is not logarithmic in Hz");
expect(codeHas(visualizer, "const centerY = size.height * 0.5"), "desktop frequency spectrum has no fixed central axis");
expect(codeHas(visualizer, "size.height * 0.25"), "desktop frequency spectrum does not use the compact mirrored range");
expect(codeHas(visualizer, "dynamicHeight, -1, false"), "desktop frequency spectrum is not drawn above its axis");
expect(codeHas(visualizer, "dynamicHeight, 1, false"), "desktop frequency spectrum is not drawn below its axis");
expect(codeHas(visualizer, "const PURE_FFT_MODE = true"), "desktop visualizer is not in pure FFT comparison mode");
expect(codeHas(visualizer, "POWDER_EARTH_PARTICLE_COUNT = 250000"), "desktop powder field does not contain 250,000 Earth particles");
expect(codeHas(visualizer, "POWDER_MOON_PARTICLE_COUNT = 250000"), "desktop powder field does not contain 250,000 lunar particles");
expect(codeHas(visualizer, "POWDER_PARTICLE_COUNT = 500000"), "desktop powder field does not contain 500,000 particles");
expect(codeHas(visualizer, "POWDER_HELIX_PARTICLE_COUNT = 60000"), "desktop powder field does not contain its 60,000-grain helix");
expect(
  codeHas(visualizer, "createPowderParticles(PURE_FFT_MODE ? 0 : POWDER_PARTICLE_COUNT)"),
  "pure FFT mode does not suppress particle allocation"
);
expect(codeHas(visualizer, "height: new Float32Array(particleCount)"), "desktop powder does not use compact persistent heights");
expect(codeHas(visualizer, "side: new Uint8Array(particleCount)"), "desktop powder does not retain its upper/lower face");
expect(codeHas(visualizer, "gravityClass: new Uint8Array(particleCount)"), "desktop powder does not retain its gravity class");
expect(codeHas(visualizer, "helixOffset: new Float32Array(particleCount)"), "desktop powder does not retain helix offsets");
expect(codeHas(visualizer, "helixBaseSin: new Float32Array(particleCount)"), "desktop powder does not precompute helix phases");
expect(codeHas(visualizer, "bandIndex: new Uint16Array(particleCount)"), "desktop powder does not preassign FFT bands");
expect(codeHas(visualizer, "powderContext.createImageData(width, height)"), "desktop powder field has no reusable pixel buffer");
expect(codeHas(visualizer, "EARTH_GRAVITY_METERS_PER_SECOND2 = 9.80665"), "desktop powder does not use Earth gravity");
expect(codeHas(visualizer, "MOON_GRAVITY_METERS_PER_SECOND2 = 1.62"), "desktop powder does not use lunar gravity");
expect(codeHas(visualizer, "updatePowderBandMap(values.length)"), "desktop powder does not reuse preassigned local FFT bands");
expect(codeHas(visualizer, "powderContainmentEnvelope[index] = Math.max("), "desktop powder has no FFT containment envelope");
expect(codeHas(visualizer, "velocity -= gravity * step"), "desktop powder has no persistent hybrid-gravity fall");
expect(codeHas(visualizer, "(sides[index] ? 1 : -1)"), "desktop powder is not rendered above and below the axis");
expect(codeHas(visualizer, "powderHelixRotationPhase"), "desktop powder has no rotating helix phase");
expect(codeHas(visualizer, "HELIX_DRIVE_ATTACK_SECONDS = 0.09"), "desktop helix drive has no temporal smoothing");
expect(codeHas(visualizer, "frameHeight * (0.035 + signal * 0.18)"), "desktop helix radius is not reduced");
expect(codeHas(visualizer, "targetOffset - helixOffset"), "desktop powder helix has no physical spring");
expect(codeHas(visualizer, "const restingOpacity = moving ? 1 : 0.34"), "desktop powder does not reduce its static central density");
expect(codeHas(visualizer, "drawingContext.quadraticCurveTo("), "desktop frequency spectrum is still drawn as angular segments");
expect(codeHas(visualizer, "powderContainmentRawEnvelope[index],"), "desktop powder containment is not smoothed without lowering its raw ceiling");
expect(codeHas(visualizer, "impactSpeed * restitutions[index]"), "desktop powder has no damped ground collision");
expect(codeHas(visualizer, "drawingContext.drawImage("), "desktop powder buffer is not composited efficiently");
expect(
  codeHas(visualizer, "if (!PURE_FFT_MODE) {\n        updatePowderPhysics("),
  "pure FFT mode does not suppress particle simulation"
);
expect(codeHas(visualizer, "if (!PURE_FFT_MODE) drawPowder(size, centerY);"), "pure FFT mode does not suppress particle drawing");
expect(!codeHas(visualizer, "drawingContext.clip()"), "desktop ballistic powder is still clipped by the current FFT envelope");
expect(!codeHas(visualizer, "powderPulse"), "desktop powder still uses a global pulse instead of local FFT displacement");
expect(
  !codeHas(visualizer, 'drawingContext.strokeStyle = "rgba(255,255,255,0.13)"'),
  "desktop pure FFT comparison still draws the median line"
);
const coldOpenBody = functionBody(nowPlaying, "openNowPlayingOverlay", "closeNowPlayingOverlay");
expect(
  codeIndexOf(coldOpenBody, "syncTransportUi();") > codeIndexOf(coldOpenBody, "audioState.nowPlayingOpen = true"),
  "cold fullscreen open does not immediately activate the desktop visualizer"
);
expect(codeHas(visualizer, "(prefers-reduced-motion: reduce)"), "desktop visualizer ignores reduced motion");
expect(codeHas(visualizer, "document.hidden"), "desktop visualizer does not stop while hidden");
expect(codeHas(visualizer, "createMediaElementSource(audio)"), "desktop visualizer does not analyze the global media element");
expect(codeHas(visualizer, "source.connect(context.destination)"), "live analyser does not preserve the direct audible route");
expect(codeHas(visualizer, "source.connect(analyser)"), "live analyser is not connected as a side branch");
expect(!codeTest(/analyser\.connect\s*\(\s*context\.destination/, visualizer), "live analyser duplicates the audible route");
expect(!fs.existsSync(path.join(root, "public/data/audio-visuals.json")), "stale precomputed visual data is still public");
expect(codeHas(visualizer, "getHealthSnapshot"), "desktop visualizer does not aggregate health locally");
expect(codeHas(visualizer, 'emitHealth("active_probe")'), "desktop visualizer has no bounded active probe");
expect(codeHas(telemetry, "processVisualizerHealth"), "visualizer health is not compacted into session telemetry");
expect(codeHas(telemetry, 'upsertCompactEvent("visualizer_health"'), "visualizer health appends duplicate session events");
expect(codeHas(styles, ".now-playing-visual.is-active.is-ready"), "desktop visualizer has no ready-state styling");
expect(!codeHas(sw.slice(codeIndexOf(sw, 'self.addEventListener("install"'), codeIndexOf(sw, 'self.addEventListener("activate"')), "skipWaiting"), "Service Worker still activates during a live audio session");
expect(codeHas(sw, "const OPTIONAL_SHELL_ASSETS"), "optional shell resources are not isolated");
expect(codeHas(sw, "Promise.allSettled("), "an optional resource can still invalidate the PWA shell");
expect(codeHas(scripts, "audioState.albumCoverPrimeUrls.delete(url)"), "a transient cover-prime failure remains permanently locked");

const coldPreparation = functionBody(radio, "prepareInitialGlobalRandomPlayback", "scheduleInitialGlobalRandomPreparation");
expect(codeHas(coldPreparation, "buildRadioQueue"), "cold startup does not materialize the Radio queue");
expect(codeHas(coldPreparation, "audio_fetch: false"), "cold metadata preparation is not explicitly audio-free");
expect(!codeTest(/\bfetch\s*\(/, coldPreparation), "cold metadata preparation must not download audio");
expect(!codeHas(coldPreparation, "startNextTrackPrefetch"), "cold metadata preparation must not prefetch a media segment");
expect(codeHas(coldPreparation, "promoteCachedPreparedInitialTrack"), "cold Radio preparation does not reuse an existing v9 segment");
expect(codeHas(prefetch, "findFirstValidCachedSegment"), "v9 cache does not expose ordered cached-source lookup");
expect(codeHas(prefetch, "findValidCachedSegments"), "v9 cache does not expose bounded grouped restoration");
const coldCachePrefix = functionBody(radio, "promoteCachedPreparedInitialTrack", "prepareInitialGlobalRandomPlayback");
expect(codeHas(coldCachePrefix, "cachedTracks.concat(remainingTracks)"), "cold Radio does not materialize a contiguous cached prefix");
expect(codeHas(coldCachePrefix, "restored_count: cachedTracks.length"), "cold Radio cache restoration is not measurable");
expect(!codeTest(/\bfetch\s*\(/, coldCachePrefix), "cold cached-prefix restoration must not download audio");

const coldActivation = functionBody(radio, "activatePreparedInitialRadioPlayback", "startGlobalRandomPlayback");
for (const invariant of [
  'audioState.homeMode = "radio"',
  'audioState.playlistKind = "radio"',
  "audioState.radioQueueCursor = 0",
  "immediatePlay: true",
  "userGesture: true"
]) {
  expect(codeHas(coldActivation, invariant), `cold Radio activation is missing ${invariant}`);
}
const coldStart = functionBody(radio, "startGlobalRandomPlayback", "resetPreparedInitialGlobalRandomPlayback");
expect(codeHas(coldStart, "activatePreparedInitialRadioPlayback()"), "cold Play does not consume the prepared Radio queue synchronously");
expect(!codeHas(coldStart, ".then("), "cold Play must not wait on a Promise before startTrack");
expect(!codeHas(coldStart, "setTimeout"), "cold Play must not wait on a timer before startTrack");

const startTrack = functionBody(core, "startTrack", "getRandomIndex");
expect(codeHas(startTrack, "opts.immediatePlay && opts.userGesture"), "startTrack lacks the guarded immediate user-gesture path");
expect(codeHas(startTrack, 'playErr.name === "NotSupportedError"') && codeHas(startTrack, 'strategy: "single_source_reset"'), "immediate NotSupportedError lacks its single guarded source reset");
expect(codeHas(startTrack, "waitForAudioReadiness(audio, requestToken") && codeHas(startTrack, "if (ready) {"), "playback recovery ignores the readiness result");
expect(codeHas(startTrack, "recoverFromTrackFailure(index, target.src, requestToken)"), "a readiness timeout has no bounded fallback recovery");
expect(codeHas(startTrack, "isFromTransportControl || hasPreparedTransportTarget"), "transport skips are not always on the synchronous path");
expect(codeHas(startTrack, "attemptPlay({ sync: true, immediate: isImmediateUserGesture })"), "immediate Play does not call audio.play() directly");
const beginPlaybackStart = codeIndexOf(startTrack, "function beginPlayback");
const beginPlaybackEnd = codeIndexOf(startTrack, "if (sameTrack)", beginPlaybackStart);
const beginPlayback = startTrack.slice(beginPlaybackStart, beginPlaybackEnd);
expect(codeIndexOf(beginPlayback, "attemptPlay({ sync: true, immediate: isImmediateUserGesture })") < codeIndexOf(beginPlayback, "waitForAudioReadiness(audio"), "immediate Play is ordered after the readiness wait");
const failureRecovery = functionBody(core, "recoverFromTrackFailure", "startTrack");
expect(codeHas(failureRecovery, "probeAudioSourceForRecovery"), "playback recovery does not verify the audio Range response");
expect(codeHas(failureRecovery, 'strategy: "range_probe_reset"'), "playback recovery does not expose its diagnostic strategy");
expect(codeHas(failureRecovery, "waitForAudioReadiness(audio, activeRequestToken"), "playback recovery calls play() before media readiness");
expect(codeHas(failureRecovery, 'failRecovery("reset_play_rejected"'), "playback recovery drops the actual play rejection");
expect(codeHas(scripts, "if (response.ok && validRange && validType)"), "an invalid recovery response can still download a complete audio body");
expect(codeHas(sw, 'type: "INFRA_AUDIO_NETWORK"'), "Service Worker does not expose audio network diagnostics");
expect(codeHas(sw, 'branch = "range_invalid"'), "Service Worker does not classify invalid Range responses");
expect(codeHas(telemetry, 'eventType === "audio_network_result"'), "audio network diagnostics are not correlated to the track transition");
expect(codeHas(telemetry, 'transition.result === "rejected"'), "MediaError events are not deduplicated after a rejected play");

const mediaSessionActions = functionBody(scripts, "bindMediaSessionActions", "syncMediaSessionMetadata");
for (const action of ["seekbackward", "seekforward"]) {
  expect(
    codeHas(mediaSessionActions, `safeSet("${action}", null)`),
    `iOS Media Session does not explicitly remove ${action}`
  );
}
expect(
  !codeHas(mediaSessionActions, 'safeSet("seekto", null)') &&
    codeHas(mediaSessionActions, 'safeSet("seekto", function (event)'),
  "iOS Media Session timeline scrubbing is not enabled through seekto"
);
expect(
  codeIndexOf(mediaSessionActions, 'safeSet("seekforward", null)') < codeIndexOf(mediaSessionActions, 'safeSet("previoustrack"'),
  "iOS seek actions are not removed before playlist controls are registered"
);
expect(
  codeHas(core, "bindMediaSessionActions({ force: true, quiet: true })"),
  "Media Session playlist controls are not reasserted after each successful track start"
);
expect(
  codeHas(mediaSession, 'audioSession.type = "playback"'),
  "Audio Session does not request long-form playback on supporting browsers"
);
const ensureGlobalAudio = functionBody(radio, "ensureGlobalAudio", "stopAudioRaf");
expect(
  codeIndexOf(ensureGlobalAudio, "configurePlaybackAudioSession();") < codeIndexOf(ensureGlobalAudio, "if (!audioState.homeModeInitialized)"),
  "Playback Audio Session is not configured before the global player initializes"
);
const audioSessionTelemetry = functionBody(scripts, "initAudioSessionTelemetry", "createScriptMediaCommand");
expect(
  codeHas(audioSessionTelemetry, 'currentState === "interrupted"') &&
    codeHas(audioSessionTelemetry, "audioState.audioSessionResumeAllowedUntil = now + 8000"),
  "Audio Session does not authorize the bounded interrupted-to-active resume window"
);
expect(
  codeHas(ensureGlobalAudio, "consumeAuthorizedSystemInterruptionResume(audio)") &&
    codeIndexOf(ensureGlobalAudio, "consumeAuthorizedSystemInterruptionResume(audio)") <
      codeIndexOf(ensureGlobalAudio, "shouldBlockHiddenSystemAutoResume(audio)"),
  "A legitimate WebKit interruption resume is still blocked before it can be recognized"
);
expect(
  codeHas(scripts, 'cancelSystemInterruptionResume("media_session")'),
  "An explicit Media Session pause does not cancel the pending system resume"
);
const visibilityHandler = radio.slice(
  codeIndexOf(radio, 'document.addEventListener("visibilitychange"'),
  codeIndexOf(radio, "audioState.resumeBound = true")
);
expect(
  codeIndexOf(visibilityHandler, "resyncMediaSessionControls()") < codeIndexOf(visibilityHandler, "saveResumeState();"),
  "Media Session controls are not reasserted before the PWA is handed to the lock screen"
);

const artworkCommit = functionBody(scripts, "buildArtworkBlobAndSetMetadata", "buildResponsiveCoverCandidate");
expect(
  codeHas(artworkCommit, "getMediaSessionAlbumArtwork(artworkEntries)") &&
    codeHas(artworkCommit, "if (!albumArtwork) return Promise.resolve(false)") &&
    codeHas(artworkCommit, "preloadImage(albumArtwork.src, { highPriority: true })"),
  "Media Session metadata does not wait for a real decoded album cover"
);
const metadataSync = functionBody(scripts, "syncMediaSessionMetadata", "scheduleMediaSessionResync");
expect(
  codeHas(metadataSync, "const hasAlbumArtwork = Boolean(getMediaSessionAlbumArtwork(artworkEntries))") &&
    codeHas(metadataSync, "if (hasAlbumArtwork && key !== audioState.lastMediaSessionKey)"),
  "Media Session can replace valid album metadata with the white fallback artwork"
);

const playHandlerStart = codeIndexOf(radio, 'audio.addEventListener("play"');
const pauseHandlerStart = codeIndexOf(radio, 'audio.addEventListener("pause"', playHandlerStart);
const playingHandlerStart = codeIndexOf(radio, 'audio.addEventListener("playing"');
expect(playHandlerStart >= 0 && pauseHandlerStart > playHandlerStart && playingHandlerStart > pauseHandlerStart, "play/pause/playing event handlers are missing");
expect(!codeHas(radio.slice(playHandlerStart, pauseHandlerStart), "trackStartInFlight = false"), "play must not confirm a pending start");
expect(codeHas(radio.slice(playingHandlerStart, playingHandlerStart + 1400), "trackStartInFlight = false"), "playing must confirm the pending start");

for (const invariant of [
  "PREFETCH_NEXT_QUEUE_DEPTH",
  "PREFETCH_NEXT_CONCURRENCY",
  "PREFETCH_BUFFER_STABLE_SECONDS",
  "PREFETCH_MAX_ATTEMPTS",
  "reconcileNextTrackPrefetchPlan",
  "prefetch_window_ready"
]) {
  expect(codeHas(radio, invariant) || codeHas(scripts, invariant), `rolling prefetch is missing ${invariant}`);
}
expect(codeHas(prefetch, 'CACHE_NAME: "infra-next-track-segments-v9"'), "prefetch cache is not v9");
expect(codeHas(prefetch, 'headers.set("X-Infra-Body-Validated", "1")'), "v9 writes lack an integrity-at-write marker");
expect(codeHas(prefetch, "PREFETCH_SEGMENT_SIZE: 2 * 1024 * 1024"), "prefetch segment is not 2 MiB");
expect(codeHas(prefetch, "QUEUE_DEPTH: 5"), "prefetch depth is not five");
expect(codeHas(prefetch, "CONCURRENCY: 2"), "prefetch concurrency is not two");
expect(codeHas(prefetch, "MAX_ENTRIES: 6"), "prefetch cache is not capped at six entries");
const putSingleStart = codeIndexOf(prefetch, "function putSingle");
const putSingleEnd = codeIndexOf(prefetch, "globalObject.InfraAudioPrefetch", putSingleStart);
const putSingle = putSingleStart >= 0 && putSingleEnd > putSingleStart
  ? prefetch.slice(putSingleStart, putSingleEnd)
  : "";
expect(codeIndexOf(putSingle, "normalizeAudioResponseForCache(response)") < codeIndexOf(putSingle, "enqueueMutation(function"), "response bodies are still serialized inside the cache mutation queue");
expect(codeHas(putSingle, "opts.onBodyReady"), "network timeout cannot end before serialized CacheStorage work");
expect(codeHas(prefetch, '"X-Infra-First-Two-Bytes"'), "cached segments lack the WebKit two-byte probe header");
expect(codeHas(prefetch, "result.probeReady !== false"), "cold playback can still promote an older v9 segment without the probe fast path");
expect(codeHas(radio, "result.probeReady === false"), "rolling hydration can still mark an older v9 segment ready");
expect(codeHas(radio, 'reason === "track_change" && !opts.consumedPrepared'), "an unprepared transport skip can still compete with speculative requests");
expect(codeHas(radio, 'suspendNextTrackPrefetch("waiting")') && codeHas(radio, 'suspendNextTrackPrefetch("stalled")'), "buffer events do not stop speculative network work");
expect(codeHas(radio, 'suspendNextTrackPrefetch("media_error")'), "media errors do not stop speculative network work");
expect(codeHas(radio, 'pauseContext === "explicit" && audioState.trackStartInFlight'), "an explicit pause cannot cancel a pending startup");
expect(codeHas(transport, "const radioIdleReady = !isRadioMode"), "Radio Play can still be enabled before a synchronous queue exists");
expect(codeHas(radio, "only once N+1 is actually available"), "N+1 no longer has strict mobile-network priority");
expect(!codeHas(radio, "clearCache("), "normal playback still performs a global prefetch-cache clear");
expect(!codeHas(prefetch, "function clearCache"), "segment cache still exposes destructive global clearing");

const playNext = functionBody(core, "playNext", "playPrevious");
expect(codeHas(playNext, "getQueuePreviewIndices(1)"), "Next does not consume the authoritative lookahead order");
expect(codeHas(core, "const planDepth = Math.max(requested, 5)"), "authoritative lookahead is not materialized to five tracks");
expect(codeHas(core, 'mode: "shuffle"'), "Shuffle lookahead is not materialized");
const queuePreview = functionBody(core, "getQueuePreviewIndices", "resetAudioElementForSource");
const resolveIndex = functionBody(core, "resolveIndex", "playNext");
expect(codeHas(queuePreview, "extendAlbumPlaylistToNextAlbum"), "album lookahead does not continue into the next chronological album");
expect(codeHas(resolveIndex, "extendAlbumPlaylistToNextAlbum"), "album Next does not continue into the next chronological album");
expect(codeHas(radio, "scopeAlbumPlaylistToCurrentTrack"), "legacy album queues are not scoped during restoration");
expect(codeHas(radio, 'maybePrefetchNextTrack("shuffle_mode_change")'), "Shuffle changes still discard the rolling prefetch window");

expect(!codeHas(albumUi, 'className = "track-controls"'), "album top transport controls are still injected");
expect(!codeHas(albumUi, "data-track-prev"), "album Previous control is still present");
expect(!codeHas(albumUi, "data-track-next"), "album Next control is still present");
expect(!codeHas(radio, "cleanupForeignAlbumAudioWhenIdle"), "foreign-album cleanup can still destroy the active player");
expect(!codeHas(radio, "cleanupIdleAudioContext"), "route lifecycle can still clear a paused player session");
expect(codeHas(nowPlaying, "animation.oncancel = finalize"), "fullscreen cancellation does not finalize mini-player restoration");
expect(codeHas(nowPlaying, "audioState.sourceMetadataPending"), "fullscreen time does not reset while new metadata is pending");
expect(codeHas(transport, "audioState.sourceMetadataPending"), "mini-player time does not reset while new metadata is pending");
expect(
  codeHas(startTrack, "bindMediaSessionActions({ force: true, quiet: true })"),
  "track changes do not reassert Media Session actions for WebKit"
);
expect(codeHas(scripts, 'getAttribute("onerror")'), "SPA cover fallbacks are not rebased with their source document");
const nextAlbumContinuity = functionBody(scripts, "findNextAlbumForContinuity", "findPreviousAlbumForContinuity");
const previousAlbumContinuity = functionBody(scripts, "findPreviousAlbumForContinuity", "buildAlbumContinuityTrack");
expect(!codeHas(nextAlbumContinuity, "% catalogAlbums.length") && !codeHas(nextAlbumContinuity, "% tracksAlbums.length"), "album Next continuity still wraps and can grow without bound");
expect(!codeHas(previousAlbumContinuity, "% catalogAlbums.length") && !codeHas(previousAlbumContinuity, "% tracksAlbums.length"), "album Previous continuity still wraps and can grow without bound");
const stallRecovery = functionBody(scripts, "recoverPlaybackFromStall", "scheduleWaitingRecovery");
expect(codeIndexOf(stallRecovery, 'audio.addEventListener("canplay", resume') < codeIndexOf(stallRecovery, "audio.load()"), "stall recovery still binds canplay after load");
expect(codeHas(radio, 'clearWaitingRecovery({ preserveStallRecovery: Boolean(audioState.stallRecovery) })'), "metadata readiness can still cancel a current stall recovery");

expect(codeHas(sw, "buildRangeResponseFromCachedAudio"), "Service Worker Range reconstruction is missing");
expect(codeHas(sw, "responseEnd = Math.min(range.end, metadata.cachedEnd)"), "open-ended Range is not bounded to the cached segment");
expect(codeHas(sw, "new Response(cached.body"), "full cached segments still require an arrayBuffer copy");
expect(codeHas(sw, "metadata.bodyValidated"), "zero-copy 206 is not restricted to bodies validated at write time");
expect(codeHas(sw, "cachedValidatorMatchesIfRange"), "If-Range compatibility guard is missing");
expect(codeHas(sw, 'rangeHeader === "bytes=0-1" ? "startup_probe_v9"'), "WebKit two-byte probes are not served by the dedicated fast path");
expect(codeHas(sw, "metadata.firstTwoBytes"), "Service Worker does not reuse the cached two-byte probe header");
expect(codeHas(sw, "isAudioPrefetchCache(key) && key !== NEXT_TRACK_CACHE"), "old audio caches are not migrated on activation");
expect(codeHas(sw, "event.clientId"), "prefetch-hit telemetry is not scoped to the requesting client");
expect(codeHas(sw, 'request.mode === "cors" && isSingleRange'), "Service Worker can still intercept a no-cors media request");
expect(codeHas(sw, 'headers.set("Access-Control-Allow-Origin", self.location.origin)'), "cached 206 does not use the active PWA origin");
expect(codeHas(sw, 'headers.set("Vary", "Origin")'), "cached 206 lacks Vary: Origin");
expect(codeHas(prefetch, 'mode: "cors"'), "prefetch request is not explicitly CORS");
expect(!codeHas(radio, 'removeAttribute("crossorigin")'), "global audio still removes crossorigin");
expect(!codeHas(albumUi, 'removeAttribute("crossorigin")'), "album audio still removes crossorigin");
expect(codeHas(radio, 'audio.crossOrigin = "anonymous"'), "global audio is not configured for anonymous CORS");
expect(codeHas(core, 'audio.crossOrigin = "anonymous"'), "source assignment does not reaffirm anonymous CORS");
expect(codeHas(telemetry, "const SESSION_EVENT_CAP = 48"), "session telemetry is not capped at 48 events");
expect(codeHas(telemetry, "const SESSION_STORE_CAP = 4"), "pending telemetry is not capped at four sessions");
expect(codeHas(telemetry, "const SESSION_TTL_MS = 72 * 60 * 60 * 1000"), "pending sessions lack the 72-hour TTL");
expect(codeHas(telemetry, '"response_ms", "body_ms", "queue_ms", "cache_ms"'), "prefetch stage timings are not retained by telemetry sanitation");
expect(codeHas(telemetry, '"prefetch_suspended"') && codeHas(telemetry, '"prefetch_window_ready"'), "useful prefetch health telemetry is not retained");
expect(codeHas(telemetry, 'credentials: "omit"'), "telemetry requests may still carry credentials");
expect(codeHas(telemetry, '"navigation_token"'), "SPA telemetry cannot correlate repeated navigation targets");
expect(codeHas(telemetry, 'reason: transition.reason || ""'), "SPA terminal reasons are not preserved");
expect(codeHas(telemetry, "cover_natural_width: transition.cover_natural_width"), "SPA telemetry does not retain decoded cover resolution");
expect(codeHas(telemetry, '"spa_html_response"'), "SPA telemetry does not retain the HTML response stage");
expect(codeHas(telemetry, "strategy: transition.strategy"), "SPA telemetry does not retain the active Worker strategy");
expect(codeHas(telemetry, "response_ms: transition.response_ms"), "SPA telemetry does not retain HTML response latency");
expect(codeHas(telemetry, '"html_cache_hit_count"'), "session telemetry does not retain HTML cache hits");
expect(codeHas(telemetry, '"cover_cache_miss_count"'), "session telemetry does not retain cover cache misses");
expect(codeHas(telemetry, '"storage_persisted_state"'), "session telemetry does not retain persistent-storage state");
expect(codeHas(telemetry, '"storage_cover_entries"'), "session telemetry does not retain local cover-cache inventory");
expect(codeHas(telemetry, '"cover_ready_at_first_paint"'), "session telemetry does not retain first-paint cover readiness");
expect(codeHas(telemetry, '"cover_ready_at_second_paint"'), "session telemetry does not retain second-paint cover readiness");
expect(codeHas(scripts, "storageManager.persist()"), "the installed PWA does not request persistent storage");
expect(codeHas(scripts, "recordStorageSnapshot"), "the installed PWA does not record its bounded local-storage snapshot");
expect(!codeHas(scripts, "pwa-home-return-hold"), "the removed Home-return visual snapshot is still present");
expect(!codeHas(scripts, 'document.createElement("canvas")'), "the removed PWA canvas snapshot is still present");
expect(codeHas(spa, "function applySpaScrollOnNextFrame"), "SPA scrolling is not isolated from route DOM mutation");
expect(codeHas(spa, 'image.setAttribute("decoding", "sync")'), "route-critical album covers are not decoded synchronously");
expect(codeHas(spa, 'spaState.activeNavigationHref === url.href'), "duplicate SPA album navigation is not coalesced");
expect(codeHas(spa, 'error && error.code === "SPA_PAGE_FETCH_TIMEOUT"'), "stuck SPA fetches have no bounded fallback");
expect(codeHas(spa, "loadedPage = await loadSpaPageDocument"), "album navigation does not use the shared page loader");
expect(codeHas(spaRouter, "PAGE_CACHE_LIMIT: 40"), "the SPA cache cannot retain home plus the complete album catalogue");
expect(codeHas(spaRouter, "PAGE_CACHE_LOOKUP_TIMEOUT_MS: 450"), "a stuck CacheStorage lookup can still freeze album navigation");
expect(codeHas(spaRouter, 'strategy: "window_shell_cache"'), "album navigation does not read the installed shell directly");
expect(codeHas(spaRouter, "inflightPages.has(key)"), "intent and click HTML requests are not deduplicated");
expect(codeHas(spaRouter, "Object.assign({}, options || {}, { cacheOnly: true })"), "album warmup can still start network requests");
expect(!codeHas(spa, 'prefetchSpaPage(url.href, { force: true'), "rendered album pages still force a network refresh");
expect(!codeHas(telemetry, "navigator.sendBeacon"), "cross-origin telemetry still uses sendBeacon");
expect(!codeHas(telemetry, "navigator.userAgent"), "full user-agent is still transmitted");
expect(!codeHas(telemetry, "local_time:"), "local time is still transmitted");
expect(codeHas(telemetry, "session_id: createSessionId()"), "session telemetry lacks its random retry-deduplication identifier");
expect(codeHas(scripts, 'window.location.origin === "https://infra-180.github.io"'), "telemetry is not restricted to the official origin client-side");
expect(codeHas(scripts, 'https://infra180-api.pages.dev'), "runtime does not use the neutral API hostname");
expect(codeHas(scripts, 'const AUDIO_BASE = "https://infra180-api.pages.dev/audio"'), "audio runtime does not use the Worker R2 proxy");
expect(!codeHas(scripts, '.r2.dev'), "audio runtime still uses the non-production r2.dev endpoint");
expect(codeHas(sw, 'const AUDIO_PROXY_HOST = "infra180-api.pages.dev"'), "Service Worker does not recognize the audio proxy host");
expect(codeHas(sw, 'const AUDIO_PROXY_PATH_PREFIX = "/audio/assets/music/streams/"'), "Service Worker audio proxy scope is too broad or missing");
expect(codeHas(sphragis, 'https://infra180-api.pages.dev'), "Sphragis does not use the neutral API hostname");
expect(!codeHas(scripts, 'workers.dev'), "a Workers account hostname remains in the runtime");
expect(!codeHas(sphragis, 'workers.dev'), "a Workers account hostname remains in Sphragis");
expect(codeHas(sw, 'sphragis.js?v=sphragis20260716'), "Service Worker still caches the pre-migration Sphragis asset key");
expect(codeHas(sphragisPage, 'sphragis.js?v=sphragis20260716'), "Sphragis page still loads the pre-migration asset key");
expect(!codeHas(telemetry, '"cover_prepare_item"'), "cover loading still floods remote audio telemetry");
expect(codeHas(sw, "htmlCacheFirst(request, SHELL_CACHE"), "PWA navigation is not shell cache-first");
expect(codeHas(sw, "precacheAlbumDocuments(cache)"), "album documents are not installed with the PWA shell");
expect(codeHas(sw, 'cache: "reload"'), "album installation may reuse stale HTTP documents");
expect(codeHas(sw, "Promise.all([cacheNext(), cacheNext(), cacheNext()])"), "album document installation is not bounded to three lanes");
const albumPageManifest = codeMatch(sw, /const ALBUM_PAGES = \[([\s\S]*?)\];/);
expect(Boolean(albumPageManifest), "Service Worker album document manifest is missing");
const installedAlbumPages = albumPageManifest
  ? Array.from(albumPageManifest[1].matchAll(/\.\/music\/[^"']+-infra\.html/g), (match) => match[0])
  : [];
expect(installedAlbumPages.length === catalogAlbumCount, `expected ${catalogAlbumCount} installed album documents, found ${installedAlbumPages.length}`);
expect(codeHas(sw, "event.respondWith(htmlCacheFirst(request, SHELL_CACHE));"), "SPA HTML fetches remain network-first");
const htmlCacheFirstBody = functionBody(sw, "htmlCacheFirst", "staleWhileRevalidate");
expect(codeIndexOf(htmlCacheFirstBody, "if (cached)") < codeIndexOf(htmlCacheFirstBody, "fetch(request)"), "a shell hit still starts a background HTML fetch");
expect(codeHas(sw, "HTML_NETWORK_INFLIGHT"), "Service Worker HTML cache misses are not deduplicated");
expect(codeHas(sw, 'headers.set("X-Infra-SW-Version", VERSION)'), "HTML responses do not identify the active Service Worker");
expect(codeHas(sw, 'headers.set("X-Infra-HTML-Cache"'), "HTML responses do not identify cache hits");
expect(!codeHas(scripts, "maybeActivateWaitingServiceWorker"), "the visible client still forces a waiting Service Worker to activate");
// INFRA 08/11/2026 : l'iPhone gardait l'ancienne version (PWA jamais fermée). Exception unique :
// activation demandée par la page visible et sans lecture, puis un seul rechargement gardé.
expect((codeMatch(sw, /skipWaiting/g) || []).length === 1 && codeTest(/INFRA_SW_ACTIVATE_IDLE[\s\S]{0,80}self\.skipWaiting\(\)/, sw), "the Service Worker bypasses the safe native waiting lifecycle");
expect((codeMatch(scripts, /window\.location\.reload\(\)/g) || []).length === 1 && codeTest(/if \(isBusyForServiceWorkerUpdate\(\)\) return;\s*window\.location\.reload\(\);/, scripts), "a Service Worker controller change can still reload the PWA during playback");
expect(codeHas(scripts, 'strategy: "natural_lifecycle"'), "controller changes do not identify the natural lifecycle strategy");
expect(!codeHas(scripts, "showPwaCoverHold(link, coverPlaceholderSrc);"), "album taps still display a foreground cover clone before navigation is ready");
expect(codeHas(scripts, 'releasePwaCoverHold("replace");'), "album taps do not clear a stale transition visual");
expect(codeHas(catalogLoader, "readCachedLiveCatalogLatest()"), "validated live CacheStorage is not consulted at startup");
expect(codeHas(catalogLoader, 'catalogState.catalogBundleSource = cachedLive ? "live-cache" : "local"'), "catalogue startup does not preserve cached live releases");
expect(codeHas(catalogLoader, "fetchLiveCatalogLatest().catch(function () {})"), "live catalogue refresh is not detached from startup");
expect(codeHas(scripts, 'const LIVE_CATALOG_CACHE_NAME = `${SPA_SHELL_VERSION}-catalog`'), "live catalogue cache is not isolated per installed shell");
expect(codeHas(sw, 'const LIVE_CATALOG_CACHE = `${VERSION}-catalog`'), "Service Worker catalogue cache contract is missing");
expect(codeHas(sw, '(isVersionedCatalogCache(key) && key !== LIVE_CATALOG_CACHE)'), "obsolete shell catalogue caches are not cleared on activation");
expect(codeHas(sw, 'key === "infra-live-catalog-v1"'), "legacy live catalogue cache is not retired on activation");
expect(codeHas(nowPlaying, 'trackAudioRuntimeEvent("fullscreen_viewport"'), "iOS fullscreen viewport telemetry is missing");
expect(codeHas(nowPlaying, "fullscreenViewportProbeSent"), "fullscreen viewport telemetry is not bounded per launch");
expect(codeHas(telemetry, '"fullscreen_viewport"'), "fullscreen viewport telemetry is not journaled");
expect(!codeHas(nowPlaying, "ios-standalone-viewport-gap"), "ineffective iOS viewport compensation is still active");
expect(!codeHas(telemetry, '"fullscreen_compensated"'), "obsolete fullscreen compensation telemetry remains");

// Lot 3 (INFRA, 09/11/2026) : l'empreinte de styles.css est remplacée par les captures comparées au pixel
// (npm run visual, grand lecteur compris) ; les contrôles précis ci-dessous restent.
expect(
  codeTest(/\.global-transport-mini-progress\s*\{[^}]*height:\s*26px;[^}]*margin:\s*-4px 0;/, styles),
  "mini-player seek control does not preserve its enlarged touch target"
);
expect(!codeHas(styles, "100lvh"), "forbidden 100lvh geometry was introduced");
expect(codeHas(styles, ".share-dialog-close:focus-visible"), "QR close control does not keep the pure cross state");
expect(codeHas(styles, "transform: translateZ(0) scale(1.002)"), "WebKit cover seam guard is missing");
expect(codeHas(styles, "bottom: env(safe-area-inset-bottom);"), "mobile mini-player is not anchored exactly above the Home Indicator safe area");

const htmlFiles = ["public/index.html"]
  .concat(fs.readdirSync(path.join(root, "public/music"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/music/${name}`))
  .concat(fs.readdirSync(path.join(root, "public/apps"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/apps/${name}`))
  .concat(fs.readdirSync(path.join(root, "public/playlists"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/playlists/${name}`));
expect(htmlFiles.length === catalogAlbumCount + 8, `expected ${catalogAlbumCount + 8} player documents, found ${htmlFiles.length}`);
for (const relativePath of htmlFiles) {
  const source = read(relativePath);
  expect(codeHas(source, release), `${relativePath} does not reference ${release}`);
  expect(codeHas(source, cssRelease), `${relativePath} does not reference ${cssRelease}`);
  expect(codeHas(source, "infra:launch-watchdog:v1"), `${relativePath} has no startup watchdog`);
  expect(!codeTest(/maximum-scale\s*=|user-scalable\s*=\s*no/i, source), `${relativePath} disables viewport zoom`);
  expect(!codeHas(source, "audiofix326-20260715"), `${relativePath} still references audiofix326 JavaScript`);
}

const albumCoverUrls = new Set();
for (const relativePath of ["public/index.html"].concat(
  fs.readdirSync(path.join(root, "public/music"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/music/${name}`)
)) {
  const source = read(relativePath);
  expect(!codeTest(/cover-(?:480|900)\.webp/i, source), `${relativePath} still references a legacy cover variant`);
  if (relativePath !== "public/index.html") {
    expect(!codeTest(/class="[^"]*(?:album-cover|\bcover\b)[^"]*"[^>]*\bsrcset=/i, source), `${relativePath} still selects multiple album cover files`);
  }
  for (const match of source.matchAll(/assets\/music\/responsive\/([a-z0-9-]+-cover-1200\.webp)/gi)) {
    albumCoverUrls.add(match[1]);
  }
}
for (const fileName of albumCoverUrls) {
  expect(fs.existsSync(path.join(root, "public/assets/music/responsive", fileName)), `missing canonical cover ${fileName}`);
}
expect(albumCoverUrls.size >= catalogAlbumCount, `expected at least ${catalogAlbumCount} canonical album covers, found ${albumCoverUrls.size}`);

if (!process.exitCode) console.log(`Audio stability checks passed for ${release}.`);
