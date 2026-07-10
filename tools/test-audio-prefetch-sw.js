#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
    addEventListener: () => {},
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
  const bytes = new Uint8Array(512 * 1024);
  const cached = new Response(bytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-524287/9645164"
    }
  });

  const startup = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=0-");
  assert(startup, "the cached startup segment must satisfy an open initial range");
  assert.strictEqual(startup.status, 206);
  assert.strictEqual(startup.headers.get("Content-Range"), "bytes 0-524287/9645164");
  assert.strictEqual((await startup.arrayBuffer()).byteLength, 512 * 1024);

  const outside = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=524288-");
  assert.strictEqual(outside, null, "ranges after the warmup segment must continue on the network");

  const overlap = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=0-600000");
  assert.strictEqual(overlap, null, "finite ranges extending past the warmup must continue on the network intact");

  let fetchCalls = 0;
  let deleteCalls = 0;
  let expectedNetworkRange = "bytes=524288-";
  const normalizedCached = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-524287/9645164"
    }
  });
  const cache = {
    match: () => Promise.resolve(normalizedCached.clone()),
    delete: () => {
      deleteCalls += 1;
      return Promise.resolve(true);
    }
  };
  sandbox.caches.open = () => Promise.resolve(cache);
  sandbox.fetch = (request) => {
    fetchCalls += 1;
    assert.strictEqual(request.headers.get("Range"), expectedNetworkRange, "network handoff must preserve the requested Range");
    return Promise.resolve(new Response(new Uint8Array(16), {
      status: 206,
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": "16",
        "Content-Range": "bytes 524288-524303/9645164"
      }
    }));
  };

  const url = new URL("https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a");
  const handoffRequest = new Request(url, { headers: { Range: "bytes=524288-" } });
  const handoff = await sandbox.servePrefetchedAudioOrNetwork(handoffRequest, url);
  assert.strictEqual(handoff.status, 206, "an out-of-segment Range must use the network response");
  assert.strictEqual(fetchCalls, 1, "only the out-of-segment Range should reach the network");
  assert.strictEqual(deleteCalls, 0, "network handoff must not delete a valid startup segment");

  const replayRequest = new Request(url, { headers: { Range: "bytes=0-" } });
  const replay = await sandbox.servePrefetchedAudioOrNetwork(replayRequest, url);
  assert.strictEqual(replay.status, 206, "a later startup Range must still be served from cache");
  assert.strictEqual(replay.headers.get("Content-Range"), "bytes 0-524287/9645164");
  assert.strictEqual((await replay.arrayBuffer()).byteLength, 512 * 1024);
  assert.strictEqual(fetchCalls, 1, "the retained startup segment must avoid a second network request");
  assert.strictEqual(deleteCalls, 0, "the retained startup segment must remain reusable");

  const corruptCached = new Response(new Uint8Array(8), {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": "8",
      "Content-Range": "bytes 0-15/9645164"
    }
  });
  cache.match = () => Promise.resolve(corruptCached.clone());
  expectedNetworkRange = "bytes=0-";
  const corruptFallback = await sandbox.servePrefetchedAudioOrNetwork(replayRequest, url);
  assert.strictEqual(corruptFallback.status, 206, "a corrupt cached segment must fall back to the network");
  assert.strictEqual(fetchCalls, 2, "corrupt cache fallback must issue one network request");
  assert.strictEqual(deleteCalls, 2, "a corrupt entry must be deleted by Request and URL keys");

  console.log(JSON.stringify({ ok: true, checks: 17 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
