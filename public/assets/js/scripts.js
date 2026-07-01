window.INFRA_BUILD_TAG = "audiofix276-20260701";
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

const infraDownloadsApi = window.InfraDownloads || {};

function normalizeDownloadUrl(rawUrl) {
  return typeof infraDownloadsApi.normalizeDownloadUrl === "function"
    ? infraDownloadsApi.normalizeDownloadUrl(rawUrl)
    : String(rawUrl || "").replace(/&amp;/g, "&").trim();
}

function downloadNow(url) {
  if (typeof infraDownloadsApi.downloadNow === "function") {
    infraDownloadsApi.downloadNow(url);
  }
}

function openAppDownloadGatekeeper(appName, url) {
  if (typeof infraDownloadsApi.openAppDownloadGatekeeper === "function") {
    infraDownloadsApi.openAppDownloadGatekeeper(appName, url);
  } else {
    downloadNow(url);
  }
}

(function () {
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
  let currentTheme = "blanc";

  const spaRouterApi = window.InfraSpaRouter || null;
  const spaRouterConstants = spaRouterApi && spaRouterApi.constants
    ? spaRouterApi.constants
    : {};

  const spaState = {
    enabled: spaRouterApi && typeof spaRouterApi.isEnabled === "function"
      ? spaRouterApi.isEnabled(window.location)
      : (
          window.location.protocol === "http:" ||
          window.location.protocol === "https:"
        ),
    bound: false,
    controller: null,
    currentUrl: window.location.href,
    scrollSaveRaf: 0,
    scrollBound: false,
    pageCache: new Map(),
    pageCacheOrder: [],
    pageCacheLimit: Number.isFinite(Number(spaRouterConstants.PAGE_CACHE_LIMIT))
      ? Number(spaRouterConstants.PAGE_CACHE_LIMIT)
      : 30,
    prefetchingPages: new Set(),
    lastNavHref: "",
    lastNavTs: 0,
    navToken: 0,
    navigationActive: false,
    albumCoverPlaceholderByUrl: new Map(),
    pwaCoverHold: null,
    liveHomeRoute: null,
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
    homeModeStorageKey: "infra_home_play_mode_v2",
    radioPlaylist: [],
    radioQueue: [],
    radioQueueCursor: -1,
    radioQueueBatchSize: 24,
    radioQueueMinRemaining: 5,
    radioQueueExtendBy: 10,
    radioLoadingPromise: null,
    radioNavigationPromise: null,
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
    externalPlaybackCommandSeq: 0,
    externalPlaybackCommand: null,
    externalResumeProbeTimers: [],
    externalResumeRecoveryInFlight: false,
    activeAudioRecovery: null,
    resumeOnVisible: false,
    recentPlayed: [],
    recentPlayedLimit: 12,
    playlistToken: "",
    lastResumeSaveTs: 0,
    overlayEscapeBound: false,
    nowPlayingOpen: false,
    nowPlayingQueueOpen: false,
    nowPlayingScrollY: 0,
    nowPlayingSeeking: false,
    nowPlayingVolumeSeeking: false,
    nowPlayingClosing: false,
    nowPlayingPreviousThemeColor: "",
    nowPlayingThemeArtwork: "",
    nowPlayingThemeToken: 0,
    nowPlayingMiniRect: null,
    nowPlayingVolumeVisible: false,
    nowPlayingVolumeStorageKey: "infra_now_playing_volume_visible_v1",
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
    activeBlobUrl: "",
    trackDurationCache: new Map(),
    activeStatusTrack: null,
    coverUpdateToken: 0,
    playRequestTs: 0,
    playRequestToken: 0,
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
    homeFavoritesDelegatedBound: false,
    albumCoverCacheWarmupScheduled: false,
    albumCoverCacheWarmupDone: false,
    albumCoverPreparePromise: null,
    albumCoverReadyUrls: new Set(),
    albumCoverImageCache: new Map(),
    albumCoverPrimeUrls: new Set(),
    coverTelemetryRecent: new Map()
  };

  const pwaState = {
    choiceStorageKey: "infra_pwa_install_choice_v1",
    sessionDismissed: false
  };
  const pwaInstallApi = createPwaInstallApi();
  const NOW_PLAYING_OVERLAY_ENABLED = true;
  const PLAYER_ICON_PLAY = "<svg class=\"player-glyph player-glyph-play\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M8 5v14l11-7z\"/></svg>";
  const PLAYER_ICON_STOP = "<svg class=\"player-glyph player-glyph-stop\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1.5\" fill=\"currentColor\"/></svg>";
  const PLAYER_ICON_PREVIOUS = "<svg class=\"player-glyph player-glyph-prev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6 6h3v12H6zM10 12l10-6v12z\"/></svg>";
  const PLAYER_ICON_NEXT = "<svg class=\"player-glyph player-glyph-next\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M14 12L4 6v12zM18 6h3v12h-3z\"/></svg>";
  const RADIO_ICON = "<svg class=\"radio-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"2.25\" fill=\"currentColor\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"2\" d=\"M8.4 15.6a5.1 5.1 0 0 1 0-7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2M5.2 18.8a9.6 9.6 0 0 1 0-13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6\"/></svg>";
  const SHUFFLE_ICON = "<svg class=\"shuffle-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.15\" d=\"M3 6h2.7c2.25 0 3.75 1 5.15 3.15l2.3 3.7C14.55 15 16.05 16 18.3 16H21\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.15\" d=\"M3 18h2.7c1.8 0 3.1-.65 4.25-2.05\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.15\" d=\"M14.05 8.05C15.2 6.65 16.5 6 18.3 6H21\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.15\" d=\"m18 3 3 3-3 3\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.15\" d=\"m18 13 3 3-3 3\"/></svg>";
  const HEART_ICON_OUTLINE = "<svg class=\"heart-icon heart-icon-outline\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.9\" d=\"M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.566Z\"/></svg>";
  const HEART_ICON_FILLED = "<svg class=\"heart-icon heart-icon-filled\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6.98 3.07a6 6 0 0 1 4.99 1.43l.03.03.04-.03a6 6 0 0 1 8.34 8.61l-.18.18-.05.04-7.45 7.38a1 1 0 0 1-1.31.08l-.09-.08-7.5-7.42A6 6 0 0 1 6.98 3.07Z\"/></svg>";
  const DOWNLOAD_ICON = "<svg class=\"album-action-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 4v10m0 0 4-4m-4 4-4-4M5 19h14\"/></svg>";
  const SELECT_MODE_ICON = "<svg class=\"album-action-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m8.8 12.2 2.15 2.15 4.7-4.7\"/><circle cx=\"12\" cy=\"12\" r=\"8.25\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"/></svg>";
  const DONE_MODE_ICON = "<svg class=\"album-action-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.1\" d=\"M6 6l12 12M18 6 6 18\"/></svg>";
  const TRACK_CLICK_COOLDOWN_MS = 180;
  const AUDIO_BASE = "https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev";
  // const AUDIO_FALLBACK = "off";
  const prefetchApi = window.InfraAudioPrefetch || null;
  const prefetchConstants = prefetchApi && prefetchApi.constants ? prefetchApi.constants : {};
  const PREFETCH_NEXT_ENABLED = Object.prototype.hasOwnProperty.call(prefetchConstants, "ENABLED")
    ? Boolean(prefetchConstants.ENABLED)
    : true;
  // ROLLBACK: passer a false pour couper les prefetchs N+1 et play froid sans toucher au play sync.
  const PREFETCH_NEXT_CACHE_NAME = prefetchConstants.CACHE_NAME || "infra-next-track";
  const coverApi = window.InfraCovers || null;
  const coverConstants = coverApi && coverApi.constants
    ? coverApi.constants
    : {};
  const COVERS_CACHE_NAME = coverConstants.CACHE_NAME || "infra-covers";
  const COVER_SESSION_PREPARE_ENABLED = Object.prototype.hasOwnProperty.call(coverConstants, "SESSION_PREPARE_ENABLED")
    ? Boolean(coverConstants.SESSION_PREPARE_ENABLED)
    : true;
  // ROLLBACK: passer a false pour revenir au warmup cache-only audiofix200.
  const COVER_SESSION_PREPARE_CONCURRENCY = Number.isFinite(Number(coverConstants.SESSION_PREPARE_CONCURRENCY))
    ? Math.max(1, Number(coverConstants.SESSION_PREPARE_CONCURRENCY))
    : 3;
  const COVER_SESSION_NAVIGATION_GATE_ENABLED = Object.prototype.hasOwnProperty.call(coverConstants, "SESSION_NAVIGATION_GATE_ENABLED")
    ? Boolean(coverConstants.SESSION_NAVIGATION_GATE_ENABLED)
    : true;
  // ROLLBACK: passer a false pour ne plus attendre les covers avant ouverture album.
  const ALBUM_COVER_IMAGE_CACHE_LIMIT = isStandaloneDisplayMode() ? 12 : 24;
  const PWA_COVER_PREPARE_LIMIT = 8;
  const PREFETCH_NEXT_MAX_BYTES = Number.isFinite(Number(prefetchConstants.MAX_BYTES))
    ? Number(prefetchConstants.MAX_BYTES)
    : 15 * 1024 * 1024;
  const PREFETCH_NEXT_THRESHOLD_SECONDS = Number.isFinite(Number(prefetchConstants.THRESHOLD_SECONDS))
    ? Number(prefetchConstants.THRESHOLD_SECONDS)
    : 30;
  const WORKER_URL = "https://infra180-audio.zaccary-caillol.workers.dev";
  const LIVE_CATALOG_CACHE_NAME = "infra-live-catalog-v1";
  const LIVE_CATALOG_TIMEOUT_MS = 3500;
  const LOCAL_CATALOG_VERSION = "audiofix255-20260627";
  const audioTelemetryModule = window.InfraAudioTelemetry || null;

  function getAudioTelemetryNow() {
    return audioTelemetryModule && typeof audioTelemetryModule.now === "function"
      ? audioTelemetryModule.now()
      : (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());
  }
  const mediaSessionApi = window.InfraMediaSession || null;
  const favoritesConstants = window.InfraFavorites && window.InfraFavorites.constants
    ? window.InfraFavorites.constants
    : {};
  const FAVORITES_RESET_DB_MARKER = favoritesConstants.RESET_DB_MARKER || "__infra_favorites_reset_audiofix212__";
  const DESKTOP_TRANSPORT_STORAGE_KEY = "infra_desktop_transport_layout_v2";
  const DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY = "infra_desktop_transport_layout_v1";
  const DESKTOP_TRANSPORT_MIN_WIDTH = 254;
  const DESKTOP_TRANSPORT_MIN_HEIGHT = 116;
  const DESKTOP_TRANSPORT_MARGIN = 8;
  const DESKTOP_TRANSPORT_DRAG_THRESHOLD = 6;
  const DESKTOP_TRANSPORT_COVER_MIN_WIDTH = 380;
  const DESKTOP_TRANSPORT_COVER_MIN_HEIGHT = 150;
  const runtimeVersion = "audiofix276-20260701";
  const runtime = (function () {
    const scriptEl =
      document.currentScript ||
      Array.from(document.getElementsByTagName("script")).find((el) =>
        /(?:^|\/)scripts\.js(?:\?|$)/.test(String(el.src || ""))
      );
    let scriptUrl;
    try {
      scriptUrl = scriptEl && scriptEl.src
        ? new URL(scriptEl.src, window.location.href)
        : null;
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

  normalizePwaHeadAssetLinks();

  const audioTelemetryApi = createAudioTelemetryApi();

  function createAudioTelemetryApi() {
    const factory = audioTelemetryModule && typeof audioTelemetryModule.createTelemetry === "function"
      ? audioTelemetryModule.createTelemetry
      : null;
    if (!factory) return createNoopAudioTelemetryApi();
    return factory({
      fineTelemetryEnabled: true,
      getWorkerUrl: function () { return WORKER_URL; },
      getRuntimeVersion: function () { return runtimeVersion; },
      getAudioState: function () { return audioState; },
      getAudio: function () { return audioState.audio || null; },
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
      getBufferedEnd: function () { return null; },
      getRuntimeProbeState: function () { return {}; },
      flushQueue: function () { return Promise.resolve(false); },
      markHealthSessionInactive: function () {},
      startHeartbeat: function () {},
      stopHeartbeat: function () {},
      trackRuntimeEvent: function () {},
      sendMonitoringLog: function () {},
      logAuditEvent: function () {},
      hasPendingEvents: function () { return false; },
      initLifecycle: function () {}
    };
  }

  const fallbackCatalog = window.InfraFallbackCatalog && typeof window.InfraFallbackCatalog === "object"
    ? window.InfraFallbackCatalog
    : { apps: [], albums: [], clips: [] };
  const catalogState = {
    data: null,
    loadingPromise: null,
    quickActions: [],
    albumGridObserver: null,
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

  function createHomeCatalogApi() {
    const module = window.InfraHomeCatalog && typeof window.InfraHomeCatalog === "object"
      ? window.InfraHomeCatalog
      : null;
    const factory = module && typeof module.createHomeCatalog === "function"
      ? module.createHomeCatalog
      : null;
    if (!factory) return createNoopHomeCatalogApi();
    return factory({
      fallbackCatalog,
      catalogState,
      clipState,
      albumGridInitialBatch: ALBUM_GRID_INITIAL_BATCH,
      albumGridNextBatch: ALBUM_GRID_NEXT_BATCH,
      displayAlbumCardTitle,
      sanitizeCatalog,
      loadCatalogData
    });
  }

  function createNoopHomeCatalogApi() {
    return {
      hydrateHomeCatalog: function () { return Promise.resolve(); }
    };
  }


  const audioRadioApi = createAudioRadioApi();

  function createAudioRadioApi() {
    const module = window.InfraAudioRadio && typeof window.InfraAudioRadio === "object"
      ? window.InfraAudioRadio
      : null;
    const factory = module && typeof module.createAudioRadio === "function"
      ? module.createAudioRadio
      : null;
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
      scheduleDeferredServiceWorkerReload,
      syncCurrentTrackDurationFromAudio,
      maybePrefetchNextTrack,
      logAudioAuditEvent,
      setTrackStatus,
      scheduleWaitingRecovery,
      getAudioRuntimeProbeState,
      confirmAudioRecovery,
      sendAudioMonitoringLog,
      recoverFromTrackFailure,
      updateProgressUi,
      isBlobObjectUrl,
      extendAlbumPlaylistToNextAlbum,
      prefetchApi,
      PREFETCH_NEXT_CACHE_NAME,
      PREFETCH_NEXT_MAX_BYTES,
      PREFETCH_NEXT_THRESHOLD_SECONDS
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
      ensureRadioPlaylistForNavigation: function () {},
      setHomePlayMode: function () {},
      activateRadioModeFromTransport: function () {},
      toggleRadioModeFromTransport: function () {},
      toggleAlbumShuffleMode: function () {},
      clearStoredPlaybackState: function () {},
      cleanupIdleAudioContext: function () {},
      resetHomePlaybackModeIfIdle: function () {},
      cleanupForeignAlbumAudioWhenIdle: function () {},
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
      cancelExternalResumeCommand: function () {},
      playFromExternalControl: function () {},
      handleGlobalTransportToggle: function () {},
      ensureGlobalAudio: function () {},
      stopAudioRaf: function () {},
      startAudioRaf: function () {}
    };
  }

  function callAudioRadio(name, args) {
    const fn = audioRadioApi && typeof audioRadioApi[name] === "function"
      ? audioRadioApi[name]
      : null;
    return fn ? fn.apply(audioRadioApi, args || []) : undefined;
  }

  const audioCoreApi = createAudioCoreApi();

  function createAudioCoreApi() {
    const module = window.InfraAudioCore && typeof window.InfraAudioCore === "object"
      ? window.InfraAudioCore
      : null;
    const factory = module && typeof module.createAudioCore === "function"
      ? module.createAudioCore
      : null;
    if (!factory) return createNoopAudioCoreApi();
    return factory({
      audioState,
      PREFETCH_NEXT_ENABLED,
      savePlaybackQueueContext,
      getCurrentLogicalAudioSrc,
      srcMatches,
      extractFilenameFromSrc,
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
      beginAudioRecovery,
      failAudioRecovery
    });
  }

  function createNoopAudioCoreApi() {
    return {
      seekCurrentAudioToRatio: function () {},
      syncPlaylistContext: function () {},
      ensureCurrentIndexFromAudio: function () { return -1; },
      getCurrentPlaylistIndexSafe: function () { return -1; },
      getQueuePreviewIndices: function () { return []; },
      resetAudioElementForSource: function () { return false; },
      recoverFromTrackFailure: function () {},
      getRandomIndex: function () { return -1; },
      startTrack: function () {},
      playNext: function () {},
      playPrevious: function () {},
      movePlaylistItem: function () { return false; },
      startRadioPlaybackFromIdle: function () {},
      togglePlayPause: function () {}
    };
  }

  function createPwaInstallApi() {
    const module = window.InfraPwaInstall && typeof window.InfraPwaInstall === "object"
      ? window.InfraPwaInstall
      : null;
    const factory = module && typeof module.createPwaInstall === "function"
      ? module.createPwaInstall
      : null;
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
      getIosBrowserKind: function () { return "other"; },
      getAndroidBrowserKind: function () { return "other"; },
      getInstallBrowserKind: function () { return "other"; },
      isSafariOnIos: function () { return false; },
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
      readPwaChoice: function () { return ""; },
      persistPwaChoice: function () {},
      ensurePwaInstallPromptUi: function () { return null; },
      initPwaInstallPrompt: function () {}
    };
  }

  const spaRendererApi = createSpaRendererApi();

  function createSpaRendererApi() {
    const module = window.InfraSpaRenderer && typeof window.InfraSpaRenderer === "object"
      ? window.InfraSpaRenderer
      : null;
    const factory = module && typeof module.createSpaRenderer === "function"
      ? module.createSpaRenderer
      : null;
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
      parseSrcsetCandidates,
      normalizeUrlAgainstBase,
      prepareAlbumCoversForSession,
      rememberAlbumCoverImage,
      saveCurrentScrollPositionInHistory,
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
      releasePwaCoverHold,
      showPwaHomeReturnHold,
      isStandaloneDisplayMode,
      isIosDevice,
      isAndroidDevice
    });
  }

  function createNoopSpaRendererApi() {
    return {
      buildSpaSnapshotHtml: function () { return ""; },
      snapshotCurrentSpaPage: function () {},
      parseSpaDocument: function (html) {
        const raw = String(html || "");
        if (!raw || typeof DOMParser !== "function") return null;
        const doc = new DOMParser().parseFromString(raw, "text/html");
        return doc && doc.body ? doc : null;
      },
      buildSpaDocumentFragment: function () { return document.createDocumentFragment(); },
      getSpaCriticalImages: function () { return []; },
      decodeSpaImage: function () { return Promise.resolve(false); },
      decodeSpaCriticalImages: function () { return Promise.resolve(); },
      getSpaAlbumCoverImage: function () { return null; },
      getImagePreferredSrc: function () { return ""; },
      waitForSpaAlbumCoverReady: function () { return Promise.resolve(); },
      swapSpaFragment: function () { return Promise.resolve(); },
      renderSpaDocument: function () { return Promise.resolve(); },
      spaNavigate: function (href) { window.location.href = href; }
    };
  }

  function callSpaRenderer(name, args) {
    const fn = spaRendererApi && typeof spaRendererApi[name] === "function"
      ? spaRendererApi[name]
      : null;
    return fn ? fn.apply(spaRendererApi, args || []) : undefined;
  }

  function buildSpaSnapshotHtml() { return callSpaRenderer("buildSpaSnapshotHtml", arguments); }
  function snapshotCurrentSpaPage() { return callSpaRenderer("snapshotCurrentSpaPage", arguments); }
  function parseSpaDocument() { return callSpaRenderer("parseSpaDocument", arguments); }
  function buildSpaDocumentFragment() { return callSpaRenderer("buildSpaDocumentFragment", arguments); }
  function getSpaCriticalImages() { return callSpaRenderer("getSpaCriticalImages", arguments); }
  function decodeSpaImage() { return callSpaRenderer("decodeSpaImage", arguments); }
  function decodeSpaCriticalImages() { return callSpaRenderer("decodeSpaCriticalImages", arguments); }
  function getSpaAlbumCoverImage() { return callSpaRenderer("getSpaAlbumCoverImage", arguments); }
  function getImagePreferredSrc() { return callSpaRenderer("getImagePreferredSrc", arguments); }
  function waitForSpaAlbumCoverReady() { return callSpaRenderer("waitForSpaAlbumCoverReady", arguments); }
  function swapSpaFragment() { return callSpaRenderer("swapSpaFragment", arguments); }
  function renderSpaDocument() { return callSpaRenderer("renderSpaDocument", arguments); }
  function spaNavigate() { return callSpaRenderer("spaNavigate", arguments); }

  const albumPlayerUiApi = createAlbumPlayerUiApi();

  function createAlbumPlayerUiApi() {
    const module = window.InfraAlbumPlayerUi && typeof window.InfraAlbumPlayerUi === "object"
      ? window.InfraAlbumPlayerUi
      : null;
    const factory = module && typeof module.createAlbumPlayerUi === "function"
      ? module.createAlbumPlayerUi
      : null;
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
      cleanupForeignAlbumAudioWhenIdle,
      syncPlaylistContext,
      playPrevious,
      playNext,
      toggleAlbumShuffleMode,
      bindGlobalKeyboardShortcuts,
      syncRadioQueueToPlaylist,
      buildPreservedTrack,
      injectCurrentTrackIntoRadioQueue
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
      parseTrackDurationSeconds: function () { return 0; },
      updateAlbumTracksHeading: function () {},
      rememberTrackDuration: function () {},
      getCachedTrackDuration: function () { return ""; },
      loadTrackDurationData: function () { return Promise.resolve({}); },
      applyCachedTrackDurations: function () {},
      syncCurrentTrackDurationFromAudio: function () {},
      hydrateTrackDurations: function () {},
      createEqualizerHtml: function () { return ""; },
      setRowPlaying: function () {},
      syncAudioUi: function () { syncTransportUi(); },
      ensurePlaylistFromUi: function () {},
      prepareAlbumUiTrackForPlayback: function (_ui, index) { return index; },
      initMinimalPlayers: function () {},
      hydrateCurrentAlbumTrackRows: function () {}
    };
  }

  function callAlbumPlayerUi(name, args) {
    const fn = albumPlayerUiApi && typeof albumPlayerUiApi[name] === "function"
      ? albumPlayerUiApi[name]
      : null;
    return fn ? fn.apply(albumPlayerUiApi, args || []) : undefined;
  }

  function formatTrackDuration() { return callAlbumPlayerUi("formatTrackDuration", arguments); }
  function parseTrackDurationSeconds() { return callAlbumPlayerUi("parseTrackDurationSeconds", arguments); }
  function updateAlbumTracksHeading() { return callAlbumPlayerUi("updateAlbumTracksHeading", arguments); }
  function rememberTrackDuration() { return callAlbumPlayerUi("rememberTrackDuration", arguments); }
  function getCachedTrackDuration() { return callAlbumPlayerUi("getCachedTrackDuration", arguments); }
  function loadTrackDurationData() { return callAlbumPlayerUi("loadTrackDurationData", arguments); }
  function applyCachedTrackDurations() { return callAlbumPlayerUi("applyCachedTrackDurations", arguments); }
  function syncCurrentTrackDurationFromAudio() { return callAlbumPlayerUi("syncCurrentTrackDurationFromAudio", arguments); }
  function hydrateTrackDurations() { return callAlbumPlayerUi("hydrateTrackDurations", arguments); }
  function createEqualizerHtml() { return callAlbumPlayerUi("createEqualizerHtml", arguments); }
  function setRowPlaying() { return callAlbumPlayerUi("setRowPlaying", arguments); }
  function syncAudioUi() { return callAlbumPlayerUi("syncAudioUi", arguments); }
  function ensurePlaylistFromUi() { return callAlbumPlayerUi("ensurePlaylistFromUi", arguments); }
  function prepareAlbumUiTrackForPlayback() { return callAlbumPlayerUi("prepareAlbumUiTrackForPlayback", arguments); }
  function initMinimalPlayers() { return callAlbumPlayerUi("initMinimalPlayers", arguments); }
  function hydrateCurrentAlbumTrackRows() { return callAlbumPlayerUi("hydrateCurrentAlbumTrackRows", arguments); }

  const nowPlayingApi = createNowPlayingApi();

  function createNowPlayingApi() {
    const module = window.InfraNowPlaying && typeof window.InfraNowPlaying === "object"
      ? window.InfraNowPlaying
      : null;
    const factory = module && typeof module.createNowPlaying === "function"
      ? module.createNowPlaying
      : null;
    if (!factory) return createNoopNowPlayingApi();
    return factory({
      audioState,
      NOW_PLAYING_OVERLAY_ENABLED,
      isIosDevice,
      getThemePreset: function () { return themePresets[currentTheme] || themePresets.blanc; },
      getPwaStatusColor,
      isDarkColor,
      toAbsoluteUrlOrEmpty,
      getCurrentThemeColor,
      setThemeColor,
      syncPwaStatusColor,
      syncTransportUi,
      scheduleDeferredServiceWorkerReload,
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
      formatTrackDuration
    });
  }

  function createNoopNowPlayingApi() {
    return {
      readNowPlayingVolumeVisible: function () { return !isIosDevice(); },
      persistNowPlayingVolumeVisible: function () {},
      setNowPlayingVolumeVisible: function () {},
      toggleNowPlayingVolumeVisible: function () {},
      getFallbackNowPlayingThemeColor: function () { return "#14141c"; },
      extractImageThemeColor: function () {},
      applyNowPlayingThemeColor: function () {},
      restoreNowPlayingThemeColor: function () { syncPwaStatusColor(); },
      prefersReducedMotion: function () { return false; },
      getNowPlayingMiniRect: function () { return null; },
      cancelNowPlayingPanelAnimations: function () {},
      animateNowPlayingPanel: function (_direction, done) { if (typeof done === "function") done(); },
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
    const fn = nowPlayingApi && typeof nowPlayingApi[name] === "function"
      ? nowPlayingApi[name]
      : null;
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

  const transportUiApi = createTransportUiApi();

  function createTransportUiApi() {
    const module = window.InfraTransportUi && typeof window.InfraTransportUi === "object"
      ? window.InfraTransportUi
      : null;
    const factory = module && typeof module.createTransportUi === "function"
      ? module.createTransportUi
      : null;
    if (!factory) return createNoopTransportUiApi();
    return factory({
      audioState,
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
      syncCurrentFavoriteButtons
    });
  }

  function createNoopTransportUiApi() {
    return {};
  }

  function callTransportUi(name, args) {
    const fn = transportUiApi && typeof transportUiApi[name] === "function"
      ? transportUiApi[name]
      : null;
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


  let adminScriptPromise = null;
  let serviceWorkerRegistered = false;
  let serviceWorkerControllerChangeBound = false;
  let serviceWorkerControllerReloading = false;
  let serviceWorkerControllerReloadPending = false;
  let serviceWorkerControllerReloadTimer = 0;
  const pageOpenedAt = getAudioTelemetryNow();
  let serviceWorkerControllerChangeAt = 0;
  let serviceWorkerReloadExecutedAt = 0;
  let lastUserInteractionAt = getAudioTelemetryNow();
  let documentVisibleSinceAt = document.visibilityState === "visible" ? getAudioTelemetryNow() : 0;
  const SERVICE_WORKER_RELOAD_MIN_IDLE_MS = 8000;
  const SERVICE_WORKER_RELOAD_MIN_VISIBLE_MS = 2000;

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
    const raw = String(themeName || "").trim().toLowerCase();
    if (!raw) return "blanc";
    if (themePresets[raw]) return raw;
    if (legacyThemeMap[raw]) return legacyThemeMap[raw];
    return raw;
  }

  const favoritesUiApi = createFavoritesUiApi();

  function createFavoritesUiApi() {
    const module = window.InfraFavoritesUi && typeof window.InfraFavoritesUi === "object"
      ? window.InfraFavoritesUi
      : null;
    const factory = module && typeof module.createFavoritesUi === "function"
      ? module.createFavoritesUi
      : null;
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
    const fn = favoritesUiApi && typeof favoritesUiApi[name] === "function"
      ? favoritesUiApi[name]
      : null;
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

  function initHomeFavoritesButton() {
    return callFavoritesUi("initHomeFavoritesButton", arguments);
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

  function formatTotalDuration() {
    return callFavoritesUi("formatTotalDuration", arguments);
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


  const catalogLoaderApi = createCatalogLoaderApi();

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
      getCurrentLogicalAudioSrc
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
  function cleanupIdleAudioContext() {
    return callAudioRadio("cleanupIdleAudioContext", arguments);
  }
  function resetHomePlaybackModeIfIdle() {
    return callAudioRadio("resetHomePlaybackModeIfIdle", arguments);
  }
  function cleanupForeignAlbumAudioWhenIdle() {
    return callAudioRadio("cleanupForeignAlbumAudioWhenIdle", arguments);
  }
  function getQuickActions() {
    if (catalogState.quickActions.length) return catalogState.quickActions.slice();
    return buildQuickActions(sanitizeCatalog(fallbackCatalog));
  }

  async function hydrateHomeCatalog() {
    return homeCatalogApi.hydrateHomeCatalog();
  }

  function shouldInitAudioFeatures() {
    if (document.querySelector(".track-player")) return true;

    const persistRoot = document.getElementById("infraSpaPersist");
    if (persistRoot && (persistRoot.querySelector("audio") || persistRoot.querySelector(".global-transport"))) {
      return true;
    }

    try {
      const raw = sessionStorage.getItem(audioState.resumeStorageKey);
      if (raw) return true;
    } catch (_err) {
      // Ignore storage errors.
    }

    return false;
  }

  function getResourceTimingHint(urlLike, startedAt) {
    if (typeof performance === "undefined" || typeof performance.getEntriesByName !== "function") {
      return {};
    }
    const url = toAbsoluteUrlOrEmpty(urlLike || "");
    if (!url) return {};
    const entries = performance.getEntriesByName(url, "resource");
    if (!entries || !entries.length) return {};
    const minStart = Number(startedAt);
    const candidates = entries.filter(function (entry) {
      return !Number.isFinite(minStart) || Number(entry.startTime || 0) >= minStart - 100;
    });
    const entry = candidates.length ? candidates[candidates.length - 1] : entries[entries.length - 1];
    const transferSize = Number(entry.transferSize);
    const encodedBodySize = Number(entry.encodedBodySize);
    const decodedBodySize = Number(entry.decodedBodySize);
    let cacheHint = "unknown";
    if (Number.isFinite(transferSize)) {
      cacheHint = transferSize === 0 && (encodedBodySize > 0 || decodedBodySize > 0) ? "cache" : "network";
    }
    return {
      cache_hint: cacheHint,
      transfer_size: Number.isFinite(transferSize) ? transferSize : null,
      encoded_body_size: Number.isFinite(encodedBodySize) ? encodedBodySize : null,
      decoded_body_size: Number.isFinite(decodedBodySize) ? decodedBodySize : null
    };
  }

  function logCoverRuntimeEvent(type, payload, opts) {
    const eventType = String(type || "");
    const data = Object.assign({}, payload || {});
    if (eventType === "cover_request") {
      const now = getAudioTelemetryNow();
      const dedupeMs = Math.max(0, Number(opts && opts.dedupeMs) || 1200);
      const key = [
        eventType,
        data.source || "",
        data.album || "",
        data.track_path || "",
        data.cover_url || ""
      ].join("|");
      const last = Number(audioState.coverTelemetryRecent.get(key) || 0);
      if (last && now - last < dedupeMs) return false;
      audioState.coverTelemetryRecent.set(key, now);
      if (audioState.coverTelemetryRecent.size > 80) {
        const cutoff = now - 10000;
        audioState.coverTelemetryRecent.forEach(function (value, recentKey) {
          if (value < cutoff) audioState.coverTelemetryRecent.delete(recentKey);
        });
      }
    }
    trackAudioRuntimeEvent(eventType, data);
    return true;
  }

  function getAlbumCoverWarmupUrls(tracksData) {
    const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
    const urls = [];
    const seen = new Set();
    albums.forEach(function (album) {
      const raw = album && album.cover ? String(album.cover).trim() : "";
      if (!raw || !/(?:^|\/)assets\/music\/responsive\/[^/]+-cover-900\.webp(?:$|\?)/i.test(raw)) return;
      const variants = [
        raw.replace(/-cover-900\.webp(?:$|\?)/i, "-cover-480.webp"),
        raw
      ];
      variants.forEach(function (variant) {
        const url = toRuntimeAbsoluteUrl(variant);
        if (!url || seen.has(url)) return;
        seen.add(url);
        urls.push({
          url,
          album: normalizeAlbumTitle(album.title || album.slug || ""),
          width: /-cover-480\.webp(?:$|\?)/i.test(url) ? 480 : 900
        });
      });
    });
    // The catalogue now has 31 albums. Keep every responsive cover eligible so
    // late catalogue entries are not excluded from the persistent cover cache.
    return urls;
  }

  function getVisibleHomeCoverUrls() {
    const urls = [];
    const seen = new Set();
    const preferredWidth = isMobilePwaCoverNavigation() ? 480 : 900;
    Array.from(document.querySelectorAll("img.album-cover")).forEach(function (img) {
      const url = getImagePreferredSrc(img, window.location.href, { preferredWidth });
      if (!url || seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    });
    return urls;
  }

  function primeLinkedAlbumCoverForPwa(link, targetUrl) {
    if (!isMobilePwaCoverNavigation()) return "";
    if (!link || !targetUrl || !isAlbumOpenUrl(targetUrl)) return "";

    const img = typeof link.querySelector === "function"
      ? link.querySelector("img.album-cover, img.cover")
      : null;
    if (!img) return "";

    const srcset = img.getAttribute("srcset") || "";
    const preferred = choosePreferredSrcsetSource(srcset, 480)
      || img.currentSrc
      || String(img.getAttribute("src") || "").trim();
    const url = preferred ? normalizeCoverUrl(preferred, { width: 480 }) : "";
    if (!url) return "";

    spaState.albumCoverPlaceholderByUrl.set(new URL(targetUrl, window.location.href).href, url);
    while (spaState.albumCoverPlaceholderByUrl.size > 12) {
      const oldest = spaState.albumCoverPlaceholderByUrl.keys().next();
      if (oldest.done) break;
      spaState.albumCoverPlaceholderByUrl.delete(oldest.value);
    }

    if (audioState.albumCoverReadyUrls.has(url) || audioState.albumCoverPrimeUrls.has(url)) return url;

    audioState.albumCoverPrimeUrls.add(url);
    preloadImage(url, { highPriority: true }).then(function (result) {
      if (result && result.ok) {
        audioState.albumCoverReadyUrls.add(url);
      }
    }).catch(function () {});
    return url;
  }

  function releasePwaCoverHold(reason) {
    const hold = spaState.pwaCoverHold;
    if (!hold || !hold.node) {
      spaState.pwaCoverHold = null;
      return;
    }

    const reasonText = String(reason || "done");
    const forceRelease = /^(replace|timeout|home_return_timeout|stale_|.*_aborted|fallback|fetch_error)$/i.test(reasonText);
    const now = getAudioTelemetryNow();
    const minVisibleUntil = Number(hold.minVisibleUntil) || 0;
    if (!forceRelease && minVisibleUntil > now) {
      if (!hold.releaseTimer) {
        hold.releaseTimer = window.setTimeout(function () {
          if (spaState.pwaCoverHold === hold) {
            hold.releaseTimer = 0;
            releasePwaCoverHold(reasonText);
          }
        }, Math.max(0, Math.round(minVisibleUntil - now)));
      }
      return;
    }

    spaState.pwaCoverHold = null;
    if (hold.timer) {
      window.clearTimeout(hold.timer);
    }
    if (hold.releaseTimer) {
      window.clearTimeout(hold.releaseTimer);
    }
    const node = hold.node;
    const isHomeReturnHold = Boolean(node.classList && node.classList.contains("pwa-home-return-hold"));
    node.dataset.reason = reasonText;
    node.style.opacity = "0";
    node.style.transition = "opacity 70ms ease-out";
    window.setTimeout(function () {
      if (node && node.parentNode) node.parentNode.removeChild(node);
      if (isHomeReturnHold && document.documentElement) {
        document.documentElement.classList.remove("pwa-home-restore-active");
      }
    }, 90);
  }

  function showPwaCoverHold(link, coverSrc) {
    if (!isMobilePwaCoverNavigation()) return false;
    if (!link || typeof link.querySelector !== "function") return false;
    const image = link.querySelector("img.album-cover, img.cover");
    if (!image) return false;

    releasePwaCoverHold("replace");
    const rect = image.getBoundingClientRect();
    if (!rect || rect.width < 8 || rect.height < 8) return false;

    const url = normalizeCoverUrl(
      coverSrc || choosePreferredSrcsetSource(image.getAttribute("srcset") || "", 480) || image.currentSrc || image.src || "",
      { width: 480 }
    );
    if (!url) return false;

    const root = getSpaPersistRoot();
    const wrapper = document.createElement("div");
    wrapper.className = "pwa-cover-hold";
    wrapper.setAttribute("aria-hidden", "true");
    Object.assign(wrapper.style, {
      position: "fixed",
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
      zIndex: "11990",
      pointerEvents: "none",
      overflow: "hidden",
      borderRadius: window.getComputedStyle(image).borderRadius || "6px",
      background: "transparent",
      opacity: "1",
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)",
      contain: "layout paint style"
    });

    let visual = null;
    if (image.complete && image.naturalWidth > 0 && typeof document.createElement === "function") {
      try {
        const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          visual = canvas;
        }
      } catch (_err) {
        visual = null;
      }
    }

    if (!visual) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      Object.assign(img.style, {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain"
      });
      visual = img;
    }

    wrapper.appendChild(visual);
    root.appendChild(wrapper);
    spaState.pwaCoverHold = {
      node: wrapper,
      src: url,
      startedAt: getAudioTelemetryNow(),
      timer: window.setTimeout(function () {
        releasePwaCoverHold("timeout");
      }, 1400)
    };
    return true;
  }

  function getPwaHomeReturnHoldBackground() {
    try {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const start = rootStyles.getPropertyValue("--bg-start").trim() || "#ffffff";
      const mid = rootStyles.getPropertyValue("--bg-mid").trim() || start;
      const end = rootStyles.getPropertyValue("--bg-end").trim() || mid;
      return `linear-gradient(180deg, ${start} 0%, ${mid} 52%, ${end} 100%)`;
    } catch (_err) {
      return "#ffffff";
    }
  }

  function getComparablePwaSnapshotUrl(urlLike, baseUrl) {
    try {
      const url = new URL(String(urlLike || ""), baseUrl || window.location.href);
      return `${url.origin}${url.pathname}${url.search}`;
    } catch (_err) {
      return "";
    }
  }

  function findPwaSnapshotAlbumCard(route, state) {
    const fragment = route && route.fragment;
    if (!fragment || typeof fragment.querySelectorAll !== "function" || !state || !state.href) return null;
    const target = getComparablePwaSnapshotUrl(state.href, route.url || window.location.href);
    if (!target) return null;
    return Array.from(fragment.querySelectorAll("a.album-card[href]")).find(function (card) {
      return getComparablePwaSnapshotUrl(card.getAttribute("href"), route.url || window.location.href) === target;
    }) || null;
  }

  function createPwaSnapshotCoverVisual(route, state) {
    const card = findPwaSnapshotAlbumCard(route, state);
    const sourceImage = card && card.querySelector("img.album-cover");
    const width = Math.max(24, Math.round(Number(state && state.displayWidth) || 0));
    const height = Math.max(24, Math.round(Number(state && state.displayHeight) || width));

    if (sourceImage && sourceImage.complete && sourceImage.naturalWidth > 0) {
      try {
        const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
          return canvas;
        }
      } catch (_err) {
        // Fall back to a normal image below.
      }
    }

    const src = normalizeCoverUrl(state && state.source, { width: 480 });
    if (!src) return null;
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.setAttribute("fetchpriority", "high");
    image.src = src;
    Object.assign(image.style, {
      display: "block",
      width: `${width}px`,
      height: `${height}px`,
      objectFit: "contain"
    });
    return image;
  }

  function sanitizePwaHomeSnapshotClone(root, route) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("script, template, style, noscript").forEach(function (node) {
      node.remove();
    });
    root.querySelectorAll("[id]").forEach(function (node) {
      node.removeAttribute("id");
    });
    root.querySelectorAll("a[href]").forEach(function (node) {
      node.removeAttribute("href");
    });
    root.querySelectorAll("*").forEach(function (node) {
      Array.from(node.attributes || []).forEach(function (attribute) {
        if (/^data-/i.test(attribute.name)) node.removeAttribute(attribute.name);
      });
    });
    root.querySelectorAll("img").forEach(function (image) {
      const srcset = image.getAttribute("srcset") || "";
      const preferred = image.classList && image.classList.contains("album-cover")
        ? normalizeCoverUrl(
            choosePreferredSrcsetSource(srcset, 480) || image.getAttribute("src") || image.src || "",
            { width: 480 }
          )
        : normalizeUrlAgainstBase(image.getAttribute("src") || image.src || "", route && route.url);
      if (preferred) image.setAttribute("src", preferred);
      if (image.classList && image.classList.contains("album-cover")) {
        image.setAttribute("srcset", preferred ? `${preferred} 480w` : "");
        image.setAttribute("sizes", "480px");
      }
      image.setAttribute("loading", "eager");
      image.setAttribute("decoding", "async");
      image.setAttribute("fetchpriority", "high");
    });
  }

  function appendPwaHomeSnapshotChildren(target, route) {
    const fragment = route && route.fragment;
    if (!target || !fragment || typeof fragment.cloneNode !== "function") return 0;
    const clone = fragment.cloneNode(true);
    let count = 0;
    Array.from(clone.childNodes || []).forEach(function (node) {
      if (node.nodeType === 1) {
        const tagName = String(node.tagName || "").toLowerCase();
        if (/^(script|template|style|noscript)$/i.test(tagName)) return;
        if (node.id === "infraSpaPersist" || node.id === "infraPwaInstallModal") return;
      }
      target.appendChild(node);
      count += 1;
    });
    sanitizePwaHomeSnapshotClone(target, route);
    return count;
  }

  function showPwaHomeReturnHold(route, options) {
    if (!isMobilePwaCoverNavigation()) return false;
    const opts = options && typeof options === "object" ? options : { reason: options };
    const states = Array.isArray(route && route.coverStates)
      ? route.coverStates.filter(function (state) {
          return Boolean(state && state.source);
        }).slice(0, 10)
      : [];
    if (!route || !route.fragment) return false;

    releasePwaCoverHold("replace");
    const root = getSpaPersistRoot();
    const scrollY = Math.max(0, Math.round(Number(opts.scrollY) || Number(route.scrollY) || 0));
    const documentHeight = Math.max(
      window.innerHeight,
      Math.round(Number(route.documentHeight) || 0),
      scrollY + window.innerHeight
    );
    const wrapper = document.createElement("div");
    wrapper.className = "pwa-cover-hold pwa-home-return-hold";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.dataset.reason = String(opts.reason || "home_return");
    Object.assign(wrapper.style, {
      position: "fixed",
      inset: "0",
      zIndex: "11980",
      pointerEvents: "none",
      overflow: "hidden",
      background: getPwaHomeReturnHoldBackground(),
      opacity: "1",
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)",
      contain: "layout paint style"
    });

    const routeClasses = String(route.bodyClassName || "home-screen").split(/\s+/).filter(Boolean);
    const shell = document.createElement("div");
    shell.className = ["pwa-home-return-shell"].concat(routeClasses.filter(function (name) {
      return name !== "home-screen";
    })).join(" ");
    Object.assign(shell.style, {
      position: "absolute",
      left: "0",
      top: `${-scrollY}px`,
      width: "100%",
      minHeight: `${documentHeight}px`,
      pointerEvents: "none",
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)"
    });

    const page = document.createElement("div");
    page.className = "pwa-home-return-page home-screen";
    Object.assign(page.style, {
      position: "relative",
      width: "100%",
      minHeight: `${documentHeight}px`,
      pointerEvents: "none"
    });
    const clonedChildCount = appendPwaHomeSnapshotChildren(page, route);
    shell.appendChild(page);
    wrapper.appendChild(shell);

    const coverLayer = document.createElement("div");
    coverLayer.className = "pwa-home-return-cover-layer";
    Object.assign(coverLayer.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2",
      pointerEvents: "none",
      overflow: "hidden",
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)"
    });

    states.forEach(function (state) {
      const width = Math.max(24, Math.round(Number(state.displayWidth) || 0));
      const height = Math.max(24, Math.round(Number(state.displayHeight) || width));
      const left = Math.round(Number(state.viewportLeft) || 0);
      const top = Math.round(Number(state.viewportTop) || 0);
      if (top > window.innerHeight + 120 || top + height < -120) return;

      const visual = createPwaSnapshotCoverVisual(route, state);
      if (!visual) return;
      Object.assign(visual.style, {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        display: "block",
        objectFit: "contain",
        borderRadius: state.borderRadius || "6px",
        background: "rgba(17, 17, 17, 0.06)",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)"
      });
      coverLayer.appendChild(visual);
    });
    if (coverLayer.childNodes.length) wrapper.appendChild(coverLayer);

    if (!clonedChildCount && !coverLayer.childNodes.length) return false;
    if (document.documentElement) {
      document.documentElement.classList.add("pwa-home-restore-active");
    }
    root.appendChild(wrapper);
    const startedAt = getAudioTelemetryNow();
    spaState.pwaCoverHold = {
      node: wrapper,
      src: "home-return",
      startedAt,
      minVisibleUntil: startedAt + 320,
      timer: window.setTimeout(function () {
        releasePwaCoverHold("home_return_timeout");
      }, 1200)
    };
    return true;
  }

  function orderAlbumCoverWarmupUrls(covers) {
    const visible = getVisibleHomeCoverUrls();
    if (!visible.length) return covers;
    const rank = new Map();
    visible.forEach(function (url, index) {
      rank.set(url, index);
    });
    return covers.slice().sort(function (a, b) {
      const aRank = rank.has(a.url) ? rank.get(a.url) : 999 + covers.indexOf(a);
      const bRank = rank.has(b.url) ? rank.get(b.url) : 999 + covers.indexOf(b);
      return aRank - bRank;
    });
  }

  function limitAlbumCoverWarmupUrls(covers) {
    if (!Array.isArray(covers) || !covers.length) return [];
    if (!isMobilePwaCoverNavigation()) return covers;
    const pwaCovers = covers.filter(function (entry) {
      return entry && Number(entry.width) === 480;
    });
    const selected = pwaCovers.length ? pwaCovers : covers;
    return selected.slice(0, Math.min(PWA_COVER_PREPARE_LIMIT, selected.length));
  }

  function decodeCoverForSession(url) {
    return new Promise(function (resolve) {
      if (!url) {
        resolve(false);
        return;
      }
      if (audioState.albumCoverImageCache && audioState.albumCoverImageCache.has(url)) {
        const cachedImage = audioState.albumCoverImageCache.get(url);
        audioState.albumCoverImageCache.delete(url);
        audioState.albumCoverImageCache.set(url, cachedImage);
        audioState.albumCoverReadyUrls.add(url);
        resolve(true);
        return;
      }
      const image = new Image();
      image.decoding = "async";
      function remember() {
        rememberAlbumCoverImage(url, image);
        resolve(true);
      }
      image.onload = function () {
        if (typeof image.decode === "function") {
          image.decode().then(
            remember,
            remember
          );
          return;
        }
        remember();
      };
      image.onerror = function () {
        resolve(false);
      };
      image.src = url;
    });
  }

  function prepareAlbumCoverEntry(cache, entry, reason) {
    if (!entry || !entry.url) return Promise.resolve(false);
    if (audioState.albumCoverReadyUrls.has(entry.url)) return Promise.resolve(true);
    const startedAt = getAudioTelemetryNow();
    const request = new Request(entry.url, {
      method: "GET",
      credentials: "same-origin",
      cache: "default"
    });

    return cache.match(request).then(function (cached) {
      if (cached) return { response: cached, cacheHint: "cache" };
      logCoverRuntimeEvent("cover_request", {
        album: entry.album,
        source: "session_prepare",
        cover_url: entry.url,
        reason: reason || "session"
      }, { dedupeMs: 30000 });
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(function () {});
          return { response, cacheHint: "network" };
        }
        throw new Error("cover_prepare_http");
      });
    }).then(function (result) {
      return decodeCoverForSession(entry.url).then(function (decoded) {
        if (decoded) audioState.albumCoverReadyUrls.add(entry.url);
        trackAudioRuntimeEvent("cover_prepare_item", Object.assign({
          album: entry.album,
          cover_url: entry.url,
          width: entry.width || 0,
          cache_hint: result && result.cacheHint ? result.cacheHint : "unknown",
          decoded: Boolean(decoded),
          ready: audioState.albumCoverReadyUrls.has(entry.url),
          memory: Boolean(audioState.albumCoverImageCache && audioState.albumCoverImageCache.has(entry.url)),
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
          reason: reason || "session"
        }, getResourceTimingHint(entry.url, startedAt)));
        return Boolean(decoded);
      });
    }).catch(function (err) {
      trackAudioRuntimeEvent("cover_prepare_error", {
        album: entry.album,
        cover_url: entry.url,
        width: entry.width || 0,
        reason: reason || "session",
        error_name: err && err.name ? err.name : "Error",
        error_message: err && err.message ? err.message : "cover_prepare_failed"
      });
      return false;
    });
  }

  function shouldPauseCoverPrepareForPwaNavigation() {
    return Boolean(spaState.navigationActive && isMobilePwaCoverNavigation());
  }

  function rememberAlbumCoverImage(url, image) {
    if (!url) return;
    if (audioState.albumCoverReadyUrls && typeof audioState.albumCoverReadyUrls.add === "function") {
      audioState.albumCoverReadyUrls.add(url);
    }
    if (!image || !audioState.albumCoverImageCache || typeof audioState.albumCoverImageCache.set !== "function") return;
    if (audioState.albumCoverImageCache.has(url)) {
      audioState.albumCoverImageCache.delete(url);
    }
    audioState.albumCoverImageCache.set(url, image);
    while (audioState.albumCoverImageCache.size > ALBUM_COVER_IMAGE_CACHE_LIMIT) {
      const oldest = audioState.albumCoverImageCache.keys().next();
      if (oldest.done) break;
      audioState.albumCoverImageCache.delete(oldest.value);
      if (audioState.albumCoverReadyUrls && typeof audioState.albumCoverReadyUrls.delete === "function") {
        audioState.albumCoverReadyUrls.delete(oldest.value);
      }
    }
  }

  function prepareAlbumCoversForSession(reason) {
    if (!COVER_SESSION_PREPARE_ENABLED) return warmAlbumCoverCache(reason);
    if (audioState.albumCoverCacheWarmupDone) return Promise.resolve();
    if (audioState.albumCoverPreparePromise) return audioState.albumCoverPreparePromise;
    if (typeof caches === "undefined" || !caches.open) return Promise.resolve();

    audioState.albumCoverCacheWarmupScheduled = true;
    const startedAt = getAudioTelemetryNow();
    audioState.albumCoverPreparePromise = loadTracksData().then(function (tracksData) {
      const covers = limitAlbumCoverWarmupUrls(orderAlbumCoverWarmupUrls(getAlbumCoverWarmupUrls(tracksData)));
      if (!covers.length) {
        audioState.albumCoverCacheWarmupDone = true;
        return;
      }
      trackAudioRuntimeEvent("cover_prepare_start", {
        count: covers.length,
        reason: reason || "session"
      });
      return caches.open(COVERS_CACHE_NAME).then(function (cache) {
        let cursor = 0;
        let decodedCount = 0;
        const workerCount = Math.min(COVER_SESSION_PREPARE_CONCURRENCY, covers.length);
        const workers = Array.from({ length: workerCount }, function () {
          return Promise.resolve().then(function runNext() {
            if (shouldPauseCoverPrepareForPwaNavigation()) {
              audioState.albumCoverCacheWarmupScheduled = false;
              scheduleAlbumCoverCacheWarmup("nav_idle_resume");
              return;
            }
            const entry = covers[cursor];
            cursor += 1;
            if (!entry) return;
            return prepareAlbumCoverEntry(cache, entry, reason).then(function (decoded) {
              if (decoded) decodedCount += 1;
              return runNext();
            });
          });
        });
        return Promise.all(workers).then(function () {
          audioState.albumCoverCacheWarmupDone = audioState.albumCoverReadyUrls.size >= covers.length;
          trackAudioRuntimeEvent("cover_prepare_done", {
            count: covers.length,
            decoded_count: decodedCount,
            ready_count: audioState.albumCoverReadyUrls.size,
            memory_count: audioState.albumCoverImageCache ? audioState.albumCoverImageCache.size : 0,
            complete: Boolean(audioState.albumCoverCacheWarmupDone),
            duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
            reason: reason || "session"
          });
        });
      });
    }).catch(function (err) {
      trackAudioRuntimeEvent("cover_prepare_error", {
        reason: reason || "session",
        error_name: err && err.name ? err.name : "Error",
        error_message: err && err.message ? err.message : "cover_prepare_failed"
      });
    }).finally(function () {
      audioState.albumCoverCacheWarmupScheduled = false;
      audioState.albumCoverPreparePromise = null;
    });

    return audioState.albumCoverPreparePromise;
  }

  function warmAlbumCoverCache(reason) {
    if (COVER_SESSION_PREPARE_ENABLED) return prepareAlbumCoversForSession(reason || "warmup");
    if (audioState.albumCoverCacheWarmupDone) return Promise.resolve();
    if (typeof caches === "undefined" || !caches.open) return Promise.resolve();
    if (shouldPauseCoverPrepareForPwaNavigation()) {
      audioState.albumCoverCacheWarmupScheduled = false;
      scheduleAlbumCoverCacheWarmup("nav_idle_resume");
      return Promise.resolve();
    }
    return loadTracksData().then(function (tracksData) {
      const covers = limitAlbumCoverWarmupUrls(orderAlbumCoverWarmupUrls(getAlbumCoverWarmupUrls(tracksData)));
      if (!covers.length) {
        audioState.albumCoverCacheWarmupDone = true;
        return;
      }
      return caches.open(COVERS_CACHE_NAME).then(function (cache) {
        let chain = Promise.resolve();
        covers.forEach(function (entry, index) {
          chain = chain.then(function () {
            if (shouldPauseCoverPrepareForPwaNavigation()) {
              audioState.albumCoverCacheWarmupScheduled = false;
              scheduleAlbumCoverCacheWarmup("nav_idle_resume");
              throw new Error("cover_warmup_paused_for_navigation");
            }
            return new Promise(function (resolve) {
              setTimeout(resolve, index === 0 ? 0 : 45);
            }).then(function () {
              const request = new Request(entry.url, {
                method: "GET",
                credentials: "same-origin",
                cache: "default"
              });
              const startedAt = getAudioTelemetryNow();
              return cache.match(request).then(function (cached) {
                if (cached) {
                  logCoverRuntimeEvent("cover_loaded", {
                    album: entry.album,
                    source: "idle_prefetch",
                    cover_url: entry.url,
                    cache_hint: "cache",
                    duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
                    reason: reason || "idle"
                  });
                  return;
                }
                logCoverRuntimeEvent("cover_request", {
                  album: entry.album,
                  source: "idle_prefetch",
                  cover_url: entry.url,
                  reason: reason || "idle"
                }, { dedupeMs: 30000 });
                return fetch(request).then(function (response) {
                  if (response && response.ok) {
                    cache.put(request, response.clone()).catch(function () {});
                    logCoverRuntimeEvent("cover_loaded", Object.assign({
                      album: entry.album,
                      source: "idle_prefetch",
                      cover_url: entry.url,
                      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
                      reason: reason || "idle"
                    }, getResourceTimingHint(entry.url, startedAt)));
                  }
                });
              }).catch(function () {
                trackAudioRuntimeEvent("cover_error", {
                  album: entry.album,
                  source: "idle_prefetch",
                  cover_url: entry.url,
                  reason: reason || "idle"
                });
              });
            });
          });
        });
        return chain.then(function () {
          audioState.albumCoverCacheWarmupDone = true;
        });
      });
    }).catch(function () {});
  }

  function scheduleAlbumCoverCacheWarmup(reason) {
    if (audioState.albumCoverCacheWarmupScheduled || audioState.albumCoverCacheWarmupDone) return;
    audioState.albumCoverCacheWarmupScheduled = true;
    const run = function () {
      warmAlbumCoverCache(reason || "idle");
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 2200 });
      return;
    }
    window.setTimeout(run, 700);
  }

  function optimizeAlbumCoverImage() {
    if (!document.body.classList.contains("album-screen")) return;
    const cover = document.querySelector(".album-layout .cover");
    if (!cover) return;

    const rawSrc = String(cover.getAttribute("src") || "").trim();
    if (!rawSrc) return;
    const cleanSrc = rawSrc.split("?")[0];
    const match = cleanSrc.match(/^(.*\/assets\/music\/)([^/]+-cover)\.(?:jpg|jpeg|png)$/i);
    if (!match) return;

    const prefix = match[1];
    const base = match[2];
    const small = `${prefix}responsive/${base}-480.webp`;
    const large = `${prefix}responsive/${base}-900.webp`;
    const pwaCoverMode = isMobilePwaCoverNavigation();
    const coverStartedAt = getAudioTelemetryNow();
    logCoverRuntimeEvent("cover_request", {
      album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(window.location.href),
      source: "DOM",
      cover_url: rawSrc
    });

    function logCoverDone(type) {
      trackAudioRuntimeEvent(type, Object.assign({
        album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(window.location.href),
        source: "DOM",
        cover_url: cover.currentSrc || cover.src || rawSrc,
        duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt))
      }, getResourceTimingHint(cover.currentSrc || cover.src || rawSrc, coverStartedAt)));
    }

    if (!cover.dataset.audiofix113CoverTelemetry) {
      cover.dataset.audiofix113CoverTelemetry = "1";
      cover.addEventListener("load", function () {
        logCoverDone("cover_loaded");
      }, { once: true });
      cover.addEventListener("error", function () {
        logCoverDone("cover_error");
      }, { once: true });
    }

    if (pwaCoverMode) {
      cover.setAttribute("src", small);
      cover.setAttribute("srcset", `${small} 480w`);
      cover.setAttribute("sizes", "min(76vw, 290px)");
    } else {
      cover.setAttribute("srcset", `${small} 480w, ${large} 900w, ${rawSrc} 3333w`);
      cover.setAttribute("sizes", "(max-width: 980px) min(76vw, 290px), min(34vw, 430px)");
    }
    cover.setAttribute("decoding", "async");
    cover.setAttribute("fetchpriority", "high");
    cover.setAttribute("loading", "eager");
  }

  function isAdminModeEnabled() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return params.get("edit") === "1";
    } catch (_err) {
      return false;
    }
  }

  function applyAdminUiVisibility(isEnabled) {
    document.body.classList.toggle("admin-mode", Boolean(isEnabled));
    const adminNodes = Array.from(document.querySelectorAll("[data-admin-only]"));
    adminNodes.forEach((node) => {
      if (!isEnabled) {
        node.remove();
        return;
      }
      node.hidden = false;
    });

    if (!isEnabled) {
      const quickMenu = document.getElementById("quickMenu");
      if (quickMenu) {
        quickMenu.classList.remove("is-open");
        quickMenu.setAttribute("aria-hidden", "true");
      }
    }
  }

  function applyThemePreset(themeName, shouldPersist) {
    const normalizedName = normalizeThemeName(themeName);
    const key = themePresets[normalizedName] ? normalizedName : "blanc";
    const preset = themePresets[key];
    const root = document.documentElement;
    const body = document.body;

    Object.keys(preset).forEach((cssVar) => {
      root.style.setProperty(cssVar, preset[cssVar]);
      if (body) {
        body.style.setProperty(cssVar, preset[cssVar]);
      }
    });

    // Keep root/background inline styles minimal; CSS variables drive the fixed background canvas.
    root.style.backgroundColor = preset["--bg-end"];
    root.style.removeProperty("background");

    if (body) {
      body.style.color = preset["--ink"];
      body.style.removeProperty("background");
      body.style.removeProperty("background-color");
      body.style.removeProperty("background-image");
      body.style.removeProperty("background-repeat");
      body.style.removeProperty("background-size");
      body.style.removeProperty("background-attachment");
    }

    currentTheme = key;
    root.setAttribute("data-theme", key);
    if (body) body.setAttribute("data-theme", key);
    syncPwaStatusColor();

    if (shouldPersist) {
      try {
        localStorage.setItem(themeStorageKey, key);
      } catch (_err) {
        // Ignore write errors (private mode, disabled storage, etc.).
      }
    }
  }

  function isDarkColor(color) {
    const raw = String(color || "").trim();
    const match = raw.match(/^#([0-9a-f]{6})$/i);
    if (!match) return false;
    const value = match[1];
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    const luminance = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
    return luminance < 128;
  }

  function ensureMetaTag(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
    return meta;
  }

  function getPwaStatusColor(preset) {
    if (document.body && document.body.classList.contains("sphragis-screen")) return "#151515";
    if (document.body && document.body.classList.contains("album-screen")) return preset["--bg-mid"] || "#f6f6f6";
    return preset["--bg-start"] || "#ffffff";
  }

  function syncPwaStatusColor() {
    const preset = themePresets[currentTheme] || themePresets.blanc;
    const color = getPwaStatusColor(preset);
    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty("--pwa-status-bg", color);
    root.style.backgroundColor = color;
    if (body) {
      body.style.setProperty("--pwa-status-bg", color);
    }
    ensureMetaTag("theme-color", color);
    ensureMetaTag("apple-mobile-web-app-status-bar-style", "black-translucent");
  }

  function getCurrentThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const content = meta ? String(meta.getAttribute("content") || "").trim() : "";
    return content || "#111111";
  }

  function setThemeColor(color) {
    const safeColor = /^#[0-9a-f]{6}$/i.test(String(color || "").trim()) ? color : "#111111";
    ensureMetaTag("theme-color", safeColor);
  }

  function initThemePreset() {
    let saved = "blanc";
    try {
      const raw = localStorage.getItem(themeStorageKey) || localStorage.getItem(legacyThemeStorageKey);
      const normalized = normalizeThemeName(raw);
      if (normalized && themePresets[normalized]) saved = normalized;
    } catch (_err) {
      saved = "blanc";
    }
    applyThemePreset(saved, false);
  }

  function getAdminScriptUrl() {
    const path = `assets/js/scripts.admin.js${runtime.query}`;
    return new URL(path, runtime.baseUrl).href;
  }

  async function ensureAdminScriptLoaded() {
    if (window.InfraAdmin && typeof window.InfraAdmin.init === "function") {
      return window.InfraAdmin;
    }
    if (adminScriptPromise) return adminScriptPromise;

    adminScriptPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = getAdminScriptUrl();
      script.async = true;
      script.dataset.infraAdmin = "1";
      script.onload = function () { resolve(window.InfraAdmin); };
      script.onerror = function () { reject(new Error("admin script failed to load")); };
      document.head.appendChild(script);
    }).catch(function (err) {
      adminScriptPromise = null;
      throw err;
    });

    return adminScriptPromise;
  }

  async function initAdminFeatures() {
    try {
      await ensureAdminScriptLoaded();
    } catch (_err) {
      return;
    }

    if (!window.InfraAdmin || typeof window.InfraAdmin.init !== "function") return;
    window.InfraAdmin.init({
      navigateTo,
      getQuickActions,
      applyThemePreset,
      getCurrentTheme: function () { return currentTheme; }
    });
    applyAdminUiVisibility(true);
  }

  function teardownAdminFeatures() {
    if (window.InfraAdmin && typeof window.InfraAdmin.teardown === "function") {
      window.InfraAdmin.teardown();
    }
    applyAdminUiVisibility(false);
    purgeAdminUi();
  }

  function getServiceWorkerReloadState() {
    const now = getAudioTelemetryNow();
    const audio = audioState.audio;
    const audioPlaying = Boolean(audio && !audio.paused && getCurrentPlayableAudioSrc(audio));
    const trackStarting = Boolean(audioState.trackStartInFlight);
    const overlayOpen = Boolean(audioState.nowPlayingOpen || audioState.nowPlayingClosing);
    const visible = document.visibilityState === "visible";
    const idleForMs = Math.max(0, Math.round(now - lastUserInteractionAt));
    const visibleForMs = visible && documentVisibleSinceAt ? Math.max(0, Math.round(now - documentVisibleSinceAt)) : 0;
    return {
      audioPlaying,
      trackStarting,
      overlayOpen,
      visible,
      idleForMs,
      visibleForMs,
      idleSafe: idleForMs >= SERVICE_WORKER_RELOAD_MIN_IDLE_MS,
      visibleSafe: visibleForMs >= SERVICE_WORKER_RELOAD_MIN_VISIBLE_MS
    };
  }

  function buildServiceWorkerReloadTelemetry(extra) {
    const state = getServiceWorkerReloadState();
    return Object.assign({
      page_delta_ms: Math.max(0, Math.round(getAudioTelemetryNow() - pageOpenedAt)),
      controllerchange_delta_ms: serviceWorkerControllerChangeAt
        ? Math.max(0, Math.round(getAudioTelemetryNow() - serviceWorkerControllerChangeAt))
        : null,
      reload_executed_delta_ms: serviceWorkerReloadExecutedAt
        ? Math.max(0, Math.round(getAudioTelemetryNow() - serviceWorkerReloadExecutedAt))
        : null,
      visibility_state: document.visibilityState || "",
      idle_for_ms: state.idleForMs,
      visible_for_ms: state.visibleForMs,
      audio_playing: state.audioPlaying,
      track_starting: state.trackStarting,
      overlay_open: state.overlayOpen
    }, extra || {});
  }

  function isServiceWorkerReloadSafe() {
    const state = getServiceWorkerReloadState();
    return (
      state.visible &&
      state.idleSafe &&
      state.visibleSafe &&
      !state.audioPlaying &&
      !state.trackStarting &&
      !state.overlayOpen
    );
  }

  function getDeferredServiceWorkerReloadDelayMs() {
    const state = getServiceWorkerReloadState();
    if (!state.visible) return 0;
    if (state.audioPlaying || state.trackStarting || state.overlayOpen) return 0;
    return Math.max(
      180,
      SERVICE_WORKER_RELOAD_MIN_IDLE_MS - state.idleForMs + 180,
      SERVICE_WORKER_RELOAD_MIN_VISIBLE_MS - state.visibleForMs + 180
    );
  }

  function clearDeferredServiceWorkerReloadTimer() {
    if (!serviceWorkerControllerReloadTimer) return;
    window.clearTimeout(serviceWorkerControllerReloadTimer);
    serviceWorkerControllerReloadTimer = 0;
  }

  function attemptDeferredServiceWorkerReload() {
    clearDeferredServiceWorkerReloadTimer();
    if (!serviceWorkerControllerReloadPending || serviceWorkerControllerReloading) return;
    if (!isServiceWorkerReloadSafe()) {
      const delay = getDeferredServiceWorkerReloadDelayMs();
      if (delay > 0) scheduleDeferredServiceWorkerReload(delay);
      return;
    }
    serviceWorkerControllerReloadPending = false;
    serviceWorkerControllerReloading = true;
    serviceWorkerReloadExecutedAt = getAudioTelemetryNow();
    trackAudioRuntimeEvent("sw_reload_executed", buildServiceWorkerReloadTelemetry());
    flushAudioTelemetryQueue({ beacon: true });
    window.setTimeout(function () {
      window.location.reload();
    }, 80);
  }

  function scheduleDeferredServiceWorkerReload(delayMs) {
    if (!serviceWorkerControllerReloadPending || serviceWorkerControllerReloading) return;
    clearDeferredServiceWorkerReloadTimer();
    serviceWorkerControllerReloadTimer = window.setTimeout(
      attemptDeferredServiceWorkerReload,
      Math.max(0, Number(delayMs) || 180)
    );
  }

  function markServiceWorkerReloadPendingForRuntime() {
    try {
      const reloadKey = "infra_sw_controller_reload_runtime_v2";
      const previousRuntime = String(sessionStorage.getItem(reloadKey) || "").trim();
      if (previousRuntime === runtimeVersion) return false;
      sessionStorage.setItem(reloadKey, runtimeVersion);
    } catch (_err) {
      // Ignore storage errors; the in-memory pending flag still protects the session.
    }
    serviceWorkerControllerReloadPending = true;
    trackAudioRuntimeEvent("sw_reload_pending", buildServiceWorkerReloadTelemetry());
    return true;
  }

  function noteUserInteractionForServiceWorkerReload() {
    lastUserInteractionAt = getAudioTelemetryNow();
    if (serviceWorkerControllerReloadPending) {
      scheduleDeferredServiceWorkerReload(SERVICE_WORKER_RELOAD_MIN_IDLE_MS + 180);
    }
  }

  ["pointerdown", "touchstart", "click", "keydown", "scroll"].forEach(function (eventName) {
    window.addEventListener(eventName, noteUserInteractionForServiceWorkerReload, { passive: true });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    documentVisibleSinceAt = getAudioTelemetryNow();
    if (serviceWorkerControllerReloadPending) {
      scheduleDeferredServiceWorkerReload(SERVICE_WORKER_RELOAD_MIN_VISIBLE_MS + 180);
    }
  });

  function registerServiceWorker() {
    if (serviceWorkerRegistered) return;
    serviceWorkerRegistered = true;

    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    if (!serviceWorkerControllerChangeBound) {
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (serviceWorkerControllerReloading) return;
        serviceWorkerControllerChangeAt = getAudioTelemetryNow();
        trackAudioRuntimeEvent("sw_controllerchange", buildServiceWorkerReloadTelemetry());
        if (!markServiceWorkerReloadPendingForRuntime()) return;
        scheduleDeferredServiceWorkerReload();
      });
      serviceWorkerControllerChangeBound = true;
    }

    const swUrl = new URL(`sw.js${runtime.query}`, runtime.baseUrl).href;
    navigator.serviceWorker
      .register(swUrl, { scope: runtime.baseUrl.pathname })
      .then(function (registration) {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", function () {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller && registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(function () {
        // Ignore SW registration failures.
      });
  }

  function isIosDevice() {
    const ua = String(navigator.userAgent || "");
    if (/iPhone|iPad|iPod/i.test(ua)) return true;

    const platform = String(navigator.platform || "");
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    return platform === "MacIntel" && maxTouchPoints > 1;
  }

  function isAndroidDevice() {
    const ua = String(navigator.userAgent || "");
    return /Android/i.test(ua);
  }

  function isStandaloneDisplayMode() {
    const mediaStandalone = typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
    const legacyStandalone = typeof navigator.standalone === "boolean" ? navigator.standalone : false;
    return Boolean(mediaStandalone || legacyStandalone);
  }

  function isMobilePwaCoverNavigation() {
    if (!isStandaloneDisplayMode()) return false;
    const mobileDevice = isIosDevice() || isAndroidDevice();
    const mobileViewport = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 980px)").matches
      : window.innerWidth <= 980;
    return Boolean(mobileDevice || mobileViewport);
  }

  function getIosBrowserKind() {
    return pwaInstallApi.getIosBrowserKind();
  }

  function getAndroidBrowserKind() {
    return pwaInstallApi.getAndroidBrowserKind();
  }

  function getInstallBrowserKind() {
    return pwaInstallApi.getInstallBrowserKind();
  }

  function isSafariOnIos() {
    return pwaInstallApi.isSafariOnIos();
  }

  function getPwaGuideContent(browserKind) {
    return pwaInstallApi.getPwaGuideContent(browserKind);
  }

  function fillPwaGuide(guideText, guideSteps, browserKind) {
    return pwaInstallApi.fillPwaGuide(guideText, guideSteps, browserKind);
  }

  function readPwaChoice() {
    return pwaInstallApi.readPwaChoice();
  }

  function persistPwaChoice(choice) {
    return pwaInstallApi.persistPwaChoice(choice);
  }

  function ensurePwaInstallPromptUi() {
    return pwaInstallApi.ensurePwaInstallPromptUi();
  }

  function initPwaInstallPrompt(adminMode) {
    return pwaInstallApi.initPwaInstallPrompt(adminMode);
  }

  function navigateTo(href, options) {
    if (!spaState.enabled) {
      window.location.href = href;
      return;
    }
    spaNavigate(href, options);
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
    try {
      const x = window.scrollX || window.pageXOffset || 0;
      const y = window.scrollY || window.pageYOffset || 0;
      history.replaceState(buildSpaHistoryState(window.location.href, x, y), "", window.location.href);
    } catch (_err) {
      // Ignore history write failures.
    }
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
    if (!spaState.enabled) return;

    const opts = options || {};
    if (!opts.force && isAggressivePrefetchPaused()) return;

    if (spaState.pageCacheApi && typeof spaState.pageCacheApi.prefetch === "function") {
      spaState.pageCacheApi.prefetch(href, opts);
      return;
    }
  }

  function scheduleSpaPagePrefetch() {
    if (!spaState.enabled) return;

    const seen = new Set();
    const queue = [];
    const current = new URL(window.location.href);

    function enqueuePrefetchUrl(hrefLike) {
      let url = null;
      try {
        url = new URL(String(hrefLike || ""), window.location.href);
      } catch (_err) {
        return;
      }
      if (!isSpaNavigableUrl(url)) return;

      const key = getSpaPageCacheKey(url);
      if (!key || seen.has(key)) return;
      if (url.pathname === current.pathname && url.search === current.search) return;
      seen.add(key);
      queue.push(url.href);
    }

    const links = Array.from(document.querySelectorAll("a[href]"));
    links.forEach(function (link) {
      const href = String(link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      enqueuePrefetchUrl(link.href);
    });

    const isHome = document.body.classList.contains("home-screen");
    if (!isHome) {
      const homeHref = new URL("index.html", runtime.baseUrl).href;
      const homeKey = getSpaPageCacheKey(homeHref);
      if (homeKey && !seen.has(homeKey)) queue.unshift(homeHref);
    }

    const scheduleQueue = function () {
      if (!queue.length) return;
      const playbackActive = isAudioPlaybackActive();
      let limit = isHome ? 21 : 8;
      if (isIosDevice()) {
        limit = Math.min(limit, isHome ? 8 : 5);
      }
      if (playbackActive) {
        limit = Math.min(limit, isIosDevice() ? 5 : 7);
      }
      if (isAggressivePrefetchPaused()) {
        limit = Math.min(limit, 2);
      }
      queue.slice(0, limit).forEach(function (href, index) {
        setTimeout(function () {
          prefetchSpaPage(href);
        }, index * 90);
      });
    };

    const run = function () {
      if (!isHome) {
        scheduleQueue();
        return;
      }

      loadTracksData()
        .then(function (tracksData) {
          const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
          albums.forEach(function (album) {
            const page = album && album.page
              ? album.page
              : (album && album.slug ? `music/${album.slug}.html` : "");
            if (!page) return;
            enqueuePrefetchUrl(new URL(page, runtime.baseUrl).href);
          });
          scheduleQueue();
        })
        .catch(function () {
          scheduleQueue();
        });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(function () {
        run();
      }, { timeout: 1200 });
      return;
    }

    setTimeout(run, 120);
  }

  function getSpaPersistRoot() {
    let root = document.getElementById("infraSpaPersist");
    if (root) return root;

    root = document.createElement("div");
    root.id = "infraSpaPersist";
    document.body.insertBefore(root, document.body.firstChild);
    return root;
  }

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

  function extractFilenameFromSrc(value) {
    const raw = normalizeSrcValue(value);
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.href);
      const path = decodeURIComponent(url.pathname || "");
      const parts = path.split("/");
      return String(parts[parts.length - 1] || "").toLowerCase();
    } catch (_err) {
      const plain = decodeURIComponent(raw.split("?")[0].split("#")[0]);
      const parts = plain.split("/");
      return String(parts[parts.length - 1] || "").toLowerCase();
    }
  }

  function buildSrcTokens(value) {
    const raw = normalizeSrcValue(value);
    if (!raw) return [];
    const tokens = new Set();
    tokens.add(raw);
    tokens.add(raw.toLowerCase());

    try {
      const url = new URL(raw, window.location.href);
      const href = String(url.href || "").trim();
      const pathname = String(url.pathname || "").trim();
      const decodedPath = decodeURIComponent(pathname || "");
      const pathWithSearch = `${pathname}${url.search || ""}`;
      const decodedWithSearch = `${decodedPath}${url.search || ""}`;

      [href, decodeURIComponent(href), pathname, decodedPath, pathWithSearch, decodedWithSearch].forEach((token) => {
        const normalized = String(token || "").trim();
        if (!normalized) return;
        tokens.add(normalized);
        tokens.add(normalized.toLowerCase());
      });
    } catch (_err) {
      const plain = raw.split("#")[0];
      const noQuery = plain.split("?")[0];
      [plain, noQuery, decodeURIComponent(plain), decodeURIComponent(noQuery)].forEach((token) => {
        const normalized = String(token || "").trim();
        if (!normalized) return;
        tokens.add(normalized);
        tokens.add(normalized.toLowerCase());
      });
    }

    const file = extractFilenameFromSrc(raw);
    if (file) tokens.add(file);

    return Array.from(tokens).filter(Boolean);
  }

  function srcMatches(a, b) {
    const left = normalizeSrcValue(a);
    const right = normalizeSrcValue(b);
    if (!left || !right) return false;
    if (left === right) return true;

    const leftTokens = buildSrcTokens(left);
    const rightSet = new Set(buildSrcTokens(right));
    if (leftTokens.some((token) => rightSet.has(token))) return true;

    for (const lt of leftTokens) {
      for (const rt of rightSet) {
        if (!lt || !rt) continue;
        if (lt.endsWith(rt) || rt.endsWith(lt)) return true;
      }
    }

    return false;
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
    if (
      host === "drive.google.com" ||
      host === "docs.google.com" ||
      host === "drive.usercontent.google.com"
    ) {
      return normalizeDownloadUrl(parsed.href);
    }

    return parsed.href;
  }

  function isBlobObjectUrl(value) {
    return /^blob:/i.test(String(value || "").trim());
  }

  function getCurrentPlayableAudioSrc(audio) {
    const currentAudio = audio || audioState.audio;
    return currentAudio ? (currentAudio.currentSrc || currentAudio.src || "") : "";
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
    return String(title || "").replace(/\s+/g, " ").trim().toLocaleUpperCase();
  }

  function displayAlbumCardTitle(title) {
    const cleaned = String(title || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    if (/[\u0370-\u03ff]/u.test(cleaned) || /\b[A-Z][a-z]\b/.test(cleaned)) return cleaned;
    return cleaned.toLocaleUpperCase();
  }

  function getCurrentAlbumTitle() {
    if (!document.body.classList.contains("album-screen")) return "";
    const heading =
      document.querySelector(".album-layout h1") ||
      document.querySelector(".album-hero h1") ||
      document.querySelector("main h1") ||
      document.querySelector("h1");
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
    return resolveCoverUrl(track || null, { width: 900 }) || getMediaSessionFallbackArtwork();
  }

  function preloadImage(src, options) {
    const url = toAbsoluteUrlOrEmpty(src || "");
    const opts = options || {};
    if (!url || typeof Image !== "function") {
      return Promise.resolve({ ok: false, src: url });
    }

    return new Promise(function (resolve) {
      const image = new Image();
      let settled = false;

      function done(ok) {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        resolve({ ok: Boolean(ok), src: url });
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
  }

  function setCoverWhenReady(imgElement, nextSrc, fallbackSrc, token) {
    if (!imgElement) return Promise.resolve(false);

    const fallback = normalizeCoverUrl(fallbackSrc || "", { responsive: false }) || getCurrentTrackArtwork(null);
    const target = normalizeCoverUrl(nextSrc || "", { width: 900 }) || fallback;
    if (!target) return Promise.resolve(false);

    const current = toAbsoluteUrlOrEmpty(imgElement.currentSrc || imgElement.src || "");
    if (current && srcMatches(current, target)) return Promise.resolve(true);

    const track = getCurrentPlaylistTrack();
    const trackPath = getAudioAssetPath(track && track.src ? track.src : getCurrentLogicalAudioSrc(), window.location.href);
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
        trackAudioRuntimeEvent("cover_loaded", Object.assign({
          album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
          source: getCoverTelemetrySource(target, track),
          cover_url: target,
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt)),
          track_path: trackPath
        }, getResourceTimingHint(target, coverStartedAt)));
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
          trackAudioRuntimeEvent("cover_loaded", Object.assign({
            album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
            source: "fallback",
            cover_url: fallback,
            duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - fallbackStartedAt)),
            track_path: trackPath
          }, getResourceTimingHint(fallback, fallbackStartedAt)));
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
    const fallback = normalizeCoverUrl(fallbackSrc || "", { responsive: false }) || getMediaSessionFallbackArtwork();
    const target = normalizeCoverUrl(nextSrc || "", { width: 900 }) || fallback;
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
    const catalog = catalogState.data && Array.isArray(catalogState.data.albums)
      ? catalogState.data
      : fallbackCatalog;
    const albums = Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
    if (!albums.length) return "";

    let matched = null;
    if (page) {
      matched = albums.find((entry) => toAbsoluteUrlOrEmpty(entry && entry.page ? entry.page : "") === page) || null;
    }
    if (!matched && album) {
      matched = albums.find((entry) => normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album) || null;
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
      matched = albums.find(function (entry) {
        return toRuntimeAbsoluteUrl(entry && entry.page ? entry.page : "") === page;
      }) || null;
    }

    if (!matched && album) {
      matched = albums.find(function (entry) {
        return normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album;
      }) || null;
    }

    return matched && matched.cover ? toRuntimeAbsoluteUrl(matched.cover) : "";
  }

  function normalizeAlbumContinuityPage(pageLike) {
    const raw = String(pageLike || "").trim();
    if (!raw) return "";

    let href = "";
    try {
      href = new URL(raw, runtime.baseUrl).href;
    } catch (_err) {
      href = toAbsoluteUrlOrEmpty(raw);
    }
    if (!href) return "";

    try {
      const url = new URL(href);
      url.hash = "";
      url.search = "";
      return url.href.replace(/\/index\.html$/i, "/");
    } catch (_err) {
      return href.split("#")[0].split("?")[0].replace(/\/index\.html$/i, "/");
    }
  }

  function getAlbumContinuityTracksData() {
    const tracksData = audioState.tracksData;
    const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
    return albums.filter(function (album) {
      return album && Array.isArray(album.tracks) && album.tracks.some(function (track) {
        return track && track.src;
      });
    });
  }

  function getAlbumContinuityCatalogAlbums() {
    const catalog = catalogState.data && Array.isArray(catalogState.data.albums)
      ? catalogState.data
      : fallbackCatalog;
    return Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
  }

  function findTracksAlbumByCatalogEntry(catalogEntry, tracksAlbums) {
    if (!catalogEntry) return null;
    const catalogPage = normalizeAlbumContinuityPage(catalogEntry.page || "");
    const catalogTitle = normalizeAlbumTitle(catalogEntry.title || "");

    if (catalogPage) {
      const byPage = tracksAlbums.find(function (album) {
        return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === catalogPage;
      });
      if (byPage) return byPage;
    }

    if (catalogTitle) {
      return tracksAlbums.find(function (album) {
        return normalizeAlbumTitle(album && album.title ? album.title : "") === catalogTitle;
      }) || null;
    }

    return null;
  }

  function findTracksAlbumForContinuityTrack(track, tracksAlbums) {
    const enriched = mergeTrackMetadata(track || null);
    const page = normalizeAlbumContinuityPage(
      enriched && enriched.page ? enriched.page : (track && track.page ? track.page : "")
    );
    const albumTitle = normalizeAlbumTitle(
      enriched && enriched.album ? enriched.album : (track && track.album ? track.album : "")
    );

    if (page) {
      const byPage = tracksAlbums.find(function (album) {
        return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === page;
      });
      if (byPage) return byPage;
    }

    if (albumTitle) {
      const byTitle = tracksAlbums.find(function (album) {
        return normalizeAlbumTitle(album && album.title ? album.title : "") === albumTitle;
      });
      if (byTitle) return byTitle;
    }

    const src = (track && track.src) || getCurrentLogicalAudioSrc();
    if (!src) return null;
    return tracksAlbums.find(function (album) {
      const tracks = Array.isArray(album && album.tracks) ? album.tracks : [];
      return tracks.some(function (candidate) {
        return candidate && candidate.src && srcMatches(candidate.src, src);
      });
    }) || null;
  }

  function findNextAlbumForContinuity(currentAlbum, tracksAlbums) {
    if (!currentAlbum || tracksAlbums.length < 2) return null;

    const catalogAlbums = getAlbumContinuityCatalogAlbums();
    const currentPage = normalizeAlbumContinuityPage(currentAlbum.page || "");
    const currentTitle = normalizeAlbumTitle(currentAlbum.title || "");
    const catalogIndex = catalogAlbums.findIndex(function (entry) {
      const entryPage = normalizeAlbumContinuityPage(entry && entry.page ? entry.page : "");
      const entryTitle = normalizeAlbumTitle(entry && entry.title ? entry.title : "");
      return (currentPage && entryPage === currentPage) || (currentTitle && entryTitle === currentTitle);
    });

    if (catalogIndex >= 0 && catalogAlbums.length > 1) {
      for (let offset = 1; offset <= catalogAlbums.length; offset += 1) {
        const candidateCatalog = catalogAlbums[(catalogIndex + offset) % catalogAlbums.length];
        const candidateAlbum = findTracksAlbumByCatalogEntry(candidateCatalog, tracksAlbums);
        if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
        return {
          album: candidateAlbum,
          catalog: candidateCatalog || null,
          wrapped: catalogIndex + offset >= catalogAlbums.length
        };
      }
    }

    const tracksIndex = tracksAlbums.indexOf(currentAlbum);
    if (tracksIndex < 0) return null;
    for (let offset = 1; offset <= tracksAlbums.length; offset += 1) {
      const candidateAlbum = tracksAlbums[(tracksIndex + offset) % tracksAlbums.length];
      if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
      return {
        album: candidateAlbum,
        catalog: null,
        wrapped: tracksIndex + offset >= tracksAlbums.length
      };
    }
    return null;
  }

  function buildAlbumContinuityTrack(track, album, catalogEntry) {
    if (!track || !track.src || !album) return null;
    const src = resolveManagedAudioSrc(track.src, runtime.baseUrl.href);
    if (!src) return null;
    const seconds = Number(track.seconds);
    const duration = String(track.duration || "").trim() || formatTrackDuration(seconds);
    const albumTitle = normalizeAlbumTitle(album.title || (catalogEntry && catalogEntry.title) || "");
    const page = toRuntimeAbsoluteUrl(album.page || (catalogEntry && catalogEntry.page) || "");
    const artwork = album.cover
      ? toRuntimeAbsoluteUrl(album.cover)
      : (catalogEntry && catalogEntry.thumb ? toRuntimeAbsoluteUrl(catalogEntry.thumb) : "");

    return {
      src,
      name: normalizeTrackTitle(track.title || track.name || ""),
      album: albumTitle,
      page,
      artist: "INFRA.",
      artwork,
      duration,
      seconds
    };
  }

  function extendAlbumPlaylistToNextAlbum(options) {
    const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    const currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
    if (!list.length || currentIndex < 0 || currentIndex < list.length - 1) return -1;
    if (audioState.homeMode === "radio" || audioState.shuffleOn) return -1;
    if (audioState.playlistKind === "global" || audioState.playlistKind === "favorites") return -1;
    if (String(audioState.playlistToken || "").startsWith("manual-")) return -1;

    const tracksAlbums = getAlbumContinuityTracksData();
    if (!tracksAlbums.length) {
      loadTracksData().catch(function () {
        // Keep the current playlist unchanged if metadata is unavailable.
      });
      return -1;
    }

    const currentTrack = list[currentIndex];
    const currentAlbum = findTracksAlbumForContinuityTrack(currentTrack, tracksAlbums);
    const nextAlbum = findNextAlbumForContinuity(currentAlbum, tracksAlbums);
    if (!nextAlbum || !nextAlbum.album) return -1;

    const nextTracks = nextAlbum.album.tracks
      .map(function (track) { return buildAlbumContinuityTrack(track, nextAlbum.album, nextAlbum.catalog); })
      .filter(Boolean);
    if (!nextTracks.length) return -1;

    const duplicateIndex = list.findIndex(function (existing, index) {
      if (index <= currentIndex || !existing || !existing.src) return false;
      return nextTracks.some(function (track) {
        return track && track.src && srcMatches(existing.src, track.src);
      });
    });
    if (duplicateIndex > currentIndex) return duplicateIndex;

    const firstNextIndex = list.length;
    audioState.playlist = list.concat(nextTracks);
    audioState.playlistKind = "album";
    syncPlaylistContext(audioState.playlist, { preserveRecent: true });
    trackAudioRuntimeEvent("album_continuity_extend", {
      from_index: currentIndex,
      to_index: firstNextIndex,
      from_album: normalizeAlbumTitle(currentAlbum && currentAlbum.title ? currentAlbum.title : ""),
      to_album: normalizeAlbumTitle(nextAlbum.album.title || ""),
      appended_count: nextTracks.length,
      wrapped: Boolean(nextAlbum.wrapped),
      reason: options && options.reason ? String(options.reason) : ""
    });
    return firstNextIndex;
  }

  function buildPreservedTrack(track, fallbackSrc) {
    const src = toAbsoluteUrlOrEmpty(track && track.src ? track.src : fallbackSrc || "");
    if (!src) return null;
    return {
      src,
      name: normalizeTrackTitle(track && track.name ? track.name : ""),
      album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
      page: getCurrentTrackAlbumPage(track || null),
      artist: track && track.artist ? track.artist : "INFRA.",
      artwork: getCurrentTrackArtwork(track || null)
    };
  }

  function buildAlbumPlaylistFromRadioCache() {
    return callAudioRadio("buildAlbumPlaylistFromRadioCache", arguments);
  }
  function sanitizeQueueTrack() {
    return callAudioRadio("sanitizeQueueTrack", arguments);
  }
  function savePlaybackQueueContext() {
    return callAudioRadio("savePlaybackQueueContext", arguments);
  }
  function queueMatchesCurrentPage() {
    return callAudioRadio("queueMatchesCurrentPage", arguments);
  }
  function restorePlaybackQueueContext() {
    return callAudioRadio("restorePlaybackQueueContext", arguments);
  }
  function expandSingleTrackAlbumFromRadioCache() {
    return callAudioRadio("expandSingleTrackAlbumFromRadioCache", arguments);
  }
  function seekCurrentAudioToRatio(ratio) {
    return audioCoreApi.seekCurrentAudioToRatio(ratio);
  }

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

  function buildArtworkBlobAndSetMetadata(track, metadataArgs) {
    const artworkEntries = buildMediaSessionArtwork(track);
    const firstSrc = artworkEntries[0] && artworkEntries[0].src ? artworkEntries[0].src : "";

    function commitMetadata(artworkSrc, artworkType) {
      if (mediaSessionApi && typeof mediaSessionApi.setMetadata === "function") {
        mediaSessionApi.setMetadata({
          title: metadataArgs.title,
          artist: metadataArgs.artist,
          album: metadataArgs.album,
          artwork: [{ src: artworkSrc, sizes: "512x512", type: artworkType }]
        });
        return;
      }
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: metadataArgs.title,
          artist: metadataArgs.artist,
          album: metadataArgs.album,
          artwork: [{ src: artworkSrc, sizes: "512x512", type: artworkType }]
        });
      } catch (_err) {}
    }

    if (!firstSrc || typeof Image === "undefined" || typeof HTMLCanvasElement === "undefined") {
      commitMetadata((artworkEntries[0] && artworkEntries[0].src) || getMediaSessionFallbackArtwork(), "image/png");
      return;
    }

    if (
      firstSrc &&
      window._infraArtworkBlobUrl &&
      window._infraArtworkLastSrc === firstSrc
    ) {
      commitMetadata(window._infraArtworkBlobUrl, "image/jpeg");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        canvas.getContext("2d").drawImage(img, 0, 0, 512, 512);
        canvas.toBlob(function (blob) {
          if (!blob) {
            commitMetadata(firstSrc, "image/jpeg");
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          if (window._infraArtworkBlobUrl) {
            try {
              URL.revokeObjectURL(window._infraArtworkBlobUrl);
            } catch (_e) {
              // Ignore revoke errors.
            }
          }
          window._infraArtworkBlobUrl = blobUrl;
          window._infraArtworkLastSrc = firstSrc;
          commitMetadata(blobUrl, "image/jpeg");
        }, "image/jpeg", 0.92);
      } catch (_err) {
        commitMetadata(firstSrc, "image/jpeg");
      }
    };
    img.onerror = function () {
      commitMetadata(firstSrc, "image/jpeg");
    };
    img.src = firstSrc;
  }

  function buildResponsiveCoverCandidate(urlValue, targetWidth) {
    if (coverApi && typeof coverApi.buildResponsiveCoverCandidate === "function") {
      return coverApi.buildResponsiveCoverCandidate(urlValue, targetWidth, getCoverUrlOptions());
    }

    return "";
  }

  function buildMediaSessionArtwork(track) {
    const fallbackArtwork = getMediaSessionFallbackArtwork();
    const trackArtwork = resolveCoverUrl(track || null, { width: 900 });
    const tracksArtwork = resolveTracksAlbumArtwork(track)
      ? normalizeCoverUrl(resolveTracksAlbumArtwork(track), { width: 900 })
      : "";
    const catalogArtwork = resolveCatalogAlbumArtwork(track)
      ? normalizeCoverUrl(resolveCatalogAlbumArtwork(track), { width: 900 })
      : "";
    const docArtwork = getAlbumCoverFromDoc(document, window.location.href);
    const domArtwork = docArtwork
      ? normalizeArtworkUrl(docArtwork)
      : "";
    const baseSources = [trackArtwork, tracksArtwork, catalogArtwork, domArtwork].filter(Boolean);
    const candidates = [];
    const unique = [];
    const seen = new Set();

    baseSources.forEach(function (src) {
      candidates.push({
        src,
        sizes: inferArtworkSizeHint(src)
      });
    });

    baseSources.forEach(function (src) {
      const responsive900 = buildResponsiveCoverCandidate(src, 900);
      const responsive480 = buildResponsiveCoverCandidate(src, 480);
      if (responsive900) candidates.push({ src: responsive900, sizes: "900x900" });
      if (responsive480) candidates.push({ src: responsive480, sizes: "480x480" });
    });

    candidates.push({
      src: fallbackArtwork,
      sizes: "512x512"
    });

    candidates.forEach(function (candidate) {
      if (!candidate || !candidate.src) return;
      const normalizedSrc = normalizeArtworkUrl(candidate.src);
      const dedupeKey = `${normalizedSrc}|${candidate.sizes || inferArtworkSizeHint(normalizedSrc)}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const versionedSrc = withMediaSessionArtworkVersion(normalizedSrc, track);
      unique.push({
        src: versionedSrc,
        sizes: candidate.sizes || inferArtworkSizeHint(normalizedSrc),
        type: getArtworkType(normalizedSrc)
      });
    });

    if (!unique.length) {
      unique.push({
        src: withMediaSessionArtworkVersion(fallbackArtwork, track),
        sizes: "512x512",
        type: "image/png"
      });
    }

    return unique;
  }

  function clearWaitingRecovery() {
    if (audioState.waitingRecoveryTimer) {
      clearTimeout(audioState.waitingRecoveryTimer);
      audioState.waitingRecoveryTimer = null;
    }
    audioState.prefetchPausedUntil = 0;
  }

  function recoverPlaybackFromStall() {
    const audio = audioState.audio;
    if (!audio) return;
    if (audio.paused) return;
    if (audioState.trackStartInFlight) return;
    if (audio.readyState >= 3) return;

    const src = getCurrentLogicalAudioSrc();
    if (!src) return;

    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    try {
      audio.load();
    } catch (_err) {
      // Ignore.
    }

    const resume = function () {
      if (Number.isFinite(resumeAt) && resumeAt > 0) {
        try {
          audio.currentTime = resumeAt;
        } catch (_err) {
          // Ignore seek restore errors.
        }
      }
      audio.play().catch(function () {
        // Ignore autoplay errors.
      });
    };

    audio.addEventListener("canplay", resume, { once: true });
  }

  function scheduleWaitingRecovery() {
    clearWaitingRecovery();
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

  function initAudioSessionTelemetry() {
    if (audioState.audioSessionTelemetryBound) return;
    const audioSession = navigator && navigator.audioSession ? navigator.audioSession : null;
    if (!audioSession || typeof audioSession.addEventListener !== "function") return;
    audioState.audioSessionTelemetryBound = true;

    const reportState = function (trigger) {
      trackAudioRuntimeEvent("audio_session_state", {
        trigger: trigger || "statechange",
        audio_session_state: String(audioSession.state || "unknown"),
        audio_session_type: String(audioSession.type || "auto")
      });
    };

    audioSession.addEventListener("statechange", function () {
      reportState("statechange");
    });
    reportState("init");
  }

  function bindMediaSessionActions(options) {
    const opts = options || {};
    if (audioState.mediaSessionBound && !opts.force) return;
    if (mediaSessionApi && typeof mediaSessionApi.isAvailable === "function") {
      if (!mediaSessionApi.isAvailable()) return;
    } else if (!("mediaSession" in navigator)) return;

    function safeSet(action, handler) {
      if (mediaSessionApi && typeof mediaSessionApi.setActionHandler === "function") {
        mediaSessionApi.setActionHandler(action, handler);
        return;
      }
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_err) {
        // Ignore unsupported action handlers.
      }
    }

    const iosStandalone = isIOSStandaloneMediaSession();
    const registeredActions = ["play", "pause", "previoustrack", "nexttrack"];

    safeSet("play", function () {
      playFromExternalControl("media_session");
    });
    safeSet("pause", function () {
      const audio = audioState.audio;
      if (!audio) return;
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
        markAudioPauseIntent("media_session", "media_session");
        audio.pause();
      }
    });

    safeSet("previoustrack", function () {
      console.info("[INFRA] mediaSession previoustrack");
      playPrevious({ seamless: true, fromMediaSession: true });
    });
    safeSet("nexttrack", function () {
      console.info("[INFRA] mediaSession nexttrack");
      playNext({ seamless: true, fromMediaSession: true });
    });

    function applyMediaSessionSeek(nextTime, actionName) {
      const audio = audioState.audio;
      if (!audio || !Number.isFinite(nextTime)) return;
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
      } catch (_err) {
        // Ignore unsupported OS-level seek attempts.
      }
    }

    registeredActions.push("seekto");
    safeSet("seekto", function (event) {
      if (!event || !Number.isFinite(event.seekTime)) return;
      applyMediaSessionSeek(event.seekTime, "seekto");
    });
    if (!iosStandalone) {
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

    if (key !== audioState.lastMediaSessionKey) {
      audioState.lastMediaSessionKey = key;
      console.info(
        "[INFRA] media metadata",
        `title=${title}`,
        `artwork=${artworkEntries[0] && artworkEntries[0].src ? artworkEntries[0].src : ""}`
      );
      try {
        buildArtworkBlobAndSetMetadata(track, { title, artist, album });
      } catch (_err) {
        // Ignore metadata errors.
      }
    }

    if (audio && typeof navigator.mediaSession.setPositionState === "function") {
      const now = Date.now();
      const shouldSyncPosition = Boolean(opts.forcePosition) || !audioState.mediaSessionPositionTs || (now - audioState.mediaSessionPositionTs >= 900);
      if (!shouldSyncPosition) return;

      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
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
      paused: Boolean(audioState.audio && audioState.audio.paused)
    }));
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (event) {
      const data = event && event.data ? event.data : null;
      if (!data || data.type !== "INFRA_PREFETCH_HIT") return;
      const src = normalizeAudioSourceUrl(data.url || "");
      if (!src) return;
      audioState.nextPrefetchServedSrc = src;
      trackAudioRuntimeEvent("served_from_prefetch", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, src),
        {
          range: Boolean(data.range),
          range_header: data.range_header || "",
          status: data.status || 200
        }
      ));
    });
  }

  audioTelemetryApi.initLifecycle();

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
    trackAudioRuntimeEvent("album_switch", Object.assign(
      buildAudioMonitorPayload(track, audioState.currentIndex, getCurrentLogicalAudioSrc()),
      {
        from_album: context.fromAlbum || "",
        to_album: getCurrentAlbumTitle() || document.title || "",
        from_url: context.fromUrl || "",
        to_url: context.toUrl || "",
        delay_ms: Date.now() - context.startedAt,
        cached: Boolean(cached)
      }
    ));
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
        const nextVolume = Math.max(0, startVolume * (1 - (step / steps)));
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
  function isAlbumOpenUrl(urlLike) {
    try {
      const url = new URL(String(urlLike || ""), window.location.href);
      return /\/music\/[^/]+\.html$/i.test(url.pathname);
    } catch (_err) {
      return false;
    }
  }

  function isTelemetryTimestampBetween(value, start, end) {
    const ts = Number(value);
    return Number.isFinite(ts) && ts > 0 && ts >= start && ts <= end;
  }

  function createAlbumOpenTelemetryContext(url, rendered, opts) {
    if (!url || !isAlbumOpenUrl(url.href)) return null;
    if (!opts || opts.history !== "push") return null;
    const startedAt = getAudioTelemetryNow();
    const context = {
      startedAt,
      fromUrl: rendered ? rendered.href : window.location.href,
      toUrl: url.href,
      fromAlbum: getCurrentAlbumTitle() || document.title || "",
      toAlbum: getAlbumNameFromUrlLike(url.href),
      controllerchangeAtStart: serviceWorkerControllerChangeAt,
      reloadExecutedAtStart: serviceWorkerReloadExecutedAt
    };
    trackAudioRuntimeEvent("album_open_tap", {
      track: "album_open",
      album: context.toAlbum || "",
      from_album: context.fromAlbum || "",
      to_album: context.toAlbum || "",
      from_url: context.fromUrl,
      to_url: context.toUrl,
      controllerchange: false,
      sw_reload_between: false
    });
    return context;
  }

  function finishAlbumOpenTelemetry(context, eventName, extra) {
    if (!context || !context.startedAt) return;
    const endedAt = getAudioTelemetryNow();
    const controllerBetween = isTelemetryTimestampBetween(serviceWorkerControllerChangeAt, context.startedAt, endedAt);
    const reloadBetween = isTelemetryTimestampBetween(serviceWorkerReloadExecutedAt, context.startedAt, endedAt);
    trackAudioRuntimeEvent(eventName, Object.assign({
      track: "album_open",
      album: context.toAlbum || "",
      from_album: context.fromAlbum || "",
      to_album: context.toAlbum || getAlbumNameFromUrlLike(context.toUrl),
      from_url: context.fromUrl,
      to_url: context.toUrl,
      delta_ms: Math.max(0, Math.round(endedAt - context.startedAt)),
      controllerchange: controllerBetween,
      sw_reload_between: Boolean(controllerBetween || reloadBetween),
      reload_executed: reloadBetween
    }, extra || {}));
  }


  function initSpaNavigation() {
    if (!spaState.enabled) return;
    if (spaState.bound) return;
    spaState.bound = true;
    spaState.currentUrl = window.location.href;
    if (!spaState.pageCacheApi && spaRouterApi && typeof spaRouterApi.createPageCache === "function") {
      spaState.pageCacheApi = spaRouterApi.createPageCache({
        pageCache: spaState.pageCache,
        pageCacheOrder: spaState.pageCacheOrder,
        prefetchingPages: spaState.prefetchingPages,
        pageCacheLimit: spaState.pageCacheLimit,
        currentHref: window.location.href,
        currentOrigin: window.location.origin
      });
    }
    saveCurrentScrollPositionInHistory();
    snapshotCurrentSpaPage(spaState.currentUrl);

    if (!spaState.scrollBound) {
      window.addEventListener(
        "scroll",
        function () {
          if (spaState.scrollSaveRaf) return;
          spaState.scrollSaveRaf = requestAnimationFrame(function () {
            spaState.scrollSaveRaf = 0;
            saveCurrentScrollPositionInHistory();
          });
        },
        { passive: true }
      );
      spaState.scrollBound = true;
    }

    try {
      history.scrollRestoration = "manual";
    } catch (_err) {
      // Ignore unsupported browsers.
    }

    function prefetchFromLinkIntent(event) {
      const target = event.target;
      const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
      if (!link) return;
      if (link.hasAttribute("download")) return;
      if (link.hasAttribute("data-no-spa")) return;
      if (link.target && link.target !== "_self") return;

      const href = String(link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url = null;
      try {
        url = new URL(link.href, window.location.href);
      } catch (_err) {
        return;
      }
      if (window.location.origin !== "null" && url.origin !== window.location.origin) return;
      if (!isSpaNavigableUrl(url)) return;

      const current = new URL(window.location.href);
      if (url.pathname === current.pathname && url.search === current.search && url.hash === current.hash) return;

      primeLinkedAlbumCoverForPwa(link, url.href);
      prefetchSpaPage(url.href, { force: true, cacheMode: "default" });
    }

    document.addEventListener("pointerdown", prefetchFromLinkIntent, { capture: true, passive: true });
    document.addEventListener("touchstart", prefetchFromLinkIntent, { capture: true, passive: true });
    document.addEventListener("focusin", prefetchFromLinkIntent, true);

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
      if (!link) return;
      if (link.hasAttribute("download")) return;
      if (link.hasAttribute("data-no-spa")) return;
      if (link.target && link.target !== "_self") return;

      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url = null;
      try {
        url = new URL(link.href, window.location.href);
      } catch (_err) {
        return;
      }

      if (window.location.origin !== "null" && url.origin !== window.location.origin) return;

      const wantsBackLink = link.classList && link.classList.contains("back");
      const currentState = history.state && typeof history.state === "object" ? history.state : null;
      if (wantsBackLink && currentState && currentState.__infraSpa && window.history.length > 1) {
        event.preventDefault();
        history.back();
        return;
      }

      event.preventDefault();
      const coverPlaceholderSrc = primeLinkedAlbumCoverForPwa(link, url.href);
      showPwaCoverHold(link, coverPlaceholderSrc);
      spaNavigate(url.href, {
        history: "push",
        coverPlaceholderSrc
      });
    }, true);

    window.addEventListener("popstate", function (event) {
      spaNavigate(window.location.href, {
        history: "none",
        scroll: false,
        captureScroll: false,
        restoreScroll: event && event.state ? event.state : null
      });
    });
  }

  function enforceHomeModuleOrder() {
    if (!document.body.classList.contains("home-screen")) return;

    const container = document.querySelector(".one-page-layout");
    if (!container) return;

    const albums = container.querySelector('[data-module-id="albums"]');
    const clips = container.querySelector('[data-module-id="clips"]');
    const apps = container.querySelector('[data-module-id="apps"]');
    if (!albums || !apps) return;

    // Ensure public order stays stable: albums > clips > apps.
    if (clips) {
      container.appendChild(albums);
      container.appendChild(clips);
      container.appendChild(apps);
      return;
    }
    container.appendChild(albums);
    container.appendChild(apps);
  }

  function enforceHomeAppsCollapsed(adminMode) {
    if (adminMode) return;
    if (!document.body.classList.contains("home-screen")) return;
    const appsMenu = document.querySelector(".apps-menu");
    if (!appsMenu) return;
    appsMenu.open = false;
  }

  function resumeLiveHomeRoute() {
    if (!document.body.classList.contains("home-screen")) return;
    const adminMode = isAdminModeEnabled();
    document.body.classList.toggle("ios-device", isIosDevice());
    closeNowPlayingOverlay();
    initThemePreset();
    if (!adminMode) applyThemePreset("blanc", false);

    cleanupIdleAudioContext({ preserveMode: true });
    ensureGlobalAudio();
    ensurePlayablePlaylistContext();
    syncFavoriteButtons();
    syncFavoritesRoute();
    syncTransportUi();
    enforceHomeModuleOrder();
    enforceHomeAppsCollapsed(adminMode);

    resetHomePlaybackModeIfIdle();
    if (audioState.homeMode !== "radio") {
      setHomePlayMode("album", { force: true });
    } else {
      syncAudioUi();
    }

    scheduleFavoritesPreload("home_restore");
    scheduleSpaPagePrefetch();
    scheduleAlbumCoverCacheWarmup("home_restore");
    snapshotCurrentSpaPage(spaState.currentUrl || window.location.href);
    initPwaInstallPrompt(adminMode);
  }

  async function initPage() {
    const adminMode = isAdminModeEnabled();
    document.body.classList.toggle("ios-device", isIosDevice());
    closeNowPlayingOverlay();
    initThemePreset();
    if (!adminMode) applyThemePreset("blanc", false);

    const isHomeScreen = document.body.classList.contains("home-screen");
    const audioFeaturesNeeded = shouldInitAudioFeatures();
    const durationDataReady = audioFeaturesNeeded
      ? loadTrackDurationData()
      : Promise.resolve();
    const tracksDataReady = audioFeaturesNeeded
      ? loadTracksData()
      : Promise.resolve();
    if (isHomeScreen || audioFeaturesNeeded) {
      ensureGlobalAudio();
      initAudioSessionTelemetry();
      ensurePlayablePlaylistContext();
    }

    if (!document.body.classList.contains("album-screen")) {
      cleanupIdleAudioContext({ preserveMode: true });
    }

    if (isHomeScreen) {
      initHomeFavoritesButton();
      initFavoritesRoute();
      scheduleFavoritesPreload("home_init");
      loadFavoritesWithReset().catch(function () {
        audioState.favoritesDbSupported = false;
        syncFavoriteButtons();
      }).finally(function () {
        syncFavoritesRoute();
      });
      loadCatalogData().catch(function () {
        // Keep fallback in place if remote catalog loading fails.
      });
      await hydrateHomeCatalog();
      prepareAlbumCoversForSession("home_start");
      if (!adminMode) enforceHomeModuleOrder();
      enforceHomeAppsCollapsed(adminMode);

      resetHomePlaybackModeIfIdle();
      if (audioState.homeMode !== "radio") {
        setHomePlayMode("album", { force: true });
      } else {
        syncAudioUi();
      }
      syncFavoritesRoute();
    }

    optimizeAlbumCoverImage();
    enhanceAlbumDownloadButtons();

    if (audioFeaturesNeeded) {
      await Promise.all([durationDataReady, tracksDataReady]);
      hydrateCurrentAlbumTrackRows(audioState.tracksData);
      loadFavoritesWithReset().catch(function () {
        audioState.favoritesDbSupported = false;
        syncFavoriteButtons();
      });
      initMinimalPlayers();
      syncTransportUi();
      if (isHomeScreen) {
        scheduleInitialGlobalRandomPreparation("home_idle");
      }
    }

    if (adminMode) {
      await initAdminFeatures();
    } else {
      teardownAdminFeatures();
    }

    scheduleSpaPagePrefetch();
    scheduleAlbumCoverCacheWarmup(isHomeScreen ? "home_idle" : "page_idle");
    snapshotCurrentSpaPage(spaState.currentUrl || window.location.href);
    initPwaInstallPrompt(adminMode);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSpaNavigation();
    registerServiceWorker();
    void initPage();
  });
})();
