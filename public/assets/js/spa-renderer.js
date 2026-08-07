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
    const COVERS_CACHE_NAME = ctx.COVERS_CACHE_NAME || "infra-covers-v2";
    const setSpaCachedHtml = method(ctx, "setSpaCachedHtml");
    const getSpaCachedHtml = method(ctx, "getSpaCachedHtml", function () { return ""; });
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () { return document.body; });
    const normalizeCoverElementsForBase = method(ctx, "normalizeCoverElementsForBase");
    const absolutizeSrcsetForBase = method(ctx, "absolutizeSrcsetForBase", function (value) { return String(value || ""); });
    const getAudioTelemetryNow = method(ctx, "getAudioTelemetryNow", function () { return Date.now(); });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const recordCacheObservation = method(ctx, "recordCacheObservation");
    const parseSrcsetCandidates = method(ctx, "parseSrcsetCandidates", function () { return []; });
    const normalizeUrlAgainstBase = method(ctx, "normalizeUrlAgainstBase", function (value) { return String(value || ""); });
    const normalizeCoverUrl = method(ctx, "normalizeCoverUrl", function (value) { return String(value || ""); });
    const rememberAlbumCoverImage = method(ctx, "rememberAlbumCoverImage");
    const saveCurrentScrollPositionInHistory = method(ctx, "saveCurrentScrollPositionInHistory");
    const commitSpaHistoryState = method(ctx, "commitSpaHistoryState", function () {
      return { ok: true, mode: "none", skipped: true, errorName: "" };
    });
    const getAlbumNameFromUrlLike = method(ctx, "getAlbumNameFromUrlLike", function () { return ""; });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const createAlbumOpenTelemetryContext = method(ctx, "createAlbumOpenTelemetryContext", function () { return null; });
    const finishAlbumOpenTelemetry = method(ctx, "finishAlbumOpenTelemetry");
    const initPage = method(ctx, "initPage", function () { return Promise.resolve(); });
    const resumeLiveHomeRoute = method(ctx, "resumeLiveHomeRoute");
    const logAudioRuntimeAlbumSwitch = method(ctx, "logAudioRuntimeAlbumSwitch");
    const getScrollFromHistoryState = method(ctx, "getScrollFromHistoryState", function () { return { x: 0, y: 0 }; });
    const loadSpaPageDocument = method(ctx, "loadSpaPageDocument", function () { return Promise.resolve(null); });
    const releasePwaCoverHold = method(ctx, "releasePwaCoverHold");
    const disableNowPlayingOverlayUi = method(ctx, "disableNowPlayingOverlayUi");
    const syncPersistentUiAfterSpaSwap = method(ctx, "syncPersistentUiAfterSpaSwap");
    const isStandaloneDisplayMode = method(ctx, "isStandaloneDisplayMode", function () { return false; });
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const isAndroidDevice = method(ctx, "isAndroidDevice", function () { return false; });
    const getServiceWorkerReportedVersion = method(ctx, "getServiceWorkerReportedVersion", function () { return ""; });
    const PWA_SWAP_POLICY_STORAGE_KEY = "infra:pwa-swap-policy";

  const SPA_RUNTIME_BODY_CLASSES = new Set([
    "has-mobile-player",
    "now-playing-open",
    "is-transport-interacting",
    "ios-device",
    "favorites-view-open"
  ]);

  function sanitizeSpaBodyClassName(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(function (name) {
        return Boolean(name && !SPA_RUNTIME_BODY_CLASSES.has(name));
      })
      .join(" ");
  }

  function sanitizeSpaSnapshotRuntimeState(clone) {
    if (!clone || typeof clone.querySelector !== "function") return;
    const body = clone.querySelector("body");
    if (body) body.className = sanitizeSpaBodyClassName(body.className);
    clone.querySelectorAll(".favorites-view").forEach(function (node) {
      node.remove();
    });
    clone.querySelectorAll(".favorites-selecting, .album-favorite-selecting, .is-dragging, .is-drop-before, .is-drop-after").forEach(function (node) {
      node.classList.remove(
        "favorites-selecting",
        "album-favorite-selecting",
        "is-dragging",
        "is-drop-before",
        "is-drop-after"
      );
    });
    if (clone.classList) {
      clone.classList.remove("now-playing-open", "pwa-native-swap", "pwa-swap-active", "pwa-home-restore-active");
    }
  }

  function runPersistentUiPrepaintSync() {
    spaState.prepaintSyncActive = true;
    try {
      syncPersistentUiAfterSpaSwap({ reason: "spa_prepaint" });
    } finally {
      spaState.prepaintSyncActive = false;
    }
  }

  function isMobilePwaCoverNavigation() {
    const standalone = Boolean(isStandaloneDisplayMode());
    if (!standalone) return false;
    const mobileDevice = Boolean(isIosDevice() || isAndroidDevice());
    const mobileViewport = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 980px)").matches
      : window.innerWidth <= 980;
    return Boolean(mobileDevice || mobileViewport);
  }

  function getPwaSwapPolicy() {
    let requested = "";
    try {
      const current = new URL(window.location.href);
      requested = String(current.searchParams.get("pwa-swap") || "").trim().toLowerCase();
    } catch (_err) {
      requested = "";
    }
    if (requested === "view" || requested === "view_transition") requested = "view_transition";
    else if (requested === "simple" || requested === "instant") requested = "simple";
    else requested = "";

    if (requested) {
      try {
        window.sessionStorage.setItem(PWA_SWAP_POLICY_STORAGE_KEY, requested);
      } catch (_err) {
        // The explicit URL choice remains valid even when storage is unavailable.
      }
      return requested;
    }

    try {
      const stored = String(window.sessionStorage.getItem(PWA_SWAP_POLICY_STORAGE_KEY) || "");
      if (stored === "view_transition" || stored === "simple") return stored;
    } catch (_err) {
      // Default below.
    }

    // The simple atomic swap avoids an extra compositor snapshot on iOS. The
    // native path remains available as a same-device comparison control.
    return "simple";
  }

  function setSpaSwapPaintLock(active) {
    const root = document.documentElement;
    if (!root || !root.classList) return;
    if (typeof root.classList.toggle === "function") {
      root.classList.toggle("pwa-swap-active", Boolean(active));
    } else if (active && typeof root.classList.add === "function") {
      root.classList.add("pwa-swap-active");
    } else if (!active && typeof root.classList.remove === "function") {
      root.classList.remove("pwa-swap-active");
    }
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
    clone.querySelectorAll(".spa-route-layer").forEach(function (layer) {
      const state = String(layer.getAttribute("data-spa-route-state") || "");
      if (state && state !== "current") {
        layer.remove();
        return;
      }
      layer.classList.remove("is-staged", "is-retained-source", "is-promoted");
      layer.removeAttribute("aria-hidden");
      layer.removeAttribute("inert");
      layer.style.removeProperty("--spa-route-offset-y");
      layer.setAttribute("data-spa-route-state", "current");
    });
    const routeHost = clone.querySelector("#infraSpaRouteHost");
    if (routeHost) routeHost.classList.remove("is-handoff-active");
    sanitizeSpaSnapshotRuntimeState(clone);

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
      const imageRect = image ? image.getBoundingClientRect() : rect;
      let borderRadius = "6px";
      try {
        borderRadius = image ? window.getComputedStyle(image).borderRadius || borderRadius : borderRadius;
      } catch (_err) {
        borderRadius = "6px";
      }
      return {
        href: getComparableSpaUrl(card.getAttribute("href")),
        source: image ? preferPwaCoverSource(image.currentSrc || image.src || "") : "",
        displayWidth: image ? Math.max(1, Math.round(imageRect.width)) : 0,
        displayHeight: image ? Math.max(1, Math.round(imageRect.height)) : 0,
        viewportLeft: Math.round(imageRect.left),
        viewportTop: Math.round(imageRect.top),
        borderRadius
      };
    }).filter(function (state) {
      return Boolean(state.href && state.source);
    });

    const targetRect = targetCard ? targetCard.getBoundingClientRect() : null;
    const documentHeight = Math.max(
      document.documentElement ? document.documentElement.scrollHeight : 0,
      document.body ? document.body.scrollHeight : 0,
      window.innerHeight || 0
    );
    return {
      url: getComparableSpaUrl(renderedUrl && renderedUrl.href),
      title: document.title,
      bodyClassName: sanitizeSpaBodyClassName(document.body.className),
      scrollX: Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0)),
      scrollY: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)),
      documentHeight: Math.max(0, Math.round(documentHeight)),
      anchorHref: getComparableSpaUrl(targetUrl && targetUrl.href),
      anchorViewportTop: targetRect ? Math.round(targetRect.top) : null,
      coverStates,
      frozenResourceCount: 0,
      fragment: null
    };
  }

  function canRestoreLiveHomeRoute(urlLike) {
    const route = spaState.liveHomeRoute;
    if (!route || !route.fragment || !route.fragment.childNodes.length) return false;
    return Boolean(route.url && route.url === getComparableSpaUrl(urlLike));
  }

  function freezeLiveHomeResourceUrls(root, baseUrl) {
    if (!root || typeof root.querySelectorAll !== "function") return 0;
    let frozen = 0;

    root.querySelectorAll("img[src], source[src]").forEach(function (element) {
      const value = String(element.getAttribute("src") || "").trim();
      if (!value) return;
      element.setAttribute("src", normalizeUrlAgainstBase(value, baseUrl));
      frozen += 1;
    });
    root.querySelectorAll("[srcset]").forEach(function (element) {
      const value = String(element.getAttribute("srcset") || "").trim();
      if (!value) return;
      element.setAttribute("srcset", absolutizeSrcsetForBase(value, baseUrl));
      frozen += 1;
    });
    root.querySelectorAll("video[poster]").forEach(function (element) {
      const value = String(element.getAttribute("poster") || "").trim();
      if (!value) return;
      element.setAttribute("poster", normalizeUrlAgainstBase(value, baseUrl));
      frozen += 1;
    });
    return frozen;
  }

  function lockLiveHomeCover(image, state) {
    if (!image || !state || !state.source) return;
    if (!String(image.getAttribute("src") || "").trim()) {
      image.setAttribute("src", String(state.source));
    }
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

    const images = states.slice(0, 4).map(function (state) {
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
      if (image.complete && image.naturalWidth > 0) {
        decoded += 1;
        return Promise.resolve(true);
      }
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
    const canonicalWidth = 1200;
    const srcset = String(img.getAttribute("srcset") || "").trim();
    if (srcset) {
      const candidates = parseSrcsetCandidates(srcset).filter(function (candidate) { return Boolean(candidate && candidate.src); });
      if (candidates.length) {
        return normalizeCoverUrl(
          normalizeUrlAgainstBase(candidates[candidates.length - 1].src, sourceUrl || window.location.href),
          { width: canonicalWidth }
        );
      }
    }
    const src = String(img.getAttribute("src") || "").trim();
    return src ? normalizeCoverUrl(normalizeUrlAgainstBase(src, sourceUrl || window.location.href), { width: canonicalWidth }) : "";
  }

  function preferPwaCoverSource(source) {
    const value = String(source || "").trim();
    return value ? normalizeCoverUrl(value, { width: 1200 }) : "";
  }

  function lockSpaCoverSource(image, sourceUrl, preferredWidth) {
    if (!image) return "";
    const width = 1200;
    const target = getImagePreferredSrc(image, sourceUrl, { preferredWidth: width });
    if (!target) return "";
    const currentSource = String(image.getAttribute("src") || "").trim();
    const normalizedCurrent = currentSource
      ? normalizeCoverUrl(normalizeUrlAgainstBase(currentSource, sourceUrl || window.location.href), { width })
      : "";
    if (normalizedCurrent !== target) image.setAttribute("src", target);
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.setAttribute("loading", "eager");
    // This is the single route-critical hero image. Present it in the same
    // paint as the album content; async decoding is kept for Home-grid images.
    image.setAttribute("decoding", "sync");
    image.setAttribute("fetchpriority", "high");
    image.dataset.spaCoverLocked = "1";
    return target;
  }

  function lockSpaHomeCoverSources(fragment, sourceUrl, limit) {
    if (!fragment || typeof fragment.querySelectorAll !== "function") return 0;
    const maxImages = Math.max(1, Number(limit) || 4);
    const width = 1200;
    return Array.from(fragment.querySelectorAll("img.album-cover"))
      .slice(0, maxImages)
      .reduce(function (count, image) {
        return count + (lockSpaCoverSource(image, sourceUrl, width) ? 1 : 0);
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
    const coverWidth = 1200;
    const target = getImagePreferredSrc(image, sourceUrl, {
      preferredWidth: coverWidth
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
    lockSpaCoverSource(image, sourceUrl, coverWidth);

    function rememberReady(urlValue, imageValue) {
      if (!urlValue) return;
      rememberAlbumCoverImage(urlValue, imageValue);
      if (!imageValue && audioState.albumCoverReadyUrls && typeof audioState.albumCoverReadyUrls.add === "function") {
        audioState.albumCoverReadyUrls.add(urlValue);
      }
    }

    function finish(decoded, timedOut, cacheHint) {
      let displayPixels = 0;
      try {
        const rect = image.getBoundingClientRect();
        displayPixels = Math.round(Math.max(rect.width, rect.height) * Math.max(1, window.devicePixelRatio || 1));
      } catch (_err) {
        displayPixels = 0;
      }
      trackAudioRuntimeEvent("cover_decode_duration", Object.assign({}, telemetry || {}, {
        image_count: 1,
        decoded_count: decoded ? 1 : 0,
        timed_out: Boolean(timedOut),
        album_cover_only: true,
        pwa_cover_mode: Boolean(pwaCoverMode),
        target_width: coverWidth,
        cover_natural_width: Number(image.naturalWidth) || (decoded ? coverWidth : 0),
        cover_display_px: displayPixels,
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
        let decodeStarted = false;
        function done(decoded, timedOut) {
          if (settled) return;
          settled = true;
          if (timeoutId) window.clearTimeout(timeoutId);
          image.removeEventListener("load", handleLoad);
          image.removeEventListener("error", handleError);
          if (decoded) rememberReady(target, image);
          finish(decoded, timedOut, cacheHint);
          resolve(Boolean(decoded));
        }
        function startDecode() {
          if (decodeStarted || typeof image.decode !== "function") return;
          decodeStarted = true;
          image.decode().then(
            function () { done(true, false); },
            function () {
              if (image.complete && image.naturalWidth > 0) done(true, false);
            }
          );
        }
        function handleLoad() {
          if (typeof image.decode === "function") {
            startDecode();
            return;
          }
          done(true, false);
        }
        function handleError() {
          done(false, false);
        }
        timeoutId = window.setTimeout(function () {
          done(false, true);
        }, timeoutMs);
        image.addEventListener("load", handleLoad);
        image.addEventListener("error", handleError);
        if (image.complete && image.naturalWidth > 0) {
          done(true, false);
          return;
        }
        startDecode();
      });
    };

    const waitWithCacheHint = function () {
      if (typeof caches !== "undefined" && caches.open) {
        return caches.open(COVERS_CACHE_NAME).then(function (cache) {
          return cache.match(target).then(function (cached) {
            recordCacheObservation("cover", cached ? "hit" : "miss");
            if (cached) return waitForDecode("cache");
            return waitForDecode("network");
          });
        }).catch(function () {
          return waitForDecode("unknown");
        });
      }
      return waitForDecode("unknown");
    };

    if (pwaCoverMode && targetReady) return waitForDecode("memory");

    // Navigation only waits for the destination album cover. A global session
    // warmup here delayed the page for unrelated covers and competed with audio.
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

  function getRenderedCoverGeometry(image) {
    if (!image || typeof image.getBoundingClientRect !== "function") {
      return {
        cover_render_width_px: 0,
        cover_render_height_px: 0,
        cover_aspect_ratio_milli: 0,
        cover_geometry_ok: true,
        cover_object_fit: ""
      };
    }
    const rect = image.getBoundingClientRect();
    const width = Math.max(0, Math.round(Number(rect.width) || 0));
    const height = Math.max(0, Math.round(Number(rect.height) || 0));
    const ratioMilli = width > 0 && height > 0 ? Math.round((width / height) * 1000) : 0;
    let objectFit = "";
    try {
      objectFit = String(window.getComputedStyle(image).objectFit || "");
    } catch (_err) {
      objectFit = "";
    }
    return {
      cover_render_width_px: width,
      cover_render_height_px: height,
      cover_aspect_ratio_milli: ratioMilli,
      cover_geometry_ok: !width || !height || Math.abs(ratioMilli - 1000) <= 10,
      cover_object_fit: objectFit
    };
  }

  function captureSpaPaintState() {
    const main = document.querySelector("main");
    const albumCoverImage = document.querySelector(".album-layout .cover");
    const albumCover = getPaintImageState(albumCoverImage);
    const albumCoverGeometry = getRenderedCoverGeometry(albumCoverImage);
    const homeCoverImages = Array.from(document.querySelectorAll("[data-catalog-grid='albums'] img.album-cover"));
    const homeCovers = homeCoverImages.slice(0, 4).map(getPaintImageState);
    const visibleHomeCovers = homeCoverImages.filter(function (image) {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }).map(getPaintImageState);
    const relevantCoverCount = albumCover.present ? 1 : visibleHomeCovers.length;
    const relevantCoverReadyCount = albumCover.present
      ? (albumCover.complete ? 1 : 0)
      : visibleHomeCovers.filter(function (cover) { return cover.complete; }).length;
    let mainOpacity = null;
    try {
      mainOpacity = main ? Number.parseFloat(window.getComputedStyle(main).opacity) : null;
    } catch (_err) {
      mainOpacity = null;
    }
    return Object.assign({
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
      paint_relevant_cover_count: relevantCoverCount,
      paint_relevant_cover_ready_count: relevantCoverReadyCount,
      paint_relevant_cover_ready: relevantCoverCount === 0 || relevantCoverReadyCount === relevantCoverCount,
      paint_scroll_x: Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0)),
      paint_scroll_y: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0))
    }, albumCoverGeometry);
  }

  function waitForSpaFirstPaint() {
    const startedAt = getAudioTelemetryNow();
    if (typeof window.requestAnimationFrame !== "function") {
      const paintState = captureSpaPaintState();
      return Promise.resolve(Object.assign({
        first_paint_wait_ms: 0,
        second_paint_wait_ms: 0,
        second_paint_relevant_cover_count: paintState.paint_relevant_cover_count,
        second_paint_relevant_cover_ready_count: paintState.paint_relevant_cover_ready_count,
        second_paint_relevant_cover_ready: paintState.paint_relevant_cover_ready
      }, paintState));
    }
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () {
        const firstPaintState = captureSpaPaintState();
        const firstPaintWaitMs = Math.max(0, Math.round(getAudioTelemetryNow() - startedAt));
        window.requestAnimationFrame(function () {
          const secondPaintState = captureSpaPaintState();
          resolve(Object.assign({
            first_paint_wait_ms: firstPaintWaitMs,
            second_paint_wait_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
            second_paint_relevant_cover_count: secondPaintState.paint_relevant_cover_count,
            second_paint_relevant_cover_ready_count: secondPaintState.paint_relevant_cover_ready_count,
            second_paint_relevant_cover_ready: secondPaintState.paint_relevant_cover_ready
          }, firstPaintState));
        });
      });
    });
  }

  function applySpaScrollOnNextFrame(scrollState) {
    if (!scrollState) return Promise.resolve(null);
    return new Promise(function (resolve) {
      const apply = function () {
        window.scrollTo(scrollState.x, scrollState.y);
        resolve({
          x: Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0)),
          y: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0))
        });
      };
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(apply);
      } else {
        apply();
      }
    });
  }

  function nextSpaAnimationFrame() {
    if (typeof window.requestAnimationFrame !== "function") return Promise.resolve();
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () { resolve(); });
    });
  }

  function waitForSpaRenderingOpportunity() {
    if (typeof window.requestAnimationFrame !== "function") return Promise.resolve();
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { resolve(); });
      });
    });
  }

  function getSpaRouteClassName(bodyClassName) {
    return sanitizeSpaBodyClassName(bodyClassName)
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  }

  function ensureSpaRouteHost(persistRoot) {
    let host = document.getElementById("infraSpaRouteHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "infraSpaRouteHost";
      host.className = "spa-route-host";
      const routeLayer = document.createElement("div");
      routeLayer.className = `spa-route-layer ${getSpaRouteClassName(document.body.className)}`.trim();
      routeLayer.setAttribute("data-spa-route-state", "current");
      const preferredNodes = Array.from(document.body.childNodes).filter(function (node) {
        return node !== persistRoot && node !== host && node.nodeType === 1 &&
          /^(HEADER|MAIN)$/.test(String(node.nodeName || ""));
      });
      const movableNodes = preferredNodes.length ? preferredNodes : Array.from(document.body.childNodes).filter(function (node) {
        return node !== persistRoot && node !== host && String(node.nodeName || "") !== "SCRIPT";
      });
      movableNodes.forEach(function (node) { routeLayer.appendChild(node); });
      host.appendChild(routeLayer);
      if (persistRoot && persistRoot.parentNode === document.body) {
        document.body.insertBefore(host, persistRoot.nextSibling);
      } else {
        document.body.insertBefore(host, document.body.firstChild);
      }
    }
    host.classList.add("spa-route-host");
    let current = host.querySelector(".spa-route-layer[data-spa-route-state='current']") ||
      host.querySelector(".spa-route-layer");
    if (current) {
      current.classList.add("spa-route-layer");
      current.setAttribute("data-spa-route-state", "current");
    }
    return { host, current };
  }

  function prepareSpaRouteLayer(fragment, bodyClassName) {
    let layer = fragment && typeof fragment.querySelector === "function"
      ? fragment.querySelector("#infraSpaRouteHost .spa-route-layer") || fragment.querySelector(".spa-route-layer")
      : null;
    const supplementalNodes = fragment && typeof fragment.querySelectorAll === "function"
      ? Array.from(fragment.querySelectorAll("template[id]"))
      : [];
    if (layer) {
      layer.remove();
    } else {
      layer = document.createElement("div");
      Array.from(fragment && fragment.childNodes || []).forEach(function (node) {
        if (node.nodeType === 1 && String(node.nodeName || "") === "TEMPLATE") return;
        layer.appendChild(node);
      });
    }
    layer.className = `spa-route-layer ${getSpaRouteClassName(bodyClassName)}`.trim();
    layer.setAttribute("data-spa-route-state", "staged");
    supplementalNodes.forEach(function (node) { node.remove(); });
    return { layer, supplementalNodes };
  }

  function installSpaSupplementalNodes(nodes) {
    (Array.isArray(nodes) ? nodes : []).forEach(function (node) {
      const id = String(node && node.id || "");
      if (!id || document.getElementById(id)) return;
      document.body.appendChild(node);
    });
  }

  function swapSpaFragment(fragment, bodyClassName, persistRoot, options) {
    const opts = options || {};
    const entering = fragment && fragment.querySelector ? fragment.querySelector("main") : null;
    const instantPwaSwap = isMobilePwaCoverNavigation();
    const animateEntry = Boolean(entering && !instantPwaSwap);
    const requestedScroll = opts.restoreScroll
      ? getScrollFromHistoryState(opts.restoreScroll)
      : (opts.resetScroll ? { x: 0, y: 0 } : null);
    const scheduledAt = getAudioTelemetryNow();
    const swapPolicy = instantPwaSwap ? getPwaSwapPolicy() : "standard";
    if (entering) {
      entering.classList.toggle("spa-page-entering", animateEntry);
    }
    if (instantPwaSwap) setSpaSwapPaintLock(true);

    const routeHostState = ensureSpaRouteHost(persistRoot);
    const routeHost = routeHostState.host;
    const sourceRoute = routeHostState.current;
    const preparedRoute = prepareSpaRouteLayer(fragment, bodyClassName);
    const destinationRoute = preparedRoute.layer;

    let applied = false;
    let domMutationMs = 0;
    let appliedScrollX = null;
    let appliedScrollY = null;
    let scrollAppliedDuringSwap = false;
    let handoffStageMs = 0;
    let sourceRetainedUntilPromote = false;
    let sourceDetachedAfterPromote = false;

    function freezeSourceRouteForCapture() {
      const liveHomeCapture = opts.liveHomeCapture;
      if (!liveHomeCapture || !sourceRoute || !sourceRoute.classList.contains("home-screen")) return;
      liveHomeCapture.frozenResourceCount = freezeLiveHomeResourceUrls(
        sourceRoute,
        liveHomeCapture.url || window.location.href
      );
    }

    function preserveOrRemoveSourceRoute() {
      if (!sourceRoute || !sourceRoute.parentNode) return;
      const liveHomeCapture = opts.liveHomeCapture;
      const preserveHome = Boolean(
        liveHomeCapture &&
        sourceRoute.classList.contains("home-screen")
      );
      if (preserveHome) {
        const liveHomeFragment = document.createDocumentFragment();
        liveHomeFragment.appendChild(sourceRoute);
        liveHomeCapture.fragment = liveHomeFragment;
        spaState.liveHomeRoute = liveHomeCapture;
      } else {
        sourceRoute.remove();
      }
      sourceDetachedAfterPromote = true;
    }

    function applyRequestedScroll() {
      if (!requestedScroll) return;
      window.scrollTo(requestedScroll.x, requestedScroll.y);
      if (typeof opts.afterScroll === "function") opts.afterScroll();
      appliedScrollX = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
      appliedScrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
      scrollAppliedDuringSwap = true;
    }

    function applySwap() {
      if (applied) return;
      applied = true;
      const mutationStartedAt = getAudioTelemetryNow();
      freezeSourceRouteForCapture();
      document.body.className = bodyClassName;
      routeHost.appendChild(destinationRoute);
      destinationRoute.setAttribute("data-spa-route-state", "current");
      installSpaSupplementalNodes(preparedRoute.supplementalNodes);
      preserveOrRemoveSourceRoute();
      applyRequestedScroll();
      runPersistentUiPrepaintSync();

      if (animateEntry) {
        window.requestAnimationFrame(function () {
          entering.classList.remove("spa-page-entering");
        });
      }
      domMutationMs = Math.max(0, Math.round(getAudioTelemetryNow() - mutationStartedAt));
    }

    async function applyPaintedHandoff() {
      if (applied) return;
      applied = true;
      const mutationStartedAt = getAudioTelemetryNow();
      freezeSourceRouteForCapture();
      const sourceScrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
      const destinationScrollY = requestedScroll ? requestedScroll.y : 0;
      destinationRoute.classList.add("is-staged");
      destinationRoute.style.setProperty("--spa-route-offset-y", `${-destinationScrollY}px`);
      destinationRoute.setAttribute("aria-hidden", "true");
      destinationRoute.inert = true;
      routeHost.classList.add("is-handoff-active");
      routeHost.appendChild(destinationRoute);
      installSpaSupplementalNodes(preparedRoute.supplementalNodes);

      const stagedAt = getAudioTelemetryNow();
      await waitForSpaRenderingOpportunity();
      handoffStageMs = Math.max(0, Math.round(getAudioTelemetryNow() - stagedAt));
      sourceRetainedUntilPromote = Boolean(sourceRoute && sourceRoute.isConnected);

      if (sourceRoute) {
        sourceRoute.classList.add("is-retained-source");
        sourceRoute.style.setProperty("--spa-route-offset-y", `${-sourceScrollY}px`);
        sourceRoute.setAttribute("data-spa-route-state", "outgoing");
        sourceRoute.setAttribute("aria-hidden", "true");
        sourceRoute.inert = true;
      }
      destinationRoute.classList.remove("is-staged");
      destinationRoute.classList.add("is-promoted");
      destinationRoute.style.removeProperty("--spa-route-offset-y");
      destinationRoute.setAttribute("data-spa-route-state", "current");
      destinationRoute.removeAttribute("aria-hidden");
      destinationRoute.inert = false;
      document.body.className = bodyClassName;
      applyRequestedScroll();
      runPersistentUiPrepaintSync();
      domMutationMs = Math.max(0, Math.round(getAudioTelemetryNow() - mutationStartedAt));

      await nextSpaAnimationFrame();
      preserveOrRemoveSourceRoute();
      destinationRoute.classList.remove("is-promoted");
      routeHost.classList.remove("is-handoff-active");
    }

    function finish(mode) {
      const scrollPromise = scrollAppliedDuringSwap
        ? Promise.resolve({ x: appliedScrollX, y: appliedScrollY })
        : applySpaScrollOnNextFrame(requestedScroll);
      return scrollPromise.then(function (appliedScroll) {
        if (appliedScroll) {
          appliedScrollX = appliedScroll.x;
          appliedScrollY = appliedScroll.y;
        }
        const routeClasses = String(document.body.className || "").split(/\s+/);
        const base = {
          swap_mode: mode,
          swap_policy: swapPolicy,
          handoff_strategy: mode === "painted_handoff" ? "dual_route" : "",
          handoff_stage_ms: handoffStageMs,
          source_retained_until_promote: sourceRetainedUntilPromote,
          source_detached_after_promote: sourceDetachedAfterPromote,
          route_kind: routeClasses.includes("album-screen")
            ? "album"
            : (routeClasses.includes("home-screen") ? "home" : "other"),
          swap_schedule_wait_ms: Math.max(0, Math.round(getAudioTelemetryNow() - scheduledAt)),
          swap_dom_mutation_ms: domMutationMs,
          scroll_restore_requested_x: requestedScroll ? requestedScroll.x : null,
          scroll_restore_requested_y: requestedScroll ? requestedScroll.y : null,
          scroll_restore_applied_x: appliedScrollX,
          scroll_restore_applied_y: appliedScrollY
        };
        if (!instantPwaSwap) return base;
        return waitForSpaFirstPaint().then(function (paintState) {
          return Object.assign(base, paintState || {});
        });
      }).then(function (result) {
        if (instantPwaSwap) setSpaSwapPaintLock(false);
        return result;
      }, function (error) {
        if (instantPwaSwap) setSpaSwapPaintLock(false);
        throw error;
      });
    }

    const canUseNativeViewTransition = Boolean(
      instantPwaSwap &&
      !opts.avoidViewTransition &&
      swapPolicy === "view_transition" &&
      typeof document.startViewTransition === "function"
    );
    if (canUseNativeViewTransition) {
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

    if (instantPwaSwap) {
      return applyPaintedHandoff().then(function () {
        return finish("painted_handoff");
      });
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
    const requested = opts.restoreScroll
      ? getScrollFromHistoryState(opts.restoreScroll)
      : {
          x: Math.max(0, Number(route.scrollX) || 0),
          y: Math.max(0, Number(route.scrollY) || 0)
        };
    const coverResult = await prepareLiveHomeRouteCovers(route);
    if (Number.isFinite(opts.navToken) && spaState.navToken !== opts.navToken) {
      return null;
    }
    const persistRoot = getSpaPersistRoot();
    let anchorCorrection = 0;
    if (route.title) document.title = route.title;
    const swapResult = await swapSpaFragment(
      route.fragment,
      sanitizeSpaBodyClassName(route.bodyClassName || "home-screen"),
      persistRoot,
      {
        restoreScroll: requested,
        afterScroll: function () {
          const anchor = findAlbumCardByUrl(document, route.anchorHref);
          if (!anchor || !Number.isFinite(route.anchorViewportTop)) return;
          anchorCorrection = Math.round(anchor.getBoundingClientRect().top - route.anchorViewportTop);
          if (Math.abs(anchorCorrection) > 0) window.scrollBy(0, anchorCorrection);
        }
      }
    );

    spaState.liveHomeRoute = null;
    const appliedX = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
    const appliedY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
    // Defer non-visual Home maintenance until the retained route has produced
    // its first frames; cloning the whole route here previously delayed paint.
    resumeLiveHomeRoute();
    const result = Object.assign({}, swapResult || {}, {
      swap_mode: String(swapResult && swapResult.swap_mode || "live_dom_restore"),
      swap_policy: String(swapResult && swapResult.swap_policy || "standard"),
      route_kind: "home",
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
      restore_cover_timed_out: coverResult.timedOut,
      frozen_resource_url_count: Math.max(0, Number(route.frozenResourceCount) || 0)
    });

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

    const bodyClassName = sanitizeSpaBodyClassName(
      doc.body ? doc.body.className : document.body.className
    );
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
      resetScroll: Boolean(opts.resetScroll),
      avoidViewTransition: Boolean(opts.avoidViewTransition)
    });
    if (opts.restoreScroll) {
      trackAudioRuntimeEvent("spa_scroll_restore", Object.assign({}, telemetry || {}, swapResult || {}, {
        home_dom_reused: false
      }));
    }
    trackAudioRuntimeEvent("spa_swap_done", Object.assign({}, telemetry || {}, swapResult || {}, {
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
    }));
    if (isAlbumPage && isMobilePwaCoverNavigation()) {
      releasePwaCoverHold("album_first_paint");
    } else if (isHomePage && isMobilePwaCoverNavigation()) {
      releasePwaCoverHold("home_first_paint");
    }
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
    if (same) {
      releasePwaCoverHold("same_url");
      return;
    }
    if (audioState.nowPlayingOpen || audioState.nowPlayingClosing) {
      // The document capture listener reaches spaNavigate before the overlay
      // album link's bubble listener. Finalize the overlay synchronously so
      // route snapshots never retain the fixed fullscreen body or a hidden
      // persistent mini-player.
      disableNowPlayingOverlayUi();
    }
    const liveHomeCapture = captureLiveHomeRoute(url, rendered);

    const navNow = getAudioTelemetryNow();
    if (spaState.navigationActive && spaState.activeNavigationHref === url.href) {
      // Reuse the in-flight route. Starting a second render for the same album
      // creates competing history/snapshot work and was the source of several
      // long "aborted on close" telemetry records.
      return;
    }
    const sameRecentTarget = spaState.lastNavHref === url.href && spaState.lastNavTs && navNow - spaState.lastNavTs < 650;
    if (sameRecentTarget && opts.history === "push") {
      releasePwaCoverHold("duplicate_tap");
      return;
    }
    spaState.lastNavHref = url.href;
    spaState.lastNavTs = navNow;
    const navToken = spaState.navToken + 1;
    spaState.navToken = navToken;
    spaState.navigationActive = true;
    spaState.activeNavigationHref = url.href;
    trackAudioRuntimeEvent("nav:album_start", {
      track: "album_open",
      album: getAlbumNameFromUrlLike(url.href),
      from_url: rendered.href,
      to_url: url.href,
      navigation_token: navToken,
      trigger: String(opts.trigger || ""),
      surface: String(opts.surface || ""),
      card_rank: Math.max(0, Math.round(Number(opts.cardRank) || 0)),
      lower_half: Boolean(opts.lowerHalf),
      gesture_token: String(opts.gestureToken || "")
    });

    const audioSwitchContext = {
      startedAt: Date.now(),
      fromAlbum: getCurrentAlbumTitle() || document.title || "",
      fromUrl: rendered.href,
      toUrl: url.href
    };
    const albumOpenContext = createAlbumOpenTelemetryContext(url, rendered, Object.assign({}, opts, {
      navigationToken: navToken
    }));

    function finishSpaNavigation() {
      if (spaState.navToken === navToken) {
        spaState.navigationActive = false;
        spaState.activeNavigationHref = "";
      }
    }

    function fallbackToDocumentNavigation(reason, extra) {
      finishSpaNavigation();
      releasePwaCoverHold(reason || "fallback");
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", Object.assign({
        reason: reason || "fallback"
      }, extra || {}));
      window.location.href = url.href;
    }

    function commitNavigationHistory(stage) {
      const mode = String(opts.history || "none");
      if (mode !== "push" && mode !== "replace") return true;
      const result = commitSpaHistoryState(mode, url.href, 0, 0);
      if (!result || result.ok !== false) return true;
      const errorName = String(result.errorName || "HistoryError")
        .replace(/[^a-z0-9_-]+/gi, "_")
        .slice(0, 48);
      fallbackToDocumentNavigation(`history_write_${stage}_${errorName}`, {
        error_name: errorName
      });
      return false;
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

      if (!commitNavigationHistory("live_home")) return;

      spaState.currentUrl = url.href;
      recordCacheObservation("html", "hit");
      const liveRenderStartedAt = getAudioTelemetryNow();
      const liveSpaTelemetry = {
        album: "home",
        from_album: audioSwitchContext.fromAlbum || "",
        to_album: "home",
        from_url: rendered.href,
        to_url: url.href,
        cached: true,
        live_dom: true,
        navigation_token: navToken
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
          to_url: url.href,
          navigation_token: navToken
        });
        logAudioRuntimeAlbumSwitch(audioSwitchContext, true);
        finishSpaNavigation();
        return;
      }
    }

    const cachedHtml = getSpaCachedHtml(url);
    if (cachedHtml) {
      const cachedDoc = parseSpaDocument(cachedHtml);
      if (cachedDoc) {
        recordCacheObservation("html", "hit");
        trackAudioRuntimeEvent("spa_html_response", {
          track: "album_open",
          album: getAlbumNameFromUrlLike(url.href),
          to_url: url.href,
          navigation_token: navToken,
          strategy: "client:client_memory",
          cache_hint: "hit",
          cached: true,
          response_ms: 0
        });
        if (spaState.controller) {
          try {
            spaState.controller.abort();
          } catch (_err) {
            // Ignore abort errors.
          }
          spaState.controller = null;
        }

        if (!commitNavigationHistory("client_cache")) return;

        spaState.currentUrl = url.href;
        const cachedRenderStartedAt = getAudioTelemetryNow();
        const cachedSpaTelemetry = {
          album: getAlbumNameFromUrlLike(url.href),
          from_album: audioSwitchContext.fromAlbum || "",
          to_album: getAlbumNameFromUrlLike(url.href),
          from_url: rendered.href,
          to_url: url.href,
          cached: true,
          navigation_token: navToken
        };
        trackAudioRuntimeEvent("spa_render_start", cachedSpaTelemetry);
        try {
          await renderSpaDocument(cachedDoc, url.href, cachedSpaTelemetry, {
            liveHomeCapture,
            restoreScroll: opts.restoreScroll,
            resetScroll: opts.scroll !== false
          });
        } catch (_err) {
          fallbackToDocumentNavigation("cached_render_error");
          return;
        }
        if (spaState.navToken !== navToken) {
          finishSpaNavigation();
          releasePwaCoverHold("stale_cached_render");
          finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_cached_render" });
          trackAudioRuntimeEvent("nav:album_abort", {
            track: "album_open",
            album: getAlbumNameFromUrlLike(url.href),
            reason: "stale_cached_render",
            to_url: url.href,
            navigation_token: navToken
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
          to_url: url.href,
          navigation_token: navToken
        });
        logAudioRuntimeAlbumSwitch(audioSwitchContext, true);

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
      spaState.controller = null;
    }

    let loadedPage = null;
    try {
      loadedPage = await loadSpaPageDocument(url.href, { cacheMode: "default" });
    } catch (error) {
      if (spaState.navToken !== navToken) {
        finishSpaNavigation();
        releasePwaCoverHold("stale_load_error");
        finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_load_error" });
        trackAudioRuntimeEvent("nav:album_abort", {
          track: "album_open",
          album: getAlbumNameFromUrlLike(url.href),
          reason: "stale_load_error",
          to_url: url.href,
          navigation_token: navToken
        });
        return;
      }
      fallbackToDocumentNavigation(
        error && error.code === "SPA_PAGE_FETCH_TIMEOUT" ? "fetch_timeout" : "fetch_error"
      );
      return;
    }

    if (spaState.navToken !== navToken) {
      finishSpaNavigation();
      releasePwaCoverHold("stale_load");
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_load" });
      trackAudioRuntimeEvent("nav:album_abort", {
        track: "album_open",
        album: getAlbumNameFromUrlLike(url.href),
        reason: "stale_load",
        to_url: url.href,
        navigation_token: navToken
      });
      return;
    }

    const htmlStrategy = String(loadedPage && loadedPage.strategy || "missing");
    const htmlCacheHint = String(loadedPage && loadedPage.cacheHint || "miss");
    const reportedWorkerVersion = String(loadedPage && loadedPage.workerVersion || "");
    recordCacheObservation("html", loadedPage && loadedPage.cached ? "hit" : "miss");
    trackAudioRuntimeEvent("spa_html_response", {
      track: "album_open",
      album: getAlbumNameFromUrlLike(url.href),
      to_url: url.href,
      navigation_token: navToken,
      strategy: `${reportedWorkerVersion || getServiceWorkerReportedVersion() || "client"}:${htmlStrategy}`,
      cache_hint: htmlCacheHint,
      cached: Boolean(loadedPage && loadedPage.cached),
      response_ms: Math.max(0, Math.round(Number(loadedPage && loadedPage.responseMs) || 0))
    });

    if (!loadedPage || !loadedPage.html) {
      fallbackToDocumentNavigation("bad_response", {
        status: loadedPage ? Number(loadedPage.status) || 0 : 0
      });
      return;
    }

    const html = loadedPage.html;
    const loadedFromCache = Boolean(loadedPage.cached);
    setSpaCachedHtml(url, html);
    const doc = parseSpaDocument(html);
    if (!doc || !doc.body) {
      fallbackToDocumentNavigation("parse_error");
      return;
    }

    // Update history before rendering so relative URLs resolve correctly.
    if (!commitNavigationHistory("loaded_document")) return;

    spaState.currentUrl = url.href;
    const renderStartedAt = getAudioTelemetryNow();
    const spaTelemetry = {
      album: getAlbumNameFromUrlLike(url.href),
      from_album: audioSwitchContext.fromAlbum || "",
      to_album: getAlbumNameFromUrlLike(url.href),
      from_url: rendered.href,
      to_url: url.href,
      cached: loadedFromCache,
      navigation_token: navToken
    };
    trackAudioRuntimeEvent("spa_render_start", spaTelemetry);
    try {
      await renderSpaDocument(doc, url.href, spaTelemetry, {
        liveHomeCapture,
        restoreScroll: opts.restoreScroll,
        resetScroll: opts.scroll !== false
      });
    } catch (_err) {
      fallbackToDocumentNavigation("render_error");
      return;
    }
    if (spaState.navToken !== navToken) {
      finishSpaNavigation();
      releasePwaCoverHold("stale_render");
      finishAlbumOpenTelemetry(albumOpenContext, "album_open_fail", { reason: "stale_render" });
      trackAudioRuntimeEvent("nav:album_abort", {
        track: "album_open",
        album: getAlbumNameFromUrlLike(url.href),
        reason: "stale_render",
        to_url: url.href,
        navigation_token: navToken
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
      cached: loadedFromCache,
      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - renderStartedAt))
    });
    finishAlbumOpenTelemetry(albumOpenContext, "album_open_done", {
      cached: loadedFromCache
    });
    trackAudioRuntimeEvent("nav:album_done", {
      track: "album_open",
      album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(url.href),
      cached: loadedFromCache,
      to_url: url.href,
      navigation_token: navToken
    });
    logAudioRuntimeAlbumSwitch(audioSwitchContext, loadedFromCache);

    finishSpaNavigation();
  }

    return {
      buildSpaSnapshotHtml: buildSpaSnapshotHtml,
      snapshotCurrentSpaPage: snapshotCurrentSpaPage,
      sanitizeSpaBodyClassName: sanitizeSpaBodyClassName,
      getPwaSwapPolicy: getPwaSwapPolicy,
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
