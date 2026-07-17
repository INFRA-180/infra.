#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(__dirname, "../public/assets/js/catalog-loader.js");
const REAL_SET_TIMEOUT = setTimeout;
const REAL_CLEAR_TIMEOUT = clearTimeout;

function createDocuments(label) {
  const suffix = String(label || "local");
  const catalog = {
    apps: [{
      id: `app-${suffix}`,
      title: `APP ${suffix}`,
      page: `apps/${suffix}.html`,
      thumb: `assets/apps/${suffix}.png`,
      width: 500,
      height: 500
    }],
    albums: [{
      id: `album-${suffix}`,
      title: `ALBUM ${suffix}`,
      page: `music/${suffix}.html`,
      thumb: `assets/music/${suffix}-cover.jpg`,
      thumbSrcset: `assets/music/responsive/${suffix}-cover-480.webp 480w, assets/music/${suffix}-cover.jpg 1600w`,
      thumbSizes: "50vw",
      width: 800,
      height: 800
    }],
    clips: []
  };
  const tracks = {
    albums: [{
      slug: suffix,
      title: `ALBUM ${suffix}`,
      page: `music/${suffix}.html`,
      cover: `assets/music/${suffix}-cover.jpg`,
      tracks: [{
        title: `TRACK ${suffix}`,
        src: `assets/music/streams/${suffix}/01-track.m4a`,
        duration: "1:00",
        seconds: 60
      }]
    }]
  };
  const durations = {
    trackCount: 1,
    tracks: [{ src: tracks.albums[0].tracks[0].src, seconds: 60 }]
  };
  return {
    catalog,
    tracks,
    durations,
    bundle: {
      schemaVersion: 1,
      releaseId: `${suffix}-release`,
      documents: { catalog, tracks, durations }
    }
  };
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function withDeadline(promise, label) {
  let timer = 0;
  const timeout = new Promise((_resolve, reject) => {
    timer = REAL_SET_TIMEOUT(() => reject(new Error(`${label} remained blocked`)), 250);
  });
  return Promise.race([promise, timeout]).finally(() => REAL_CLEAR_TIMEOUT(timer));
}

function createHarness(options) {
  const opts = options || {};
  const local = createDocuments("local");
  const live = createDocuments("live");
  const fetchCalls = [];
  const cacheWrites = [];
  let resolveLive;
  const pendingLiveResponse = new Promise((resolve) => { resolveLive = resolve; });

  const sandbox = {
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    Promise,
    console: { log() {}, info() {}, warn() {}, error() {} },
    location: { href: "https://site.test/index.html", origin: "https://site.test" },
    // Keep the Worker's 3500 ms timeout observable but inert in this unit test.
    setTimeout() { return 1; },
    clearTimeout() {},
    fetch(input) {
      const url = new URL(typeof input === "string" ? input : input.url);
      fetchCalls.push(url.href);
      if (url.pathname === "/catalog/latest") {
        return opts.liveImmediate
          ? Promise.resolve(jsonResponse(live.bundle))
          : pendingLiveResponse;
      }
      if (opts.localFailure) return Promise.resolve(jsonResponse({ error: true }, 503));
      if (url.pathname.endsWith("/data/catalog.json")) return Promise.resolve(jsonResponse(local.catalog));
      if (url.pathname.endsWith("/data/tracks.json")) return Promise.resolve(jsonResponse(local.tracks));
      if (url.pathname.endsWith("/data/track-durations.json")) return Promise.resolve(jsonResponse(local.durations));
      return Promise.reject(new Error(`Unexpected request: ${url.href}`));
    },
    caches: {
      open() {
        return Promise.resolve({
          match() {
            return Promise.resolve(opts.cachedLive ? jsonResponse(live.bundle) : null);
          },
          put(url, response) {
            return response.clone().json().then((payload) => {
              cacheWrites.push({ url: String(url), payload });
            });
          }
        });
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SOURCE_PATH, "utf8"), sandbox, { filename: SOURCE_PATH });

  const catalogState = {};
  const audioState = {};
  const runtime = { baseUrl: new URL("https://site.test/") };
  const loader = sandbox.InfraCatalogLoader.createLoader({
    fallbackCatalog: local.catalog,
    catalogState,
    audioState,
    runtime,
    WORKER_URL: "https://worker.test",
    LIVE_CATALOG_CACHE_NAME: "catalog-test-cache",
    LIVE_CATALOG_TIMEOUT_MS: 3500,
    LOCAL_CATALOG_VERSION: "startup-test",
    normalizeAlbumTitle: (value) => String(value || "").trim().toUpperCase(),
    normalizeTrackTitle: (value) => String(value || "").trim().toUpperCase(),
    toRuntimeAbsoluteUrl: (value) => new URL(String(value || ""), runtime.baseUrl).href,
    getAudioAssetPathKey: (value) => String(value || ""),
    canonicalFavoritePath: (value) => String(value || ""),
    formatTrackDuration: () => "1:00",
    rememberTrackDuration() {},
    resolveManagedAudioSrc: (value) => new URL(String(value || ""), runtime.baseUrl).href,
    getCurrentLogicalAudioSrc: () => "",
    normalizeCoverUrl: (value, options) => {
      const source = String(value || "");
      if (!options || Number(options.width) !== 1200) return source;
      return source.replace(/^assets\/music\/(.+)-cover\.jpg$/i, "assets/music/responsive/$1-cover-1200.webp");
    }
  });

  return {
    loader,
    catalogState,
    audioState,
    local,
    live,
    fetchCalls,
    cacheWrites,
    resolveLive
  };
}

async function flushTasks() {
  await new Promise((resolve) => REAL_SET_TIMEOUT(resolve, 0));
  await Promise.resolve();
}

(async function () {
  const startup = createHarness();
  const [catalog, tracks] = await withDeadline(
    Promise.all([startup.loader.loadCatalogData(), startup.loader.loadTracksData()]),
    "Local catalogue startup"
  );

  assert.strictEqual(startup.catalogState.catalogBundleSource, "local");
  assert.strictEqual(startup.catalogState.catalogBundleReleaseId, "local-startup-test");
  assert.strictEqual(catalog.albums[0].title, "ALBUM local");
  assert.strictEqual(catalog.albums[0].thumb, "assets/music/responsive/local-cover-1200.webp");
  assert.strictEqual(catalog.albums[0].thumbSrcset, "", "album cards must expose one canonical cover source");
  assert.strictEqual(catalog.albums[0].thumbSizes, "", "album cards must not restore legacy responsive candidates");
  assert.strictEqual(tracks.albums[0].slug, "local");
  assert.strictEqual(startup.audioState.tracksData, tracks);
  assert.strictEqual(
    startup.fetchCalls.filter((url) => url === "https://worker.test/catalog/latest").length,
    1,
    "The live refresh starts once in the background"
  );
  assert.strictEqual(
    startup.fetchCalls.filter((url) => /\/data\/(?:catalog|tracks|track-durations)\.json/.test(url)).length,
    3,
    "The validated local bundle is the blocking startup dependency"
  );
  assert.strictEqual(startup.cacheWrites.length, 0, "A pending live refresh must not block local readiness");

  const backgroundLive = startup.catalogState.latestCatalogPromise;
  assert(backgroundLive && typeof backgroundLive.then === "function");
  startup.resolveLive(jsonResponse(startup.live.bundle));
  await withDeadline(backgroundLive, "Background live refresh");
  await flushTasks();
  assert.strictEqual(startup.catalogState.latestCatalogPayload.releaseId, "live-release");
  assert.strictEqual(startup.cacheWrites.length, 1);
  assert.strictEqual(startup.cacheWrites[0].url, "https://worker.test/catalog/latest");
  assert.strictEqual(startup.cacheWrites[0].payload.releaseId, "live-release");
  assert.strictEqual(
    startup.catalogState.catalogBundleSource,
    "local",
    "The background refresh must not rebuild the active Home/Radio catalogue"
  );

  const cached = createHarness({ cachedLive: true });
  const cachedTracks = await withDeadline(cached.loader.loadTracksData(), "Cached live startup");
  assert.strictEqual(cached.catalogState.catalogBundleSource, "live-cache");
  assert.strictEqual(cached.catalogState.catalogBundleReleaseId, "live-release");
  assert.strictEqual(cachedTracks.albums[0].slug, "live");
  assert.strictEqual(
    cached.fetchCalls.filter((url) => url === "https://worker.test/catalog/latest").length,
    1,
    "A validated cached live bundle must be immediate while one network refresh stays detached"
  );
  cached.resolveLive(jsonResponse(cached.live.bundle));
  await withDeadline(cached.catalogState.latestCatalogPromise, "Cached live background refresh");

  const fallback = createHarness({ localFailure: true, liveImmediate: true });
  const fallbackTracks = await withDeadline(fallback.loader.loadTracksData(), "Live fallback startup");
  assert.strictEqual(fallback.catalogState.catalogBundleSource, "live");
  assert.strictEqual(fallbackTracks.albums[0].slug, "live");

  console.log("Catalog local-first startup checks passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
