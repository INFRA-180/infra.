(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    HISTORY_MARKER: "__infraSpa",
    HISTORY_URL: "__infraUrl",
    HISTORY_SCROLL_X: "__infraScrollX",
    HISTORY_SCROLL_Y: "__infraScrollY",
    PAGE_CACHE_LIMIT: 30
  });

  const staticAssetPattern = /\.(?:mp3|m4a|aac|wav|flac|ogg|png|jpe?g|webp|gif|svg|ico|pdf|zip|json|js|css|woff2?)$/i;

  function isEnabled(locationLike) {
    const locationRef = locationLike || globalObject.location || {};
    return locationRef.protocol === "http:" || locationRef.protocol === "https:";
  }

  function buildHistoryState(options) {
    const opts = options || {};
    const base = opts.baseState && typeof opts.baseState === "object"
      ? Object.assign({}, opts.baseState)
      : {};
    base[constants.HISTORY_MARKER] = 1;
    base[constants.HISTORY_URL] = String(opts.url || "");
    base[constants.HISTORY_SCROLL_X] = Math.max(0, Math.round(Number(opts.scrollX) || 0));
    base[constants.HISTORY_SCROLL_Y] = Math.max(0, Math.round(Number(opts.scrollY) || 0));
    return base;
  }

  function getScrollFromHistoryState(stateLike) {
    const raw = stateLike && typeof stateLike === "object" ? stateLike : {};
    const x = Number(raw[constants.HISTORY_SCROLL_X]);
    const y = Number(raw[constants.HISTORY_SCROLL_Y]);
    return {
      x: Number.isFinite(x) ? Math.max(0, x) : 0,
      y: Number.isFinite(y) ? Math.max(0, y) : 0
    };
  }

  function isNavigableUrl(urlLike, options) {
    const opts = options || {};
    let url = null;
    try {
      url = urlLike instanceof URL
        ? urlLike
        : new URL(String(urlLike || ""), opts.currentHref || (globalObject.location && globalObject.location.href) || "");
    } catch (_err) {
      return false;
    }

    const currentOrigin = String(
      opts.currentOrigin ||
      (globalObject.location && globalObject.location.origin) ||
      ""
    );
    if (currentOrigin && currentOrigin !== "null" && url.origin !== currentOrigin) return false;

    const path = String(url.pathname || "");
    if (!path) return true;
    if (/\.(?:html?)$/i.test(path) || path.endsWith("/")) return true;
    return !staticAssetPattern.test(path);
  }

  function getPageCacheKey(urlLike, options) {
    const opts = options || {};
    let url = null;
    try {
      url = urlLike instanceof URL
        ? urlLike
        : new URL(String(urlLike || ""), opts.currentHref || (globalObject.location && globalObject.location.href) || "");
    } catch (_err) {
      return "";
    }
    return `${url.pathname}${url.search}`;
  }

  function parseDocument(html) {
    const raw = String(html || "");
    if (!raw || typeof DOMParser === "undefined") return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    return doc && doc.body ? doc : null;
  }

  function createPageCache(options) {
    const opts = options || {};
    const pageCache = opts.pageCache instanceof Map ? opts.pageCache : new Map();
    const pageCacheOrder = Array.isArray(opts.pageCacheOrder) ? opts.pageCacheOrder : [];
    const prefetchingPages = opts.prefetchingPages instanceof Set ? opts.prefetchingPages : new Set();
    const pageCacheLimit = Number.isFinite(Number(opts.pageCacheLimit))
      ? Math.max(1, Number(opts.pageCacheLimit))
      : constants.PAGE_CACHE_LIMIT;
    const currentHref = opts.currentHref || (globalObject.location && globalObject.location.href) || "";
    const currentOrigin = opts.currentOrigin || (globalObject.location && globalObject.location.origin) || "";

    function getKey(urlLike) {
      return getPageCacheKey(urlLike, { currentHref });
    }

    function get(urlLike) {
      const key = getKey(urlLike);
      if (!key) return "";
      const value = pageCache.get(key);
      return typeof value === "string" ? value : "";
    }

    function has(urlLike) {
      const key = getKey(urlLike);
      return Boolean(key && pageCache.has(key));
    }

    function set(urlLike, html) {
      const key = getKey(urlLike);
      const value = String(html || "");
      if (!key || !value) return false;

      pageCache.set(key, value);
      const existingIndex = pageCacheOrder.indexOf(key);
      if (existingIndex >= 0) {
        pageCacheOrder.splice(existingIndex, 1);
      }
      pageCacheOrder.push(key);

      while (pageCacheOrder.length > pageCacheLimit) {
        const oldest = pageCacheOrder.shift();
        if (!oldest) break;
        pageCache.delete(oldest);
      }
      return true;
    }

    function prefetch(href, options) {
      const prefetchOptions = options || {};
      let url = null;
      try {
        url = new URL(String(href || ""), currentHref);
      } catch (_err) {
        return Promise.resolve(false);
      }
      if (!isNavigableUrl(url, { currentHref, currentOrigin })) return Promise.resolve(false);

      const key = getKey(url);
      if (!key) return Promise.resolve(false);
      if (prefetchingPages.has(key)) return Promise.resolve(false);
      if (!prefetchOptions.force && pageCache.has(key)) return Promise.resolve(false);

      prefetchingPages.add(key);

      return fetch(url.href, {
        cache: prefetchOptions.cacheMode || "force-cache",
        headers: {
          "Accept": "text/html",
          "X-Infra-Spa": "1"
        }
      })
        .then(function (response) {
          if (!response || !response.ok) return "";
          return response.text();
        })
        .then(function (html) {
          return html ? set(url, html) : false;
        })
        .catch(function () {
          return false;
        })
        .finally(function () {
          prefetchingPages.delete(key);
        });
    }

    return Object.freeze({
      get,
      set,
      has,
      prefetch
    });
  }

  globalObject.InfraSpaRouter = Object.freeze({
    constants,
    isEnabled,
    buildHistoryState,
    getScrollFromHistoryState,
    isNavigableUrl,
    getPageCacheKey,
    parseDocument,
    createPageCache
  });
})();
