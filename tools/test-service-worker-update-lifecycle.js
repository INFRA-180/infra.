#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const scripts = read("public/assets/js/scripts.js");
const worker = read("public/sw.js");
const audioRadio = read("public/assets/js/audio-radio.js");
const nowPlaying = read("public/assets/js/now-playing.js");
const runtime = [scripts, worker, audioRadio, nowPlaying].join("\n");

assert.doesNotMatch(runtime, /window\.location\.reload\s*\(/, "a Service Worker update must never reload the visible PWA");
assert.doesNotMatch(runtime, /SKIP_WAITING|skipWaiting\s*\(/, "updates must use the native waiting lifecycle");
assert.doesNotMatch(runtime, /SERVICE_WORKER_RELOAD_|attemptDeferredServiceWorkerReload|scheduleDeferredServiceWorkerReload/);
assert.doesNotMatch(runtime, /sw_reload_pending|sw_reload_executed/, "audiofix402 must not emit reload events");

assert.match(scripts, /\.register\(swUrl, \{ scope: runtime\.baseUrl\.pathname, updateViaCache: "none" \}\)/);
assert.match(scripts, /serviceWorkerRegistrationRef\.update\(\)\.catch/);
assert.match(
  scripts,
  /addEventListener\("controllerchange", function \(\) \{[\s\S]*?requestActiveServiceWorkerVersion[\s\S]*?trackAudioRuntimeEvent\("sw_controllerchange"[\s\S]*?strategy: "natural_lifecycle"[\s\S]*?\}\);/,
  "controllerchange must only observe the naturally activated worker"
);
assert.match(worker, /self\.addEventListener\("install", \(event\) => \{\s*event\.waitUntil\(installShellCache\(\)\);\s*\}\);/);
assert.match(worker, /self\.addEventListener\("activate"[\s\S]*?await self\.clients\.claim\(\);/);
assert.doesNotMatch(scripts, /function scheduleSpaPagePrefetch|function scheduleSpaAlbumShellWarmup/);
assert.match(scripts, /document\.addEventListener\("pointerdown", prefetchFromLinkIntent/);
assert.match(scripts, /prefetchSpaPage\(url\.href, \{ cacheMode: "default" \}\)/);

console.log("Service Worker lifecycle checks passed: natural waiting, no reload, intent-only route prefetch.");
