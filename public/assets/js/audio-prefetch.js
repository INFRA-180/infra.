(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    ENABLED: true,
    CACHE_NAME: "infra-next-track-full-v3",
    MAX_BYTES: 15 * 1024 * 1024,
    THRESHOLD_SECONDS: 30
  });

  function isSupported() {
    return Boolean(
      constants.ENABLED &&
      globalObject.caches &&
      typeof globalObject.caches.open === "function" &&
      typeof globalObject.fetch === "function"
    );
  }

  function createRequest(src) {
    try {
      return new Request(src, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default"
      });
    } catch (_err) {
      return src;
    }
  }

  function getContentLength(response) {
    if (!response || !response.headers) return 0;
    return Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
  }

  function openCache() {
    if (!globalObject.caches || typeof globalObject.caches.open !== "function") {
      return Promise.resolve(null);
    }
    return globalObject.caches.open(constants.CACHE_NAME);
  }

  function clearCache() {
    return openCache().then(function (cache) {
      if (!cache) return false;
      return cache.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return cache.delete(key); })).then(function () {
          return true;
        });
      });
    });
  }

  function putSingle(src, response) {
    const request = createRequest(src);
    return clearCache().then(function () {
      return openCache();
    }).then(function (cache) {
      if (!cache) return false;
      return cache.put(request, response.clone()).then(function () {
        return true;
      });
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
