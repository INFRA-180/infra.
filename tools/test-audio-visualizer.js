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
let fillCount = 0;
let linePointCount = 0;
let quadraticCurveCount = 0;
let clipCount = 0;
let powderCanvasCount = 0;
let powderImageWriteCount = 0;
let powderNonzeroPixelCount = 0;
let powderLeftSpread = 0;
let powderRightSpread = 0;
let powderTopSpread = 0;
let powderUpperSpread = 0;
let powderLowerSpread = 0;
let powderUpperPixelCount = 0;
let powderLowerPixelCount = 0;
let drawImageCount = 0;
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
  closePath() {},
  save() {},
  restore() {},
  clip() { clipCount += 1; },
  moveTo() {},
  lineTo() { linePointCount += 1; },
  quadraticCurveTo() {
    linePointCount += 1;
    quadraticCurveCount += 1;
  },
  stroke() { strokeCount += 1; },
  fill() { fillCount += 1; },
  drawImage() { drawImageCount += 1; }
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
let analyserMode = "bass";
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
    if (analyserMode === "silence") {
      values.fill(0);
      return;
    }
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
    addEventListener() {},
    createElement(name) {
      assert.equal(name, "canvas", "powder renderer created an unexpected element");
      powderCanvasCount += 1;
      const surface = {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(width, height) {
              return {
                width,
                height,
                data: new Uint8ClampedArray(width * height * 4)
              };
            },
            putImageData(imageData) {
              powderImageWriteCount += 1;
              const centerY = Math.floor(imageData.height / 2);
              let nonzero = 0;
              let leftSpread = 0;
              let rightSpread = 0;
              let upperSpread = 0;
              let lowerSpread = 0;
              let upperPixels = 0;
              let lowerPixels = 0;
              for (let offset = 3; offset < imageData.data.length; offset += 4) {
                if (!imageData.data[offset]) continue;
                nonzero += 1;
                const pixel = (offset - 3) / 4;
                const x = pixel % imageData.width;
                const y = Math.floor(pixel / imageData.width);
                const spread = Math.abs(y - centerY);
                if (x < imageData.width / 2) leftSpread = Math.max(leftSpread, spread);
                else rightSpread = Math.max(rightSpread, spread);
                if (y < centerY) {
                  upperPixels += 1;
                  upperSpread = Math.max(upperSpread, spread);
                } else if (y > centerY) {
                  lowerPixels += 1;
                  lowerSpread = Math.max(lowerSpread, spread);
                }
              }
              powderNonzeroPixelCount = nonzero;
              powderLeftSpread = leftSpread;
              powderRightSpread = rightSpread;
              powderTopSpread = Math.max(leftSpread, rightSpread);
              powderUpperSpread = upperSpread;
              powderLowerSpread = lowerSpread;
              powderUpperPixelCount = upperPixels;
              powderLowerPixelCount = lowerPixels;
            }
          };
        }
      };
      return surface;
    }
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
  assert.equal(analyser.fftSize, 2048, "unexpected analyser FFT size");
  assert.equal(analyser.smoothingTimeConstant, 0.42, "unexpected analyser smoothing");

  controller.sync({ active: true });
  assert.ok(classNames.has("is-active"), "active visual state is missing");
  assert.ok(classNames.has("is-ready"), "ready visual state is missing");
  assert.ok(strokeCount >= 3, "fixed axis and live frequency-spectrum lines were not drawn");
  assert.ok(fillCount >= 1, "live frequency-spectrum area was not filled");
  assert.ok(linePointCount >= 500, "mirrored frequency spectrum does not span enough logarithmic points");
  assert.ok(quadraticCurveCount >= 400, "frequency spectrum is still rendered as angular line segments");
  assert.equal(clipCount, 0, "ballistic particles are still clipped by the instantaneous spectrum");
  assert.equal(powderCanvasCount, 1, "the powder surface was not created exactly once");
  assert.ok(powderImageWriteCount >= 1, "the FFT-driven powder frame was not rasterized");
  assert.ok(powderNonzeroPixelCount >= 8000, "the 500,000-particle powder field is unexpectedly sparse");
  assert.ok(powderUpperPixelCount >= 3000, "the upper powder face is unexpectedly sparse");
  assert.ok(powderLowerPixelCount >= 3000, "the lower powder face is unexpectedly sparse");
  assert.ok(drawImageCount >= 1, "the rasterized powder frame was not composited into the spectrum");
  assert.ok(analyserFrequencyReads > 0, "frequency data was not read");
  assert.ok(analyserTimeReads > 0, "time-domain data was not read");
  assert.equal(typeof requestedAnimationFrame, "function", "playing visual did not schedule a frame");
  assert.equal(canvas.width, 1080, "device-pixel ratio is not capped at 1.5");
  assert.equal(canvas.height, 330, "canvas height does not use the capped pixel ratio");

  await controller.activate();
  assert.equal(audioContextCount, 1, "reactivation created a second AudioContext");
  assert.equal(sourceCount, 1, "reactivation rerouted the media element a second time");

  const powderCanvasCountBeforeFrame = powderCanvasCount;
  function runAnimationFrame(timestamp) {
    const callback = requestedAnimationFrame;
    assert.equal(typeof callback, "function", `no animation frame was scheduled for ${timestamp}`);
    requestedAnimationFrame = null;
    callback(timestamp);
  }
  runAnimationFrame(1040);
  assert.ok(analyserFrequencyReads > 1, "animation frames do not sample live audio");
  assert.ok(
    powderLeftSpread > powderRightSpread,
    `particle launch height does not follow local FFT bands (${powderLeftSpread}/${powderRightSpread})`
  );
  assert.ok(powderUpperSpread > 8, "the upper FFT face contains no launched particles");
  assert.ok(powderLowerSpread > 8, "the lower FFT face contains no launched particles");
  assert.equal(powderCanvasCount, powderCanvasCountBeforeFrame, "a new powder surface was created per frame");
  runAnimationFrame(1080);
  runAnimationFrame(1120);
  runAnimationFrame(1160);
  runAnimationFrame(1200);

  const launchedSpread = powderTopSpread;
  assert.ok(launchedSpread <= 84, "particles exceeded the original local FFT frame");
  analyserMode = "silence";
  audio.paused = true;
  mediaListeners.get("pause")();
  assert.ok(cancelledFrames > 0, "pause did not cancel the animation frame");
  assert.ok(powderTopSpread > 8, "particles disappeared as soon as the FFT signal stopped");
  for (let timestamp = 1280; timestamp <= 2200 && requestedAnimationFrame; timestamp += 80) {
    runAnimationFrame(timestamp);
  }
  const floatingTailSpread = powderTopSpread;
  for (let timestamp = 2280; timestamp <= 4400 && requestedAnimationFrame; timestamp += 80) {
    runAnimationFrame(timestamp);
  }
  assert.ok(
    floatingTailSpread > powderTopSpread + 5,
    "the lunar helix did not preserve a floating centrifugal tail before settling"
  );
  assert.ok(launchedSpread > powderTopSpread, "hybrid gravity did not bring the particles back to rest");
  assert.ok(powderTopSpread <= 24, "particles did not settle on their distributed powder bed");

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
  assert.equal(health.visualizer_powder_particle_count, 500000, "health report lost the powder density");
  assert.equal(health.visualizer_powder_earth_particle_count, 250000, "health report lost the Earth population");
  assert.equal(health.visualizer_powder_moon_particle_count, 250000, "health report lost the lunar population");
  assert.equal(health.visualizer_powder_upper_particle_count, 250000, "health report lost the upper population");
  assert.equal(health.visualizer_powder_lower_particle_count, 250000, "health report lost the lower population");
  assert.equal(health.visualizer_powder_helix_particle_count, 60000, "health report lost the helix population");
  assert.equal(health.visualizer_powder_helix_active_count, 0, "health report sees a helix still moving after settling");
  assert.ok(health.visualizer_powder_helix_max_active_count > 0, "health report contains no rotating helix grain");
  assert.ok(
    health.visualizer_powder_helix_max_offset_px > 4 &&
      health.visualizer_powder_helix_max_offset_px <= 20,
    "health report does not expose the reduced centrifugal helix radius"
  );
  assert.equal(health.visualizer_powder_surface_ready, 1, "health report does not see the powder surface");
  assert.ok(health.visualizer_powder_kick_count > 0, "health report contains no FFT particle kick");
  assert.ok(health.visualizer_powder_max_airborne_count > 0, "health report contains no airborne particle");
  assert.ok(health.visualizer_powder_max_rise_px > 8, "health report lost the ballistic rise height");
  assert.equal(health.visualizer_powder_airborne_count, 0, "health report sees particles still airborne after settling");
  assert.equal(health.visualizer_powder_gravity_milli, 9807, "particle gravity is not Earth gravity");
  assert.equal(health.visualizer_powder_moon_gravity_milli, 1620, "particle gravity is not lunar gravity");
  assert.ok(Number.isFinite(health.visualizer_powder_max_update_ms), "health report lost powder update cost");
  console.log("Desktop live audio visualizer graph and lifecycle: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
