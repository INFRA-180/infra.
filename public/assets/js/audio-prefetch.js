(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    ENABLED: true,
    CACHE_NAME: "infra-next-track-segments-v5",
    MAX_BYTES: 15 * 1024 * 1024,
    THRESHOLD_SECONDS: 30,
    STARTUP_BYTES: 1024 * 1024,
    MAX_ENTRIES: 4
  });

  function isSupported() {
    return Boolean(
      constants.ENABLED &&
      globalObject.caches &&
      typeof globalObject.caches.open === "function" &&
      typeof globalObject.fetch === "function"
    );
  }

  function createRequest(src, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    const bytes = Number.isFinite(Number(opts.bytes)) && Number(opts.bytes) > 0
      ? Math.floor(Number(opts.bytes))
      : constants.STARTUP_BYTES;
    if (opts.range !== false && bytes > 0 && !headers.has("Range")) {
      headers.set("Range", `bytes=0-${bytes - 1}`);
    }
    try {
      return new Request(src, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default",
        headers
      });
    } catch (_err) {
      return src;
    }
  }

  function getContentLength(response) {
    if (!response || !response.headers) return 0;
    const contentRange = response.headers.get("Content-Range") || response.headers.get("content-range") || "";
    const rangeMatch = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return end - start + 1;
    }
    return Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
  }

  function normalizeAudioResponseForCache(response) {
    const headers = new Headers(response.headers || {});
    const contentRange = headers.get("Content-Range") || headers.get("content-range") || "";
    const rangeMatch = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
    if (response.status !== 206 || !rangeMatch) return Promise.resolve(response.clone());

    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const total = rangeMatch[3] === "*" ? 0 : Number(rangeMatch[3]);
    headers.set("X-Infra-Audio-Partial", "1");
    headers.set("X-Infra-Range-Start", String(start));
    headers.set("X-Infra-Range-End", String(end));
    if (Number.isFinite(total) && total > 0) headers.set("X-Infra-Total-Length", String(total));
    headers.set("Content-Length", String(Math.max(0, end - start + 1)));
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return response.clone().arrayBuffer().then(function (buffer) {
      return new Response(buffer, { status: 200, statusText: "OK", headers });
    });
  }

  function openCache() {
    if (!globalObject.caches || typeof globalObject.caches.open !== "function") return Promise.resolve(null);
    return globalObject.caches.open(constants.CACHE_NAME);
  }

  function clearCache() {
    return openCache().then(function (cache) {
      if (!cache) return false;
      return cache.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return cache.delete(key); })).then(function () { return true; });
      });
    });
  }

  function pruneCache(cache, maxEntries) {
    const limit = Math.max(1, Number(maxEntries) || constants.MAX_ENTRIES);
    return cache.keys().then(function (keys) {
      const excess = Math.max(0, keys.length - limit);
      if (!excess) return true;
      return Promise.all(keys.slice(0, excess).map(function (key) { return cache.delete(key); })).then(function () { return true; });
    });
  }

  function putSingle(src, response, options) {
    const opts = options || {};
    const request = createRequest(src, { range: false });
    return openCache().then(function (cache) {
      if (!cache) return false;
      return normalizeAudioResponseForCache(response)
        .then(function (cacheResponse) { return cache.put(request, cacheResponse); })
        .then(function () { return pruneCache(cache, opts.maxEntries || constants.MAX_ENTRIES); })
        .then(function () { return true; });
    });
  }

  globalObject.InfraAudioPrefetch = Object.freeze({
    constants,
    isSupported,
    createRequest,
    getContentLength,
    clearCache,
    putSingle
  });
})();
