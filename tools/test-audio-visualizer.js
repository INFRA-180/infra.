#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public/assets/js/audio-visualizer.js"), "utf8");
const envelope = Buffer.alloc(256, 180).toString("base64");
const mediaListeners = new Map();
let requestedAnimationFrame = null;
let cancelledFrames = 0;
let fetchCount = 0;
let strokeCount = 0;

const classNames = new Set();
const classList = {
  add: (name) => classNames.add(name),
  remove: (name) => classNames.delete(name),
  toggle: (name, force) => {
    if (force) classNames.add(name);
    else classNames.delete(name);
  }
};
const drawingContext = {
  setTransform() {},
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() { strokeCount += 1; }
};
const canvas = {
  width: 0,
  height: 0,
  getContext: () => drawingContext,
  getBoundingClientRect: () => ({ width: 720, height: 220 })
};
const visualRoot = { classList };
const audio = {
  currentSrc: "https://audio.example/assets/music/streams/v1/osiris/01-killu.m4a",
  src: "",
  currentTime: 45,
  duration: 180,
  paused: false,
  ended: false,
  addEventListener(name, handler) {
    mediaListeners.set(name, handler);
  }
};
const desktopQuery = {
  matches: true,
  addEventListener() {}
};
const motionQuery = {
  matches: false,
  addEventListener() {}
};
const sandbox = {
  URL,
  Uint8Array,
  Math,
  Promise,
  Error,
  console,
  performance: { now: () => 1000 },
  ResizeObserver: class {
    observe() {}
  },
  requestAnimationFrame(callback) {
    requestedAnimationFrame = callback;
    return 7;
  },
  cancelAnimationFrame() {
    cancelledFrames += 1;
    requestedAnimationFrame = null;
  },
  fetch: async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        version: "test",
        points: 256,
        tracks: {
          "osiris/01-killu.m4a": envelope
        }
      })
    };
  },
  document: {
    currentScript: {
      src: "https://infra.example/infra./assets/js/audio-visualizer.js?v=test"
    },
    hidden: false,
    addEventListener() {}
  },
  window: {
    location: { href: "https://infra.example/infra./index.html" },
    devicePixelRatio: 2,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    matchMedia(query) {
      return query.includes("prefers-reduced-motion") ? motionQuery : desktopQuery;
    }
  }
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: "audio-visualizer.js" });

async function main() {
  const api = sandbox.window.InfraAudioVisualizer;
  assert.ok(api && typeof api.create === "function", "visualizer API is not exposed");
  assert.equal(
    api.getVisualKey(audio.currentSrc),
    "osiris/01-killu.m4a",
    "worker audio URL does not resolve to the compact envelope key"
  );

  const controller = api.create({ audio, canvas, root: visualRoot });
  assert.ok(controller, "visualizer controller was not created");
  controller.sync({ active: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fetchCount, 1, "visual envelope data was not fetched exactly once");
  assert.ok(classNames.has("is-active"), "active visual state is missing");
  assert.ok(classNames.has("is-ready"), "ready visual state is missing");
  assert.ok(strokeCount >= 3, "visual waveform was not drawn");
  assert.equal(typeof requestedAnimationFrame, "function", "playing visual did not schedule a frame");
  assert.equal(canvas.width, 1080, "device-pixel ratio is not capped at 1.5");
  assert.equal(canvas.height, 330, "canvas height does not use the capped pixel ratio");

  audio.paused = true;
  mediaListeners.get("pause")();
  assert.ok(cancelledFrames > 0, "pause did not cancel the animation frame");

  controller.sync({ active: false });
  assert.ok(!classNames.has("is-active"), "closed fullscreen keeps the visual active");
  console.log("Desktop audio visualizer lifecycle: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
