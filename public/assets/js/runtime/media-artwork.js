// Pochettes Media Session, reprise après coupure, commandes système.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { audioState, coverApi, mediaSessionApi, runtime } from "../scripts.js";
import { callAudioRadio } from "./module-bridges.js";
import { mergeTrackMetadata } from "./catalog-playback.js";
import { isIosDevice } from "./theme-admin-pwa.js";
import { getCurrentAlbumTitle, getCurrentLogicalAudioSrc, getCurrentPlaylistTrack, normalizeAlbumTitle, normalizeTrackTitle, normalizeUrlAgainstBase, preloadImage, resolveCatalogAlbumArtwork, resolveTracksAlbumArtwork, srcMatches, toAbsoluteUrlOrEmpty } from "./audio-sources.js";
import { beginAudioRecovery, buildAudioMonitorPayload, failAudioRecovery, getAudioRuntimeProbeState } from "./audio-monitor.js";
import { cancelExternalResumeCommand, cancelSystemInterruptionResume, markAudioPauseIntent, playFromExternalControl, playNext, playPrevious, trackAudioRuntimeEvent } from "./playback.js";

function parseSrcsetCandidates(srcsetValue) {
  const raw = String(srcsetValue || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .map((entry) => {
      const pieces = entry.split(/\s+/).filter(Boolean);
      const src = String(pieces[0] || "").trim();
      const widthToken = String(pieces[1] || "").trim().toLowerCase();
      const width = widthToken.endsWith("w")
        ? Number.parseInt(widthToken.slice(0, -1), 10)
        : NaN;
      return {
        src,
        width: Number.isFinite(width) ? width : null
      };
    })
    .filter((item) => item.src);
}

function choosePreferredSrcsetSource(srcsetValue, targetWidth) {
  const candidates = parseSrcsetCandidates(srcsetValue);
  if (!candidates.length) return "";
  const target = Math.max(320, Number(targetWidth) || 900);

  const withWidth = candidates.filter((item) => Number.isFinite(item.width));
  if (!withWidth.length) return candidates[0].src;

  const preferred = withWidth
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs((left.width || target) - target);
      const rightDistance = Math.abs((right.width || target) - target);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return (right.width || 0) - (left.width || 0);
    })[0];
  return preferred ? preferred.src : candidates[0].src;
}

function getSourceFromSrcset(srcsetValue) {
  return choosePreferredSrcsetSource(srcsetValue, 900);
}

function getAlbumCoverFromDoc(docLike, baseUrl) {
  if (!docLike) return "";
  const cover = docLike.querySelector(".album-layout .cover, .cover");
  if (!cover) return "";
  const documentBaseURL = baseUrl || (docLike.URL || docLike.baseURI || window.location.href);
  const srcset = getSourceFromSrcset(cover.getAttribute("srcset") || "");
  const raw = String(
    srcset ||
    cover.getAttribute("src") ||
    cover.currentSrc ||
    ""
  ).trim();
  if (!raw) return "";
  return normalizeUrlAgainstBase(raw, documentBaseURL);
}

function inferImageMimeType(urlValue) {
  const normalized = String(urlValue || "")
    .split("#")[0]
    .split("?")[0]
    .toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function getMediaSessionFallbackArtwork() {
  return new URL("assets/pwa/icon-512-logo-white.png", runtime.baseUrl).href;
}

function getCoverUrlOptions(options) {
  return Object.assign({
    baseUrl: runtime.baseUrl.href,
    currentHref: window.location.href,
    currentOrigin: window.location.origin,
    fallbackArtwork: getMediaSessionFallbackArtwork(),
    toAbsoluteUrlOrEmpty,
    srcMatches
  }, options || {});
}

function normalizeArtworkUrl(coverPath) {
  if (coverApi && typeof coverApi.normalizeArtworkUrl === "function") {
    return coverApi.normalizeArtworkUrl(coverPath, getCoverUrlOptions());
  }

  return getMediaSessionFallbackArtwork();
}

function normalizeCoverUrl(coverPath, options) {
  if (coverApi && typeof coverApi.normalizeCoverUrl === "function") {
    return coverApi.normalizeCoverUrl(coverPath, getCoverUrlOptions(options));
  }

  return normalizeArtworkUrl(coverPath || "");
}

function resolveCoverUrl(item, options) {
  const opts = options || {};
  if (typeof item === "string") return normalizeCoverUrl(item, opts);

  const track = item || null;
  const enriched = mergeTrackMetadata(track);
  const candidates = [
    enriched && enriched.artwork ? enriched.artwork : "",
    resolveTracksAlbumArtwork(enriched || track),
    resolveCatalogAlbumArtwork(enriched || track),
    getAlbumCoverFromDoc(document, window.location.href)
  ];

  for (const candidate of candidates) {
    const resolved = normalizeCoverUrl(candidate, opts);
    if (resolved && !srcMatches(resolved, getMediaSessionFallbackArtwork())) return resolved;
  }

  return normalizeCoverUrl(getMediaSessionFallbackArtwork(), { responsive: false });
}

function getArtworkType(urlValue) {
  if (coverApi && typeof coverApi.getArtworkType === "function") {
    return coverApi.getArtworkType(urlValue);
  }
  return "image/png";
}

function inferArtworkSizeHint(urlValue) {
  if (coverApi && typeof coverApi.inferArtworkSizeHint === "function") {
    return coverApi.inferArtworkSizeHint(urlValue);
  }
  return "512x512";
}

function withMediaSessionArtworkVersion(urlValue, track) {
  return normalizeArtworkUrl(urlValue);
}

function getMediaSessionAlbumArtwork(artworkEntries) {
  const fallbackArtwork = getMediaSessionFallbackArtwork();
  return (Array.isArray(artworkEntries) ? artworkEntries : []).find(function (entry) {
    return Boolean(entry && entry.src && !srcMatches(entry.src, fallbackArtwork));
  }) || null;
}

function buildArtworkBlobAndSetMetadata(track, metadataArgs) {
  const artworkEntries = metadataArgs && Array.isArray(metadataArgs.artworkEntries)
    ? metadataArgs.artworkEntries
    : buildMediaSessionArtwork(track);
  const albumArtwork = getMediaSessionAlbumArtwork(artworkEntries);
  const metadataKey = String(metadataArgs && metadataArgs.key ? metadataArgs.key : "");

  function isCurrentMetadataRequest() {
    return !metadataKey || audioState.lastMediaSessionKey === metadataKey;
  }

  function commitMetadata() {
    if (!isCurrentMetadataRequest()) return;
    const artwork = artworkEntries.length
      ? artworkEntries
      : [{
          src: getMediaSessionFallbackArtwork(),
          sizes: "512x512",
          type: "image/png"
        }];
    if (mediaSessionApi && typeof mediaSessionApi.setMetadata === "function") {
      return mediaSessionApi.setMetadata({
        title: metadataArgs.title,
        artist: metadataArgs.artist,
        album: metadataArgs.album,
        artwork
      }) !== false;
    }
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: metadataArgs.title,
        artist: metadataArgs.artist,
        album: metadataArgs.album,
        artwork
      });
      return true;
    } catch (_err) {
      return false;
    }
  }

  // Keep the previous real album metadata while a new canonical cover is
  // unresolved. Preloading also warms the browser image cache before WebKit
  // hands the same URL to the lock-screen Media Session surface.
  if (!albumArtwork) return Promise.resolve(false);
  return preloadImage(albumArtwork.src, { highPriority: true }).then(function (result) {
    if (!isCurrentMetadataRequest()) return false;
    if (!result || !result.ok) {
      audioState.lastMediaSessionKey = "";
      return false;
    }
    const committed = commitMetadata();
    if (!committed && isCurrentMetadataRequest()) audioState.lastMediaSessionKey = "";
    return committed;
  });
}

function buildResponsiveCoverCandidate(urlValue, targetWidth) {
  if (coverApi && typeof coverApi.buildResponsiveCoverCandidate === "function") {
    return coverApi.buildResponsiveCoverCandidate(urlValue, targetWidth, getCoverUrlOptions());
  }

  return "";
}

function buildMediaSessionArtwork(track) {
  const fallbackArtwork = getMediaSessionFallbackArtwork();
  const canonicalArtwork = resolveCoverUrl(track || null, { width: 1200 }) || fallbackArtwork;
  const normalizedSrc = normalizeArtworkUrl(canonicalArtwork || fallbackArtwork);
  return [{
    src: withMediaSessionArtworkVersion(normalizedSrc, track),
    sizes: srcMatches(normalizedSrc, fallbackArtwork) ? "512x512" : inferArtworkSizeHint(normalizedSrc),
    type: getArtworkType(normalizedSrc)
  }];
}

function clearWaitingRecovery(options) {
  const opts = options || {};
  if (audioState.waitingRecoveryTimer) {
    clearTimeout(audioState.waitingRecoveryTimer);
    audioState.waitingRecoveryTimer = null;
  }
  if (!opts.preserveStallRecovery && audioState.stallRecovery) {
    const recovery = audioState.stallRecovery;
    if (recovery.audio && recovery.listener) {
      recovery.audio.removeEventListener("canplay", recovery.listener);
    }
    audioState.stallRecovery = null;
  }
  audioState.prefetchPausedUntil = 0;
}

function recoverPlaybackFromStall() {
  const audio = audioState.audio;
  if (!audio) return;
  if (audio.paused) return;
  // Do not reset the media element while an iOS startup is still settling.
  // Safari can emit waiting/stalled before the first real playback progress;
  // calling load() in that window aborts the user-initiated play request.
  if (!audioState.mediaSessionAudioPlaying) return;
  if (Number(audio.currentTime || 0) < 0.25) return;
  if (audioState.trackStartInFlight) return;
  if (audio.readyState >= 3) return;

  const src = getCurrentLogicalAudioSrc();
  if (!src) return;

  clearWaitingRecovery();
  const requestToken = audioState.startRequestToken;
  const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const resume = function () {
    if (audioState.stallRecovery !== recovery) return;
    audioState.stallRecovery = null;
    if (requestToken !== audioState.startRequestToken) return;
    if (!srcMatches(src, getCurrentLogicalAudioSrc())) return;
    if (Number.isFinite(resumeAt) && resumeAt > 0) {
      try {
        audio.currentTime = resumeAt;
      } catch (_err) {
        // Ignore seek restore errors.
      }
    }
    audio.play().catch(function () {
      failAudioRecovery({
        request_token: requestToken,
        reason: "stall_reload_play_rejected",
        strategy: "reload_current_source"
      });
    });
  };
  const recovery = { audio, listener: resume, requestToken, src };
  audioState.stallRecovery = recovery;
  audio.addEventListener("canplay", resume, { once: true });
  beginAudioRecovery({
    request_token: requestToken,
    reason: "midtrack_stall",
    strategy: "reload_current_source"
  });
  markAudioPauseIntent("source_reset", "stall_recovery");
  try {
    audio.load();
  } catch (_err) {
    clearWaitingRecovery();
    failAudioRecovery({
      request_token: requestToken,
      reason: "stall_reload_failed",
      strategy: "reload_current_source"
    });
  }
}

function scheduleWaitingRecovery() {
  const activeStallRecovery = audioState.stallRecovery;
  if (
    activeStallRecovery &&
    activeStallRecovery.requestToken === audioState.startRequestToken &&
    srcMatches(activeStallRecovery.src, getCurrentLogicalAudioSrc())
  ) {
    return;
  }
  clearWaitingRecovery();
  const audio = audioState.audio;
  if (!audio || audio.paused) return;
  // Startup waiting/stalled is passive. Recovery is reserved for a track
  // that has already emitted playing and made measurable progress.
  if (!audioState.mediaSessionAudioPlaying) return;
  if (Number(audio.currentTime || 0) < 0.25) return;
  audioState.prefetchPausedUntil = Date.now() + (isIosDevice() ? 2600 : 1600);
  audioState.waitingRecoveryTimer = setTimeout(function () {
    audioState.waitingRecoveryTimer = null;
    recoverPlaybackFromStall();
  }, 700);
}

function isIOSStandaloneMediaSession() {
  if (mediaSessionApi && typeof mediaSessionApi.isIOSStandalone === "function") {
    return mediaSessionApi.isIOSStandalone();
  }
  const ua = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  const standaloneDisplay = typeof window.matchMedia === "function"
    ? window.matchMedia("(display-mode: standalone)").matches
    : false;
  const legacyStandalone = window.navigator.standalone === true;
  return Boolean(isIOS && (legacyStandalone || standaloneDisplay));
}

function configurePlaybackAudioSession() {
  if (!mediaSessionApi || typeof mediaSessionApi.configurePlaybackAudioSession !== "function") {
    return false;
  }
  return mediaSessionApi.configurePlaybackAudioSession();
}

function initAudioSessionTelemetry() {
  if (audioState.audioSessionTelemetryBound) return;
  const audioSession = navigator && navigator.audioSession ? navigator.audioSession : null;
  if (!audioSession || typeof audioSession.addEventListener !== "function") return;
  audioState.audioSessionTelemetryBound = true;

  const reportState = function (trigger) {
    const now = Date.now();
    const previousState = String(audioState.audioSessionLastState || "");
    const currentState = String(audioSession.state || "unknown");
    audioState.audioSessionLastState = currentState;
    if (currentState === "interrupted") {
      audioState.audioSessionInterruptedAt = now;
      audioState.audioSessionResumeAllowedUntil = 0;
    } else if (
      currentState === "active" &&
      Number.isFinite(audioState.audioSessionInterruptedAt) &&
      audioState.audioSessionInterruptedAt > 0 &&
      now - audioState.audioSessionInterruptedAt <= 4 * 60 * 60 * 1000
    ) {
      // The Audio Session spec resumes interrupted HTMLMediaElements when the
      // session becomes active again. Give that exact system play event a
      // short window through the hidden auto-resume guard.
      audioState.audioSessionResumeAllowedUntil = now + 8000;
      callAudioRadio("scheduleSystemInterruptionResumeAfterActive", [trigger || "statechange"]);
    } else if (currentState !== "active") {
      audioState.audioSessionResumeAllowedUntil = 0;
    }
    trackAudioRuntimeEvent("audio_session_state", {
      trigger: trigger || "statechange",
      audio_session_state: currentState,
      audio_session_type: String(audioSession.type || "auto"),
      reason: previousState ? `${previousState}->${currentState}` : "initial"
    });
  };

  audioSession.addEventListener("statechange", function () {
    reportState("statechange");
  });
  reportState("init");
}

function createScriptMediaCommand(action, surface, audio) {
  audioState.mediaCommandSequence = Number(audioState.mediaCommandSequence || 0) + 1;
  return {
    id: `cmd-${String(action || "media")}-${Date.now().toString(36)}-${audioState.mediaCommandSequence}`,
    sequence: audioState.mediaCommandSequence,
    action: String(action || ""),
    surface: String(surface || "media_session"),
    at: Date.now(),
    beforePaused: Boolean(audio && audio.paused),
    beforeCurrentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
  };
}

function emitScriptMediaCommand(command, details) {
  if (!command || !command.id) return;
  const audio = audioState.audio;
  const visibility = String(document.visibilityState || "");
  const surfaceHint = command.surface === "media_session"
    ? (visibility === "hidden" ? "remote_hidden" : (visibility === "visible" ? "remote_visible" : "remote_unknown"))
    : command.surface;
  trackAudioRuntimeEvent("media_command", Object.assign(
    buildAudioMonitorPayload(
      getCurrentPlaylistTrack(),
      audioState.currentIndex,
      audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || ""
    ),
    {
      command_token: command.id,
      command_sequence: command.sequence,
      action: command.action,
      origin: command.surface === "media_session" ? "media_session" : "transport",
      surface: command.surface,
      surface_hint: surfaceHint,
      before_paused: command.beforePaused,
      before_current_time: command.beforeCurrentTime,
      after_paused: Boolean(audio && audio.paused),
      after_current_time: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      from_index: Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1,
      to_index: Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1,
      command_latency_ms: Math.max(0, Date.now() - command.at)
    },
    details || {}
  ));
}

function bindMediaSessionActions(options) {
  const opts = options || {};
  if (audioState.mediaSessionBound && !opts.force) return;
  if (mediaSessionApi && typeof mediaSessionApi.isAvailable === "function") {
    if (!mediaSessionApi.isAvailable()) return;
  } else if (!("mediaSession" in navigator)) return;

  const actionResults = {};
  function safeSet(action, handler) {
    if (mediaSessionApi && typeof mediaSessionApi.setActionHandler === "function") {
      const registered = mediaSessionApi.setActionHandler(action, handler) !== false;
      actionResults[action] = registered && handler === null ? "cleared" : registered;
      return registered;
    }
    try {
      navigator.mediaSession.setActionHandler(action, handler);
      actionResults[action] = handler === null ? "cleared" : true;
      return true;
    } catch (_err) {
      // Ignore unsupported action handlers.
      actionResults[action] = false;
      return false;
    }
  }

  const iosStandalone = isIOSStandaloneMediaSession();
  const registeredActions = ["play", "pause"];

  safeSet("play", function () {
    playFromExternalControl("media_session");
  });
  safeSet("pause", function () {
    const audio = audioState.audio;
    if (!audio) return;
    const command = createScriptMediaCommand("pause", "media_session", audio);
    const pauseIntentReason = audioState.systemInterruptionGuard ||
      String(audioState.audioSessionLastState || "") === "interrupted"
      ? "system_interruption"
      : "explicit_remote";
    if (pauseIntentReason === "explicit_remote") cancelSystemInterruptionResume("media_session");
    cancelExternalResumeCommand();
    trackAudioRuntimeEvent("media_session_pause", Object.assign(
      buildAudioMonitorPayload(
        getCurrentPlaylistTrack(),
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src
      ),
      getAudioRuntimeProbeState(),
      { surface: "media_session" }
    ));
    if (!audio.paused) {
      markAudioPauseIntent(
        pauseIntentReason === "system_interruption" ? "system_suspected" : "media_session",
        "media_session"
      );
      audio.pause();
      emitScriptMediaCommand(command, {
        decision: "pause",
        outcome: "success",
        intent_reason: pauseIntentReason
      });
    } else {
      emitScriptMediaCommand(command, {
        decision: "pause",
        outcome: "noop",
        reason: "already_paused",
        intent_reason: pauseIntentReason
      });
    }
  });

  function applyMediaSessionSeek(nextTime, actionName) {
    const audio = audioState.audio;
    if (!audio || !Number.isFinite(nextTime)) return;
    const command = createScriptMediaCommand(actionName, "media_session", audio);
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity;
    const clamped = Math.max(0, Math.min(duration, nextTime));
    const previous = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    try {
      audio.currentTime = clamped;
      syncMediaSessionMetadata({ forcePosition: true });
      trackAudioRuntimeEvent("seek", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          source: "media_session",
          action: actionName,
          from_ms: Math.floor(previous * 1000),
          to_ms: Math.floor(clamped * 1000)
        }
      ));
      emitScriptMediaCommand(command, {
        decision: "seek",
        outcome: "success",
        from_ms: Math.floor(previous * 1000),
        to_ms: Math.floor(clamped * 1000)
      });
    } catch (_err) {
      emitScriptMediaCommand(command, {
        decision: "seek",
        outcome: "rejected",
        reason: "seek_assignment_failed",
        from_ms: Math.floor(previous * 1000),
        to_ms: Math.floor(clamped * 1000)
      });
    }
  }

  registeredActions.push("seekto");
  safeSet("seekto", function (event) {
    if (!event || !Number.isFinite(event.seekTime)) return;
    applyMediaSessionSeek(event.seekTime, "seekto");
  });

  if (iosStandalone) {
    // Keep direct timeline scrubbing through seekto, but explicitly remove
    // the +/- 10-second actions so WebKit exposes playlist Previous/Next.
    safeSet("seekbackward", null);
    safeSet("seekforward", null);
  } else {
    registeredActions.push("seekbackward", "seekforward");
    safeSet("seekbackward", function (event) {
      const audio = audioState.audio;
      if (!audio) return;
      const offset = event && Number.isFinite(event.seekOffset) ? event.seekOffset : 10;
      applyMediaSessionSeek((audio.currentTime || 0) - offset, "seekbackward");
    });
    safeSet("seekforward", function (event) {
      const audio = audioState.audio;
      if (!audio) return;
      const offset = event && Number.isFinite(event.seekOffset) ? event.seekOffset : 10;
      applyMediaSessionSeek((audio.currentTime || 0) + offset, "seekforward");
    });
  }

  registeredActions.push("previoustrack", "nexttrack");
  safeSet("previoustrack", function () {
    console.info("[INFRA] mediaSession previoustrack");
    playPrevious({ seamless: true, fromMediaSession: true });
  });
  safeSet("nexttrack", function () {
    console.info("[INFRA] mediaSession nexttrack");
    playNext({ seamless: true, fromMediaSession: true });
  });

  const supportedActions = Object.keys(actionResults).filter(function (action) { return actionResults[action] === true; });
  const unsupportedActions = Object.keys(actionResults).filter(function (action) { return actionResults[action] === false; });
  const clearedActions = Object.keys(actionResults).filter(function (action) { return actionResults[action] === "cleared"; });
  trackAudioRuntimeEvent("media_capabilities", {
    track: "media-session",
    album: "session",
    source: "capabilities",
    supported_actions: supportedActions.join(","),
    unsupported_actions: unsupportedActions.join(","),
    cleared_actions: clearedActions.join(","),
    registration_result: unsupportedActions.length ? "partial" : "complete",
    handler_play: Boolean(actionResults.play),
    handler_pause: Boolean(actionResults.pause),
    handler_previous: Boolean(actionResults.previoustrack),
    handler_next: Boolean(actionResults.nexttrack),
    handler_seekto: Boolean(actionResults.seekto),
    surface_hint: document.visibilityState === "hidden" ? "remote_hidden" : "remote_visible"
  });

  if (!opts.quiet) {
    console.info(
      "[INFRA] mediaSession handlers",
      `isIOSStandalone=${iosStandalone ? "true" : "false"}`,
      `actions=${registeredActions.join(",")}`
    );
  }

  audioState.mediaSessionBound = true;
}

function syncMediaSessionMetadata(options) {
  if (mediaSessionApi && typeof mediaSessionApi.hasMetadataSupport === "function") {
    if (!mediaSessionApi.hasMetadataSupport()) return;
  } else if (!("mediaSession" in navigator) || typeof window.MediaMetadata !== "function") return;
  const opts = options || {};

  const audio = audioState.audio;
  const track = getCurrentPlaylistTrack();
  const title = normalizeTrackTitle(track && track.name ? track.name : "") || "INFRA.";
  const album = normalizeAlbumTitle(
    track && track.album
      ? track.album
      : getCurrentAlbumTitle()
  ) || "INFRA.";
  const artist = String(track && track.artist ? track.artist : "INFRA.").trim() || "INFRA.";
  const artworkEntries = buildMediaSessionArtwork(track);
  const hasAlbumArtwork = Boolean(getMediaSessionAlbumArtwork(artworkEntries));
  const artworkKey = artworkEntries.map((item) => item.src).join(",");
  const key = [title, album, artist, artworkKey].join("|");

  const mediaSessionActuallyPlaying = Boolean(audio && audioState.mediaSessionAudioPlaying && !audio.paused);
  if (mediaSessionApi && typeof mediaSessionApi.setPlaybackState === "function") {
    mediaSessionApi.setPlaybackState(mediaSessionActuallyPlaying ? "playing" : "paused");
  } else {
    try {
      navigator.mediaSession.playbackState = mediaSessionActuallyPlaying ? "playing" : "paused";
    } catch (_err) {}
  }

  if (hasAlbumArtwork && key !== audioState.lastMediaSessionKey) {
    audioState.lastMediaSessionKey = key;
    console.info(
      "[INFRA] media metadata",
      `title=${title}`,
      `artwork=${artworkEntries[0] && artworkEntries[0].src ? artworkEntries[0].src : ""}`
    );
    try {
      buildArtworkBlobAndSetMetadata(track, { title, artist, album, key, artworkEntries });
    } catch (_err) {
      // Ignore metadata errors.
    }
  }

  if (audio && typeof navigator.mediaSession.setPositionState === "function") {
    const now = Date.now();
    const shouldSyncPosition = Boolean(opts.forcePosition) || !audioState.mediaSessionPositionTs || (now - audioState.mediaSessionPositionTs >= 900);
    if (!shouldSyncPosition) return;

    const duration = !audioState.sourceMetadataPending && Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 0;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const playbackRate = mediaSessionActuallyPlaying && Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1;
    try {
      if (duration > 0) {
        const positionState = {
          duration,
          position: Math.max(0, Math.min(duration, position)),
          playbackRate
        };
        if (mediaSessionApi && typeof mediaSessionApi.setPositionState === "function") {
          mediaSessionApi.setPositionState(positionState);
        } else {
          navigator.mediaSession.setPositionState(positionState);
        }
        audioState.mediaSessionPositionTs = now;
      }
    } catch (_err) {
      // Ignore position state errors.
    }
  }
}

function scheduleMediaSessionResync(requestToken) {
  if (audioState.mediaSessionResyncTimer) {
    clearTimeout(audioState.mediaSessionResyncTimer);
    audioState.mediaSessionResyncTimer = null;
  }
  audioState.mediaSessionResyncTimer = setTimeout(function () {
    audioState.mediaSessionResyncTimer = null;
    if (requestToken !== audioState.startRequestToken) return;
    syncMediaSessionMetadata({ forcePosition: true });
  }, 300);
}

export { parseSrcsetCandidates, choosePreferredSrcsetSource, getSourceFromSrcset, getAlbumCoverFromDoc, inferImageMimeType, getMediaSessionFallbackArtwork, getCoverUrlOptions, normalizeArtworkUrl, normalizeCoverUrl, resolveCoverUrl, getArtworkType, inferArtworkSizeHint, withMediaSessionArtworkVersion, getMediaSessionAlbumArtwork, buildArtworkBlobAndSetMetadata, buildResponsiveCoverCandidate, buildMediaSessionArtwork, clearWaitingRecovery, recoverPlaybackFromStall, scheduleWaitingRecovery, isIOSStandaloneMediaSession, configurePlaybackAudioSession, initAudioSessionTelemetry, createScriptMediaCommand, emitScriptMediaCommand, bindMediaSessionActions, syncMediaSessionMetadata, scheduleMediaSessionResync };
