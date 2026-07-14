#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let storedRequest = null;
let storedResponse = null;
const cache = {
  keys: () => Promise.resolve(storedRequest ? [storedRequest] : []),
  delete: () => Promise.resolve(true),
  put: (request, response) => {
    storedRequest = request;
    storedResponse = response;
    return Promise.resolve();
  }
};
const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  Promise,
  caches: { open: () => Promise.resolve(cache) },
  fetch: () => Promise.resolve(new Response())
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/assets/js/audio-prefetch.js"), "utf8"),
  sandbox
);

(async function () {
  const api = sandbox.InfraAudioPrefetch;
  const request = api.createRequest("https://media.test/next.m4a");
  assert.strictEqual(api.constants.PREFETCH_SEGMENT_SIZE, 4 * 1024 * 1024);
  assert.strictEqual(request.headers.get("Range"), "bytes=0-4194303");
  assert.strictEqual(api.constants.CACHE_NAME, "infra-next-track-segments-v6");
  assert.strictEqual(api.constants.QUEUE_DEPTH, 4);
  assert.strictEqual(api.constants.CONCURRENCY, 2);
  assert.strictEqual(api.constants.MAX_ENTRIES, 6);

  const bytes = new Uint8Array(1024);
  const partial = new Response(bytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-1023/8192"
    }
  });
  assert.strictEqual(await api.putSingle("https://media.test/next.m4a", partial), true);
  assert.strictEqual(storedRequest.headers.get("Range"), null);
  assert.strictEqual(storedResponse.status, 200);
  assert.strictEqual(storedResponse.headers.get("X-Infra-Audio-Partial"), "1");
  assert.strictEqual(storedResponse.headers.get("X-Infra-Total-Length"), "8192");
  assert.strictEqual((await storedResponse.arrayBuffer()).byteLength, 1024);
  console.log("Audio startup-segment cache checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
