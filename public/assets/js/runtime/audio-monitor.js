// Surveillance audio, reprise, préchargement du titre suivant.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { AUDIO_BASE, audioState, audioTelemetryApi } from "../scripts.js";
import { callAudioRadio } from "./module-bridges.js";
import { getAudioAssetPath, getCurrentAlbumTitle, getCurrentLogicalAudioSrc, getCurrentPlaylistTrack, normalizeAlbumTitle, normalizeAudioSourceUrl } from "./audio-sources.js";
import { clearWaitingRecovery } from "./media-artwork.js";
import { trackAudioRuntimeEvent } from "./playback.js";

function isManagedAudioUrl(urlValue) {
  let parsed = null;
  try {
    parsed = new URL(String(urlValue || ""), window.location.href);
  } catch (_err) {
    return false;
  }
  const audioBaseOrigin = AUDIO_BASE ? new URL(AUDIO_BASE).origin : "";
  if (parsed.origin !== window.location.origin && parsed.origin !== audioBaseOrigin) return false;
  return /\.(?:mp3|m4a|aac|wav|flac|ogg)$/i.test(parsed.pathname);
}

function isCloudflareAudioUrl(urlValue) {
  if (!AUDIO_BASE) return false;
  try {
    return new URL(String(urlValue || ""), window.location.href).origin === new URL(AUDIO_BASE).origin;
  } catch (_err) {
    return false;
  }
}

function getAudioSource(resolvedUrl) {
  const raw = String(resolvedUrl || "").trim();
  if (!raw) return "github";
  if (isCloudflareAudioUrl(raw) || /\.r2\.dev(?:\/|$)/i.test(raw)) return "r2dev";
  try {
    const parsed = new URL(raw, window.location.href);
    if (parsed.origin === window.location.origin) return "github";
    return "other";
  } catch (_err) {
    return "github";
  }
}

function getAudioMonitorTrackLabel(track, index) {
  const title = track && track.name ? String(track.name).trim() : "";
  if (title) return title;
  const src = track && track.src ? String(track.src).split("/").pop() : "";
  if (src) return src;
  return Number.isInteger(index) && index >= 0 ? `track-${index + 1}` : "unknown";
}

function buildAudioMonitorPayload(track, index, src) {
  const resolvedSrc = src || (track && track.src ? track.src : getCurrentLogicalAudioSrc());
  const trackPath = getAudioAssetPath(resolvedSrc || (track && track.src ? track.src : ""), window.location.href);
  return {
    track: getAudioMonitorTrackLabel(track, index),
    album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
    track_path: trackPath,
    source: getAudioSource(resolvedSrc),
    src: resolvedSrc || ""
  };
}

async function probeAudioSourceForRecovery(srcLike, details) {
  const source = normalizeAudioSourceUrl(srcLike || "");
  const context = details && typeof details === "object" ? details : {};
  const requestToken = Number(context.request_token) || audioState.startRequestToken;
  const monitorPayload = context.monitor_payload && typeof context.monitor_payload === "object"
    ? context.monitor_payload
    : buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, source);
  const startedAt = Date.now();
  let responseStatus = 0;
  let responseBytes = 0;
  let rangeStart = null;
  let rangeEnd = null;
  let branch = "probe_unavailable";
  let result = "network_error";
  let errorName = "";

  try {
    if (!source || typeof fetch !== "function") throw new Error("audio_probe_unavailable");
    const response = await fetch(source, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { "Range": "bytes=0-1" }
    });
    responseStatus = Number(response.status) || 0;
    const contentRange = String(response.headers.get("Content-Range") || "");
    const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
    const rangeMatch = contentRange.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    rangeStart = rangeMatch ? Number(rangeMatch[1]) : null;
    rangeEnd = rangeMatch ? Number(rangeMatch[2]) : null;
    const validRange = Boolean(
      responseStatus === 206 &&
      rangeMatch &&
      rangeStart === 0 &&
      rangeEnd === 1 &&
      Number(rangeMatch[3]) > 1
    );
    const validType = /^audio\/(?:mp4|mpeg|aac|x-m4a)\b/i.test(contentType);
    let validBody = false;
    if (response.ok && validRange && validType) {
      const body = await response.arrayBuffer();
      responseBytes = body ? body.byteLength : 0;
      validBody = responseBytes === 2;
    } else if (response.body && typeof response.body.cancel === "function") {
      try {
        await response.body.cancel();
      } catch (_err) {
        // Invalid headers already make the probe fail; body cleanup is best-effort.
      }
    }
    if (!response.ok) branch = "http_error";
    else if (!validRange) branch = "range_invalid";
    else if (!validType) branch = "type_invalid";
    else if (!validBody) branch = "body_invalid";
    else branch = "range_ok";
    result = branch === "range_ok" ? "ok" : "invalid_response";

    const payload = Object.assign(
      {},
      monitorPayload,
      {
        request_token: requestToken,
        reason: context.reason || "playback_recovery",
        strategy: "range_probe_no_store",
        branch,
        result,
        status: responseStatus,
        response_ms: Math.max(0, Date.now() - startedAt),
        range: true,
        range_start: rangeStart,
        range_end: rangeEnd,
        bytes: responseBytes,
        cached: false,
        cache_hint: "network_no_store",
        audio_fetch: true
      }
    );
    trackAudioRuntimeEvent("audio_network_result", payload);
    return {
      ok: result === "ok",
      result,
      reason: branch,
      status: responseStatus,
      bytes: responseBytes,
      range_start: rangeStart,
      range_end: rangeEnd
    };
  } catch (error) {
    errorName = error && error.name ? error.name : "Error";
    branch = error && error.message === "audio_probe_unavailable" ? "probe_unavailable" : "fetch_rejected";
    trackAudioRuntimeEvent("audio_network_result", Object.assign(
      {},
      monitorPayload,
      {
        request_token: requestToken,
        reason: context.reason || "playback_recovery",
        strategy: "range_probe_no_store",
        branch,
        result: "network_error",
        error_name: errorName,
        status: responseStatus,
        response_ms: Math.max(0, Date.now() - startedAt),
        range: true,
        range_start: rangeStart,
        range_end: rangeEnd,
        bytes: responseBytes,
        cached: false,
        cache_hint: "network_no_store",
        audio_fetch: true
      }
    ));
    return {
      ok: false,
      result: "network_error",
      reason: branch,
      error_name: errorName,
      status: responseStatus
    };
  }
}

function getAudioRuntimeProbeState() {
  return audioTelemetryApi.getRuntimeProbeState();
}

function getAudioBufferedEnd() {
  return typeof audioTelemetryApi.getBufferedEnd === "function"
    ? audioTelemetryApi.getBufferedEnd()
    : null;
}

function flushAudioTelemetryQueue(options) {
  return audioTelemetryApi.flushQueue(options);
}

function startAudioTelemetryHeartbeat() {
  audioTelemetryApi.startHeartbeat();
}

function stopAudioTelemetryHeartbeat() {
  audioTelemetryApi.stopHeartbeat();
}

function markAudioTelemetryInactive() {
  audioTelemetryApi.markHealthSessionInactive();
}

function clearActiveAudioRecovery() {
  const recovery = audioState.activeAudioRecovery;
  if (recovery && recovery.timer) {
    window.clearTimeout(recovery.timer);
  }
  audioState.activeAudioRecovery = null;
}

function buildAudioRecoveryPayload(recovery, extra) {
  const audio = audioState.audio;
  return Object.assign(
    buildAudioMonitorPayload(
      getCurrentPlaylistTrack(),
      audioState.currentIndex,
      audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || ""
    ),
    getAudioRuntimeProbeState(),
    {
      request_token: recovery && recovery.requestToken,
      reason: recovery && recovery.reason,
      strategy: recovery && recovery.strategy,
      recovery_ms: recovery ? Math.max(0, Date.now() - recovery.startedAt) : 0
    },
    extra || {}
  );
}

function beginAudioRecovery(details) {
  const source = details || {};
  const requestToken = Number(source.request_token);
  if (!Number.isFinite(requestToken) || requestToken !== audioState.startRequestToken) return;
  const existing = audioState.activeAudioRecovery;
  if (existing && existing.requestToken === requestToken) {
    existing.reason = source.reason || existing.reason;
    existing.strategy = source.strategy || existing.strategy;
    return;
  }

  clearActiveAudioRecovery();
  const audio = audioState.audio;
  const recovery = {
    requestToken,
    reason: String(source.reason || "playback_failure"),
    strategy: String(source.strategy || "retry"),
    startedAt: Date.now(),
    startTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    timer: null
  };
  audioState.activeAudioRecovery = recovery;
  trackAudioRuntimeEvent("recovery_start", buildAudioRecoveryPayload(recovery));
  recovery.timer = window.setTimeout(function () {
    if (audioState.activeAudioRecovery !== recovery) return;
    failAudioRecovery({
      request_token: requestToken,
      reason: "progress_timeout",
      strategy: recovery.strategy
    });
  }, 7000);
}

function confirmAudioRecovery(audio) {
  const recovery = audioState.activeAudioRecovery;
  if (!recovery) return;
  if (recovery.requestToken !== audioState.startRequestToken) {
    clearActiveAudioRecovery();
    return;
  }
  if (!audio || audio.paused || !Number.isFinite(audio.currentTime)) return;
  const advanced = Math.max(0, audio.currentTime - recovery.startTime);
  if (advanced < 0.2) return;
  trackAudioRuntimeEvent("recovery_resolved", buildAudioRecoveryPayload(recovery, {
    advanced_ms: Math.round(advanced * 1000),
    paused: false
  }));
  clearActiveAudioRecovery();
}

function failAudioRecovery(details) {
  const source = details || {};
  const recovery = audioState.activeAudioRecovery;
  if (!recovery) return;
  const requestToken = Number(source.request_token);
  if (Number.isFinite(requestToken) && requestToken !== recovery.requestToken) return;
  recovery.reason = String(source.reason || recovery.reason || "recovery_failed");
  recovery.strategy = String(source.strategy || recovery.strategy || "retry");
  trackAudioRuntimeEvent("recovery_failed", buildAudioRecoveryPayload(recovery, {
    paused: Boolean(audioState.audio && audioState.audio.paused),
    error_name: source.error_name || "",
    status: Number.isFinite(Number(source.status)) ? Number(source.status) : null,
    result: source.result || ""
  }));
  if (
    audioState.stallRecovery &&
    audioState.stallRecovery.requestToken === recovery.requestToken
  ) {
    clearWaitingRecovery();
  }
  clearActiveAudioRecovery();
}

function getPrefetchCacheRequest() {
  return callAudioRadio("getPrefetchCacheRequest", arguments);
}

function resetNextTrackPrefetchState() {
  return callAudioRadio("resetNextTrackPrefetchState", arguments);
}

function clearNextTrackPrefetch() {
  return callAudioRadio("clearNextTrackPrefetch", arguments);
}

function getCurrentBufferedEndForPrefetch() {
  return callAudioRadio("getCurrentBufferedEndForPrefetch", arguments);
}

function shouldPrefetchNextTrackNow() {
  return callAudioRadio("shouldPrefetchNextTrackNow", arguments);
}

function peekRadioNextIndexForPrefetch() {
  return callAudioRadio("peekRadioNextIndexForPrefetch", arguments);
}

function peekNextIndexForPrefetch() {
  return callAudioRadio("peekNextIndexForPrefetch", arguments);
}

function rememberNextTrackPrefetch() {
  return callAudioRadio("rememberNextTrackPrefetch", arguments);
}

function getAutoPrefetchedNextIndex() {
  return callAudioRadio("getAutoPrefetchedNextIndex", arguments);
}

function startNextTrackPrefetch() {
  return callAudioRadio("startNextTrackPrefetch", arguments);
}

function maybePrefetchNextTrack() {
  return callAudioRadio("maybePrefetchNextTrack", arguments);
}

function scheduleSilentCheck() {
  return callAudioRadio("scheduleSilentCheck", arguments);
}

export { isManagedAudioUrl, isCloudflareAudioUrl, getAudioSource, getAudioMonitorTrackLabel, buildAudioMonitorPayload, probeAudioSourceForRecovery, getAudioRuntimeProbeState, getAudioBufferedEnd, flushAudioTelemetryQueue, startAudioTelemetryHeartbeat, stopAudioTelemetryHeartbeat, markAudioTelemetryInactive, clearActiveAudioRecovery, buildAudioRecoveryPayload, beginAudioRecovery, confirmAudioRecovery, failAudioRecovery, getPrefetchCacheRequest, resetNextTrackPrefetchState, clearNextTrackPrefetch, getCurrentBufferedEndForPrefetch, shouldPrefetchNextTrackNow, peekRadioNextIndexForPrefetch, peekNextIndexForPrefetch, rememberNextTrackPrefetch, getAutoPrefetchedNextIndex, startNextTrackPrefetch, maybePrefetchNextTrack, scheduleSilentCheck };
