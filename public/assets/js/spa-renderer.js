(function () {
  "use strict";

  function method(ctx, name, fallback) {
    const safeFallback = typeof fallback === "function" ? fallback : function () {};
    return function () {
      const fn = ctx && typeof ctx[name] === "function" ? ctx[name] : null;
      if (fn) return fn.apply(ctx, arguments);
      return safeFallback.apply(null, arguments);
    };
  }

  function createSpaRenderer(context) {
    const ctx = context || {};
    const spaState = ctx.spaState || {};
    const audioState = ctx.audioState || {};
    const spaRouterApi = ctx.spaRouterApi || null;
    const COVERS_CACHE_NAME = ctx.COVERS_CACHE_NAME || "infra-covers";
    const COVER_SESSION_NAVIGATION_GATE_ENABLED = ctx.COVER_SESSION_NAVIGATION_GATE_ENABLED !== false;
    const COVER_SESSION_PREPARE_ENABLED = ctx.COVER_SESSION_PREPARE_ENABLED !== false;
    const setSpaCachedHtml = method(ctx, "setSpaCachedHtml");
    const getSpaCachedHtml = method(ctx, "getSpaCachedHtml", function () { return ""; });
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () { return document.body; });
    const normalizeCoverElementsForBase = method(ctx, "normalizeCoverElementsForBase");
    const getAudioTelemetryNow = method(ctx, "getAudioTelemetryNow", function () { return Date.now(); });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const parseSrcsetCandidates = method(ctx, "parseSrcsetCandidates", function () { return []; });
    const normalizeUrlAgainstBase = method(ctx, "normalizeUrlAgainstBase", function (value) { return String(value || ""); });
    const prepareAlbumCoversForSession = method(ctx, "prepareAlbumCoversForSession", function () { return Promise.resolve(); });
    const rememberAlbumCoverImage = method(ctx, "rememberAlbumCoverImage");
    const saveCurrentScrollPositionInHistory = method(ctx, "saveCurrentScrollPositionInHistory");
    const buildSpaHistoryState = method(ctx, "buildSpaHistoryState", function (urlLike) { return { __infraSpa: 1, url: String(urlLike || "") }; });
    const getAlbumNameFromUrlLike = method(ctx, "getAlbumNameFromUrlLike", function () { return ""; });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const createAlbumOpenTelemetryContext = method(ctx, "createAlbumOpenTelemetryContext", function () { return null; });
    const finishAlbumOpenTelemetry = method(ctx, "finishAlbumOpenTelemetry");
    const initPage = method(ctx, "initPage", function () { return Promise.resolve(); });
    const logAudioRuntimeAlbumSwitch = method(ctx, "logAudioRuntimeAlbumSwitch");
    const getScrollFromHistoryState = method(ctx, "getScrollFromHistoryState", function () { return { x: 0, y: 0 }; });
    const prefetchSpaPage = method(ctx, "prefetchSpaPage");
    const isStandaloneDisplayMode = method(ctx, "isStandaloneDisplayMode", function () { return false; });
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const isAndroidDevice = method(ctx, "isAndroidDevice", function () { return false; });

  function isMobilePwaCoverNavigation() {
    const standalone = Boolean(isStandaloneDisplayMode());
    if (!standalone) return false;
    const mobileDevice = Boolean(isIosDevice() || isAndroidDevice());
    const mobileViewport = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 980px)").matches
      : window.innerWidth <= 980;
    return Boolean(mobileDevice || mobileViewport);
  }

  function buildSpaSnapshotHtml() {
    const docEl = document.documentElement;
    if (!docEl || !document.body) return "";

    const clone = docEl.cloneNode(true);
    if (!clone || typeof clone.querySelector !== "function") return "";

    const persistRoot = clone.querySelector("#infraSpaPersist");
    if (persistRoot) persistRoot.remove();
    const installModal = clone.querySelector("#infraPwaInstallModal");
    if (installModal) installModal.remove();

    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  }

  function snapshotCurrentSpaPage(urlLike) {
    if (!spaState.enabled) return;
    const html = buildSpaSnapshotHtml();
    if (!html) return;
    const target = urlLike || spaState.currentUrl || window.location.href;
    setSpaCachedHtml(target, html);
  }

  function parseSpaDocument(html) {
    if (spaRouterApi && typeof spaRouterApi.parseDocument === "function") {
      return spaRouterApi.parseDocument(html);
    }
    const raw = String(html || "");
    if (!raw) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    return doc && doc.body ? doc : null;
  }

  function buildSpaDocumentFragment(doc) {
    const fragment = document.createDocumentFragment();
    Array.from(doc.body ? doc.body.childNodes : []).forEach((node) => {
      if (node.nodeName === "SCRIPT") return;
      fragment.appendChild(document.importNode(node, true));
    });
    return fragment;
  }

  function getSpaCriticalImages(fragment, limit) {
    if (!fragment || typeof fragment.querySelectorAll !== "function") return [];
    const maxImages = Math.max(1, Number(limit) || 8);
    return Array.from(fragment.querySelectorAll("img")).filter(function (img, index) {
      if (img.classList.contains("cover")) return true;
      if (img.classList.contains("album-cover") && index < 8) return true;
      if (String(img.getAttribute("loading") || "").toLowerCase() === "eager") return true;
      if (String(img.getAttribute("fetchpriority") || "").toLowerCase() === "high") return true;
      return false;
    }).slice(0, maxImages);
  }

  function decodeSpaImage(img) {
    if (!img) return Promise.resolve(false);
    if (!img.getAttribute("src") && !img.getAttribute("srcset")) return Promise.resolve(false);
    try {
      if (typeof img.decode === "function") {
        return img.decode().then(
          function () { return true; },
          function () { return false; }
        );
      }
    } catch (_err) {
      return Promise.resolve(false);
    }
    return Promise.resolve(Boolean(img.complete));
  }

  function decodeSpaCriticalImages(fragment, telemetry, options) {
    const opts = options || {};
    const imageLimit = Math.max(1, Number(opts.imageLimit) || 8);
    const timeoutMs = Math.max(50, Number(opts.timeoutMs) || 150);
    const images = getSpaCriticalImages(fragment, imageLimit);
    const startedAt = getAudioTelemetryNow();
    if (!images.length) {
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: 0,
        decoded_count: 0,
        timed_out: false,
        duration_ms: 0
      }));
      return Promise.resolve();
    }

    let timeoutId = 0;
    let timedOut = false;
    let decodedCount = 0;
    let settledCount = 0;
    const decodePromise = Promise.all(images.map(function (image) {
      return decodeSpaImage(image).then(function (decoded) {
        settledCount += 1;
        if (decoded) decodedCount += 1;
        return decoded;
      });
    })).then(function () {
      return {
        decodedCount,
        settledCount
      };
    });
    const timeoutPromise = new Promise(function (resolve) {
      timeoutId = window.setTimeout(function () {
        timedOut = true;
        resolve({ decodedCount, settledCount });
      }, timeoutMs);
    });

    return Promise.race([decodePromise, timeoutPromise]).then(function (result) {
      if (timeoutId) window.clearTimeout(timeoutId);
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: images.length,
        decoded_count: result && Number.isFinite(result.decodedCount) ? result.decodedCount : 0,
        settled_count: result && Number.isFinite(result.settledCount) ? result.settledCount : 0,
        timed_out: timedOut,
        duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
      }));
    }).catch(function () {
      if (timeoutId) window.clearTimeout(timeoutId);
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: images.length,
        decoded_count: 0,
        timed_out: false,
        error_name: "decode_error",
        duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
      }));
    });
  }

  function getSpaAlbumCoverImage(fragment) {
    if (!fragment || typeof fragment.querySelector !== "function") return null;
    return fragment.querySelector(".album-layout .cover");
  }

  function getImagePreferredSrc(img, sourceUrl, options) {
    if (!img) return "";
    const opts = options || {};
    const preferSmall = Number(opts.preferredWidth || 0) <= 480 && Number(opts.preferredWidth || 0) > 0;
    const srcset = String(img.getAttribute("srcset") || "").trim();
    if (srcset) {
      const candidates = parseSrcsetCandidates(srcset).filter(function (candidate) {
        if (!candidate || !candidate.src) return false;
        return preferSmall
          ? /-cover-480\.webp(?:$|\?)/i.test(candidate.src)
          : /-cover-900\.webp(?:$|\?)/i.test(candidate.src);
      });
      if (candidates.length) {
        return normalizeUrlAgainstBase(candidates[preferSmall ? 0 : candidates.length - 1].src, sourceUrl || window.location.href);
      }
    }
    const src = String(img.getAttribute("src") || "").trim();
    return src ? normalizeUrlAgainstBase(src, sourceUrl || window.location.href) : "";
  }

  function waitForSpaAlbumCoverReady(fragment, sourceUrl, telemetry) {
    const image = getSpaAlbumCoverImage(fragment);
    const startedAt = getAudioTelemetryNow();
    if (!image) {
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: 0,
        decoded_count: 0,
        timed_out: false,
        album_cover_only: true,
        duration_ms: 0
      }));
      return Promise.resolve();
    }

    const pwaCoverMode = isMobilePwaCoverNavigation();
    const target = getImagePreferredSrc(image, sourceUrl, {
      preferredWidth: pwaCoverMode ? 480 : 900
    });
    const timeoutMs = pwaCoverMode ? 900 : 55;
    if (!target) {
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: 1,
        decoded_count: 0,
        timed_out: false,
        album_cover_only: true,
        duration_ms: 0
      }));
      return Promise.resolve();
    }

    function rememberReady(urlValue, imageValue) {
      if (!urlValue) return;
      rememberAlbumCoverImage(urlValue, imageValue);
      if (!imageValue && audioState.albumCoverReadyUrls && typeof audioState.albumCoverReadyUrls.add === "function") {
        audioState.albumCoverReadyUrls.add(urlValue);
      }
    }

    function finish(decoded, timedOut, cacheHint) {
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: 1,
        decoded_count: decoded ? 1 : 0,
        timed_out: Boolean(timedOut),
        album_cover_only: true,
        pwa_cover_mode: Boolean(pwaCoverMode),
        cache_hint: cacheHint || "unknown",
        duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
      }));
    }

    if (audioState.albumCoverReadyUrls && audioState.albumCoverReadyUrls.has(target)) {
      finish(true, false, "memory");
      return Promise.resolve();
    }

    if (image.complete && image.naturalWidth > 0) {
      finish(true, false, "memory");
      return Promise.resolve();
    }

    const waitForDecode = function (cacheHint) {
      return new Promise(function (resolve) {
        let settled = false;
        let timeoutId = 0;
        function done(decoded, timedOut) {
          if (settled) return;
          settled = true;
          if (timeoutId) window.clearTimeout(timeoutId);
          finish(decoded, timedOut, cacheHint);
          resolve(Boolean(decoded));
        }
        timeoutId = window.setTimeout(function () {
          done(false, true);
        }, timeoutMs);
        const probe = new Image();
        probe.decoding = "async";
        probe.onload = function () {
          if (typeof probe.decode === "function") {
            probe.decode().then(
              function () {
                rememberReady(target, probe);
                done(true, false);
              },
              function () {
                rememberReady(target, probe);
                done(true, false);
              }
            );
            return;
          }
          rememberReady(target, probe);
          done(true, false);
        };
        probe.onerror = function () {
          done(false, false);
        };
        probe.src = target;
      });
    };

    const waitWithCacheHint = function () {
      if (typeof caches !== "undefined" && caches.open) {
        return caches.open(COVERS_CACHE_NAME).then(function (cache) {
          return cache.match(target).then(function (cached) {
            if (cached) return waitForDecode("cache");
            return waitForDecode("network");
          });
        }).catch(function () {
          return waitForDecode("unknown");
        });
      }
      return waitForDecode("unknown");
    };

    if (pwaCoverMode) {
      const currentCover = document.querySelector(".album-layout .cover");
      const sourceHref = (() => {
        try {
          return new URL(sourceUrl || window.location.href, window.location.href).href;
        } catch (_err) {
          return "";
        }
      })();
      const placeholderMap = spaState.albumCoverPlaceholderByUrl instanceof Map
        ? spaState.albumCoverPlaceholderByUrl
        : null;
      const linkedCoverSrc = placeholderMap && sourceHref
        ? String(placeholderMap.get(sourceHref) || "")
        : "";
      const currentCoverSrc = currentCover
        ? (currentCover.currentSrc || currentCover.src || getImagePreferredSrc(currentCover, window.location.href, { preferredWidth: 480 }))
        : linkedCoverSrc;
      function applyTargetCover() {
        image.setAttribute("src", target);
        image.setAttribute("srcset", `${target} 480w`);
        image.setAttribute("sizes", "(max-width: 980px) min(76vw, 290px), 290px");
        image.setAttribute("loading", "eager");
        image.setAttribute("decoding", "async");
        image.setAttribute("fetchpriority", "high");
      }
      function applyTemporaryCover() {
        if (!currentCoverSrc) {
          applyTargetCover();
          return;
        }
        image.setAttribute("src", currentCoverSrc);
        image.removeAttribute("srcset");
        image.setAttribute("sizes", "(max-width: 980px) min(76vw, 290px), 290px");
        image.setAttribute("loading", "eager");
        image.setAttribute("decoding", "async");
        image.setAttribute("fetchpriority", "high");
      }
      function swapTargetAfterDecode() {
        const probe = new Image();
        probe.decoding = "async";
        probe.onload = function () {
          const apply = function () {
            rememberReady(target, probe);
            if (image.isConnected) applyTargetCover();
            if (placeholderMap && sourceHref) placeholderMap.delete(sourceHref);
          };
          if (typeof probe.decode === "function") {
            probe.decode().then(apply, apply);
            return;
          }
          apply();
        };
        probe.onerror = function () {
          if (placeholderMap && sourceHref) placeholderMap.delete(sourceHref);
        };
        probe.src = target;
      }
      image.setAttribute("sizes", "(max-width: 980px) min(76vw, 290px), 290px");
      image.setAttribute("loading", "eager");
      image.setAttribute("decoding", "async");
      image.setAttribute("fetchpriority", "high");
      applyTemporaryCover();
      return waitWithCacheHint().then(function (decoded) {
        if (decoded) {
          applyTargetCover();
          if (placeholderMap && sourceHref) placeholderMap.delete(sourceHref);
          return;
        }
        swapTargetAfterDecode();
      });
    }

    if (COVER_SESSION_NAVIGATION_GATE_ENABLED && COVER_SESSION_PREPARE_ENABLED) {
      const gateStartedAt = getAudioTelemetryNow();
      let gateTimedOut = false;
      const gateTimeout = new Promise(function (resolve) {
        window.setTimeout(function () {
          gateTimedOut = true;
          resolve("timeout");
        }, 2600);
      });
      return Promise.race([
        prepareAlbumCoversForSession("album_gate").then(function () { return "prepared"; }),
        gateTimeout
      ]).then(function (status) {
        const ready = audioState.albumCoverReadyUrls && audioState.albumCoverReadyUrls.has(target);
        const memory = audioState.albumCoverImageCache && audioState.albumCoverImageCache.has(target);
        trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
          image_count: 1,
          decoded_count: ready || memory ? 1 : 0,
          timed_out: Boolean(gateTimedOut),
          album_cover_only: true,
          cache_hint: ready || memory ? "memory_gate" : String(status || "gate"),
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - gateStartedAt))
        }));
        if (ready || memory) return;
        return waitWithCacheHint();
      });
    }

    return waitWithCacheHint();
  }

  function swapSpaFragment(fragment, bodyClassName, persistRoot) {
    const entering = fragment && fragment.querySelector ? fragment.querySelector("main") : null;
    const instantPwaSwap = isMobilePwaCoverNavigation();
    const animateEntry = Boolean(entering && !instantPwaSwap);
    if (entering) {
      entering.classList.toggle("spa-page-entering", animateEntry);
    }

    return new Promise(function (resolve) {
      const run = function () {
        document.body.className = bodyClassName;
        Array.from(document.body.childNodes).forEach((node) => {
          if (node === persistRoot) return;
          node.remove();
        });
        document.body.appendChild(fragment);

        if (document.body.firstChild !== persistRoot) {
          document.body.insertBefore(persistRoot, document.body.firstChild);
        }

        if (animateEntry) {
          window.requestAnimationFrame(function () {
            entering.classList.remove("spa-page-entering");
          });
        }
        resolve();
      };

      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
      } else {
        run();
      }
    });
  }

  async function renderSpaDocument(doc, sourceUrl, telemetry) {
    const persistRoot = getSpaPersistRoot();

    normalizeCoverElementsForBase(doc, sourceUrl || window.location.href);
    if (doc.title) document.title = doc.title;

    const bodyClassName = doc.body ? doc.body.className : document.body.className;
    const fragment = buildSpaDocumentFragment(doc);
    const isAlbumPage = doc.body && doc.body.classList && doc.body.classList.contains("album-screen");
    const isHomePage = doc.body && doc.body.classList && doc.body.classList.contains("home-screen");
    if (isAlbumPage) {
      await waitForSpaAlbumCoverReady(fragment, sourceUrl, telemetry);
    } else if (isHomePage && isMobilePwaCoverNavigation()) {
      await decodeSpaCriticalImages(fragment, Object.assign({}, telemetry || {}, {
        blocking: true,
        pwa_home_mode: true
      }), {
        imageLimit: 4,
        timeoutMs: 260
      });
    } else {
      decodeSpaCriticalImages(fragment, Object.assign({}, telemetry || {}, {
        blocking: false
      }));
    }

    const startedAt = getAudioTelemetryNow();
    trackAudioRuntimeEvent("spa_swap_start", Object.assign({}, telemetry || {}));
    await swapSpaFragment(fragment, bodyClassName, persistRoot);
    trackAudioRuntimeEvent("spa_swap_done", Object.assign({}, telemetry || {}, {
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
    }));
  }

  async function spaNavigate(href, options) {
    const opts = options || {};
    if (!spaState.enabled) {
      window.location.href = href;
      return;
    }

    let url = null;
    try {
      url = new URL(href, window.location.href);
    } catch (_err) {
      window.location.href = href;
      return;
    }

    let rendered = null;
    try {
      rendered = new URL(spaState.currentUrl || window.location.href);
    } catch (_err) {
      rendered = new URL(window.location.href);
    }

    const same = url.pathname === rendered.pathname && url.search === rendered.search && url.hash === rendered.hash;
    if (same) return;

    const navNow = getAudioTelemetryNow();
    const sameRecentTarget = spaState.lastNavHref === url.href && spaState.lastNavTs && navNow - spaState.lastNavTs < 650;
    if (sameRecentTarget && opts.history === "push") {
      trackAudioRuntimeEvent("nav:album_abort", {
        track: "album_open",
        album: getAlbumNameFromUrlLike(url.href),
        reason: "duplicate_tap",
        to_url: url.href
      });
      return;
    }
    spaState.lastNavHref = url.href;
    spaState.lastNavTs = navNow;
    const navToken = spaState.navToken + 1;
    spaState.navToken = navToken;
    spaState.navigationActive = true;
    trackAudioRuntimeEvent("nav:album_start", {
      track: "album_open",
      album: getAlbumNameFromUrlLike(url.href),
      from_url: rendered.href,
      to_url: url.href
    });

    const audioSwitchContext = {
      startedAt: Date.now(),
      fromAlbum: getCurrentAlbumTitle() || document.title || "",
      fromUrl: rendered.href,
      toUrl: url.href
    };
    const albumOpenContext = createAlbumOpenTelemetryContext(url, rendered, opts);

    function finishSpaNavigation() {
      if (spaState.navToken === navToken) {
        spaState.navigationActive = false;
      }
    }

    function fallbackToDocumentNavigation(reason, extra) {
      finishSpaNavigation();
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", Object.assign({
        reason: reason || "fallback"
      }, extra || {}));
      window.location.href = url.href;
    }

    if (opts.captureScroll !== false) {
      saveCurrentScrollPositionInHistory();
    }
    snapshotCurrentSpaPage(spaState.currentUrl || window.location.href);

    const cachedHtml = getSpaCachedHtml(url);
    if (cachedHtml) {
      const cachedDoc = parseSpaDocument(cachedHtml);
      if (cachedDoc) {
        if (spaState.controller) {
          try {
            spaState.controller.abort();
          } catch (_err) {
            // Ignore abort errors.
          }
          spaState.controller = null;
        }

        if (opts.history === "push") {
          history.pushState(buildSpaHistoryState(url.href, 0, 0), "", url.href);
        } else if (opts.history === "replace") {
          history.replaceState(buildSpaHistoryState(url.href, 0, 0), "", url.href);
        }

        spaState.currentUrl = url.href;
        const cachedRenderStartedAt = getAudioTelemetryNow();
        const cachedSpaTelemetry = {
          album: getAlbumNameFromUrlLike(url.href),
          from_album: audioSwitchContext.fromAlbum || "",
          to_album: getAlbumNameFromUrlLike(url.href),
          from_url: rendered.href,
          to_url: url.href,
          cached: true
        };
        trackAudioRuntimeEvent("spa_render_start", cachedSpaTelemetry);
        try {
          await renderSpaDocument(cachedDoc, url.href, cachedSpaTelemetry);
        } catch (_err) {
          fallbackToDocumentNavigation("cached_render_error");
          return;
        }
        if (spaState.navToken !== navToken) {
          finishSpaNavigation();
          finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_cached_render" });
          trackAudioRuntimeEvent("nav:album_abort", {
            track: "album_open",
            album: getAlbumNameFromUrlLike(url.href),
            reason: "stale_cached_render",
            to_url: url.href
          });
          return;
        }
        await initPage();
        trackAudioRuntimeEvent("spa_render_done", {
          album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
          from_album: audioSwitchContext.fromAlbum || "",
          to_album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
          from_url: rendered.href,
          to_url: url.href,
          cached: true,
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - cachedRenderStartedAt))
        });
        finishAlbumOpenTelemetry(albumOpenContext, "album_open_done", {
          cached: true
        });
        trackAudioRuntimeEvent("nav:album_done", {
          track: "album_open",
          album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
          cached: true,
          to_url: url.href
        });
        logAudioRuntimeAlbumSwitch(audioSwitchContext, true);

        if (opts.scroll !== false) {
          window.scrollTo(0, 0);
        } else if (opts.restoreScroll) {
          const restoredFromCache = getScrollFromHistoryState(opts.restoreScroll);
          requestAnimationFrame(function () {
            window.scrollTo(restoredFromCache.x, restoredFromCache.y);
          });
        }

        snapshotCurrentSpaPage(url.href);

        // Refresh the cached document in background.
        prefetchSpaPage(url.href, { force: true, cacheMode: "default" });
        finishSpaNavigation();
        return;
      }
    }

    if (spaState.controller) {
      try {
        spaState.controller.abort();
      } catch (_err) {
        // Ignore abort errors.
      }
    }

    const controller = new AbortController();
    spaState.controller = controller;

    let response = null;
    try {
      response = await fetch(url.href, {
        signal: controller.signal,
        cache: "default",
        headers: {
          "Accept": "text/html",
          "X-Infra-Spa": "1"
        }
      });
    } catch (_err) {
      if (!controller.signal.aborted) fallbackToDocumentNavigation("fetch_error");
      else {
        finishSpaNavigation();
        finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "fetch_aborted" });
      }
      return;
    }

    if (!response || !response.ok) {
      fallbackToDocumentNavigation("bad_response", {
        status: response ? response.status : 0
      });
      return;
    }

    let html = "";
    try {
      html = await response.text();
    } catch (_err) {
      fallbackToDocumentNavigation("read_response_error");
      return;
    }

    if (controller.signal.aborted) {
      finishSpaNavigation();
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "render_aborted" });
      trackAudioRuntimeEvent("nav:album_abort", {
        track: "album_open",
        album: getAlbumNameFromUrlLike(url.href),
        reason: "render_aborted",
        to_url: url.href
      });
      return;
    }

    setSpaCachedHtml(url, html);
    const doc = parseSpaDocument(html);
    if (!doc || !doc.body) {
      fallbackToDocumentNavigation("parse_error");
      return;
    }

    // Update history before rendering so relative URLs resolve correctly.
    if (opts.history === "push") {
      history.pushState(buildSpaHistoryState(url.href, 0, 0), "", url.href);
    } else if (opts.history === "replace") {
      history.replaceState(buildSpaHistoryState(url.href, 0, 0), "", url.href);
    }

    spaState.currentUrl = url.href;
    const renderStartedAt = getAudioTelemetryNow();
    const spaTelemetry = {
      album: getAlbumNameFromUrlLike(url.href),
      from_album: audioSwitchContext.fromAlbum || "",
      to_album: getAlbumNameFromUrlLike(url.href),
      from_url: rendered.href,
      to_url: url.href,
      cached: false
    };
    trackAudioRuntimeEvent("spa_render_start", spaTelemetry);
    try {
      await renderSpaDocument(doc, url.href, spaTelemetry);
    } catch (_err) {
      fallbackToDocumentNavigation("render_error");
      return;
    }
    if (spaState.navToken !== navToken) {
      finishSpaNavigation();
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_render" });
      trackAudioRuntimeEvent("nav:album_abort", {
        track: "album_open",
        album: getAlbumNameFromUrlLike(url.href),
        reason: "stale_render",
        to_url: url.href
      });
      return;
    }
    await initPage();
    trackAudioRuntimeEvent("spa_render_done", {
      album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
      from_album: audioSwitchContext.fromAlbum || "",
      to_album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
      from_url: rendered.href,
      to_url: url.href,
      cached: false,
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - renderStartedAt))
    });
    finishAlbumOpenTelemetry(albumOpenContext, "album_open_done", {
      cached: false
    });
    trackAudioRuntimeEvent("nav:album_done", {
      track: "album_open",
      album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
      cached: false,
      to_url: url.href
    });
    logAudioRuntimeAlbumSwitch(audioSwitchContext, false);

    if (opts.scroll !== false) {
      window.scrollTo(0, 0);
    } else if (opts.restoreScroll) {
      const restored = getScrollFromHistoryState(opts.restoreScroll);
      requestAnimationFrame(function () {
        window.scrollTo(restored.x, restored.y);
      });
    }

    snapshotCurrentSpaPage(url.href);

    if (spaState.controller === controller) {
      spaState.controller = null;
    }
    finishSpaNavigation();
  }

    return {
      buildSpaSnapshotHtml: buildSpaSnapshotHtml,
      snapshotCurrentSpaPage: snapshotCurrentSpaPage,
      parseSpaDocument: parseSpaDocument,
      buildSpaDocumentFragment: buildSpaDocumentFragment,
      getSpaCriticalImages: getSpaCriticalImages,
      decodeSpaImage: decodeSpaImage,
      decodeSpaCriticalImages: decodeSpaCriticalImages,
      getSpaAlbumCoverImage: getSpaAlbumCoverImage,
      getImagePreferredSrc: getImagePreferredSrc,
      waitForSpaAlbumCoverReady: waitForSpaAlbumCoverReady,
      swapSpaFragment: swapSpaFragment,
      renderSpaDocument: renderSpaDocument,
      spaNavigate: spaNavigate
    };
  }

  window.InfraSpaRenderer = Object.assign(window.InfraSpaRenderer || {}, {
    createSpaRenderer: createSpaRenderer
  });
})();
