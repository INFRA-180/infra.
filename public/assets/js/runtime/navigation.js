// Navigation interne (historique, cache de pages, adresses).
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { SPA_PAGE_FETCH_TIMEOUT_MS, SPA_SHELL_CACHE_NAME, audioState, spaRouterApi, spaState } from "../scripts.js";
import { spaNavigate } from "./module-bridges.js";
import { releasePwaCoverHold } from "./cover-warmup.js";
import { getCurrentPlayableAudioSrc, normalizeUrlAgainstBase } from "./audio-sources.js";
import { getAlbumNameFromUrlLike, trackAudioRuntimeEvent } from "./playback.js";

function navigateTo(href, options) {
  if (!spaState.enabled) {
    window.location.href = href;
    return;
  }
  cancelPendingSpaScrollSave();
  let navigation = null;
  try {
    navigation = spaNavigate(href, options);
  } catch (error) {
    handleUnhandledSpaNavigationError(href, error);
    return;
  }
  if (navigation && typeof navigation.catch === "function") {
    navigation.catch(function (error) {
      handleUnhandledSpaNavigationError(href, error);
    });
  }
}

function handleUnhandledSpaNavigationError(href, error) {
  const errorName = String(error && error.name ? error.name : "NavigationError");
  trackAudioRuntimeEvent("nav:album_abort", {
    track: "album_open",
    album: getAlbumNameFromUrlLike(href),
    reason: `unhandled_spa_${errorName}`,
    error_name: errorName,
    to_url: String(href || ""),
    navigation_token: Number(spaState.navToken || 0)
  });
  spaState.navigationActive = false;
  spaState.activeNavigationHref = "";
  releasePwaCoverHold("unhandled_spa_error");
  window.location.href = href;
}

function buildSpaHistoryState(urlLike, scrollX, scrollY) {
  if (spaRouterApi && typeof spaRouterApi.buildHistoryState === "function") {
    return spaRouterApi.buildHistoryState({
      baseState: history.state,
      url: String(urlLike || window.location.href),
      scrollX,
      scrollY
    });
  }
  const base = history.state && typeof history.state === "object" ? Object.assign({}, history.state) : {};
  base.__infraSpa = 1;
  base.__infraUrl = String(urlLike || window.location.href);
  base.__infraScrollX = Math.max(0, Math.round(Number(scrollX) || 0));
  base.__infraScrollY = Math.max(0, Math.round(Number(scrollY) || 0));
  return base;
}

function saveCurrentScrollPositionInHistory() {
  const x = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
  const y = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
  const href = String(window.location.href || "");
  if (
    spaState.lastHistoryUrl === href &&
    spaState.lastHistoryScrollX === x &&
    spaState.lastHistoryScrollY === y
  ) {
    return { ok: true, mode: "replace", skipped: true, errorName: "" };
  }
  return commitSpaHistoryState("replace", href, x, y);
}

function commitSpaHistoryState(mode, urlLike, scrollX, scrollY) {
  const href = String(urlLike || window.location.href);
  const x = Math.max(0, Math.round(Number(scrollX) || 0));
  const y = Math.max(0, Math.round(Number(scrollY) || 0));
  const previousHref = mode === "push" ? window.location.href : history.state?.__infraPreviousUrl;
  const baseState = Object.assign({}, history.state, { __infraPreviousUrl: previousHref || "" });
  let result = null;
  if (spaRouterApi && typeof spaRouterApi.writeHistoryState === "function") {
    result = spaRouterApi.writeHistoryState({
      historyRef: history,
      baseState,
      mode,
      url: href,
      scrollX: x,
      scrollY: y
    });
  } else {
    try {
      if (mode === "push") {
        history.pushState(Object.assign(buildSpaHistoryState(href, x, y), { __infraPreviousUrl: baseState.__infraPreviousUrl }), "", href);
      } else if (mode === "replace") {
        history.replaceState(buildSpaHistoryState(href, x, y), "", href);
      }
      result = { ok: true, mode, skipped: mode !== "push" && mode !== "replace", errorName: "" };
    } catch (error) {
      result = {
        ok: false,
        mode,
        skipped: false,
        errorName: String(error && error.name ? error.name : "HistoryError")
      };
    }
  }
  if (result && result.ok) {
    spaState.lastHistoryUrl = href;
    spaState.lastHistoryScrollX = x;
    spaState.lastHistoryScrollY = y;
  }
  return result || { ok: false, mode, skipped: false, errorName: "HistoryError" };
}

function cancelPendingSpaScrollSave() {
  if (!spaState.scrollSaveTimer) return;
  window.clearTimeout(spaState.scrollSaveTimer);
  spaState.scrollSaveTimer = 0;
}

function getScrollFromHistoryState(stateLike) {
  if (spaRouterApi && typeof spaRouterApi.getScrollFromHistoryState === "function") {
    return spaRouterApi.getScrollFromHistoryState(stateLike);
  }
  const raw = stateLike && typeof stateLike === "object" ? stateLike : {};
  const x = Number(raw.__infraScrollX);
  const y = Number(raw.__infraScrollY);
  return {
    x: Number.isFinite(x) ? Math.max(0, x) : 0,
    y: Number.isFinite(y) ? Math.max(0, y) : 0
  };
}

function isSpaNavigableUrl(url) {
  if (spaRouterApi && typeof spaRouterApi.isNavigableUrl === "function") {
    return spaRouterApi.isNavigableUrl(url, {
      currentHref: window.location.href,
      currentOrigin: window.location.origin
    });
  }
  if (!url || !(url instanceof URL)) return false;
  if (window.location.origin !== "null" && url.origin !== window.location.origin) return false;

  const path = String(url.pathname || "");
  if (!path) return true;

  // Only prefetch/navigate HTML-like documents.
  if (/\.(?:html?)$/i.test(path) || path.endsWith("/")) return true;
  if (
    /\.(?:mp3|m4a|aac|wav|flac|ogg|png|jpe?g|webp|gif|svg|ico|pdf|zip|json|js|css|woff2?)$/i.test(path)
  ) {
    return false;
  }
  return true;
}

function getSpaPageCacheKey(urlLike) {
  if (spaRouterApi && typeof spaRouterApi.getPageCacheKey === "function") {
    return spaRouterApi.getPageCacheKey(urlLike, {
      currentHref: window.location.href
    });
  }
  let url = null;
  try {
    url = urlLike instanceof URL ? urlLike : new URL(String(urlLike || ""), window.location.href);
  } catch (_err) {
    return "";
  }
  return `${url.pathname}${url.search}`;
}

function getSpaCachedHtml(urlLike) {
  if (spaState.pageCacheApi && typeof spaState.pageCacheApi.get === "function") {
    return spaState.pageCacheApi.get(urlLike);
  }
  const key = getSpaPageCacheKey(urlLike);
  if (!key) return "";
  const value = spaState.pageCache.get(key);
  return typeof value === "string" ? value : "";
}

function setSpaCachedHtml(urlLike, html) {
  if (spaState.pageCacheApi && typeof spaState.pageCacheApi.set === "function") {
    spaState.pageCacheApi.set(urlLike, html);
    return;
  }
  const key = getSpaPageCacheKey(urlLike);
  const value = String(html || "");
  if (!key || !value) return;

  spaState.pageCache.set(key, value);
  const existingIndex = spaState.pageCacheOrder.indexOf(key);
  if (existingIndex >= 0) {
    spaState.pageCacheOrder.splice(existingIndex, 1);
  }
  spaState.pageCacheOrder.push(key);

  while (spaState.pageCacheOrder.length > spaState.pageCacheLimit) {
    const oldest = spaState.pageCacheOrder.shift();
    if (!oldest) break;
    spaState.pageCache.delete(oldest);
  }
}

function absolutizeSrcsetForBase(srcsetValue, baseUrl) {
  return String(srcsetValue || "")
    .split(",")
    .map(function (entry) {
      const raw = String(entry || "").trim();
      if (!raw) return "";
      const parts = raw.split(/\s+/).filter(Boolean);
      const src = parts.shift() || "";
      const absolute = normalizeUrlAgainstBase(src, baseUrl);
      return [absolute].concat(parts).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function normalizeCoverElementsForBase(docLike, baseUrl) {
  if (!docLike || typeof docLike.querySelectorAll !== "function") return;
  Array.from(docLike.querySelectorAll(".album-layout .cover, .cover")).forEach(function (cover) {
    const src = cover.getAttribute("src");
    if (src) cover.setAttribute("src", normalizeUrlAgainstBase(src, baseUrl));
    const srcset = cover.getAttribute("srcset");
    if (srcset) cover.setAttribute("srcset", absolutizeSrcsetForBase(srcset, baseUrl));
    const onerror = cover.getAttribute("onerror");
    const fallbackMatch = onerror && onerror.match(/this\.src\s*=\s*(['"])([^'"]+)\1/);
    if (fallbackMatch) {
      const fallback = normalizeUrlAgainstBase(fallbackMatch[2], baseUrl);
      cover.setAttribute("onerror", onerror.replace(fallbackMatch[0], `this.src=${JSON.stringify(fallback)}`));
    }
  });
}

function isAudioPlaybackActive() {
  const audio = audioState.audio;
  return Boolean(audio && !audio.paused && getCurrentPlayableAudioSrc(audio));
}

function isAggressivePrefetchPaused() {
  const now = Date.now();
  if (audioState.prefetchPausedUntil && now < audioState.prefetchPausedUntil) return true;

  const audio = audioState.audio;
  if (!audio || audio.paused) return false;
  if (audio.readyState >= 3) return false;
  return true;
}

function getTrackLookaheadCount() {
  return 0;
}

function getRuntimePrefetchCount() {
  return 0;
}

function prefetchSpaPage(href, options) {
  if (!spaState.enabled) return Promise.resolve(false);

  const opts = options || {};
  if (!opts.force && isAggressivePrefetchPaused()) return Promise.resolve(false);

  if (spaState.pageCacheApi && typeof spaState.pageCacheApi.prefetch === "function") {
    return spaState.pageCacheApi.prefetch(href, Object.assign({}, opts, {
      cacheName: SPA_SHELL_CACHE_NAME,
      timeoutMs: SPA_PAGE_FETCH_TIMEOUT_MS
    }));
  }
  return Promise.resolve(false);
}

function loadSpaPageDocument(href, options) {
  if (!spaState.pageCacheApi || typeof spaState.pageCacheApi.load !== "function") {
    return Promise.resolve(null);
  }
  return spaState.pageCacheApi.load(href, Object.assign({}, options || {}, {
    cacheName: SPA_SHELL_CACHE_NAME,
    timeoutMs: SPA_PAGE_FETCH_TIMEOUT_MS
  }));
}

function getSpaPersistRoot() {
  let root = document.getElementById("infraSpaPersist");
  if (root) return root;

  root = document.createElement("div");
  root.id = "infraSpaPersist";
  document.body.insertBefore(root, document.body.firstChild);
  return root;
}

export { navigateTo, handleUnhandledSpaNavigationError, buildSpaHistoryState, saveCurrentScrollPositionInHistory, commitSpaHistoryState, cancelPendingSpaScrollSave, getScrollFromHistoryState, isSpaNavigableUrl, getSpaPageCacheKey, getSpaCachedHtml, setSpaCachedHtml, absolutizeSrcsetForBase, normalizeCoverElementsForBase, isAudioPlaybackActive, isAggressivePrefetchPaused, getTrackLookaheadCount, getRuntimePrefetchCount, prefetchSpaPage, loadSpaPageDocument, getSpaPersistRoot };
