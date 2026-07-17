(function () {
  "use strict";

  function call(ctx, name) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;
    return ctx[name].apply(ctx, Array.prototype.slice.call(arguments, 2));
  }

  function createLoader(context) {
    const ctx = context || {};
    const fallbackCatalog = ctx.fallbackCatalog || { apps: [], albums: [], clips: [] };
    const catalogState = ctx.catalogState || { data: null, loadingPromise: null, quickActions: [] };
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL(".", window.location.href) };
    const WORKER_URL = String(ctx.WORKER_URL || "");
    const LIVE_CATALOG_CACHE_NAME = String(ctx.LIVE_CATALOG_CACHE_NAME || "infra-live-catalog-v1");
    const LIVE_CATALOG_TIMEOUT_MS = Number.isFinite(Number(ctx.LIVE_CATALOG_TIMEOUT_MS))
      ? Number(ctx.LIVE_CATALOG_TIMEOUT_MS)
      : 3500;
    const LOCAL_CATALOG_VERSION = String(ctx.LOCAL_CATALOG_VERSION || "");

    function normalizeAlbumTitle(value) {
      return call(ctx, "normalizeAlbumTitle", value) || String(value || "").replace(/\s+/g, " ").trim().toLocaleUpperCase();
    }

    function normalizeTrackTitle(value) {
      return call(ctx, "normalizeTrackTitle", value) || String(value || "").trim().toLocaleUpperCase();
    }

    function toRuntimeAbsoluteUrl(value) {
      return call(ctx, "toRuntimeAbsoluteUrl", value) || String(value || "");
    }

    function getAudioAssetPathKey(value, baseUrl) {
      return call(ctx, "getAudioAssetPathKey", value, baseUrl) || "";
    }

    function canonicalFavoritePath(value, baseUrl) {
      return call(ctx, "canonicalFavoritePath", value, baseUrl) || "";
    }

    function formatTrackDuration(value) {
      return call(ctx, "formatTrackDuration", value) || "--:--";
    }

    function rememberTrackDuration(srcLike, displayValue, baseUrl) {
      call(ctx, "rememberTrackDuration", srcLike, displayValue, baseUrl);
    }

    function resolveManagedAudioSrc(value, baseUrl) {
      return call(ctx, "resolveManagedAudioSrc", value, baseUrl) || String(value || "");
    }

    function getCurrentLogicalAudioSrc() {
      return call(ctx, "getCurrentLogicalAudioSrc") || "";
    }

    function normalizeCatalogCard(raw, type) {
      const fallbackSize = type === "app" ? 500 : 800;
      const rawThumb = String(raw && raw.thumb ? raw.thumb : "").trim();
      const canonicalThumb = type === "album"
        ? (call(ctx, "normalizeCoverUrl", rawThumb, { width: 1200 }) || rawThumb)
        : rawThumb;
      const card = {
        id: String(raw && raw.id ? raw.id : "").trim(),
        title: String(raw && raw.title ? raw.title : "").trim(),
        editKey: String(raw && raw.editKey ? raw.editKey : "").trim(),
        page: String(raw && raw.page ? raw.page : "").trim(),
        thumb: canonicalThumb,
        thumbAlt: String(raw && raw.thumbAlt ? raw.thumbAlt : "").trim(),
        thumbSrcset: String(raw && raw.thumbSrcset ? raw.thumbSrcset : "").trim(),
        thumbSizes: String(raw && raw.thumbSizes ? raw.thumbSizes : "").trim(),
        width: Math.max(1, Number(raw && raw.width) || fallbackSize),
        height: Math.max(1, Number(raw && raw.height) || fallbackSize),
        download: null
      };

      if (raw && raw.download && typeof raw.download === "object") {
        const typeName = String(raw.download.type || "").trim().toLowerCase() === "app_download"
          ? "app_download"
          : "download";
        const url = String(raw.download.url || "").trim();
        if (url) {
          card.download = {
            type: typeName,
            label: String(raw.download.label || "").trim(),
            appName: String(raw.download.appName || "").trim(),
            url
          };
        }
      }

      if (!card.thumbSrcset || !card.thumbSizes) {
        const responsive = deriveCatalogThumbSet(card.thumb, type);
        if (responsive.srcset && !card.thumbSrcset) card.thumbSrcset = responsive.srcset;
        if (responsive.sizes && !card.thumbSizes) card.thumbSizes = responsive.sizes;
      }

      if (!card.thumbAlt) card.thumbAlt = card.title || "INFRA";
      return card;
    }

    function deriveCatalogThumbSet(thumbPath, type) {
      const cleanThumb = String(thumbPath || "").split("?")[0];
      const responsive = { srcset: "", sizes: "" };
      if (!cleanThumb) return responsive;

      const appMatch = cleanThumb.match(/^assets\/apps\/([^/]+)\.png$/i);
      if (appMatch) {
        const base = appMatch[1];
        const small = `assets/apps/responsive/${base}-192.webp`;
        const large = `assets/apps/responsive/${base}-384.webp`;
        responsive.srcset = `${small} 192w, ${large} 384w, ${cleanThumb} 1024w`;
        responsive.sizes = "(max-width: 980px) calc(50vw - 28px), 124px";
        return responsive;
      }

      const albumMatch = cleanThumb.match(/^assets\/music\/([^/]+-cover)\.(?:jpg|jpeg|png)$/i);
      if (albumMatch) {
        const base = albumMatch[1];
        const small = `assets/music/responsive/${base}-480.webp`;
        const large = `assets/music/responsive/${base}-900.webp`;
        responsive.srcset = `${small} 480w, ${large} 900w, ${cleanThumb} 3333w`;
        responsive.sizes = type === "album"
          ? "(max-width: 980px) calc(50vw - 28px), 250px"
          : "(max-width: 980px) min(76vw, 290px), min(34vw, 430px)";
        return responsive;
      }

      return responsive;
    }

    function extractYouTubeVideoId(input) {
      const raw = String(input || "").trim();
      if (!raw) return "";
      if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

      let parsed = null;
      try {
        parsed = new URL(raw);
      } catch (_err) {
        return "";
      }

      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      const path = parsed.pathname || "";
      if (host === "youtu.be") {
        const shortId = path.replace(/^\/+/, "").split("/")[0];
        return /^[a-zA-Z0-9_-]{11}$/.test(shortId) ? shortId : "";
      }

      if (host.endsWith("youtube.com")) {
        const v = parsed.searchParams.get("v");
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

        const segments = path.split("/").filter(Boolean);
        const embedIndex = segments[0] === "embed" || segments[0] === "shorts" ? 1 : -1;
        if (embedIndex === 1 && /^[a-zA-Z0-9_-]{11}$/.test(segments[1] || "")) {
          return segments[1];
        }
      }

      return "";
    }

    function normalizeCatalogClip(raw) {
      const title = String(raw && raw.title ? raw.title : "").trim();
      const editKey = String(raw && raw.editKey ? raw.editKey : "").trim();
      const youtubeUrl = String(
        raw && raw.youtubeUrl ? raw.youtubeUrl
          : raw && raw.url ? raw.url
          : ""
      ).trim();
      const youtubeId = extractYouTubeVideoId(
        raw && raw.youtubeId ? raw.youtubeId : youtubeUrl
      );

      return {
        id: String(raw && raw.id ? raw.id : "").trim() || youtubeId,
        title,
        editKey,
        youtubeUrl,
        youtubeId
      };
    }

    function sanitizeCatalog(raw) {
      const source = raw && typeof raw === "object" ? raw : fallbackCatalog;
      const apps = Array.isArray(source.apps) ? source.apps : [];
      const albums = Array.isArray(source.albums) ? source.albums : [];
      const clips = Array.isArray(source.clips) ? source.clips : [];

      const safeApps = apps
        .map((entry) => normalizeCatalogCard(entry, "app"))
        .filter((entry) => entry.title && entry.page && entry.thumb);

      const safeAlbums = albums
        .map((entry) => normalizeCatalogCard(entry, "album"))
        .filter((entry) => entry.title && entry.page && entry.thumb);

      const safeClips = clips
        .map((entry) => normalizeCatalogClip(entry))
        .filter((entry) => entry.title && entry.youtubeId);

      if (!safeApps.length || !safeAlbums.length) {
        return sanitizeCatalog(fallbackCatalog);
      }

      return { apps: safeApps, albums: safeAlbums, clips: safeClips };
    }

    function buildQuickActions(catalog) {
      const list = [];
      const pushOpen = function (entry) {
        list.push({
          label: `Ouvrir ${entry.title}`,
          type: "open",
          url: entry.page
        });
      };
      const pushDownload = function (entry) {
        if (!entry.download || !entry.download.url) return;
        const label = entry.download.label || `Download ${entry.title}`;
        list.push({
          label,
          type: entry.download.type || "download",
          appName: entry.download.appName || entry.title,
          url: entry.download.url
        });
      };

      (catalog.apps || []).forEach(function (entry) {
        pushOpen(entry);
        pushDownload(entry);
      });
      (catalog.albums || []).forEach(function (entry) {
        pushOpen(entry);
        pushDownload(entry);
      });

      return list;
    }

    function isCatalogDocument(payload) {
      return Boolean(payload && Array.isArray(payload.apps) && Array.isArray(payload.albums));
    }

    function isTracksDocument(payload) {
      return Boolean(payload && Array.isArray(payload.albums) && payload.albums.length && payload.albums.every(function (album) {
        return album && album.slug && album.page && Array.isArray(album.tracks) && album.tracks.every(function (track) {
          return track && track.title && /^assets\/music\/streams\/.+\.m4a$/i.test(String(track.src || ""));
        });
      }));
    }

    function isDurationsDocument(payload) {
      return Boolean(payload && Array.isArray(payload.tracks) && Number(payload.trackCount) === payload.tracks.length);
    }

    function isCatalogLatestDocument(payload) {
      if (!payload || typeof payload !== "object") return false;
      const documents = payload.documents;
      if (!documents || typeof documents !== "object") return false;
      if (!isCatalogDocument(documents.catalog)) return false;
      if (!isTracksDocument(documents.tracks)) return false;
      if (!isDurationsDocument(documents.durations)) return false;
      const trackCount = documents.tracks.albums.reduce(function (total, album) {
        return total + (Array.isArray(album.tracks) ? album.tracks.length : 0);
      }, 0);
      return Boolean(
        String(payload.releaseId || "").trim() &&
        trackCount > 0 &&
        trackCount === documents.durations.tracks.length &&
        Number(documents.durations.trackCount) === trackCount &&
        documents.catalog.albums.length === documents.tracks.albums.length
      );
    }

    function catalogDocumentFromLatest(latestPayload, fileName) {
      const documents = latestPayload && latestPayload.documents ? latestPayload.documents : null;
      if (!documents) return null;
      if (fileName === "catalog.json") return documents.catalog || null;
      if (fileName === "tracks.json") return documents.tracks || null;
      if (fileName === "track-durations.json") return documents.durations || null;
      return null;
    }

    async function cacheLiveCatalogDocument(url, payload) {
      if (!("caches" in window)) return;
      try {
        const cache = await caches.open(LIVE_CATALOG_CACHE_NAME);
        await cache.put(url, new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }));
      } catch (_err) {
        // Cache Storage is an optimization; local JSON remains the final fallback.
      }
    }

    async function readCachedLiveCatalogDocument(url, validate) {
      if (!("caches" in window)) return null;
      try {
        const cache = await caches.open(LIVE_CATALOG_CACHE_NAME);
        const response = await cache.match(url);
        if (!response) return null;
        const payload = await response.json();
        return validate(payload) ? payload : null;
      } catch (_err) {
        return null;
      }
    }

    function getLiveCatalogLatestUrl() {
      if (!WORKER_URL) return "";
      return `${WORKER_URL.replace(/\/+$/, "")}/catalog/latest`;
    }

    function readCachedLiveCatalogLatest() {
      const url = getLiveCatalogLatestUrl();
      if (!url) return Promise.resolve(null);
      return readCachedLiveCatalogDocument(url, isCatalogLatestDocument);
    }

    async function fetchLiveCatalogLatest() {
      if (catalogState.latestCatalogPayload) return catalogState.latestCatalogPayload;
      if (catalogState.latestCatalogPromise) return catalogState.latestCatalogPromise;
      if (!WORKER_URL) return Promise.reject(new Error("live catalog worker unavailable"));

      const url = getLiveCatalogLatestUrl();
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(function () { controller.abort(); }, LIVE_CATALOG_TIMEOUT_MS) : 0;
      catalogState.latestCatalogPromise = (async function () {
        try {
          const response = await fetch(url, {
            cache: "no-store",
            signal: controller ? controller.signal : undefined,
            headers: { "Accept": "application/json" }
          });
          if (!response.ok) throw new Error(`live catalog latest fetch failed: ${response.status}`);
          const payload = await response.json();
          if (!isCatalogLatestDocument(payload)) throw new Error("live catalog latest validation failed");
          cacheLiveCatalogDocument(url, payload);
          catalogState.latestCatalogPayload = payload;
          return payload;
        } catch (_err) {
          const cached = await readCachedLiveCatalogDocument(url, isCatalogLatestDocument);
          if (cached) {
            catalogState.latestCatalogPayload = cached;
            return cached;
          }
          throw _err;
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      })().finally(function () {
        catalogState.latestCatalogPromise = null;
      });

      return catalogState.latestCatalogPromise;
    }

    async function fetchLocalCatalogDocument(fileName) {
      const url = new URL(`data/${fileName}`, runtime.baseUrl);
      if (fileName !== "catalog.json") url.searchParams.set("v", LOCAL_CATALOG_VERSION);
      const response = await fetch(url.href, {
        cache: "default",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`local catalog fetch failed: ${response.status}`);
      return response.json();
    }

    async function fetchLocalCatalogBundle() {
      if (catalogState.localCatalogPayload) return catalogState.localCatalogPayload;
      if (catalogState.localCatalogPromise) return catalogState.localCatalogPromise;

      catalogState.localCatalogPromise = Promise.all([
        fetchLocalCatalogDocument("catalog.json"),
        fetchLocalCatalogDocument("tracks.json"),
        fetchLocalCatalogDocument("track-durations.json")
      ]).then(function (results) {
        const payload = {
          schemaVersion: 1,
          releaseId: `local-${LOCAL_CATALOG_VERSION || "catalog"}`,
          documents: {
            catalog: results[0],
            tracks: results[1],
            durations: results[2]
          }
        };
        if (!isCatalogLatestDocument(payload)) throw new Error("local catalog bundle validation failed");
        catalogState.localCatalogPayload = payload;
        return payload;
      }).finally(function () {
        catalogState.localCatalogPromise = null;
      });

      return catalogState.localCatalogPromise;
    }

    async function loadCatalogBundle() {
      if (catalogState.catalogBundlePayload) return catalogState.catalogBundlePayload;
      if (catalogState.catalogBundlePromise) return catalogState.catalogBundlePromise;

      catalogState.catalogBundlePromise = (async function () {
        const results = await Promise.all([
          fetchLocalCatalogBundle().catch(function () { return null; }),
          readCachedLiveCatalogLatest().catch(function () { return null; })
        ]);
        const local = results[0];
        const cachedLive = results[1];
        const startupBundle = cachedLive || local;
        if (startupBundle) {
          catalogState.catalogBundlePayload = startupBundle;
          catalogState.catalogBundleSource = cachedLive ? "live-cache" : "local";
          catalogState.catalogBundleReleaseId = startupBundle.releaseId || "";
          // Refresh /catalog/latest only after a local CacheStorage/shell source
          // is ready. It updates the next launch without rebuilding this one.
          fetchLiveCatalogLatest().catch(function () {});
          return startupBundle;
        }

        // With neither shell JSON nor a validated live cache, network is the
        // exceptional blocking fallback instead of a normal startup gate.
        const live = await fetchLiveCatalogLatest();
        catalogState.catalogBundlePayload = live;
        catalogState.catalogBundleSource = "live";
        catalogState.catalogBundleReleaseId = live.releaseId || "";
        return live;
      })().finally(function () {
        catalogState.catalogBundlePromise = null;
      });

      return catalogState.catalogBundlePromise;
    }

    async function fetchLiveCatalogDocument(fileName, validate) {
      const latest = await loadCatalogBundle();
      const payload = catalogDocumentFromLatest(latest, fileName);
      if (!payload || (typeof validate === "function" && !validate(payload))) {
        throw new Error(`catalog document unavailable: ${fileName}`);
      }
      return payload;
    }

    async function loadCatalogData() {
      if (catalogState.data) return catalogState.data;
      if (catalogState.loadingPromise) return catalogState.loadingPromise;

      catalogState.loadingPromise = (async function () {
        let payload = null;
        try {
          payload = await fetchLiveCatalogDocument("catalog.json", isCatalogDocument);
        } catch (_err) {
          payload = fallbackCatalog;
        }

        const safe = sanitizeCatalog(payload);
        catalogState.data = safe;
        catalogState.quickActions = buildQuickActions(safe);
        return safe;
      })().finally(function () {
        catalogState.loadingPromise = null;
      });

      return catalogState.loadingPromise;
    }

    async function loadTracksData() {
      if (audioState.tracksData) return audioState.tracksData;
      if (audioState.tracksLoadingPromise) return audioState.tracksLoadingPromise;

      audioState.tracksLoadingPromise = (async function () {
        let payload;
        try {
          payload = await fetchLiveCatalogDocument("tracks.json", isTracksDocument);
        } catch (_err) {
          payload = await fetchLocalCatalogDocument("tracks.json");
        }
        audioState.tracksData = payload || {};
        indexTrackMetadata(audioState.tracksData);
        return audioState.tracksData;
      })().catch(function () {
        audioState.tracksData = {};
        indexTrackMetadata(audioState.tracksData);
        return audioState.tracksData;
      }).finally(function () {
        audioState.tracksLoadingPromise = null;
      });

      return audioState.tracksLoadingPromise;
    }

    function indexTrackMetadata(tracksData) {
      const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
      const index = new Map();

      albums.forEach(function (album) {
        const tracks = Array.isArray(album && album.tracks) ? album.tracks : [];
        const albumTitle = normalizeAlbumTitle(album && album.title ? album.title : "");
        const albumPage = album && album.page ? toRuntimeAbsoluteUrl(album.page) : "";
        const albumArtwork = album && album.cover ? toRuntimeAbsoluteUrl(album.cover) : "";

        tracks.forEach(function (track) {
          if (!track || !track.src) return;
          const assetKey = getAudioAssetPathKey(track.src, runtime.baseUrl);
          const favoriteKey = canonicalFavoritePath(track.src, runtime.baseUrl.href);
          if (!assetKey || !favoriteKey) return;
          const durationDisplay = String(track.duration || "").trim() || formatTrackDuration(track.seconds);
          if (durationDisplay && durationDisplay !== "--:--") {
            rememberTrackDuration(track.src, durationDisplay, runtime.baseUrl);
          }
          const metadata = {
            src: resolveManagedAudioSrc(track.src, runtime.baseUrl.href),
            name: normalizeTrackTitle(track.title || track.name || ""),
            album: albumTitle,
            page: albumPage,
            artist: "INFRA.",
            artwork: albumArtwork,
            duration: durationDisplay,
            seconds: Number(track.seconds)
          };
          index.set(assetKey, metadata);
          index.set(favoriteKey, metadata);
        });
      });

      audioState.trackMetaByAssetPath = index;
    }

    function getTrackMetaByAssetPath(srcLike, baseUrl) {
      const assetKey = getAudioAssetPathKey(srcLike || "", baseUrl || window.location.href);
      const favoriteKey = canonicalFavoritePath(srcLike || "", baseUrl || window.location.href);
      return (favoriteKey && audioState.trackMetaByAssetPath.get(favoriteKey)) ||
        (assetKey && audioState.trackMetaByAssetPath.get(assetKey)) ||
        null;
    }

    function mergeTrackMetadata(track) {
      const source = track || {};
      const meta = getTrackMetaByAssetPath(source.src || getCurrentLogicalAudioSrc()) || {};
      return Object.assign({}, meta, source, {
        name: normalizeTrackTitle(source.name || source.title || meta.name || ""),
        album: normalizeAlbumTitle(source.album || meta.album || ""),
        page: source.page || meta.page || "",
        artist: source.artist || meta.artist || "INFRA.",
        artwork: source.artwork || meta.artwork || ""
      });
    }



    return {
      normalizeCatalogCard,
      deriveCatalogThumbSet,
      normalizeCatalogClip,
      sanitizeCatalog,
      buildQuickActions,
      isCatalogDocument,
      isTracksDocument,
      isDurationsDocument,
      isCatalogLatestDocument,
      fetchLiveCatalogLatest,
      fetchLiveCatalogDocument,
      fetchLocalCatalogDocument,
      loadCatalogBundle,
      loadCatalogData,
      loadTracksData,
      indexTrackMetadata,
      getTrackMetaByAssetPath,
      mergeTrackMetadata
    };
  }

  window.InfraCatalogLoader = {
    createLoader
  };
})();
