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
  assert.strictEqual(api.constants.PREFETCH_SEGMENT_SIZE, 4 * 1024 * 1024);
  assert.strictEqual(api.constants.CACHE_NAME, "infra-next-track-segments-v7");
  assert.strictEqual(api.constants.QUEUE_DEPTH, 5);
  assert.strictEqual(api.constants.CONCURRENCY, 2);
  assert.strictEqual(api.constants.MAX_ENTRIES, 6);
  assert.strictEqual(api.clearCache, undefined, "The v7 API must not expose a global cache clear");

  const request = api.createRequest("https://media.test/next.m4a");
  assert.strictEqual(request.headers.get("Range"), "bytes=0-4194303");
  assert.strictEqual(request.mode, "cors");
  assert.strictEqual(request.credentials, "omit");

  await assert.rejects(
    api.putSingle("https://media.test/not-partial.m4a", new Response("full", { status: 200 })),
    /prefetch_requires_valid_206/
  );
  assert.strictEqual(entries.size, 0, "A non-206 response must never enter CacheStorage");

  await api.putSingle("https://media.test/track-0.m4a", segmentResponse(0));
  const stored = entries.get("https://media.test/track-0.m4a").response;
  assert.strictEqual(stored.status, 200, "CacheStorage receives a normalized 200 response");
  assert.strictEqual(stored.headers.get("Content-Range"), null);
  assert.strictEqual(stored.headers.get("X-Infra-Audio-Partial"), "1");
  assert.strictEqual(stored.headers.get("X-Infra-Audio-Cache-Version"), "7");
  assert.strictEqual(stored.headers.get("X-Infra-Range-Start"), "0");
  assert.strictEqual(stored.headers.get("X-Infra-Range-End"), "1023");
  assert.strictEqual(stored.headers.get("X-Infra-Total-Length"), "8192");
  assert.strictEqual(stored.headers.get("X-Infra-Body-Validated"), "1");
  assert.strictEqual((await stored.clone().arrayBuffer()).byteLength, 1024);

  let cachedBodyReads = 0;
  stored.arrayBuffer = function () {
    cachedBodyReads += 1;
    throw new Error("Cached-segment inspection must not consume the body");
  };
  const storedInfo = await api.inspectCachedSegment("https://media.test/track-0.m4a");
  assert.strictEqual(storedInfo.valid, true, "A normalized v7 segment must be rehydration-ready");
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
      "X-Infra-Audio-Cache-Version": "6",
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
  assert.strictEqual(corruptInfo.valid, false, "A non-v7 segment must not be rehydrated");
  assert.strictEqual(corruptInfo.reason, "cache_corrupt");
  assert.strictEqual(corruptBodyReads, 0);

  const firstCached = await api.findFirstValidCachedSegment([
    "https://media.test/missing.m4a",
    corruptUrl,
    "https://media.test/track-0.m4a"
  ]);
  assert(firstCached && firstCached.valid, "The ordered helper must find the first valid cached source");
  assert.strictEqual(firstCached.src, "https://media.test/track-0.m4a");
  assert.strictEqual(fetchCalls, 0, "Cache inspection helpers must never trigger a network fetch");

  entries.delete(corruptUrl);

  await Promise.all(Array.from({ length: 7 }, (_unused, index) => (
    api.putSingle(`https://media.test/track-${index + 1}.m4a`, segmentResponse(index + 1))
  )));
  assert.strictEqual(entries.size, 6, "Serialized put/prune mutations enforce the six-entry bound");
  assert(!entries.has("https://media.test/track-0.m4a"), "The oldest unprotected segment is pruned");

  await api.pruneCache({
    maxEntries: 2,
    keepSources: ["https://media.test/track-7.m4a"]
  });
  assert.strictEqual(entries.size, 2, "Explicit pruning shares the serialized mutation queue");
  assert(entries.has("https://media.test/track-7.m4a"), "A still-useful segment is protected while pruning");

  const puts = mutationLog.filter((entry) => entry.startsWith("put:"));
  assert.strictEqual(puts.length, 8, "Every valid segment is stored exactly once");
  console.log("Audio startup-segment v7 cache checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
