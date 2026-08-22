#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SPA_PATH = path.join(ROOT, "public/assets/js/spa-renderer.js");
const SCRIPTS_PATH = path.join(ROOT, "public/assets/js/scripts.js");
const TRANSPORT_PATH = path.join(ROOT, "public/assets/js/transport-ui.js");
const HOME_CATALOG_PATH = path.join(ROOT, "public/assets/js/home-catalog.js");
const STYLES_PATH = path.join(ROOT, "public/assets/css/styles.css");
const spaSource = fs.readFileSync(SPA_PATH, "utf8");
const scriptsSource = fs.readFileSync(SCRIPTS_PATH, "utf8");
const transportSource = fs.readFileSync(TRANSPORT_PATH, "utf8");
const homeCatalogSource = fs.readFileSync(HOME_CATALOG_PATH, "utf8");
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
  vm.runInContext(spaSource, sandbox, { filename: SPA_PATH });
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
    spaSource.includes("sanitizeSpaSnapshotRuntimeState(clone)"),
    "snapshot HTML must sanitize stale runtime state"
  );
}

async function testIosSwapUsesNativePaintedHandoff() {
  const handoffStart = spaSource.indexOf("async function applyPaintedHandoff");
  const handoffEnd = spaSource.indexOf("function finish(mode)", handoffStart);
  const handoff = spaSource.slice(handoffStart, handoffEnd);
  assert.ok(handoffStart >= 0 && handoffEnd > handoffStart, "painted handoff implementation is missing");
  const stagedIndex = handoff.indexOf('destinationRoute.classList.add("is-staged")');
  const appendIndex = handoff.indexOf("routeHost.appendChild(destinationRoute)");
  const renderingIndex = handoff.indexOf("await waitForSpaRenderingOpportunity()");
  const retainedIndex = handoff.indexOf("sourceRetainedUntilPromote");
  const promoteIndex = handoff.indexOf('destinationRoute.classList.remove("is-staged")');
  const bodyIndex = handoff.indexOf("document.body.className = bodyClassName");
  const postPromoteFrameIndex = handoff.indexOf("await nextSpaAnimationFrame()");
  const detachIndex = handoff.indexOf("preserveOrRemoveSourceRoute()", postPromoteFrameIndex);
  assert.ok(stagedIndex >= 0 && stagedIndex < appendIndex, "destination must be staged before insertion");
  assert.ok(appendIndex < renderingIndex, "destination must be inserted before its rendering opportunity");
  assert.ok(renderingIndex < retainedIndex && retainedIndex < promoteIndex, "source must remain attached through staging");
  assert.ok(promoteIndex < bodyIndex, "destination must be promoted before the global route class changes");
  assert.ok(bodyIndex < postPromoteFrameIndex, "promoted destination needs a painted frame before cleanup");
  assert.ok(postPromoteFrameIndex < detachIndex, "source must detach only after destination promotion");
  assert.ok(spaSource.includes('handoff_strategy: mode === "painted_handoff" ? "dual_route" : ""'));
  assert.ok(spaSource.includes("SPA_ROUTE_THEME_PROPERTIES"), "route themes must be frozen during the painted handoff");
  assert.ok(spaSource.includes("freezeSpaRouteTheme(sourceRoute"), "the outgoing route theme is not frozen");
  assert.ok(spaSource.includes("freezeSpaRouteTheme(destinationRoute"), "the destination route theme is not frozen");
  assert.ok(spaSource.includes("clearSpaRouteTheme(destinationRoute)"), "temporary destination theme tokens are not cleaned up");
  const liveCaptureStart = spaSource.indexOf("function captureLiveHomeRoute");
  const liveCaptureEnd = spaSource.indexOf("function canRestoreLiveHomeRoute", liveCaptureStart);
  const liveCaptureBody = spaSource.slice(liveCaptureStart, liveCaptureEnd);
  assert.ok(
    liveCaptureBody.includes("freezeLiveHomeResourceUrls(currentRoute"),
    "Home resource URLs must be frozen before navigation changes the document base URL"
  );
  assert.ok(spaSource.includes("route_layers_at_promote"), "the promoted two-layer state is not measured");
  assert.ok(spaSource.includes("route_layers_after_detach"), "the post-handoff layer state is not measured");
  assert.ok(spaSource.includes("route_host_has_current"), "the route host invariant is not measured");

  const spaDocuments = [
    path.join(ROOT, "public/index.html"),
    ...fs.readdirSync(path.join(ROOT, "public/music")).filter((name) => name.endsWith(".html")).map((name) => path.join(ROOT, "public/music", name)),
    ...fs.readdirSync(path.join(ROOT, "public/playlists")).filter((name) => name.endsWith(".html")).map((name) => path.join(ROOT, "public/playlists", name))
  ];
  spaDocuments.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    assert.ok(html.includes('id="infraSpaRouteHost"'), `${path.relative(ROOT, file)} lacks the stable route host`);
    assert.ok(html.includes('data-spa-route-state="current"'), `${path.relative(ROOT, file)} lacks a current route layer`);
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
    !scriptsSource.includes("pwa-home-return-hold") &&
      !scriptsSource.includes('document.createElement("canvas")'),
    "PWA Home restoration must not build a cloned cover/canvas overlay"
  );
  const waitStart = spaSource.indexOf("function waitForSpaAlbumCoverReady");
  const waitEnd = spaSource.indexOf("function getPaintImageState", waitStart);
  const waitBody = spaSource.slice(waitStart, waitEnd);
  assert.ok(waitStart >= 0 && waitEnd > waitStart, "album cover readiness function is missing");
  assert.ok(!waitBody.includes("new Image()"), "destination cover must not be decoded through a detached duplicate");
  assert.ok(!waitBody.includes("swapTargetAfterDecode"), "destination cover must not be reassigned after the route swap");
  assert.ok(
    spaSource.includes('image.setAttribute("decoding", "sync")') &&
      scriptsSource.includes('cover.setAttribute("decoding", "sync")'),
    "the route-critical album hero must decode synchronously for the destination paint"
  );
  assert.ok(
    spaSource.includes("function waitForSpaRenderingOpportunity") &&
      spaSource.includes("await waitForSpaRenderingOpportunity()") &&
      spaSource.includes("await nextSpaAnimationFrame()"),
    "the destination needs a rendering opportunity and one promoted frame before source cleanup"
  );
  assert.ok(
      stylesSource.includes("html.pwa-swap-active body::before") &&
      stylesSource.includes("--spa-handoff-safety-bg") &&
      stylesSource.includes("transition: none !important;") &&
      stylesSource.includes("::view-transition-image-pair(root)") &&
      stylesSource.includes("isolation: auto;"),
    "the swap paint lock and the native comparison path must neutralize compositor transitions"
  );
  assert.ok(stylesSource.includes("aspect-ratio: 1 / 1;"), "album covers must reserve their square before decode");
  assert.ok(
    waitBody.includes('recordCacheObservation("cover", cached ? "hit" : "miss")'),
    "cover Cache Storage hit/miss must feed the compact session summary"
  );
  assert.ok(
    homeCatalogSource.includes("reconcileHomeAlbumGrid") &&
      homeCatalogSource.includes("if (reconcileHomeAlbumGrid(grid, albums)) return;"),
    "an existing Home album grid must be reconciled instead of cleared"
  );
}

function testFullscreenFinalizationAndSnapshotDedup() {
  const navigateStart = spaSource.indexOf("async function spaNavigate");
  const captureIndex = spaSource.indexOf("const liveHomeCapture = captureLiveHomeRoute", navigateStart);
  const disableIndex = spaSource.indexOf("disableNowPlayingOverlayUi();", navigateStart);
  const snapshotIndex = spaSource.indexOf("snapshotCurrentSpaPage(spaState.currentUrl", navigateStart);
  assert.ok(disableIndex > navigateStart, "spaNavigate must finalize an open fullscreen overlay");
  assert.ok(disableIndex < captureIndex, "fullscreen must close before live-home capture");
  assert.ok(disableIndex < snapshotIndex, "fullscreen must close before the route snapshot");

  const navigateBody = spaSource.slice(navigateStart, spaSource.indexOf("return {", navigateStart));
  const snapshotCalls = navigateBody.match(/snapshotCurrentSpaPage\(/g) || [];
  assert.equal(snapshotCalls.length, 1, "spaNavigate must keep only the pre-navigation snapshot");
}

function testVisibilityTelemetryIsTransitionOnly() {
  assert.ok(
    transportSource.includes("if (wasHidden === nextHidden) return;"),
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
    assert.ok(transportSource.includes(field), `mini-player visibility telemetry is missing ${field}`);
  }
  assert.ok(
    scriptsSource.includes("syncPersistentUiAfterSpaSwap") && scriptsSource.includes("audioState.transport && audioState.transport.root"),
    "SPA prepaint sync must reuse the existing transport/audio nodes"
  );
  const prepaintSyncStart = scriptsSource.indexOf("function syncPersistentUiAfterSpaSwap");
  const prepaintSyncEnd = scriptsSource.indexOf("\n  }", prepaintSyncStart);
  const prepaintSyncBody = scriptsSource.slice(prepaintSyncStart, prepaintSyncEnd);
  assert.ok(prepaintSyncBody.includes("syncPwaStatusColor();"), "SPA prepaint sync must refresh the destination status colour");
  assert.ok(
    prepaintSyncBody.indexOf("syncPwaStatusColor();") < prepaintSyncBody.indexOf("syncTransportUi();"),
    "destination status colour must sync before the persistent transport and first paint"
  );
}

function testWebKitHistoryQuotaGuard() {
  assert.ok(
    scriptsSource.includes("SPA_SCROLL_HISTORY_DEBOUNCE_MS"),
    "scroll history writes must be debounced"
  );
  const scrollListenerStart = scriptsSource.indexOf('window.addEventListener(\n        "scroll"');
  const scrollListenerEnd = scriptsSource.indexOf("spaState.scrollBound = true", scrollListenerStart);
  const scrollListener = scriptsSource.slice(scrollListenerStart, scrollListenerEnd);
  assert.ok(scrollListenerStart >= 0, "scroll history listener is missing");
  assert.ok(scrollListener.includes("window.setTimeout"), "scroll history must use one trailing timer");
  assert.ok(!scrollListener.includes("requestAnimationFrame"), "scroll history must not write at display-frame rate");
  assert.ok(spaSource.includes('commitNavigationHistory("client_cache")'), "cached album navigation lacks the safe history gate");
  assert.ok(spaSource.includes('fallbackToDocumentNavigation(`history_write_'), "history failures must fall back to a real document navigation");
  assert.ok(!spaSource.includes("history.pushState("), "SPA renderer still calls pushState without the safe writer");
  assert.ok(!spaSource.includes("history.replaceState("), "SPA renderer still calls replaceState without the safe writer");
}

async function main() {
  await testRuntimeClassSanitizer();
  await testIosSwapUsesNativePaintedHandoff();
  testIosSwapDefaultsToSimpleAtomicMode();
  testFullscreenFinalizationAndSnapshotDedup();
  testCoverSwapHasNoSnapshotOrSecondDecode();
  testVisibilityTelemetryIsTransitionOnly();
  testWebKitHistoryQuotaGuard();
  console.log("audiofix396 SPA/transport tests: ok");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
