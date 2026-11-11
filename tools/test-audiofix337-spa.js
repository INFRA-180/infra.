#!/usr/bin/env node
"use strict";

const { codeHas, codeIndexOf, codeMatch, codeSearch } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const loadScript = require("./lib/load-script.js"); // scripts construits comme app.js (lot B)
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SPA_PATH = path.join(ROOT, "src/js/spa-renderer.js");
const SCRIPTS_PATH = path.join(ROOT, "src/js/scripts.js");
const TRANSPORT_PATH = path.join(ROOT, "src/js/transport-ui.js");
const HOME_CATALOG_PATH = path.join(ROOT, "src/js/home-catalog.js");
const STYLES_PATH = path.join(ROOT, "public/assets/css/styles.css");
const spaSource = loadScript.sourceText(SPA_PATH);
const scriptsSource = require("./build/app-sources.js").runtimeSource();
const transportSource = loadScript.sourceText(TRANSPORT_PATH);
const homeCatalogSource = loadScript.sourceText(HOME_CATALOG_PATH);
const stylesSource = fs.readFileSync(STYLES_PATH, "utf8");

function loadSpaFactory(overrides) {
  const sandbox = Object.assign({
    URL,
    Promise,
    Set,
    Map,
    console: { log() {}, info() {}, warn() {}, error() {} }
  }, overrides || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  loadScript.runInContext(SPA_PATH, sandbox);
  return sandbox.InfraSpaRenderer.createSpaRenderer;
}

async function testRuntimeClassSanitizer() {
  const factory = loadSpaFactory();
  const api = factory({ spaState: {}, audioState: {} });
  assert.equal(
    api.sanitizeSpaBodyClassName(
      "home-screen has-mobile-player now-playing-open is-transport-interacting ios-device favorites-view-open custom"
    ),
    "home-screen custom",
    "SPA snapshots must retain structural classes only"
  );
  assert.ok(
    codeHas(spaSource, "sanitizeSpaSnapshotRuntimeState(clone)"),
    "snapshot HTML must sanitize stale runtime state"
  );
}

async function testIosSwapUsesSingleRouteAtomicCommit() {
  const swapFunctionStart = codeIndexOf(spaSource, "function swapSpaFragment");
  const atomicSwapStart = codeIndexOf(spaSource, "function applySwap()", swapFunctionStart);
  const atomicSwapEnd = codeIndexOf(spaSource, "function finish(mode)", atomicSwapStart);
  const atomicSwap = spaSource.slice(atomicSwapStart, atomicSwapEnd);
  const bodyIndex = codeIndexOf(atomicSwap, "document.body.className = bodyClassName");
  const beforeCountIndex = codeIndexOf(atomicSwap, "routeLayersBeforeCommit =");
  // Pile d'écrans (lot Nav-2, 11/11/2026) : l'écran quitté (accueil ou fiche) reste branché ; la page
  // affichée est posée en tête de l'hôte (premier élément du document pour le code des fiches).
  const retainIndex = codeIndexOf(atomicSwap, "if (retainSource)");
  const appendIndex = codeIndexOf(atomicSwap, "routeHost.insertBefore(destinationRoute, routeHost.firstChild)");
  const replaceIndex = codeIndexOf(atomicSwap, "routeHost.replaceChildren(destinationRoute)");
  const afterCountIndex = codeIndexOf(atomicSwap, "routeLayersAfterCommit =");
  const preserveIndex = codeIndexOf(atomicSwap, "preserveSourceRoute()");
  const prepaintSyncIndex = codeIndexOf(atomicSwap, "runPersistentUiPrepaintSync()");
  const scrollRestoreIndex = codeIndexOf(atomicSwap, "applyRequestedScroll()");
  assert.ok(atomicSwapStart >= 0 && atomicSwapEnd > atomicSwapStart, "atomic swap implementation is missing");
  assert.ok(bodyIndex >= 0 && bodyIndex < beforeCountIndex, "destination classes must be fixed before commit");
  assert.ok(
    beforeCountIndex < retainIndex && retainIndex < appendIndex && appendIndex < afterCountIndex,
    "the live Home route must remain connected while the album route is committed"
  );
  assert.ok(
    retainIndex < replaceIndex && replaceIndex < afterCountIndex,
    "non-Home routes must still use one measured replacement"
  );
  assert.ok(afterCountIndex < preserveIndex, "the retained Home route must be registered after the atomic commit");
  assert.ok(
    preserveIndex < prepaintSyncIndex && prepaintSyncIndex < scrollRestoreIndex,
    "the final iPhone/PWA geometry must settle before scroll restoration"
  );
  assert.ok(codeHas(spaSource, 'return finish("atomic_swap")'));
  assert.ok(codeHas(spaSource, '"connected_route_stack"'));
  assert.ok(codeHas(spaSource, "route_layers_before_commit"), "pre-commit route count is not measured");
  assert.ok(codeHas(spaSource, "route_layers_after_commit"), "post-commit route count is not measured");
  assert.ok(codeHas(spaSource, "single_route_invariant"), "the one-route invariant is not measured");
  assert.ok(!codeHas(spaSource, "applyPaintedHandoff"), "legacy dual-route handoff must be absent");
  assert.ok(!codeHas(spaSource, 'destinationRoute.classList.add("is-staged")'), "destination must never use a transparent staged layer");
  assert.ok(!codeHas(stylesSource, ".spa-route-layer.is-staged"), "staged route compositor CSS must be absent");
  assert.ok(
    codeHas(stylesSource, '[data-spa-route-state="retained"]'),
    "the connected Home route must stay paint-suppressed while the album is current"
  );
  assert.ok(!codeHas(stylesSource, "translate3d(0, var(--spa-route-offset-y"), "route swaps must not promote fixed GPU layers");
  const liveCaptureStart = codeIndexOf(spaSource, "function captureLiveHomeRoute");
  const liveCaptureEnd = codeIndexOf(spaSource, "function canRestoreLiveHomeRoute", liveCaptureStart);
  const liveCaptureBody = spaSource.slice(liveCaptureStart, liveCaptureEnd);
  assert.ok(
    codeHas(liveCaptureBody, "freezeLiveHomeResourceUrls(currentRoute"),
    "Home resource URLs must be frozen before navigation changes the document base URL"
  );
  const freezeStart = codeIndexOf(spaSource, "function freezeLiveHomeResourceUrls");
  const freezeEnd = codeIndexOf(spaSource, "function lockLiveHomeCover", freezeStart);
  const freezeBody = spaSource.slice(freezeStart, freezeEnd);
  assert.ok(
    codeHas(freezeBody, 'querySelectorAll("[data-cover-src], [data-app-cover-src]")') &&
      codeHas(freezeBody, 'element.setAttribute(attribute, normalizeUrlAgainstBase(value, baseUrl))') &&
      codeHas(freezeBody, 'querySelectorAll("[data-cover-srcset], [data-app-cover-srcset]")') &&
      codeHas(freezeBody, 'element.setAttribute(attribute, absolutizeSrcsetForBase(value, baseUrl))'),
    "deferred Home covers must be absolute before the album URL becomes the document base"
  );
  assert.ok(codeHas(spaSource, "route_host_has_current"), "the route host invariant is not measured");

  const spaDocuments = [
    path.join(ROOT, "public/index.html"),
    ...fs.readdirSync(path.join(ROOT, "public/music")).filter((name) => name.endsWith(".html")).map((name) => path.join(ROOT, "public/music", name)),
    ...fs.readdirSync(path.join(ROOT, "public/playlists")).filter((name) => name.endsWith(".html")).map((name) => path.join(ROOT, "public/playlists", name))
  ];
  spaDocuments.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(codeHas(html, 'id="infraSpaRouteHost"'), `${path.relative(ROOT, file)} lacks the stable route host`);
    assert.ok(codeHas(html, 'data-spa-route-state="current"'), `${path.relative(ROOT, file)} lacks a current route layer`);
  });
}

function testIosSwapDefaultsToSimpleAtomicMode() {
  const factory = loadSpaFactory({
    document: { documentElement: { classList: { toggle() {} } } },
    location: { href: "https://site.test/index.html" },
    sessionStorage: { getItem() { return ""; }, setItem() {} }
  });
  const api = factory({ spaState: {}, audioState: {} });
  assert.equal(api.getPwaSwapPolicy(), "simple", "iOS PWA swaps must default to the compositor-free path");
}

function testCoverSwapHasNoSnapshotOrSecondDecode() {
  assert.ok(
    !codeHas(scriptsSource, "pwa-home-return-hold") &&
      !codeHas(scriptsSource, 'document.createElement("canvas")'),
    "PWA Home restoration must not build a cloned cover/canvas overlay"
  );
  const waitStart = codeIndexOf(spaSource, "function waitForSpaAlbumCoverReady");
  const waitEnd = codeIndexOf(spaSource, "function getPaintImageState", waitStart);
  const waitBody = spaSource.slice(waitStart, waitEnd);
  assert.ok(waitStart >= 0 && waitEnd > waitStart, "album cover readiness function is missing");
  assert.ok(!codeHas(waitBody, "new Image()"), "destination cover must not be decoded through a detached duplicate");
  assert.ok(!codeHas(waitBody, "swapTargetAfterDecode"), "destination cover must not be reassigned after the route swap");
  assert.ok(
    codeHas(spaSource, 'image.setAttribute("decoding", "sync")') &&
      codeHas(scriptsSource, 'cover.setAttribute("decoding", "sync")'),
    "the route-critical album hero must decode synchronously for the destination paint"
  );
  assert.ok(
    codeHas(spaSource, "routeHost.replaceChildren(destinationRoute)") &&
      codeHas(spaSource, "return waitForSpaFirstPaint().then"),
    "the detached destination must commit atomically before the two post-commit probes"
  );
  assert.ok(
      codeHas(stylesSource, "html.pwa-swap-active body::before") &&
      codeHas(stylesSource, "background-color: var(--pwa-status-bg) !important") &&
      codeHas(stylesSource, "transition: none !important;") &&
      codeHas(stylesSource, "::view-transition-image-pair(root)") &&
      codeHas(stylesSource, "isolation: auto;"),
    "the swap paint lock and the native comparison path must neutralize compositor transitions"
  );
  assert.ok(codeHas(stylesSource, "aspect-ratio: 1 / 1;"), "album covers must reserve their square before decode");
  assert.ok(
    codeHas(waitBody, 'recordCacheObservation("cover", cached ? "hit" : "miss")'),
    "cover Cache Storage hit/miss must feed the compact session summary"
  );
  assert.ok(
    codeHas(homeCatalogSource, "reconcileHomeAlbumGrid") &&
      codeHas(homeCatalogSource, "if (reconcileHomeAlbumGrid(grid, albums)) return;"),
    "an existing Home album grid must be reconciled instead of cleared"
  );
}

function testFullscreenFinalizationAndSnapshotDedup() {
  const navigateStart = codeIndexOf(spaSource, "async function spaNavigate");
  const captureIndex = codeIndexOf(spaSource, "const liveHomeCapture = captureLiveHomeRoute", navigateStart);
  const disableIndex = codeIndexOf(spaSource, "disableNowPlayingOverlayUi();", navigateStart);
  const snapshotIndex = codeIndexOf(spaSource, "snapshotCurrentSpaPage(spaState.currentUrl", navigateStart);
  assert.ok(disableIndex > navigateStart, "spaNavigate must finalize an open fullscreen overlay");
  assert.ok(disableIndex < captureIndex, "fullscreen must close before live-home capture");
  assert.ok(disableIndex < snapshotIndex, "fullscreen must close before the route snapshot");

  const navigateBody = spaSource.slice(navigateStart, codeIndexOf(spaSource, "return {", navigateStart));
  const snapshotCalls = codeMatch(navigateBody, /snapshotCurrentSpaPage\(/g) || [];
  assert.equal(snapshotCalls.length, 1, "spaNavigate must keep only the pre-navigation snapshot");
}

function testVisibilityTelemetryIsTransitionOnly() {
  assert.ok(
    codeHas(transportSource, "if (wasHidden === nextHidden) return;"),
    "mini-player telemetry must be emitted only when hidden changes"
  );
  for (const field of [
    '"mini_player_visibility"',
    "state:",
    "reason:",
    "route_kind:",
    "visible:",
    "unexpected,",
    "navigation_active:",
    "fullscreen_open:",
    "has_playback_session:",
    "has_source:",
    "is_home:",
    "is_album:"
  ]) {
    assert.ok(codeHas(transportSource, field), `mini-player visibility telemetry is missing ${field}`);
  }
  assert.ok(
    codeHas(scriptsSource, "syncPersistentUiAfterSpaSwap") && codeHas(scriptsSource, "audioState.transport && audioState.transport.root"),
    "SPA prepaint sync must reuse the existing transport/audio nodes"
  );
  const prepaintSyncStart = codeIndexOf(scriptsSource, "function syncPersistentUiAfterSpaSwap");
  const prepaintSyncEnd = codeIndexOf(scriptsSource, "\n  }", prepaintSyncStart);
  const prepaintSyncBody = scriptsSource.slice(prepaintSyncStart, prepaintSyncEnd);
  assert.ok(codeHas(prepaintSyncBody, "syncPwaStatusColor();"), "SPA prepaint sync must refresh the destination status colour");
  assert.ok(
    codeIndexOf(prepaintSyncBody, "syncPwaStatusColor();") < codeIndexOf(prepaintSyncBody, "syncTransportUi();"),
    "destination status colour must sync before the persistent transport and first paint"
  );
}

function testWebKitHistoryQuotaGuard() {
  assert.ok(
    codeHas(scriptsSource, "SPA_SCROLL_HISTORY_DEBOUNCE_MS"),
    "scroll history writes must be debounced"
  );
  const scrollListenerStart = codeSearch(scriptsSource, /window\.addEventListener\(\n\s+"scroll"/); // indentation libre (modules, 10/11/2026)
  const scrollListenerEnd = codeIndexOf(scriptsSource, "spaState.scrollBound = true", scrollListenerStart);
  const scrollListener = scriptsSource.slice(scrollListenerStart, scrollListenerEnd);
  assert.ok(scrollListenerStart >= 0, "scroll history listener is missing");
  assert.ok(codeHas(scrollListener, "window.setTimeout"), "scroll history must use one trailing timer");
  assert.ok(!codeHas(scrollListener, "requestAnimationFrame"), "scroll history must not write at display-frame rate");
  assert.ok(codeHas(spaSource, 'commitNavigationHistory("client_cache")'), "cached album navigation lacks the safe history gate");
  assert.ok(codeHas(spaSource, 'fallbackToDocumentNavigation(`history_write_'), "history failures must fall back to a real document navigation");
  assert.ok(!codeHas(spaSource, "history.pushState("), "SPA renderer still calls pushState without the safe writer");
  assert.ok(!codeHas(spaSource, "history.replaceState("), "SPA renderer still calls replaceState without the safe writer");
}

function testStandaloneScrollbarPolicy() {
  assert.ok(
    codeHas(scriptsSource, 'document.documentElement.classList.toggle("pwa-standalone", isStandaloneDisplayMode())'),
    "legacy installed iOS mode must expose a root class for PWA-only styling"
  );
  assert.ok(codeHas(stylesSource, "@media (display-mode: standalone)"), "standalone display mode CSS is missing");
  assert.ok(codeHas(stylesSource, "html.pwa-standalone"), "legacy standalone CSS fallback is missing");
  assert.ok(codeHas(stylesSource, "scrollbar-width: none"), "the standard scrollbar suppression is missing");
  assert.ok(codeHas(stylesSource, "body::-webkit-scrollbar"), "the WebKit scrollbar suppression is missing");
  assert.ok(
    !codeHas(stylesSource, "html.pwa-standalone {\n  overflow: hidden") &&
      !codeHas(stylesSource, "@media (display-mode: standalone) {\n  html {\n    overflow: hidden"),
    "hiding the PWA scrollbar must never disable document scrolling"
  );
}

async function main() {
  await testRuntimeClassSanitizer();
  await testIosSwapUsesSingleRouteAtomicCommit();
  testIosSwapDefaultsToSimpleAtomicMode();
  testFullscreenFinalizationAndSnapshotDedup();
  testCoverSwapHasNoSnapshotOrSecondDecode();
  testVisibilityTelemetryIsTransitionOnly();
  testWebKitHistoryQuotaGuard();
  testStandaloneScrollbarPolicy();
  console.log("audiofix402 SPA/transport tests: ok");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
