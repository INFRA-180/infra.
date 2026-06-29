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
    const resumeLiveHomeRoute = method(ctx, "resumeLiveHomeRoute");
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

  function getComparableSpaUrl(urlLike) {
    try {
      const url = new URL(String(urlLike || ""), window.location.href);
      return `${url.origin}${url.pathname}${url.search}`;
    } catch (_err) {
      return "";
    }
  }

  function findAlbumCardByUrl(root, urlLike) {
    if (!root || typeof root.querySelectorAll !== "function") return null;
    const target = getComparableSpaUrl(urlLike);
    if (!target) return null;
    return Array.from(root.querySelectorAll("a.album-card[href]")).find(function (card) {
      return getComparableSpaUrl(card.getAttribute("href")) === target;
    }) || null;
  }

  function captureLiveHomeRoute(targetUrl, renderedUrl) {
    if (!isMobilePwaCoverNavigation()) return null;
    if (!document.body.classList.contains("home-screen")) return null;
    if (!/\/music\/[^/]+\.html$/i.test(String(targetUrl && targetUrl.pathname || ""))) return null;
    if (String(window.location.search || "").includes("edit=1")) return null;

    const cards = Array.from(document.querySelectorAll("a.album-card[href]"));
    const targetCard = findAlbumCardByUrl(document, targetUrl && targetUrl.href);
    const priorityCards = [];
    const seenCards = new Set();
    function addCard(card) {
      if (!card || seenCards.has(card)) return;
      seenCards.add(card);
      priorityCards.push(card);
    }

    cards.forEach(function (card) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > -24 && rect.top < window.innerHeight + 24) addCard(card);
    });
    const targetIndex = targetCard ? cards.indexOf(targetCard) : -1;
    if (targetIndex >= 0) {
      addCard(cards[targetIndex - 1]);
      addCard(targetCard);
      addCard(cards[targetIndex + 1]);
    }

    const coverStates = priorityCards.slice(0, 5).map(function (card) {
      const image = card.querySelector("img.album-cover");
      const rect = card.getBoundingClientRect();
      return {
        href: getComparableSpaUrl(card.getAttribute("href")),
        source: image ? String(image.currentSrc || image.src || "") : "",
        displayWidth: image ? Math.max(1, Math.round(image.getBoundingClientRect().width)) : 0,
        viewportTop: Math.round(rect.top)
      };
    }).filter(function (state) {
      return Boolean(state.href && state.source);
    });

    const targetRect = targetCard ? targetCard.getBoundingClientRect() : null;
    return {
      url: getComparableSpaUrl(renderedUrl && renderedUrl.href),
      title: document.title,
      bodyClassName: document.body.className,
      scrollX: Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0)),
      scrollY: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)),
      anchorHref: getComparableSpaUrl(targetUrl && targetUrl.href),
      anchorViewportTop: targetRect ? Math.round(targetRect.top) : null,
      coverStates,
      fragment: null
    };
  }

  function canRestoreLiveHomeRoute(urlLike) {
    const route = spaState.liveHomeRoute;
    if (!route || !route.fragment || !route.fragment.childNodes.length) return false;
    return Boolean(route.url && route.url === getComparableSpaUrl(urlLike));
  }

  function lockLiveHomeCover(image, state) {
    if (!image || !state || !state.source) return;
    const source = String(state.source);
    let width = Number(image.naturalWidth) || 900;
    const match = source.match(/-cover-(\d+)\.webp(?:$|\?)/i);
    if (match) width = Number(match[1]) || width;
    image.setAttribute("src", source);
    image.setAttribute("srcset", `${source} ${width}w`);
    image.setAttribute("sizes", `${Math.max(1, Number(state.displayWidth) || width)}px`);
    image.setAttribute("loading", "eager");
    image.setAttribute("decoding", "async");
    image.setAttribute("fetchpriority", "high");
    image.dataset.spaCoverLocked = "1";
  }

  function prepareLiveHomeRouteCovers(route) {
    const states = Array.isArray(route && route.coverStates) ? route.coverStates : [];
    if (!route || !route.fragment || !states.length) {
      return Promise.resolve({ requested: 0, decoded: 0, timedOut: false });
    }

    const images = states.map(function (state) {
      const card = findAlbumCardByUrl(route.fragment, state.href);
      const image = card && card.querySelector("img.album-cover");
      if (image) lockLiveHomeCover(image, state);
      return image;
    }).filter(Boolean);
    if (!images.length) {
      return Promise.resolve({ requested: 0, decoded: 0, timedOut: false });
    }

    let decoded = 0;
    let timeoutId = 0;
    let timedOut = false;
    const decodePromise = Promise.all(images.map(function (image) {
      return decodeSpaImage(image).then(function (ready) {
        if (ready) decoded += 1;
        return ready;
      });
    }));
    const timeoutPromise = new Promise(function (resolve) {
      timeoutId = window.setTimeout(function () {
        timedOut = true;
        resolve();
      }, 260);
    });

    return Promise.race([decodePromise, timeoutPromise]).then(function () {
      if (timeoutId) window.clearTimeout(timeoutId);
      return {
        requested: images.length,
        decoded,
        timedOut
      };
    });
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

  function lockSpaCoverSource(image, sourceUrl, preferredWidth) {
    if (!image) return "";
    const width = Number(preferredWidth) <= 480 ? 480 : 900;
    const target = getImagePreferredSrc(image, sourceUrl, { preferredWidth: width });
    if (!target) return "";
    image.setAttribute("src", target);
    image.setAttribute("srcset", `${target} ${width}w`);
    image.setAttribute("sizes", width <= 480 ? "480px" : "900px");
    image.setAttribute("loading", "eager");
    image.setAttribute("decoding", "async");
    image.setAttribute("fetchpriority", "high");
    image.dataset.spaCoverLocked = "1";
    return target;
  }

  function lockSpaHomeCoverSources(fragment, sourceUrl, limit) {
    if (!fragment || typeof fragment.querySelectorAll !== "function") return 0;
    const maxImages = Math.max(1, Number(limit) || 4);
    return Array.from(fragment.querySelectorAll("img.album-cover"))
      .slice(0, maxImages)
      .reduce(function (count, image) {
        return count + (lockSpaCoverSource(image, sourceUrl, 900) ? 1 : 0);
      }, 0);
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
      preferredWidth: 900
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

    const targetReady = Boolean(
      audioState.albumCoverReadyUrls &&
      audioState.albumCoverReadyUrls.has(target)
    );

    if (!pwaCoverMode && targetReady) {
      finish(true, false, "memory");
      return Promise.resolve();
    }

    if (!pwaCoverMode && image.complete && image.naturalWidth > 0) {
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
        ? (currentCover.currentSrc || currentCover.src || getImagePreferredSrc(currentCover, window.location.href, { preferredWidth: 900 }))
        : linkedCoverSrc;
      function applyTargetCover() {
        image.setAttribute("src", target);
        image.setAttribute("srcset", `${target} 900w`);
        image.setAttribute("sizes", "(max-width: 980px) min(76vw, 290px), 290px");
        image.setAttribute("loading", "eager");
        image.setAttribute("decoding", "async");
        image.setAttribute("fetchpriority", "high");
        image.dataset.spaCoverLocked = "1";
      }
      function decodeTargetCoverElement() {
        applyTargetCover();
        return decodeSpaImage(image).then(function (decoded) {
          if (decoded) rememberReady(target, image);
          return decoded;
        });
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
      if (targetReady) {
        return decodeTargetCoverElement().then(function (decoded) {
          finish(decoded, false, "memory_locked");
          if (placeholderMap && sourceHref) placeholderMap.delete(sourceHref);
        });
      }
      return waitWithCacheHint().then(function (decoded) {
        if (decoded) {
          return decodeTargetCoverElement().then(function () {
            if (placeholderMap && sourceHref) placeholderMap.delete(sourceHref);
          });
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

  function getPaintImageState(image) {
    if (!image) {
      return {
        present: false,
        complete: false,
        naturalWidth: 0,
        currentSrc: ""
      };
    }
    let currentSrc = String(image.currentSrc || image.src || "");
    try {
      currentSrc = new URL(currentSrc, window.location.href).pathname;
    } catch (_err) {
      // Keep the raw value.
    }
    return {
      present: true,
      complete: Boolean(image.complete && image.naturalWidth > 0),
      naturalWidth: Number(image.naturalWidth) || 0,
      currentSrc
    };
  }

  function captureSpaPaintState() {
    const main = document.querySelector("main");
    const albumCover = getPaintImageState(document.querySelector(".album-layout .cover"));
    const homeCoverImages = Array.from(document.querySelectorAll("[data-catalog-grid='albums'] img.album-cover"));
    const homeCovers = homeCoverImages.slice(0, 4).map(getPaintImageState);
    const visibleHomeCovers = homeCoverImages.filter(function (image) {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }).map(getPaintImageState);
    let mainOpacity = null;
    try {
      mainOpacity = main ? Number.parseFloat(window.getComputedStyle(main).opacity) : null;
    } catch (_err) {
      mainOpacity = null;
    }
    return {
      paint_main_opacity: Number.isFinite(mainOpacity) ? mainOpacity : null,
      paint_album_cover_present: albumCover.present,
      paint_album_cover_complete: albumCover.complete,
      paint_album_cover_natural_width: albumCover.naturalWidth,
      paint_album_cover_src: albumCover.currentSrc,
      paint_home_cover_count: homeCovers.length,
      paint_home_cover_ready_count: homeCovers.filter(function (cover) { return cover.complete; }).length,
      paint_home_cover_srcs: homeCovers.map(function (cover) { return cover.currentSrc; }).join("|"),
      paint_visible_home_cover_count: visibleHomeCovers.length,
      paint_visible_home_cover_ready_count: visibleHomeCovers.filter(function (cover) { return cover.complete; }).length,
      paint_visible_home_cover_srcs: visibleHomeCovers.map(function (cover) { return cover.currentSrc; }).join("|"),
      paint_scroll_x: Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0)),
      paint_scroll_y: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0))
    };
  }

  function waitForSpaFirstPaint() {
    const startedAt = getAudioTelemetryNow();
    if (typeof window.requestAnimationFrame !== "function") {
      return Promise.resolve({
        first_paint_wait_ms: 0
      });
    }
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          resolve(Object.assign({
            first_paint_wait_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
          }, captureSpaPaintState()));
        });
      });
    });
  }

  function swapSpaFragment(fragment, bodyClassName, persistRoot, options) {
    const opts = options || {};
    const entering = fragment && fragment.querySelector ? fragment.querySelector("main") : null;
    const instantPwaSwap = isMobilePwaCoverNavigation();
    const animateEntry = Boolean(entering && !instantPwaSwap);
    const requestedScroll = opts.restoreScroll
      ? getScrollFromHistoryState(opts.restoreScroll)
      : null;
    const scheduledAt = getAudioTelemetryNow();
    if (entering) {
      entering.classList.toggle("spa-page-entering", animateEntry);
    }

    let applied = false;
    let domMutationMs = 0;
    let appliedScrollX = null;
    let appliedScrollY = null;
    function applySwap() {
      if (applied) return;
      applied = true;
      const mutationStartedAt = getAudioTelemetryNow();
      const liveHomeCapture = opts.liveHomeCapture;
      const preserveHome = Boolean(
        liveHomeCapture &&
        document.body.classList.contains("home-screen")
      );
      const liveHomeFragment = preserveHome ? document.createDocumentFragment() : null;

      Array.from(document.body.childNodes).forEach((node) => {
        if (node === persistRoot) return;
        if (liveHomeFragment) liveHomeFragment.appendChild(node);
        else node.remove();
      });
      if (liveHomeFragment && liveHomeCapture) {
        liveHomeCapture.fragment = liveHomeFragment;
        spaState.liveHomeRoute = liveHomeCapture;
      }

      document.body.className = bodyClassName;
      document.body.appendChild(fragment);

      if (document.body.firstChild !== persistRoot) {
        document.body.insertBefore(persistRoot, document.body.firstChild);
      }

      if (requestedScroll) {
        window.scrollTo(requestedScroll.x, requestedScroll.y);
        appliedScrollX = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
        appliedScrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
      }

      if (animateEntry) {
        window.requestAnimationFrame(function () {
          entering.classList.remove("spa-page-entering");
        });
      }
      domMutationMs = Math.max(0, Math.round(getAudioTelemetryNow() - mutationStartedAt));
    }

    function finish(mode) {
      const base = {
        swap_mode: mode,
        swap_schedule_wait_ms: Math.max(0, Math.round(getAudioTelemetryNow() - scheduledAt)),
        swap_dom_mutation_ms: domMutationMs,
        scroll_restore_requested_x: requestedScroll ? requestedScroll.x : null,
        scroll_restore_requested_y: requestedScroll ? requestedScroll.y : null,
        scroll_restore_applied_x: appliedScrollX,
        scroll_restore_applied_y: appliedScrollY
      };
      if (!instantPwaSwap) return Promise.resolve(base);
      return waitForSpaFirstPaint().then(function (paintState) {
        return Object.assign(base, paintState || {});
      });
    }

    if (
      instantPwaSwap &&
      !opts.avoidViewTransition &&
      typeof document.startViewTransition === "function"
    ) {
      document.documentElement.classList.add("pwa-native-swap");
      try {
        const transition = document.startViewTransition(function () {
          applySwap();
        });
        if (transition.ready && typeof transition.ready.catch === "function") {
          transition.ready.catch(function () {});
        }
        if (transition.finished && typeof transition.finished.then === "function") {
          transition.finished.then(
            function () { document.documentElement.classList.remove("pwa-native-swap"); },
            function () { document.documentElement.classList.remove("pwa-native-swap"); }
          );
        }
        return transition.updateCallbackDone
          .catch(function () {
            applySwap();
          })
          .then(function () {
            return finish("view_transition");
          });
      } catch (_err) {
        document.documentElement.classList.remove("pwa-native-swap");
        applySwap();
        return finish("instant_fallback");
      }
    }

    return new Promise(function (resolve) {
      const run = function () {
        applySwap();
        finish(instantPwaSwap ? "instant_raf" : "animated_raf").then(resolve);
      };

      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
      } else {
        run();
      }
    });
  }

  async function restoreLiveHomeRoute(urlLike, options, telemetry) {
    const opts = options || {};
    const route = spaState.liveHomeRoute;
    if (!route || !canRestoreLiveHomeRoute(urlLike)) return null;

    const startedAt = getAudioTelemetryNow();
    const coverResult = await prepareLiveHomeRouteCovers(route);
    if (Number.isFinite(opts.navToken) && spaState.navToken !== opts.navToken) return null;
    const persistRoot = getSpaPersistRoot();
    const requested = opts.restoreScroll
      ? getScrollFromHistoryState(opts.restoreScroll)
      : {
          x: Math.max(0, Number(route.scrollX) || 0),
          y: Math.max(0, Number(route.scrollY) || 0)
        };

    document.documentElement.classList.remove("pwa-native-swap");
    Array.from(document.body.childNodes).forEach(function (node) {
      if (node !== persistRoot) node.remove();
    });
    document.body.className = route.bodyClassName || "home-screen";
    document.body.appendChild(route.fragment);
    if (document.body.firstChild !== persistRoot) {
      document.body.insertBefore(persistRoot, document.body.firstChild);
    }
    if (route.title) document.title = route.title;

    window.scrollTo(requested.x, requested.y);
    let anchorCorrection = 0;
    const anchor = findAlbumCardByUrl(document, route.anchorHref);
    if (anchor && Number.isFinite(route.anchorViewportTop)) {
      anchorCorrection = Math.round(anchor.getBoundingClientRect().top - route.anchorViewportTop);
      if (Math.abs(anchorCorrection) > 0) {
        window.scrollBy(0, anchorCorrection);
      }
    }

    spaState.liveHomeRoute = null;
    resumeLiveHomeRoute();
    const appliedX = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
    const appliedY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
    const paintState = await waitForSpaFirstPaint();
    const result = Object.assign({
      swap_mode: "live_dom_restore",
      swap_schedule_wait_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
      swap_dom_mutation_ms: 0,
      home_dom_reused: true,
      scroll_restore_requested_x: requested.x,
      scroll_restore_requested_y: requested.y,
      scroll_restore_applied_x: appliedX,
      scroll_restore_applied_y: appliedY,
      scroll_restore_anchor_correction: anchorCorrection,
      scroll_restore_delta_y: appliedY - requested.y,
      restore_cover_requested_count: coverResult.requested,
      restore_cover_decoded_count: coverResult.decoded,
      restore_cover_timed_out: coverResult.timedOut
    }, paintState || {});

    trackAudioRuntimeEvent("spa_scroll_restore", Object.assign({}, telemetry || {}, result, {
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
    }));
    return result;
  }

  async function renderSpaDocument(doc, sourceUrl, telemetry, options) {
    const opts = options || {};
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
      const lockedCoverCount = lockSpaHomeCoverSources(fragment, sourceUrl, 4);
      await decodeSpaCriticalImages(fragment, Object.assign({}, telemetry || {}, {
        blocking: true,
        pwa_home_mode: true,
        source_locked_count: lockedCoverCount
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
    const swapResult = await swapSpaFragment(fragment, bodyClassName, persistRoot, {
      liveHomeCapture: opts.liveHomeCapture,
      restoreScroll: opts.restoreScroll,
      avoidViewTransition: Boolean(isHomePage && opts.restoreScroll && isIosDevice())
    });
    if (opts.restoreScroll) {
      trackAudioRuntimeEvent("spa_scroll_restore", Object.assign({}, telemetry || {}, swapResult || {}, {
        home_dom_reused: false
      }));
    }
    trackAudioRuntimeEvent("spa_swap_done", Object.assign({}, telemetry || {}, swapResult || {}, {
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
    const liveHomeCapture = captureLiveHomeRoute(url, rendered);

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

    if (canRestoreLiveHomeRoute(url.href)) {
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
      const liveRenderStartedAt = getAudioTelemetryNow();
      const liveSpaTelemetry = {
        album: "home",
        from_album: audioSwitchContext.fromAlbum || "",
        to_album: "home",
        from_url: rendered.href,
        to_url: url.href,
        cached: true,
        live_dom: true
      };
      trackAudioRuntimeEvent("spa_render_start", liveSpaTelemetry);
      trackAudioRuntimeEvent("spa_swap_start", liveSpaTelemetry);
      let liveRestoreResult = null;
      try {
        liveRestoreResult = await restoreLiveHomeRoute(url.href, {
          restoreScroll: opts.restoreScroll,
          navToken
        }, liveSpaTelemetry);
      } catch (_err) {
        spaState.liveHomeRoute = null;
      }

      if (spaState.navToken !== navToken) {
        finishSpaNavigation();
        return;
      }
      if (liveRestoreResult) {
        trackAudioRuntimeEvent("spa_swap_done", Object.assign({}, liveSpaTelemetry, liveRestoreResult, {
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - liveRenderStartedAt))
        }));
        trackAudioRuntimeEvent("spa_render_done", Object.assign({}, liveSpaTelemetry, {
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - liveRenderStartedAt))
        }));
        trackAudioRuntimeEvent("nav:album_done", {
          track: "album_open",
          album: "home",
          cached: true,
          live_dom: true,
          to_url: url.href
        });
        logAudioRuntimeAlbumSwitch(audioSwitchContext, true);
        snapshotCurrentSpaPage(url.href);
        prefetchSpaPage(url.href, { force: true, cacheMode: "default" });
        finishSpaNavigation();
        return;
      }
    }

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
          await renderSpaDocument(cachedDoc, url.href, cachedSpaTelemetry, {
            liveHomeCapture,
            restoreScroll: opts.restoreScroll
          });
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
      await renderSpaDocument(doc, url.href, spaTelemetry, {
        liveHomeCapture,
        restoreScroll: opts.restoreScroll
      });
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
