// Lecture : fondus, progression, commandes.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { audioCoreApi, audioState, audioTelemetryApi } from "../scripts.js";
import { callAudioRadio, syncTransportMiniUi } from "./module-bridges.js";
import { isIosDevice } from "./theme-admin-pwa.js";
import {
  getCurrentAlbumTitle,
  getCurrentLogicalAudioSrc,
  getCurrentPlaylistTrack,
  resolveCatalogAlbumArtwork,
  resolveTracksAlbumArtwork,
  srcMatches,
  toAbsoluteUrlOrEmpty
} from "./audio-sources.js";
import {
  getAlbumCoverFromDoc,
  getMediaSessionFallbackArtwork,
  normalizeArtworkUrl
} from "./media-artwork.js";
import { buildAudioMonitorPayload } from "./audio-monitor.js";

function trackAudioRuntimeEvent(type, data) {
  audioTelemetryApi.trackRuntimeEvent(type, data);
}

function sendAudioMonitoringLog(track, index, src, data) {
  audioTelemetryApi.sendMonitoringLog(track, index, src, data);
}

function logAudioAuditEvent(type, track, index, src, data) {
  audioTelemetryApi.logAuditEvent(type, track, index, src, data);
}

function getCoverTelemetrySource(coverUrl, track) {
  const url = toAbsoluteUrlOrEmpty(coverUrl || "");
  if (!url) return "unknown";
  if (srcMatches(url, getMediaSessionFallbackArtwork())) return "fallback";
  const tracksArtwork = resolveTracksAlbumArtwork(track || null);
  if (tracksArtwork && srcMatches(url, normalizeArtworkUrl(tracksArtwork))) return "tracks.json";
  const catalogArtwork = resolveCatalogAlbumArtwork(track || null);
  if (catalogArtwork && srcMatches(url, normalizeArtworkUrl(catalogArtwork))) return "catalog";
  const domArtwork = getAlbumCoverFromDoc(document, window.location.href);
  if (domArtwork && srcMatches(url, domArtwork)) return "DOM";
  return /\/assets\/music\//i.test(url) ? "DOM" : "fallback";
}

function getAlbumNameFromUrlLike(urlLike) {
  try {
    const path = new URL(String(urlLike || ""), window.location.href).pathname.toLowerCase();
    if (path.includes("/kali-infra")) return "KALI";
    const fileName = decodeURIComponent((path.split("/").pop() || "").replace(/\.html$/i, ""));
    const slug = fileName.replace(/-infra$/i, "");
    if (slug) return slug.replace(/-/g, " ").toUpperCase();
  } catch (_err) {
    // Ignore URL parsing failures.
  }
  return "";
}

function logAudioRuntimeAlbumSwitch(context, cached) {
  if (!context || !context.startedAt) return;
  const track = getCurrentPlaylistTrack();
  trackAudioRuntimeEvent(
    "album_switch",
    Object.assign(buildAudioMonitorPayload(track, audioState.currentIndex, getCurrentLogicalAudioSrc()), {
      from_album: context.fromAlbum || "",
      to_album: getCurrentAlbumTitle() || document.title || "",
      from_url: context.fromUrl || "",
      to_url: context.toUrl || "",
      delay_ms: Date.now() - context.startedAt,
      cached: Boolean(cached)
    })
  );
}

function clearFadeTimer() {
  if (audioState.fadeTimer) {
    clearInterval(audioState.fadeTimer);
    audioState.fadeTimer = null;
  }
  if (audioState.fadeResolve) {
    const resolve = audioState.fadeResolve;
    audioState.fadeResolve = null;
    resolve(false);
  }
}

function fadeInAudio(audio, durationMs) {
  if (!audio) return;
  if (isIosDevice()) {
    try {
      audio.volume = 1;
    } catch (_e) {
      // iOS Safari may ignore media volume changes.
    }
    return;
  }
  clearFadeTimer();

  const duration = Math.max(90, Number(durationMs) || 120);
  const steps = 6;
  const stepMs = Math.max(16, Math.round(duration / steps));
  let step = 0;

  try {
    audio.volume = 0;
  } catch (_err) {
    return;
  }

  audioState.fadeTimer = setInterval(function () {
    step += 1;
    const nextVolume = Math.min(1, step / steps);
    try {
      audio.volume = nextVolume;
    } catch (_err) {
      clearFadeTimer();
      return;
    }
    if (step >= steps || audio.paused) {
      clearFadeTimer();
      try {
        audio.volume = 1;
      } catch (_err) {
        // iOS Safari may ignore media volume changes.
      }
    }
  }, stepMs);
}

function forceAudioFullVolume(audio) {
  clearFadeTimer();
  if (!audio) return;
  try {
    audio.volume = 1;
  } catch (_err) {
    // iOS Safari may ignore media volume changes.
  }
}

function fadeOutAudio(audio, durationMs, requestToken) {
  return new Promise(function (resolve) {
    if (!audio || requestToken !== audioState.startRequestToken) {
      resolve(false);
      return;
    }
    if (isIosDevice()) {
      try {
        audio.volume = 1;
      } catch (_e) {
        // iOS Safari may ignore media volume changes.
      }
      resolve(true);
      return;
    }

    clearFadeTimer();

    const duration = Math.max(80, Number(durationMs) || 100);
    const steps = 6;
    const stepMs = Math.max(16, Math.round(duration / steps));
    let step = 0;
    let startVolume = 1;

    try {
      startVolume = Number.isFinite(audio.volume) ? audio.volume : 1;
    } catch (_err) {
      startVolume = 1;
    }

    function finish(result) {
      if (audioState.fadeTimer) {
        clearInterval(audioState.fadeTimer);
        audioState.fadeTimer = null;
      }
      audioState.fadeResolve = null;
      resolve(Boolean(result));
    }

    audioState.fadeResolve = finish;
    audioState.fadeTimer = setInterval(function () {
      if (requestToken !== audioState.startRequestToken) {
        finish(false);
        return;
      }

      step += 1;
      const nextVolume = Math.max(0, startVolume * (1 - step / steps));
      try {
        audio.volume = nextVolume;
      } catch (_err) {
        // iOS Safari may ignore media volume changes; keep the track switch moving.
      }

      if (step >= steps) {
        finish(true);
      }
    }, stepMs);
  });
}

function ensureGlobalAudio() {
  return callAudioRadio("ensureGlobalAudio", arguments);
}

function stopAudioRaf() {
  return callAudioRadio("stopAudioRaf", arguments);
}

function startAudioRaf() {
  return callAudioRadio("startAudioRaf", arguments);
}

function updateProgressUi() {
  const audio = audioState.audio;
  if (!audio) return;

  syncTransportMiniUi();

  const ui = audioState.ui;
  if (!ui) return;

  const src = getCurrentLogicalAudioSrc();
  const index = ui.tracks.findIndex((track) => srcMatches(track.src, src));
  if (index < 0) return;

  const track = ui.tracks[index];
  if (!track.fill) return;

  if (!audio.duration || !Number.isFinite(audio.duration) || audio.duration <= 0) {
    track.fill.style.width = "0%";
    return;
  }

  const percent = (audio.currentTime / audio.duration) * 100;
  track.fill.style.width = Math.max(0, Math.min(100, percent)) + "%";
}

function saveResumeState() {
  return callAudioRadio("saveResumeState", arguments);
}

function restoreResumeState() {
  return callAudioRadio("restoreResumeState", arguments);
}

function ensurePlayablePlaylistContext() {
  return callAudioRadio("ensurePlayablePlaylistContext", arguments);
}

function markAudioPauseIntent() {
  return callAudioRadio("markAudioPauseIntent", arguments);
}

function cancelSystemInterruptionResume() {
  return callAudioRadio("cancelSystemInterruptionResume", arguments);
}

function cancelExternalResumeCommand() {
  return callAudioRadio("cancelExternalResumeCommand", arguments);
}

function syncPlaylistContext(list, options) {
  return audioCoreApi.syncPlaylistContext(list, options);
}

function ensureCurrentIndexFromAudio() {
  return audioCoreApi.ensureCurrentIndexFromAudio();
}

function getCurrentPlaylistIndexSafe() {
  return audioCoreApi.getCurrentPlaylistIndexSafe();
}

function getQueuePreviewIndices(limit) {
  return audioCoreApi.getQueuePreviewIndices(limit);
}

function resetAudioElementForSource(audio, srcLike) {
  return audioCoreApi.resetAudioElementForSource(audio, srcLike);
}

function recoverFromTrackFailure(index, srcLike, requestToken) {
  return audioCoreApi.recoverFromTrackFailure(index, srcLike, requestToken);
}

function getRandomIndex(exceptIndex) {
  return audioCoreApi.getRandomIndex(exceptIndex);
}

function startTrack(index, options) {
  return audioCoreApi.startTrack(index, options);
}

function playNext(options) {
  return audioCoreApi.playNext(options);
}

function playPrevious(options) {
  return audioCoreApi.playPrevious(options);
}

function movePlaylistItem(fromIndex, toIndex, options) {
  return audioCoreApi.movePlaylistItem(fromIndex, toIndex, options);
}

function startRadioPlaybackFromIdle() {
  return audioCoreApi.startRadioPlaybackFromIdle();
}

function togglePlayPause() {
  return audioCoreApi.togglePlayPause();
}

function playFromExternalControl() {
  return callAudioRadio("playFromExternalControl", arguments);
}

function handleGlobalTransportToggle() {
  return callAudioRadio("handleGlobalTransportToggle", arguments);
}

function toggleCurrentPageCollection() {
  return callAudioRadio("toggleCurrentPageCollection", arguments);
}

export {
  trackAudioRuntimeEvent,
  sendAudioMonitoringLog,
  logAudioAuditEvent,
  getCoverTelemetrySource,
  getAlbumNameFromUrlLike,
  logAudioRuntimeAlbumSwitch,
  clearFadeTimer,
  fadeInAudio,
  forceAudioFullVolume,
  fadeOutAudio,
  ensureGlobalAudio,
  stopAudioRaf,
  startAudioRaf,
  updateProgressUi,
  saveResumeState,
  restoreResumeState,
  ensurePlayablePlaylistContext,
  markAudioPauseIntent,
  cancelSystemInterruptionResume,
  cancelExternalResumeCommand,
  syncPlaylistContext,
  ensureCurrentIndexFromAudio,
  getCurrentPlaylistIndexSafe,
  getQueuePreviewIndices,
  resetAudioElementForSource,
  recoverFromTrackFailure,
  getRandomIndex,
  startTrack,
  playNext,
  playPrevious,
  movePlaylistItem,
  startRadioPlaybackFromIdle,
  togglePlayPause,
  playFromExternalControl,
  handleGlobalTransportToggle,
  toggleCurrentPageCollection
};
