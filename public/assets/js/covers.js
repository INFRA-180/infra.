(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const constants = Object.freeze({
    CACHE_NAME: "infra-covers-v2",
    CANONICAL_WIDTH: 1200,
    SESSION_PREPARE_ENABLED: true,
    SESSION_PREPARE_CONCURRENCY: 3,
    SESSION_NAVIGATION_GATE_ENABLED: true
  });

  function getLocationHref(options) {
    const opts = options || {};
    return String(
      opts.currentHref ||
      (globalObject.location && globalObject.location.href) ||
      ""
    );
  }

  function getLocationOrigin(options) {
    const opts = options || {};
    return String(
      opts.currentOrigin ||
      (globalObject.location && globalObject.location.origin) ||
      ""
    );
  }

  function getBaseUrl(options) {
    const opts = options || {};
    return opts.baseUrl || getLocationHref(opts);
  }

  function toAbsoluteUrlOrEmpty(urlLike, options) {
    const raw = String(urlLike || "").trim();
    if (!raw) return "";

    const opts = options || {};
    if (typeof opts.toAbsoluteUrlOrEmpty === "function") {
      const resolved = opts.toAbsoluteUrlOrEmpty(raw);
      if (resolved) return resolved;
    }

    try {
      return new URL(raw, getLocationHref(opts)).href;
    } catch (_err) {
      return "";
    }
  }

  function rewriteLegacyMusicAssetsPath(parsedUrl, options) {
    const currentOrigin = getLocationOrigin(options);
    if (!parsedUrl || parsedUrl.origin !== currentOrigin) return;
    if (/^\/music\/assets\//i.test(parsedUrl.pathname)) {
      parsedUrl.pathname = parsedUrl.pathname.replace(/^\/music\/assets\//i, "/assets/");
      parsedUrl.search = "";
      parsedUrl.hash = "";
    }

    // Old live/session payloads sometimes stored a GitHub Pages artwork as
    // `/assets/...`, losing the repository prefix (`/infra./`). Repair only
    // same-origin assets and derive the prefix from the runtime base URL.
    if (!/^\/assets\//i.test(parsedUrl.pathname)) return;
    try {
      const runtimeBase = new URL(getBaseUrl(options), getLocationHref(options));
      let basePath = String(runtimeBase.pathname || "/");
      if (!basePath.endsWith("/")) {
        basePath = basePath.slice(0, basePath.lastIndexOf("/") + 1) || "/";
      }
      if (basePath === "/") return;
      const prefix = `/${basePath.replace(/^\/+|\/+$/g, "")}`;
      parsedUrl.pathname = `${prefix}${parsedUrl.pathname}`;
      parsedUrl.search = "";
      parsedUrl.hash = "";
    } catch (_err) {
      // Keep the original URL if the runtime base itself is invalid.
    }
  }

  function getFallbackArtwork(options) {
    return String((options && options.fallbackArtwork) || "").trim();
  }

  function getArtworkType(urlValue) {
    const normalized = String(urlValue || "")
      .split("#")[0]
      .split("?")[0]
      .toLowerCase();
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
    if (normalized.endsWith(".png")) return "image/png";
    if (normalized.endsWith(".webp")) return "image/webp";
    return "image/png";
  }

  function inferArtworkSizeHint(urlValue) {
    const normalized = String(urlValue || "").toLowerCase();
    if (normalized.includes("-1200.webp")) return "1200x1200";
    if (normalized.includes("-480.webp")) return "480x480";
    if (normalized.includes("-900.webp")) return "900x900";
    if (normalized.includes("icon-192")) return "192x192";
    return "512x512";
  }

  function normalizeArtworkUrl(coverPath, options) {
    const opts = options || {};
    const fallback = getFallbackArtwork(opts);
    const raw = String(coverPath || "").trim();
    if (!raw) return fallback;

    try {
      const url = new URL(raw, getBaseUrl(opts));
      if (url.protocol === "https:" || url.protocol === "http:") {
        rewriteLegacyMusicAssetsPath(url, opts);
        return url.href;
      }
    } catch (_err) {
      // Fall through to the injected URL normalizer.
    }

    const absolute = toAbsoluteUrlOrEmpty(raw, opts);
    if (!absolute) return fallback;

    try {
      const url = new URL(absolute, getLocationHref(opts));
      if (url.protocol === "https:" || url.protocol === "http:") {
        rewriteLegacyMusicAssetsPath(url, opts);
        return url.href;
      }
    } catch (_err) {
      // Ignore invalid artwork URLs.
    }

    return fallback;
  }

  function buildResponsiveCoverCandidate(urlValue, targetWidth, options) {
    const opts = options || {};
    const absolute = toAbsoluteUrlOrEmpty(urlValue || "", opts);
    if (!absolute) return "";
    let parsed = null;
    try {
      parsed = new URL(absolute, getLocationHref(opts));
    } catch (_err) {
      return "";
    }
    rewriteLegacyMusicAssetsPath(parsed, opts);

    const path = String(parsed.pathname || "");
    if (!/\/assets\/music\//i.test(path)) return "";
    // One immutable artwork URL per album keeps every surface and cache entry
    // coherent. Callers may still pass a historical width, but album artwork
    // always resolves to the canonical 1200 px WebP.
    const width = constants.CANONICAL_WIDTH;

    if (/\/assets\/music\/responsive\//i.test(path)) {
      const replaced = path
        .replace(/-\d+\.webp$/i, `-${width}.webp`)
        .replace(/\.jpe?g$/i, `-${width}.webp`)
        .replace(/\.png$/i, `-${width}.webp`);
      if (replaced !== path) {
        parsed.pathname = replaced;
        parsed.search = "";
        parsed.hash = "";
        return parsed.href;
      }
      return parsed.href;
    }

    const fileName = path.split("/").pop() || "";
    const dotAt = fileName.lastIndexOf(".");
    if (dotAt <= 0) return "";
    const stem = fileName.slice(0, dotAt);
    const marker = "/assets/music/";
    const markerAt = path.toLowerCase().indexOf(marker);
    const prefix = markerAt >= 0 ? path.slice(0, markerAt) : "";
    parsed.pathname = `${prefix}/assets/music/responsive/${stem}-${width}.webp`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  }

  function normalizeCoverUrl(coverPath, options) {
    const opts = options || {};
    const normalized = normalizeArtworkUrl(coverPath || "", opts);
    if (!normalized) return "";

    const fallback = getFallbackArtwork(opts);
    if (
      fallback &&
      typeof opts.srcMatches === "function" &&
      opts.srcMatches(normalized, fallback)
    ) {
      return normalized;
    }
    if (opts.responsive === false) return normalized;

    const responsive = buildResponsiveCoverCandidate(normalized, constants.CANONICAL_WIDTH, opts);
    return responsive || normalized;
  }

  globalObject.InfraCovers = Object.freeze({
    constants,
    getArtworkType,
    inferArtworkSizeHint,
    normalizeArtworkUrl,
    normalizeCoverUrl,
    buildResponsiveCoverCandidate
  });
})();
