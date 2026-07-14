#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
    location: { origin: "https://site.test" },
    addEventListener: (type, handler) => { if (type === "fetch") fetchHandler = handler; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) }
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8"), sandbox);

(async function () {
  assert(fetchHandler, "Service Worker fetch handler missing");
  let respondWithCalled = false;
  fetchHandler({
    request: new Request("https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a"),
    respondWith: () => { respondWithCalled = true; }
  });
  assert.strictEqual(respondWithCalled, true, "R2 media must check the startup-segment cache");

  const cached = new Response(new Uint8Array(1024), {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": "1024",
      "X-Infra-Audio-Partial": "1",
      "X-Infra-Range-Start": "0",
      "X-Infra-Range-End": "1023",
      "X-Infra-Total-Length": "8192"
    }
  });
  const startup = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=0-");
  assert(startup);
  assert.strictEqual(startup.status, 206);
  assert.strictEqual(startup.headers.get("Content-Range"), "bytes 0-1023/8192");
  assert.strictEqual((await startup.arrayBuffer()).byteLength, 1024);
  const miss = await sandbox.buildRangeResponseFromCachedAudio(cached.clone(), "bytes=2048-");
  assert.strictEqual(miss, null);
  console.log("Audio startup-segment Service Worker checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
