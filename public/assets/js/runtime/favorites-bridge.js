// Favoris (pont vers favorites-ui.js) et réglages admin/Service Worker.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import {
  DONE_MODE_ICON,
  DOWNLOAD_ICON,
  FAVORITES_RESET_DB_MARKER,
  HEART_ICON_FILLED,
  HEART_ICON_OUTLINE,
  SELECT_MODE_ICON,
  audioState,
  favoritesUiApi,
  infraDownloadsApi,
  legacyThemeMap,
  runtime,
  themePresets
} from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import { formatTrackDuration, syncAudioUi } from "./module-bridges.js";
import {
  clearRadioQueue,
  getTrackMetaByAssetPath,
  loadTracksData,
  mergeTrackMetadata,
  persistHomePlayMode
} from "./catalog-playback.js";
import {
  getAudioAssetPathKey,
  getCurrentAlbumTitle,
  getCurrentLogicalAudioSrc,
  getCurrentPlaylistTrack,
  resolveManagedAudioSrc,
  srcMatches
} from "./audio-sources.js";
import {
  getMediaSessionFallbackArtwork,
  resolveCoverUrl,
  syncMediaSessionMetadata
} from "./media-artwork.js";
import { getRandomIndex, startTrack, syncPlaylistContext, trackAudioRuntimeEvent } from "./playback.js";

function purgeAdminUi() {
  // Public mode must not rely on CSS to hide admin UI. Remove it from the DOM.
  const adminMount = document.getElementById("adminMount");
  if (adminMount) adminMount.replaceChildren();

  const nodes = Array.from(document.querySelectorAll("[data-admin-only]"));
  nodes.forEach((node) => node.remove());

  const templates = [
    document.getElementById("adminHeaderTemplate"),
    document.getElementById("adminQuickMenuTemplate")
  ].filter(Boolean);
  templates.forEach((tpl) => tpl.remove());
}

function normalizeThemeName(themeName) {
  const raw = String(themeName || "")
    .trim()
    .toLowerCase();
  if (!raw) return "blanc";
  if (themePresets[raw]) return raw;
  if (legacyThemeMap[raw]) return legacyThemeMap[raw];
  return raw;
}

function createFavoritesUiApi() {
  const module =
    window.InfraFavoritesUi && typeof window.InfraFavoritesUi === "object" ? window.InfraFavoritesUi : null;
  const factory = module && typeof module.createFavoritesUi === "function" ? module.createFavoritesUi : null;
  if (!factory) return createNoopFavoritesUiApi();
  return factory({
    audioState,
    runtime,
    FAVORITES_RESET_DB_MARKER,
    HEART_ICON_FILLED,
    HEART_ICON_OUTLINE,
    DOWNLOAD_ICON,
    SELECT_MODE_ICON,
    DONE_MODE_ICON,
    infraDownloadsApi,
    getAudioAssetPathKey,
    getAudioTelemetryNow,
    getCurrentAlbumTitle,
    trackAudioRuntimeEvent,
    loadTracksData,
    getCurrentPlaylistTrack,
    getCurrentLogicalAudioSrc,
    mergeTrackMetadata,
    getTrackMetaByAssetPath,
    resolveManagedAudioSrc,
    clearRadioQueue,
    persistHomePlayMode,
    syncPlaylistContext,
    syncMediaSessionMetadata,
    syncAudioUi,
    getRandomIndex,
    startTrack,
    resolveCoverUrl,
    srcMatches,
    getMediaSessionFallbackArtwork,
    formatTrackDuration
  });
}

function createNoopFavoritesUiApi() {
  return {};
}

function callFavoritesUi(name, args) {
  const fn = favoritesUiApi && typeof favoritesUiApi[name] === "function" ? favoritesUiApi[name] : null;
  return fn ? fn.apply(favoritesUiApi, args || []) : undefined;
}

function createUnavailableFavoritesStorage() {
  return callFavoritesUi("createUnavailableFavoritesStorage", arguments);
}

function getFavoritesStorage() {
  return callFavoritesUi("getFavoritesStorage", arguments);
}

function openFavoritesDb() {
  return callFavoritesUi("openFavoritesDb", arguments);
}

function withFavoritesStore() {
  return callFavoritesUi("withFavoritesStore", arguments);
}

function canonicalFavoritePath() {
  return callFavoritesUi("canonicalFavoritePath", arguments);
}

function normalizeFavoritePath() {
  return callFavoritesUi("normalizeFavoritePath", arguments);
}

function getTelemetryElementSelector() {
  return callFavoritesUi("getTelemetryElementSelector", arguments);
}

function getTapTelemetry() {
  return callFavoritesUi("getTapTelemetry", arguments);
}

function trackFavoriteDebug() {
  return callFavoritesUi("trackFavoriteDebug", arguments);
}

function trackFavoritePathResolved() {
  return callFavoritesUi("trackFavoritePathResolved", arguments);
}

function sortFavoriteEntries() {
  return callFavoritesUi("sortFavoriteEntries", arguments);
}

function assignFavoriteSortIndexes() {
  return callFavoritesUi("assignFavoriteSortIndexes", arguments);
}

function readLocalFavoriteEntries() {
  return callFavoritesUi("readLocalFavoriteEntries", arguments);
}

function writeLocalFavoriteEntries() {
  return callFavoritesUi("writeLocalFavoriteEntries", arguments);
}

function persistFavoriteOrder() {
  return callFavoritesUi("persistFavoriteOrder", arguments);
}

function syncFavoriteEntryState() {
  return callFavoritesUi("syncFavoriteEntryState", arguments);
}

function loadFavoriteEntries() {
  return callFavoritesUi("loadFavoriteEntries", arguments);
}

function readFavoritesResetVersion() {
  return callFavoritesUi("readFavoritesResetVersion", arguments);
}

function writeFavoritesResetVersion() {
  return callFavoritesUi("writeFavoritesResetVersion", arguments);
}

function replaceFavoritesStoreWithResetMarker() {
  return callFavoritesUi("replaceFavoritesStoreWithResetMarker", arguments);
}

function ensureFavoritesReset() {
  return callFavoritesUi("ensureFavoritesReset", arguments);
}

function loadFavoritesWithReset() {
  return callFavoritesUi("loadFavoritesWithReset", arguments);
}

function getCurrentFavoritePath() {
  return callFavoritesUi("getCurrentFavoritePath", arguments);
}

function isFavoritePath() {
  return callFavoritesUi("isFavoritePath", arguments);
}

function getHeartIcon() {
  return callFavoritesUi("getHeartIcon", arguments);
}

function setFavoriteButtonState() {
  return callFavoritesUi("setFavoriteButtonState", arguments);
}

function setFavoriteButtonPath() {
  return callFavoritesUi("setFavoriteButtonPath", arguments);
}

function getFavoriteButtonPath() {
  return callFavoritesUi("getFavoriteButtonPath", arguments);
}

function deleteFavoriteEntry() {
  return callFavoritesUi("deleteFavoriteEntry", arguments);
}

function syncCurrentFavoriteButtons() {
  return callFavoritesUi("syncCurrentFavoriteButtons", arguments);
}

function syncFavoriteButtons() {
  return callFavoritesUi("syncFavoriteButtons", arguments);
}

function syncFavoriteSurface() {
  return callFavoritesUi("syncFavoriteSurface", arguments);
}

function pulseFavoriteButton() {
  return callFavoritesUi("pulseFavoriteButton", arguments);
}

function getNextFavoriteSortIndex() {
  return callFavoritesUi("getNextFavoriteSortIndex", arguments);
}

function getFavoriteSnapshot() {
  return callFavoritesUi("getFavoriteSnapshot", arguments);
}

function restoreFavoriteSnapshot() {
  return callFavoritesUi("restoreFavoriteSnapshot", arguments);
}

function createFavoritePersistResult() {
  return callFavoritesUi("createFavoritePersistResult", arguments);
}

function isFavoritePersistOk() {
  return callFavoritesUi("isFavoritePersistOk", arguments);
}

function applyFavoriteMemoryState() {
  return callFavoritesUi("applyFavoriteMemoryState", arguments);
}

function persistFavoriteMemoryState() {
  return callFavoritesUi("persistFavoriteMemoryState", arguments);
}

function setFavoritePath() {
  return callFavoritesUi("setFavoritePath", arguments);
}

function toggleFavoritePath() {
  return callFavoritesUi("toggleFavoritePath", arguments);
}

function toggleFavoriteAndSync() {
  return callFavoritesUi("toggleFavoriteAndSync", arguments);
}

function getAlbumRowFavoritePath() {
  return callFavoritesUi("getAlbumRowFavoritePath", arguments);
}

function getAlbumRowFavoriteMeta() {
  return callFavoritesUi("getAlbumRowFavoriteMeta", arguments);
}

function syncAlbumFavoriteRow() {
  return callFavoritesUi("syncAlbumFavoriteRow", arguments);
}

function syncAlbumFavoriteButtons() {
  return callFavoritesUi("syncAlbumFavoriteButtons", arguments);
}

function setAlbumFavoriteSelectionMode() {
  return callFavoritesUi("setAlbumFavoriteSelectionMode", arguments);
}

function logFavoriteSelectTap() {
  return callFavoritesUi("logFavoriteSelectTap", arguments);
}

function toggleAlbumFavoriteSelection() {
  return callFavoritesUi("toggleAlbumFavoriteSelection", arguments);
}

function ensureAlbumHeaderActions() {
  return callFavoritesUi("ensureAlbumHeaderActions", arguments);
}

function ensureAlbumFavoriteSelectionToolbar() {
  return callFavoritesUi("ensureAlbumFavoriteSelectionToolbar", arguments);
}

function ensureAlbumFavoriteControls() {
  return callFavoritesUi("ensureAlbumFavoriteControls", arguments);
}

function toggleCurrentFavorite() {
  return callFavoritesUi("toggleCurrentFavorite", arguments);
}

function buildFavoritesPlaylist() {
  return callFavoritesUi("buildFavoritesPlaylist", arguments);
}

function setFavoritesPlaylist() {
  return callFavoritesUi("setFavoritesPlaylist", arguments);
}

function startFavoritesPlaybackAt() {
  return callFavoritesUi("startFavoritesPlaybackAt", arguments);
}

function startFavoritesPlayback() {
  return callFavoritesUi("startFavoritesPlayback", arguments);
}

function enhanceAlbumDownloadButtons() {
  return callFavoritesUi("enhanceAlbumDownloadButtons", arguments);
}

function scheduleFavoritesPreload() {
  return callFavoritesUi("scheduleFavoritesPreload", arguments);
}

function isFavoritesRoute() {
  return callFavoritesUi("isFavoritesRoute", arguments);
}

function getFavoritesViewRoot() {
  return callFavoritesUi("getFavoritesViewRoot", arguments);
}

function closeFavoritesPage() {
  return callFavoritesUi("closeFavoritesPage", arguments);
}

function openFavoritesPage() {
  return callFavoritesUi("openFavoritesPage", arguments);
}

function refreshFavoritesViewIfOpen() {
  return callFavoritesUi("refreshFavoritesViewIfOpen", arguments);
}

function escapeHtml() {
  return callFavoritesUi("escapeHtml", arguments);
}

function escapeAttribute() {
  return callFavoritesUi("escapeAttribute", arguments);
}

function createFavoriteRowCover() {
  return callFavoritesUi("createFavoriteRowCover", arguments);
}

function getFavoriteRowTitle() {
  return callFavoritesUi("getFavoriteRowTitle", arguments);
}

function getFavoriteRowAlbum() {
  return callFavoritesUi("getFavoriteRowAlbum", arguments);
}

function buildFavoritesViewRows() {
  return callFavoritesUi("buildFavoritesViewRows", arguments);
}

function getOrCreateFavoritesView() {
  return callFavoritesUi("getOrCreateFavoritesView", arguments);
}

function getFavoritesRenderStartTs() {
  return callFavoritesUi("getFavoritesRenderStartTs", arguments);
}

function beginFavoritesRenderTelemetry() {
  return callFavoritesUi("beginFavoritesRenderTelemetry", arguments);
}

function getFavoritesRenderDuration() {
  return callFavoritesUi("getFavoritesRenderDuration", arguments);
}

function getFavoritesBackIcon() {
  return callFavoritesUi("getFavoritesBackIcon", arguments);
}

function getFavoritesSelectIcon() {
  return callFavoritesUi("getFavoritesSelectIcon", arguments);
}

function getFavoritesSelectedCount() {
  return callFavoritesUi("getFavoritesSelectedCount", arguments);
}

function setFavoritesSelectionMode() {
  return callFavoritesUi("setFavoritesSelectionMode", arguments);
}

function syncFavoritesSelectionUi() {
  return callFavoritesUi("syncFavoritesSelectionUi", arguments);
}

function toggleFavoritesSelectionPath() {
  return callFavoritesUi("toggleFavoritesSelectionPath", arguments);
}

function removeSelectedFavorites() {
  return callFavoritesUi("removeSelectedFavorites", arguments);
}

function renderFavoritesShell() {
  return callFavoritesUi("renderFavoritesShell", arguments);
}

function renderFavoritesPage() {
  return callFavoritesUi("renderFavoritesPage", arguments);
}

function bindFavoritesView() {
  return callFavoritesUi("bindFavoritesView", arguments);
}

function reorderFavorites() {
  return callFavoritesUi("reorderFavorites", arguments);
}

function syncFavoritesRoute() {
  return callFavoritesUi("syncFavoritesRoute", arguments);
}

function initFavoritesRoute() {
  return callFavoritesUi("initFavoritesRoute", arguments);
}

export {
  purgeAdminUi,
  normalizeThemeName,
  createFavoritesUiApi,
  createNoopFavoritesUiApi,
  callFavoritesUi,
  createUnavailableFavoritesStorage,
  getFavoritesStorage,
  openFavoritesDb,
  withFavoritesStore,
  canonicalFavoritePath,
  normalizeFavoritePath,
  getTelemetryElementSelector,
  getTapTelemetry,
  trackFavoriteDebug,
  trackFavoritePathResolved,
  sortFavoriteEntries,
  assignFavoriteSortIndexes,
  readLocalFavoriteEntries,
  writeLocalFavoriteEntries,
  persistFavoriteOrder,
  syncFavoriteEntryState,
  loadFavoriteEntries,
  readFavoritesResetVersion,
  writeFavoritesResetVersion,
  replaceFavoritesStoreWithResetMarker,
  ensureFavoritesReset,
  loadFavoritesWithReset,
  getCurrentFavoritePath,
  isFavoritePath,
  getHeartIcon,
  setFavoriteButtonState,
  setFavoriteButtonPath,
  getFavoriteButtonPath,
  deleteFavoriteEntry,
  syncCurrentFavoriteButtons,
  syncFavoriteButtons,
  syncFavoriteSurface,
  pulseFavoriteButton,
  getNextFavoriteSortIndex,
  getFavoriteSnapshot,
  restoreFavoriteSnapshot,
  createFavoritePersistResult,
  isFavoritePersistOk,
  applyFavoriteMemoryState,
  persistFavoriteMemoryState,
  setFavoritePath,
  toggleFavoritePath,
  toggleFavoriteAndSync,
  getAlbumRowFavoritePath,
  getAlbumRowFavoriteMeta,
  syncAlbumFavoriteRow,
  syncAlbumFavoriteButtons,
  setAlbumFavoriteSelectionMode,
  logFavoriteSelectTap,
  toggleAlbumFavoriteSelection,
  ensureAlbumHeaderActions,
  ensureAlbumFavoriteSelectionToolbar,
  ensureAlbumFavoriteControls,
  toggleCurrentFavorite,
  buildFavoritesPlaylist,
  setFavoritesPlaylist,
  startFavoritesPlaybackAt,
  startFavoritesPlayback,
  enhanceAlbumDownloadButtons,
  scheduleFavoritesPreload,
  isFavoritesRoute,
  getFavoritesViewRoot,
  closeFavoritesPage,
  openFavoritesPage,
  refreshFavoritesViewIfOpen,
  escapeHtml,
  escapeAttribute,
  createFavoriteRowCover,
  getFavoriteRowTitle,
  getFavoriteRowAlbum,
  buildFavoritesViewRows,
  getOrCreateFavoritesView,
  getFavoritesRenderStartTs,
  beginFavoritesRenderTelemetry,
  getFavoritesRenderDuration,
  getFavoritesBackIcon,
  getFavoritesSelectIcon,
  getFavoritesSelectedCount,
  setFavoritesSelectionMode,
  syncFavoritesSelectionUi,
  toggleFavoritesSelectionPath,
  removeSelectedFavorites,
  renderFavoritesShell,
  renderFavoritesPage,
  bindFavoritesView,
  reorderFavorites,
  syncFavoritesRoute,
  initFavoritesRoute
};
