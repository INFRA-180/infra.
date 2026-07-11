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
  const full = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mp4",
      "Content-Length": String(bytes.byteLength)
    }
  });

  const stored = await sandbox.InfraAudioPrefetch.putSingle("https://media.test/next.m4a", full);
  assert.strictEqual(stored, true);
  assert(storedResponse, "the complete N+1 track must be written to Cache Storage");
  assert.strictEqual(storedResponse.status, 200, "the complete cache entry must remain a normal 200 response");
  assert.strictEqual(storedResponse.headers.get("Content-Range"), null, "complete N+1 cache entries must not carry partial range metadata");
  assert.strictEqual((await storedResponse.arrayBuffer()).byteLength, 1024 * 1024);

  console.log(JSON.stringify({ ok: true, checks: 5 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
