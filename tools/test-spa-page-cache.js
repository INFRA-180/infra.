#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const ROUTER_PATH = path.join(ROOT, "public/assets/js/spa-router.js");
const routerSource = fs.readFileSync(ROUTER_PATH, "utf8");
const SHELL_CACHE = "infra-shell-20260719-audio356-shell";

function loadRouter(overrides) {
  const sandbox = Object.assign({
    URL,
    Promise,
    Set,
    Map,
    AbortController,
    Response,
    Headers,
    setTimeout,
    clearTimeout,
    location: {
      href: "https://site.test/index.html",
      origin: "https://site.test",
      protocol: "https:"
    }
  }, overrides || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(routerSource, sandbox, { filename: ROUTER_PATH });
  return sandbox.InfraSpaRouter;
}

function createCache(router, options) {
  const opts = options || {};
  return router.createPageCache({
    pageCache: new Map(),
    pageCacheOrder: [],
    prefetchingPages: new Set(),
    inflightPages: new Map(),
    pageCacheLimit: 40,
    currentHref: "https://site.test/index.html",
    currentOrigin: "https://site.test",
    cacheStorage: opts.cacheStorage,
    fetch: opts.fetch
  });
}

async function testInstalledShellWinsWithoutNetwork() {
  let fetchCalls = 0;
  let cacheMatchCalls = 0;
  const router = loadRouter();
  const cache = createCache(router, {
    cacheStorage: {
      async match(url, options) {
        cacheMatchCalls += 1;
        assert.equal(url, "https://site.test/music/salam-infra.html");
        assert.equal(options.cacheName, SHELL_CACHE);
        return new Response("<!doctype html><body class='album-screen'>Salam</body>", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      }
    },
    async fetch() {
      fetchCalls += 1;
      throw new Error("network must not run for an installed album");
    }
  });

  const result = await cache.load("music/salam-infra.html", { cacheName: SHELL_CACHE });
  assert.equal(result.cached, true);
  assert.equal(result.strategy, "window_shell_cache");
  assert.equal(result.workerVersion, "infra-shell-20260719-audio356");
  assert.match(result.html, /Salam/);
  assert.equal(cacheMatchCalls, 1);
  assert.equal(fetchCalls, 0);

  const memoryResult = await cache.load("music/salam-infra.html", { cacheName: SHELL_CACHE, force: true });
  assert.equal(memoryResult.strategy, "client_memory");
  assert.equal(cacheMatchCalls, 1, "a memory hit must not reopen CacheStorage");
  assert.equal(fetchCalls, 0, "force must not revalidate immutable album HTML");
}

async function testIntentAndClickShareOneRequest() {
  let fetchCalls = 0;
  let resolveFetch = null;
  const router = loadRouter();
  const cache = createCache(router, {
    cacheStorage: { async match() { return undefined; } },
    fetch() {
      fetchCalls += 1;
      return new Promise(function (resolve) {
        resolveFetch = resolve;
      });
    }
  });

  const intent = cache.prefetch("music/ballades-infra.html", {
    cacheName: SHELL_CACHE,
    timeoutMs: 1000
  });
  const click = cache.load("music/ballades-infra.html", {
    cacheName: SHELL_CACHE,
    timeoutMs: 1000
  });
  await new Promise(setImmediate);
  assert.equal(fetchCalls, 1, "touch intent and click must share one HTML request");

  resolveFetch(new Response("<!doctype html><body class='album-screen'>Ballades</body>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  }));
  const [prefetched, loaded] = await Promise.all([intent, click]);
  assert.equal(prefetched, true);
  assert.match(loaded.html, /Ballades/);
  assert.equal(fetchCalls, 1);
}

async function testAllAlbumDocumentsWarmCacheOnly() {
  let fetchCalls = 0;
  const router = loadRouter();
  const cache = createCache(router, {
    cacheStorage: {
      async match(url, options) {
        assert.equal(options.cacheName, SHELL_CACHE);
        return new Response(`<!doctype html><body class='album-screen'>${url}</body>`, {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      }
    },
    async fetch() {
      fetchCalls += 1;
      throw new Error("warmup must remain cache-only");
    }
  });
  const pages = Array.from({ length: 31 }, function (_value, index) {
    return `https://site.test/music/album-${index + 1}-infra.html`;
  });
  const result = await cache.warm(pages, {
    cacheName: SHELL_CACHE,
    concurrency: 4
  });
  assert.deepEqual(result, { requested: 31, warmed: 31 });
  assert.equal(fetchCalls, 0);
  pages.forEach(function (url) {
    assert.ok(cache.has(url), `warm cache is missing ${url}`);
  });
}

async function testNavigationUpgradesCacheOnlyWarmup() {
  let fetchCalls = 0;
  const router = loadRouter();
  const cache = createCache(router, {
    cacheStorage: { async match() { return undefined; } },
    async fetch() {
      fetchCalls += 1;
      return new Response("<!doctype html><body class='album-screen'>Network fallback</body>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
  });

  const cacheOnlyWarmup = cache.prefetch("music/trou-noir-infra.html", {
    cacheName: SHELL_CACHE,
    cacheOnly: true
  });
  const userNavigation = cache.load("music/trou-noir-infra.html", {
    cacheName: SHELL_CACHE,
    timeoutMs: 1000
  });
  const [warmed, loaded] = await Promise.all([cacheOnlyWarmup, userNavigation]);
  assert.equal(warmed, false, "a missing shell entry must stay cache-only during idle warmup");
  assert.match(loaded.html, /Network fallback/, "a user navigation must upgrade a cache-only miss");
  assert.equal(fetchCalls, 1, "the upgraded user navigation must make one bounded fallback request");
}

async function testHungCacheLookupFallsBackBoundedly() {
  let fetchCalls = 0;
  const router = loadRouter();
  const cache = createCache(router, {
    cacheStorage: { match() { return new Promise(function () {}); } },
    async fetch() {
      fetchCalls += 1;
      return new Response("<!doctype html><body class='album-screen'>Bounded fallback</body>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
  });
  const startedAt = Date.now();
  const loaded = await cache.load("music/sanguin-infra.html", {
    cacheName: SHELL_CACHE,
    cacheLookupTimeoutMs: 50,
    timeoutMs: 1000
  });
  assert.match(loaded.html, /Bounded fallback/);
  assert.equal(fetchCalls, 1);
  assert.ok(Date.now() - startedAt < 500, "a hung CacheStorage lookup must not freeze album navigation");
}

function testHistoryWritesAreBoundedAndNonThrowing() {
  const router = loadRouter();
  const writes = [];
  const historyRef = {
    state: { existing: true },
    pushState(state, _title, url) {
      writes.push({ state, url });
    }
  };
  const success = router.writeHistoryState({
    historyRef,
    mode: "push",
    url: "https://site.test/music/adc-13-infra.html",
    scrollX: 0,
    scrollY: 0
  });
  assert.equal(success.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].state.__infraSpa, 1);
  assert.equal(writes[0].state.existing, true);

  const quotaFailure = router.writeHistoryState({
    historyRef: {
      state: {},
      replaceState() {
        const error = new Error("WebKit history quota");
        error.name = "QuotaExceededError";
        throw error;
      }
    },
    mode: "replace",
    url: "https://site.test/index.html",
    scrollY: 1200
  });
  assert.equal(quotaFailure.ok, false, "a WebKit quota error must be returned, not thrown");
  assert.equal(quotaFailure.errorName, "QuotaExceededError");
}

async function main() {
  await testInstalledShellWinsWithoutNetwork();
  await testIntentAndClickShareOneRequest();
  await testAllAlbumDocumentsWarmCacheOnly();
  await testNavigationUpgradesCacheOnlyWarmup();
  await testHungCacheLookupFallsBackBoundedly();
  testHistoryWritesAreBoundedAndNonThrowing();
  console.log("audiofix356 SPA page-cache tests: ok");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
