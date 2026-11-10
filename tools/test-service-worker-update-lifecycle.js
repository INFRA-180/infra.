#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const scripts = require("./build/app-sources.js").runtimeSource();
const worker = read("public/sw.js");
const audioRadio = read("public/assets/js/audio-radio.js");
const nowPlaying = read("public/assets/js/now-playing.js");
const runtime = [scripts, worker, audioRadio, nowPlaying].join("\n");

// INFRA 08/11/2026 : l'iPhone ne fermait jamais la PWA, la nouvelle version attendait sans fin.
// Une seule exception à l'attente naturelle : la page la demande, visible et sans lecture, puis recharge.
assert.doesNotMatch(runtime, /SKIP_WAITING/, "no unconditional skip-waiting message");
assert.equal((worker.match(/skipWaiting\s*\(/g) || []).length, 1, "the worker skips waiting only on the idle request");
assert.match(worker, /INFRA_SW_ACTIVATE_IDLE[\s\S]{0,80}self\.skipWaiting\(\)/);
assert.equal((runtime.match(/window\.location\.reload\s*\(/g) || []).length, 1, "a single guarded reload");
assert.match(scripts, /if \(!serviceWorkerIdleUpdateRequested\) return;\s*if \(isBusyForServiceWorkerUpdate\(\)\) return;\s*window\.location\.reload\(\);/);
assert.match(scripts, /if \(audio && !audio\.paused && !audio\.ended\) return true;/, "never update while audio plays");
assert.doesNotMatch(runtime, /SERVICE_WORKER_RELOAD_|attemptDeferredServiceWorkerReload|scheduleDeferredServiceWorkerReload/);
assert.doesNotMatch(runtime, /sw_reload_pending|sw_reload_executed/, "audiofix402 must not emit reload events");

assert.match(scripts, /\.register\(swUrl, \{ scope: runtime\.baseUrl\.pathname, updateViaCache: "none" \}\)/);
assert.match(scripts, /serviceWorkerRegistrationRef\.update\(\)\.catch/);
// Chaque écoute « controllerchange » est examinée seule (formatage libre, 10/11/2026).
assert.ok(
  scripts
    .split('addEventListener("controllerchange", function () {')
    .slice(1)
    .map((block) => block.split("addEventListener(")[0])
    .some((block) =>
      /requestActiveServiceWorkerVersion[\s\S]*?trackAudioRuntimeEvent\(\s*"sw_controllerchange"[\s\S]*?strategy: "natural_lifecycle"/.test(block)
    ),
  "controllerchange must only observe the naturally activated worker"
);
assert.match(worker, /self\.addEventListener\("install", \(event\) => \{\s*event\.waitUntil\(installShellCache\(\)\);\s*\}\);/);
assert.match(worker, /self\.addEventListener\("activate"[\s\S]*?await self\.clients\.claim\(\);/);
assert.doesNotMatch(scripts, /function scheduleSpaPagePrefetch|function scheduleSpaAlbumShellWarmup/);
assert.match(scripts, /document\.addEventListener\("pointerdown", prefetchFromLinkIntent/);
assert.match(scripts, /prefetchSpaPage\(url\.href, \{ cacheMode: "default" \}\)/);

console.log("Service Worker lifecycle checks passed: natural waiting, idle-only activation and single reload, intent-only route prefetch.");
