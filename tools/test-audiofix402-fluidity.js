#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const css = read("public/assets/css/styles.css");
const home = read("public/index.html");
const homeCatalog = read("public/assets/js/home-catalog.js");
const spaRenderer = read("public/assets/js/spa-renderer.js");
const audioTelemetry = read("public/assets/js/audio-telemetry.js");
const transport = read("public/assets/js/transport-ui.js");
const scripts = read("public/assets/js/scripts.js");

const genericMobileGridAt = css.indexOf("@media (max-width: 560px)");
const standaloneGridAt = css.indexOf("@media (max-width: 980px) and (display-mode: standalone)");
assert(genericMobileGridAt >= 0 && standaloneGridAt > genericMobileGridAt, "standalone geometry must override generic mobile CSS before JS");
assert.match(css.slice(standaloneGridAt), /\.home-screen \.albums-grid\s*\{\s*grid-template-columns: 1fr;/);

const albumImages = [...home.matchAll(/<img class="album-thumb album-cover"[^>]+>/g)].map((match) => match[0]);
assert.equal(albumImages.filter((tag) => /\ssrc="/.test(tag)).length, 2, "only two Home covers may load eagerly");
assert.equal(albumImages.filter((tag) => /loading="eager"/.test(tag)).length, 2);
assert.equal(albumImages.filter((tag) => /fetchpriority="high"/.test(tag)).length, 1);
assert.equal(albumImages.filter((tag) => /fetchpriority="auto"/.test(tag)).length, 1);
assert.equal(albumImages.filter((tag) => /data-cover-src="/.test(tag)).length, albumImages.length - 2);

assert.match(homeCatalog, /const eagerCount = isApp \? 0 : 2;/);
assert.match(homeCatalog, /image\.dataset\.appCoverSrc = thumb/);
assert.match(homeCatalog, /menu\.addEventListener\("toggle", loadApps\)/);
assert.match(homeCatalog, /image\.decode\(\)\.then\(reveal\)/);
assert.match(homeCatalog, /const source = resolveRuntimeAssetUrl\(image && image\.dataset && image\.dataset\[sourceAttribute\]\)/);
assert.match(homeCatalog, /const thumb = resolveRuntimeAssetUrl\(item\.thumb\)/);
assert.match(homeCatalog, /const srcset = resolveRuntimeSrcset\(image\.dataset\[srcsetAttribute\]\)/);
assert.match(homeCatalog, /if \(sourceAttribute === "appCoverSrc"\) image\.loading = "eager"/);
assert.match(scripts, /trackAudioRuntimeEvent,\s*toRuntimeAbsoluteUrl/);
assert.match(scripts, /normalizeCoverUrl\(toRuntimeAbsoluteUrl\(raw\), \{ width: 1200 \}\)/);
assert.match(spaRenderer, /querySelectorAll\("\[data-cover-src\], \[data-app-cover-src\]"\)/);
assert.match(spaRenderer, /querySelectorAll\("\[data-cover-srcset\], \[data-app-cover-srcset\]"\)/);
assert.doesNotMatch(homeCatalog, /shouldEager \|\| isApp/);

const restoreStart = spaRenderer.indexOf("async function restoreLiveHomeRoute");
const restoreEnd = spaRenderer.indexOf("async function renderSpaDocument", restoreStart);
const restoreSource = spaRenderer.slice(restoreStart, restoreEnd);
assert.match(
  restoreSource,
  /resumeLiveHomeRoute\(\);\s*await nextSpaAnimationFrame\(\);\s*window\.scrollTo\(requested\.x, requested\.y\);\s*await nextSpaAnimationFrame\(\);[\s\S]*?saveCurrentScrollPositionInHistory\(\);/,
  "the Home anchor correction must run after final route geometry"
);

const mobileSpaceStart = transport.indexOf("function syncMobilePlayerSpace");
const mobileSpaceEnd = transport.indexOf("function getMiniPlayerVisibilityReason", mobileSpaceStart);
const mobileSpaceSource = transport.slice(mobileSpaceStart, mobileSpaceEnd);
assert.doesNotMatch(mobileSpaceSource, /getBoundingClientRect|getComputedStyle/);
assert.match(transport, /new window\.ResizeObserver/);
assert.match(transport, /if \(nextSpace === mobilePlayerSpaceValue\) return;/);

assert.match(scripts, /function scheduleFinalLaunchSummary\(state\)/);
assert.match(scripts, /finalize\("visibility_hidden", true\)/);
assert.match(scripts, /finalize\("pagehide", true\)/);
assert.match(scripts, /finalize\("vitals_timeout", false\)/);
assert.match(scripts, /Math\.max\(0, 10000 - elapsed\)/);
assert.match(scripts, /markLaunchWatchdogComplete\(probe\);\s*scheduleFinalLaunchSummary/);
assert.doesNotMatch(scripts, /function completeLaunchWatchdog/);

assert.match(spaRenderer, /routeHost\.replaceChildren\(destinationRoute\)/);
assert.match(spaRenderer, /return finish\("atomic_swap"\)/);
assert.match(spaRenderer, /single_route_invariant: routeLayersAfterCommit === 1 && routeHostHasCurrent/);
assert.doesNotMatch(spaRenderer, /applyPaintedHandoff|painted_handoff|dual_route/);
assert.doesNotMatch(css, /\.spa-route-layer\.is-staged|\.spa-route-layer\.is-retained-source/);
assert.match(spaRenderer, /trackSpaVisualReady\(cachedCompletionTelemetry, cachedRenderStartedAt\);\s*await hydrateSpaRoute\(cachedCompletionTelemetry\);/);
assert.match(spaRenderer, /trackSpaVisualReady\(completionTelemetry, renderStartedAt\);\s*await hydrateSpaRoute\(completionTelemetry\);/);
assert.match(audioTelemetry, /"spa_hydration_done"/);
assert.match(audioTelemetry, /transition\.hydration_ms = Math\.round/);
assert.match(audioTelemetry, /hydration_ms: transition\.hydration_ms \|\| 0/);

console.log("audiofix402 fluidity contracts passed: atomic route, visual timing, hydration, covers, scroll and final vitals.");
