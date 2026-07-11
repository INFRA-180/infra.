#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fetchHandler = null;

const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  fetch: () => Promise.resolve(new Response("network")),
  caches: {
    open: () => Promise.resolve(null),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true)
  },
  self: {
    addEventListener: (type, handler) => {
      if (type === "fetch") fetchHandler = handler;
    },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([])
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8"),
  sandbox,
  { filename: "public/sw.js" }
);

(async function () {
  assert(fetchHandler, "service worker fetch handler must be registered");
  let respondWithCalled = false;
  fetchHandler({
    request: new Request("https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a"),
    respondWith: () => { respondWithCalled = true; }
  });
  assert.strictEqual(respondWithCalled, true, "R2 audio requests must be eligible for N+1 service-worker cache replay");

  const bytes = new Uint8Array(1024);
  const cached = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength)
    }
  });

  const startup = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=0-511");
  assert(startup, "the cached complete track must satisfy an initial range");
  assert.strictEqual(startup.status, 206);
  assert.strictEqual(startup.headers.get("Content-Range"), "bytes 0-511/1024");
  assert.strictEqual((await startup.arrayBuffer()).byteLength, 512);

  const later = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=512-");
  assert(later, "the cached complete track must satisfy later ranges too");
  assert.strictEqual(later.headers.get("Content-Range"), "bytes 512-1023/1024");

  const segment = new Response(new Uint8Array(512), {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": "512",
      "X-Infra-Audio-Partial": "1",
      "X-Infra-Range-Start": "0",
      "X-Infra-Range-End": "511",
      "X-Infra-Total-Length": "2048"
    }
  });
  const segmentStartup = await sandbox.buildRangeResponseFromCachedAudio(segment.clone(), "bytes=0-");
  assert(segmentStartup, "the cached startup segment must satisfy an initial open range");
  assert.strictEqual(segmentStartup.status, 206);
  assert.strictEqual(segmentStartup.headers.get("Content-Range"), "bytes 0-511/2048");
  assert.strictEqual((await segmentStartup.arrayBuffer()).byteLength, 512);
  const segmentMiss = await sandbox.buildRangeResponseFromCachedAudio(segment.clone(), "bytes=1024-");
  assert.strictEqual(segmentMiss, null, "a seek outside the startup segment must fall back to the network");

  let fetchCalls = 0;
  let deleteCalls = 0;
  let expectedNetworkRange = "";
  const completeCached = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength)
    }
  });
  const cache = {
    match: () => Promise.resolve(completeCached.clone()),
    delete: () => {
      deleteCalls += 1;
      return Promise.resolve(true);
    }
  };
  sandbox.caches.open = () => Promise.resolve(cache);
  sandbox.fetch = (request) => {
    fetchCalls += 1;
    if (expectedNetworkRange) {
      assert.strictEqual(request.headers.get("Range"), expectedNetworkRange, "network fallback must preserve the requested Range");
    }
    return Promise.resolve(new Response(new Uint8Array(16), {
      status: 206,
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": "16",
        "Content-Range": "bytes 0-15/1024"
      }
    }));
  };

  const url = new URL("https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a");
  const rangeRequest = new Request(url, { headers: { Range: "bytes=512-" } });
  const rangeReplay = await sandbox.servePrefetchedAudioOrNetwork(rangeRequest, url);
  assert.strictEqual(rangeReplay.status, 206, "a cached complete track must answer later Range requests");
  assert.strictEqual(rangeReplay.headers.get("Content-Range"), "bytes 512-1023/1024");
  assert.strictEqual(fetchCalls, 0, "a complete N+1 cache hit must avoid the network");
  assert.strictEqual(deleteCalls, 0, "a valid complete cache entry must remain reusable");

  const replayRequest = new Request(url, { headers: { Range: "bytes=0-" } });
  const replay = await sandbox.servePrefetchedAudioOrNetwork(replayRequest, url);
  assert.strictEqual(replay.status, 206, "a later startup Range must still be served from cache");
  assert.strictEqual(replay.headers.get("Content-Range"), "bytes 0-1023/1024");
  assert.strictEqual((await replay.arrayBuffer()).byteLength, 1024);
  assert.strictEqual(fetchCalls, 0, "the retained complete track must avoid a second network request");
  assert.strictEqual(deleteCalls, 0, "the retained complete track must remain reusable");

  const corruptCached = new Response(new Uint8Array(8), {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": "16"
    }
  });
  cache.match = () => Promise.resolve(corruptCached.clone());
  expectedNetworkRange = "bytes=0-";
  const corruptFallback = await sandbox.servePrefetchedAudioOrNetwork(replayRequest, url);
  assert.strictEqual(corruptFallback.status, 206, "a corrupt cached segment must fall back to the network");
  assert.strictEqual(fetchCalls, 1, "corrupt cache fallback must issue one network request");
  assert.strictEqual(deleteCalls, 2, "a corrupt entry must be deleted by Request and URL keys");

  console.log(JSON.stringify({ ok: true, checks: 25 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
