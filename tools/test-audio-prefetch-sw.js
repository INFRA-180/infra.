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
let cachedAudioArrayBufferCalls = 0;
let skipWaitingCalls = 0;
let shellMatchResponse = null;
let fetchOverride = null;
const deletedCaches = [];
const deletedAudioEntries = [];
const requestedClientIds = [];
const clientMessages = [];
const shellPutRequests = [];
const networkRequestModes = [];
let installedShellAssets = [];
const installedOptionalShellAssets = [];

const shellCache = {
  addAll: (assets) => {
    installedShellAssets = Array.from(assets || []);
    return Promise.resolve();
  },
  add: (asset) => {
    installedOptionalShellAssets.push(asset);
    if (String(asset).includes("qr-creator.min.js")) {
      return Promise.reject(new Error("optional_asset_unavailable"));
    }
    return Promise.resolve();
  },
  match: () => Promise.resolve(shellMatchResponse ? shellMatchResponse.clone() : null),
  put: (request) => {
    shellPutRequests.push(typeof request === "string" ? request : request.url);
    return Promise.resolve();
  },
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
  fetch: (request) => {
    fetchCalls += 1;
    networkRequestModes.push(request && request.mode ? request.mode : "");
    if (typeof fetchOverride === "function") return fetchOverride(request);
    return Promise.resolve(new Response("network", { status: 200 }));
  },
  caches: {
    open: (name) => Promise.resolve(name === "infra-next-track-segments-v9" ? audioCache : shellCache),
    keys: () => Promise.resolve([
      "infra-next-track",
      "infra-next-track-v2",
      "infra-next-track-full-v3",
      "infra-next-track-segments-v6",
      "infra-next-track-segments-v7",
      "infra-next-track-segments-v8",
      "infra-next-track-segments-v9",
      "infra-covers",
      "infra-covers-v2",
      "infra-shell-20260714-audio320-shell",
      "infra-shell-20260715-audio329-shell",
      "infra-shell-20260715-audio329-runtime",
      "infra-shell-20260715-audio330-shell",
      "infra-shell-20260715-audio330-runtime",
      "infra-shell-20260715-audio331-shell",
      "infra-shell-20260715-audio331-runtime",
      "infra-shell-20260716-audio332-shell",
      "infra-shell-20260716-audio332-runtime",
      "infra-shell-20260716-audio333-shell",
      "infra-shell-20260716-audio333-runtime",
      "infra-shell-20260716-audio334-shell",
      "infra-shell-20260716-audio334-runtime",
      "infra-shell-20260716-audio336-shell",
      "infra-shell-20260716-audio336-runtime",
      "infra-shell-20260717-audio338-shell",
      "infra-shell-20260717-audio338-runtime",
      "infra-shell-20260717-audio339-shell",
      "infra-shell-20260717-audio339-runtime",
      "infra-shell-20260717-audio340-shell",
      "infra-shell-20260717-audio340-runtime",
      "infra-shell-20260717-audio346-shell",
      "infra-shell-20260717-audio346-runtime",
      "infra-shell-20260717-audio347-shell",
      "infra-shell-20260717-audio347-runtime",
      "infra-shell-20260722-audio366-shell",
      "infra-shell-20260722-audio366-runtime",
      "infra-shell-20260722-audio367-shell",
      "infra-shell-20260722-audio367-runtime",
      "infra-shell-20260722-audio368-shell",
      "infra-shell-20260722-audio368-runtime",
      "infra-shell-20260724-audio369-shell",
      "infra-shell-20260724-audio369-runtime",
      "infra-shell-20260724-audio370-shell",
      "infra-shell-20260724-audio370-runtime",
      "infra-shell-20260724-audio371-shell",
      "infra-shell-20260724-audio371-runtime",
      "infra-shell-20260724-audio372-shell",
      "infra-shell-20260724-audio372-runtime",
      "infra-shell-20260724-audio373-shell",
      "infra-shell-20260724-audio373-runtime",
      "infra-shell-20260724-audio374-shell",
      "infra-shell-20260724-audio374-runtime",
      "infra-shell-20260801-audio378-shell",
      "infra-shell-20260801-audio378-runtime"
    ]),
    delete: (name) => {
      deletedCaches.push(name);
      return Promise.resolve(true);
    }
  },
  self: {
    location: { origin: "https://site.test", href: "https://site.test/sw.js" },
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
    "X-Infra-Audio-Cache-Version": "9",
    "X-Infra-Range-Start": "0",
    "X-Infra-Range-End": "1023",
    "X-Infra-Total-Length": "8192",
    "X-Infra-Body-Validated": "1",
    "X-Infra-First-Two-Bytes": "0000",
    "ETag": '"track-v1"',
    "Last-Modified": "Wed, 15 Jul 2026 12:00:00 GMT"
  }, opts.headers || {});
  if (opts.bodyValidated === false) delete headers["X-Infra-Body-Validated"];
  const response = new Response(bytes, { status: 200, headers });
  if (opts.trackArrayBuffer) {
    const originalArrayBuffer = response.arrayBuffer.bind(response);
    response.arrayBuffer = function () {
      cachedAudioArrayBufferCalls += 1;
      return originalArrayBuffer();
    };
    response.clone = function () { return response; };
  }
  return response;
}

async function dispatchAudioFetch(headers, clientId, mode) {
  let responsePromise = null;
  const lifetimePromises = [];
  const request = {
    url: "https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev/test.m4a",
    method: "GET",
    mode: mode || "cors",
    destination: "audio",
    headers: new Headers(headers || {})
  };
  fetchHandler({
    request,
    clientId: clientId === undefined ? "client-a" : clientId,
    respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
    waitUntil: (promise) => { lifetimePromises.push(Promise.resolve(promise)); }
  });
  if (!responsePromise) return null;
  const response = await responsePromise;
  await Promise.all(lifetimePromises);
  return response;
}

async function dispatchSiteFetch(request) {
  let responsePromise = null;
  fetchHandler({
    request,
    respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
    waitUntil() {}
  });
  assert(responsePromise, "The same-origin site request must be handled by the Service Worker");
  return responsePromise;
}

(async function () {
  assert(installHandler, "Service Worker install handler missing");
  let installPromise = null;
  installHandler({ waitUntil: (promise) => { installPromise = promise; } });
  await installPromise;
  assert.strictEqual(skipWaitingCalls, 0, "install must not replace the active controller during playback");
  const installedAlbumPages = shellPutRequests.filter((asset) => /\/music\/[^/]+-infra\.html$/.test(asset));
  assert.strictEqual(installedAlbumPages.length, 31, "all album documents must be installed with the PWA shell");
  assert(installedAlbumPages.includes("https://site.test/music/salam-infra.html"));
  assert(installedAlbumPages.includes("https://site.test/music/trou-noir-infra.html"));
  assert(installedShellAssets.includes("./assets/js/scripts.js?v=audiofix377-20260801"));
  assert(
    installedOptionalShellAssets.includes("./assets/vendor/qr-creator.min.js?v=1.0.0"),
    "optional shell resources must still be attempted"
  );

  assert(activateHandler, "Service Worker activate handler missing");
  let activatePromise = null;
  activateHandler({ waitUntil: (promise) => { activatePromise = promise; } });
  await activatePromise;
  assert.deepStrictEqual(deletedCaches.sort(), [
    "infra-covers",
    "infra-next-track",
    "infra-next-track-full-v3",
    "infra-next-track-segments-v6",
    "infra-next-track-segments-v7",
    "infra-next-track-segments-v8",
    "infra-next-track-v2",
    "infra-shell-20260714-audio320-shell",
    "infra-shell-20260715-audio329-runtime",
    "infra-shell-20260715-audio329-shell",
    "infra-shell-20260715-audio330-runtime",
    "infra-shell-20260715-audio330-shell",
    "infra-shell-20260715-audio331-runtime",
    "infra-shell-20260715-audio331-shell",
    "infra-shell-20260716-audio332-runtime",
    "infra-shell-20260716-audio332-shell",
    "infra-shell-20260716-audio333-runtime",
    "infra-shell-20260716-audio333-shell",
    "infra-shell-20260716-audio334-runtime",
    "infra-shell-20260716-audio334-shell",
    "infra-shell-20260716-audio336-runtime",
    "infra-shell-20260716-audio336-shell",
    "infra-shell-20260717-audio338-runtime",
    "infra-shell-20260717-audio338-shell",
    "infra-shell-20260717-audio339-runtime",
    "infra-shell-20260717-audio339-shell",
    "infra-shell-20260717-audio340-runtime",
    "infra-shell-20260717-audio340-shell",
    "infra-shell-20260717-audio346-runtime",
    "infra-shell-20260717-audio346-shell",
    "infra-shell-20260717-audio347-runtime",
    "infra-shell-20260717-audio347-shell",
    "infra-shell-20260722-audio366-runtime",
    "infra-shell-20260722-audio366-shell",
    "infra-shell-20260722-audio367-runtime",
    "infra-shell-20260722-audio367-shell",
    "infra-shell-20260722-audio368-runtime",
    "infra-shell-20260722-audio368-shell",
    "infra-shell-20260724-audio369-runtime",
    "infra-shell-20260724-audio369-shell",
    "infra-shell-20260724-audio370-runtime",
    "infra-shell-20260724-audio370-shell",
    "infra-shell-20260724-audio371-runtime",
    "infra-shell-20260724-audio371-shell",
    "infra-shell-20260724-audio372-runtime",
    "infra-shell-20260724-audio372-shell",
    "infra-shell-20260724-audio373-runtime",
    "infra-shell-20260724-audio373-shell",
    "infra-shell-20260724-audio374-runtime",
    "infra-shell-20260724-audio374-shell"
  ]);
  assert(!deletedCaches.includes("infra-next-track-segments-v9"));
  assert(!deletedCaches.includes("infra-covers-v2"));
  assert(!deletedCaches.includes("infra-shell-20260801-audio378-shell"));
  assert(!deletedCaches.includes("infra-shell-20260801-audio378-runtime"));

  assert(fetchHandler, "Service Worker fetch handler missing");
  const fetchesBeforeBypass = fetchCalls;
  cachedAudio = validCachedSegment();
  let response = await dispatchAudioFetch({});
  assert.strictEqual(response, null, "A request without Range must bypass the Service Worker");
  response = await dispatchAudioFetch({ Range: "bytes=0-" }, "client-no-cors", "no-cors");
  assert.strictEqual(response, null, "A no-cors media Range must bypass the Service Worker");
  assert.strictEqual(fetchCalls, fetchesBeforeBypass, "Bypassed media requests must not call fetch() inside the Service Worker");
  assert.strictEqual(deletedAudioEntries.length, 0);

  cachedAudioArrayBufferCalls = 0;
  cachedAudio = validCachedSegment({ trackArrayBuffer: true });
  response = await dispatchAudioFetch({ Range: "bytes=0-" }, "client-hit");
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Range"), "bytes 0-1023/8192");
  assert.strictEqual(response.headers.get("Access-Control-Allow-Origin"), "https://site.test");
  assert.strictEqual(response.headers.get("Vary"), "Origin");
  assert.strictEqual((await response.arrayBuffer()).byteLength, 1024);
  assert.strictEqual(
    cachedAudioArrayBufferCalls,
    0,
    "A request covering the cached segment must stream its body without a 2 MiB arrayBuffer copy"
  );
  assert.deepStrictEqual(requestedClientIds, ["client-hit"]);
  assert.strictEqual(clientMessages.length, 1);
  assert.strictEqual(clientMessages[0].clientId, "client-hit");
  assert.strictEqual(clientMessages[0].message.type, "INFRA_PREFETCH_HIT");

  cachedAudioArrayBufferCalls = 0;
  cachedAudio = validCachedSegment({ trackArrayBuffer: true });
  response = await dispatchAudioFetch({ Range: "bytes=0-1" }, "client-probe");
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Range"), "bytes 0-1/8192");
  assert.strictEqual((await response.arrayBuffer()).byteLength, 2);
  assert.strictEqual(
    cachedAudioArrayBufferCalls,
    0,
    "The WebKit bytes=0-1 probe must use cached header bytes without reading the 2 MiB body"
  );
  assert.strictEqual(clientMessages[1].clientId, "client-probe");
  assert.strictEqual(clientMessages[1].message.strategy, "startup_probe_v9");
  assert.strictEqual(clientMessages[1].message.range_start, 0);
  assert.strictEqual(clientMessages[1].message.range_end, 1);
  assert.strictEqual(clientMessages[1].message.bytes, 2);

  cachedAudioArrayBufferCalls = 0;
  cachedAudio = validCachedSegment({
    bodyLength: 2 * 1024 * 1024,
    trackArrayBuffer: true,
    headers: {
      "Content-Length": String(2 * 1024 * 1024),
      "X-Infra-Range-End": String(2 * 1024 * 1024 - 1),
      "X-Infra-Total-Length": String(8 * 1024 * 1024)
    }
  });
  response = await dispatchAudioFetch({ Range: "bytes=0-" }, "client-real-segment");
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Length"), String(2 * 1024 * 1024));
  assert.strictEqual((await response.arrayBuffer()).byteLength, 2 * 1024 * 1024);
  assert.strictEqual(cachedAudioArrayBufferCalls, 0, "The real 2 MiB segment must use the zero-copy 206 path");

  cachedAudio = validCachedSegment({
    bodyLength: 2 * 1024 * 1024,
    trackArrayBuffer: true,
    headers: {
      "Content-Length": String(2 * 1024 * 1024),
      "X-Infra-Range-End": String(2 * 1024 * 1024 - 1),
      "X-Infra-Total-Length": String(8 * 1024 * 1024)
    }
  });
  response = await dispatchAudioFetch({ Range: "bytes=0-8388607" }, "client-safari-full-range");
  assert.strictEqual(response.status, 206);
  assert.strictEqual(response.headers.get("Content-Range"), "bytes 0-2097151/8388608");
  assert.strictEqual((await response.arrayBuffer()).byteLength, 2 * 1024 * 1024);

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
  assert.strictEqual(response, null, "A multi-range request must bypass the Service Worker");
  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-", "If-Range": '"track-v2"' });
  assert.strictEqual(await response.text(), "network", "An If-Range mismatch must use the network");
  assert.strictEqual(fetchCalls, networkBeforeMisses + 2);
  assert(networkRequestModes.slice(-2).every((value) => value === "cors"), "Every Service Worker network fallback must remain CORS");
  assert.strictEqual(deletedAudioEntries.length, 0, "Ordinary misses must not evict a valid segment");

  cachedAudio = validCachedSegment();
  response = await dispatchAudioFetch({ Range: "bytes=0-", "If-Range": '"track-v1"' });
  assert.strictEqual(response.status, 206, "A matching strong If-Range may use the segment");

  cachedAudioArrayBufferCalls = 0;
  cachedAudio = validCachedSegment({
    bodyLength: 1000,
    bodyValidated: false,
    trackArrayBuffer: true
  });
  response = await dispatchAudioFetch({ Range: "bytes=0-" });
  assert.strictEqual(await response.text(), "network");
  assert.strictEqual(
    cachedAudioArrayBufferCalls,
    1,
    "A legacy/unvalidated full segment must be copied once so a truncated body cannot use the zero-copy path"
  );
  assert(deletedAudioEntries.length >= 1, "A corrupt cached body is evicted before network fallback");

  shellMatchResponse = new Response("cached-shell", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
  fetchOverride = () => {
    throw new Error("a cached shell document must not revalidate on the network");
  };
  const navigationFetchCalls = fetchCalls;
  response = await dispatchSiteFetch({
    url: "https://site.test/",
    method: "GET",
    mode: "navigate",
    destination: "document"
  });
  assert.strictEqual(response.headers.get("X-Infra-SW-Version"), "infra-shell-20260801-audio378");
  assert.strictEqual(response.headers.get("X-Infra-HTML-Strategy"), "shell_cache");
  assert.strictEqual(response.headers.get("X-Infra-HTML-Cache"), "hit");
  assert.strictEqual(
    await response.text(),
    "cached-shell",
    "A warm PWA navigation must return the installed shell without waiting for the network"
  );
  assert.strictEqual(fetchCalls, navigationFetchCalls, "A shell hit must not create background network traffic");

  fetchOverride = () => {
    throw new Error("a cached album document must not revalidate on the network");
  };
  const spaFetchCalls = fetchCalls;
  response = await dispatchSiteFetch({
    url: "https://site.test/music/salam-infra.html",
    method: "GET",
    mode: "cors",
    destination: ""
  });
  assert.strictEqual(
    await response.text(),
    "cached-shell",
    "A SPA album fetch must use the installed document without waiting for mobile network"
  );
  assert.strictEqual(fetchCalls, spaFetchCalls, "A cached SPA document must remain strictly local");
  fetchOverride = null;
  shellMatchResponse = null;

  console.log("Audio startup-segment v9 Service Worker checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
