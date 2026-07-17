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
    PAGE_CACHE_LIMIT: 40,
    PAGE_CACHE_LOOKUP_TIMEOUT_MS: 450,
    PAGE_FETCH_TIMEOUT_MS: 2500,
    PAGE_CACHE_WARM_CONCURRENCY: 4
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
    const inflightPages = opts.inflightPages instanceof Map ? opts.inflightPages : new Map();
    const cacheOnlyInflightPages = new Set();
    const pageCacheLimit = Number.isFinite(Number(opts.pageCacheLimit))
      ? Math.max(1, Number(opts.pageCacheLimit))
      : constants.PAGE_CACHE_LIMIT;
    const currentHref = opts.currentHref || (globalObject.location && globalObject.location.href) || "";
    const currentOrigin = opts.currentOrigin || (globalObject.location && globalObject.location.origin) || "";
    const cacheStorage = opts.cacheStorage || globalObject.caches || null;
    const fetchPage = typeof opts.fetch === "function"
      ? opts.fetch
      : (typeof globalObject.fetch === "function" ? globalObject.fetch.bind(globalObject) : null);

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

    function getResponseHeader(response, name) {
      if (!response || !response.headers || typeof response.headers.get !== "function") return "";
      return String(response.headers.get(name) || "");
    }

    async function readResponse(response, details) {
      if (!response) return null;
      const info = details || {};
      const status = Number(response.status) || 0;
      if (!response.ok) {
        return {
          html: "",
          status,
          cached: Boolean(info.cached),
          strategy: info.strategy || "bad_response",
          cacheHint: info.cacheHint || "miss",
          workerVersion: info.workerVersion || "",
          responseMs: Math.max(0, Math.round(Number(info.responseMs) || 0))
        };
      }
      const html = await response.text();
      if (html) set(info.url, html);
      return {
        html,
        status,
        cached: Boolean(info.cached),
        strategy: info.strategy || "unknown",
        cacheHint: info.cacheHint || (info.cached ? "hit" : "miss"),
        workerVersion: info.workerVersion || "",
        responseMs: Math.max(0, Math.round(Number(info.responseMs) || 0))
      };
    }

    async function matchInstalledPage(url, options) {
      const loadOptions = options || {};
      const cacheName = String(loadOptions.cacheName || "");
      if (!cacheName || !cacheStorage || typeof cacheStorage.match !== "function") return null;
      const startedAt = Date.now();
      let response = null;
      let lookupTimeoutId = 0;
      try {
        const matchPromise = cacheStorage.match(url.href, { cacheName });
        if (typeof globalObject.setTimeout === "function") {
          const lookupTimeoutMs = Number.isFinite(Number(loadOptions.cacheLookupTimeoutMs))
            ? Math.max(50, Number(loadOptions.cacheLookupTimeoutMs))
            : constants.PAGE_CACHE_LOOKUP_TIMEOUT_MS;
          response = await Promise.race([
            matchPromise,
            new Promise(function (resolve) {
              lookupTimeoutId = globalObject.setTimeout(function () { resolve(null); }, lookupTimeoutMs);
            })
          ]);
        } else {
          response = await matchPromise;
        }
      } catch (_err) {
        return null;
      } finally {
        if (lookupTimeoutId && typeof globalObject.clearTimeout === "function") {
          globalObject.clearTimeout(lookupTimeoutId);
        }
      }
      if (!response) return null;
      try {
        return await readResponse(response, {
          url,
          cached: true,
          strategy: "window_shell_cache",
          cacheHint: "hit",
          workerVersion: cacheName.replace(/-shell$/, ""),
          responseMs: Date.now() - startedAt
        });
      } catch (_err) {
        return null;
      }
    }

    function load(href, options) {
      const loadOptions = options || {};
      let url = null;
      try {
        url = new URL(String(href || ""), currentHref);
      } catch (_err) {
        return Promise.resolve(null);
      }
      if (!isNavigableUrl(url, { currentHref, currentOrigin })) return Promise.resolve(null);

      const key = getKey(url);
      if (!key) return Promise.resolve(null);

      const memoryHtml = get(url);
      if (memoryHtml) {
        return Promise.resolve({
          html: memoryHtml,
          status: 200,
          cached: true,
          strategy: "client_memory",
          cacheHint: "hit",
          workerVersion: "",
          responseMs: 0
        });
      }
      if (inflightPages.has(key)) {
        const pending = inflightPages.get(key);
        if (!loadOptions.cacheOnly && cacheOnlyInflightPages.has(key)) {
          return pending.then(function (result) {
            return result && result.html ? result : load(url.href, loadOptions);
          });
        }
        return pending;
      }

      prefetchingPages.add(key);
      if (loadOptions.cacheOnly) cacheOnlyInflightPages.add(key);
      const promise = (async function () {
        const installed = await matchInstalledPage(url, loadOptions);
        if (installed && installed.html) return installed;
        if (loadOptions.cacheOnly || !fetchPage) return null;

        const timeoutMs = Number.isFinite(Number(loadOptions.timeoutMs))
          ? Math.max(250, Number(loadOptions.timeoutMs))
          : constants.PAGE_FETCH_TIMEOUT_MS;
        const Controller = globalObject.AbortController;
        const controller = typeof Controller === "function" ? new Controller() : null;
        let timedOut = false;
        let timeoutId = 0;
        if (controller && typeof globalObject.setTimeout === "function") {
          timeoutId = globalObject.setTimeout(function () {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
        }

        const startedAt = Date.now();
        let response = null;
        try {
          response = await fetchPage(url.href, {
            signal: controller ? controller.signal : undefined,
            cache: loadOptions.cacheMode || "default",
            headers: {
              "Accept": "text/html",
              "X-Infra-Spa": "1"
            }
          });
        } catch (error) {
          if (timedOut) {
            const timeoutError = new Error("spa_page_fetch_timeout");
            timeoutError.code = "SPA_PAGE_FETCH_TIMEOUT";
            throw timeoutError;
          }
          throw error;
        } finally {
          if (timeoutId && typeof globalObject.clearTimeout === "function") {
            globalObject.clearTimeout(timeoutId);
          }
        }

        const reportedWorkerVersion = getResponseHeader(response, "X-Infra-SW-Version");
        const reportedStrategy = getResponseHeader(response, "X-Infra-HTML-Strategy");
        const reportedCacheHint = getResponseHeader(response, "X-Infra-HTML-Cache");
        const reportedResponseMsHeader = getResponseHeader(response, "X-Infra-HTML-MS");
        const reportedResponseMs = reportedResponseMsHeader ? Number(reportedResponseMsHeader) : NaN;
        return readResponse(response, {
          url,
          cached: reportedCacheHint === "hit",
          strategy: reportedStrategy || "network",
          cacheHint: reportedCacheHint || "miss",
          workerVersion: reportedWorkerVersion,
          responseMs: Number.isFinite(reportedResponseMs)
            ? reportedResponseMs
            : Date.now() - startedAt
        });
      })().finally(function () {
        if (inflightPages.get(key) === promise) inflightPages.delete(key);
        cacheOnlyInflightPages.delete(key);
        prefetchingPages.delete(key);
      });

      inflightPages.set(key, promise);
      return promise;
    }

    function prefetch(href, options) {
      return load(href, options).then(function (result) {
        return Boolean(result && result.html);
      }).catch(function () {
        return false;
      });
    }

    async function warm(urls, options) {
      const entries = Array.from(new Set(Array.isArray(urls) ? urls : [])).filter(Boolean);
      const warmOptions = Object.assign({}, options || {}, { cacheOnly: true });
      const concurrency = Number.isFinite(Number(warmOptions.concurrency))
        ? Math.max(1, Math.floor(Number(warmOptions.concurrency)))
        : constants.PAGE_CACHE_WARM_CONCURRENCY;
      let cursor = 0;
      let warmed = 0;
      async function warmNext() {
        while (cursor < entries.length) {
          const href = entries[cursor];
          cursor += 1;
          const result = await load(href, warmOptions).catch(function () { return null; });
          if (result && result.html) warmed += 1;
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, entries.length || 1) }, warmNext));
      return { requested: entries.length, warmed };
    }

    return Object.freeze({
      get,
      set,
      has,
      load,
      prefetch,
      warm
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
