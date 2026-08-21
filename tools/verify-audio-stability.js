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

const release = "audiofix395-20260821";
const shellRelease = "infra-shell-20260821-audio395";
const cssRelease = "audiofix395-20260821";
const frozenCssSha256 = "fb0d382ea68134269952dea7dbf44dd9015425b475bf9503971a509b072c78ce";
const scripts = read("public/assets/js/scripts.js");
const radio = read("public/assets/js/audio-radio.js");
const core = read("public/assets/js/audio-core.js");
const mediaSession = read("public/assets/js/media-session.js");
const prefetch = read("public/assets/js/audio-prefetch.js");
const catalogLoader = read("public/assets/js/catalog-loader.js");
const albumUi = read("public/assets/js/album-player-ui.js");
const nowPlaying = read("public/assets/js/now-playing.js");
const transport = read("public/assets/js/transport-ui.js");
const visualizer = read("public/assets/js/audio-visualizer.js");
const telemetry = read("public/assets/js/audio-telemetry.js");
const covers = read("public/assets/js/covers.js");
const spa = read("public/assets/js/spa-renderer.js");
const spaRouter = read("public/assets/js/spa-router.js");
const sphragis = read("public/assets/js/sphragis.js");
const sphragisPage = read("public/sphragis/index.html");
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

expect(scripts.includes(`window.INFRA_BUILD_TAG = "${release}"`), "runtime build tag is not audiofix395");
expect(scripts.includes(`const runtimeVersion = "${release}"`), "runtime query version is not audiofix395");
expect(sw.includes(`const VERSION = "${shellRelease}"`), "Service Worker cache version is not audio393");
expect(sw.includes('const NEXT_TRACK_CACHE = "infra-next-track-segments-v9"'), "Service Worker does not use segment cache v9");
expect(covers.includes('CANONICAL_WIDTH: 1200'), "album artwork is not canonicalized to 1200 px");
expect(covers.includes('CACHE_NAME: "infra-covers-v2"'), "canonical covers do not use the isolated cache v2");
expect(covers.includes("adc-13-6e983f31-cover-1200.webp"), "stale ADC13 artwork is not rewritten to the new canonical cover");
expect(catalogLoader.includes('normalizeCoverUrl", rawThumb, { width: 1200 }'), "live catalogue can reintroduce a non-canonical album cover");
expect(sw.includes('const COVERS_CACHE = "infra-covers-v2"'), "Service Worker does not share the canonical cover cache");
expect(sw.includes("cover-1200\\.webp"), "Service Worker does not cache the canonical cover URL");
expect(!transport.includes("nowPlayingMetaIdleTimer"), "desktop metadata idle timer is still present");
expect(!transport.includes("is-meta-idle"), "desktop metadata idle state is still present");
expect(!styles.includes("is-meta-idle"), "desktop metadata idle opacity rule is still present");
expect(transport.includes("data-now-playing-visual-canvas"), "desktop fullscreen has no visual canvas");
expect(transport.includes("ensureDesktopAudioVisualizer"), "desktop fullscreen does not own the visualizer lifecycle");
expect(transport.includes("visualizer.activate()"), "desktop fullscreen click does not unlock live audio analysis");
expect(transport.includes('trackAudioRuntimeEvent("visualizer_health"'), "desktop visualizer has no compact health telemetry");
expect(visualizer.includes("FRAME_INTERVAL_MS = 1000 / 30"), "desktop visualizer is not capped at 30 fps");
expect(visualizer.includes("ENERGY_ATTACK_SECONDS = 0.045"), "desktop visualizer has no fast rhythmic attack");
expect(visualizer.includes("ENERGY_RELEASE_SECONDS = 0.26"), "desktop visualizer has no controlled energy release");
expect(visualizer.includes("SPECTRUM_ATTACK_SECONDS = 0.035"), "desktop frequency spectrum has no fast per-point attack");
expect(visualizer.includes("SPECTRUM_RELEASE_SECONDS = 0.18"), "desktop frequency spectrum has no controlled per-point release");
expect(visualizer.includes("SPECTRUM_SPATIAL_KERNEL = Object.freeze([1, 4, 6, 4, 1])"), "desktop frequency spectrum has no five-band spatial smoothing");
expect(visualizer.includes("smoothSpectrumSpatially(points)"), "desktop frequency spectrum does not smooth raw logarithmic bands");
expect(visualizer.includes("FFT_SIZE = 2048"), "desktop frequency spectrum has insufficient FFT resolution");
expect(visualizer.includes("MIN_FREQUENCY_HZ = 40"), "desktop frequency spectrum has no low-frequency boundary");
expect(visualizer.includes("MAX_FREQUENCY_HZ = 16000"), "desktop frequency spectrum has no high-frequency boundary");
expect(visualizer.includes("Math.pow(ratioRange"), "desktop visualizer x-axis is not logarithmic in Hz");
expect(visualizer.includes("const centerY = size.height * 0.5"), "desktop frequency spectrum has no fixed central axis");
expect(visualizer.includes("size.height * 0.25"), "desktop frequency spectrum does not use the compact mirrored range");
expect(visualizer.includes("dynamicHeight, -1, false"), "desktop frequency spectrum is not drawn above its axis");
expect(visualizer.includes("dynamicHeight, 1, false"), "desktop frequency spectrum is not drawn below its axis");
expect(visualizer.includes("const PURE_FFT_MODE = true"), "desktop visualizer is not in pure FFT comparison mode");
expect(visualizer.includes("POWDER_EARTH_PARTICLE_COUNT = 250000"), "desktop powder field does not contain 250,000 Earth particles");
expect(visualizer.includes("POWDER_MOON_PARTICLE_COUNT = 250000"), "desktop powder field does not contain 250,000 lunar particles");
expect(visualizer.includes("POWDER_PARTICLE_COUNT = 500000"), "desktop powder field does not contain 500,000 particles");
expect(visualizer.includes("POWDER_HELIX_PARTICLE_COUNT = 60000"), "desktop powder field does not contain its 60,000-grain helix");
expect(
  visualizer.includes("createPowderParticles(PURE_FFT_MODE ? 0 : POWDER_PARTICLE_COUNT)"),
  "pure FFT mode does not suppress particle allocation"
);
expect(visualizer.includes("height: new Float32Array(particleCount)"), "desktop powder does not use compact persistent heights");
expect(visualizer.includes("side: new Uint8Array(particleCount)"), "desktop powder does not retain its upper/lower face");
expect(visualizer.includes("gravityClass: new Uint8Array(particleCount)"), "desktop powder does not retain its gravity class");
expect(visualizer.includes("helixOffset: new Float32Array(particleCount)"), "desktop powder does not retain helix offsets");
expect(visualizer.includes("helixBaseSin: new Float32Array(particleCount)"), "desktop powder does not precompute helix phases");
expect(visualizer.includes("bandIndex: new Uint16Array(particleCount)"), "desktop powder does not preassign FFT bands");
expect(visualizer.includes("powderContext.createImageData(width, height)"), "desktop powder field has no reusable pixel buffer");
expect(visualizer.includes("EARTH_GRAVITY_METERS_PER_SECOND2 = 9.80665"), "desktop powder does not use Earth gravity");
expect(visualizer.includes("MOON_GRAVITY_METERS_PER_SECOND2 = 1.62"), "desktop powder does not use lunar gravity");
expect(visualizer.includes("updatePowderBandMap(values.length)"), "desktop powder does not reuse preassigned local FFT bands");
expect(visualizer.includes("powderContainmentEnvelope[index] = Math.max("), "desktop powder has no FFT containment envelope");
expect(visualizer.includes("velocity -= gravity * step"), "desktop powder has no persistent hybrid-gravity fall");
expect(visualizer.includes("(sides[index] ? 1 : -1)"), "desktop powder is not rendered above and below the axis");
expect(visualizer.includes("powderHelixRotationPhase"), "desktop powder has no rotating helix phase");
expect(visualizer.includes("HELIX_DRIVE_ATTACK_SECONDS = 0.09"), "desktop helix drive has no temporal smoothing");
expect(visualizer.includes("frameHeight * (0.035 + (signal * 0.18))"), "desktop helix radius is not reduced");
expect(visualizer.includes("targetOffset - helixOffset"), "desktop powder helix has no physical spring");
expect(visualizer.includes("const restingOpacity = moving ? 1 : 0.34"), "desktop powder does not reduce its static central density");
expect(visualizer.includes("drawingContext.quadraticCurveTo("), "desktop frequency spectrum is still drawn as angular segments");
expect(visualizer.includes("powderContainmentRawEnvelope[index],"), "desktop powder containment is not smoothed without lowering its raw ceiling");
expect(visualizer.includes("impactSpeed * restitutions[index]"), "desktop powder has no damped ground collision");
expect(visualizer.includes("drawingContext.drawImage("), "desktop powder buffer is not composited efficiently");
expect(
  visualizer.includes("if (!PURE_FFT_MODE) {\n        updatePowderPhysics("),
  "pure FFT mode does not suppress particle simulation"
);
expect(visualizer.includes("if (!PURE_FFT_MODE) drawPowder(size, centerY);"), "pure FFT mode does not suppress particle drawing");
expect(!visualizer.includes("drawingContext.clip()"), "desktop ballistic powder is still clipped by the current FFT envelope");
expect(!visualizer.includes("powderPulse"), "desktop powder still uses a global pulse instead of local FFT displacement");
expect(
  !visualizer.includes('drawingContext.strokeStyle = "rgba(255,255,255,0.13)"'),
  "desktop pure FFT comparison still draws the median line"
);
const coldOpenBody = functionBody(nowPlaying, "openNowPlayingOverlay", "closeNowPlayingOverlay");
expect(
  coldOpenBody.indexOf("syncTransportUi();") > coldOpenBody.indexOf("audioState.nowPlayingOpen = true"),
  "cold fullscreen open does not immediately activate the desktop visualizer"
);
expect(visualizer.includes("(prefers-reduced-motion: reduce)"), "desktop visualizer ignores reduced motion");
expect(visualizer.includes("document.hidden"), "desktop visualizer does not stop while hidden");
expect(visualizer.includes("createMediaElementSource(audio)"), "desktop visualizer does not analyze the global media element");
expect(visualizer.includes("source.connect(context.destination)"), "live analyser does not preserve the direct audible route");
expect(visualizer.includes("source.connect(analyser)"), "live analyser is not connected as a side branch");
expect(!/analyser\.connect\s*\(\s*context\.destination/.test(visualizer), "live analyser duplicates the audible route");
expect(!fs.existsSync(path.join(root, "public/data/audio-visuals.json")), "stale precomputed visual data is still public");
expect(visualizer.includes("getHealthSnapshot"), "desktop visualizer does not aggregate health locally");
expect(visualizer.includes('emitHealth("active_probe")'), "desktop visualizer has no bounded active probe");
expect(telemetry.includes("processVisualizerHealth"), "visualizer health is not compacted into session telemetry");
expect(telemetry.includes('upsertCompactEvent("visualizer_health"'), "visualizer health appends duplicate session events");
expect(styles.includes(".now-playing-visual.is-active.is-ready"), "desktop visualizer has no ready-state styling");
expect(!sw.slice(sw.indexOf('self.addEventListener("install"'), sw.indexOf('self.addEventListener("activate"')).includes("skipWaiting"), "Service Worker still activates during a live audio session");
expect(sw.includes("const OPTIONAL_SHELL_ASSETS"), "optional shell resources are not isolated");
expect(sw.includes("Promise.allSettled("), "an optional resource can still invalidate the PWA shell");
expect(scripts.includes("audioState.albumCoverPrimeUrls.delete(url)"), "a transient cover-prime failure remains permanently locked");

const coldPreparation = functionBody(radio, "prepareInitialGlobalRandomPlayback", "scheduleInitialGlobalRandomPreparation");
expect(coldPreparation.includes("buildRadioQueue"), "cold startup does not materialize the Radio queue");
expect(coldPreparation.includes("audio_fetch: false"), "cold metadata preparation is not explicitly audio-free");
expect(!/\bfetch\s*\(/.test(coldPreparation), "cold metadata preparation must not download audio");
expect(!coldPreparation.includes("startNextTrackPrefetch"), "cold metadata preparation must not prefetch a media segment");
expect(coldPreparation.includes("promoteCachedPreparedInitialTrack"), "cold Radio preparation does not reuse an existing v9 segment");
expect(prefetch.includes("findFirstValidCachedSegment"), "v9 cache does not expose ordered cached-source lookup");
expect(prefetch.includes("findValidCachedSegments"), "v9 cache does not expose bounded grouped restoration");
const coldCachePrefix = functionBody(radio, "promoteCachedPreparedInitialTrack", "prepareInitialGlobalRandomPlayback");
expect(coldCachePrefix.includes("cachedTracks.concat(remainingTracks)"), "cold Radio does not materialize a contiguous cached prefix");
expect(coldCachePrefix.includes("restored_count: cachedTracks.length"), "cold Radio cache restoration is not measurable");
expect(!/\bfetch\s*\(/.test(coldCachePrefix), "cold cached-prefix restoration must not download audio");

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
expect(startTrack.includes('playErr.name === "NotSupportedError"') && startTrack.includes('strategy: "single_source_reset"'), "immediate NotSupportedError lacks its single guarded source reset");
expect(startTrack.includes("waitForAudioReadiness(audio, requestToken") && startTrack.includes("if (ready) {"), "playback recovery ignores the readiness result");
expect(startTrack.includes("recoverFromTrackFailure(index, target.src, requestToken)"), "a readiness timeout has no bounded fallback recovery");
expect(startTrack.includes("isFromTransportControl || hasPreparedTransportTarget"), "transport skips are not always on the synchronous path");
expect(startTrack.includes("attemptPlay({ sync: true, immediate: isImmediateUserGesture })"), "immediate Play does not call audio.play() directly");
const beginPlaybackStart = startTrack.indexOf("function beginPlayback");
const beginPlaybackEnd = startTrack.indexOf("if (sameTrack)", beginPlaybackStart);
const beginPlayback = startTrack.slice(beginPlaybackStart, beginPlaybackEnd);
expect(beginPlayback.indexOf("attemptPlay({ sync: true, immediate: isImmediateUserGesture })") < beginPlayback.indexOf("waitForAudioReadiness(audio"), "immediate Play is ordered after the readiness wait");
const failureRecovery = functionBody(core, "recoverFromTrackFailure", "startTrack");
expect(failureRecovery.includes("probeAudioSourceForRecovery"), "playback recovery does not verify the audio Range response");
expect(failureRecovery.includes('strategy: "range_probe_reset"'), "playback recovery does not expose its diagnostic strategy");
expect(failureRecovery.includes("waitForAudioReadiness(audio, activeRequestToken"), "playback recovery calls play() before media readiness");
expect(failureRecovery.includes('failRecovery("reset_play_rejected"'), "playback recovery drops the actual play rejection");
expect(scripts.includes("if (response.ok && validRange && validType)"), "an invalid recovery response can still download a complete audio body");
expect(sw.includes('type: "INFRA_AUDIO_NETWORK"'), "Service Worker does not expose audio network diagnostics");
expect(sw.includes('branch = "range_invalid"'), "Service Worker does not classify invalid Range responses");
expect(telemetry.includes('eventType === "audio_network_result"'), "audio network diagnostics are not correlated to the track transition");
expect(telemetry.includes('transition.result === "rejected"'), "MediaError events are not deduplicated after a rejected play");

const mediaSessionActions = functionBody(scripts, "bindMediaSessionActions", "syncMediaSessionMetadata");
for (const action of ["seekbackward", "seekforward"]) {
  expect(
    mediaSessionActions.includes(`safeSet("${action}", null)`),
    `iOS Media Session does not explicitly remove ${action}`
  );
}
expect(
  !mediaSessionActions.includes('safeSet("seekto", null)') &&
    mediaSessionActions.includes('safeSet("seekto", function (event)'),
  "iOS Media Session timeline scrubbing is not enabled through seekto"
);
expect(
  mediaSessionActions.indexOf('safeSet("seekforward", null)') < mediaSessionActions.indexOf('safeSet("previoustrack"'),
  "iOS seek actions are not removed before playlist controls are registered"
);
expect(
  core.includes("bindMediaSessionActions({ force: true, quiet: true })"),
  "Media Session playlist controls are not reasserted after each successful track start"
);
expect(
  mediaSession.includes('audioSession.type = "playback"'),
  "Audio Session does not request long-form playback on supporting browsers"
);
const ensureGlobalAudio = functionBody(radio, "ensureGlobalAudio", "stopAudioRaf");
expect(
  ensureGlobalAudio.indexOf("configurePlaybackAudioSession();") < ensureGlobalAudio.indexOf("if (!audioState.homeModeInitialized)"),
  "Playback Audio Session is not configured before the global player initializes"
);
const audioSessionTelemetry = functionBody(scripts, "initAudioSessionTelemetry", "createScriptMediaCommand");
expect(
  audioSessionTelemetry.includes('currentState === "interrupted"') &&
    audioSessionTelemetry.includes("audioState.audioSessionResumeAllowedUntil = now + 8000"),
  "Audio Session does not authorize the bounded interrupted-to-active resume window"
);
expect(
  ensureGlobalAudio.includes("consumeAuthorizedSystemInterruptionResume(audio)") &&
    ensureGlobalAudio.indexOf("consumeAuthorizedSystemInterruptionResume(audio)") <
      ensureGlobalAudio.indexOf("shouldBlockHiddenSystemAutoResume(audio)"),
  "A legitimate WebKit interruption resume is still blocked before it can be recognized"
);
expect(
  scripts.includes('cancelSystemInterruptionResume("media_session")'),
  "An explicit Media Session pause does not cancel the pending system resume"
);
const visibilityHandler = radio.slice(
  radio.indexOf('document.addEventListener("visibilitychange"'),
  radio.indexOf("audioState.resumeBound = true")
);
expect(
  visibilityHandler.indexOf("resyncMediaSessionControls()") < visibilityHandler.indexOf("saveResumeState();"),
  "Media Session controls are not reasserted before the PWA is handed to the lock screen"
);

const artworkCommit = functionBody(scripts, "buildArtworkBlobAndSetMetadata", "buildResponsiveCoverCandidate");
expect(
  artworkCommit.includes("getMediaSessionAlbumArtwork(artworkEntries)") &&
    artworkCommit.includes("if (!albumArtwork) return Promise.resolve(false)") &&
    artworkCommit.includes("preloadImage(albumArtwork.src, { highPriority: true })"),
  "Media Session metadata does not wait for a real decoded album cover"
);
const metadataSync = functionBody(scripts, "syncMediaSessionMetadata", "scheduleMediaSessionResync");
expect(
  metadataSync.includes("const hasAlbumArtwork = Boolean(getMediaSessionAlbumArtwork(artworkEntries))") &&
    metadataSync.includes("if (hasAlbumArtwork && key !== audioState.lastMediaSessionKey)"),
  "Media Session can replace valid album metadata with the white fallback artwork"
);

const playHandlerStart = radio.indexOf('audio.addEventListener("play"');
const pauseHandlerStart = radio.indexOf('audio.addEventListener("pause"', playHandlerStart);
const playingHandlerStart = radio.indexOf('audio.addEventListener("playing"');
expect(playHandlerStart >= 0 && pauseHandlerStart > playHandlerStart && playingHandlerStart > pauseHandlerStart, "play/pause/playing event handlers are missing");
expect(!radio.slice(playHandlerStart, pauseHandlerStart).includes("trackStartInFlight = false"), "play must not confirm a pending start");
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
expect(prefetch.includes('CACHE_NAME: "infra-next-track-segments-v9"'), "prefetch cache is not v9");
expect(prefetch.includes('headers.set("X-Infra-Body-Validated", "1")'), "v9 writes lack an integrity-at-write marker");
expect(prefetch.includes("PREFETCH_SEGMENT_SIZE: 2 * 1024 * 1024"), "prefetch segment is not 2 MiB");
expect(prefetch.includes("QUEUE_DEPTH: 5"), "prefetch depth is not five");
expect(prefetch.includes("CONCURRENCY: 2"), "prefetch concurrency is not two");
expect(prefetch.includes("MAX_ENTRIES: 6"), "prefetch cache is not capped at six entries");
const putSingleStart = prefetch.indexOf("function putSingle");
const putSingleEnd = prefetch.indexOf("globalObject.InfraAudioPrefetch", putSingleStart);
const putSingle = putSingleStart >= 0 && putSingleEnd > putSingleStart
  ? prefetch.slice(putSingleStart, putSingleEnd)
  : "";
expect(putSingle.indexOf("normalizeAudioResponseForCache(response)") < putSingle.indexOf("enqueueMutation(function"), "response bodies are still serialized inside the cache mutation queue");
expect(putSingle.includes("opts.onBodyReady"), "network timeout cannot end before serialized CacheStorage work");
expect(prefetch.includes('"X-Infra-First-Two-Bytes"'), "cached segments lack the WebKit two-byte probe header");
expect(prefetch.includes("result.probeReady !== false"), "cold playback can still promote an older v9 segment without the probe fast path");
expect(radio.includes("result.probeReady === false"), "rolling hydration can still mark an older v9 segment ready");
expect(radio.includes('reason === "track_change" && !opts.consumedPrepared'), "an unprepared transport skip can still compete with speculative requests");
expect(radio.includes('suspendNextTrackPrefetch("waiting")') && radio.includes('suspendNextTrackPrefetch("stalled")'), "buffer events do not stop speculative network work");
expect(radio.includes('suspendNextTrackPrefetch("media_error")'), "media errors do not stop speculative network work");
expect(radio.includes('pauseContext === "explicit" && audioState.trackStartInFlight'), "an explicit pause cannot cancel a pending startup");
expect(transport.includes("const radioIdleReady = !isRadioMode"), "Radio Play can still be enabled before a synchronous queue exists");
expect(radio.includes("only once N+1 is actually available"), "N+1 no longer has strict mobile-network priority");
expect(!radio.includes("clearCache("), "normal playback still performs a global prefetch-cache clear");
expect(!prefetch.includes("function clearCache"), "segment cache still exposes destructive global clearing");

const playNext = functionBody(core, "playNext", "playPrevious");
expect(playNext.includes("getQueuePreviewIndices(1)"), "Next does not consume the authoritative lookahead order");
expect(core.includes("const planDepth = Math.max(requested, 5)"), "authoritative lookahead is not materialized to five tracks");
expect(core.includes('mode: "shuffle"'), "Shuffle lookahead is not materialized");
const queuePreview = functionBody(core, "getQueuePreviewIndices", "resetAudioElementForSource");
const resolveIndex = functionBody(core, "resolveIndex", "playNext");
expect(queuePreview.includes("extendAlbumPlaylistToNextAlbum"), "album lookahead does not continue into the next chronological album");
expect(resolveIndex.includes("extendAlbumPlaylistToNextAlbum"), "album Next does not continue into the next chronological album");
expect(radio.includes("scopeAlbumPlaylistToCurrentTrack"), "legacy album queues are not scoped during restoration");
expect(radio.includes('maybePrefetchNextTrack("shuffle_mode_change")'), "Shuffle changes still discard the rolling prefetch window");

expect(!albumUi.includes('className = "track-controls"'), "album top transport controls are still injected");
expect(!albumUi.includes("data-track-prev"), "album Previous control is still present");
expect(!albumUi.includes("data-track-next"), "album Next control is still present");
expect(!radio.includes("cleanupForeignAlbumAudioWhenIdle"), "foreign-album cleanup can still destroy the active player");
expect(!radio.includes("cleanupIdleAudioContext"), "route lifecycle can still clear a paused player session");
expect(nowPlaying.includes("animation.oncancel = finalize"), "fullscreen cancellation does not finalize mini-player restoration");
expect(nowPlaying.includes("audioState.sourceMetadataPending"), "fullscreen time does not reset while new metadata is pending");
expect(transport.includes("audioState.sourceMetadataPending"), "mini-player time does not reset while new metadata is pending");
expect(
  startTrack.includes("bindMediaSessionActions({ force: true, quiet: true })"),
  "track changes do not reassert Media Session actions for WebKit"
);
expect(scripts.includes('getAttribute("onerror")'), "SPA cover fallbacks are not rebased with their source document");
const nextAlbumContinuity = functionBody(scripts, "findNextAlbumForContinuity", "findPreviousAlbumForContinuity");
const previousAlbumContinuity = functionBody(scripts, "findPreviousAlbumForContinuity", "buildAlbumContinuityTrack");
expect(!nextAlbumContinuity.includes("% catalogAlbums.length") && !nextAlbumContinuity.includes("% tracksAlbums.length"), "album Next continuity still wraps and can grow without bound");
expect(!previousAlbumContinuity.includes("% catalogAlbums.length") && !previousAlbumContinuity.includes("% tracksAlbums.length"), "album Previous continuity still wraps and can grow without bound");
const stallRecovery = functionBody(scripts, "recoverPlaybackFromStall", "scheduleWaitingRecovery");
expect(stallRecovery.indexOf('audio.addEventListener("canplay", resume') < stallRecovery.indexOf("audio.load()"), "stall recovery still binds canplay after load");
expect(radio.includes('clearWaitingRecovery({ preserveStallRecovery: Boolean(audioState.stallRecovery) })'), "metadata readiness can still cancel a current stall recovery");

expect(sw.includes("buildRangeResponseFromCachedAudio"), "Service Worker Range reconstruction is missing");
expect(sw.includes("responseEnd = Math.min(range.end, metadata.cachedEnd)"), "open-ended Range is not bounded to the cached segment");
expect(sw.includes("new Response(cached.body"), "full cached segments still require an arrayBuffer copy");
expect(sw.includes("metadata.bodyValidated"), "zero-copy 206 is not restricted to bodies validated at write time");
expect(sw.includes("cachedValidatorMatchesIfRange"), "If-Range compatibility guard is missing");
expect(sw.includes('rangeHeader === "bytes=0-1" ? "startup_probe_v9"'), "WebKit two-byte probes are not served by the dedicated fast path");
expect(sw.includes("metadata.firstTwoBytes"), "Service Worker does not reuse the cached two-byte probe header");
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
expect(telemetry.includes("const SESSION_EVENT_CAP = 48"), "session telemetry is not capped at 48 events");
expect(telemetry.includes("const SESSION_STORE_CAP = 4"), "pending telemetry is not capped at four sessions");
expect(telemetry.includes("const SESSION_TTL_MS = 72 * 60 * 60 * 1000"), "pending sessions lack the 72-hour TTL");
expect(telemetry.includes('"response_ms", "body_ms", "queue_ms", "cache_ms"'), "prefetch stage timings are not retained by telemetry sanitation");
expect(telemetry.includes('"prefetch_suspended"') && telemetry.includes('"prefetch_window_ready"'), "useful prefetch health telemetry is not retained");
expect(telemetry.includes('credentials: "omit"'), "telemetry requests may still carry credentials");
expect(telemetry.includes('"navigation_token"'), "SPA telemetry cannot correlate repeated navigation targets");
expect(telemetry.includes('reason: transition.reason || ""'), "SPA terminal reasons are not preserved");
expect(telemetry.includes("cover_natural_width: transition.cover_natural_width"), "SPA telemetry does not retain decoded cover resolution");
expect(telemetry.includes('"spa_html_response"'), "SPA telemetry does not retain the HTML response stage");
expect(telemetry.includes("strategy: transition.strategy"), "SPA telemetry does not retain the active Worker strategy");
expect(telemetry.includes("response_ms: transition.response_ms"), "SPA telemetry does not retain HTML response latency");
expect(telemetry.includes('"html_cache_hit_count"'), "session telemetry does not retain HTML cache hits");
expect(telemetry.includes('"cover_cache_miss_count"'), "session telemetry does not retain cover cache misses");
expect(telemetry.includes('"storage_persisted_state"'), "session telemetry does not retain persistent-storage state");
expect(telemetry.includes('"storage_cover_entries"'), "session telemetry does not retain local cover-cache inventory");
expect(telemetry.includes('"cover_ready_at_first_paint"'), "session telemetry does not retain first-paint cover readiness");
expect(telemetry.includes('"cover_ready_at_second_paint"'), "session telemetry does not retain second-paint cover readiness");
expect(scripts.includes("storageManager.persist()"), "the installed PWA does not request persistent storage");
expect(scripts.includes("recordStorageSnapshot"), "the installed PWA does not record its bounded local-storage snapshot");
expect(!scripts.includes("pwa-home-return-hold"), "the removed Home-return visual snapshot is still present");
expect(!scripts.includes('document.createElement("canvas")'), "the removed PWA canvas snapshot is still present");
expect(spa.includes("function applySpaScrollOnNextFrame"), "SPA scrolling is not isolated from route DOM mutation");
expect(spa.includes('image.setAttribute("decoding", "sync")'), "route-critical album covers are not decoded synchronously");
expect(spa.includes('spaState.activeNavigationHref === url.href'), "duplicate SPA album navigation is not coalesced");
expect(spa.includes('error && error.code === "SPA_PAGE_FETCH_TIMEOUT"'), "stuck SPA fetches have no bounded fallback");
expect(spa.includes("loadedPage = await loadSpaPageDocument"), "album navigation does not use the shared page loader");
expect(spaRouter.includes("PAGE_CACHE_LIMIT: 40"), "the SPA cache cannot retain home plus all 31 albums");
expect(spaRouter.includes("PAGE_CACHE_LOOKUP_TIMEOUT_MS: 450"), "a stuck CacheStorage lookup can still freeze album navigation");
expect(spaRouter.includes('strategy: "window_shell_cache"'), "album navigation does not read the installed shell directly");
expect(spaRouter.includes("inflightPages.has(key)"), "intent and click HTML requests are not deduplicated");
expect(spaRouter.includes("Object.assign({}, options || {}, { cacheOnly: true })"), "album warmup can still start network requests");
expect(!spa.includes('prefetchSpaPage(url.href, { force: true'), "rendered album pages still force a network refresh");
expect(!telemetry.includes("navigator.sendBeacon"), "cross-origin telemetry still uses sendBeacon");
expect(!telemetry.includes("navigator.userAgent"), "full user-agent is still transmitted");
expect(!telemetry.includes("local_time:"), "local time is still transmitted");
expect(telemetry.includes("session_id: createSessionId()"), "session telemetry lacks its random retry-deduplication identifier");
expect(scripts.includes('window.location.origin === "https://infra-180.github.io"'), "telemetry is not restricted to the official origin client-side");
expect(scripts.includes('https://infra180-api.pages.dev'), "runtime does not use the neutral API hostname");
expect(scripts.includes('const AUDIO_BASE = "https://infra180-api.pages.dev/audio"'), "audio runtime does not use the Worker R2 proxy");
expect(!scripts.includes('.r2.dev'), "audio runtime still uses the non-production r2.dev endpoint");
expect(sw.includes('const AUDIO_PROXY_HOST = "infra180-api.pages.dev"'), "Service Worker does not recognize the audio proxy host");
expect(sw.includes('const AUDIO_PROXY_PATH_PREFIX = "/audio/assets/music/streams/"'), "Service Worker audio proxy scope is too broad or missing");
expect(sphragis.includes('https://infra180-api.pages.dev'), "Sphragis does not use the neutral API hostname");
expect(!scripts.includes('workers.dev'), "a Workers account hostname remains in the runtime");
expect(!sphragis.includes('workers.dev'), "a Workers account hostname remains in Sphragis");
expect(sw.includes('sphragis.js?v=sphragis20260716'), "Service Worker still caches the pre-migration Sphragis asset key");
expect(sphragisPage.includes('sphragis.js?v=sphragis20260716'), "Sphragis page still loads the pre-migration asset key");
expect(!telemetry.includes('"cover_prepare_item"'), "cover loading still floods remote audio telemetry");
expect(sw.includes("htmlCacheFirst(request, SHELL_CACHE"), "PWA navigation is not shell cache-first");
expect(sw.includes("precacheAlbumDocuments(cache)"), "album documents are not installed with the PWA shell");
expect(sw.includes('cache: "reload"'), "album installation may reuse stale HTTP documents");
expect(sw.includes("Promise.all([cacheNext(), cacheNext(), cacheNext()])"), "album document installation is not bounded to three lanes");
const albumPageManifest = sw.match(/const ALBUM_PAGES = \[([\s\S]*?)\];/);
expect(Boolean(albumPageManifest), "Service Worker album document manifest is missing");
const installedAlbumPages = albumPageManifest
  ? Array.from(albumPageManifest[1].matchAll(/\.\/music\/[^"']+-infra\.html/g), (match) => match[0])
  : [];
expect(installedAlbumPages.length === 31, `expected 31 installed album documents, found ${installedAlbumPages.length}`);
expect(sw.includes("event.respondWith(htmlCacheFirst(request, SHELL_CACHE));"), "SPA HTML fetches remain network-first");
const htmlCacheFirstBody = functionBody(sw, "htmlCacheFirst", "staleWhileRevalidate");
expect(htmlCacheFirstBody.indexOf("if (cached)") < htmlCacheFirstBody.indexOf("fetch(request)"), "a shell hit still starts a background HTML fetch");
expect(sw.includes("HTML_NETWORK_INFLIGHT"), "Service Worker HTML cache misses are not deduplicated");
expect(sw.includes('headers.set("X-Infra-SW-Version", VERSION)'), "HTML responses do not identify the active Service Worker");
expect(sw.includes('headers.set("X-Infra-HTML-Cache"'), "HTML responses do not identify cache hits");
expect(scripts.includes("maybeActivateWaitingServiceWorker(registration"), "a safe idle client cannot activate its waiting Service Worker");
expect(scripts.includes("state.audioPlaying || state.trackStarting || state.overlayOpen || state.navigationActive"), "waiting Worker activation can interrupt playback or navigation");
expect(!scripts.includes("showPwaCoverHold(link, coverPlaceholderSrc);"), "album taps still display a foreground cover clone before navigation is ready");
expect(scripts.includes('releasePwaCoverHold("replace");'), "album taps do not clear a stale transition visual");
expect(catalogLoader.includes("readCachedLiveCatalogLatest()"), "validated live CacheStorage is not consulted at startup");
expect(catalogLoader.includes('catalogState.catalogBundleSource = cachedLive ? "live-cache" : "local"'), "catalogue startup does not preserve cached live releases");
expect(catalogLoader.includes("fetchLiveCatalogLatest().catch(function () {})"), "live catalogue refresh is not detached from startup");
expect(nowPlaying.includes('trackAudioRuntimeEvent("fullscreen_viewport"'), "iOS fullscreen viewport telemetry is missing");
expect(nowPlaying.includes("fullscreenViewportProbeSent"), "fullscreen viewport telemetry is not bounded per launch");
expect(telemetry.includes('"fullscreen_viewport"'), "fullscreen viewport telemetry is not journaled");
expect(!nowPlaying.includes("ios-standalone-viewport-gap"), "ineffective iOS viewport compensation is still active");
expect(!telemetry.includes('"fullscreen_compensated"'), "obsolete fullscreen compensation telemetry remains");

const cssHash = crypto.createHash("sha256").update(styles).digest("hex");
expect(cssHash === frozenCssSha256, "styles.css differs from the approved player appearance");
expect(!styles.includes("100lvh"), "forbidden 100lvh geometry was introduced");
expect(styles.includes(".share-dialog-close:focus-visible"), "QR close control does not keep the pure cross state");
expect(styles.includes("transform: translateZ(0) scale(1.002)"), "WebKit cover seam guard is missing");
expect(styles.includes("bottom: env(safe-area-inset-bottom);"), "mobile mini-player is not anchored exactly above the Home Indicator safe area");

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
  expect(source.includes(cssRelease), `${relativePath} does not reference ${cssRelease}`);
  expect(!source.includes("audiofix326-20260715"), `${relativePath} still references audiofix326 JavaScript`);
}

const albumCoverUrls = new Set();
for (const relativePath of ["public/index.html"].concat(
  fs.readdirSync(path.join(root, "public/music"))
    .filter((name) => name.endsWith(".html"))
    .map((name) => `public/music/${name}`)
)) {
  const source = read(relativePath);
  expect(!/cover-(?:480|900)\.webp/i.test(source), `${relativePath} still references a legacy cover variant`);
  expect(!/class="[^"]*(?:album-cover|\bcover\b)[^"]*"[^>]*\bsrcset=/i.test(source), `${relativePath} still selects multiple album cover files`);
  for (const match of source.matchAll(/assets\/music\/responsive\/([a-z0-9-]+-cover-1200\.webp)/gi)) {
    albumCoverUrls.add(match[1]);
  }
}
for (const fileName of albumCoverUrls) {
  expect(fs.existsSync(path.join(root, "public/assets/music/responsive", fileName)), `missing canonical cover ${fileName}`);
}
expect(albumCoverUrls.size >= 31, `expected at least 31 canonical album covers, found ${albumCoverUrls.size}`);

if (!process.exitCode) console.log("Audio stability checks passed for audiofix395.");
