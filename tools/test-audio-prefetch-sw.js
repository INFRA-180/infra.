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

  console.log(JSON.stringify({ ok: true, checks: 5 }, null, 2));
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
