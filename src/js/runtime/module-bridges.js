// Ponts vers les autres fichiers (télémétrie, catalogue, radio, cœur audio, SPA, fiches, lecteur).
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import {
  ALBUM_GRID_INITIAL_BATCH,
  ALBUM_GRID_NEXT_BATCH,
  COVERS_CACHE_NAME,
  COVER_SESSION_NAVIGATION_GATE_ENABLED,
  COVER_SESSION_PREPARE_ENABLED,
  DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
  DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
  DESKTOP_TRANSPORT_DRAG_THRESHOLD,
  DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY,
  DESKTOP_TRANSPORT_MARGIN,
  DESKTOP_TRANSPORT_MIN_HEIGHT,
  DESKTOP_TRANSPORT_MIN_WIDTH,
  DESKTOP_TRANSPORT_STORAGE_KEY,
  HEART_ICON_OUTLINE,
  NOW_PLAYING_OVERLAY_ENABLED,
  PLAYER_ICON_NEXT,
  PLAYER_ICON_PLAY,
  PLAYER_ICON_PREVIOUS,
  PLAYER_ICON_STOP,
  PREFETCH_BUFFER_ABORT_SECONDS,
  PREFETCH_BUFFER_STABLE_SECONDS,
  PREFETCH_MAX_ATTEMPTS,
  PREFETCH_NEXT_CACHE_NAME,
  PREFETCH_NEXT_CONCURRENCY,
  PREFETCH_NEXT_ENABLED,
  PREFETCH_NEXT_MAX_BYTES,
  PREFETCH_NEXT_MAX_ENTRIES,
  PREFETCH_NEXT_QUEUE_DEPTH,
  PREFETCH_NEXT_SEGMENT_BYTES,
  PREFETCH_NEXT_THRESHOLD_SECONDS,
  PREFETCH_REQUEST_TIMEOUT_MS,
  RADIO_ICON,
  SHUFFLE_ICON,
  TRACK_CLICK_COOLDOWN_MS,
  WORKER_URL,
  albumPlayerUiApi,
  audioRadioApi,
  audioState,
  audioTelemetryApi,
  audioTelemetryModule,
  catalogState,
  clipState,
  fallbackCatalog,
  nowPlayingApi,
  prefetchApi,
  pwaState,
  runtime,
  runtimeVersion,
  spaRendererApi,
  spaRouterApi,
  spaState,
  themePresets,
  transportUiApi
} from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import {
  ensureAlbumFavoriteControls,
  ensureAlbumFavoriteSelectionToolbar,
  ensureAlbumHeaderActions,
  normalizeFavoritePath,
  syncCurrentFavoriteButtons,
  toggleAlbumFavoriteSelection,
  toggleCurrentFavorite
} from "./favorites-bridge.js";
import {
  bindGlobalKeyboardShortcuts,
  canStartInitialGlobalRandomPlayback,
  ensureRadioPlaylistForNavigation,
  ensureRadioPlaylistLoaded,
  ensureRadioQueue,
  fetchLiveCatalogDocument,
  fetchLocalCatalogDocument,
  getTrackMetaByAssetPath,
  hasPlaybackSession,
  injectCurrentTrackIntoRadioQueue,
  isDurationsDocument,
  loadCatalogData,
  loadTracksData,
  mergeTrackMetadata,
  resetPreparedInitialGlobalRandomPlayback,
  sanitizeCatalog,
  startGlobalRandomPlayback,
  startSelectedTrackInRadioFromCold,
  syncRadioQueueToPlaylist,
  toggleAlbumShuffleMode,
  toggleRadioModeFromTransport
} from "./catalog-playback.js";
import {
  isAudioBusyForIdleWork,
  prepareAlbumCoversForSession,
  releasePwaCoverHold,
  rememberAlbumCoverImage,
  scheduleAlbumCoverCacheWarmup
} from "./cover-warmup.js";
import {
  currentTheme,
  getCurrentThemeColor,
  getPwaStatusColor,
  isAndroidDevice,
  isDarkColor,
  isIosDevice,
  isStandaloneDisplayMode,
  serviceWorkerReportedVersion,
  setThemeColor,
  syncPwaStatusColor
} from "./theme-admin-pwa.js";
import {
  absolutizeSrcsetForBase,
  buildSpaHistoryState,
  commitSpaHistoryState,
  getScrollFromHistoryState,
  getSpaCachedHtml,
  getSpaPersistRoot,
  loadSpaPageDocument,
  normalizeCoverElementsForBase,
  prefetchSpaPage,
  saveCurrentScrollPositionInHistory,
  setSpaCachedHtml
} from "./navigation.js";
import {
  clearOtherTrackStatuses,
  clearTrackFailure,
  clearTrackFailureForCurrent,
  clearTrackStatus,
  displayAlbumCardTitle,
  getAudioAssetPath,
  getAudioAssetPathKey,
  getCurrentAlbumTitle,
  getCurrentLogicalAudioSrc,
  getCurrentPlayableAudioSrc,
  getCurrentPlaylistTrack,
  getCurrentTrackAlbumPage,
  getCurrentTrackArtwork,
  getTrackByIndex,
  hashString,
  isBlobObjectUrl,
  loadMediaElementForPlayback,
  normalizeAlbumTitle,
  normalizeAudioSourceUrl,
  normalizeTrackTitle,
  normalizeUrlAgainstBase,
  registerTrackFailure,
  resolveManagedAudioSrc,
  resolveTracksAlbumArtwork,
  revokeActiveBlobUrl,
  setCoverBackgroundStable,
  setCoverWhenReady,
  setTrackStatus,
  srcMatches,
  toAbsoluteUrl,
  toAbsoluteUrlOrEmpty,
  toRuntimeAbsoluteUrl
} from "./audio-sources.js";
import {
  buildPreservedTrack,
  extendAlbumPlaylistToNextAlbum,
  extendAlbumPlaylistToPreviousAlbum,
  savePlaybackQueueContext,
  seekCurrentAudioToRatio
} from "./album-continuity.js";
import {
  bindMediaSessionActions,
  clearWaitingRecovery,
  configurePlaybackAudioSession,
  getAlbumCoverFromDoc,
  getMediaSessionFallbackArtwork,
  normalizeArtworkUrl,
  normalizeCoverUrl,
  parseSrcsetCandidates,
  resolveCoverUrl,
  scheduleMediaSessionResync,
  scheduleWaitingRecovery,
  syncMediaSessionMetadata
} from "./media-artwork.js";
import {
  beginAudioRecovery,
  buildAudioMonitorPayload,
  clearNextTrackPrefetch,
  confirmAudioRecovery,
  failAudioRecovery,
  getAudioBufferedEnd,
  getAudioRuntimeProbeState,
  getAudioSource,
  getAutoPrefetchedNextIndex,
  isCloudflareAudioUrl,
  markAudioTelemetryInactive,
  maybePrefetchNextTrack,
  probeAudioSourceForRecovery,
  scheduleSilentCheck,
  startAudioTelemetryHeartbeat,
  startNextTrackPrefetch,
  stopAudioTelemetryHeartbeat
} from "./audio-monitor.js";
import {
  clearFadeTimer,
  ensureCurrentIndexFromAudio,
  ensureGlobalAudio,
  ensurePlayablePlaylistContext,
  fadeInAudio,
  fadeOutAudio,
  forceAudioFullVolume,
  getAlbumNameFromUrlLike,
  getCurrentPlaylistIndexSafe,
  getQueuePreviewIndices,
  getRandomIndex,
  handleGlobalTransportToggle,
  logAudioAuditEvent,
  logAudioRuntimeAlbumSwitch,
  markAudioPauseIntent,
  movePlaylistItem,
  playNext,
  playPrevious,
  recoverFromTrackFailure,
  resetAudioElementForSource,
  saveResumeState,
  sendAudioMonitoringLog,
  startAudioRaf,
  startRadioPlaybackFromIdle,
  startTrack,
  syncPlaylistContext,
  toggleCurrentPageCollection,
  togglePlayPause,
  trackAudioRuntimeEvent,
  updateProgressUi
} from "./playback.js";
import {
  createAlbumOpenTelemetryContext,
  finishAlbumOpenTelemetry,
  initPage,
  openHomeAlbumCard,
  resumeLiveHomeRoute
} from "./page-init.js";

function normalizePwaHeadAssetLinks() {
  document.querySelectorAll("link[href]").forEach(function (link) {
    const raw = String(link.getAttribute("href") || "").trim();
    if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return;

    let path = raw;
    while (path.startsWith("./")) path = path.slice(2);
    while (path.startsWith("../")) path = path.slice(3);
    while (path.startsWith("/")) path = path.slice(1);

    if (!path.startsWith("assets/pwa/") && !path.startsWith("manifest.webmanifest")) return;

    try {
      link.setAttribute("href", new URL(path, runtime.baseUrl).href);
    } catch (_err) {
      // Keep the original link if URL normalization is not available.
    }
  });
}

function createAudioTelemetryApi() {
  const factory =
    audioTelemetryModule && typeof audioTelemetryModule.createTelemetry === "function"
      ? audioTelemetryModule.createTelemetry
      : null;
  if (!factory) return createNoopAudioTelemetryApi();
  return factory({
    fineTelemetryEnabled: true,
    isTelemetryOriginAllowed: function () {
      return window.location.origin === "https://infra-180.github.io";
    },
    getWorkerUrl: function () {
      return WORKER_URL;
    },
    getRuntimeVersion: function () {
      return runtimeVersion;
    },
    getAudioState: function () {
      return audioState;
    },
    getAudio: function () {
      return audioState.audio || null;
    },
    getAudioSource: getAudioSource,
    isIosDevice: isIosDevice,
    isStandaloneDisplayMode: isStandaloneDisplayMode,
    isAndroidDevice: isAndroidDevice,
    getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack: getCurrentPlaylistTrack,
    buildMonitorPayload: buildAudioMonitorPayload
  });
}

function createNoopAudioTelemetryApi() {
  return {
    getBufferedEnd: function () {
      return null;
    },
    getRuntimeProbeState: function () {
      return {};
    },
    flushQueue: function () {
      return Promise.resolve(false);
    },
    markHealthSessionInactive: function () {},
    startHeartbeat: function () {},
    stopHeartbeat: function () {},
    trackRuntimeEvent: function () {},
    recordCacheObservation: function () {},
    recordStorageSnapshot: function () {},
    sendMonitoringLog: function () {},
    logAuditEvent: function () {},
    hasPendingEvents: function () {
      return false;
    },
    initLifecycle: function () {}
  };
}

function createHomeCatalogApi() {
  const module =
    window.InfraHomeCatalog && typeof window.InfraHomeCatalog === "object" ? window.InfraHomeCatalog : null;
  const factory = module && typeof module.createHomeCatalog === "function" ? module.createHomeCatalog : null;
  if (!factory) return createNoopHomeCatalogApi();
  return factory({
    fallbackCatalog,
    catalogState,
    clipState,
    albumGridInitialBatch: ALBUM_GRID_INITIAL_BATCH,
    albumGridNextBatch: ALBUM_GRID_NEXT_BATCH,
    displayAlbumCardTitle,
    sanitizeCatalog,
    loadCatalogData,
    openAlbumCard: openHomeAlbumCard,
    isAudioBusyForIdleWork,
    trackAudioRuntimeEvent,
    toRuntimeAbsoluteUrl
  });
}

function createNoopHomeCatalogApi() {
  return {
    hydrateHomeCatalog: function () {
      return Promise.resolve();
    },
    initAlbumSwipeNavigation: function () {}
  };
}

function createAudioRadioApi() {
  const module =
    window.InfraAudioRadio && typeof window.InfraAudioRadio === "object" ? window.InfraAudioRadio : null;
  const factory = module && typeof module.createAudioRadio === "function" ? module.createAudioRadio : null;
  if (!factory) return createNoopAudioRadioApi();
  return factory({
    audioState,
    runtime,
    PREFETCH_NEXT_ENABLED,
    loadTracksData,
    toRuntimeAbsoluteUrl,
    normalizeAlbumTitle,
    normalizeTrackTitle,
    resolveManagedAudioSrc,
    getAudioAssetPathKey,
    formatTrackDuration,
    trackAudioRuntimeEvent,
    srcMatches,
    getCurrentLogicalAudioSrc,
    toAbsoluteUrlOrEmpty,
    getCurrentPlayableAudioSrc,
    normalizeAudioSourceUrl,
    isCloudflareAudioUrl,
    startNextTrackPrefetch,
    syncAudioUi,
    syncMediaSessionMetadata,
    getCurrentPlaylistTrack,
    syncPlaylistContext,
    buildPreservedTrack,
    playPrevious,
    playNext,
    startTrack,
    startRadioPlaybackFromIdle,
    getCurrentPlaylistIndexSafe,
    getRandomIndex,
    togglePlayPause,
    getCurrentTrackArtwork,
    getCurrentAlbumTitle,
    getCurrentTrackAlbumPage,
    toAbsoluteUrl,
    ensureCurrentIndexFromAudio,
    revokeActiveBlobUrl,
    clearFadeTimer,
    clearWaitingRecovery,
    readNowPlayingVolumeVisible,
    getSpaPersistRoot,
    configurePlaybackAudioSession,
    bindMediaSessionActions,
    ensureGlobalTransportUi,
    syncTransportUi,
    clearTrackFailureForCurrent,
    clearTrackStatus,
    getTrackByIndex,
    startAudioTelemetryHeartbeat,
    stopAudioTelemetryHeartbeat,
    markAudioTelemetryInactive,
    buildAudioMonitorPayload,
    getAudioBufferedEnd,
    syncCurrentTrackDurationFromAudio,
    maybePrefetchNextTrack,
    logAudioAuditEvent,
    setTrackStatus,
    scheduleWaitingRecovery,
    scheduleAlbumCoverCacheWarmup,
    getAudioRuntimeProbeState,
    confirmAudioRecovery,
    sendAudioMonitoringLog,
    recoverFromTrackFailure,
    updateProgressUi,
    isBlobObjectUrl,
    extendAlbumPlaylistToNextAlbum,
    extendAlbumPlaylistToPreviousAlbum,
    getQueuePreviewIndices,
    prefetchApi,
    PREFETCH_NEXT_CACHE_NAME,
    PREFETCH_NEXT_MAX_BYTES,
    PREFETCH_NEXT_THRESHOLD_SECONDS,
    PREFETCH_NEXT_SEGMENT_BYTES,
    PREFETCH_NEXT_QUEUE_DEPTH,
    PREFETCH_NEXT_CONCURRENCY,
    PREFETCH_NEXT_MAX_ENTRIES,
    PREFETCH_BUFFER_STABLE_SECONDS,
    PREFETCH_BUFFER_ABORT_SECONDS,
    PREFETCH_REQUEST_TIMEOUT_MS,
    PREFETCH_MAX_ATTEMPTS
  });
}

function createNoopAudioRadioApi() {
  return {
    readHomePlayMode: function () {},
    persistHomePlayMode: function () {},
    findPlaylistIndexByCurrentSrc: function () {},
    ensureRadioPlaylistLoaded: function () {},
    getTrackSource: function () {},
    getRecentPlayedSrcSet: function () {},
    shuffledCopy: function () {},
    buildRadioQueue: function () {},
    buildGlobalCatalogPlaylist: function () {},
    buildGlobalRandomPlaylistWithTelemetry: function () {},
    setGlobalCatalogPlaylist: function () {},
    startGlobalRandomPlayback: function () {},
    resetPreparedInitialGlobalRandomPlayback: function () {},
    consumePreparedInitialGlobalRandomPlaylist: function () {},
    shouldPrepareInitialGlobalRandomPlayback: function () {},
    prepareInitialGlobalRandomPlayback: function () {},
    scheduleInitialGlobalRandomPreparation: function () {},
    hasPlaybackSession: function () {},
    canStartInitialGlobalRandomPlayback: function () {},
    bindGlobalKeyboardShortcuts: function () {},
    clearRadioQueue: function () {},
    syncRadioQueueToPlaylist: function () {},
    ensureRadioQueue: function () {},
    injectCurrentTrackIntoRadioQueue: function () {},
    startSelectedTrackInRadioFromCold: function () {
      return false;
    },
    ensureRadioPlaylistForNavigation: function () {},
    setHomePlayMode: function () {},
    activateRadioModeFromTransport: function () {},
    toggleRadioModeFromTransport: function () {},
    toggleAlbumShuffleMode: function () {},
    clearStoredPlaybackState: function () {},
    buildAlbumPlaylistFromRadioCache: function () {},
    sanitizeQueueTrack: function () {},
    savePlaybackQueueContext: function () {},
    queueMatchesCurrentPage: function () {},
    restorePlaybackQueueContext: function () {},
    expandSingleTrackAlbumFromRadioCache: function () {},
    peekRadioNextIndexForPrefetch: function () {},
    saveResumeState: function () {},
    restoreResumeState: function () {},
    ensurePlayablePlaylistContext: function () {},
    markAudioPauseIntent: function () {},
    cancelSystemInterruptionResume: function () {},
    scheduleSystemInterruptionResumeAfterActive: function () {
      return false;
    },
    cancelExternalResumeCommand: function () {},
    playFromExternalControl: function () {},
    toggleCurrentPageCollection: function () {
      return false;
    },
    handleGlobalTransportToggle: function () {},
    ensureGlobalAudio: function () {},
    stopAudioRaf: function () {},
    startAudioRaf: function () {}
  };
}

function callAudioRadio(name, args) {
  const fn = audioRadioApi && typeof audioRadioApi[name] === "function" ? audioRadioApi[name] : null;
  return fn ? fn.apply(audioRadioApi, args || []) : undefined;
}

function createAudioCoreApi() {
  const module =
    window.InfraAudioCore && typeof window.InfraAudioCore === "object" ? window.InfraAudioCore : null;
  const factory = module && typeof module.createAudioCore === "function" ? module.createAudioCore : null;
  if (!factory) return createNoopAudioCoreApi();
  return factory({
    audioState,
    PREFETCH_NEXT_ENABLED,
    savePlaybackQueueContext,
    getCurrentLogicalAudioSrc,
    srcMatches,
    hashString,
    ensureRadioQueue,
    normalizeAudioSourceUrl,
    revokeActiveBlobUrl,
    loadMediaElementForPlayback,
    toAbsoluteUrlOrEmpty,
    getCurrentPlayableAudioSrc,
    registerTrackFailure,
    getTrackByIndex,
    setTrackStatus,
    clearFadeTimer,
    syncAudioUi,
    clearWaitingRecovery,
    clearOtherTrackStatuses,
    clearTrackStatus,
    getAudioTelemetryNow,
    getAudioAssetPath,
    trackAudioRuntimeEvent,
    buildAudioMonitorPayload,
    logAudioAuditEvent,
    getAudioSource,
    clearNextTrackPrefetch,
    resetPreparedInitialGlobalRandomPlayback,
    clearTrackFailure,
    fadeInAudio,
    forceAudioFullVolume,
    bindMediaSessionActions,
    syncMediaSessionMetadata,
    scheduleMediaSessionResync,
    startAudioRaf,
    fadeOutAudio,
    isIosDevice,
    scheduleSilentCheck,
    getAutoPrefetchedNextIndex,
    ensureRadioPlaylistForNavigation,
    ensurePlayablePlaylistContext,
    canStartInitialGlobalRandomPlayback,
    startGlobalRandomPlayback,
    ensureRadioPlaylistLoaded,
    syncRadioQueueToPlaylist,
    updateProgressUi,
    saveResumeState,
    markAudioPauseIntent,
    extendAlbumPlaylistToNextAlbum,
    extendAlbumPlaylistToPreviousAlbum,
    beginAudioRecovery,
    failAudioRecovery,
    maybePrefetchNextTrack,
    probeAudioSourceForRecovery
  });
}

function createNoopAudioCoreApi() {
  return {
    seekCurrentAudioToRatio: function () {},
    syncPlaylistContext: function () {},
    ensureCurrentIndexFromAudio: function () {
      return -1;
    },
    getCurrentPlaylistIndexSafe: function () {
      return -1;
    },
    getQueuePreviewIndices: function () {
      return [];
    },
    resetAudioElementForSource: function () {
      return false;
    },
    recoverFromTrackFailure: function () {},
    getRandomIndex: function () {
      return -1;
    },
    startTrack: function () {},
    playNext: function () {},
    playPrevious: function () {},
    movePlaylistItem: function () {
      return false;
    },
    startRadioPlaybackFromIdle: function () {},
    togglePlayPause: function () {}
  };
}

function createPwaInstallApi() {
  const module =
    window.InfraPwaInstall && typeof window.InfraPwaInstall === "object" ? window.InfraPwaInstall : null;
  const factory = module && typeof module.createPwaInstall === "function" ? module.createPwaInstall : null;
  if (!factory) return createNoopPwaInstallApi();
  return factory({
    pwaState,
    isIosDevice,
    isAndroidDevice,
    isStandaloneDisplayMode
  });
}

function createNoopPwaInstallApi() {
  return {
    getIosBrowserKind: function () {
      return "other";
    },
    getAndroidBrowserKind: function () {
      return "other";
    },
    getInstallBrowserKind: function () {
      return "other";
    },
    isSafariOnIos: function () {
      return false;
    },
    getPwaGuideContent: function () {
      return {
        text: "Sur mobile, installe INFRA depuis iPhone (Safari) ou Android (menu navigateur).",
        steps: [
          "iPhone: utilise Safari.",
          "Android: utilise le menu du navigateur.",
          "Ajoute l'app a l'ecran d'accueil."
        ]
      };
    },
    fillPwaGuide: function () {},
    readPwaChoice: function () {
      return "";
    },
    persistPwaChoice: function () {},
    ensurePwaInstallPromptUi: function () {
      return null;
    },
    initPwaInstallPrompt: function () {}
  };
}

function createSpaRendererApi() {
  const module =
    window.InfraSpaRenderer && typeof window.InfraSpaRenderer === "object" ? window.InfraSpaRenderer : null;
  const factory = module && typeof module.createSpaRenderer === "function" ? module.createSpaRenderer : null;
  if (!factory) return createNoopSpaRendererApi();
  return factory({
    spaState,
    audioState,
    spaRouterApi,
    COVERS_CACHE_NAME,
    COVER_SESSION_NAVIGATION_GATE_ENABLED,
    COVER_SESSION_PREPARE_ENABLED,
    setSpaCachedHtml,
    getSpaCachedHtml,
    getSpaPersistRoot,
    normalizeCoverElementsForBase,
    absolutizeSrcsetForBase,
    getAudioTelemetryNow,
    trackAudioRuntimeEvent,
    recordCacheObservation: audioTelemetryApi.recordCacheObservation,
    parseSrcsetCandidates,
    normalizeUrlAgainstBase,
    normalizeCoverUrl,
    prepareAlbumCoversForSession,
    rememberAlbumCoverImage,
    saveCurrentScrollPositionInHistory,
    commitSpaHistoryState,
    buildSpaHistoryState,
    getAlbumNameFromUrlLike,
    getCurrentAlbumTitle,
    createAlbumOpenTelemetryContext,
    finishAlbumOpenTelemetry,
    initPage,
    resumeLiveHomeRoute,
    logAudioRuntimeAlbumSwitch,
    getScrollFromHistoryState,
    prefetchSpaPage,
    loadSpaPageDocument,
    releasePwaCoverHold,
    disableNowPlayingOverlayUi,
    syncPersistentUiAfterSpaSwap,
    isStandaloneDisplayMode,
    isIosDevice,
    isAndroidDevice,
    getServiceWorkerReportedVersion: function () {
      return serviceWorkerReportedVersion;
    }
  });
}

function createNoopSpaRendererApi() {
  return {
    buildSpaSnapshotHtml: function () {
      return "";
    },
    snapshotCurrentSpaPage: function () {},
    parseSpaDocument: function (html) {
      const raw = String(html || "");
      if (!raw || typeof DOMParser !== "function") return null;
      const doc = new DOMParser().parseFromString(raw, "text/html");
      return doc && doc.body ? doc : null;
    },
    buildSpaDocumentFragment: function () {
      return document.createDocumentFragment();
    },
    getSpaCriticalImages: function () {
      return [];
    },
    decodeSpaImage: function () {
      return Promise.resolve(false);
    },
    decodeSpaCriticalImages: function () {
      return Promise.resolve();
    },
    getSpaAlbumCoverImage: function () {
      return null;
    },
    getImagePreferredSrc: function () {
      return "";
    },
    waitForSpaAlbumCoverReady: function () {
      return Promise.resolve();
    },
    swapSpaFragment: function () {
      return Promise.resolve();
    },
    renderSpaDocument: function () {
      return Promise.resolve();
    },
    spaNavigate: function (href) {
      window.location.href = href;
    }
  };
}

function callSpaRenderer(name, args) {
  const fn = spaRendererApi && typeof spaRendererApi[name] === "function" ? spaRendererApi[name] : null;
  return fn ? fn.apply(spaRendererApi, args || []) : undefined;
}

function buildSpaSnapshotHtml() {
  return callSpaRenderer("buildSpaSnapshotHtml", arguments);
}

function snapshotCurrentSpaPage() {
  return callSpaRenderer("snapshotCurrentSpaPage", arguments);
}

function parseSpaDocument() {
  return callSpaRenderer("parseSpaDocument", arguments);
}

function buildSpaDocumentFragment() {
  return callSpaRenderer("buildSpaDocumentFragment", arguments);
}

function getSpaCriticalImages() {
  return callSpaRenderer("getSpaCriticalImages", arguments);
}

function decodeSpaImage() {
  return callSpaRenderer("decodeSpaImage", arguments);
}

function decodeSpaCriticalImages() {
  return callSpaRenderer("decodeSpaCriticalImages", arguments);
}

function getSpaAlbumCoverImage() {
  return callSpaRenderer("getSpaAlbumCoverImage", arguments);
}

function getImagePreferredSrc() {
  return callSpaRenderer("getImagePreferredSrc", arguments);
}

function waitForSpaAlbumCoverReady() {
  return callSpaRenderer("waitForSpaAlbumCoverReady", arguments);
}

function swapSpaFragment() {
  return callSpaRenderer("swapSpaFragment", arguments);
}

function renderSpaDocument() {
  return callSpaRenderer("renderSpaDocument", arguments);
}

function spaNavigate() {
  return callSpaRenderer("spaNavigate", arguments);
}

function createAlbumPlayerUiApi() {
  const module =
    window.InfraAlbumPlayerUi && typeof window.InfraAlbumPlayerUi === "object"
      ? window.InfraAlbumPlayerUi
      : null;
  const factory =
    module && typeof module.createAlbumPlayerUi === "function" ? module.createAlbumPlayerUi : null;
  if (!factory) return createNoopAlbumPlayerUiApi();
  return factory({
    audioState,
    runtime,
    PLAYER_ICON_PLAY,
    PLAYER_ICON_STOP,
    PLAYER_ICON_PREVIOUS,
    PLAYER_ICON_NEXT,
    TRACK_CLICK_COOLDOWN_MS,
    getAudioAssetPathKey,
    fetchLiveCatalogDocument,
    isDurationsDocument,
    fetchLocalCatalogDocument,
    getTrackMetaByAssetPath,
    getCurrentLogicalAudioSrc,
    srcMatches,
    syncTransportUi,
    updateProgressUi,
    savePlaybackQueueContext,
    syncMediaSessionMetadata,
    ensureGlobalAudio,
    ensureAlbumHeaderActions,
    ensureAlbumFavoriteSelectionToolbar,
    toAbsoluteUrl,
    getCurrentAlbumTitle,
    resolveTracksAlbumArtwork,
    getAlbumCoverFromDoc,
    resolveManagedAudioSrc,
    normalizeFavoritePath,
    normalizeTrackTitle,
    ensureAlbumFavoriteControls,
    toggleAlbumFavoriteSelection,
    togglePlayPause,
    clearTrackFailure,
    resetAudioElementForSource,
    startTrack,
    syncPlaylistContext,
    playPrevious,
    playNext,
    toggleAlbumShuffleMode,
    bindGlobalKeyboardShortcuts,
    syncRadioQueueToPlaylist,
    buildPreservedTrack,
    injectCurrentTrackIntoRadioQueue,
    startSelectedTrackInRadioFromCold,
    toggleCurrentPageCollection,
    playCurrentPageCollectionShuffled: function () {
      return callAudioRadio("playCurrentPageCollectionShuffled", arguments);
    },
    isCurrentPagePlaylistActive: function (collection) {
      return callAudioRadio("isCurrentPagePlaylistActive", [collection]);
    }
  });
}

function createNoopAlbumPlayerUiApi() {
  return {
    formatTrackDuration: function (secondsValue) {
      const seconds = Number(secondsValue);
      if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
      const total = Math.round(seconds);
      return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
    },
    parseTrackDurationSeconds: function () {
      return 0;
    },
    updateAlbumTracksHeading: function () {},
    rememberTrackDuration: function () {},
    getCachedTrackDuration: function () {
      return "";
    },
    loadTrackDurationData: function () {
      return Promise.resolve({});
    },
    applyCachedTrackDurations: function () {},
    syncCurrentTrackDurationFromAudio: function () {},
    hydrateTrackDurations: function () {},
    createEqualizerHtml: function () {
      return "";
    },
    setRowPlaying: function () {},
    syncAudioUi: function () {
      syncTransportUi();
    },
    ensurePlaylistFromUi: function () {},
    prepareAlbumUiTrackForPlayback: function (_ui, index) {
      return index;
    },
    initMinimalPlayers: function () {},
    hydrateCurrentAlbumTrackRows: function () {}
  };
}

function callAlbumPlayerUi(name, args) {
  const fn = albumPlayerUiApi && typeof albumPlayerUiApi[name] === "function" ? albumPlayerUiApi[name] : null;
  return fn ? fn.apply(albumPlayerUiApi, args || []) : undefined;
}

function formatTrackDuration() {
  return callAlbumPlayerUi("formatTrackDuration", arguments);
}

function parseTrackDurationSeconds() {
  return callAlbumPlayerUi("parseTrackDurationSeconds", arguments);
}

function updateAlbumTracksHeading() {
  return callAlbumPlayerUi("updateAlbumTracksHeading", arguments);
}

function rememberTrackDuration() {
  return callAlbumPlayerUi("rememberTrackDuration", arguments);
}

function getCachedTrackDuration() {
  return callAlbumPlayerUi("getCachedTrackDuration", arguments);
}

function loadTrackDurationData() {
  return callAlbumPlayerUi("loadTrackDurationData", arguments);
}

function applyCachedTrackDurations() {
  return callAlbumPlayerUi("applyCachedTrackDurations", arguments);
}

function syncCurrentTrackDurationFromAudio() {
  return callAlbumPlayerUi("syncCurrentTrackDurationFromAudio", arguments);
}

function hydrateTrackDurations() {
  return callAlbumPlayerUi("hydrateTrackDurations", arguments);
}

function createEqualizerHtml() {
  return callAlbumPlayerUi("createEqualizerHtml", arguments);
}

function setRowPlaying() {
  return callAlbumPlayerUi("setRowPlaying", arguments);
}

function syncAudioUi() {
  return callAlbumPlayerUi("syncAudioUi", arguments);
}

function ensurePlaylistFromUi() {
  return callAlbumPlayerUi("ensurePlaylistFromUi", arguments);
}

function prepareAlbumUiTrackForPlayback() {
  return callAlbumPlayerUi("prepareAlbumUiTrackForPlayback", arguments);
}

function initMinimalPlayers() {
  return callAlbumPlayerUi("initMinimalPlayers", arguments);
}

function hydrateCurrentAlbumTrackRows() {
  return callAlbumPlayerUi("hydrateCurrentAlbumTrackRows", arguments);
}

function createNowPlayingApi() {
  const module =
    window.InfraNowPlaying && typeof window.InfraNowPlaying === "object" ? window.InfraNowPlaying : null;
  const factory = module && typeof module.createNowPlaying === "function" ? module.createNowPlaying : null;
  if (!factory) return createNoopNowPlayingApi();
  return factory({
    audioState,
    NOW_PLAYING_OVERLAY_ENABLED,
    isIosDevice,
    getThemePreset: function () {
      return themePresets[currentTheme] || themePresets.blanc;
    },
    getPwaStatusColor,
    isDarkColor,
    toAbsoluteUrlOrEmpty,
    getCurrentThemeColor,
    setThemeColor,
    syncPwaStatusColor,
    syncTransportUi,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    normalizeTrackTitle,
    normalizeAlbumTitle,
    getCurrentAlbumTitle,
    getCurrentTrackAlbumPage,
    resolveCoverUrl,
    setCoverWhenReady,
    getMediaSessionFallbackArtwork,
    setCoverBackgroundStable,
    syncCurrentFavoriteButtons,
    getCurrentPlaylistIndexSafe,
    getQueuePreviewIndices,
    mergeTrackMetadata,
    getTrackMetaByAssetPath,
    getCachedTrackDuration,
    getCurrentTrackArtwork,
    normalizeArtworkUrl,
    formatTrackDuration,
    trackAudioRuntimeEvent
  });
}

function createNoopNowPlayingApi() {
  return {
    readNowPlayingVolumeVisible: function () {
      return !isIosDevice();
    },
    persistNowPlayingVolumeVisible: function () {},
    setNowPlayingVolumeVisible: function () {},
    toggleNowPlayingVolumeVisible: function () {},
    getFallbackNowPlayingThemeColor: function () {
      return "#14141c";
    },
    extractImageThemeColor: function () {},
    applyNowPlayingThemeColor: function () {},
    restoreNowPlayingThemeColor: function () {
      syncPwaStatusColor();
    },
    prefersReducedMotion: function () {
      return false;
    },
    getNowPlayingMiniRect: function () {
      return null;
    },
    cancelNowPlayingPanelAnimations: function () {},
    animateNowPlayingPanel: function (_direction, done) {
      if (typeof done === "function") done();
    },
    disableNowPlayingOverlayUi: function () {},
    openNowPlayingOverlay: function () {},
    closeNowPlayingOverlay: function () {},
    setNowPlayingQueueOpen: function () {},
    syncNowPlayingOverlay: function () {},
    syncNowPlayingQueue: function () {},
    syncNowPlayingOverlayProgress: function () {}
  };
}

function callNowPlaying(name, args) {
  const fn = nowPlayingApi && typeof nowPlayingApi[name] === "function" ? nowPlayingApi[name] : null;
  return fn ? fn.apply(nowPlayingApi, args || []) : undefined;
}

function readNowPlayingVolumeVisible() {
  return callNowPlaying("readNowPlayingVolumeVisible", arguments);
}

function persistNowPlayingVolumeVisible() {
  return callNowPlaying("persistNowPlayingVolumeVisible", arguments);
}

function setNowPlayingVolumeVisible() {
  return callNowPlaying("setNowPlayingVolumeVisible", arguments);
}

function toggleNowPlayingVolumeVisible() {
  return callNowPlaying("toggleNowPlayingVolumeVisible", arguments);
}

function getFallbackNowPlayingThemeColor() {
  return callNowPlaying("getFallbackNowPlayingThemeColor", arguments);
}

function extractImageThemeColor() {
  return callNowPlaying("extractImageThemeColor", arguments);
}

function applyNowPlayingThemeColor() {
  return callNowPlaying("applyNowPlayingThemeColor", arguments);
}

function restoreNowPlayingThemeColor() {
  return callNowPlaying("restoreNowPlayingThemeColor", arguments);
}

function prefersReducedMotion() {
  return callNowPlaying("prefersReducedMotion", arguments);
}

function getNowPlayingMiniRect() {
  return callNowPlaying("getNowPlayingMiniRect", arguments);
}

function cancelNowPlayingPanelAnimations() {
  return callNowPlaying("cancelNowPlayingPanelAnimations", arguments);
}

function animateNowPlayingPanel() {
  return callNowPlaying("animateNowPlayingPanel", arguments);
}

function disableNowPlayingOverlayUi() {
  return callNowPlaying("disableNowPlayingOverlayUi", arguments);
}

function openNowPlayingOverlay() {
  return callNowPlaying("openNowPlayingOverlay", arguments);
}

function closeNowPlayingOverlay() {
  return callNowPlaying("closeNowPlayingOverlay", arguments);
}

function setNowPlayingQueueOpen() {
  return callNowPlaying("setNowPlayingQueueOpen", arguments);
}

function syncNowPlayingOverlay() {
  return callNowPlaying("syncNowPlayingOverlay", arguments);
}

function syncNowPlayingQueue() {
  return callNowPlaying("syncNowPlayingQueue", arguments);
}

function syncNowPlayingOverlayProgress() {
  return callNowPlaying("syncNowPlayingOverlayProgress", arguments);
}

function createTransportUiApi() {
  const module =
    window.InfraTransportUi && typeof window.InfraTransportUi === "object" ? window.InfraTransportUi : null;
  const factory = module && typeof module.createTransportUi === "function" ? module.createTransportUi : null;
  if (!factory) return createNoopTransportUiApi();
  return factory({
    audioState,
    spaState,
    DESKTOP_TRANSPORT_STORAGE_KEY,
    DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY,
    DESKTOP_TRANSPORT_MIN_WIDTH,
    DESKTOP_TRANSPORT_MIN_HEIGHT,
    DESKTOP_TRANSPORT_MARGIN,
    DESKTOP_TRANSPORT_DRAG_THRESHOLD,
    DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
    DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
    HEART_ICON_OUTLINE,
    RADIO_ICON,
    SHUFFLE_ICON,
    resolveCoverUrl,
    setCoverWhenReady,
    getCurrentPlaylistTrack,
    getMediaSessionFallbackArtwork,
    bindGlobalKeyboardShortcuts,
    getSpaPersistRoot,
    toggleRadioModeFromTransport,
    playPrevious,
    playNext,
    movePlaylistItem,
    handleGlobalTransportToggle,
    toggleAlbumShuffleMode,
    toggleCurrentFavorite,
    openNowPlayingOverlay,
    closeNowPlayingOverlay,
    disableNowPlayingOverlayUi,
    togglePlayPause,
    setNowPlayingQueueOpen,
    startTrack,
    toggleNowPlayingVolumeVisible,
    isIosDevice,
    seekCurrentAudioToRatio,
    updateProgressUi,
    syncNowPlayingOverlay,
    syncNowPlayingOverlayProgress,
    getCurrentPlayableAudioSrc,
    formatTrackDuration,
    ensurePlayablePlaylistContext,
    hasPlaybackSession,
    canStartInitialGlobalRandomPlayback,
    normalizeTrackTitle,
    normalizeAlbumTitle,
    getCurrentAlbumTitle,
    getCurrentTrackAlbumPage,
    syncCurrentFavoriteButtons,
    trackAudioRuntimeEvent,
    getRuntimeAssetUrl: function (path) {
      return new URL(String(path || ""), runtime.baseUrl).href;
    }
  });
}

function createNoopTransportUiApi() {
  return {};
}

function callTransportUi(name, args) {
  const fn = transportUiApi && typeof transportUiApi[name] === "function" ? transportUiApi[name] : null;
  return fn ? fn.apply(transportUiApi, args || []) : undefined;
}

function isDesktopTransportViewport() {
  return callTransportUi("isDesktopTransportViewport", arguments);
}

function getDesktopTransportState() {
  return callTransportUi("getDesktopTransportState", arguments);
}

function readDesktopTransportLayout() {
  return callTransportUi("readDesktopTransportLayout", arguments);
}

function writeDesktopTransportLayout() {
  return callTransportUi("writeDesktopTransportLayout", arguments);
}

function clampDesktopTransportLayout() {
  return callTransportUi("clampDesktopTransportLayout", arguments);
}

function clampDesktopTransportPosition() {
  return callTransportUi("clampDesktopTransportPosition", arguments);
}

function syncDesktopTransportCover() {
  return callTransportUi("syncDesktopTransportCover", arguments);
}

function applyDesktopTransportLayout() {
  return callTransportUi("applyDesktopTransportLayout", arguments);
}

function applyDesktopTransportPosition() {
  return callTransportUi("applyDesktopTransportPosition", arguments);
}

function clearDesktopTransportInlineStyles() {
  return callTransportUi("clearDesktopTransportInlineStyles", arguments);
}

function syncDesktopTransportLayout() {
  return callTransportUi("syncDesktopTransportLayout", arguments);
}

function isDesktopTransportPointer() {
  return callTransportUi("isDesktopTransportPointer", arguments);
}

function bindDesktopTransportUi() {
  return callTransportUi("bindDesktopTransportUi", arguments);
}

function ensureGlobalTransportUi() {
  return callTransportUi("ensureGlobalTransportUi", arguments);
}

function syncTransportMiniUi() {
  return callTransportUi("syncTransportMiniUi", arguments);
}

function syncMobilePlayerSpace() {
  return callTransportUi("syncMobilePlayerSpace", arguments);
}

function syncTransportUi() {
  return callTransportUi("syncTransportUi", arguments);
}

function syncPersistentUiAfterSpaSwap() {
  if (!document.body) return;
  document.documentElement.classList.toggle("pwa-standalone", isStandaloneDisplayMode());
  document.body.classList.toggle("ios-device", isIosDevice());
  // The status-bar/root colour depends on the destination route class.
  // Update it in the same DOM turn so iOS never paints the previous route's
  // background while the SPA waits for its first-paint RAF pair.
  syncPwaStatusColor();
  // The audio element and transport live in #infraSpaPersist. Reconcile the
  // existing nodes before the first destination paint; never create a new
  // transport or media element from the SPA swap itself.
  if (audioState.transport && audioState.transport.root) {
    syncTransportUi();
  }
}

export {
  normalizePwaHeadAssetLinks,
  createAudioTelemetryApi,
  createNoopAudioTelemetryApi,
  createHomeCatalogApi,
  createNoopHomeCatalogApi,
  createAudioRadioApi,
  createNoopAudioRadioApi,
  callAudioRadio,
  createAudioCoreApi,
  createNoopAudioCoreApi,
  createPwaInstallApi,
  createNoopPwaInstallApi,
  createSpaRendererApi,
  createNoopSpaRendererApi,
  callSpaRenderer,
  buildSpaSnapshotHtml,
  snapshotCurrentSpaPage,
  parseSpaDocument,
  buildSpaDocumentFragment,
  getSpaCriticalImages,
  decodeSpaImage,
  decodeSpaCriticalImages,
  getSpaAlbumCoverImage,
  getImagePreferredSrc,
  waitForSpaAlbumCoverReady,
  swapSpaFragment,
  renderSpaDocument,
  spaNavigate,
  createAlbumPlayerUiApi,
  createNoopAlbumPlayerUiApi,
  callAlbumPlayerUi,
  formatTrackDuration,
  parseTrackDurationSeconds,
  updateAlbumTracksHeading,
  rememberTrackDuration,
  getCachedTrackDuration,
  loadTrackDurationData,
  applyCachedTrackDurations,
  syncCurrentTrackDurationFromAudio,
  hydrateTrackDurations,
  createEqualizerHtml,
  setRowPlaying,
  syncAudioUi,
  ensurePlaylistFromUi,
  prepareAlbumUiTrackForPlayback,
  initMinimalPlayers,
  hydrateCurrentAlbumTrackRows,
  createNowPlayingApi,
  createNoopNowPlayingApi,
  callNowPlaying,
  readNowPlayingVolumeVisible,
  persistNowPlayingVolumeVisible,
  setNowPlayingVolumeVisible,
  toggleNowPlayingVolumeVisible,
  getFallbackNowPlayingThemeColor,
  extractImageThemeColor,
  applyNowPlayingThemeColor,
  restoreNowPlayingThemeColor,
  prefersReducedMotion,
  getNowPlayingMiniRect,
  cancelNowPlayingPanelAnimations,
  animateNowPlayingPanel,
  disableNowPlayingOverlayUi,
  openNowPlayingOverlay,
  closeNowPlayingOverlay,
  setNowPlayingQueueOpen,
  syncNowPlayingOverlay,
  syncNowPlayingQueue,
  syncNowPlayingOverlayProgress,
  createTransportUiApi,
  createNoopTransportUiApi,
  callTransportUi,
  isDesktopTransportViewport,
  getDesktopTransportState,
  readDesktopTransportLayout,
  writeDesktopTransportLayout,
  clampDesktopTransportLayout,
  clampDesktopTransportPosition,
  syncDesktopTransportCover,
  applyDesktopTransportLayout,
  applyDesktopTransportPosition,
  clearDesktopTransportInlineStyles,
  syncDesktopTransportLayout,
  isDesktopTransportPointer,
  bindDesktopTransportUi,
  ensureGlobalTransportUi,
  syncTransportMiniUi,
  syncMobilePlayerSpace,
  syncTransportUi,
  syncPersistentUiAfterSpaSwap
};
