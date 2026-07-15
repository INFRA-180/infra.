#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let fetchHandler = null;
let installHandler = null;
let activateHandler = null;
let cachedAudio = null;
let fetchCalls = 0;
let skipWaitingCalls = 0;
const deletedCaches = [];
const deletedAudioEntries = [];
const requestedClientIds = [];
const clientMessages = [];

const shellCache = {
  addAll: () => Promise.resolve(),
  match: () => Promise.resolve(null),
  put: () => Promise.resolve(),
  keys: () => Promise.resolve([]),
  delete: () => Promise.resolve(true)
};
const audioCache = {
  match: () => Promise.resolve(cachedAudio),
  delete: (request) => {
    deletedAudioEntries.push(typeof request === "string" ? request : request.url);
    cachedAudio = null;
    return Promise.resolve(true);
  }
};

const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  fetch: () => {
    fetchCalls += 1;
    return Promise.resolve(new Response("network", { status: 200 }));
  },
  caches: {
    open: (name) => Promise.resolve(name === "infra-next-track-segments-v7" ? audioCache : shellCache),
    keys: () => Promise.resolve([
      "infra-next-track",
      "infra-next-track-v2",
      "infra-next-track-full-v3",
      "infra-next-track-segments-v6",
      "infra-next-track-segments-v7",
      "infra-covers",
      "infra-shell-20260714-audio320-shell",
      "infra-shell-20260715-audio329-shell",
      "infra-shell-20260715-audio329-runtime",
      "infra-shell-20260715-audio330-shell",
      "infra-shell-20260715-audio330-runtime"
    ]),
    delete: (name) => {
      deletedCaches.push(name);
      return Promise.resolve(true);
    }
  },
  self: {
    location: { origin: "https://site.test" },
    addEventListener: (type, handler) => {
      if (type === "fetch") fetchHandler = handler;
      if (type === "install") installHandler = handler;
      if (type === "activate") activateHandler = handler;
    },
    skipWaiting: () => {
      skipWaitingCalls += 1;
      return Promise.resolve();
    },
    clients: {
      claim: () => Promise.resolve(),
      get: (clientId) => {
        requestedClientIds.push(clientId);
        return Promise.resolve({ postMessage: (message) => clientMessages.push({ clientId, message }) });
      },
      matchAll: () => {
        throw new Error("Prefetch telemetry must not be broadcast");
      }
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8"), sandbox);

function validCachedSegment(overrides) {
  const opts = overrides || {};
  const bytes = new Uint8Array(opts.bodyLength || 1024);
  const headers = Object.assign({
    "Content-Type": "audio/mp4",
    "Content-Length": "1024",
    "X-Infra-Audio-Partial": "1",
    "X-Infra-Audio-Cache-Version": "7",
    "X-Infra-Range-Start": "0",
    "X-Infra-Range-End": "1023",
    "X-Infra-Total-Length": "8192",
    "ETag": '"track-v1"',
    "Last-Modified": "Wed, 15 Jul 2026 12:00:00 GMT"
  }, opts.headers || {});
  return new Response(bytes, { status: 200, headers });
}

async function dispatchAudioFetch(headers, clientId) {
  let responsePromise = null;
  const lifetimePromises = [];
  const request = new Request(
    "https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a",
    { headers: headers || {} }
  );
  fetchHandler({
    request,
    clientId: clientId === undefined ? "client-a" : clientId,
    respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
    waitUntil: (promise) => { lifetimePromises.push(Promise.resolve(promise)); }
  });
  assert(responsePromise, "R2 audio requests must be handled by the Service Worker");
  const response = await responsePromise;
  await Promise.all(lifetimePromises);
  return response;
}

(async function () {
  assert(installHandler, "Service Worker install handler missing");
  let installPromise = null;
  installHandler({ waitUntil: (promise) => { installPromise = promise; } });
  await installPromise;
  assert.strictEqual(skipWaitingCalls, 1);

  assert(activateHandler, "Service Worker activate handler missing");
  let activatePromise = null;
  activateHandler({ waitUntil: (promise) => { activatePromise = promise; } });
  await activatePromise;
  assert.deepStrictEqual(deletedCaches.sort(), [
    "infra-next-track",
    "infra-next-track-full-v3",
    "infra-next-track-segments-v6",
    "infra-next-track-v2",
    "infra-shell-20260714-audio320-shell",
    "infra-shell-20260715-audio329-runtime",
    "infra-shell-20260715-audio329-shell"
  ]);
  assert(!deletedCaches.includes("infra-next-track-segments-v7"));
  assert(!deletedCaches.includes("infra-covers"));
  assert(!deletedCaches.includes("infra-shell-20260715-audio330-shell"));
  assert(!deletedCaches.includes("infra-shell-20260715-audio330-runtime"));

  assert(fetchHandler, "Service Worker fetch handler missing");
  cachedAudio = validCachedSegment();
  let response = await dispatchAudioFetch({});
  assert.strictEqual(await response.text(), "network", "A request without Range must use the network");
  assert.strictEqual(deletedAudioEntries.length, 0);

  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-" }, "client-hit");
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Range"), "bytes 0-1023/8192");
  assert.strictEqual((await response.arrayBuffer()).byteLength, 1024);
  assert.deepStrictEqual(requestedClientIds, ["client-hit"]);
  assert.strictEqual(clientMessages.length, 1);
  assert.strictEqual(clientMessages[0].clientId, "client-hit");
  assert.strictEqual(clientMessages[0].message.type, "INFRA_PREFETCH_HIT");

  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=512-1535" });
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Range"), "bytes 512-1023/8192");
  assert.strictEqual((await response.arrayBuffer()).byteLength, 512);

  const networkBeforeMisses = fetchCalls;
  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=2048-" });
  assert.strictEqual(await response.text(), "network", "A range starting outside the segment must use the network");
  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-10,20-30" });
  assert.strictEqual(await response.text(), "network", "A multi-range request must use the network");
  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-", "If-Range": '"track-v2"' });
  assert.strictEqual(await response.text(), "network", "An If-Range mismatch must use the network");
  assert.strictEqual(fetchCalls, networkBeforeMisses + 3);
  assert.strictEqual(deletedAudioEntries.length, 0, "Ordinary misses must not evict a valid segment");

  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-", "If-Range": '"track-v1"' });
  assert.strictEqual(response.status, 206, "A matching strong If-Range may use the segment");

  cachedAudio = validCachedSegment({ bodyLength: 1000 });
  response = await dispatchAudioFetch({ Range: "bytes=0-" });
  assert.strictEqual(await response.text(), "network");
  assert(deletedAudioEntries.length >= 1, "A corrupt cached body is evicted before network fallback");

  console.log("Audio startup-segment v7 Service Worker checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
