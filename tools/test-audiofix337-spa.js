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
const spaSource = fs.readFileSync(SPA_PATH, "utf8");
const scriptsSource = fs.readFileSync(SCRIPTS_PATH, "utf8");
const transportSource = fs.readFileSync(TRANSPORT_PATH, "utf8");

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

async function testIosSwapIsAtomicWithoutNativeTransition() {
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
    startViewTransition() {
      viewTransitionCalls += 1;
      throw new Error("iOS standalone must not enter native View Transition");
    }
  };
  const spaState = { prepaintSyncActive: false };
  const sandbox = {
    document,
    location: { href: "https://site.test/index.html" },
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

  assert.equal(viewTransitionCalls, 0, "iOS standalone must use the RAF swap, not document.startViewTransition");
  assert.equal(spaState.prepaintSyncActive, false, "prepaint sync flag must be cleared after reconciliation");
  assert.ok(
    order.indexOf("append_fragment") < order.indexOf("sync_persistent_ui"),
    "persistent UI sync must follow the destination DOM mutation"
  );
  const syncIndex = order.indexOf("sync_persistent_ui");
  assert.ok(order.slice(syncIndex + 1).includes("raf"), "persistent UI must sync before the first-paint RAF pair");
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

async function main() {
  await testRuntimeClassSanitizer();
  await testIosSwapIsAtomicWithoutNativeTransition();
  testFullscreenFinalizationAndSnapshotDedup();
  testVisibilityTelemetryIsTransitionOnly();
  console.log("audiofix341 SPA/transport tests: ok");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
