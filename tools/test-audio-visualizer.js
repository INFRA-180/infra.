#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public/assets/js/audio-visualizer.js"), "utf8");
const mediaListeners = new Map();
let requestedAnimationFrame = null;
let cancelledFrames = 0;
let strokeCount = 0;
let audioContextCount = 0;
let sourceCount = 0;
let analyserFrequencyReads = 0;
let analyserTimeReads = 0;
let contextCloseCount = 0;

const classNames = new Set();
const classList = {
  add: (name) => classNames.add(name),
  remove: (name) => classNames.delete(name),
  contains: (name) => classNames.has(name),
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
const healthReports = [];
const audio = {
  currentSrc: "https://audio.example/assets/music/streams/v1/osiris/01-killu.m4a",
  src: "",
  crossOrigin: "anonymous",
  currentTime: 45,
  duration: 180,
  paused: false,
  ended: false,
  addEventListener(name, handler) {
    mediaListeners.set(name, handler);
  }
};
const destination = { name: "destination" };
const analyser = {
  fftSize: 0,
  smoothingTimeConstant: 0,
  minDecibels: 0,
  maxDecibels: 0,
  get frequencyBinCount() {
    return this.fftSize / 2;
  },
  getByteFrequencyData(values) {
    analyserFrequencyReads += 1;
    values.fill(72);
    for (let index = 1; index < Math.min(6, values.length); index += 1) values[index] = 210;
  },
  getByteTimeDomainData(values) {
    analyserTimeReads += 1;
    for (let index = 0; index < values.length; index += 1) {
      values[index] = index % 2 ? 150 : 106;
    }
  }
};
const sourceNode = {
  connections: [],
  connect(target) {
    this.connections.push(target);
  }
};
class MockAudioContext {
  constructor() {
    audioContextCount += 1;
    this.state = "suspended";
    this.sampleRate = 48000;
    this.destination = destination;
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  close() {
    contextCloseCount += 1;
    this.state = "closed";
    return Promise.resolve();
  }

  createAnalyser() {
    return analyser;
  }

  createMediaElementSource(media) {
    assert.equal(media, audio, "the analyser was not attached to the global audio element");
    sourceCount += 1;
    return sourceNode;
  }
}
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
  document: {
    currentScript: {
      src: "https://infra.example/infra./assets/js/audio-visualizer.js?v=test"
    },
    hidden: false,
    addEventListener() {}
  },
  window: {
    AudioContext: MockAudioContext,
    location: { href: "https://infra.example/infra./index.html" },
    devicePixelRatio: 2,
    getComputedStyle() {
      return {
        opacity: classNames.has("is-active") && classNames.has("is-ready") ? "1" : "0"
      };
    },
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

  const controller = api.create({
    audio,
    canvas,
    root: visualRoot,
    reportHealth(payload) {
      healthReports.push(payload);
    }
  });
  assert.ok(controller, "visualizer controller was not created");
  assert.equal(typeof controller.activate, "function", "live analyser has no gesture activation");

  const activated = await controller.activate();
  assert.equal(activated, true, "live audio analysis did not activate");
  assert.equal(audioContextCount, 1, "more than one AudioContext was created");
  assert.equal(sourceCount, 1, "more than one MediaElementAudioSourceNode was created");
  assert.deepEqual(
    sourceNode.connections,
    [destination, analyser],
    "audio is not routed directly to output with the analyser on a side branch"
  );
  assert.equal(analyser.fftSize, 512, "unexpected analyser FFT size");
  assert.equal(analyser.smoothingTimeConstant, 0.58, "unexpected analyser smoothing");

  controller.sync({ active: true });
  assert.ok(classNames.has("is-active"), "active visual state is missing");
  assert.ok(classNames.has("is-ready"), "ready visual state is missing");
  assert.ok(strokeCount >= 3, "live visual waveform was not drawn");
  assert.ok(analyserFrequencyReads > 0, "frequency data was not read");
  assert.ok(analyserTimeReads > 0, "time-domain data was not read");
  assert.equal(typeof requestedAnimationFrame, "function", "playing visual did not schedule a frame");
  assert.equal(canvas.width, 1080, "device-pixel ratio is not capped at 1.5");
  assert.equal(canvas.height, 330, "canvas height does not use the capped pixel ratio");

  await controller.activate();
  assert.equal(audioContextCount, 1, "reactivation created a second AudioContext");
  assert.equal(sourceCount, 1, "reactivation rerouted the media element a second time");

  requestedAnimationFrame(1040);
  assert.ok(analyserFrequencyReads > 1, "animation frames do not sample live audio");

  audio.paused = true;
  mediaListeners.get("pause")();
  assert.ok(cancelledFrames > 0, "pause did not cancel the animation frame");

  controller.sync({ active: false });
  assert.ok(!classNames.has("is-active"), "closed fullscreen keeps the visual active");
  assert.equal(contextCloseCount, 0, "closing the visualizer closed the audible audio graph");
  const health = healthReports.at(-1);
  assert.ok(health, "visualizer health was not reported");
  assert.equal(health.result, "ready", "health report does not expose activation status");
  assert.equal(health.state, "running", "health report does not expose context state");
  assert.equal(health.visualizer_open_count, 1, "health report lost the fullscreen open");
  assert.equal(health.visualizer_activation_count, 2, "health report lost activation attempts");
  assert.equal(health.visualizer_activation_success_count, 2, "health report lost successful activations");
  assert.ok(health.visualizer_frame_count > 0, "health report contains no drawn frame");
  assert.ok(health.visualizer_nonzero_frame_count > 0, "health report did not detect live signal");
  assert.equal(health.visualizer_analyser_ready, 1, "health report does not see the analyser");
  assert.equal(health.visualizer_canvas_visible, 1, "health report does not see the canvas");
  console.log("Desktop live audio visualizer graph and lifecycle: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
