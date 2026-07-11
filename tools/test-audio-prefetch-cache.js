#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let storedRequest = null;
let storedResponse = null;
const cache = {
  keys: () => Promise.resolve([]),
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
  sandbox,
  { filename: "public/assets/js/audio-prefetch.js" }
);

(async function () {
  const bytes = new Uint8Array(1024 * 1024);
  const startupRequest = sandbox.InfraAudioPrefetch.createRequest("https://media.test/next.m4a");
  assert.strictEqual(startupRequest.headers.get("Range"), "bytes=0-2097151", "audio prefetch must request a startup segment");
  assert.strictEqual(sandbox.InfraAudioPrefetch.constants.CACHE_NAME, "infra-next-track-segments-v4", "audio prefetch must use the startup segment cache");

  const partial = new Response(bytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength * 4}`
    }
  });

  const stored = await sandbox.InfraAudioPrefetch.putSingle("https://media.test/next.m4a", partial);
  assert.strictEqual(stored, true);
  assert(storedRequest, "the startup segment must be written with an URL-only cache key");
  assert.strictEqual(storedRequest.headers.get("Range"), null, "cache keys must not include the startup Range header");
  assert(storedResponse, "the startup segment must be written to Cache Storage");
  assert.strictEqual(storedResponse.status, 200, "Cache Storage entries must normalize 206 startup segments to 200");
  assert.strictEqual(storedResponse.headers.get("X-Infra-Audio-Partial"), "1", "startup segment metadata must be preserved");
  assert.strictEqual(storedResponse.headers.get("X-Infra-Total-Length"), String(bytes.byteLength * 4));
  assert.strictEqual((await storedResponse.arrayBuffer()).byteLength, 1024 * 1024);

  console.log(JSON.stringify({ ok: true, checks: 9 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
