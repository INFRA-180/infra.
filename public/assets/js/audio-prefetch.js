(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    ENABLED: true,
    CACHE_NAME: "infra-next-track-segments-v7",
    MAX_BYTES: 4 * 1024 * 1024,
    THRESHOLD_SECONDS: 30,
    PREFETCH_SEGMENT_SIZE: 4 * 1024 * 1024,
    QUEUE_DEPTH: 5,
    CONCURRENCY: 2,
    MAX_ENTRIES: 6
  });

  let mutationQueue = Promise.resolve();

  function isSupported() {
    return Boolean(
      constants.ENABLED &&
      globalObject.caches &&
      typeof globalObject.caches.open === "function" &&
      typeof globalObject.fetch === "function" &&
      typeof globalObject.Request === "function" &&
      typeof globalObject.Response === "function" &&
      typeof globalObject.Headers === "function"
    );
  }

  function createRequest(src) {
    const headers = new Headers();
    headers.set("Range", `bytes=0-${constants.PREFETCH_SEGMENT_SIZE - 1}`);
    return new Request(src, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "default",
      headers
    });
  }

  function createStorageRequest(src) {
    return new Request(src, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "default"
    });
  }

  function parseContentRange(response) {
    if (!response || !response.headers) return null;
    const value = response.headers.get("Content-Range") || response.headers.get("content-range") || "";
    const match = value.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      !Number.isSafeInteger(total) ||
      start < 0 ||
      end < start ||
      total <= end
    ) {
      return null;
    }
    return { start, end, total, length: end - start + 1 };
  }

  function getContentLength(response) {
    const range = parseContentRange(response);
    if (range) return range.length;
    if (!response || !response.headers) return 0;
    return Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
  }

  function normalizeAudioResponseForCache(response) {
    const range = parseContentRange(response);
    if (!response || response.status !== 206 || !range || range.start !== 0) {
      return Promise.reject(new Error("prefetch_requires_valid_206"));
    }
    if (range.length > constants.PREFETCH_SEGMENT_SIZE) {
      return Promise.reject(new Error("prefetch_segment_too_large"));
    }

    const declaredLength = Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
    if (declaredLength && declaredLength !== range.length) {
      return Promise.reject(new Error("prefetch_content_length_mismatch"));
    }

    return response.clone().arrayBuffer().then(function (buffer) {
      if (!buffer || buffer.byteLength !== range.length) {
        throw new Error("prefetch_body_length_mismatch");
      }
      const headers = new Headers(response.headers || {});
      headers.delete("Content-Range");
      headers.set("Content-Length", String(buffer.byteLength));
      headers.set("Accept-Ranges", "bytes");
      headers.set("X-Infra-Audio-Partial", "1");
      headers.set("X-Infra-Audio-Cache-Version", "7");
      headers.set("X-Infra-Range-Start", String(range.start));
      headers.set("X-Infra-Range-End", String(range.end));
      headers.set("X-Infra-Total-Length", String(range.total));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(buffer, {
        status: 200,
        statusText: "OK",
        headers
      });
    });
  }

  function openCache() {
    if (!globalObject.caches || typeof globalObject.caches.open !== "function") {
      return Promise.resolve(null);
    }
    return globalObject.caches.open(constants.CACHE_NAME);
  }

  function enqueueMutation(operation) {
    const result = mutationQueue.then(operation);
    mutationQueue = result.catch(function () {});
    return result;
  }

  function sourceUrl(value) {
    try {
      return new URL(String(value || ""), globalObject.location && globalObject.location.href).href;
    } catch (_err) {
      return String(value || "");
    }
  }

  function pruneCacheEntries(cache, options) {
    const opts = options || {};
    const requestedLimit = Math.max(1, Number(opts.maxEntries) || constants.MAX_ENTRIES);
    const limit = Math.min(constants.MAX_ENTRIES, requestedLimit);
    const keepSources = Array.isArray(opts.keepSources) ? opts.keepSources.slice(0, limit) : [];
    const protectedUrls = new Set(keepSources.map(sourceUrl).filter(Boolean));
    return cache.keys().then(function (keys) {
      let remaining = keys.length;
      const deletions = [];
      for (let index = 0; index < keys.length && remaining > limit; index += 1) {
        const key = keys[index];
        if (protectedUrls.has(sourceUrl(key && key.url ? key.url : key))) continue;
        remaining -= 1;
        deletions.push(cache.delete(key));
      }
      return Promise.all(deletions).then(function () { return true; });
    });
  }

  function pruneCache(options) {
    return enqueueMutation(function () {
      return openCache().then(function (cache) {
        if (!cache) return false;
        return pruneCacheEntries(cache, options);
      });
    });
  }

  function putSingle(src, response, options) {
    const opts = options || {};
    const request = createStorageRequest(src);
    return enqueueMutation(function () {
      return openCache().then(function (cache) {
        if (!cache) return false;
        return normalizeAudioResponseForCache(response).then(function (cacheResponse) {
          // Refresh only this entry. Other useful startup segments remain available.
          return cache.delete(request, { ignoreVary: true })
            .catch(function () { return false; })
            .then(function () { return cache.put(request, cacheResponse); });
        }).then(function () {
          return pruneCacheEntries(cache, {
            maxEntries: opts.maxEntries || constants.MAX_ENTRIES,
            keepSources: opts.keepSources || []
          });
        }).then(function () {
          return true;
        });
      });
    });
  }

  globalObject.InfraAudioPrefetch = Object.freeze({
    constants,
    isSupported,
    createRequest,
    getContentLength,
    normalizeAudioResponseForCache,
    pruneCache,
    putSingle
  });
})();
