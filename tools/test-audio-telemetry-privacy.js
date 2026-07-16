#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const requests = [];
const windowListeners = new Map();
const documentListeners = new Map();
const databases = new Map();
let uuidCounter = 0;
let fetchOk = true;
let deferNextFetch = false;
const deferredFetches = [];
let intervalCalls = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function addListener(registry, type, callback) {
  if (!registry.has(type)) registry.set(type, []);
  registry.get(type).push(callback);
}

function dispatch(registry, type) {
  (registry.get(type) || []).slice().forEach((callback) => callback({ type }));
}

function createIndexedDbMock() {
  function open(name) {
    const request = { result: null };
    queueMicrotask(() => {
      const isNew = !databases.has(name);
      if (isNew) databases.set(name, { stores: new Map() });
      const data = databases.get(name);
      const db = {
        objectStoreNames: {
          contains(storeName) { return data.stores.has(storeName); }
        },
        createObjectStore(storeName) {
          if (!data.stores.has(storeName)) data.stores.set(storeName, new Map());
        },
        transaction(storeName) {
          const transaction = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore() {
              if (!data.stores.has(storeName)) data.stores.set(storeName, new Map());
              const values = data.stores.get(storeName);
              return {
                getAll() { return { result: Array.from(values.values()).map(clone) }; },
                put(value) {
                  const key = value.session_id;
                  values.set(key, clone(value));
                  return { result: key };
                },
                delete(key) {
                  values.delete(key);
                  return { result: undefined };
                }
              };
            }
          };
          queueMicrotask(() => {
            if (typeof transaction.oncomplete === "function") transaction.oncomplete();
          });
          return transaction;
        }
      };
      request.result = db;
      if (isNew && typeof request.onupgradeneeded === "function") request.onupgradeneeded();
      if (typeof request.onsuccess === "function") request.onsuccess();
    });
    return request;
  }

  return {
    open,
    deleteDatabase(name) {
      databases.delete(name);
      return {};
    }
  };
}

const audioState = {
  playRequestToken: 1,
  startRequestToken: 1,
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
  TextEncoder,
  console,
  performance: { now: () => Date.now() },
  crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}` },
  indexedDB: createIndexedDbMock(),
  navigator: {
    userAgent: "SECRET FULL USER AGENT",
    onLine: true,
    connection: { effectiveType: "4g" },
    sendBeacon() { throw new Error("sendBeacon must not be used"); }
  },
  document: {
    visibilityState: "visible",
    addEventListener(type, callback) { addListener(documentListeners, type, callback); }
  },
  addEventListener(type, callback) { addListener(windowListeners, type, callback); },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() {
    intervalCalls += 1;
    return 1;
  },
  clearInterval() {},
  fetch(url, options) {
    requests.push({
      url,
      options: Object.assign({}, options),
      payload: JSON.parse(String(options && options.body || "{}"))
    });
    if (deferNextFetch) {
      deferNextFetch = false;
      const responseOk = fetchOk;
      return new Promise((resolve) => deferredFetches.push(() => resolve({ ok: responseOk })));
    }
    return Promise.resolve({ ok: fetchOk });
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../public/assets/js/audio-telemetry.js"), "utf8"),
  sandbox
);

function createTelemetry() {
  return sandbox.InfraAudioTelemetry.createTelemetry({
    fineTelemetryEnabled: true,
    isTelemetryOriginAllowed: () => true,
    getWorkerUrl: () => "https://worker.test",
    getRuntimeVersion: () => "audiofix-session-v2-test",
    getAudioState: () => audioState,
    getAudio: () => audioState.audio,
    getAudioSource: () => "r2dev",
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
}

async function settle(turns = 20) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

(async function () {
  const telemetry = createTelemetry();
  telemetry.initLifecycle();
  await settle();

  telemetry.startHeartbeat();
  telemetry.trackRuntimeEvent("heartbeat", { track: "Must stay local", album: "Album" });
  assert.strictEqual(intervalCalls, 0, "Session v2 must not install a heartbeat interval");

  for (let index = 0; index < 60; index += 1) {
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
  await settle();
  assert.strictEqual(requests.length, 0, "Active sessions must remain local");
  assert.strictEqual(await telemetry.flushQueue(), false, "Manual flush must not send an active session");

  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 1, "Hidden must perform one session delivery");
  const firstRequest = requests[0];
  assert.strictEqual(firstRequest.options.credentials, "omit");
  assert.strictEqual(firstRequest.options.keepalive, true);
  assert.strictEqual(firstRequest.payload.schema_version, 2);
  assert.strictEqual(firstRequest.payload.reports.length, 1);
  assert.strictEqual(firstRequest.payload.reports[0].events.length, 48, "Local journal must be capped at 48 events");
  assert.strictEqual(firstRequest.payload.reports[0].dropped_events, 12);
  assert.strictEqual(firstRequest.payload.reports[0].events[0].track, "Track 12");
  assert(Buffer.byteLength(firstRequest.options.body) <= 32 * 1024, "Session envelope must stay below 32 KiB");

  const forbidden = [
    "browser", "local_time", "ts_client", "session_id", "track_path", "src",
    "from_url", "to_url", "message", "_telemetry_id"
  ];
  firstRequest.payload.reports[0].events.forEach((event) => {
    forbidden.forEach((key) => assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, key),
      false,
      `${key} leaked`
    ));
  });

  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 1, "pagehide must not duplicate the hidden delivery");

  sandbox.document.visibilityState = "visible";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 1, "Visible must start locally without a network flush");

  fetchOk = false;
  telemetry.trackRuntimeEvent("waiting", { track: "Retry track", album: "Album" });
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  await settle();
  assert.strictEqual(requests.length, 2);
  const failedSessionId = requests[1].payload.reports[0].session_id;
  assert.strictEqual(telemetry.hasPendingEvents(), true, "Failed delivery must remain in IndexedDB");
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 2, "Failed hidden delivery must not retry again on pagehide");

  fetchOk = true;
  deferNextFetch = true;
  sandbox.document.visibilityState = "visible";
  const telemetryAfterRelaunch = createTelemetry();
  telemetryAfterRelaunch.initLifecycle();
  await settle(40);
  assert.strictEqual(requests.length, 3, "Next launch must retry pending sealed sessions once");
  assert.strictEqual(requests[2].options.keepalive, false);
  assert.strictEqual(requests[2].payload.reports.length, 1);
  assert.strictEqual(requests[2].payload.reports[0].session_id, failedSessionId);
  assert.strictEqual(requests[2].payload.reports[0].close_reason, "hidden");

  telemetryAfterRelaunch.trackRuntimeEvent("playing", { track: "Closing during retry", album: "Album" });
  sandbox.document.visibilityState = "hidden";
  dispatch(documentListeners, "visibilitychange");
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 3, "Hidden must wait for the in-flight startup retry");
  assert.strictEqual(deferredFetches.length, 1);

  deferredFetches.shift()();
  await settle(40);
  assert.strictEqual(requests.length, 4, "Hidden during startup retry must coalesce one follow-up delivery");
  assert.strictEqual(requests[3].options.keepalive, true);
  assert.strictEqual(requests[3].payload.reports.length, 1);
  assert.notStrictEqual(requests[3].payload.reports[0].session_id, failedSessionId);
  dispatch(windowListeners, "pagehide");
  await settle();
  assert.strictEqual(requests.length, 4, "pagehide must not duplicate the coalesced delivery");

  console.log("Audio telemetry session v2 privacy checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
