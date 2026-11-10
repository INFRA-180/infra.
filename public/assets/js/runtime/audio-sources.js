// Adresses audio, état des titres, titres et pochettes courantes.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import {
  AUDIO_BASE,
  audioState,
  catalogState,
  fallbackCatalog,
  normalizeDownloadUrl,
  runtime
} from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import { getTrackMetaByAssetPath, mergeTrackMetadata } from "./catalog-playback.js";
import { getResourceTimingHint, logCoverRuntimeEvent } from "./cover-warmup.js";
import { getMediaSessionFallbackArtwork, normalizeCoverUrl, resolveCoverUrl } from "./media-artwork.js";
import { getCoverTelemetrySource, trackAudioRuntimeEvent } from "./playback.js";

function toAbsoluteUrl(urlLike) {
  try {
    return new URL(String(urlLike || ""), window.location.href).href;
  } catch (_err) {
    return String(urlLike || "");
  }
}

function toAbsoluteUrlOrEmpty(urlLike) {
  const raw = String(urlLike || "").trim();
  if (!raw) return "";
  return toAbsoluteUrl(raw);
}

function toRuntimeAbsoluteUrl(urlLike) {
  try {
    return new URL(String(urlLike || ""), runtime.baseUrl).href;
  } catch (_err) {
    return toAbsoluteUrlOrEmpty(urlLike || "");
  }
}

function encodeAssetPathForUrl(assetPath) {
  return String(assetPath || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getAudioAssetPath(urlLike, baseUrl) {
  const raw = String(urlLike || "").trim();
  if (!raw) return "";

  let parsed = null;
  try {
    parsed = new URL(raw, baseUrl || window.location.href);
  } catch (_err) {
    return "";
  }

  let basePath = "/";
  try {
    basePath = new URL(".", runtime.baseUrl).pathname || "/";
  } catch (_err) {
    basePath = "/";
  }
  if (!basePath.endsWith("/")) basePath += "/";

  let pathname = parsed.pathname || "";
  if (pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length);
  } else {
    pathname = pathname.replace(/^\/+/, "");
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch (_err) {
    // Keep the encoded pathname if decoding fails.
  }

  const assetPath = pathname.replace(/^\/+/, "");
  if (!/^(?:assets\/music\/streams\/|assets\/audio\/).+\.(?:mp3|m4a|aac|wav|flac|ogg)$/i.test(assetPath)) {
    return "";
  }
  return assetPath;
}

function getAudioAssetPathKey(urlLike, baseUrl) {
  const path = getAudioAssetPath(urlLike, baseUrl || window.location.href);
  return path ? path.normalize("NFC") : "";
}

function resolveManagedAudioSrc(urlLike, baseUrl) {
  const raw = String(urlLike || "").trim();
  if (!raw) return "";

  const assetPath = getAudioAssetPath(raw, baseUrl || window.location.href);
  if (assetPath) {
    try {
      return new URL(encodeAssetPathForUrl(assetPath), `${AUDIO_BASE.replace(/\/+$/, "")}/`).href;
    } catch (_err) {
      return raw;
    }
  }

  return raw;
}

function normalizeUrlAgainstBase(urlLike, baseUrl) {
  const raw = String(urlLike || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, baseUrl || window.location.href).href;
  } catch (_err) {
    return toAbsoluteUrlOrEmpty(raw);
  }
}

function normalizeSrcValue(value) {
  return String(value || "").trim();
}

function srcMatches(a, b) {
  const left = normalizeSrcValue(a);
  const right = normalizeSrcValue(b);
  if (!left || !right) return false;
  if (left === right) return true;

  // Audio filenames are not unique across the catalogue (for example both
  // MOREMI AJASORO and PECHES contain `04-favora.m4a`). Compare their full
  // managed asset keys before any generic URL fallback so two albums can
  // never be mistaken for the same source.
  const leftAudioKey = getAudioAssetPathKey(left, window.location.href);
  const rightAudioKey = getAudioAssetPathKey(right, window.location.href);
  if (leftAudioKey || rightAudioKey) {
    return Boolean(leftAudioKey && rightAudioKey && leftAudioKey === rightAudioKey);
  }

  try {
    const leftUrl = new URL(left, window.location.href);
    const rightUrl = new URL(right, window.location.href);
    leftUrl.hash = "";
    rightUrl.hash = "";
    const leftHref = decodeURIComponent(leftUrl.href).normalize("NFC");
    const rightHref = decodeURIComponent(rightUrl.href).normalize("NFC");
    if (leftHref === rightHref) return true;
    const leftPath = decodeURIComponent(leftUrl.pathname || "").normalize("NFC");
    const rightPath = decodeURIComponent(rightUrl.pathname || "").normalize("NFC");
    return Boolean(leftPath && rightPath && leftPath === rightPath);
  } catch (_err) {
    return left.normalize("NFC") === right.normalize("NFC");
  }
}

function hashString(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function registerTrackFailure(srcLike) {
  const key = toAbsoluteUrlOrEmpty(srcLike || "");
  if (!key) return 0;
  const failures = (audioState.trackFailureCounts.get(key) || 0) + 1;
  audioState.trackFailureCounts.set(key, failures);

  // Keep memory bounded in long sessions.
  if (audioState.trackFailureCounts.size > 96) {
    const firstKey = audioState.trackFailureCounts.keys().next();
    if (!firstKey.done && firstKey.value) {
      audioState.trackFailureCounts.delete(firstKey.value);
    }
  }
  return failures;
}

function clearTrackFailure(srcLike) {
  const key = toAbsoluteUrlOrEmpty(srcLike || "");
  if (!key) return;
  audioState.trackFailureCounts.delete(key);
}

function clearTrackFailureForCurrent() {
  const src = getCurrentLogicalAudioSrc();
  clearTrackFailure(src);
}

function loadMediaElementForPlayback(mediaEl) {
  if (!mediaEl) return false;
  try {
    mediaEl.load();
    return true;
  } catch (_err) {
    return false;
  }
}

function normalizeAudioSourceUrl(rawUrl) {
  const raw = resolveManagedAudioSrc(rawUrl || "", window.location.href);
  if (!raw) return "";
  let parsed = null;
  try {
    parsed = new URL(raw, window.location.href);
  } catch (_err) {
    return raw;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "drive.google.com" || host === "docs.google.com" || host === "drive.usercontent.google.com") {
    return normalizeDownloadUrl(parsed.href);
  }

  return parsed.href;
}

function isBlobObjectUrl(value) {
  return /^blob:/i.test(String(value || "").trim());
}

function getCurrentPlayableAudioSrc(audio) {
  const currentAudio = audio || audioState.audio;
  return currentAudio ? currentAudio.currentSrc || currentAudio.src || "" : "";
}

function getCurrentLogicalAudioSrc() {
  const logical = toAbsoluteUrlOrEmpty(audioState.activeLogicalSrc || "");
  if (logical && !isBlobObjectUrl(logical)) return logical;

  const currentAudio = audioState.audio;
  if (currentAudio && !currentAudio.getAttribute("src")) return "";

  const playable = getCurrentPlayableAudioSrc();
  if (!playable || isBlobObjectUrl(playable)) return "";
  return toAbsoluteUrlOrEmpty(playable);
}

function revokeActiveBlobUrl() {
  if (audioState.activeBlobUrl) {
    try {
      URL.revokeObjectURL(audioState.activeBlobUrl);
    } catch (_err) {
      // Ignore revoke failures.
    }
    audioState.activeBlobUrl = "";
  }
}

function setTrackStatus(track, message, options) {
  if (!track || !track.statusEl) return;
  const opts = options || {};
  // Le simple « Chargement du fichier audio... » n'est plus affiché sous le titre choisi
  // (INFRA, 09/11/2026 : superflu). Le message d'échec avec « réessayer » reste.
  if (message && !opts.retry && /^Chargement du fichier audio/.test(message)) message = "";
  track.statusText.textContent = message || "";
  track.retryBtn.hidden = !opts.retry;
  track.statusEl.hidden = !message;
  track.row.classList.toggle("has-audio-status", Boolean(message));
  audioState.activeStatusTrack = message ? track : null;
}

function clearTrackStatus(track) {
  if (!track) return;
  setTrackStatus(track, "");
  if (audioState.activeStatusTrack === track) {
    audioState.activeStatusTrack = null;
  }
}

function clearOtherTrackStatuses(track) {
  const ui = audioState.ui;
  if (!ui || !Array.isArray(ui.tracks)) return;
  ui.tracks.forEach(function (item) {
    if (item !== track) clearTrackStatus(item);
  });
}

function getTrackByIndex(index) {
  const ui = audioState.ui;
  if (!ui || !Array.isArray(ui.tracks)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= ui.tracks.length) return null;
  return ui.tracks[index];
}

function normalizeTrackTitle(title) {
  const raw = String(title || "").trim();
  // Remove leading track number prefixes like "04 " or "02 ".
  const cleaned = /^\d+\s+[a-z]\s+\d+$/i.test(raw) ? raw : raw.replace(/^0*\d{1,2}\s+/, "").trim();
  if (!cleaned) return "";

  return cleaned.toLocaleUpperCase();
}

function normalizeAlbumTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase();
}

function displayAlbumCardTitle(title) {
  const cleaned = String(title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (/[\u0370-\u03ff]/u.test(cleaned) || /\b[A-Z][a-z]\b/.test(cleaned)) return cleaned;
  return cleaned.toLocaleUpperCase();
}

function getCurrentAlbumTitle() {
  if (!document.body.classList.contains("album-screen")) return "";
  const routeHost = document.getElementById("infraSpaRouteHost");
  const routeRoot =
    document.querySelector(
      "#infraSpaRouteHost .spa-route-layer.album-screen[data-spa-route-state='current']"
    ) || (!routeHost ? document : null);
  if (!routeRoot) return "";
  const heading =
    routeRoot.querySelector("main.page > h1") ||
    routeRoot.querySelector("main > h1") ||
    routeRoot.querySelector(".album-hero h1");
  return normalizeAlbumTitle(heading ? heading.textContent : "");
}

function getCurrentPlaylistTrack() {
  const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
  if (!list.length) return null;

  const currentSrc = getCurrentLogicalAudioSrc();
  if (currentSrc) {
    const bySrc = list.find((track) => track && srcMatches(track.src, currentSrc));
    if (bySrc) return mergeTrackMetadata(bySrc);
  }

  if (audioState.currentIndex >= 0 && audioState.currentIndex < list.length) {
    return mergeTrackMetadata(list[audioState.currentIndex] || null);
  }

  return null;
}

function getCurrentTrackAlbumPage(track) {
  const enriched = mergeTrackMetadata(track || null);
  const page = enriched && enriched.page ? String(enriched.page).trim() : "";
  if (page) return toAbsoluteUrl(page);
  if (document.body.classList.contains("album-screen")) {
    return toAbsoluteUrl(window.location.pathname);
  }
  return "";
}

function getCurrentTrackArtwork(track) {
  return resolveCoverUrl(track || null, { width: 1200 }) || getMediaSessionFallbackArtwork();
}

function preloadImage(src, options) {
  const url = toAbsoluteUrlOrEmpty(src || "");
  const opts = options || {};
  if (!url || typeof Image !== "function") {
    return Promise.resolve({ ok: false, src: url });
  }

  const resultCache =
    audioState.coverLoadResults instanceof Map
      ? audioState.coverLoadResults
      : (audioState.coverLoadResults = new Map());
  const promiseCache =
    audioState.coverLoadPromises instanceof Map
      ? audioState.coverLoadPromises
      : (audioState.coverLoadPromises = new Map());
  const cached = resultCache.get(url);
  const cachedAt = cached && Number(cached.cachedAt || 0);
  if (cached && (cached.ok || (cachedAt > 0 && Date.now() - cachedAt < 5000))) {
    return Promise.resolve({ ok: Boolean(cached.ok), src: url, cached: true });
  }
  if (cached) resultCache.delete(url);

  const inFlight = promiseCache.get(url);
  if (inFlight) return inFlight;

  const loadPromise = new Promise(function (resolve) {
    const image = new Image();
    let settled = false;

    function done(ok) {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      const result = { ok: Boolean(ok), src: url, cachedAt: Date.now() };
      resultCache.delete(url);
      resultCache.set(url, result);
      while (resultCache.size > 96) {
        const oldest = resultCache.keys().next();
        if (oldest.done) break;
        resultCache.delete(oldest.value);
      }
      resolve({ ok: result.ok, src: url });
    }

    try {
      image.decoding = "async";
    } catch (_err) {
      // Ignore unsupported decoding hints.
    }
    if (opts.highPriority) {
      try {
        image.fetchPriority = "high";
      } catch (_err) {
        // Ignore unsupported priority hints.
      }
    }

    image.onload = function () {
      if (typeof image.decode === "function") {
        image.decode().then(
          function () {
            done(true);
          },
          function () {
            done(true);
          }
        );
        return;
      }
      done(true);
    };
    image.onerror = function () {
      done(false);
    };
    image.src = url;

    if (image.complete && image.naturalWidth > 0) {
      if (typeof image.decode === "function") {
        image.decode().then(
          function () {
            done(true);
          },
          function () {
            done(true);
          }
        );
      } else {
        done(true);
      }
    }
  });
  promiseCache.set(url, loadPromise);
  loadPromise.finally(function () {
    if (promiseCache.get(url) === loadPromise) promiseCache.delete(url);
  });
  return loadPromise;
}

function setCoverWhenReady(imgElement, nextSrc, fallbackSrc, token) {
  if (!imgElement) return Promise.resolve(false);

  const fallback =
    normalizeCoverUrl(fallbackSrc || "", { responsive: false }) || getCurrentTrackArtwork(null);
  const target = normalizeCoverUrl(nextSrc || "", { width: 1200 }) || fallback;
  if (!target) return Promise.resolve(false);

  const current = toAbsoluteUrlOrEmpty(imgElement.currentSrc || imgElement.src || "");
  if (current && srcMatches(current, target)) return Promise.resolve(true);

  const track = getCurrentPlaylistTrack();
  const trackPath = getAudioAssetPath(
    track && track.src ? track.src : getCurrentLogicalAudioSrc(),
    window.location.href
  );
  if (!trackPath && srcMatches(target, getMediaSessionFallbackArtwork())) {
    return Promise.resolve(false);
  }

  function isFresh() {
    return !Number.isInteger(token) || token === audioState.coverUpdateToken;
  }

  const coverStartedAt = getAudioTelemetryNow();
  logCoverRuntimeEvent("cover_request", {
    album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
    source: getCoverTelemetrySource(target, track),
    cover_url: target,
    fallback_url: fallback || "",
    track_path: trackPath
  });

  return preloadImage(target, { highPriority: true }).then(function (result) {
    if (!isFresh()) return false;
    if (result && result.ok) {
      trackAudioRuntimeEvent(
        "cover_loaded",
        Object.assign(
          {
            album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
            source: getCoverTelemetrySource(target, track),
            cover_url: target,
            duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt)),
            track_path: trackPath
          },
          getResourceTimingHint(target, coverStartedAt)
        )
      );
      imgElement.src = target;
      return true;
    }
    trackAudioRuntimeEvent("cover_error", {
      album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
      source: getCoverTelemetrySource(target, track),
      cover_url: target,
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt)),
      track_path: trackPath
    });
    if (!fallback || srcMatches(target, fallback)) return false;
    const fallbackStartedAt = getAudioTelemetryNow();
    logCoverRuntimeEvent("cover_request", {
      album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
      source: "fallback",
      cover_url: fallback,
      failed_cover_url: target,
      track_path: trackPath
    });
    return preloadImage(fallback, { highPriority: true }).then(function (fallbackResult) {
      if (!isFresh()) return false;
      if (fallbackResult && fallbackResult.ok) {
        trackAudioRuntimeEvent(
          "cover_loaded",
          Object.assign(
            {
              album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
              source: "fallback",
              cover_url: fallback,
              duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - fallbackStartedAt)),
              track_path: trackPath
            },
            getResourceTimingHint(fallback, fallbackStartedAt)
          )
        );
        imgElement.src = fallback;
        return true;
      }
      trackAudioRuntimeEvent("cover_error", {
        album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
        source: "fallback",
        cover_url: fallback,
        duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - fallbackStartedAt)),
        track_path: trackPath
      });
      return false;
    });
  });
}

function setCoverBackgroundStable(element, nextSrc, fallbackSrc, token) {
  if (!element) return Promise.resolve(false);
  const fallback =
    normalizeCoverUrl(fallbackSrc || "", { responsive: false }) || getMediaSessionFallbackArtwork();
  const target = normalizeCoverUrl(nextSrc || "", { width: 1200 }) || fallback;
  if (!target) return Promise.resolve(false);

  const current = String(element.dataset.coverBgUrl || "").trim();
  if (current && srcMatches(current, target)) return Promise.resolve(true);

  function isFresh() {
    return !Number.isInteger(token) || token === audioState.coverUpdateToken;
  }

  return preloadImage(target, { highPriority: true }).then(function (result) {
    if (!isFresh()) return false;
    const chosen = result && result.ok ? target : fallback;
    if (!chosen) return false;
    element.style.backgroundImage = `url("${chosen.replace(/"/g, "%22")}")`;
    element.dataset.coverBgUrl = chosen;
    return true;
  });
}

function resolveCatalogAlbumArtwork(track) {
  const page = toAbsoluteUrlOrEmpty(track && track.page ? track.page : "");
  const album = normalizeAlbumTitle(track && track.album ? track.album : "");
  const catalog =
    catalogState.data && Array.isArray(catalogState.data.albums) ? catalogState.data : fallbackCatalog;
  const albums = Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
  if (!albums.length) return "";

  let matched = null;
  if (page) {
    matched =
      albums.find((entry) => toAbsoluteUrlOrEmpty(entry && entry.page ? entry.page : "") === page) || null;
  }
  if (!matched && album) {
    matched =
      albums.find((entry) => normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album) || null;
  }
  const thumb = matched && matched.thumb ? toRuntimeAbsoluteUrl(matched.thumb) : "";
  return thumb || "";
}

function resolveTracksAlbumArtwork(track) {
  const meta = getTrackMetaByAssetPath(track && track.src ? track.src : "");
  if (meta && meta.artwork) return meta.artwork;

  const tracksData = audioState.tracksData;
  const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
  if (!albums.length) return "";

  const page = toAbsoluteUrlOrEmpty(track && track.page ? track.page : "");
  const album = normalizeAlbumTitle(track && track.album ? track.album : "");
  let matched = null;

  if (page) {
    matched =
      albums.find(function (entry) {
        return toRuntimeAbsoluteUrl(entry && entry.page ? entry.page : "") === page;
      }) || null;
  }

  if (!matched && album) {
    matched =
      albums.find(function (entry) {
        return normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album;
      }) || null;
  }

  return matched && matched.cover ? toRuntimeAbsoluteUrl(matched.cover) : "";
}

export {
  toAbsoluteUrl,
  toAbsoluteUrlOrEmpty,
  toRuntimeAbsoluteUrl,
  encodeAssetPathForUrl,
  getAudioAssetPath,
  getAudioAssetPathKey,
  resolveManagedAudioSrc,
  normalizeUrlAgainstBase,
  normalizeSrcValue,
  srcMatches,
  hashString,
  registerTrackFailure,
  clearTrackFailure,
  clearTrackFailureForCurrent,
  loadMediaElementForPlayback,
  normalizeAudioSourceUrl,
  isBlobObjectUrl,
  getCurrentPlayableAudioSrc,
  getCurrentLogicalAudioSrc,
  revokeActiveBlobUrl,
  setTrackStatus,
  clearTrackStatus,
  clearOtherTrackStatuses,
  getTrackByIndex,
  normalizeTrackTitle,
  normalizeAlbumTitle,
  displayAlbumCardTitle,
  getCurrentAlbumTitle,
  getCurrentPlaylistTrack,
  getCurrentTrackAlbumPage,
  getCurrentTrackArtwork,
  preloadImage,
  setCoverWhenReady,
  setCoverBackgroundStable,
  resolveCatalogAlbumArtwork,
  resolveTracksAlbumArtwork
};
