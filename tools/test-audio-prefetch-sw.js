#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let fetchHandler = null;
let installHandler = null;
let installedCriticalAssets = [];
let installedOptionalAssets = [];
let skipWaitingCalls = 0;
let failCriticalInstall = false;
const shellCache = {
  addAll: (assets) => {
    installedCriticalAssets = assets.slice();
    if (failCriticalInstall) return Promise.reject(new Error("critical_asset_failed"));
    return Promise.resolve();
  },
  add: (asset) => {
    installedOptionalAssets.push(asset);
    if (asset.includes("scripts.admin.js")) return Promise.reject(new Error("optional_asset_failed"));
    return Promise.resolve();
  },
  match: () => Promise.resolve(null),
  delete: () => Promise.resolve(true)
};
const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  fetch: () => Promise.resolve(new Response("network")),
  caches: {
    open: () => Promise.resolve(shellCache),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true)
  },
  self: {
    location: { origin: "https://site.test" },
    addEventListener: (type, handler) => {
      if (type === "fetch") fetchHandler = handler;
      if (type === "install") installHandler = handler;
    },
    skipWaiting: () => {
      skipWaitingCalls += 1;
      return Promise.resolve();
    },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) }
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8"), sandbox);

(async function () {
  assert(installHandler, "Service Worker install handler missing");
  let installPromise = null;
  installHandler({ waitUntil: (promise) => { installPromise = promise; } });
  await installPromise;
  assert.strictEqual(installedCriticalAssets.length, 38);
  assert(!installedCriticalAssets.some((asset) => asset.includes("scripts.admin.js")));
  assert(!installedCriticalAssets.some((asset) => asset.includes("share-qr.js")));
  assert(!installedCriticalAssets.some((asset) => asset.includes("qr-creator.min.js")));
  assert.strictEqual(installedOptionalAssets.length, 3);
  assert.strictEqual(skipWaitingCalls, 1, "Optional asset failure must not block installation");

  failCriticalInstall = true;
  installPromise = null;
  installHandler({ waitUntil: (promise) => { installPromise = promise; } });
  await assert.rejects(installPromise, /critical_asset_failed/);
  assert.strictEqual(skipWaitingCalls, 1, "Critical asset failure must block installation");

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
