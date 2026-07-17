#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const entries = new Map();
const mutationLog = [];
let fetchCalls = 0;
const cache = {
  keys: () => Promise.resolve(Array.from(entries.values(), (entry) => entry.request)),
  match: (request) => {
    const url = typeof request === "string" ? request : request.url;
    const entry = entries.get(url);
    return Promise.resolve(entry ? entry.response : undefined);
  },
  delete: (request) => {
    const url = typeof request === "string" ? request : request.url;
    mutationLog.push(`delete:${url}`);
    return Promise.resolve(entries.delete(url));
  },
  put: (request, response) => {
    mutationLog.push(`put:${request.url}`);
    entries.set(request.url, { request, response });
    return Promise.resolve();
  }
};
const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  Promise,
  setTimeout,
  clearTimeout,
  location: { href: "https://site.test/" },
  caches: { open: () => Promise.resolve(cache) },
  fetch: () => {
    fetchCalls += 1;
    return Promise.resolve(new Response());
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/assets/js/audio-prefetch.js"), "utf8"),
  sandbox
);

function segmentResponse(seed) {
  const bytes = new Uint8Array(1024);
  bytes.fill(seed);
  return new Response(bytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-1023/8192",
      "ETag": `"track-${seed}"`
    }
  });
}

(async function () {
  const api = sandbox.InfraAudioPrefetch;
  assert.strictEqual(api.constants.PREFETCH_SEGMENT_SIZE, 2 * 1024 * 1024);
  assert.strictEqual(api.constants.MAX_BYTES, 2 * 1024 * 1024);
  assert.strictEqual(api.constants.CACHE_NAME, "infra-next-track-segments-v9");
  assert.strictEqual(api.constants.QUEUE_DEPTH, 5);
  assert.strictEqual(api.constants.CONCURRENCY, 2);
  assert.strictEqual(api.constants.MAX_ENTRIES, 6);
  assert.strictEqual(api.clearCache, undefined, "The v9 API must not expose a global cache clear");
  assert.strictEqual(typeof api.waitForMutationIdle, "function");

  const request = api.createRequest("https://media.test/next.m4a");
  assert.strictEqual(request.headers.get("Range"), "bytes=0-2097151");
  assert.strictEqual(request.mode, "cors");
  assert.strictEqual(request.credentials, "omit");

  await assert.rejects(
    api.putSingle("https://media.test/not-partial.m4a", new Response("full", { status: 200 })),
    /prefetch_requires_valid_206/
  );
  assert.strictEqual(entries.size, 0, "A non-206 response must never enter CacheStorage");

  function rejectedResponse(status, headers) {
    let cancellations = 0;
    let bodyReads = 0;
    return {
      response: {
        status,
        headers: new Headers(headers || {}),
        body: {
          cancel() {
            cancellations += 1;
            return Promise.resolve();
          }
        },
        arrayBuffer() {
          bodyReads += 1;
          return Promise.reject(new Error("invalid_response_body_must_not_be_read"));
        }
      },
      get cancellations() { return cancellations; },
      get bodyReads() { return bodyReads; }
    };
  }

  const invalidStatus = rejectedResponse(200, {
    "Content-Length": "1024"
  });
  await assert.rejects(
    api.putSingle("https://media.test/invalid-status.m4a", invalidStatus.response),
    /prefetch_requires_valid_206/
  );
  assert.strictEqual(invalidStatus.cancellations, 1, "An invalid HTTP status must cancel its unread response body");
  assert.strictEqual(invalidStatus.bodyReads, 0);

  const invalidRange = rejectedResponse(206, {
    "Content-Length": "1024",
    "Content-Range": "bytes malformed"
  });
  await assert.rejects(
    api.putSingle("https://media.test/invalid-range.m4a", invalidRange.response),
    /prefetch_requires_valid_206/
  );
  assert.strictEqual(invalidRange.cancellations, 1, "An invalid Content-Range must cancel its unread response body");
  assert.strictEqual(invalidRange.bodyReads, 0);

  const oversizedSegment = rejectedResponse(206, {
    "Content-Length": String(2 * 1024 * 1024 + 1),
    "Content-Range": `bytes 0-${2 * 1024 * 1024}/${8 * 1024 * 1024}`
  });
  await assert.rejects(
    api.putSingle("https://media.test/oversized-segment.m4a", oversizedSegment.response),
    /prefetch_segment_too_large/
  );
  assert.strictEqual(oversizedSegment.cancellations, 1, "A segment above the 2 MiB cap must cancel its unread body");
  assert.strictEqual(oversizedSegment.bodyReads, 0, "An oversized segment body must never be buffered");

  const mismatchedLength = rejectedResponse(206, {
    "Content-Length": "512",
    "Content-Range": "bytes 0-1023/8192"
  });
  await assert.rejects(
    api.putSingle("https://media.test/mismatched-length.m4a", mismatchedLength.response),
    /prefetch_content_length_mismatch/
  );
  assert.strictEqual(mismatchedLength.cancellations, 1, "A contradictory length must cancel its unread response body");
  assert.strictEqual(mismatchedLength.bodyReads, 0);

  const obsoleteStored = await api.putSingle(
    "https://media.test/obsolete.m4a",
    segmentResponse(99),
    { shouldStore: () => false }
  );
  assert.strictEqual(obsoleteStored, false, "An obsolete generation must not commit to CacheStorage");
  assert(!entries.has("https://media.test/obsolete.m4a"));

  await api.putSingle("https://media.test/track-0.m4a", segmentResponse(0));
  const stored = entries.get("https://media.test/track-0.m4a").response;
  assert.strictEqual(stored.status, 200, "CacheStorage receives a normalized 200 response");
  assert.strictEqual(stored.headers.get("Content-Range"), null);
  assert.strictEqual(stored.headers.get("X-Infra-Audio-Partial"), "1");
  assert.strictEqual(stored.headers.get("X-Infra-Audio-Cache-Version"), "9");
  assert.strictEqual(stored.headers.get("X-Infra-Range-Start"), "0");
  assert.strictEqual(stored.headers.get("X-Infra-Range-End"), "1023");
  assert.strictEqual(stored.headers.get("X-Infra-Total-Length"), "8192");
  assert.strictEqual(stored.headers.get("X-Infra-Body-Validated"), "1");
  assert.strictEqual(stored.headers.get("X-Infra-First-Two-Bytes"), "0000");
  assert.strictEqual((await stored.clone().arrayBuffer()).byteLength, 1024);

  let cachedBodyReads = 0;
  stored.arrayBuffer = function () {
    cachedBodyReads += 1;
    throw new Error("Cached-segment inspection must not consume the body");
  };
  const storedInfo = await api.inspectCachedSegment("https://media.test/track-0.m4a");
  assert.strictEqual(storedInfo.valid, true, "A normalized v9 segment must be rehydration-ready");
  assert.strictEqual(storedInfo.bytes, 1024);
  assert.strictEqual(storedInfo.rangeStart, 0);
  assert.strictEqual(storedInfo.rangeEnd, 1023);
  assert.strictEqual(storedInfo.totalLength, 8192);
  assert.strictEqual(storedInfo.bodyValidated, true);
  assert.strictEqual(cachedBodyReads, 0, "Cache rehydration must validate headers only");

  const corruptUrl = "https://media.test/corrupt.m4a";
  const corruptResponse = new Response(new Uint8Array(1024), {
    status: 200,
    headers: {
      "Content-Length": "1024",
      "X-Infra-Audio-Partial": "1",
      "X-Infra-Audio-Cache-Version": "8",
      "X-Infra-Range-Start": "0",
      "X-Infra-Range-End": "1023",
      "X-Infra-Total-Length": "8192"
    }
  });
  let corruptBodyReads = 0;
  corruptResponse.arrayBuffer = function () {
    corruptBodyReads += 1;
    throw new Error("Corrupt cache detection must remain headers-only");
  };
  entries.set(corruptUrl, {
    request: new Request(corruptUrl),
    response: corruptResponse
  });
  const corruptInfo = await api.inspectCachedSegment(corruptUrl);
  assert.strictEqual(corruptInfo.found, true);
  assert.strictEqual(corruptInfo.valid, false, "An obsolete v8 segment must not be rehydrated as v9");
  assert.strictEqual(corruptInfo.reason, "cache_corrupt");
  assert.strictEqual(corruptBodyReads, 0);

  const legacyProbeUrl = "https://media.test/legacy-probe.m4a";
  const legacyProbeResponse = new Response(new Uint8Array(1024), {
    status: 200,
    headers: {
      "Content-Length": "1024",
      "X-Infra-Audio-Partial": "1",
      "X-Infra-Audio-Cache-Version": "9",
      "X-Infra-Range-Start": "0",
      "X-Infra-Range-End": "1023",
      "X-Infra-Total-Length": "8192",
      "X-Infra-Body-Validated": "1"
    }
  });
  entries.set(legacyProbeUrl, {
    request: new Request(legacyProbeUrl),
    response: legacyProbeResponse
  });
  const legacyProbeInfo = await api.inspectCachedSegment(legacyProbeUrl);
  assert.strictEqual(legacyProbeInfo.valid, true, "An additive v9 metadata change must not corrupt old entries");
  assert.strictEqual(legacyProbeInfo.probeReady, false, "Older v9 entries must be refreshed before fast playback");

  const firstCached = await api.findFirstValidCachedSegment([
    "https://media.test/missing.m4a",
    legacyProbeUrl,
    corruptUrl,
    "https://media.test/track-0.m4a"
  ]);
  assert(firstCached && firstCached.valid, "The ordered helper must find the first valid cached source");
  assert.strictEqual(firstCached.src, "https://media.test/track-0.m4a");
  const cachedGroup = await api.findValidCachedSegments([
    "https://media.test/missing.m4a",
    legacyProbeUrl,
    corruptUrl,
    "https://media.test/track-0.m4a"
  ]);
  assert.deepStrictEqual(
    Array.from(cachedGroup, (result) => result.src),
    ["https://media.test/track-0.m4a"],
    "The grouped helper must return only valid, probe-ready v9 entries"
  );
  const firstValidGroup = await api.findValidCachedSegments([
    legacyProbeUrl,
    corruptUrl,
    "https://media.test/track-0.m4a"
  ], 1);
  assert.deepStrictEqual(
    Array.from(firstValidGroup, (result) => result.src),
    ["https://media.test/track-0.m4a"],
    "Invalid stored entries must not consume the bounded valid-result quota"
  );
  assert.strictEqual(fetchCalls, 0, "Cache inspection helpers must never trigger a network fetch");

  entries.delete(corruptUrl);
  entries.delete(legacyProbeUrl);

  await Promise.all(Array.from({ length: 7 }, (_unused, index) => (
    api.putSingle(`https://media.test/track-${index + 1}.m4a`, segmentResponse(index + 1))
  )));
  assert.strictEqual(entries.size, 6, "Serialized put/prune mutations enforce the six-entry bound");
  assert(!entries.has("https://media.test/track-0.m4a"), "The oldest unprotected segment is pruned");
  const orderedGroup = await api.findValidCachedSegments([
    "https://media.test/track-7.m4a",
    "https://media.test/missing.m4a",
    "https://media.test/track-3.m4a",
    "https://media.test/track-4.m4a"
  ], 3);
  assert.deepStrictEqual(
    Array.from(orderedGroup, (result) => result.src),
    [
      "https://media.test/track-7.m4a",
      "https://media.test/track-3.m4a",
      "https://media.test/track-4.m4a"
    ],
    "The grouped helper must preserve Radio order and respect its result cap"
  );

  await api.pruneCache({
    maxEntries: 2,
    keepSources: ["https://media.test/track-7.m4a"]
  });
  assert.strictEqual(entries.size, 2, "Explicit pruning shares the serialized mutation queue");
  assert(entries.has("https://media.test/track-7.m4a"), "A still-useful segment is protected while pruning");

  const puts = mutationLog.filter((entry) => entry.startsWith("put:"));
  assert.strictEqual(puts.length, 8, "Every valid segment is stored exactly once");

  const deferredBodies = [];
  let bodyReadsStarted = 0;
  let bodyReadyCallbacks = 0;
  function deferredSegmentResponse(seed) {
    const response = segmentResponse(seed);
    response.arrayBuffer = function () {
      bodyReadsStarted += 1;
      return new Promise((resolve) => {
        deferredBodies.push(function () {
          const bytes = new Uint8Array(1024);
          bytes.fill(seed);
          resolve(bytes.buffer);
        });
      });
    };
    return response;
  }
  const timingOptions = { onBodyReady() { bodyReadyCallbacks += 1; } };
  const parallelA = api.putSingle("https://media.test/parallel-a.m4a", deferredSegmentResponse(8), timingOptions);
  const parallelB = api.putSingle("https://media.test/parallel-b.m4a", deferredSegmentResponse(9), timingOptions);
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(
    bodyReadsStarted,
    2,
    "Two response bodies must validate in parallel instead of waiting in the cache mutation queue"
  );
  deferredBodies.forEach((resolve) => resolve());
  await Promise.all([parallelA, parallelB]);
  assert.strictEqual(bodyReadyCallbacks, 2, "Network timeouts may stop as soon as each body is fully validated");
  assert.strictEqual(
    mutationLog.filter((entry) => entry.startsWith("put:")).length,
    10,
    "Parallel body validation must still produce one serialized cache write per segment"
  );

  const normalPut = cache.put;
  let slowMutationActive = false;
  let overlappedMutation = false;
  cache.put = function (request, response) {
    if (request.url === "https://media.test/cache-timeout.m4a") {
      slowMutationActive = true;
      return new Promise(function (resolve) {
        setTimeout(function () {
          slowMutationActive = false;
          resolve();
        }, 25);
      });
    }
    if (slowMutationActive) overlappedMutation = true;
    return normalPut(request, response);
  };
  await assert.rejects(
    api.putSingle(
      "https://media.test/cache-timeout.m4a",
      segmentResponse(10),
      { timeoutMs: 5 }
    ),
    /prefetch_cache_timeout/
  );
  let mutationIdleResolved = false;
  const mutationIdle = api.waitForMutationIdle().then(function () {
    mutationIdleResolved = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(
    mutationIdleResolved,
    false,
    "The cache API must expose the timed-out mutation until its underlying put really settles"
  );
  await mutationIdle;
  await api.putSingle("https://media.test/after-timeout.m4a", segmentResponse(11));
  cache.put = normalPut;
  assert.strictEqual(overlappedMutation, false, "Timed-out cache work must remain serialized until it settles");
  assert(entries.has("https://media.test/after-timeout.m4a"), "The queue must continue after timed-out cache work settles");

  const realBytes = new Uint8Array(2 * 1024 * 1024);
  realBytes.fill(10);
  await api.putSingle("https://media.test/real-2mib.m4a", new Response(realBytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(realBytes.byteLength),
      "Content-Range": `bytes 0-${realBytes.byteLength - 1}/${8 * 1024 * 1024}`
    }
  }));
  const realInfo = await api.inspectCachedSegment("https://media.test/real-2mib.m4a");
  assert.strictEqual(realInfo.valid, true, "A complete 2 MiB startup segment must be cache-ready");
  assert.strictEqual(realInfo.bytes, 2 * 1024 * 1024);
  assert.strictEqual(realInfo.rangeEnd, 2 * 1024 * 1024 - 1);
  console.log("Audio startup-segment v9 cache checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
