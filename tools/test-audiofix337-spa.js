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
  const order = [];
  let viewTransitionCalls = 0;
  const classNames = new Set();
  const persistRoot = { id: "infraSpaPersist" };
  let body = null;
  const oldNode = {
    remove() {
      order.push("remove_old");
      body.childNodes = body.childNodes.filter((node) => node !== oldNode);
      body.firstChild = body.childNodes[0] || null;
    }
  };
  body = {
    childNodes: [persistRoot, oldNode],
    firstChild: persistRoot,
    className: "home-screen",
    appendChild(node) {
      order.push("append_fragment");
      this.childNodes.push(node);
      this.firstChild = this.childNodes[0] || null;
      return node;
    },
    insertBefore(node) {
      order.push("insert_persist");
      this.childNodes = this.childNodes.filter((entry) => entry !== node);
      this.childNodes.unshift(node);
      this.firstChild = node;
    }
  };
  const document = {
    body,
    documentElement: {
      classList: {
        add(name) { classNames.add(name); },
        remove(name) { classNames.delete(name); }
      }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    startViewTransition(callback) {
      viewTransitionCalls += 1;
      callback();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve()
      };
    }
  };
  const spaState = { prepaintSyncActive: false };
  const sandbox = {
    document,
    location: { href: "https://site.test/index.html?pwa-swap=view" },
    innerWidth: 390,
    innerHeight: 844,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    requestAnimationFrame(callback) {
      order.push("raf");
      callback();
      return 1;
    },
    getComputedStyle() { return { opacity: "1" }; },
    scrollTo() {},
    scrollBy() {},
    setTimeout,
    clearTimeout
  };
  const factory = loadSpaFactory(sandbox);
  const api = factory({
    spaState,
    audioState: {},
    isStandaloneDisplayMode() { return true; },
    isIosDevice() { return true; },
    isAndroidDevice() { return false; },
    syncPersistentUiAfterSpaSwap() {
      assert.equal(spaState.prepaintSyncActive, true, "prepaint sync flag must wrap persistent UI reconciliation");
      assert.equal(body.className, "album-screen", "destination body class must exist before transport sync");
      assert.ok(body.childNodes.includes(persistRoot), "persistent root must survive the swap");
      order.push("sync_persistent_ui");
    },
    getAudioTelemetryNow() { return Date.now(); }
  });
  const fragment = { querySelector() { return null; } };
  await api.swapSpaFragment(fragment, "album-screen", persistRoot, {});

  assert.equal(viewTransitionCalls, 1, "iOS standalone must use the feature-detected native painted handoff");
  assert.equal(classNames.has("pwa-swap-active"), false, "the paint lock must clear after the measured frames");
  assert.equal(spaState.prepaintSyncActive, false, "prepaint sync flag must be cleared after reconciliation");
  assert.ok(
    order.indexOf("append_fragment") < order.indexOf("sync_persistent_ui"),
    "persistent UI sync must follow the destination DOM mutation"
  );
  assert.ok(
    order.indexOf("append_fragment") < order.indexOf("remove_old"),
    "destination DOM must be inserted before the previous route is detached"
  );
  const syncIndex = order.indexOf("sync_persistent_ui");
  assert.ok(order.slice(syncIndex + 1).includes("raf"), "persistent UI must sync before the first-paint RAF pair");
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
    spaSource.includes("function applySpaScrollOnNextFrame") &&
      !spaSource.slice(
        spaSource.indexOf("function applySwap()"),
        spaSource.indexOf("function finish(mode)")
      ).includes("window.scrollTo("),
    "route scrolling must be separated from the DOM mutation by a frame"
  );
  assert.ok(
    stylesSource.includes("html.pwa-swap-active body::before") &&
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
  console.log("audiofix389 SPA/transport tests: ok");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
