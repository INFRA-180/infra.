(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    ENABLED: true,
    CACHE_NAME: "infra-next-track-segments-v9",
    MAX_BYTES: 2 * 1024 * 1024,
    THRESHOLD_SECONDS: 30,
    PREFETCH_SEGMENT_SIZE: 2 * 1024 * 1024,
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

  function cancelResponseBody(response) {
    if (!response || !response.body || typeof response.body.cancel !== "function") return;
    try {
      const cancellation = response.body.cancel();
      if (cancellation && typeof cancellation.catch === "function") {
        cancellation.catch(function () {});
      }
    } catch (_err) {
      // The response is already unusable; cancellation is best-effort only.
    }
  }

  function normalizeAudioResponseForCache(response) {
    const range = parseContentRange(response);
    if (!response || response.status !== 206 || !range || range.start !== 0) {
      cancelResponseBody(response);
      return Promise.reject(new Error("prefetch_requires_valid_206"));
    }
    if (range.length > constants.PREFETCH_SEGMENT_SIZE) {
      cancelResponseBody(response);
      return Promise.reject(new Error("prefetch_segment_too_large"));
    }

    const declaredLength = Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
    if (declaredLength && declaredLength !== range.length) {
      cancelResponseBody(response);
      return Promise.reject(new Error("prefetch_content_length_mismatch"));
    }

    return response.arrayBuffer().then(function (buffer) {
      if (!buffer || buffer.byteLength !== range.length) {
        throw new Error("prefetch_body_length_mismatch");
      }
      const bodyBytes = new Uint8Array(buffer);
      const headers = new Headers(response.headers || {});
      headers.delete("Content-Range");
      headers.set("Content-Length", String(buffer.byteLength));
      headers.set("Accept-Ranges", "bytes");
      headers.set("X-Infra-Audio-Partial", "1");
      headers.set("X-Infra-Audio-Cache-Version", "9");
      headers.set("X-Infra-Range-Start", String(range.start));
      headers.set("X-Infra-Range-End", String(range.end));
      headers.set("X-Infra-Total-Length", String(range.total));
      headers.set("X-Infra-Body-Validated", "1");
      if (bodyBytes.byteLength >= 2) {
        headers.set(
          "X-Infra-First-Two-Bytes",
          `${bodyBytes[0].toString(16).padStart(2, "0")}${bodyBytes[1].toString(16).padStart(2, "0")}`
        );
      }
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

  function readStoredInteger(headers, name) {
    if (!headers || typeof headers.get !== "function") return null;
    const rawValue = headers.get(name);
    if (rawValue === null || rawValue === "") return null;
    const value = Number(rawValue);
    return Number.isSafeInteger(value) ? value : null;
  }

  function getStoredSegmentMetadata(response) {
    if (!response || !response.headers || !response.ok || response.status !== 200) return null;
    const headers = response.headers;
    const storedLength = readStoredInteger(headers, "Content-Length");
    const rangeStart = readStoredInteger(headers, "X-Infra-Range-Start");
    const rangeEnd = readStoredInteger(headers, "X-Infra-Range-End");
    const totalLength = readStoredInteger(headers, "X-Infra-Total-Length");
    const firstTwoBytes = String(headers.get("X-Infra-First-Two-Bytes") || "").toLowerCase();
    if (
      headers.get("X-Infra-Audio-Partial") !== "1" ||
      headers.get("X-Infra-Audio-Cache-Version") !== "9" ||
      storedLength === null ||
      rangeStart !== 0 ||
      rangeEnd === null ||
      totalLength === null ||
      storedLength <= 0 ||
      storedLength > constants.PREFETCH_SEGMENT_SIZE ||
      rangeEnd < rangeStart ||
      totalLength <= rangeEnd ||
      storedLength !== rangeEnd - rangeStart + 1 ||
      (firstTwoBytes && !/^[0-9a-f]{4}$/.test(firstTwoBytes))
    ) {
      return null;
    }
    return {
      bytes: storedLength,
      rangeStart,
      rangeEnd,
      totalLength,
      bodyValidated: headers.get("X-Infra-Body-Validated") === "1",
      firstTwoBytes
    };
  }

  function inspectCachedSegment(src) {
    const normalizedSrc = sourceUrl(src);
    if (!normalizedSrc) {
      return Promise.resolve({
        src: "",
        found: false,
        valid: false,
        reason: "invalid_source"
      });
    }
    return openCache().then(function (cache) {
      if (!cache || typeof cache.match !== "function") {
        return {
          src: normalizedSrc,
          found: false,
          valid: false,
          reason: "cache_unavailable"
        };
      }
      const request = createStorageRequest(normalizedSrc);
      return cache.match(request, { ignoreVary: true }).then(function (response) {
        if (!response) {
          return {
            src: normalizedSrc,
            found: false,
            valid: false,
            reason: "cache_miss"
          };
        }
        const metadata = getStoredSegmentMetadata(response);
        if (!metadata) {
          return {
            src: normalizedSrc,
            found: true,
            valid: false,
            reason: "cache_corrupt"
          };
        }
        return {
          src: normalizedSrc,
          found: true,
          valid: true,
          reason: "cache_hit",
          bytes: metadata.bytes,
          rangeStart: metadata.rangeStart,
          rangeEnd: metadata.rangeEnd,
          totalLength: metadata.totalLength,
          bodyValidated: metadata.bodyValidated,
          probeReady: Boolean(metadata.firstTwoBytes)
        };
      });
    }).catch(function () {
      return {
        src: normalizedSrc,
        found: false,
        valid: false,
        reason: "cache_error"
      };
    });
  }

  function findFirstValidCachedSegment(sources) {
    const candidates = [];
    const seen = new Set();
    (Array.isArray(sources) ? sources : []).forEach(function (src) {
      const normalizedSrc = sourceUrl(src);
      if (!normalizedSrc || seen.has(normalizedSrc)) return;
      seen.add(normalizedSrc);
      candidates.push(normalizedSrc);
    });

    function inspectAt(index) {
      if (index >= candidates.length) return Promise.resolve(null);
      return inspectCachedSegment(candidates[index]).then(function (result) {
        return result && result.valid && result.probeReady !== false
          ? result
          : inspectAt(index + 1);
      });
    }

    return inspectAt(0);
  }

  function findValidCachedSegments(sources, maxResults) {
    const candidates = [];
    const seen = new Set();
    (Array.isArray(sources) ? sources : []).forEach(function (src) {
      const normalizedSrc = sourceUrl(src);
      if (!normalizedSrc || seen.has(normalizedSrc)) return;
      seen.add(normalizedSrc);
      candidates.push(normalizedSrc);
    });
    const limit = Math.floor(Math.max(
      1,
      Math.min(constants.MAX_ENTRIES, Number(maxResults) || constants.MAX_ENTRIES)
    ));
    if (!candidates.length) return Promise.resolve([]);

    function fallbackToFirst() {
      return findFirstValidCachedSegment(candidates).then(function (result) {
        return result ? [result] : [];
      });
    }

    return openCache().then(function (cache) {
      if (!cache || typeof cache.keys !== "function") return fallbackToFirst();
      return cache.keys().then(function (keys) {
        const storedUrls = new Set((keys || []).map(function (key) {
          return sourceUrl(key && key.url ? key.url : key);
        }).filter(Boolean));
        const storedCandidates = candidates.filter(function (src) {
          return storedUrls.has(src);
        });
        return Promise.all(storedCandidates.map(inspectCachedSegment)).then(function (results) {
          return results.filter(function (result) {
            return result && result.valid && result.probeReady !== false;
          }).slice(0, limit);
        });
      });
    }).catch(function () {
      // Cache.keys() is an optimization. Keep the previously validated
      // single-entry path as a safe fallback for older WebKit builds.
      return fallbackToFirst();
    });
  }

  function enqueueMutation(operation) {
    const result = mutationQueue.then(operation);
    mutationQueue = result.catch(function () {});
    return result;
  }

  function waitForMutationIdle() {
    // Snapshot the serialized queue. In particular, a caller timeout from
    // putSingle() must not cause a duplicate network fetch while its original
    // CacheStorage write is still the queue owner.
    return mutationQueue.then(function () { return true; });
  }

  function mutationAllowed(options) {
    const opts = options || {};
    if (typeof opts.shouldStore !== "function") return true;
    try {
      return opts.shouldStore() !== false;
    } catch (_err) {
      return false;
    }
  }

  function withMutationTimeout(promise, timeoutMs) {
    const delay = Math.max(0, Number(timeoutMs) || 0);
    if (!delay) return promise;
    let timeout = 0;
    const guard = new Promise(function (_resolve, reject) {
      timeout = globalObject.setTimeout(function () {
        reject(new Error("prefetch_cache_timeout"));
      }, delay);
    });
    return Promise.race([promise, guard]).finally(function () {
      if (timeout) globalObject.clearTimeout(timeout);
    });
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
    const bodyStartedAt = Date.now();
    return normalizeAudioResponseForCache(response).then(function (cacheResponse) {
      const bodyFinishedAt = Date.now();
      if (typeof opts.onBodyReady === "function") {
        try {
          opts.onBodyReady({
            body_ms: Math.max(0, bodyFinishedAt - bodyStartedAt)
          });
        } catch (_err) {
          // Scheduling telemetry must never affect the cache write.
        }
      }
      const queuedAt = Date.now();
      let cacheStartedAt = queuedAt;
      const storedPromise = enqueueMutation(function () {
        cacheStartedAt = Date.now();
        if (!mutationAllowed(opts)) return false;
        return openCache().then(function (cache) {
          if (!cache) return false;
          if (!mutationAllowed(opts)) return false;
          // Cache.put replaces the matching entry atomically; avoid a delete gap
          // during which WebKit could miss a segment that is being refreshed.
          return cache.put(request, cacheResponse)
            .then(function () {
              if (!mutationAllowed(opts)) {
                return cache.delete(request).then(function () { return false; });
              }
              const keepSources = typeof opts.getKeepSources === "function"
                ? opts.getKeepSources()
                : (opts.keepSources || []);
              return pruneCacheEntries(cache, {
                maxEntries: opts.maxEntries || constants.MAX_ENTRIES,
                keepSources
              });
            })
            .then(function (stored) { return stored !== false; });
        });
      });
      // The caller gets a bounded result, but the underlying CacheStorage
      // operation remains the mutation queue's owner until it really settles.
      // This prevents a timed-out stale delete/prune from overlapping a newer
      // write for the same segment.
      return withMutationTimeout(storedPromise, opts.timeoutMs).then(function (stored) {
        if (typeof opts.onTimings === "function") {
          try {
            opts.onTimings({
              body_ms: Math.max(0, bodyFinishedAt - bodyStartedAt),
              queue_ms: Math.max(0, cacheStartedAt - queuedAt),
              cache_ms: Math.max(0, Date.now() - cacheStartedAt)
            });
          } catch (_err) {
            // Telemetry must never affect the cache write.
          }
        }
        return stored;
      });
    });
  }

  globalObject.InfraAudioPrefetch = Object.freeze({
    constants,
    isSupported,
    createRequest,
    getContentLength,
    normalizeAudioResponseForCache,
    inspectCachedSegment,
    findFirstValidCachedSegment,
    findValidCachedSegments,
    waitForMutationIdle,
    pruneCache,
    putSingle
  });
})();
