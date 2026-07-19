const VERSION = "infra-shell-20260719-audio357";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const COVERS_CACHE = "infra-covers-v2";
const NEXT_TRACK_CACHE = "infra-next-track-segments-v9";
const MAX_COVER_CACHE_ENTRIES = 80;
const R2_AUDIO_HOST = "pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev";
const HTML_NETWORK_INFLIGHT = new Map();

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/css/styles.css?v=audiofix357-20260719",
  "./assets/js/covers.js?v=audiofix357-20260719",
  "./assets/js/favorites.js?v=audiofix357-20260719",
  "./assets/js/favorites-ui.js?v=audiofix357-20260719",
  "./assets/js/audio-visualizer.js?v=audiofix357-20260719",
  "./assets/js/transport-ui.js?v=audiofix357-20260719",
  "./assets/js/now-playing.js?v=audiofix357-20260719",
  "./assets/js/album-player-ui.js?v=audiofix357-20260719",
  "./assets/js/spa-renderer.js?v=audiofix357-20260719",
  "./assets/js/audio-radio.js?v=audiofix357-20260719",
  "./assets/js/media-session.js?v=audiofix357-20260719",
  "./assets/js/audio-prefetch.js?v=audiofix357-20260719",
  "./assets/js/spa-router.js?v=audiofix357-20260719",
  "./assets/js/catalog-fallback.js?v=audiofix357-20260719",
  "./assets/js/catalog-loader.js?v=audiofix357-20260719",
  "./assets/js/audio-telemetry.js?v=audiofix357-20260719",
  "./assets/js/downloads.js?v=audiofix357-20260719",
  "./assets/js/home-catalog.js?v=audiofix357-20260719",
  "./assets/js/audio-core.js?v=audiofix357-20260719",
  "./assets/js/pwa-install.js?v=audiofix357-20260719",
  "./assets/js/share-qr.js?v=audiofix357-20260719",
  "./assets/js/scripts.js?v=audiofix357-20260719",
  "./assets/fonts/antique-olive-nord.woff2",
  "./manifest.webmanifest",
  "./data/catalog.json?v=audiofix357-20260719",
  "./data/track-durations.json?v=audiofix357-20260719",
  "./data/tracks.json?v=audiofix357-20260719",
  "./assets/branding/infra-logo-white-photoroom-title.png",
  "./assets/pwa/favicon-logo-white-64.png",
  "./assets/pwa/icon-192-logo-white.png",
  "./assets/pwa/icon-512-logo-white.png",
  "./assets/pwa/icon-maskable-192-logo-white.png",
  "./assets/pwa/icon-maskable-512-logo-white.png",
  "./assets/pwa/apple-touch-icon-180-logo-white.png"
];

// These resources are useful, but none is required to start the PWA or play
// audio. A missing admin/QR/Sphragis file must therefore never invalidate the
// complete shell installation.
const OPTIONAL_SHELL_ASSETS = [
  "./assets/js/scripts.admin.js?v=audiofix357-20260719",
  "./assets/vendor/qr-creator.min.js?v=1.0.0",
  "./sphragis/",
  "./sphragis/index.html",
  "./assets/css/sphragis.css?v=sphragis20260625",
  "./assets/js/sphragis.js?v=sphragis20260716"
];

// Album documents are part of the installed application, not optional network
// content. Keeping them in the shell makes the first tap as deterministic as a
// revisit and leaves R2 audio loading independent from page navigation.
const ALBUM_PAGES = [
  "./music/abricot-infra.html",
  "./music/adc-13-infra.html",
  "./music/anunnaki-infra.html",
  "./music/anunnaki-instru-infra.html",
  "./music/asase-yaa-infra.html",
  "./music/aspasie-infra.html",
  "./music/ballades-infra.html",
  "./music/black-stallion-infra.html",
  "./music/cerises-infra.html",
  "./music/cyberpunk-infra.html",
  "./music/etoiles-infra.html",
  "./music/fond-diffus-infra.html",
  "./music/gaia-infra.html",
  "./music/h-1-008-infra.html",
  "./music/he-4-0026-infra.html",
  "./music/impression-infra.html",
  "./music/kali-infra.html",
  "./music/ldc13-infra.html",
  "./music/mami-wata-infra.html",
  "./music/moremi-ajasoro-infra.html",
  "./music/nahda-infra.html",
  "./music/naviguer-infra.html",
  "./music/osiris-infra.html",
  "./music/pbb-infra.html",
  "./music/peches-infra.html",
  "./music/rue-de-paris-infra.html",
  "./music/salam-infra.html",
  "./music/sanguin-infra.html",
  "./music/trou-noir-infra.html",
  "./music/v-23pi56-infra.html",
  "./music/voyager-infra.html"
];

async function precacheAlbumDocuments(cache) {
  let cursor = 0;
  async function cacheNext() {
    while (cursor < ALBUM_PAGES.length) {
      const page = ALBUM_PAGES[cursor];
      cursor += 1;
      const request = new Request(new URL(page, self.location.href).href, {
        cache: "reload",
        credentials: "same-origin"
      });
      const response = await fetch(request);
      if (!response || !response.ok) {
        throw new Error(`album_precache_${response ? response.status : "failed"}`);
      }
      await cache.put(request, response);
    }
  }
  await Promise.all([cacheNext(), cacheNext(), cacheNext()]);
}

async function installShellCache() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_ASSETS);
  await precacheAlbumDocuments(cache);
  await Promise.allSettled(
    OPTIONAL_SHELL_ASSETS.map(function (asset) {
      return cache.add(asset);
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(installShellCache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async function () {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => (
            (isVersionedSiteCache(key) && key !== SHELL_CACHE && key !== RUNTIME_CACHE) ||
            (isAudioPrefetchCache(key) && key !== NEXT_TRACK_CACHE) ||
            key === "infra-covers"
          ))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event && event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event && event.data && event.data.type === "INFRA_SW_VERSION_REQUEST") {
    if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage({
        type: "INFRA_SW_VERSION",
        version: VERSION
      });
    }
    return;
  }

});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (_err) {
    return false;
  }
}

function isHtmlRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isHtmlAsset(url) {
  const path = String((url && url.pathname) || "");
  return path === "/" || path.endsWith("/") || /\.html?$/i.test(path);
}

function isStaticAsset(request, url) {
  if (["style", "script", "image", "font"].includes(request.destination)) return true;
  return /\.(?:css|js|json|svg|png|jpe?g|webp|gif|ico)$/i.test(url.pathname);
}

function isAudioAsset(request, url) {
  if (request.destination === "audio") return true;
  return /\.(?:mp3|m4a|aac|wav|flac|ogg)$/i.test(url.pathname);
}

function isVersionedSiteCache(key) {
  return String(key || "").startsWith("infra-shell-") && /-(?:shell|runtime)$/.test(String(key || ""));
}

function isAudioPrefetchCache(key) {
  const name = String(key || "");
  return name === "infra-next-track" || name.startsWith("infra-next-track-");
}

function isResponsiveCoverAsset(url) {
  const path = String((url && url.pathname) || "");
  return /\/assets\/music\/responsive\/[^/]+-cover-1200\.webp$/i.test(path);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw _err;
  }
}

function addHtmlResponseDiagnostics(response, details) {
  if (!response) return response;
  const info = details || {};
  const headers = new Headers(response.headers);
  headers.set("X-Infra-SW-Version", VERSION);
  headers.set("X-Infra-HTML-Strategy", String(info.strategy || "unknown"));
  headers.set("X-Infra-HTML-Cache", info.cacheHit ? "hit" : "miss");
  headers.set("X-Infra-HTML-MS", String(Math.max(0, Number(info.responseMs) || 0)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function htmlCacheFirst(request, cacheName, fallbackUrl) {
  const startedAt = Date.now();
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return addHtmlResponseDiagnostics(cached, {
      strategy: "shell_cache",
      cacheHit: true,
      responseMs: Date.now() - startedAt
    });
  }

  try {
    const key = request.url;
    let networkPromise = HTML_NETWORK_INFLIGHT.get(key);
    if (!networkPromise) {
      networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .finally(() => {
          if (HTML_NETWORK_INFLIGHT.get(key) === networkPromise) {
            HTML_NETWORK_INFLIGHT.delete(key);
          }
        });
      HTML_NETWORK_INFLIGHT.set(key, networkPromise);
    }
    const response = await networkPromise;
    return addHtmlResponseDiagnostics(response, {
      strategy: "network",
      cacheHit: false,
      responseMs: Date.now() - startedAt
    });
  } catch (_err) {
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) {
        return addHtmlResponseDiagnostics(fallback, {
          strategy: "shell_fallback",
          cacheHit: true,
          responseMs: Date.now() - startedAt
        });
      }
    }
    throw _err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  return cached || networkPromise;
}

async function shellFirstOrRuntime(request) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request);
  if (!cached) return staleWhileRevalidate(request, RUNTIME_CACHE);

  fetch(request)
    .then((response) => {
      if (response && response.ok) shell.put(request, response.clone()).catch(() => undefined);
    })
    .catch(() => undefined);
  return cached;
}

async function cacheFirst(request, cacheName, options) {
  const opts = options || {};
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const writePromise = cache.put(request, response.clone())
      .then(() => pruneCacheEntries(cache, opts.maxEntries))
      .catch(() => undefined);
    if (opts.event && typeof opts.event.waitUntil === "function") {
      try {
        opts.event.waitUntil(writePromise);
      } catch (_err) {
        await writePromise;
      }
    } else {
      await writePromise;
    }
  }
  return response;
}

async function pruneCacheEntries(cache, maxEntries) {
  const limit = Math.max(0, Number(maxEntries) || 0);
  if (!cache || !limit) return;
  const keys = await cache.keys();
  const excess = Math.max(0, keys.length - limit);
  if (!excess) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

function notifyPrefetchHit(event, url, details) {
  if (!event || !event.clientId || !self.clients || typeof self.clients.get !== "function") return;
  const payload = Object.assign({
    type: "INFRA_PREFETCH_HIT",
    url
  }, details || {});
  const notification = self.clients.get(event.clientId)
    .then((client) => {
      if (!client) return;
      try {
        client.postMessage(payload);
      } catch (_err) {
        // Ignore telemetry message failures.
      }
    })
    .catch(() => undefined);
  if (typeof event.waitUntil === "function") {
    try {
      event.waitUntil(notification);
    } catch (_err) {
      // The response remains independent from telemetry delivery.
    }
  }
}

function parseRangeHeader(rangeHeader, total) {
  const match = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !Number.isFinite(total) || total <= 0) return null;
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);

  if (start === null && end === null) return null;
  if (start === null) {
    const suffix = end;
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    if (!Number.isFinite(start) || start < 0 || start >= total) return null;
    if (end === null || !Number.isFinite(end) || end >= total) end = total - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start, end };
}

async function deletePrefetchedAudio(cache, request, url) {
  try {
    await cache.delete(request, { ignoreVary: true });
    await cache.delete(url.href, { ignoreVary: true });
  } catch (_err) {
    // Ignore cache cleanup failures; network fallback remains authoritative.
  }
}

function cachedValidatorMatchesIfRange(cached, ifRangeHeader) {
  const value = String(ifRangeHeader || "").trim();
  if (!value) return true;
  if (/^(?:W\/)?"/i.test(value)) {
    const etag = String(cached.headers.get("ETag") || cached.headers.get("etag") || "").trim();
    if (!etag || /^W\//i.test(value) || /^W\//i.test(etag)) return false;
    return value === etag;
  }
  const lastModified = String(cached.headers.get("Last-Modified") || cached.headers.get("last-modified") || "").trim();
  return Boolean(lastModified && value === lastModified);
}

function getCachedAudioSegmentMetadata(cached) {
  const storedLengthValue = cached.headers.get("Content-Length") || cached.headers.get("content-length");
  const cachedStartValue = cached.headers.get("X-Infra-Range-Start");
  const cachedEndValue = cached.headers.get("X-Infra-Range-End");
  const totalValue = cached.headers.get("X-Infra-Total-Length");
  const firstTwoBytes = String(cached.headers.get("X-Infra-First-Two-Bytes") || "").toLowerCase();
  const storedLength = Number(storedLengthValue);
  const partial = cached.headers.get("X-Infra-Audio-Partial") === "1";
  const version = cached.headers.get("X-Infra-Audio-Cache-Version");
  const cachedStart = Number(cachedStartValue);
  const cachedEnd = Number(cachedEndValue);
  const total = Number(totalValue);
  const bodyValidated = cached.headers.get("X-Infra-Body-Validated") === "1";
  if (
    !cached.ok ||
    cached.status !== 200 ||
    !partial ||
    version !== "9" ||
    storedLengthValue === null ||
    cachedStartValue === null ||
    cachedEndValue === null ||
    totalValue === null ||
    !Number.isSafeInteger(storedLength) ||
    !Number.isSafeInteger(cachedStart) ||
    !Number.isSafeInteger(cachedEnd) ||
    !Number.isSafeInteger(total) ||
    storedLength <= 0 ||
    cachedStart < 0 ||
    cachedEnd < cachedStart ||
    total <= cachedEnd ||
    storedLength !== cachedEnd - cachedStart + 1 ||
    (firstTwoBytes && !/^[0-9a-f]{4}$/.test(firstTwoBytes))
  ) {
    const error = new Error("cached_audio_corrupt");
    error.code = "cached_audio_corrupt";
    throw error;
  }
  return { storedLength, cachedStart, cachedEnd, total, bodyValidated, firstTwoBytes };
}

async function buildRangeResponseFromCachedAudio(cached, rangeHeader) {
  const metadata = getCachedAudioSegmentMetadata(cached);
  const range = parseRangeHeader(rangeHeader, metadata.total);
  if (!range) return null;
  if (range.start < metadata.cachedStart || range.start > metadata.cachedEnd) return null;
  const responseEnd = Math.min(range.end, metadata.cachedEnd);
  const responseLength = responseEnd - range.start + 1;
  const headers = new Headers();
  headers.set("Content-Type", cached.headers.get("Content-Type") || cached.headers.get("content-type") || "audio/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${range.start}-${responseEnd}/${metadata.total}`);
  headers.set("Content-Length", String(responseLength));
  headers.set("Access-Control-Allow-Origin", self.location.origin);
  headers.set("Access-Control-Expose-Headers", "Accept-Ranges,Content-Range,Content-Length,Content-Type,ETag");
  headers.set("Vary", "Origin");
  const etag = cached.headers.get("ETag") || cached.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (
    range.start === 0 &&
    responseEnd === 1 &&
    metadata.firstTwoBytes
  ) {
    const probeBytes = new Uint8Array([
      Number.parseInt(metadata.firstTwoBytes.slice(0, 2), 16),
      Number.parseInt(metadata.firstTwoBytes.slice(2, 4), 16)
    ]);
    return new Response(probeBytes, { status: 206, statusText: "Partial Content", headers });
  }

  if (
    range.start === metadata.cachedStart &&
    responseEnd === metadata.cachedEnd &&
    metadata.bodyValidated &&
    cached.body
  ) {
    return new Response(cached.body, { status: 206, statusText: "Partial Content", headers });
  }

  const buffer = await cached.arrayBuffer();
  if (!buffer || buffer.byteLength !== metadata.storedLength) {
    const error = new Error("cached_audio_corrupt");
    error.code = "cached_audio_corrupt";
    throw error;
  }

  const sliced = buffer.slice(
    range.start - metadata.cachedStart,
    responseEnd - metadata.cachedStart + 1
  );
  return new Response(sliced, { status: 206, statusText: "Partial Content", headers });
}

async function servePrefetchedAudioOrNetwork(request, url, event) {
  const rangeHeader = request.headers.get("Range") || request.headers.get("range") || "";
  if (!rangeHeader) return fetch(request);

  const cache = await caches.open(NEXT_TRACK_CACHE);
  let cached = null;
  try {
    cached = await cache.match(request, { ignoreVary: true }) || await cache.match(url.href, { ignoreVary: true });
  } catch (_err) {
    return fetch(request);
  }
  if (!cached) return fetch(request);

  const ifRangeHeader = request.headers.get("If-Range") || request.headers.get("if-range") || "";
  if (!cachedValidatorMatchesIfRange(cached, ifRangeHeader)) return fetch(request);

  try {
    const partial = await buildRangeResponseFromCachedAudio(cached.clone(), rangeHeader);
    if (partial) {
      const servedRange = String(partial.headers.get("Content-Range") || "").match(/^bytes\s+(\d+)-(\d+)\//i);
      notifyPrefetchHit(event, url.href, {
        range: true,
        range_header: rangeHeader,
        range_start: servedRange ? Number(servedRange[1]) : null,
        range_end: servedRange ? Number(servedRange[2]) : null,
        bytes: Number(partial.headers.get("Content-Length") || 0),
        status: 206,
        strategy: rangeHeader === "bytes=0-1" ? "startup_probe_v9" : "startup_segment_v9"
      });
      return partial;
    }
  } catch (error) {
    if (error && error.code === "cached_audio_corrupt") {
      await deletePrefetchedAudio(cache, request, url);
    }
    return fetch(request);
  }
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request) return;
  const url = new URL(request.url);
  if (url.hostname === R2_AUDIO_HOST) {
    const rangeHeader = request.headers.get("Range") || request.headers.get("range") || "";
    const isSingleRange = /^bytes=(?:\d+-\d*|-\d+)$/i.test(rangeHeader);
    if (request.method === "GET" && request.mode === "cors" && isSingleRange) {
      event.respondWith(servePrefetchedAudioOrNetwork(request, url, event));
    }
    // WebKit must handle no-cors and non-Range media requests natively. Relaying
    // those through fetch(request) strips media-specific headers on iOS.
    return;
  }
  if (request.method !== "GET") return;
  if (!isSameOrigin(request.url)) return;

  if (isAudioAsset(request, url)) {
    // Do not intercept audio; avoids stale audio cache and fragile Range reconstruction.
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(htmlCacheFirst(request, SHELL_CACHE, "./index.html"));
    return;
  }

  if (isHtmlAsset(url)) {
    // SPA fetch() requests have no `document` destination, so they reach this
    // branch instead of isHtmlRequest(). They must use the same shell-first
    // policy as native navigations or a cold album tap remains network-bound.
    event.respondWith(htmlCacheFirst(request, SHELL_CACHE));
    return;
  }

  if (isResponsiveCoverAsset(url)) {
    event.respondWith(cacheFirst(request, COVERS_CACHE, {
      event,
      maxEntries: MAX_COVER_CACHE_ENTRIES
    }));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(shellFirstOrRuntime(request));
    return;
  }
});
