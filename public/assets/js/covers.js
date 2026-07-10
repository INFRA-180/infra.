(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    CACHE_NAME: "infra-covers",
    SESSION_PREPARE_ENABLED: true,
    SESSION_PREPARE_CONCURRENCY: 3,
    SESSION_NAVIGATION_GATE_ENABLED: true
  });

  function getLocationHref(options) {
    const opts = options || {};
    return String(
      opts.currentHref ||
      (globalObject.location && globalObject.location.href) ||
      ""
    );
  }

  function getLocationOrigin(options) {
    const opts = options || {};
    return String(
      opts.currentOrigin ||
      (globalObject.location && globalObject.location.origin) ||
      ""
    );
  }

  function getBaseUrl(options) {
    const opts = options || {};
    return opts.baseUrl || getLocationHref(opts);
  }

  function toAbsoluteUrlOrEmpty(urlLike, options) {
    const raw = String(urlLike || "").trim();
    if (!raw) return "";

    const opts = options || {};
    if (typeof opts.toAbsoluteUrlOrEmpty === "function") {
      const resolved = opts.toAbsoluteUrlOrEmpty(raw);
      if (resolved) return resolved;
    }

    try {
      return new URL(raw, getLocationHref(opts)).href;
    } catch (_err) {
      return "";
    }
  }

  function rewriteLegacyMusicAssetsPath(parsedUrl, options) {
    const currentOrigin = getLocationOrigin(options);
    if (
      parsedUrl &&
      parsedUrl.origin === currentOrigin &&
      /^\/music\/assets\//i.test(parsedUrl.pathname)
    ) {
      parsedUrl.pathname = parsedUrl.pathname.replace(/^\/music\/assets\//i, "/assets/");
      parsedUrl.search = "";
      parsedUrl.hash = "";
    }
  }

  function getFallbackArtwork(options) {
    return String((options && options.fallbackArtwork) || "").trim();
  }

  function getArtworkType(urlValue) {
    const normalized = String(urlValue || "")
      .split("#")[0]
      .split("?")[0]
      .toLowerCase();
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
    if (normalized.endsWith(".png")) return "image/png";
    if (normalized.endsWith(".webp")) return "image/webp";
    return "image/png";
  }

  function inferArtworkSizeHint(urlValue) {
    const normalized = String(urlValue || "").toLowerCase();
    if (normalized.includes("-480.webp")) return "480x480";
    if (normalized.includes("-900.webp")) return "900x900";
    if (normalized.includes("icon-192")) return "192x192";
    return "512x512";
  }

  function normalizeArtworkUrl(coverPath, options) {
    const opts = options || {};
    const fallback = getFallbackArtwork(opts);
    const raw = String(coverPath || "").trim();
    if (!raw) return fallback;

    try {
      const url = new URL(raw, getBaseUrl(opts));
      if (url.protocol === "https:" || url.protocol === "http:") {
        rewriteLegacyMusicAssetsPath(url, opts);
        return url.href;
      }
    } catch (_err) {
      // Fall through to the injected URL normalizer.
    }

    const absolute = toAbsoluteUrlOrEmpty(raw, opts);
    if (!absolute) return fallback;

    try {
      const url = new URL(absolute, getLocationHref(opts));
      if (url.protocol === "https:" || url.protocol === "http:") {
        rewriteLegacyMusicAssetsPath(url, opts);
        return url.href;
      }
    } catch (_err) {
      // Ignore invalid artwork URLs.
    }

    return fallback;
  }

  function buildResponsiveCoverCandidate(urlValue, targetWidth, options) {
    const opts = options || {};
    const absolute = toAbsoluteUrlOrEmpty(urlValue || "", opts);
    if (!absolute) return "";
    let parsed = null;
    try {
      parsed = new URL(absolute, getLocationHref(opts));
    } catch (_err) {
      return "";
    }
    rewriteLegacyMusicAssetsPath(parsed, opts);

    const path = String(parsed.pathname || "");
    if (!/\/assets\/music\//i.test(path)) return "";
    const width = Math.max(320, Number(targetWidth) || 900);

    if (/\/assets\/music\/responsive\//i.test(path)) {
      const replaced = path
        .replace(/-\d+\.webp$/i, `-${width}.webp`)
        .replace(/\.jpe?g$/i, `-${width}.webp`)
        .replace(/\.png$/i, `-${width}.webp`);
      if (replaced !== path) {
        parsed.pathname = replaced;
        parsed.search = "";
        parsed.hash = "";
        return parsed.href;
      }
      return parsed.href;
    }

    const fileName = path.split("/").pop() || "";
    const dotAt = fileName.lastIndexOf(".");
    if (dotAt <= 0) return "";
    const stem = fileName.slice(0, dotAt);
    const marker = "/assets/music/";
    const markerAt = path.toLowerCase().indexOf(marker);
    const prefix = markerAt >= 0 ? path.slice(0, markerAt) : "";
    parsed.pathname = `${prefix}/assets/music/responsive/${stem}-${width}.webp`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  }

  function normalizeCoverUrl(coverPath, options) {
    const opts = options || {};
    const normalized = normalizeArtworkUrl(coverPath || "", opts);
    if (!normalized) return "";

    const fallback = getFallbackArtwork(opts);
    if (
      fallback &&
      typeof opts.srcMatches === "function" &&
      opts.srcMatches(normalized, fallback)
    ) {
      return normalized;
    }
    if (opts.responsive === false) return normalized;

    const width = Math.max(320, Number(opts.width) || 900);
    const responsive = buildResponsiveCoverCandidate(normalized, width, opts);
    return responsive || normalized;
  }

  function method(ctx, name, fallback) {
    const safeFallback = typeof fallback === "function" ? fallback : function () {};
    return function () {
      const fn = ctx && typeof ctx[name] === "function" ? ctx[name] : null;
      if (fn) return fn.apply(ctx, arguments);
      return safeFallback.apply(null, arguments);
    };
  }

  function createRuntime(context) {
    const ctx = context || {};
    const performancePolicy = globalObject.InfraPerformancePolicy && typeof globalObject.InfraPerformancePolicy.getPolicy === "function"
      ? globalObject.InfraPerformancePolicy.getPolicy()
      : null;
    const audioState = ctx.audioState || {};
    const spaState = ctx.spaState || {};
    const COVERS_CACHE_NAME = String(ctx.COVERS_CACHE_NAME || constants.CACHE_NAME);
    const COVER_SESSION_PREPARE_ENABLED = ctx.COVER_SESSION_PREPARE_ENABLED !== false;
    const COVER_SESSION_PREPARE_CONCURRENCY = Math.max(1, Number(ctx.COVER_SESSION_PREPARE_CONCURRENCY) || 3);
    const PWA_COVER_PREPARE_LIMIT = Math.max(1, Number(ctx.PWA_COVER_PREPARE_LIMIT) || 8);
    const ALBUM_COVER_IMAGE_CACHE_LIMIT = Math.max(1, Number(ctx.ALBUM_COVER_IMAGE_CACHE_LIMIT) || 24);
    const toAbsoluteUrlOrEmpty = method(ctx, "toAbsoluteUrlOrEmpty", function (value) { return String(value || ""); });
    const toRuntimeAbsoluteUrl = method(ctx, "toRuntimeAbsoluteUrl", function (value) { return String(value || ""); });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) { return String(value || ""); });
    const getImagePreferredSrc = method(ctx, "getImagePreferredSrc", function () { return ""; });
    const isMobilePwaCoverNavigation = method(ctx, "isMobilePwaCoverNavigation", function () { return false; });
    const isAlbumOpenUrl = method(ctx, "isAlbumOpenUrl", function () { return false; });
    const choosePreferredSrcsetSource = method(ctx, "choosePreferredSrcsetSource", function () { return ""; });
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () { return document.body; });
    const normalizeUrlAgainstBase = method(ctx, "normalizeUrlAgainstBase", function (value) { return String(value || ""); });
    const preloadImage = method(ctx, "preloadImage", function () { return Promise.resolve({ ok: false }); });
    const loadTracksData = method(ctx, "loadTracksData", function () { return Promise.resolve({}); });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const getAlbumNameFromUrlLike = method(ctx, "getAlbumNameFromUrlLike", function () { return ""; });
    const getAudioTelemetryNow = method(ctx, "getAudioTelemetryNow", function () { return Date.now(); });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");

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
          if (performancePolicy && typeof performancePolicy.emit === "function") {
            performancePolicy.emit("perf_cover_render", {
              source: "session_prepare",
              cache_hint: result && result.cacheHint ? result.cacheHint : "unknown",
              decoded: Boolean(decoded),
              duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt))
            });
          }
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

      const audio = audioState.audio;
      const explicit = reason === "album_gate";
      const decision = performancePolicy && typeof performancePolicy.decide === "function"
        ? performancePolicy.decide("covers", {
          explicit,
          pageKind: document.body.classList.contains("home-screen") ? "home" : "album",
          playbackFragile: Boolean(audio && !audio.paused && audio.readyState < 3)
        })
        : { allowed: true, budget: COVER_SESSION_PREPARE_CONCURRENCY };
      if (!decision.allowed) return Promise.resolve();

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
          const workerCount = Math.min(
            Math.max(1, Number(decision.budget) || COVER_SESSION_PREPARE_CONCURRENCY),
            covers.length
          );
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
      const audio = audioState.audio;
      const decision = performancePolicy && typeof performancePolicy.decide === "function"
        ? performancePolicy.decide("covers", {
          pageKind: document.body.classList.contains("home-screen") ? "home" : "album",
          playbackFragile: Boolean(audio && !audio.paused && audio.readyState < 3)
        })
        : { allowed: true };
      if (!decision.allowed) return;
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

    return {
      getResourceTimingHint,
      logCoverRuntimeEvent,
      primeLinkedAlbumCoverForPwa,
      releasePwaCoverHold,
      showPwaCoverHold,
      showPwaHomeReturnHold,
      rememberAlbumCoverImage,
      prepareAlbumCoversForSession,
      scheduleAlbumCoverCacheWarmup,
      optimizeAlbumCoverImage
    };
  }


  globalObject.InfraCovers = Object.freeze({
    constants,
    getArtworkType,
    inferArtworkSizeHint,
    normalizeArtworkUrl,
    normalizeCoverUrl,
    buildResponsiveCoverCandidate,
    createRuntime
  });
})();
