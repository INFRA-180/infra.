const VERSION = "infra-shell-20260714-audio310";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const COVERS_CACHE = "infra-covers";
const NEXT_TRACK_CACHE = "infra-next-track";
const MAX_COVER_CACHE_ENTRIES = 80;
const R2_AUDIO_HOST = "pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./sphragis/",
  "./sphragis/index.html",
  "./assets/css/sphragis.css?v=sphragis20260625",
  "./assets/css/styles.css?v=audiofix310-20260714",
  "./assets/js/covers.js?v=audiofix310-20260714",
  "./assets/js/favorites.js?v=audiofix310-20260714",
  "./assets/js/favorites-ui.js?v=audiofix310-20260714",
  "./assets/js/transport-ui.js?v=audiofix310-20260714",
  "./assets/js/now-playing.js?v=audiofix310-20260714",
  "./assets/js/album-player-ui.js?v=audiofix310-20260714",
  "./assets/js/spa-renderer.js?v=audiofix310-20260714",
  "./assets/js/audio-radio.js?v=audiofix310-20260714",
  "./assets/js/media-session.js?v=audiofix310-20260714",
  "./assets/js/audio-prefetch.js?v=audiofix310-20260714",
  "./assets/js/spa-router.js?v=audiofix310-20260714",
  "./assets/js/catalog-fallback.js?v=audiofix310-20260714",
  "./assets/js/catalog-loader.js?v=audiofix310-20260714",
  "./assets/js/audio-telemetry.js?v=audiofix310-20260714",
  "./assets/js/downloads.js?v=audiofix310-20260714",
  "./assets/js/home-catalog.js?v=audiofix310-20260714",
  "./assets/js/audio-core.js?v=audiofix310-20260714",
  "./assets/js/pwa-install.js?v=audiofix310-20260714",
  "./assets/js/share-qr.js?v=audiofix310-20260714",
  "./assets/js/scripts.js?v=audiofix310-20260714",
  "./assets/js/scripts.admin.js?v=audiofix310-20260714",
  "./assets/vendor/qr-creator.min.js?v=1.0.0",
  "./assets/js/sphragis.js?v=sphragis20260625",
  "./assets/fonts/antique-olive-nord.woff2",
  "./manifest.webmanifest",
  "./data/catalog.json",
  "./data/track-durations.json?v=audiofix310-20260714",
  "./data/tracks.json?v=audiofix310-20260714",
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
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async function () {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => isVersionedSiteCache(key) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
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
  const payload = Object.assign({
    type: "INFRA_PREFETCH_HIT",
    url
  }, details || {});
  self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        try {
          client.postMessage(payload);
        } catch (_err) {
          // Ignore telemetry message failures.
        }
      });
    })
    .catch(() => undefined);
}

async function deletePrefetchedAudio(cache, request, url) {
  try {
    await cache.delete(request, { ignoreVary: true });
    await cache.delete(url.href, { ignoreVary: true });
  } catch (_err) {
    // Ignore cache cleanup failures; network fallback remains authoritative.
  }
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
    await deletePrefetchedAudio(cache, request, url);
    notifyPrefetchHit(url.href, { range: true, range_header: rangeHeader, status: 0, bypass: true });
    return fetch(request);
  }

  try {
    const headers = new Headers(cached.headers);
    if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
    notifyPrefetchHit(url.href, { range: false, range_header: "", status: 200 });
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers
    });
  } catch (_err) {
    await deletePrefetchedAudio(cache, request, url);
    return fetch(request);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request) return;
  const url = new URL(request.url);
  if (url.hostname === R2_AUDIO_HOST) {
    if (request.method === "GET") {
      event.respondWith(servePrefetchedAudioOrNetwork(request, url));
    }
    return;
  }
  if (request.method !== "GET") return;
  if (!isSameOrigin(request.url)) return;

  if (isAudioAsset(request, url)) {
    // Do not intercept audio; avoids stale audio cache and fragile Range reconstruction.
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request, SHELL_CACHE, "./index.html"));
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
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }
});
