#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const posted = [];
let uuidCounter = 0;
const audioState = {
  playRequestToken: 0,
  startRequestToken: 0,
  playRequestTs: Date.now(),
  audioClickPerfTs: Date.now(),
  audio: {
    paused: false,
    currentTime: 1,
    duration: 180,
    readyState: 4,
    networkState: 1,
    buffered: { length: 0 }
  }
};

const sandbox = {
  URL,
  Request,
  Response,
  Headers,
  Blob,
  Promise,
  Date,
  Math,
  console,
  performance: { now: () => Date.now() },
  crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}` },
  navigator: {
    userAgent: "SECRET FULL USER AGENT",
    onLine: true,
    connection: { effectiveType: "4g" }
  },
  document: {
    visibilityState: "visible",
    addEventListener() {}
  },
  addEventListener() {},
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  fetch(_url, options) {
    posted.push(JSON.parse(String(options && options.body || "[]")));
    return Promise.resolve({ ok: true });
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/assets/js/audio-telemetry.js"), "utf8"),
  sandbox
);

const telemetry = sandbox.InfraAudioTelemetry.createTelemetry({
  fineTelemetryEnabled: true,
  isTelemetryOriginAllowed: () => true,
  getWorkerUrl: () => "https://worker.test",
  getRuntimeVersion: () => "audiofix332-test",
  getAudioState: () => audioState,
  getAudio: () => audioState.audio,
  getAudioSource: () => "r2",
  isIosDevice: () => true,
  isStandaloneDisplayMode: () => true,
  isAndroidDevice: () => false,
  buildMonitorPayload: () => ({
    track: "Safe title",
    album: "Safe album",
    track_path: "assets/music/streams/private/path.m4a",
    src: "https://secret.example/private/path.m4a"
  })
});

(async function () {
  telemetry.enqueue({
    event: "expired",
    timestamp_ms: Date.now() - 25 * 60 * 60 * 1000,
    browser: "SECRET",
    src: "https://secret.example/expired.m4a"
  });

  for (let index = 0; index < 120; index += 1) {
    telemetry.enqueue({
      event: "playing",
      timestamp_ms: Date.now() + index,
      track: `Track ${index}`,
      album: "Album",
      browser: "SECRET FULL USER AGENT",
      local_time: "SECRET LOCAL TIME",
      ts_client: "SECRET ISO TIME",
      session_id: "SECRET SESSION",
      track_path: "assets/music/streams/private/path.m4a",
      src: "https://secret.example/private/path.m4a?token=secret",
      from_url: "https://secret.example/from?token=secret",
      to_url: "https://secret.example/to#secret",
      message: "SECRET MESSAGE",
      _telemetry_id: "SECRET LOCAL ID",
      duration_before_play_ms: index
    });
  }

  assert.strictEqual(await telemetry.flushQueue(), true);
  assert.strictEqual(posted.length, 1);
  assert.strictEqual(posted[0].length, 100, "Only the 100 newest events may leave the device");
  assert.strictEqual(posted[0][0].track, "Track 20");
  assert.strictEqual(posted[0][99].track, "Track 119");

  const forbidden = [
    "browser", "local_time", "ts_client", "session_id", "track_path", "src",
    "from_url", "to_url", "message", "_telemetry_id"
  ];
  posted[0].forEach((event) => {
    forbidden.forEach((key) => assert.strictEqual(Object.prototype.hasOwnProperty.call(event, key), false, `${key} leaked`));
  });

  telemetry.trackRuntimeEvent("play_call", {
    request_token: 1,
    track: "First",
    album: "Album",
    src: "https://secret.example/first.m4a"
  });
  telemetry.trackRuntimeEvent("playing", {
    request_token: 2,
    track: "Second",
    album: "Album",
    src: "https://secret.example/second.m4a"
  });
  assert.strictEqual(await telemetry.flushQueue(), true);
  assert.strictEqual(posted[1].length, 2);
  assert(posted[1][0].trace_id);
  assert(posted[1][1].trace_id);
  assert.notStrictEqual(posted[1][0].trace_id, posted[1][1].trace_id, "Each playback attempt needs a separate trace");

  audioState.playRequestToken = 3;
  telemetry.trackRuntimeEvent("waiting", {
    track: "Active track",
    album: "Album"
  });
  telemetry.trackRuntimeEvent("stalled", {
    track: "Active track",
    album: "Album"
  });
  telemetry.trackRuntimeEvent("heartbeat", {
    track: "Active track",
    album: "Album"
  });
  assert.strictEqual(await telemetry.flushQueue(), true);
  assert.strictEqual(posted[2].length, 3);
  assert(posted[2][0].trace_id, "waiting must use the active playback trace");
  assert.strictEqual(posted[2][1].trace_id, posted[2][0].trace_id, "stalled must keep the active playback trace");
  assert.strictEqual(posted[2][2].trace_id, posted[2][0].trace_id, "heartbeat must keep the active playback trace");

  telemetry.sendMonitoringLog(null, 0, "https://secret.example/private/path.m4a", { error: false });
  assert.strictEqual(await telemetry.flushQueue(), true);
  assert.strictEqual(posted[3][0].event, "monitor_play");
  assert.strictEqual(posted[3][0].ua_class, "ios_pwa");
  assert.strictEqual(posted[3][0].track, "Safe title");
  assert.strictEqual(posted[3][0].trace_id, posted[2][0].trace_id, "monitor event must keep the active playback trace");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(posted[3][0], "src"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(posted[3][0], "track_path"), false);

  console.log("Audio telemetry privacy checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
