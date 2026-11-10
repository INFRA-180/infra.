// Ouverture d'album, navigation, démarrage de la page et bilan de lancement.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import {
  LOCAL_CATALOG_VERSION,
  SPA_SCROLL_HISTORY_DEBOUNCE_MS,
  audioState,
  catalogState,
  fallbackCatalog,
  spaRouterApi,
  spaState
} from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import {
  closeNowPlayingOverlay,
  hydrateCurrentAlbumTrackRows,
  initMinimalPlayers,
  loadTrackDurationData,
  snapshotCurrentSpaPage,
  syncAudioUi,
  syncTransportUi
} from "./module-bridges.js";
import {
  enhanceAlbumDownloadButtons,
  initFavoritesRoute,
  loadFavoritesWithReset,
  scheduleFavoritesPreload,
  syncFavoriteButtons,
  syncFavoritesRoute
} from "./favorites-bridge.js";
import {
  hydrateHomeCatalog,
  loadCatalogData,
  loadTracksData,
  prepareInitialGlobalRandomPlayback
} from "./catalog-playback.js";
import {
  optimizeAlbumCoverImage,
  primeLinkedAlbumCoverForPwa,
  releasePwaCoverHold,
  scheduleAlbumCoverCacheWarmup,
  shouldInitAudioFeatures
} from "./cover-warmup.js";
import {
  applyThemePreset,
  initAdminFeatures,
  initPwaInstallPrompt,
  initThemePreset,
  isAdminModeEnabled,
  isIosDevice,
  isStandaloneDisplayMode,
  serviceWorkerControllerChangeAt,
  teardownAdminFeatures
} from "./theme-admin-pwa.js";
import {
  cancelPendingSpaScrollSave,
  isSpaNavigableUrl,
  navigateTo,
  prefetchSpaPage,
  saveCurrentScrollPositionInHistory
} from "./navigation.js";
import { getCurrentAlbumTitle } from "./audio-sources.js";
import { initAudioSessionTelemetry } from "./media-artwork.js";
import { flushAudioTelemetryQueue } from "./audio-monitor.js";
import {
  ensureGlobalAudio,
  ensurePlayablePlaylistContext,
  getAlbumNameFromUrlLike,
  trackAudioRuntimeEvent
} from "./playback.js";

function isAlbumOpenUrl(urlLike) {
  try {
    const url = new URL(String(urlLike || ""), window.location.href);
    return /\/music\/[^/]+\.html$/i.test(url.pathname);
  } catch (_err) {
    return false;
  }
}

function openHomeAlbumCard(card, options) {
  if (!card || !card.href) return false;
  const opts = options || {};
  let url;
  try {
    url = new URL(card.href, window.location.href);
  } catch (_err) {
    return false;
  }
  if (!isAlbumOpenUrl(url.href)) return false;
  const grid = card.closest ? card.closest('[data-catalog-grid="albums"]') : null;
  const cards = grid ? Array.from(grid.querySelectorAll("a.album-card[href]:not(.playlist-card)")) : [];
  const cardRank = Math.max(0, cards.indexOf(card) + 1);
  primeLinkedAlbumCoverForPwa(card, url.href);
  releasePwaCoverHold("replace");
  navigateTo(url.href, {
    history: "push",
    trigger: String(opts.trigger || "album_card"),
    surface: "home_album_grid",
    cardRank,
    lowerHalf: Boolean(cards.length && cardRank > Math.ceil(cards.length / 2)),
    gestureToken: String(opts.gestureToken || "")
  });
  return true;
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
    navigationToken: Number(opts.navigationToken || 0),
    trigger: String(opts.trigger || "album_card"),
    surface: String(opts.surface || "home_album_grid"),
    cardRank: Math.max(0, Math.round(Number(opts.cardRank) || 0)),
    lowerHalf: Boolean(opts.lowerHalf),
    gestureToken: String(opts.gestureToken || ""),
    controllerchangeAtStart: serviceWorkerControllerChangeAt
  };
  trackAudioRuntimeEvent("album_open_tap", {
    track: "album_open",
    album: context.toAlbum || "",
    from_album: context.fromAlbum || "",
    to_album: context.toAlbum || "",
    from_url: context.fromUrl,
    to_url: context.toUrl,
    controllerchange: false,
    sw_reload_between: false,
    navigation_token: context.navigationToken,
    trigger: context.trigger,
    surface: context.surface,
    card_rank: context.cardRank,
    lower_half: context.lowerHalf,
    gesture_token: context.gestureToken
  });
  return context;
}

function finishAlbumOpenTelemetry(context, eventName, extra) {
  if (!context || !context.startedAt) return;
  const endedAt = getAudioTelemetryNow();
  const controllerBetween = isTelemetryTimestampBetween(
    serviceWorkerControllerChangeAt,
    context.startedAt,
    endedAt
  );
  trackAudioRuntimeEvent(
    eventName,
    Object.assign(
      {
        track: "album_open",
        album: context.toAlbum || "",
        from_album: context.fromAlbum || "",
        to_album: context.toAlbum || getAlbumNameFromUrlLike(context.toUrl),
        from_url: context.fromUrl,
        to_url: context.toUrl,
        delta_ms: Math.max(0, Math.round(endedAt - context.startedAt)),
        controllerchange: controllerBetween,
        sw_reload_between: false,
        reload_executed: false,
        navigation_token: context.navigationToken,
        trigger: context.trigger,
        surface: context.surface,
        card_rank: context.cardRank,
        lower_half: context.lowerHalf,
        gesture_token: context.gestureToken
      },
      extra || {}
    )
  );
  if (context.gestureToken) {
    const completed = eventName === "album_open_done";
    trackAudioRuntimeEvent("album_swipe", {
      track: "gesture",
      album: context.toAlbum || "album",
      gesture_token: context.gestureToken,
      trigger: context.trigger,
      surface: context.surface,
      card_rank: context.cardRank,
      lower_half: context.lowerHalf,
      navigation_started: true,
      navigation_completed: completed,
      navigation_result: completed ? "done" : "failed",
      navigation_method: "spa",
      result: completed ? "opened" : "cancelled",
      cancel_reason: completed ? "" : String((extra && extra.reason) || "navigation_failed")
    });
  }
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
      inflightPages: spaState.inflightPages,
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
        // WebKit throttles pushState/replaceState. Coalesce a full gesture
        // into one trailing write instead of writing at display-frame rate.
        cancelPendingSpaScrollSave();
        spaState.scrollSaveTimer = window.setTimeout(function () {
          spaState.scrollSaveTimer = 0;
          saveCurrentScrollPositionInHistory();
        }, SPA_SCROLL_HISTORY_DEBOUNCE_MS);
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
    if (url.pathname === current.pathname && url.search === current.search && url.hash === current.hash)
      return;

    primeLinkedAlbumCoverForPwa(link, url.href);
    prefetchSpaPage(url.href, { cacheMode: "default" });
  }

  document.addEventListener("pointerdown", prefetchFromLinkIntent, { capture: true, passive: true });
  document.addEventListener("touchstart", prefetchFromLinkIntent, { capture: true, passive: true });
  document.addEventListener("focusin", prefetchFromLinkIntent, true);

  document.addEventListener(
    "click",
    function (event) {
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
      if (wantsBackLink && currentState?.__infraPreviousUrl && window.history.length > 1) {
        const previous = new URL(currentState.__infraPreviousUrl, window.location.href);
        const pagePath = (route) => route.pathname.replace(/\/index\.html$/, "/");
        if (
          previous.origin === url.origin &&
          pagePath(previous) === pagePath(url) &&
          previous.search === url.search
        ) {
          event.preventDefault();
          history.back();
          return;
        }
      }

      event.preventDefault();
      primeLinkedAlbumCoverForPwa(link, url.href);
      // Keep the current interactive page and persistent mini-player visible
      // until the destination document is ready. The former foreground cover
      // clone made a slow first visit look like a frozen application.
      releasePwaCoverHold("replace");
      const albumCard = link.matches && link.matches("a.album-card[href]:not(.playlist-card)") ? link : null;
      const albumGrid =
        albumCard && albumCard.closest ? albumCard.closest('[data-catalog-grid="albums"]') : null;
      const albumCards = albumGrid
        ? Array.from(albumGrid.querySelectorAll("a.album-card[href]:not(.playlist-card)"))
        : [];
      const cardRank = albumCard ? Math.max(0, albumCards.indexOf(albumCard) + 1) : 0;
      navigateTo(url.href, {
        history: "push",
        trigger: albumCard ? "tap" : "link",
        surface: albumCard ? "home_album_grid" : "link",
        cardRank,
        lowerHalf: Boolean(albumCards.length && cardRank > Math.ceil(albumCards.length / 2))
      });
    },
    true
  );

  window.addEventListener("popstate", function (event) {
    navigateTo(window.location.href, {
      history: "none",
      trigger: "history_back",
      surface: "browser_history",
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
  const playlists = container.querySelector('[data-module-id="playlists"]');
  const clips = container.querySelector('[data-module-id="clips"]');
  const apps = container.querySelector('[data-module-id="apps"]');
  if (!albums || !playlists || !apps) return;

  // Keep the same music-first order after hydration and SPA restores.
  [albums, playlists, clips, apps].filter(Boolean).forEach(function (module) {
    container.appendChild(module);
  });
}

function enforceHomeAppsCollapsed(adminMode) {
  if (adminMode) return;
  if (!document.body.classList.contains("home-screen")) return;
  const appsMenu = document.querySelector(".apps-menu");
  if (!appsMenu) return;
  // Bibliothèque V3 (validée par INFRA le 08/11/2026) : Applications reste visible sur l'accueil.
  appsMenu.open = true;
}

function resumeLiveHomeRoute() {
  if (!document.body.classList.contains("home-screen")) return;
  const adminMode = isAdminModeEnabled();
  document.body.classList.toggle("ios-device", isIosDevice());
  closeNowPlayingOverlay();
  initThemePreset();
  if (!adminMode) applyThemePreset("blanc", false);

  ensureGlobalAudio();
  ensurePlayablePlaylistContext();
  syncFavoriteButtons();
  syncFavoritesRoute();
  syncTransportUi();
  enforceHomeModuleOrder();
  enforceHomeAppsCollapsed(adminMode);

  syncAudioUi();

  scheduleFavoritesPreload("home_restore");
  scheduleAlbumCoverCacheWarmup("home_restore");
  snapshotCurrentSpaPage(spaState.currentUrl || window.location.href);
  initPwaInstallPrompt(adminMode);
}

async function initPage() {
  const adminMode = isAdminModeEnabled();
  document.documentElement.classList.toggle("pwa-standalone", isStandaloneDisplayMode());
  document.body.classList.toggle("ios-device", isIosDevice());
  closeNowPlayingOverlay();
  initThemePreset();
  if (!adminMode) applyThemePreset("blanc", false);

  const isHomeScreen = document.body.classList.contains("home-screen");
  const audioFeaturesNeeded = isHomeScreen || shouldInitAudioFeatures();
  const durationDataReady = audioFeaturesNeeded ? loadTrackDurationData() : Promise.resolve();
  const tracksDataReady = audioFeaturesNeeded ? loadTracksData() : Promise.resolve();
  if (isHomeScreen || audioFeaturesNeeded) {
    ensureGlobalAudio();
    initAudioSessionTelemetry();
    ensurePlayablePlaylistContext();
  }
  const initialRadioMetadataReady = audioFeaturesNeeded
    ? tracksDataReady.then(function () {
        return prepareInitialGlobalRandomPlayback(isHomeScreen ? "home_init" : "route_init");
      })
    : Promise.resolve(null);

  if (isHomeScreen) {
    initFavoritesRoute();
    scheduleFavoritesPreload("home_init");
    loadFavoritesWithReset()
      .catch(function () {
        audioState.favoritesDbSupported = false;
        syncFavoriteButtons();
      })
      .finally(function () {
        syncFavoritesRoute();
      });
    loadCatalogData().catch(function () {
      // Keep fallback in place if remote catalog loading fails.
    });
    await hydrateHomeCatalog();
    if (!adminMode) enforceHomeModuleOrder();
    enforceHomeAppsCollapsed(adminMode);

    syncAudioUi();
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
    await initialRadioMetadataReady;
    syncTransportUi();
  }

  if (adminMode) {
    await initAdminFeatures();
  } else {
    teardownAdminFeatures();
  }

  scheduleAlbumCoverCacheWarmup(isHomeScreen ? "home_idle" : "page_idle");
  snapshotCurrentSpaPage(spaState.currentUrl || window.location.href);
  initPwaInstallPrompt(adminMode);
}

function nextApplicationFrames() {
  return new Promise(function (resolve) {
    const schedule =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : function (callback) {
            return setTimeout(callback, 16);
          };
    schedule(function () {
      schedule(resolve);
    });
  });
}

function latestResourceReadyMs(pattern) {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") return 0;
  return performance.getEntriesByType("resource").reduce(function (latest, entry) {
    if (!entry || !pattern.test(String(entry.name || ""))) return latest;
    return Math.max(latest, Number(entry.responseEnd) || 0);
  }, 0);
}

function markLaunchWatchdogComplete(probe) {
  if (!probe) return;
  if (typeof probe.complete !== "function") return;
  try {
    probe.complete();
  } catch (_err) {
    // The watchdog is diagnostic only and must never affect startup.
  }
}

function disconnectLaunchPerformanceObservers(probe) {
  if (!probe || !Array.isArray(probe.performance_observers)) return;
  probe.performance_observers.forEach(function (observer) {
    if (observer && typeof observer.disconnect === "function") observer.disconnect();
  });
  probe.performance_observers.length = 0;
}

function buildLaunchSummary(state, finalReason) {
  const probe = state.probe;
  const paints =
    typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("paint")
      : [];
  const fcp = paints.find(function (entry) {
    return entry && entry.name === "first-contentful-paint";
  });
  const navigation =
    typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("navigation")[0]
      : null;
  return {
    launch_head_ms: Math.max(0, Math.round(Number(probe.head_ms) || 0)),
    dom_ready_ms: Math.max(
      0,
      Math.round(
        Number(navigation && navigation.domContentLoadedEventEnd) || Number(state.initStartedAt) || 0
      )
    ),
    first_contentful_paint_ms: Math.max(0, Math.round(Number(fcp && fcp.startTime) || 0)),
    first_app_frame_ms: Math.max(0, Math.round(state.firstAppFrameMs)),
    app_ready_frame_ms: Math.max(0, Math.round(state.firstAppFrameMs)),
    init_done_ms: Math.max(0, Math.round(state.initDoneMs)),
    catalog_ready_ms: state.catalogReady ? Math.max(0, Math.round(state.initDoneMs)) : 0,
    document_ttfb_ms: Math.max(0, Math.round(Number(navigation && navigation.responseStart) || 0)),
    document_download_ms: Math.max(
      0,
      Math.round(
        (Number(navigation && navigation.responseEnd) || 0) -
          (Number(navigation && navigation.responseStart) || 0)
      )
    ),
    dom_parse_ms: Math.max(
      0,
      Math.round(
        (Number(navigation && navigation.domContentLoadedEventEnd) || Number(state.initStartedAt) || 0) -
          (Number(navigation && navigation.responseEnd) || 0)
      )
    ),
    critical_css_ready_ms: Math.max(
      0,
      Math.round(latestResourceReadyMs(/\/assets\/css\/(?:styles|playlists)\.css(?:\?|$)/))
    ),
    runtime_scripts_ready_ms: Math.max(
      0,
      Math.round(latestResourceReadyMs(/\/assets\/js\/[^/?]+\.js(?:\?|$)/))
    ),
    largest_contentful_paint_ms: Math.max(0, Math.round(Number(probe.largest_contentful_paint_ms) || 0)),
    cumulative_layout_shift_milli: Math.max(
      0,
      Math.round((Number(probe.cumulative_layout_shift) || 0) * 1000)
    ),
    interaction_to_next_paint_ms: Math.max(0, Math.round(Number(probe.interaction_to_next_paint_ms) || 0)),
    previous_incomplete_launch_age_ms: Math.max(
      0,
      Math.round(Number(probe.previous_incomplete_launch_age_ms) || 0)
    ),
    service_worker_activity_count: Number(probe.service_worker_activity_count) || 0,
    catalog_ready: state.catalogReady,
    catalog_source: state.catalogSource,
    state: state.catalogRelease,
    service_worker_controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    service_worker_state:
      navigator.serviceWorker && navigator.serviceWorker.controller ? "controlled" : "uncontrolled",
    document_was_discarded: Boolean(document.wasDiscarded),
    app_frame_ready: true,
    fcp_available: Boolean(fcp),
    lcp_available: probe.lcp_available === true,
    cls_available: probe.cls_available === true,
    inp_available: probe.inp_available === true,
    previous_incomplete_launch: probe.previous_incomplete_launch === true,
    previous_launch_build: String(probe.previous_launch_build || ""),
    previous_launch_route_kind: String(probe.previous_launch_route_kind || ""),
    reason: finalReason || "vitals_timeout"
  };
}

function scheduleFinalLaunchSummary(state) {
  let finalized = false;
  let timerId = 0;
  const cleanup = function () {
    if (timerId) window.clearTimeout(timerId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
  };
  const finalize = function (reason, beacon) {
    if (finalized) return;
    finalized = true;
    cleanup();
    trackAudioRuntimeEvent("launch_summary", buildLaunchSummary(state, reason));
    disconnectLaunchPerformanceObservers(state.probe);
    if (beacon) flushAudioTelemetryQueue({ beacon: true });
  };
  const onVisibilityChange = function () {
    if (document.visibilityState === "hidden") finalize("visibility_hidden", true);
  };
  const onPageHide = function () {
    finalize("pagehide", true);
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide, { once: true });

  const elapsed =
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
  timerId = window.setTimeout(
    function () {
      finalize("vitals_timeout", false);
    },
    Math.max(0, 10000 - elapsed)
  );
  if (document.visibilityState === "hidden") finalize("visibility_hidden", true);
}

async function reportLaunchSummary(initStartedAt) {
  const initDoneMs =
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
  await nextApplicationFrames();
  const firstAppFrameMs =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : initDoneMs;
  const probe =
    window.__infraLaunchProbe && typeof window.__infraLaunchProbe === "object"
      ? window.__infraLaunchProbe
      : {};
  const catalogReady = Boolean(
    catalogState.data || (fallbackCatalog && fallbackCatalog.albums && fallbackCatalog.albums.length)
  );
  markLaunchWatchdogComplete(probe);
  scheduleFinalLaunchSummary({
    initStartedAt,
    initDoneMs,
    firstAppFrameMs,
    probe,
    catalogReady,
    catalogSource:
      catalogState.catalogBundleSource || (catalogState.data ? "embedded-fallback" : "unavailable"),
    catalogRelease: catalogState.catalogBundleReleaseId || `local-${LOCAL_CATALOG_VERSION}`
  });
}

export {
  isAlbumOpenUrl,
  openHomeAlbumCard,
  isTelemetryTimestampBetween,
  createAlbumOpenTelemetryContext,
  finishAlbumOpenTelemetry,
  initSpaNavigation,
  enforceHomeModuleOrder,
  enforceHomeAppsCollapsed,
  resumeLiveHomeRoute,
  initPage,
  nextApplicationFrames,
  latestResourceReadyMs,
  markLaunchWatchdogComplete,
  disconnectLaunchPerformanceObservers,
  buildLaunchSummary,
  scheduleFinalLaunchSummary,
  reportLaunchSummary
};
