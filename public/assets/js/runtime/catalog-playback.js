// Catalogue, radio et lecture aléatoire de l'accueil.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { LIVE_CATALOG_CACHE_NAME, LIVE_CATALOG_TIMEOUT_MS, LOCAL_CATALOG_VERSION, WORKER_URL, audioState, catalogLoaderApi, catalogState, fallbackCatalog, homeCatalogApi, runtime } from "../scripts.js";
import { callAudioRadio, formatTrackDuration, rememberTrackDuration } from "./module-bridges.js";
import { canonicalFavoritePath } from "./favorites-bridge.js";
import { getAudioAssetPathKey, getCurrentAlbumTitle, getCurrentLogicalAudioSrc, normalizeAlbumTitle, normalizeTrackTitle, resolveManagedAudioSrc, toRuntimeAbsoluteUrl } from "./audio-sources.js";
import { normalizeCoverUrl } from "./media-artwork.js";
import { trackAudioRuntimeEvent } from "./playback.js";

function createCatalogLoaderApi() {
  const factory = window.InfraCatalogLoader && typeof window.InfraCatalogLoader.createLoader === "function"
    ? window.InfraCatalogLoader.createLoader
    : null;
  if (!factory) return createNoopCatalogLoaderApi();
  return factory({
    fallbackCatalog,
    catalogState,
    audioState,
    runtime,
    WORKER_URL,
    LIVE_CATALOG_CACHE_NAME,
    LIVE_CATALOG_TIMEOUT_MS,
    LOCAL_CATALOG_VERSION,
    normalizeAlbumTitle,
    normalizeTrackTitle,
    toRuntimeAbsoluteUrl,
    getAudioAssetPathKey,
    canonicalFavoritePath,
    formatTrackDuration,
    rememberTrackDuration,
    resolveManagedAudioSrc,
    getCurrentLogicalAudioSrc,
    normalizeCoverUrl
  });
}

function createNoopCatalogLoaderApi() {
  return {
    sanitizeCatalog: function (raw) { return raw && typeof raw === "object" ? raw : fallbackCatalog; },
    buildQuickActions: function () { return []; },
    isCatalogDocument: function (payload) { return Boolean(payload && Array.isArray(payload.apps) && Array.isArray(payload.albums)); },
    isTracksDocument: function (payload) { return Boolean(payload && Array.isArray(payload.albums)); },
    isDurationsDocument: function (payload) { return Boolean(payload && Array.isArray(payload.tracks)); },
    fetchLiveCatalogDocument: function () { return Promise.reject(new Error("catalog-loader unavailable")); },
    fetchLocalCatalogDocument: function (fileName) {
      const url = new URL(`data/${fileName}`, runtime.baseUrl);
      return fetch(url.href, { cache: "default", headers: { "Accept": "application/json" } }).then(function (response) {
        if (!response.ok) throw new Error(`local catalog fetch failed: ${response.status}`);
        return response.json();
      });
    },
    loadCatalogData: function () { catalogState.data = fallbackCatalog; return Promise.resolve(fallbackCatalog); },
    loadTracksData: function () { audioState.tracksData = audioState.tracksData || {}; return Promise.resolve(audioState.tracksData); },
    indexTrackMetadata: function () {},
    getTrackMetaByAssetPath: function () { return null; },
    mergeTrackMetadata: function (track) { return track || {}; }
  };
}

function sanitizeCatalog(raw) {
  return catalogLoaderApi.sanitizeCatalog(raw);
}

function buildQuickActions(catalog) {
  return catalogLoaderApi.buildQuickActions(catalog);
}

function isCatalogDocument(payload) {
  return catalogLoaderApi.isCatalogDocument(payload);
}

function isTracksDocument(payload) {
  return catalogLoaderApi.isTracksDocument(payload);
}

function isDurationsDocument(payload) {
  return catalogLoaderApi.isDurationsDocument(payload);
}

function fetchLiveCatalogDocument(fileName, validate) {
  return catalogLoaderApi.fetchLiveCatalogDocument(fileName, validate);
}

function fetchLocalCatalogDocument(fileName) {
  return catalogLoaderApi.fetchLocalCatalogDocument(fileName);
}

function loadCatalogData() {
  return catalogLoaderApi.loadCatalogData();
}

function loadTracksData() {
  return catalogLoaderApi.loadTracksData();
}

function indexTrackMetadata(tracksData) {
  catalogLoaderApi.indexTrackMetadata(tracksData);
}

function getTrackMetaByAssetPath(srcLike, baseUrl) {
  return catalogLoaderApi.getTrackMetaByAssetPath(srcLike, baseUrl);
}

function mergeTrackMetadata(track) {
  return catalogLoaderApi.mergeTrackMetadata(track);
}

function readHomePlayMode() {
  return callAudioRadio("readHomePlayMode", arguments);
}

function persistHomePlayMode() {
  return callAudioRadio("persistHomePlayMode", arguments);
}

function findPlaylistIndexByCurrentSrc() {
  return callAudioRadio("findPlaylistIndexByCurrentSrc", arguments);
}

function ensureRadioPlaylistLoaded() {
  return callAudioRadio("ensureRadioPlaylistLoaded", arguments);
}

function getTrackSource() {
  return callAudioRadio("getTrackSource", arguments);
}

function getRecentPlayedSrcSet() {
  return callAudioRadio("getRecentPlayedSrcSet", arguments);
}

function shuffledCopy() {
  return callAudioRadio("shuffledCopy", arguments);
}

function buildRadioQueue() {
  return callAudioRadio("buildRadioQueue", arguments);
}

function buildGlobalCatalogPlaylist() {
  return callAudioRadio("buildGlobalCatalogPlaylist", arguments);
}

function buildGlobalRandomPlaylistWithTelemetry() {
  return callAudioRadio("buildGlobalRandomPlaylistWithTelemetry", arguments);
}

function setGlobalCatalogPlaylist() {
  return callAudioRadio("setGlobalCatalogPlaylist", arguments);
}

function startGlobalRandomPlayback() {
  return callAudioRadio("startGlobalRandomPlayback", arguments);
}

function resetPreparedInitialGlobalRandomPlayback() {
  return callAudioRadio("resetPreparedInitialGlobalRandomPlayback", arguments);
}

function consumePreparedInitialGlobalRandomPlaylist() {
  return callAudioRadio("consumePreparedInitialGlobalRandomPlaylist", arguments);
}

function shouldPrepareInitialGlobalRandomPlayback() {
  return callAudioRadio("shouldPrepareInitialGlobalRandomPlayback", arguments);
}

function prepareInitialGlobalRandomPlayback() {
  return callAudioRadio("prepareInitialGlobalRandomPlayback", arguments);
}

function scheduleInitialGlobalRandomPreparation() {
  return callAudioRadio("scheduleInitialGlobalRandomPreparation", arguments);
}

function hasPlaybackSession() {
  return callAudioRadio("hasPlaybackSession", arguments);
}

function canStartInitialGlobalRandomPlayback() {
  return callAudioRadio("canStartInitialGlobalRandomPlayback", arguments);
}

function bindGlobalKeyboardShortcuts() {
  return callAudioRadio("bindGlobalKeyboardShortcuts", arguments);
}

function clearRadioQueue() {
  return callAudioRadio("clearRadioQueue", arguments);
}

function syncRadioQueueToPlaylist() {
  return callAudioRadio("syncRadioQueueToPlaylist", arguments);
}

function ensureRadioQueue() {
  return callAudioRadio("ensureRadioQueue", arguments);
}

function injectCurrentTrackIntoRadioQueue() {
  return callAudioRadio("injectCurrentTrackIntoRadioQueue", arguments);
}

function startSelectedTrackInRadioFromCold() {
  return callAudioRadio("startSelectedTrackInRadioFromCold", arguments);
}

function ensureRadioPlaylistForNavigation() {
  return callAudioRadio("ensureRadioPlaylistForNavigation", arguments);
}

function setHomePlayMode() {
  return callAudioRadio("setHomePlayMode", arguments);
}

function activateRadioModeFromTransport() {
  return callAudioRadio("activateRadioModeFromTransport", arguments);
}

function toggleRadioModeFromTransport() {
  return callAudioRadio("toggleRadioModeFromTransport", arguments);
}

function toggleAlbumShuffleMode() {
  return callAudioRadio("toggleAlbumShuffleMode", arguments);
}

function clearStoredPlaybackState() {
  return callAudioRadio("clearStoredPlaybackState", arguments);
}

function getQuickActions() {
  if (catalogState.quickActions.length) return catalogState.quickActions.slice();
  return buildQuickActions(sanitizeCatalog(fallbackCatalog));
}

async function hydrateHomeCatalog() {
  return homeCatalogApi.hydrateHomeCatalog();
}

function initAlbumSwipeNavigation() {
  return homeCatalogApi.initAlbumSwipeNavigation();
}

function consumePendingEarlyAlbumSwipeNavigation() {
  const storageKey = "infra:pending-album-swipe";
  let record = null;
  try {
    record = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    sessionStorage.removeItem(storageKey);
  } catch (_err) {
    record = null;
  }
  if (!record || typeof record !== "object") return;
  const finishedAt = Number(record.finished_at_ms) || 0;
  if (!finishedAt || Date.now() - finishedAt > 2 * 60 * 1000) return;
  const token = String(record.gesture_token || "").trim();
  if (!token) return;
  trackAudioRuntimeEvent("album_swipe", Object.assign({}, record, {
    track: "gesture",
    album: String(record.album || getCurrentAlbumTitle() || "album"),
    gesture_token: token,
    trigger: record.direction === "left" ? "swipe_left" : "swipe_right",
    surface: "home_album_grid",
    handler_ready: false,
    handler_state: "native_fallback",
    navigation_started: true,
    navigation_completed: true,
    navigation_method: "native_fallback",
    navigation_result: "done",
    result: "opened",
    cancel_reason: ""
  }));
}

export { createCatalogLoaderApi, createNoopCatalogLoaderApi, sanitizeCatalog, buildQuickActions, isCatalogDocument, isTracksDocument, isDurationsDocument, fetchLiveCatalogDocument, fetchLocalCatalogDocument, loadCatalogData, loadTracksData, indexTrackMetadata, getTrackMetaByAssetPath, mergeTrackMetadata, readHomePlayMode, persistHomePlayMode, findPlaylistIndexByCurrentSrc, ensureRadioPlaylistLoaded, getTrackSource, getRecentPlayedSrcSet, shuffledCopy, buildRadioQueue, buildGlobalCatalogPlaylist, buildGlobalRandomPlaylistWithTelemetry, setGlobalCatalogPlaylist, startGlobalRandomPlayback, resetPreparedInitialGlobalRandomPlayback, consumePreparedInitialGlobalRandomPlaylist, shouldPrepareInitialGlobalRandomPlayback, prepareInitialGlobalRandomPlayback, scheduleInitialGlobalRandomPreparation, hasPlaybackSession, canStartInitialGlobalRandomPlayback, bindGlobalKeyboardShortcuts, clearRadioQueue, syncRadioQueueToPlaylist, ensureRadioQueue, injectCurrentTrackIntoRadioQueue, startSelectedTrackInRadioFromCold, ensureRadioPlaylistForNavigation, setHomePlayMode, activateRadioModeFromTransport, toggleRadioModeFromTransport, toggleAlbumShuffleMode, clearStoredPlaybackState, getQuickActions, hydrateHomeCatalog, initAlbumSwipeNavigation, consumePendingEarlyAlbumSwipeNavigation };
