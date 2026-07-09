(function () {
  "use strict";

  function method(ctx, name, fallback) {
    return function () {
      const fn = ctx && typeof ctx[name] === "function" ? ctx[name] : fallback;
      return typeof fn === "function" ? fn.apply(ctx, arguments) : undefined;
    };
  }

  function createSpaController(context) {
    const ctx = context || {};
    const spaState = ctx.spaState || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL("./", window.location.href) };
    const spaRouterApi = ctx.spaRouterApi || null;
    const spaNavigate = method(ctx, "spaNavigate");
    const snapshotCurrentSpaPage = method(ctx, "snapshotCurrentSpaPage");
    const primeLinkedAlbumCoverForPwa = method(ctx, "primeLinkedAlbumCoverForPwa", function () { return ""; });
    const showPwaCoverHold = method(ctx, "showPwaCoverHold");
    const loadTracksData = method(ctx, "loadTracksData", function () { return Promise.resolve({ albums: [] }); });
    const normalizeUrlAgainstBase = method(ctx, "normalizeUrlAgainstBase", function (value) { return String(value || ""); });
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () { return ""; });
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const isAdminModeEnabled = method(ctx, "isAdminModeEnabled", function () { return false; });
    const applyThemePreset = method(ctx, "applyThemePreset");
    const initThemePreset = method(ctx, "initThemePreset");
    const closeNowPlayingOverlay = method(ctx, "closeNowPlayingOverlay");
    const cleanupIdleAudioContext = method(ctx, "cleanupIdleAudioContext");
    const ensureGlobalAudio = method(ctx, "ensureGlobalAudio");
    const ensurePlayablePlaylistContext = method(ctx, "ensurePlayablePlaylistContext");
    const syncFavoriteButtons = method(ctx, "syncFavoriteButtons");
    const syncFavoritesRoute = method(ctx, "syncFavoritesRoute");
    const syncTransportUi = method(ctx, "syncTransportUi");
    const resetHomePlaybackModeIfIdle = method(ctx, "resetHomePlaybackModeIfIdle");
    const setHomePlayMode = method(ctx, "setHomePlayMode");
    const syncAudioUi = method(ctx, "syncAudioUi");
    const scheduleFavoritesPreload = method(ctx, "scheduleFavoritesPreload");
    const scheduleAlbumCoverCacheWarmup = method(ctx, "scheduleAlbumCoverCacheWarmup");
    const initPwaInstallPrompt = method(ctx, "initPwaInstallPrompt");
    const shouldInitAudioFeatures = method(ctx, "shouldInitAudioFeatures", function () { return false; });
    const loadTrackDurationData = method(ctx, "loadTrackDurationData", function () { return Promise.resolve(); });
    const initAudioSessionTelemetry = method(ctx, "initAudioSessionTelemetry");
    const initHomeFavoritesButton = method(ctx, "initHomeFavoritesButton");
    const initFavoritesRoute = method(ctx, "initFavoritesRoute");
    const loadFavoritesWithReset = method(ctx, "loadFavoritesWithReset", function () { return Promise.resolve(); });
    const loadCatalogData = method(ctx, "loadCatalogData", function () { return Promise.resolve(); });
    const hydrateHomeCatalog = method(ctx, "hydrateHomeCatalog", function () { return Promise.resolve(); });
    const prepareAlbumCoversForSession = method(ctx, "prepareAlbumCoversForSession", function () { return Promise.resolve(); });
    const optimizeAlbumCoverImage = method(ctx, "optimizeAlbumCoverImage");
    const enhanceAlbumDownloadButtons = method(ctx, "enhanceAlbumDownloadButtons");
    const hydrateCurrentAlbumTrackRows = method(ctx, "hydrateCurrentAlbumTrackRows");
    const initMinimalPlayers = method(ctx, "initMinimalPlayers");
    const scheduleInitialGlobalRandomPreparation = method(ctx, "scheduleInitialGlobalRandomPreparation");
    const initAdminFeatures = method(ctx, "initAdminFeatures", function () { return Promise.resolve(); });
    const teardownAdminFeatures = method(ctx, "teardownAdminFeatures");

    function navigateTo(href, options) {
      if (!spaState.enabled) { window.location.href = href; return; }
      spaNavigate(href, options);
    }

    function buildSpaHistoryState(urlLike, scrollX, scrollY) {
      if (spaRouterApi && typeof spaRouterApi.buildHistoryState === "function") {
        return spaRouterApi.buildHistoryState({ baseState: history.state, url: String(urlLike || window.location.href), scrollX, scrollY });
      }
      const base = history.state && typeof history.state === "object" ? Object.assign({}, history.state) : {};
      base.__infraSpa = 1; base.__infraUrl = String(urlLike || window.location.href);
      base.__infraScrollX = Math.max(0, Math.round(Number(scrollX) || 0));
      base.__infraScrollY = Math.max(0, Math.round(Number(scrollY) || 0));
      return base;
    }

    function saveCurrentScrollPositionInHistory() {
      try { history.replaceState(buildSpaHistoryState(window.location.href, window.scrollX || window.pageXOffset || 0, window.scrollY || window.pageYOffset || 0), "", window.location.href); } catch (_err) {}
    }

    function getScrollFromHistoryState(stateLike) {
      if (spaRouterApi && typeof spaRouterApi.getScrollFromHistoryState === "function") return spaRouterApi.getScrollFromHistoryState(stateLike);
      const raw = stateLike && typeof stateLike === "object" ? stateLike : {};
      const x = Number(raw.__infraScrollX); const y = Number(raw.__infraScrollY);
      return { x: Number.isFinite(x) ? Math.max(0, x) : 0, y: Number.isFinite(y) ? Math.max(0, y) : 0 };
    }

    function isSpaNavigableUrl(url) {
      if (spaRouterApi && typeof spaRouterApi.isNavigableUrl === "function") return spaRouterApi.isNavigableUrl(url, { currentHref: window.location.href, currentOrigin: window.location.origin });
      if (!url || !(url instanceof URL) || (window.location.origin !== "null" && url.origin !== window.location.origin)) return false;
      const path = String(url.pathname || "");
      return !/\.(?:mp3|m4a|aac|wav|flac|ogg|png|jpe?g|webp|gif|svg|ico|pdf|zip|json|js|css|woff2?)$/i.test(path);
    }

    function getSpaPageCacheKey(urlLike) {
      if (spaRouterApi && typeof spaRouterApi.getPageCacheKey === "function") return spaRouterApi.getPageCacheKey(urlLike, { currentHref: window.location.href });
      try { const url = urlLike instanceof URL ? urlLike : new URL(String(urlLike || ""), window.location.href); return `${url.pathname}${url.search}`; } catch (_err) { return ""; }
    }

    function getSpaCachedHtml(urlLike) {
      if (spaState.pageCacheApi && typeof spaState.pageCacheApi.get === "function") return spaState.pageCacheApi.get(urlLike);
      const value = spaState.pageCache && spaState.pageCache.get(getSpaPageCacheKey(urlLike));
      return typeof value === "string" ? value : "";
    }

    function setSpaCachedHtml(urlLike, html) {
      if (spaState.pageCacheApi && typeof spaState.pageCacheApi.set === "function") { spaState.pageCacheApi.set(urlLike, html); return; }
      const key = getSpaPageCacheKey(urlLike); const value = String(html || "");
      if (!key || !value || !spaState.pageCache) return;
      spaState.pageCache.set(key, value);
      const order = spaState.pageCacheOrder || (spaState.pageCacheOrder = []);
      const existing = order.indexOf(key); if (existing >= 0) order.splice(existing, 1);
      order.push(key);
      while (order.length > (spaState.pageCacheLimit || 30)) spaState.pageCache.delete(order.shift());
    }

    function absolutizeSrcsetForBase(srcsetValue, baseUrl) {
      return String(srcsetValue || "").split(",").map(function (entry) {
        const parts = String(entry || "").trim().split(/\s+/).filter(Boolean); if (!parts.length) return "";
        return [normalizeUrlAgainstBase(parts.shift(), baseUrl)].concat(parts).join(" ");
      }).filter(Boolean).join(", ");
    }

    function normalizeCoverElementsForBase(docLike, baseUrl) {
      if (!docLike || typeof docLike.querySelectorAll !== "function") return;
      Array.from(docLike.querySelectorAll(".album-layout .cover, .cover")).forEach(function (cover) {
        const src = cover.getAttribute("src"); if (src) cover.setAttribute("src", normalizeUrlAgainstBase(src, baseUrl));
        const srcset = cover.getAttribute("srcset"); if (srcset) cover.setAttribute("srcset", absolutizeSrcsetForBase(srcset, baseUrl));
      });
    }

    function isAggressivePrefetchPaused() {
      if (audioState.prefetchPausedUntil && Date.now() < audioState.prefetchPausedUntil) return true;
      const audio = audioState.audio;
      return Boolean(audio && !audio.paused && audio.readyState < 3);
    }

    function prefetchSpaPage(href, options) {
      if (!spaState.enabled || (!(options && options.force) && isAggressivePrefetchPaused())) return;
      if (spaState.pageCacheApi && typeof spaState.pageCacheApi.prefetch === "function") {
        spaState.pageCacheApi.prefetch(href, options || {});
      }
    }

    function scheduleSpaPagePrefetch() {
      if (!spaState.enabled) return;
      const seen = new Set(); const queue = []; const current = new URL(window.location.href);
      function enqueue(value) {
        let url; try { url = new URL(String(value || ""), window.location.href); } catch (_err) { return; }
        const key = getSpaPageCacheKey(url);
        if (!isSpaNavigableUrl(url) || !key || seen.has(key) || (url.pathname === current.pathname && url.search === current.search)) return;
        seen.add(key); queue.push(url.href);
      }
      Array.from(document.querySelectorAll("a[href]")).forEach(function (link) { const href = String(link.getAttribute("href") || "").trim(); if (href && !href.startsWith("#") && !/^(mailto|tel):/i.test(href)) enqueue(link.href); });
      const isHome = document.body.classList.contains("home-screen");
      if (!isHome) queue.unshift(new URL("index.html", runtime.baseUrl).href);
      const run = function () {
        const playing = Boolean(audioState.audio && !audioState.audio.paused && getCurrentPlayableAudioSrc(audioState.audio));
        let limit = isHome ? 21 : 8; if (isIosDevice()) limit = Math.min(limit, isHome ? 8 : 5); if (playing) limit = Math.min(limit, isIosDevice() ? 5 : 7); if (isAggressivePrefetchPaused()) limit = Math.min(limit, 2);
        queue.slice(0, limit).forEach(function (href, index) { window.setTimeout(function () { prefetchSpaPage(href); }, index * 90); });
      };
      const extend = function () { if (!isHome) return run(); loadTracksData().then(function (data) { (data.albums || []).forEach(function (album) { enqueue(new URL(album.page || `music/${album.slug}.html`, runtime.baseUrl).href); }); }).finally(run); };
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(extend, { timeout: 1200 }); else window.setTimeout(extend, 120);
    }

    function getSpaPersistRoot() {
      let root = document.getElementById("infraSpaPersist");
      if (root) return root;
      root = document.createElement("div"); root.id = "infraSpaPersist";
      document.body.insertBefore(root, document.body.firstChild); return root;
    }

    function initSpaNavigation() {
      if (!spaState.enabled || spaState.bound) return;
      spaState.bound = true; spaState.currentUrl = window.location.href;
      if (!spaState.pageCacheApi && spaRouterApi && typeof spaRouterApi.createPageCache === "function") {
        spaState.pageCacheApi = spaRouterApi.createPageCache({ pageCache: spaState.pageCache, pageCacheOrder: spaState.pageCacheOrder, prefetchingPages: spaState.prefetchingPages, pageCacheLimit: spaState.pageCacheLimit, currentHref: window.location.href, currentOrigin: window.location.origin });
      }
      saveCurrentScrollPositionInHistory(); snapshotCurrentSpaPage(spaState.currentUrl);
      if (!spaState.scrollBound) {
        window.addEventListener("scroll", function () { if (spaState.scrollSaveRaf) return; spaState.scrollSaveRaf = requestAnimationFrame(function () { spaState.scrollSaveRaf = 0; saveCurrentScrollPositionInHistory(); }); }, { passive: true });
        spaState.scrollBound = true;
      }
      try { history.scrollRestoration = "manual"; } catch (_err) {}
      function linkFrom(event) { const target = event.target; return target && typeof target.closest === "function" ? target.closest("a[href]") : null; }
      function prefetchIntent(event) {
        const link = linkFrom(event); if (!link || link.hasAttribute("download") || link.hasAttribute("data-no-spa") || (link.target && link.target !== "_self")) return;
        let url; try { url = new URL(link.href, window.location.href); } catch (_err) { return; }
        if (!isSpaNavigableUrl(url)) return;
        primeLinkedAlbumCoverForPwa(link, url.href); prefetchSpaPage(url.href, { force: true, cacheMode: "default" });
      }
      ["pointerdown", "touchstart", "focusin"].forEach(function (name) { document.addEventListener(name, prefetchIntent, name === "focusin" ? true : { capture: true, passive: true }); });
      document.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = linkFrom(event); if (!link || link.hasAttribute("download") || link.hasAttribute("data-no-spa") || (link.target && link.target !== "_self")) return;
        const href = link.getAttribute("href") || ""; if (!href || href.startsWith("#") || /^(mailto|tel):/i.test(href)) return;
        let url; try { url = new URL(link.href, window.location.href); } catch (_err) { return; }
        if (!isSpaNavigableUrl(url)) return;
        if (link.classList.contains("back") && history.state && history.state.__infraSpa && window.history.length > 1) { event.preventDefault(); history.back(); return; }
        event.preventDefault(); const coverPlaceholderSrc = primeLinkedAlbumCoverForPwa(link, url.href); showPwaCoverHold(link, coverPlaceholderSrc); spaNavigate(url.href, { history: "push", coverPlaceholderSrc });
      }, true);
      window.addEventListener("popstate", function (event) { spaNavigate(window.location.href, { history: "none", scroll: false, captureScroll: false, restoreScroll: event && event.state ? event.state : null }); });
    }

    function enforceHomeModuleOrder() {
      if (!document.body.classList.contains("home-screen")) return;
      const container = document.querySelector(".one-page-layout"); if (!container) return;
      const albums = container.querySelector('[data-module-id="albums"]'); const clips = container.querySelector('[data-module-id="clips"]'); const apps = container.querySelector('[data-module-id="apps"]');
      if (!albums || !apps) return; container.appendChild(albums); if (clips) container.appendChild(clips); container.appendChild(apps);
    }
    function enforceHomeAppsCollapsed(adminMode) { if (!adminMode && document.body.classList.contains("home-screen")) { const menu = document.querySelector(".apps-menu"); if (menu) menu.open = false; } }
    function resumeLiveHomeRoute() {
      if (!document.body.classList.contains("home-screen")) return;
      const adminMode = isAdminModeEnabled(); document.body.classList.toggle("ios-device", isIosDevice()); closeNowPlayingOverlay(); initThemePreset(); if (!adminMode) applyThemePreset("blanc", false);
      cleanupIdleAudioContext({ preserveMode: true }); ensureGlobalAudio(); ensurePlayablePlaylistContext(); syncFavoriteButtons(); syncFavoritesRoute(); syncTransportUi(); enforceHomeModuleOrder(); enforceHomeAppsCollapsed(adminMode); resetHomePlaybackModeIfIdle();
      if (audioState.homeMode !== "radio") setHomePlayMode("album", { force: true }); else syncAudioUi();
      scheduleFavoritesPreload("home_restore"); scheduleSpaPagePrefetch(); scheduleAlbumCoverCacheWarmup("home_restore"); snapshotCurrentSpaPage(spaState.currentUrl || window.location.href); initPwaInstallPrompt(adminMode);
    }
    async function initPage() {
      const adminMode = isAdminModeEnabled(); document.body.classList.toggle("ios-device", isIosDevice()); closeNowPlayingOverlay(); initThemePreset(); if (!adminMode) applyThemePreset("blanc", false);
      const isHome = document.body.classList.contains("home-screen"); const needsAudio = shouldInitAudioFeatures();
      const durations = needsAudio ? loadTrackDurationData() : Promise.resolve(); const tracks = needsAudio ? loadTracksData() : Promise.resolve();
      if (isHome || needsAudio) { ensureGlobalAudio(); initAudioSessionTelemetry(); ensurePlayablePlaylistContext(); }
      if (!document.body.classList.contains("album-screen")) cleanupIdleAudioContext({ preserveMode: true });
      if (isHome) {
        initHomeFavoritesButton(); initFavoritesRoute(); scheduleFavoritesPreload("home_init");
        loadFavoritesWithReset().catch(function () { audioState.favoritesDbSupported = false; syncFavoriteButtons(); }).finally(syncFavoritesRoute);
        loadCatalogData().catch(function () {}); await hydrateHomeCatalog(); prepareAlbumCoversForSession("home_start"); if (!adminMode) enforceHomeModuleOrder(); enforceHomeAppsCollapsed(adminMode); resetHomePlaybackModeIfIdle();
        if (audioState.homeMode !== "radio") setHomePlayMode("album", { force: true }); else syncAudioUi(); syncFavoritesRoute();
      }
      optimizeAlbumCoverImage(); enhanceAlbumDownloadButtons();
      if (needsAudio) { await Promise.all([durations, tracks]); hydrateCurrentAlbumTrackRows(audioState.tracksData); loadFavoritesWithReset().catch(function () { audioState.favoritesDbSupported = false; syncFavoriteButtons(); }); initMinimalPlayers(); syncTransportUi(); if (isHome) scheduleInitialGlobalRandomPreparation("home_idle"); }
      if (adminMode) await initAdminFeatures(); else teardownAdminFeatures();
      scheduleSpaPagePrefetch(); scheduleAlbumCoverCacheWarmup(isHome ? "home_idle" : "page_idle"); snapshotCurrentSpaPage(spaState.currentUrl || window.location.href); initPwaInstallPrompt(adminMode);
    }
    return { navigateTo, buildSpaHistoryState, saveCurrentScrollPositionInHistory, getScrollFromHistoryState, isSpaNavigableUrl, getSpaPageCacheKey, getSpaCachedHtml, setSpaCachedHtml, absolutizeSrcsetForBase, normalizeCoverElementsForBase, isAggressivePrefetchPaused, prefetchSpaPage, scheduleSpaPagePrefetch, getSpaPersistRoot, initSpaNavigation, resumeLiveHomeRoute, initPage };
  }
  window.InfraSpaController = Object.assign(window.InfraSpaController || {}, { createSpaController });
})();
