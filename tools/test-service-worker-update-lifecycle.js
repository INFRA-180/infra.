#!/usr/bin/env node
"use strict";

const { codeAssertDoesNotMatch, codeAssertMatch, codeMatch, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const loadScript = require("./lib/load-script.js"); // scripts construits comme app.js (lot B)

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const scripts = require("./build/app-sources.js").runtimeSource();
const worker = read("public/sw.js");
const audioRadio = loadScript.sourceText("src/js/audio-radio.js");
const nowPlaying = read("src/js/now-playing.js");
const runtime = [scripts, worker, audioRadio, nowPlaying].join("\n");

// INFRA 08/11/2026 : l'iPhone ne fermait jamais la PWA, la nouvelle version attendait sans fin.
// Une seule exception à l'attente naturelle : la page la demande, visible et sans lecture, puis recharge.
codeAssertDoesNotMatch(runtime, /SKIP_WAITING/, "no unconditional skip-waiting message");
assert.equal((codeMatch(worker, /skipWaiting\s*\(/g) || []).length, 1, "the worker skips waiting only on the idle request");
codeAssertMatch(worker, /INFRA_SW_ACTIVATE_IDLE[\s\S]{0,80}self\.skipWaiting\(\)/);
assert.equal((codeMatch(runtime, /window\.location\.reload\s*\(/g) || []).length, 1, "a single guarded reload");
codeAssertMatch(scripts, /if \(!serviceWorkerIdleUpdateRequested\) return;\s*if \(isBusyForServiceWorkerUpdate\(\)\) return;\s*window\.location\.reload\(\);/);
codeAssertMatch(scripts, /if \(audio && !audio\.paused && !audio\.ended\) return true;/, "never update while audio plays");
codeAssertDoesNotMatch(runtime, /SERVICE_WORKER_RELOAD_|attemptDeferredServiceWorkerReload|scheduleDeferredServiceWorkerReload/);
codeAssertDoesNotMatch(runtime, /sw_reload_pending|sw_reload_executed/, "audiofix402 must not emit reload events");

codeAssertMatch(scripts, /\.register\(swUrl, \{ scope: runtime\.baseUrl\.pathname, updateViaCache: "none" \}\)/);
codeAssertMatch(scripts, /serviceWorkerRegistrationRef\.update\(\)\.catch/);
// Chaque écoute « controllerchange » est examinée seule (formatage libre, 10/11/2026).
assert.ok(
  scripts
    .split('addEventListener("controllerchange", function () {')
    .slice(1)
    .map((block) => block.split("addEventListener(")[0])
    .some((block) =>
      codeTest(/requestActiveServiceWorkerVersion[\s\S]*?trackAudioRuntimeEvent\(\s*"sw_controllerchange"[\s\S]*?strategy: "natural_lifecycle"/, block)
    ),
  "controllerchange must only observe the naturally activated worker"
);
codeAssertMatch(worker, /self\.addEventListener\("install", \(event\) => \{\s*event\.waitUntil\(installShellCache\(\)\);\s*\}\);/);
codeAssertMatch(worker, /self\.addEventListener\("activate"[\s\S]*?await self\.clients\.claim\(\);/);
codeAssertDoesNotMatch(scripts, /function scheduleSpaPagePrefetch|function scheduleSpaAlbumShellWarmup/);
codeAssertMatch(scripts, /document\.addEventListener\("pointerdown", prefetchFromLinkIntent/);
codeAssertMatch(scripts, /prefetchSpaPage\(url\.href, \{ cacheMode: "default" \}\)/);

console.log("Service Worker lifecycle checks passed: natural waiting, idle-only activation and single reload, intent-only route prefetch.");
