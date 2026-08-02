#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const transportPath = path.join(root, "public/assets/js/transport-ui.js");
const stylesPath = path.join(root, "public/assets/css/styles.css");
const scriptsPath = path.join(root, "public/assets/js/scripts.js");
const favoritesPath = path.join(root, "public/assets/js/favorites-ui.js");
const transportSource = fs.readFileSync(transportPath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");
const scriptsSource = fs.readFileSync(scriptsPath, "utf8");
const favoritesSource = fs.readFileSync(favoritesPath, "utf8");

function createClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
        return values.has(name);
      }
      if (force) values.add(name);
      else values.delete(name);
      return Boolean(force);
    }
  };
}

function createSandbox(requestWindow) {
  const documentElement = {
    clientWidth: 1440,
    clientHeight: 900,
    classList: createClassList(),
    style: { setProperty() {}, removeProperty() {} },
    getAttribute() { return "blanc"; },
    setAttribute() {}
  };
  const body = {
    classList: createClassList(),
    style: { setProperty() {}, removeProperty() {} }
  };
  const document = {
    body,
    documentElement,
    querySelectorAll() { return []; },
    getElementById() { return null; }
  };
  const window = {
    document,
    innerWidth: 1440,
    innerHeight: 900,
    documentPictureInPicture: requestWindow ? { requestWindow } : undefined,
    matchMedia(query) {
      return { matches: query.includes("min-width") };
    },
    setTimeout,
    clearTimeout,
    getComputedStyle() {
      return { getPropertyValue() { return ""; } };
    }
  };
  const sandbox = {
    window,
    document,
    console,
    Promise,
    Error,
    Map,
    Set,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    setTimeout,
    clearTimeout,
    Element: function Element() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(transportSource, sandbox, { filename: transportPath });
  return sandbox;
}

async function testFeatureDetectionAndSynchronousRequest() {
  let requestCalled = false;
  let requestedOptions = null;
  const sandbox = createSandbox(function (options) {
    requestCalled = true;
    requestedOptions = options;
    return Promise.reject(new Error("mock request rejected after activation check"));
  });
  const audioState = {
    audio: { paused: false, duration: 180, currentTime: 30 },
    playlist: [{ name: "LAVERNA", album: "V-23π56" }],
    currentIndex: 0,
    desktopTransportState: null,
    transport: null,
    transportPipOpen: false,
    transportPipOpening: false
  };
  const api = sandbox.window.InfraTransportUi.createTransportUi({
    audioState,
    hasPlaybackSession: () => true
  });

  assert.equal(api.isDocumentPictureInPictureSupported(), true);
  const requestPromise = api.requestTransportPictureInPicture({ trigger: "drag" });
  assert.equal(requestCalled, true, "requestWindow must run synchronously in the gesture stack");
  assert.deepEqual(
    JSON.parse(JSON.stringify(requestedOptions)),
    { width: 360, height: 180, disallowReturnToOpener: true },
    "cold compact transport should request a compact PiP viewport"
  );
  assert.equal(audioState.transportPipOpening, true);
  assert.equal(await requestPromise, false);
  assert.equal(audioState.transportPipOpening, false);
  assert.equal(audioState.transportPipOpen, false);

  const state = api.getDesktopTransportState();
  state.pictureInPicture.window = { closed: false };
  audioState.transportPipOpen = true;
  assert.equal(api.isTransportPictureInPictureOpen(), true);
  state.pictureInPicture.window.closed = true;
  assert.equal(api.isTransportPictureInPictureOpen(), false);
}

async function testUnsupportedBrowserIsNoOp() {
  const sandbox = createSandbox(null);
  const audioState = { desktopTransportState: null, transportPipOpen: false };
  const api = sandbox.window.InfraTransportUi.createTransportUi({
    audioState,
    hasPlaybackSession: () => true
  });
  assert.equal(api.isDocumentPictureInPictureSupported(), false);
  assert.equal(await api.requestTransportPictureInPicture({ trigger: "drag" }), false);
  assert.equal(audioState.transportPipOpen, false);
}

function testResponsivePictureInPictureLayouts() {
  const sandbox = createSandbox(function () {
    return Promise.reject(new Error("not used"));
  });
  const audioState = {
    audio: { paused: false, duration: 180, currentTime: 30 },
    playlist: [
      { name: "LAVERNA", album: "V-23π56" },
      { name: "ETRURIA", album: "V-23π56" }
    ],
    currentIndex: 0,
    desktopTransportState: null,
    transportPipOpen: true
  };
  const api = sandbox.window.InfraTransportUi.createTransportUi({
    audioState,
    hasPlaybackSession: () => true,
    getCurrentPlaylistTrack: () => audioState.playlist[audioState.currentIndex],
    getCurrentPlayableAudioSrc: () => "track.mp3"
  });
  const layoutClassList = createClassList();
  const pipWindow = { closed: false, innerWidth: 360, innerHeight: 180 };
  api.isTransportPictureInPictureOpen();
  const pipState = api.getDesktopTransportState().pictureInPicture;
  pipState.window = pipWindow;
  pipState.refs = {
    window: pipWindow,
    document: null,
    root: { classList: layoutClassList }
  };

  api.syncTransportPictureInPictureUi();
  assert.equal(layoutClassList.contains("is-compact"), true);
  assert.equal(layoutClassList.contains("is-narrow"), false);
  assert.equal(layoutClassList.contains("is-wide"), false);
  assert.equal(layoutClassList.contains("is-expanded"), false);

  pipWindow.innerWidth = 440;
  pipWindow.innerHeight = 210;
  api.syncTransportPictureInPictureUi();
  assert.equal(layoutClassList.contains("is-compact"), false);
  assert.equal(layoutClassList.contains("is-narrow"), true);
  assert.equal(layoutClassList.contains("is-wide"), false);
  assert.equal(layoutClassList.contains("is-expanded"), true);

  pipWindow.innerWidth = 560;
  pipWindow.innerHeight = 320;
  api.syncTransportPictureInPictureUi();
  assert.equal(layoutClassList.contains("is-compact"), false);
  assert.equal(layoutClassList.contains("is-narrow"), false);
  assert.equal(layoutClassList.contains("is-wide"), true);
  assert.equal(layoutClassList.contains("is-expanded"), true);
}

function testStaticContracts() {
  const pipBodyRule = stylesSource.match(/body\.transport-pip-document\s*\{([^}]*)\}/);
  const pipPlayerRule = stylesSource.match(
    /body\.transport-pip-document \.transport-pip-player\.global-transport\s*\{([^}]*)\}/
  );
  assert(pipBodyRule, "PiP document CSS rule is missing");
  assert(pipPlayerRule, "PiP player CSS rule is missing");
  assert.match(pipBodyRule[1], /padding:\s*0\s*;/, "PiP document must be full bleed");
  assert.match(pipPlayerRule[1], /padding:\s*14px\s*;/, "PiP content padding must remain internal");
  assert.match(pipPlayerRule[1], /border:\s*0\s*;/, "PiP player must not keep the card border");
  assert.match(pipPlayerRule[1], /border-radius:\s*0\s*;/, "PiP player must not keep rounded card corners");
  assert.match(pipPlayerRule[1], /box-shadow:\s*none\s*;/, "PiP player must not keep the card shadow");
  assert(transportSource.includes('window.addEventListener("pointerup", function (event) { finishRootGesture(event, false, true); })'));
  assert(transportSource.includes('root.addEventListener("lostpointercapture", function (event) { finishRootGesture(event, false, false); })'));
  assert(transportSource.includes("disallowReturnToOpener: true"));
  assert(transportSource.includes("background:var(--bg-start,#f4f4f4)"));
  assert(transportSource.includes('refs.root.classList.toggle("is-compact", compact)'));
  assert(transportSource.includes('refs.root.classList.toggle("is-narrow", narrow)'));
  assert(transportSource.includes('refs.root.classList.toggle("is-wide", wide)'));
  assert(transportSource.includes('viewport.width >= DESKTOP_TRANSPORT_COVER_MIN_WIDTH'));
  assert(transportSource.includes('viewport.height >= DESKTOP_TRANSPORT_COVER_MIN_HEIGHT'));
  assert(transportSource.includes('!audioState.transportPipOpen'));
  assert(transportSource.includes('pipWindow.addEventListener("pagehide"'));
  assert(transportSource.includes('pipWindow.addEventListener("resize", syncTransportPictureInPictureUi'));
  assert(transportSource.includes('getRuntimeAssetUrl("assets/css/styles.css" + query)'));
  assert(scriptsSource.includes("new URL(String(path || \"\"), runtime.baseUrl).href"));
  assert(stylesSource.includes("body.transport-pip-document .transport-pip-player.is-expanded"));
  assert(stylesSource.includes(".global-transport.is-pip-detach-armed"));
  assert(scriptsSource.includes("audioState.transportPipOpen ||"));
  assert(scriptsSource.includes("audioState.transportPipOpening"));
  assert(favoritesSource.includes("transport.pipFavorite"));
}

async function main() {
  await testFeatureDetectionAndSynchronousRequest();
  await testUnsupportedBrowserIsNoOp();
  testResponsivePictureInPictureLayouts();
  testStaticContracts();
  console.log("Transport Document PiP checks passed: gesture, fallback, lifecycle and responsive cover contracts.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
