#!/usr/bin/env node
"use strict";

const { codeAssertDoesNotMatch, codeAssertMatch, codeIndexOf, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const loadScript = require("./lib/load-script.js"); // scripts construits comme app.js (lot B)

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const css = read("public/assets/css/styles.css");
const home = read("public/index.html");
const homeCatalog = read("public/assets/js/home-catalog.js");
const spaRenderer = read("public/assets/js/spa-renderer.js");
const audioTelemetry = read("public/assets/js/audio-telemetry.js");
const transport = loadScript.sourceText("public/assets/js/transport-ui.js");
const scripts = require("./build/app-sources.js").runtimeSource(); // scripts.js + modules runtime/
const audioRadio = loadScript.sourceText("public/assets/js/audio-radio.js");
const albumPlayerUi = read("public/assets/js/album-player-ui.js");

const genericMobileGridAt = codeIndexOf(css, "@media (max-width: 560px)");
const standaloneGridAt = codeIndexOf(css, "@media (max-width: 980px) and (display-mode: standalone)");
assert(genericMobileGridAt >= 0 && standaloneGridAt > genericMobileGridAt, "standalone geometry must override generic mobile CSS before JS");
codeAssertMatch(css.slice(standaloneGridAt), /\.home-screen \.albums-grid\s*\{\s*grid-template-columns: 1fr;/);

const albumImages = [...home.matchAll(/<img class="album-thumb album-cover"[^>]+>/g)].map((match) => match[0]);
assert.equal(albumImages.filter((tag) => codeTest(/\ssrc="/, tag)).length, 2, "only two Home covers may load eagerly");
assert.equal(albumImages.filter((tag) => codeTest(/loading="eager"/, tag)).length, 2);
assert.equal(albumImages.filter((tag) => codeTest(/fetchpriority="high"/, tag)).length, 1);
assert.equal(albumImages.filter((tag) => codeTest(/fetchpriority="auto"/, tag)).length, 1);
assert.equal(albumImages.filter((tag) => codeTest(/data-cover-src="/, tag)).length, albumImages.length - 2);

codeAssertMatch(homeCatalog, /const eagerCount = isApp \? 0 : 2;/);
codeAssertMatch(homeCatalog, /image\.dataset\.appCoverSrc = thumb/);
codeAssertMatch(homeCatalog, /menu\.addEventListener\("toggle", loadApps\)/);
codeAssertMatch(homeCatalog, /image\.decode\(\)\.then\(reveal\)/);
codeAssertMatch(homeCatalog, /const source = resolveRuntimeAssetUrl\(image && image\.dataset && image\.dataset\[sourceAttribute\]\)/);
codeAssertMatch(homeCatalog, /const thumb = resolveRuntimeAssetUrl\(item\.thumb\)/);
codeAssertMatch(homeCatalog, /const srcset = resolveRuntimeSrcset\(image\.dataset\[srcsetAttribute\]\)/);
codeAssertMatch(homeCatalog, /if \(sourceAttribute === "appCoverSrc"\) image\.loading = "eager"/);
codeAssertMatch(scripts, /trackAudioRuntimeEvent,\s*toRuntimeAbsoluteUrl/);
codeAssertMatch(scripts, /normalizeCoverUrl\(toRuntimeAbsoluteUrl\(raw\), \{ width: 1200 \}\)/);
codeAssertMatch(spaRenderer, /querySelectorAll\("\[data-cover-src\], \[data-app-cover-src\]"\)/);
codeAssertMatch(spaRenderer, /querySelectorAll\("\[data-cover-srcset\], \[data-app-cover-srcset\]"\)/);
codeAssertDoesNotMatch(homeCatalog, /shouldEager \|\| isApp/);

const restoreStart = codeIndexOf(spaRenderer, "async function restoreLiveHomeRoute");
const restoreEnd = codeIndexOf(spaRenderer, "async function renderSpaDocument", restoreStart);
const restoreSource = spaRenderer.slice(restoreStart, restoreEnd);
codeAssertMatch(restoreSource, /retainedHome\.setAttribute\("data-spa-route-state", "current"\)/);
codeAssertMatch(restoreSource, /resumeLiveHomeRoute\(\);\s*window\.scrollTo\(requested\.x, requested\.y\);/);
codeAssertMatch(restoreSource, /anchorCorrection = Math\.round\(anchor\.getBoundingClientRect\(\)\.top - route\.anchorViewportTop\)/);
codeAssertMatch(restoreSource, /outgoing\.remove\(\)/);
// Pas de « Chargement du fichier audio... » sous le titre choisi (INFRA, 09/11/2026) ; l'échec avec « réessayer » reste.
codeAssertMatch(scripts, /if \(message && !opts\.retry && \/\^Chargement du fichier audio\/\.test\(message\)\) message = "";/);
// Retour sans trame blanche (INFRA, 09/11/2026) : la page quittée reste par-dessus puis s'efface.
codeAssertMatch(restoreSource, /outgoing\.setAttribute\("data-spa-route-state", "covering"\)/);
codeAssertMatch(restoreSource, /nextSpaAnimationFrame\(\)\.then\(nextSpaAnimationFrame\)/);
codeAssertDoesNotMatch(restoreSource, /"retiring"/);
{
  const bibCss = read("public/assets/css/styles.css");
  codeAssertMatch(bibCss, /data-spa-route-state="covering"/);
  // Zone de l'heure de l'app installée : onglets sous l'heure, voile sur l'heure.
  codeAssertMatch(bibCss, /\.bib-tabs \{\s*position: sticky;\s*top: env\(safe-area-inset-top, 0px\);/);
  codeAssertMatch(bibCss, /body::after \{[^}]*height: env\(safe-area-inset-top, 0px\);/);
}

const mobileSpaceStart = codeIndexOf(transport, "function syncMobilePlayerSpace");
const mobileSpaceEnd = codeIndexOf(transport, "function getMiniPlayerVisibilityReason", mobileSpaceStart);
const mobileSpaceSource = transport.slice(mobileSpaceStart, mobileSpaceEnd);
codeAssertDoesNotMatch(mobileSpaceSource, /getBoundingClientRect|getComputedStyle/);
codeAssertMatch(transport, /new window\.ResizeObserver/);
codeAssertMatch(transport, /if \(nextSpace === mobilePlayerSpaceValue\) return;/);

codeAssertMatch(scripts, /function scheduleFinalLaunchSummary\(state\)/);
codeAssertMatch(scripts, /finalize\("visibility_hidden", true\)/);
codeAssertMatch(scripts, /finalize\("pagehide", true\)/);
codeAssertMatch(scripts, /finalize\("vitals_timeout", false\)/);
codeAssertMatch(scripts, /Math\.max\(0, 10000 - elapsed\)/);
codeAssertMatch(scripts, /markLaunchWatchdogComplete\(probe\);\s*scheduleFinalLaunchSummary/);
codeAssertDoesNotMatch(scripts, /function completeLaunchWatchdog/);

codeAssertMatch(spaRenderer, /routeHost\.appendChild\(destinationRoute\)/);
codeAssertMatch(spaRenderer, /return finish\("atomic_swap"\)/);
codeAssertMatch(spaRenderer, /handoff_strategy: mode === "view_transition" \? "native_view_transition" : "connected_route_stack"/);
codeAssertMatch(spaRenderer, /connected_home_retained:/);
codeAssertMatch(css, /data-spa-route-state="retained"/);
codeAssertMatch(css, /opacity: 0;/);
codeAssertDoesNotMatch(spaRenderer, /applyPaintedHandoff|painted_handoff|dual_route/);
codeAssertDoesNotMatch(css, /\.spa-route-layer\.is-staged|\.spa-route-layer\.is-retained-source/);
codeAssertMatch(spaRenderer, /trackSpaVisualReady\(cachedCompletionTelemetry, cachedRenderStartedAt\);\s*await hydrateSpaRoute\(cachedCompletionTelemetry\);/);
codeAssertMatch(spaRenderer, /trackSpaVisualReady\(completionTelemetry, renderStartedAt\);\s*await hydrateSpaRoute\(completionTelemetry\);/);
codeAssertMatch(audioTelemetry, /"spa_hydration_done"/);
codeAssertMatch(audioTelemetry, /transition\.hydration_ms = Math\.round/);
codeAssertMatch(audioTelemetry, /hydration_ms: transition\.hydration_ms \|\| 0/);
codeAssertMatch(spaRenderer, /const pwaCoverMode = isCompactCoverNavigation\(\);/);
codeAssertMatch(spaRenderer, /const timeoutMs = 0;/);
codeAssertMatch(spaRenderer, /const animateEntry = false;/);
codeAssertMatch(audioRadio + spaRenderer, /startSelectedTrackInRadioFromCold/);
codeAssertMatch(audioRadio, /surface: "global_cold_radio"/);
codeAssertMatch(audioRadio, /"album_button_cold_radio"/);
codeAssertMatch(audioRadio, /surface: "global_dom_cold_radio"/);
codeAssertMatch(audioRadio, /ensureRadioPlaylistLoaded\(\)\.then/);
codeAssertMatch(albumPlayerUi, /\.spa-route-layer\.album-screen\[data-spa-route-state='current'\]/);
codeAssertMatch(scripts, /\.spa-route-layer\.album-screen\[data-spa-route-state='current'\]/);
codeAssertDoesNotMatch(albumPlayerUi, /querySelector\("\.album-layout h1, \.album-hero h1, main h1, h1"\)/);
codeAssertDoesNotMatch(css, /\[data-cover-loading="1"\][\s\S]{0,120}visibility:\s*hidden/);

console.log("Fluidity contracts passed: connected Home, decoded destination cover, exact scroll and cold Radio.");
