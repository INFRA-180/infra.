#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let storedResponse = null;
const cache = {
  keys: () => Promise.resolve([]),
  delete: () => Promise.resolve(true),
  put: (_request, response) => {
    if (response.status === 206) {
      return Promise.reject(new TypeError("Cache.put rejects partial responses"));
    }
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
  const bytes = new Uint8Array(512 * 1024);
  const partial = new Response(bytes, {
    status: 206,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength),
      "Content-Range": "bytes 0-524287/9645164"
    }
  });

  const stored = await sandbox.InfraAudioPrefetch.putSingle("https://media.test/next.m4a", partial);
  assert.strictEqual(stored, true);
  assert(storedResponse, "the warmup segment must be written to Cache Storage");
  assert.strictEqual(storedResponse.status, 200, "the internal cache entry must not use rejected status 206");
  assert.strictEqual(storedResponse.headers.get("Content-Range"), "bytes 0-524287/9645164");
  assert.strictEqual((await storedResponse.arrayBuffer()).byteLength, 512 * 1024);

  console.log(JSON.stringify({ ok: true, checks: 5 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
