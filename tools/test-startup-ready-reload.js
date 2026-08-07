#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../public/assets/js/scripts.js"),
  "utf8"
);

assert.match(source, /let startupReady = false;/);
assert.match(
  source,
  /function attemptDeferredServiceWorkerReload\(\)[\s\S]*?if \(!startupReady\) return;/,
  "an early controllerchange can still reload during startup"
);
assert.match(
  source,
  /function scheduleDeferredServiceWorkerReload\(delayMs\)[\s\S]*?if \(!startupReady\) return;/,
  "the reload scheduler must retain the pending flag until startup is ready"
);
assert.match(
  source,
  /await nextApplicationFrames\(\);\s*startupReady = true;\s*if \(serviceWorkerControllerReloadPending\) scheduleDeferredServiceWorkerReload\(\);/,
  "startupReady must be released only after the two application frames"
);
assert.match(
  source,
  /controllerchange[\s\S]*?markServiceWorkerReloadPendingForRuntime\(\)[\s\S]*?scheduleDeferredServiceWorkerReload\(\)/,
  "controllerchange must remain pending for the post-startup scheduler"
);

console.log("Startup reload guard checks passed: controllerchange stays pending through two app frames.");
