const VERSION = "infra-shell-20260714-audio315";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const COVERS_CACHE = "infra-covers";
const NEXT_TRACK_CACHE = "infra-next-track-segments-v5";
const MAX_COVER_CACHE_ENTRIES = 80;
const R2_AUDIO_HOST = "pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./sphragis/",
  "./sphragis/index.html",
  "./assets/css/sphragis.css?v=sphragis20260625",
  "./assets/css/styles.css?v=audiofix315-20260714",
  "./assets/js/covers.js?v=audiofix315-20260714",
  "./assets/js/favorites.js?v=audiofix315-20260714",
  "./assets/js/favorites-ui.js?v=audiofix315-20260714",
  "./assets/js/transport-ui.js?v=audiofix315-20260714",
  "./assets/js/now-playing.js?v=audiofix315-20260714",
  "./assets/js/album-player-ui.js?v=audiofix315-20260714",
  "./assets/js/spa-renderer.js?v=audiofix315-20260714",
  "./assets/js/audio-radio.js?v=audiofix315-20260714",
  "./assets/js/media-session.js?v=audiofix315-20260714",
  "./assets/js/audio-prefetch.js?v=audiofix315-20260714",
  "./assets/js/spa-router.js?v=audiofix315-20260714",
  "./assets/js/catalog-fallback.js?v=audiofix315-20260714",
  "./assets/js/catalog-loader.js?v=audiofix315-20260714",
  "./assets/js/audio-telemetry.js?v=audiofix315-20260714",
  "./assets/js/downloads.js?v=audiofix315-20260714",
  "./assets/js/home-catalog.js?v=audiofix315-20260714",
  "./assets/js/audio-core.js?v=audiofix315-20260714",
  "./assets/js/pwa-install.js?v=audiofix315-20260714",
  "./assets/js/share-qr.js?v=audiofix315-20260714",
  "./assets/js/scripts.js?v=audiofix315-20260714",
  "./assets/js/scripts.admin.js?v=audiofix315-20260714",
  "./assets/vendor/qr-creator.min.js?v=1.0.0",
  "./assets/js/sphragis.js?v=sphragis20260625",
  "./assets/fonts/antique-olive-nord.woff2",
  "./manifest.webmanifest",
  "./data/catalog.json",
  "./data/track-durations.json?v=audiofix315-20260714",
  "./data/tracks.json?v=audiofix315-20260714",
  "./assets/branding/infra-logo-white-photoroom-title.png",
  "./assets/pwa/favicon-logo-white-64.png",
  "./assets/pwa/icon-192-logo-white.png",
  "./assets/pwa/icon-512-logo-white.png",
  "./assets/pwa/icon-maskable-192-logo-white.png",
  "./assets/pwa/icon-maskable-512-logo-white.png",
  "./assets/pwa/apple-touch-icon-180-logo-white.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async function () {
      const keys = await caches.keys();
      const previousVersionedCaches = keys
        .filter((key) => isVersionedSiteCache(key) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .sort()
        .reverse()
        .slice(0, 2);
      const cachesToKeep = new Set([SHELL_CACHE, RUNTIME_CACHE].concat(previousVersionedCaches));
      await Promise.all(
        keys
          .filter((key) => isVersionedSiteCache(key) && !cachesToKeep.has(key))
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

function isResponsiveCoverAsset(url) {
  const path = String((url && url.pathname) || "");
  return /\/assets\/music\/responsive\/[^/]+-cover-(?:480|900)\.webp$/i.test(path);
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

async function htmlCacheFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    });

  if (cached) {
    networkPromise.catch(() => undefined);
    return cached;
  }

  try {
    return await networkPromise;
  } catch (_err) {
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
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

function notifyPrefetchHit(url, details) {
  const payload = Object.assign({ type: "INFRA_PREFETCH_HIT", url }, details || {});
  self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => clients.forEach((client) => {
      try {
        client.postMessage(payload);
      } catch (_err) {
        // Ignore telemetry delivery failures.
      }
    }))
    .catch(() => undefined);
}

function parseRangeHeader(rangeHeader, total) {
  const match = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !Number.isFinite(total) || total <= 0) return null;
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);

  if (start === null && end === null) return null;
  if (start === null) {
    if (!Number.isFinite(end) || end <= 0) return null;
    start = Math.max(0, total - end);
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
    // Network fallback remains authoritative.
  }
}

async function buildRangeResponseFromCachedAudio(cached, rangeHeader) {
  const storedLength = Number(cached.headers.get("Content-Length") || cached.headers.get("content-length") || 0);
  const partial = cached.headers.get("X-Infra-Audio-Partial") === "1";
  const cachedStart = partial ? Number(cached.headers.get("X-Infra-Range-Start") || 0) : 0;
  const cachedEnd = partial
    ? Number(cached.headers.get("X-Infra-Range-End") || (cachedStart + storedLength - 1))
    : storedLength - 1;
  const total = partial ? Number(cached.headers.get("X-Infra-Total-Length") || 0) : storedLength;
  const range = parseRangeHeader(rangeHeader, total);
  if (!range || !Number.isFinite(storedLength) || storedLength <= 0) return null;
  if (!Number.isFinite(cachedStart) || !Number.isFinite(cachedEnd) || cachedEnd < cachedStart) return null;
  if (range.start < cachedStart || range.start > cachedEnd) return null;

  const responseEnd = Math.min(range.end, cachedEnd);
  const buffer = await cached.arrayBuffer();
  if (!buffer || buffer.byteLength !== storedLength || storedLength !== (cachedEnd - cachedStart + 1)) {
    throw new Error("cached_audio_corrupt");
  }
  const sliced = buffer.slice(range.start - cachedStart, responseEnd - cachedStart + 1);
  const headers = new Headers();
  headers.set("Content-Type", cached.headers.get("Content-Type") || "audio/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${range.start}-${responseEnd}/${total}`);
  headers.set("Content-Length", String(sliced.byteLength));
  headers.set("Access-Control-Allow-Origin", cached.headers.get("Access-Control-Allow-Origin") || "*");
  headers.set("Access-Control-Expose-Headers", "Accept-Ranges,Content-Range,Content-Length,Content-Type,ETag");
  const etag = cached.headers.get("ETag");
  if (etag) headers.set("ETag", etag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(sliced, { status: 206, statusText: "Partial Content", headers });
}

async function servePrefetchedAudioOrNetwork(request, url) {
  const cache = await caches.open(NEXT_TRACK_CACHE);
  let cached = null;
  try {
    cached = await cache.match(request, { ignoreVary: true }) || await cache.match(url.href, { ignoreVary: true });
  } catch (_err) {
    return fetch(request);
  }
  if (!cached || !cached.ok) return fetch(request);

  const rangeHeader = request.headers.get("Range") || request.headers.get("range") || "";
  if (rangeHeader) {
    try {
      const partial = await buildRangeResponseFromCachedAudio(cached.clone(), rangeHeader);
      if (partial) {
        notifyPrefetchHit(url.href, { range: true, range_header: rangeHeader, status: 206, strategy: "startup_segment" });
        return partial;
      }
    } catch (_err) {
      await deletePrefetchedAudio(cache, request, url);
    }
    return fetch(request);
  }

  if (cached.headers.get("X-Infra-Audio-Partial") === "1") return fetch(request);
  return cached;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request) return;
  const url = new URL(request.url);
  if (url.hostname === R2_AUDIO_HOST) {
    if (request.method === "GET") event.respondWith(servePrefetchedAudioOrNetwork(request, url));
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
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
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
