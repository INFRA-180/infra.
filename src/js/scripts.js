// Lecteur et pages du site INFRA. — état partagé, réglages et séquence de démarrage (dans l'ordre d'origine).
// Les fonctions sont rangées par sujet dans runtime/ (chantier JavaScript d'INFRA, 10/11/2026).
import {
  callAudioRadio,
  createAlbumPlayerUiApi,
  createAudioCoreApi,
  createAudioRadioApi,
  createAudioTelemetryApi,
  createHomeCatalogApi,
  createNowPlayingApi,
  createPwaInstallApi,
  createSpaRendererApi,
  createTransportUiApi,
  normalizePwaHeadAssetLinks
} from "./runtime/module-bridges.js";
import { createFavoritesUiApi } from "./runtime/favorites-bridge.js";
import {
  consumePendingEarlyAlbumSwipeNavigation,
  createCatalogLoaderApi,
  initAlbumSwipeNavigation
} from "./runtime/catalog-playback.js";
import {
  applyWaitingServiceWorkerWhenIdle,
  beginPwaStorageObservation,
  isBusyForServiceWorkerUpdate,
  isIosDevice,
  isStandaloneDisplayMode,
  registerServiceWorker,
  rememberServiceWorkerReportedVersion,
  requestServiceWorkerUpdateCheck,
  serviceWorkerIdleUpdateRequested
} from "./runtime/theme-admin-pwa.js";
import { getCurrentPlaylistTrack, normalizeAudioSourceUrl } from "./runtime/audio-sources.js";
import { buildAudioMonitorPayload } from "./runtime/audio-monitor.js";
import { trackAudioRuntimeEvent } from "./runtime/playback.js";
import {
  disconnectLaunchPerformanceObservers,
  initPage,
  initSpaNavigation,
  markLaunchWatchdogComplete,
  reportLaunchSummary
} from "./runtime/page-init.js";

window.INFRA_BUILD_TAG = "audiofix450-20261113";

try {
  document.documentElement.dataset.build = window.INFRA_BUILD_TAG;
  document.documentElement.setAttribute("data-build", window.INFRA_BUILD_TAG);
  if (!window.INFRA_BUILD_LOGGED) {
    window.INFRA_BUILD_LOGGED = true;
    console.info("[INFRA] build", window.INFRA_BUILD_TAG);
  }
} catch (_err) {
  // Ignore build marker failures in unusual document states.
}

(function observeLaunchPerformance() {
  const probe =
    window.__infraLaunchProbe && typeof window.__infraLaunchProbe === "object"
      ? window.__infraLaunchProbe
      : null;
  if (!probe || typeof PerformanceObserver !== "function" || probe.performance_observers_started) return;
  probe.performance_observers_started = true;
  probe.performance_observers = [];
  try {
    const lcpObserver = new PerformanceObserver(function (list) {
      const entries = list.getEntries();
      const latest = entries[entries.length - 1];
      if (!latest) return;
      probe.largest_contentful_paint_ms = Math.max(0, Math.round(Number(latest.startTime) || 0));
      probe.lcp_available = true;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    probe.performance_observers.push(lcpObserver);
  } catch (_err) {
    probe.lcp_available = false;
  }
  try {
    probe.cumulative_layout_shift = 0;
    probe.cls_available = true;
    const clsObserver = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        if (!entry || entry.hadRecentInput) return;
        probe.cumulative_layout_shift += Number(entry.value) || 0;
      });
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    probe.performance_observers.push(clsObserver);
  } catch (_err) {
    probe.cls_available = false;
  }
  try {
    const inpObserver = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        probe.interaction_to_next_paint_ms = Math.max(
          Number(probe.interaction_to_next_paint_ms) || 0,
          Math.round(Number(entry && entry.duration) || 0)
        );
        probe.inp_available = true;
      });
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
    probe.performance_observers.push(inpObserver);
  } catch (_err) {
    probe.inp_available = false;
  }
})();

const infraDownloadsApi = window.InfraDownloads || {};

function normalizeDownloadUrl(rawUrl) {
  return typeof infraDownloadsApi.normalizeDownloadUrl === "function"
    ? infraDownloadsApi.normalizeDownloadUrl(rawUrl)
    : String(rawUrl || "")
        .replace(/&amp;/g, "&")
        .trim();
}

const themeStorageKey = "infra_theme_preset_v2";

const legacyThemeStorageKey = "infra_theme_preset_v1";

const legacyThemeMap = {
  marine: "blanc",
  rouge: "rouge-fluo",
  graphite: "bleu-fluo",
  violet: "vert-fluo",
  "orange-fluo": "orange-fluo"
};

const themePresets = {
  blanc: {
    "--accent": "#1a1a1a",
    "--ink": "#111111",
    "--ink-soft": "rgba(17, 17, 17, 0.66)",
    "--line": "rgba(17, 17, 17, 0.2)",
    "--bg-glow-1": "rgba(255, 255, 255, 0.9)",
    "--bg-glow-2": "rgba(255, 255, 255, 0.72)",
    "--bg-start": "#ffffff",
    "--bg-mid": "#f6f6f6",
    "--bg-end": "#ebebeb",
    "--overlay-bg": "rgba(10, 10, 10, 0.38)",
    "--panel-bg": "rgba(255, 255, 255, 0.96)",
    "--panel-border": "rgba(17, 17, 17, 0.22)",
    "--code-bg": "rgba(17, 17, 17, 0.08)",
    "--pill-bg": "#111111",
    "--pill-ink": "#ffffff"
  },
  "rouge-fluo": {
    "--accent": "#320b09",
    "--ink": "#1a0705",
    "--ink-soft": "rgba(26, 7, 5, 0.72)",
    "--line": "rgba(26, 7, 5, 0.22)",
    "--bg-glow-1": "rgba(247, 16, 10, 0.34)",
    "--bg-glow-2": "rgba(255, 112, 100, 0.26)",
    "--bg-start": "#fff3f2",
    "--bg-mid": "#ff6a63",
    "--bg-end": "#f7100a",
    "--overlay-bg": "rgba(26, 7, 5, 0.38)",
    "--panel-bg": "rgba(255, 243, 241, 0.94)",
    "--panel-border": "rgba(26, 7, 5, 0.24)",
    "--code-bg": "rgba(26, 7, 5, 0.09)",
    "--pill-bg": "#1a0705",
    "--pill-ink": "#ffffff"
  },
  "bleu-fluo": {
    "--accent": "#e8edff",
    "--ink": "#f7f9ff",
    "--ink-soft": "rgba(247, 249, 255, 0.78)",
    "--line": "rgba(233, 240, 255, 0.28)",
    "--bg-glow-1": "rgba(40, 64, 230, 0.3)",
    "--bg-glow-2": "rgba(0, 0, 152, 0.34)",
    "--bg-start": "#0f1798",
    "--bg-mid": "#0000b4",
    "--bg-end": "#000098",
    "--overlay-bg": "rgba(5, 7, 40, 0.44)",
    "--panel-bg": "rgba(11, 16, 108, 0.94)",
    "--panel-border": "rgba(233, 240, 255, 0.26)",
    "--code-bg": "rgba(233, 240, 255, 0.12)",
    "--pill-bg": "#f1f5ff",
    "--pill-ink": "#ffffff"
  },
  "vert-fluo": {
    "--accent": "#0b3a14",
    "--ink": "#082408",
    "--ink-soft": "rgba(8, 36, 8, 0.72)",
    "--line": "rgba(8, 36, 8, 0.22)",
    "--bg-glow-1": "rgba(1, 247, 0, 0.32)",
    "--bg-glow-2": "rgba(134, 255, 134, 0.28)",
    "--bg-start": "#efffeb",
    "--bg-mid": "#83ff82",
    "--bg-end": "#01f700",
    "--overlay-bg": "rgba(8, 36, 8, 0.38)",
    "--panel-bg": "rgba(241, 255, 241, 0.95)",
    "--panel-border": "rgba(8, 36, 8, 0.24)",
    "--code-bg": "rgba(8, 36, 8, 0.09)",
    "--pill-bg": "#082408",
    "--pill-ink": "#ffffff"
  },
  "orange-fluo": {
    "--accent": "#3a1700",
    "--ink": "#2a1100",
    "--ink-soft": "rgba(42, 17, 0, 0.72)",
    "--line": "rgba(42, 17, 0, 0.22)",
    "--bg-glow-1": "rgba(255, 106, 0, 0.34)",
    "--bg-glow-2": "rgba(255, 176, 110, 0.3)",
    "--bg-start": "#fff3ea",
    "--bg-mid": "#ffb06b",
    "--bg-end": "#ff6a00",
    "--overlay-bg": "rgba(42, 17, 0, 0.38)",
    "--panel-bg": "rgba(255, 244, 234, 0.95)",
    "--panel-border": "rgba(42, 17, 0, 0.24)",
    "--code-bg": "rgba(42, 17, 0, 0.09)",
    "--pill-bg": "#2a1100",
    "--pill-ink": "#ffffff"
  },
  "jaune-fluo": {
    "--accent": "#2f2900",
    "--ink": "#2a2400",
    "--ink-soft": "rgba(42, 36, 0, 0.72)",
    "--line": "rgba(42, 36, 0, 0.24)",
    "--bg-glow-1": "rgba(255, 232, 6, 0.3)",
    "--bg-glow-2": "rgba(255, 242, 84, 0.28)",
    "--bg-start": "#fffde8",
    "--bg-mid": "#fff250",
    "--bg-end": "#ffe806",
    "--overlay-bg": "rgba(33, 30, 0, 0.4)",
    "--panel-bg": "rgba(255, 253, 224, 0.95)",
    "--panel-border": "rgba(42, 36, 0, 0.24)",
    "--code-bg": "rgba(42, 36, 0, 0.1)",
    "--pill-bg": "#2a2400",
    "--pill-ink": "#ffffff"
  }
};

const spaRouterApi = window.InfraSpaRouter || null;

const spaRouterConstants = spaRouterApi && spaRouterApi.constants ? spaRouterApi.constants : {};

const spaState = {
  enabled:
    spaRouterApi && typeof spaRouterApi.isEnabled === "function"
      ? spaRouterApi.isEnabled(window.location)
      : window.location.protocol === "http:" || window.location.protocol === "https:",
  bound: false,
  controller: null,
  currentUrl: window.location.href,
  scrollSaveTimer: 0,
  scrollBound: false,
  lastHistoryUrl: "",
  lastHistoryScrollX: -1,
  lastHistoryScrollY: -1,
  pageCache: new Map(),
  pageCacheOrder: [],
  pageCacheLimit: Number.isFinite(Number(spaRouterConstants.PAGE_CACHE_LIMIT))
    ? Number(spaRouterConstants.PAGE_CACHE_LIMIT)
    : 40,
  prefetchingPages: new Set(),
  inflightPages: new Map(),
  lastNavHref: "",
  lastNavTs: 0,
  navToken: 0,
  navigationActive: false,
  activeNavigationHref: "",
  prepaintSyncActive: false,
  pwaCoverHold: null,
  liveHomeRoute: null,
  routeStack: [],
  pageCacheApi: null
};

const audioState = {
  audio: null,
  playlist: [],
  playlistKind: "album",
  currentIndex: -1,
  shuffleOn: false,
  suiteOn: true,
  homeMode: "album",
  homeModeInitialized: false,
  modeTransitionToken: 0,
  homeModeStorageKey: "infra_home_play_mode_v2",
  radioPlaylist: [],
  radioQueue: [],
  radioQueueCursor: -1,
  radioQueueBatchSize: 24,
  radioQueueMinRemaining: 5,
  radioQueueExtendBy: 10,
  radioLoadingPromise: null,
  radioNavigationPromise: null,
  radioNavigationRequest: null,
  albumContinuityNavigationRequest: null,
  tracksData: null,
  tracksLoadingPromise: null,
  albumPlaylistSnapshot: [],
  albumIndexSnapshot: -1,
  ui: null,
  transport: null,
  raf: null,
  fadeTimer: null,
  fadeResolve: null,
  prefetchLinks: new Map(),
  prefetchOrder: [],
  maxPrefetchLinks: isIosDevice() ? 8 : 12,
  proactivePrefetching: new Set(),
  prefetchPausedUntil: 0,
  restored: false,
  pendingSeekRatio: null,
  pendingStartTime: null,
  keyboardBound: false,
  resumeBound: false,
  resumeStorageKey: "infra_audio_resume_v1",
  queueStorageKey: "infra_playback_queue_v1",
  transportResizeBound: false,
  mediaSessionBound: false,
  lastMediaSessionKey: "",
  mediaSessionAudioPlaying: false,
  waitingRecoveryTimer: null,
  mediaSessionResyncTimer: null,
  mediaSessionPositionTs: 0,
  audioSessionTelemetryBound: false,
  audioSessionLastState: "",
  audioSessionInterruptedAt: 0,
  audioSessionResumeAllowedUntil: 0,
  externalPlaybackCommandSeq: 0,
  mediaCommandSequence: 0,
  audioInterruptionSequence: 0,
  externalPlaybackCommand: null,
  externalResumeProbeTimers: [],
  externalResumeRecoveryInFlight: false,
  activeAudioRecovery: null,
  resumeOnVisible: false,
  recentPlayed: [],
  recentPlayedLimit: 12,
  shuffleHistory: [],
  shuffleHistoryCursor: -1,
  shuffleSessionSeed: "",
  playlistToken: "",
  lastResumeSaveTs: 0,
  overlayEscapeBound: false,
  nowPlayingOpen: false,
  nowPlayingQueueOpen: false,
  nowPlayingScrollY: 0,
  nowPlayingSeeking: false,
  miniPlayerSeeking: false,
  nowPlayingVolumeSeeking: false,
  nowPlayingClosing: false,
  nowPlayingPreviousThemeColor: "",
  nowPlayingThemeArtwork: "",
  nowPlayingThemeToken: 0,
  nowPlayingMiniRect: null,
  nowPlayingVolumeVisible: false,
  nowPlayingVolumeStorageKey: "infra_now_playing_volume_visible_v1",
  transportPipOpen: false,
  transportPipOpening: false,
  desktopTransportState: null,
  trackFailureCounts: new Map(),
  trackDurationData: null,
  trackDurationLoadingPromise: null,
  trackMetaByAssetPath: new Map(),
  lastAutoSkipTs: 0,
  lastAutoAdvanceTs: 0,
  startRequestToken: 0,
  trackStartInFlight: false,
  lastTrackChangeTs: 0,
  activeLogicalSrc: "",
  sourceMetadataPending: false,
  activeBlobUrl: "",
  trackDurationCache: new Map(),
  activeStatusTrack: null,
  coverUpdateToken: 0,
  coverLoadPromises: new Map(),
  coverLoadResults: new Map(),
  playRequestTs: 0,
  playRequestToken: 0,
  playAbortRetryToken: 0,
  lastMonitorPlayToken: 0,
  lastAudioCurrentTime: 0,
  loggedCacheHitSrc: "",
  audioClickPerfTs: 0,
  currentTrackPath: "",
  initialRandomPlaylist: [],
  initialRandomFirstSrc: "",
  initialRandomReady: false,
  initialRandomPreparing: false,
  initialRandomPreparePromise: null,
  initialRandomPrepareToken: 0,
  nextPrefetchInFlight: false,
  nextPrefetchSrc: "",
  nextPrefetchIndex: -1,
  nextPrefetchFromIndex: -1,
  nextPrefetchToken: 0,
  nextPrefetchDoneSrc: "",
  nextPrefetchServedSrc: "",
  nextPrefetchAttemptedSrc: "",
  nextPrefetchFailedSrc: "",
  nextPrefetchFailureReason: "",
  nextPrefetchReadySrcs: new Set(),
  nextPrefetchAttemptCounts: new Map(),
  nextPrefetchInFlightSrcs: new Set(),
  nextPrefetchControllers: new Map(),
  nextPrefetchRetryTimers: new Map(),
  nextPrefetchPlan: [],
  nextPrefetchPlanKey: "",
  nextPrefetchGeneration: 0,
  nextPrefetchSuspendedReason: "",
  nextPrefetchWindowReadyKey: "",
  upcomingTrackPlan: null,
  upcomingTrackPlanGeneration: 0,
  spaSwitchContext: null,
  favoriteEntries: [],
  favoritePaths: new Set(),
  favoritesLoaded: false,
  favoritesLoadingPromise: null,
  favoritesDbSupported: true,
  favoritesStartInFlight: false,
  favoritesRouteBound: false,
  favoritesViewRendering: false,
  favoritesDragState: null,
  favoritesRenderStartTs: 0,
  favoritesSelectionMode: false,
  favoritesSelectedPaths: new Set(),
  favoritesPreloadScheduled: false,
  favoritesPreloadDone: false,
  favoritesResetPromise: null,
  favoritesResetApplied: false,
  favoritePendingPaths: new Set(),
  albumCoverCacheWarmupScheduled: false,
  albumCoverCacheWarmupDone: false,
  albumCoverWarmupResumePending: false,
  albumCoverPreparePromise: null,
  albumCoverReadyUrls: new Set(),
  albumCoverImageCache: new Map(),
  albumCoverPrimeUrls: new Set(),
  coverTelemetryRecent: new Map(),
  lastSavedQueueSignature: "",
  trackFailureRecovery: null,
  stallRecovery: null
};

const pwaState = {
  choiceStorageKey: "infra_pwa_install_choice_v1",
  sessionDismissed: false
};

const STORAGE_PERSIST_REQUEST_KEY = "infra_storage_persist_requested_v1";

const pwaInstallApi = createPwaInstallApi();

const NOW_PLAYING_OVERLAY_ENABLED = true;

const PLAYER_ICON_PLAY =
  '<svg class="player-glyph player-glyph-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

const PLAYER_ICON_STOP =
  '<svg class="player-glyph player-glyph-stop" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/></svg>';

const PLAYER_ICON_PREVIOUS =
  '<svg class="player-glyph player-glyph-prev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h3v12H6zM10 12l10-6v12z"/></svg>';

const PLAYER_ICON_NEXT =
  '<svg class="player-glyph player-glyph-next" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 12L4 6v12zM18 6h3v12h-3z"/></svg>';

const RADIO_ICON =
  '<svg class="radio-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="2.25" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8.4 15.6a5.1 5.1 0 0 1 0-7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2M5.2 18.8a9.6 9.6 0 0 1 0-13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/></svg>';

const SHUFFLE_ICON =
  '<svg class="shuffle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M3 6h2.7c2.25 0 3.75 1 5.15 3.15l2.3 3.7C14.55 15 16.05 16 18.3 16H21"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M3 18h2.7c1.8 0 3.1-.65 4.25-2.05"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M14.05 8.05C15.2 6.65 16.5 6 18.3 6H21"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="m18 3 3 3-3 3"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="m18 13 3 3-3 3"/></svg>';

const HEART_ICON_OUTLINE =
  '<svg class="heart-icon heart-icon-outline" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.566Z"/></svg>';

const HEART_ICON_FILLED =
  '<svg class="heart-icon heart-icon-filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.98 3.07a6 6 0 0 1 4.99 1.43l.03.03.04-.03a6 6 0 0 1 8.34 8.61l-.18.18-.05.04-7.45 7.38a1 1 0 0 1-1.31.08l-.09-.08-7.5-7.42A6 6 0 0 1 6.98 3.07Z"/></svg>';

const DOWNLOAD_ICON =
  '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>';

const SELECT_MODE_ICON =
  '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8.8 12.2 2.15 2.15 4.7-4.7"/><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>';

const DONE_MODE_ICON =
  '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M6 6l12 12M18 6 6 18"/></svg>';

const TRACK_CLICK_COOLDOWN_MS = 180;

const AUDIO_BASE = "https://infra180-api.pages.dev/audio";

// const AUDIO_FALLBACK = "off";
const prefetchApi = window.InfraAudioPrefetch || null;

const prefetchConstants = prefetchApi && prefetchApi.constants ? prefetchApi.constants : {};

const PREFETCH_NEXT_ENABLED = Object.prototype.hasOwnProperty.call(prefetchConstants, "ENABLED")
  ? Boolean(prefetchConstants.ENABLED)
  : true;

// ROLLBACK: passer a false pour couper les prefetchs N+1 et play froid sans toucher au play sync.
const PREFETCH_NEXT_CACHE_NAME = prefetchConstants.CACHE_NAME || "infra-next-track";

const coverApi = window.InfraCovers || null;

const coverConstants = coverApi && coverApi.constants ? coverApi.constants : {};

const COVERS_CACHE_NAME = coverConstants.CACHE_NAME || "infra-covers";

const COVER_SESSION_PREPARE_ENABLED = Object.prototype.hasOwnProperty.call(
  coverConstants,
  "SESSION_PREPARE_ENABLED"
)
  ? Boolean(coverConstants.SESSION_PREPARE_ENABLED)
  : true;

// ROLLBACK: passer a false pour revenir au warmup cache-only audiofix200.
const CONFIGURED_COVER_SESSION_PREPARE_CONCURRENCY = Number.isFinite(
  Number(coverConstants.SESSION_PREPARE_CONCURRENCY)
)
  ? Math.max(1, Number(coverConstants.SESSION_PREPARE_CONCURRENCY))
  : 3;

const COVER_SESSION_PREPARE_CONCURRENCY = isStandaloneDisplayMode()
  ? 1
  : CONFIGURED_COVER_SESSION_PREPARE_CONCURRENCY;

const COVER_SESSION_NAVIGATION_GATE_ENABLED = Object.prototype.hasOwnProperty.call(
  coverConstants,
  "SESSION_NAVIGATION_GATE_ENABLED"
)
  ? Boolean(coverConstants.SESSION_NAVIGATION_GATE_ENABLED)
  : true;

// ROLLBACK: passer a false pour ne plus attendre les covers avant ouverture album.
const ALBUM_COVER_IMAGE_CACHE_LIMIT = 4;

const ALBUM_COVER_PREPARE_LIMIT = 2;

const PREFETCH_NEXT_MAX_BYTES = Number.isFinite(Number(prefetchConstants.MAX_BYTES))
  ? Number(prefetchConstants.MAX_BYTES)
  : 2 * 1024 * 1024;

const PREFETCH_NEXT_THRESHOLD_SECONDS = Number.isFinite(Number(prefetchConstants.THRESHOLD_SECONDS))
  ? Number(prefetchConstants.THRESHOLD_SECONDS)
  : 30;

const PREFETCH_NEXT_SEGMENT_BYTES = Number.isFinite(Number(prefetchConstants.PREFETCH_SEGMENT_SIZE))
  ? Math.max(1, Number(prefetchConstants.PREFETCH_SEGMENT_SIZE))
  : 2 * 1024 * 1024;

const PREFETCH_NEXT_QUEUE_DEPTH = Number.isFinite(Number(prefetchConstants.QUEUE_DEPTH))
  ? Math.max(1, Number(prefetchConstants.QUEUE_DEPTH))
  : 5;

const PREFETCH_NEXT_CONCURRENCY = Number.isFinite(Number(prefetchConstants.CONCURRENCY))
  ? Math.max(1, Number(prefetchConstants.CONCURRENCY))
  : 2;

const PREFETCH_NEXT_MAX_ENTRIES = Number.isFinite(Number(prefetchConstants.MAX_ENTRIES))
  ? Math.max(PREFETCH_NEXT_QUEUE_DEPTH, Number(prefetchConstants.MAX_ENTRIES))
  : 6;

const PREFETCH_BUFFER_STABLE_SECONDS = 8;

const PREFETCH_BUFFER_ABORT_SECONDS = 4;

const PREFETCH_REQUEST_TIMEOUT_MS = 8000;

const PREFETCH_MAX_ATTEMPTS = 2;

const WORKER_URL = "https://infra180-api.pages.dev";

const SPA_SHELL_VERSION = "infra-shell-20261113-audio450";

const SPA_SHELL_CACHE_NAME = `${SPA_SHELL_VERSION}-shell`;

const SPA_PAGE_FETCH_TIMEOUT_MS = 2500;

const SPA_SCROLL_HISTORY_DEBOUNCE_MS = Number.isFinite(Number(spaRouterConstants.SCROLL_HISTORY_DEBOUNCE_MS))
  ? Math.max(100, Number(spaRouterConstants.SCROLL_HISTORY_DEBOUNCE_MS))
  : 240;

// Tie the live snapshot to the installed shell. A previous release may be
// structurally valid while still pointing at a cover URL removed by the
// current deployment; reusing that cache would overwrite the fresh Home.
const LIVE_CATALOG_CACHE_NAME = `${SPA_SHELL_VERSION}-catalog`;

const LIVE_CATALOG_TIMEOUT_MS = 3500;

const LOCAL_CATALOG_VERSION = "audiofix450-20261113";

const audioTelemetryModule = window.InfraAudioTelemetry || null;

const mediaSessionApi = window.InfraMediaSession || null;

const favoritesConstants =
  window.InfraFavorites && window.InfraFavorites.constants ? window.InfraFavorites.constants : {};

const FAVORITES_RESET_DB_MARKER =
  favoritesConstants.RESET_DB_MARKER || "__infra_favorites_reset_audiofix212__";

const DESKTOP_TRANSPORT_STORAGE_KEY = "infra_desktop_transport_layout_v2";

const DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY = "infra_desktop_transport_layout_v1";

const DESKTOP_TRANSPORT_MIN_WIDTH = 254;

const DESKTOP_TRANSPORT_MIN_HEIGHT = 116;

const DESKTOP_TRANSPORT_MARGIN = 8;

const DESKTOP_TRANSPORT_DRAG_THRESHOLD = 6;

const DESKTOP_TRANSPORT_COVER_MIN_WIDTH = 380;

const DESKTOP_TRANSPORT_COVER_MIN_HEIGHT = 150;

const runtimeVersion = "audiofix450-20261113";

const runtime = (function () {
  const scriptEl =
    document.currentScript ||
    Array.from(document.getElementsByTagName("script")).find((el) =>
      /(?:^|\/)scripts\.js(?:\?|$)/.test(String(el.src || ""))
    );
  let scriptUrl;
  try {
    scriptUrl = scriptEl && scriptEl.src ? new URL(scriptEl.src, window.location.href) : null;
  } catch (_err) {
    scriptUrl = null;
  }
  function getLocationSiteRootUrl() {
    const url = new URL(window.location.href);
    if (/\/(?:apps|music|sphragis)\/[^/]*$/i.test(url.pathname)) {
      return new URL("../", url.href);
    }
    return new URL("./", url.href);
  }
  const baseUrl = scriptUrl ? new URL("../../", scriptUrl.href) : getLocationSiteRootUrl();
  return {
    scriptUrl: scriptUrl || new URL("assets/js/scripts.js", baseUrl.href),
    baseUrl,
    query: (scriptUrl && scriptUrl.search) || `?v=${runtimeVersion}`
  };
})();

normalizePwaHeadAssetLinks();

const audioTelemetryApi = createAudioTelemetryApi();

const fallbackCatalog =
  window.InfraFallbackCatalog && typeof window.InfraFallbackCatalog === "object"
    ? window.InfraFallbackCatalog
    : { apps: [], albums: [], clips: [] };

const catalogState = {
  data: null,
  loadingPromise: null,
  quickActions: [],
  albumGridObserver: null,
  albumCoverObserver: null,
  albumGridScrollHandler: null
};

const ALBUM_GRID_INITIAL_BATCH = 8;

const ALBUM_GRID_NEXT_BATCH = 6;

const clipState = {
  clips: [],
  activeId: "",
  currentSrc: ""
};

const homeCatalogApi = createHomeCatalogApi();

const audioRadioApi = createAudioRadioApi();

const audioCoreApi = createAudioCoreApi();

const spaRendererApi = createSpaRendererApi();

const albumPlayerUiApi = createAlbumPlayerUiApi();

const nowPlayingApi = createNowPlayingApi();

const transportUiApi = createTransportUiApi();

const SERVICE_WORKER_UPDATE_CHECK_MIN_MS = 60000;

const favoritesUiApi = createFavoritesUiApi();

const catalogLoaderApi = createCatalogLoaderApi();

if (isStandaloneDisplayMode()) {
  ["pointerdown", "touchstart", "keydown"].forEach(function (eventName) {
    window.addEventListener(eventName, beginPwaStorageObservation, { capture: true, passive: true });
  });
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible") return;
  callAudioRadio("scheduleSystemInterruptionResumeAfterActive", ["visibility_sample"]);
  requestServiceWorkerUpdateCheck("visible");
  window.setTimeout(applyWaitingServiceWorkerWhenIdle, 1200);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!serviceWorkerIdleUpdateRequested) return;
    if (isBusyForServiceWorkerUpdate()) return;
    window.location.reload();
  });
  document.addEventListener(
    "pause",
    function (event) {
      if (event.target && event.target.tagName === "AUDIO")
        window.setTimeout(applyWaitingServiceWorkerWhenIdle, 1500);
    },
    true
  );
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", function (event) {
    const data = event && event.data ? event.data : null;
    if (!data) return;
    if (data.type === "INFRA_SW_VERSION") {
      rememberServiceWorkerReportedVersion(data.version);
      return;
    }
    if (data.type === "INFRA_AUDIO_NETWORK") {
      const src = normalizeAudioSourceUrl(data.url || "");
      if (!src) return;
      trackAudioRuntimeEvent(
        "audio_network_result",
        Object.assign(buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, src), {
          request_token: audioState.startRequestToken,
          reason: data.reason || "service_worker_network",
          strategy: data.strategy || "network_fallback",
          branch: data.branch || "unknown_response",
          result: data.result || "unknown",
          error_name: data.error_name || "",
          status: Number.isFinite(Number(data.status)) ? Number(data.status) : 0,
          response_ms: Number.isFinite(Number(data.response_ms)) ? Number(data.response_ms) : null,
          range: true,
          range_start: Number.isFinite(Number(data.range_start)) ? Number(data.range_start) : null,
          range_end: Number.isFinite(Number(data.range_end)) ? Number(data.range_end) : null,
          bytes: Number.isFinite(Number(data.bytes)) ? Number(data.bytes) : null,
          cached: false,
          cache_hint: "network",
          audio_fetch: true
        })
      );
      return;
    }
    if (data.type !== "INFRA_PREFETCH_HIT") return;
    const src = normalizeAudioSourceUrl(data.url || "");
    if (!src) return;
    audioState.nextPrefetchServedSrc = src;
    trackAudioRuntimeEvent(
      "served_from_prefetch",
      Object.assign(buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, src), {
        range: Boolean(data.range),
        range_header: data.range_header || "",
        range_start: Number.isFinite(Number(data.range_start)) ? Number(data.range_start) : null,
        range_end: Number.isFinite(Number(data.range_end)) ? Number(data.range_end) : null,
        bytes: Number.isFinite(Number(data.bytes)) ? Number(data.bytes) : null,
        status: Number.isFinite(Number(data.status)) ? Number(data.status) : 200,
        strategy: data.strategy || "segment_v9",
        client_id: data.client_id || ""
      })
    );
  });
}

audioTelemetryApi.initLifecycle();

document.addEventListener("DOMContentLoaded", function () {
  const initStartedAt =
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
  initAlbumSwipeNavigation();
  consumePendingEarlyAlbumSwipeNavigation();
  initSpaNavigation();
  registerServiceWorker();
  void initPage()
    .then(function () {
      return reportLaunchSummary(initStartedAt);
    })
    .catch(function () {
      const probe =
        window.__infraLaunchProbe && typeof window.__infraLaunchProbe === "object"
          ? window.__infraLaunchProbe
          : {};
      trackAudioRuntimeEvent("launch_summary", {
        launch_head_ms: Math.max(0, Math.round(Number(probe.head_ms) || 0)),
        dom_ready_ms: Math.max(0, Math.round(initStartedAt)),
        init_done_ms: 0,
        first_app_frame_ms: 0,
        app_ready_frame_ms: 0,
        previous_incomplete_launch_age_ms: Math.max(
          0,
          Math.round(Number(probe.previous_incomplete_launch_age_ms) || 0)
        ),
        catalog_ready: false,
        service_worker_controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
        document_was_discarded: Boolean(document.wasDiscarded),
        app_frame_ready: false,
        fcp_available: false,
        lcp_available: probe.lcp_available === true,
        cls_available: probe.cls_available === true,
        inp_available: probe.inp_available === true,
        previous_incomplete_launch: probe.previous_incomplete_launch === true,
        previous_launch_build: String(probe.previous_launch_build || ""),
        previous_launch_route_kind: String(probe.previous_launch_route_kind || ""),
        reason: "init_failed"
      });
      markLaunchWatchdogComplete(probe);
      disconnectLaunchPerformanceObservers(probe);
    });
});

export {
  infraDownloadsApi,
  normalizeDownloadUrl,
  themeStorageKey,
  legacyThemeStorageKey,
  legacyThemeMap,
  themePresets,
  spaRouterApi,
  spaState,
  audioState,
  pwaState,
  STORAGE_PERSIST_REQUEST_KEY,
  pwaInstallApi,
  NOW_PLAYING_OVERLAY_ENABLED,
  PLAYER_ICON_PLAY,
  PLAYER_ICON_STOP,
  PLAYER_ICON_PREVIOUS,
  PLAYER_ICON_NEXT,
  RADIO_ICON,
  SHUFFLE_ICON,
  HEART_ICON_OUTLINE,
  HEART_ICON_FILLED,
  DOWNLOAD_ICON,
  SELECT_MODE_ICON,
  DONE_MODE_ICON,
  TRACK_CLICK_COOLDOWN_MS,
  AUDIO_BASE,
  prefetchApi,
  PREFETCH_NEXT_ENABLED,
  PREFETCH_NEXT_CACHE_NAME,
  coverApi,
  COVERS_CACHE_NAME,
  COVER_SESSION_PREPARE_ENABLED,
  COVER_SESSION_PREPARE_CONCURRENCY,
  COVER_SESSION_NAVIGATION_GATE_ENABLED,
  ALBUM_COVER_IMAGE_CACHE_LIMIT,
  ALBUM_COVER_PREPARE_LIMIT,
  PREFETCH_NEXT_MAX_BYTES,
  PREFETCH_NEXT_THRESHOLD_SECONDS,
  PREFETCH_NEXT_SEGMENT_BYTES,
  PREFETCH_NEXT_QUEUE_DEPTH,
  PREFETCH_NEXT_CONCURRENCY,
  PREFETCH_NEXT_MAX_ENTRIES,
  PREFETCH_BUFFER_STABLE_SECONDS,
  PREFETCH_BUFFER_ABORT_SECONDS,
  PREFETCH_REQUEST_TIMEOUT_MS,
  PREFETCH_MAX_ATTEMPTS,
  WORKER_URL,
  SPA_SHELL_CACHE_NAME,
  SPA_PAGE_FETCH_TIMEOUT_MS,
  SPA_SCROLL_HISTORY_DEBOUNCE_MS,
  LIVE_CATALOG_CACHE_NAME,
  LIVE_CATALOG_TIMEOUT_MS,
  LOCAL_CATALOG_VERSION,
  audioTelemetryModule,
  mediaSessionApi,
  FAVORITES_RESET_DB_MARKER,
  DESKTOP_TRANSPORT_STORAGE_KEY,
  DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY,
  DESKTOP_TRANSPORT_MIN_WIDTH,
  DESKTOP_TRANSPORT_MIN_HEIGHT,
  DESKTOP_TRANSPORT_MARGIN,
  DESKTOP_TRANSPORT_DRAG_THRESHOLD,
  DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
  DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
  runtimeVersion,
  runtime,
  audioTelemetryApi,
  fallbackCatalog,
  catalogState,
  ALBUM_GRID_INITIAL_BATCH,
  ALBUM_GRID_NEXT_BATCH,
  clipState,
  homeCatalogApi,
  audioRadioApi,
  audioCoreApi,
  spaRendererApi,
  albumPlayerUiApi,
  nowPlayingApi,
  transportUiApi,
  SERVICE_WORKER_UPDATE_CHECK_MIN_MS,
  favoritesUiApi,
  catalogLoaderApi
};
