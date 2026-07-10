#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function readJson(relative) {
  return JSON.parse(read(relative));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countMatches(value, expression) {
  return (value.match(expression) || []).length;
}

function readReleaseVersion() {
  const scripts = read("public/assets/js/scripts.js");
  const match = scripts.match(/(?:const\s+LOCAL_CATALOG_VERSION\s*=|LOCAL_CATALOG_VERSION\s*:)\s*"([^"]+)"/);
  assert(match, "LOCAL_CATALOG_VERSION is missing from scripts.js");
  return match[1];
}

function verifyGeneratedCatalog(version) {
  const catalog = readJson("public/data/catalog.json");
  const tracks = readJson("public/data/tracks.json");
  const durations = readJson("public/data/track-durations.json");
  const albums = Array.isArray(tracks.albums) ? tracks.albums : [];
  const totalTracks = albums.reduce((total, album) => total + (Array.isArray(album.tracks) ? album.tracks.length : 0), 0);

  assert(catalog.albums.length === albums.length, "catalog and tracks album counts differ");
  assert(totalTracks === Number(durations.trackCount), "tracks and duration counts differ");
  assert(totalTracks === durations.tracks.length, "duration entries do not cover every track");
  assert(tracks.version === version, "tracks.json version differs from the runtime version");
  assert(durations.version === version, "track-durations.json version differs from the runtime version");

  for (const album of albums) {
    const relativePage = String(album && album.page || "");
    const pagePath = path.join(publicRoot, relativePage);
    const expectedTracks = Array.isArray(album.tracks) ? album.tracks.length : 0;

    assert(fs.existsSync(pagePath), `missing album page: ${relativePage}`);
    const page = fs.readFileSync(pagePath, "utf8");
    const renderedTracks = countMatches(page, /class="track-player"/g);
    const jsonLdMatch = page.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);

    assert(renderedTracks === expectedTracks, `${relativePage}: rendered track count differs`);
    assert(jsonLdMatch, `${relativePage}: MusicAlbum JSON-LD is missing`);
    assert(Number(JSON.parse(jsonLdMatch[1]).numTracks) === expectedTracks, `${relativePage}: JSON-LD track count differs`);
  }

  return { albums: albums.length, tracks: totalTracks };
}

function verifyRuntimeWiring(version) {
  const albumUi = read("public/assets/js/album-player-ui.js");
  const covers = read("public/assets/js/covers.js");
  const css = read("public/assets/css/styles.css");
  const scripts = read("public/assets/js/scripts.js");
  const serviceWorker = read("public/sw.js");
  const telemetry = read("public/assets/js/audio-telemetry.js");
  const mediaSession = read("public/assets/js/media-session.js");
  const audioCore = read("public/assets/js/audio-core.js");
  const audioRadio = read("public/assets/js/audio-radio.js");
  const audioPrefetch = read("public/assets/js/audio-prefetch.js");
  const pwaRuntime = read("public/assets/js/pwa-runtime.js");
  const siteRuntime = read("public/assets/js/site-runtime.js");
  const spaController = read("public/assets/js/spa-controller.js");
  const performancePolicy = read("public/assets/js/performance-policy.js");

  assert(!albumUi.includes("track-controls"), "album UI must not inject transport controls");
  assert(!albumUi.includes("data-track-prev"), "album UI must not own previous-track control");
  assert(covers.includes("function createRuntime(context)"), "covers module must own the cover runtime");
  assert(scripts.includes("coverRuntimeApi"), "scripts must bootstrap the cover runtime");
  assert(!scripts.includes("function warmAlbumCoverCache(reason)"), "cover cache runtime must not remain in scripts.js");
  assert(!css.includes(".track-controls"), "unused album transport CSS remains");
  assert(!css.includes(".track-ctrl"), "unused album transport control CSS remains");
  assert(serviceWorker.includes(`./data/catalog.json?v=${version}`), "service worker catalog version differs");
  assert(serviceWorker.includes(`./data/tracks.json?v=${version}`), "service worker tracks version differs");
  assert(serviceWorker.includes(`./data/track-durations.json?v=${version}`), "service worker duration version differs");
  assert(telemetry.includes("const RETRY_INTERVAL_MS = 5 * 60 * 1000"), "telemetry retry cadence is not bounded");
  assert(telemetry.includes('document.visibilityState === "hidden"'), "telemetry must flush when the app is hidden");
  assert(scripts.split(/\r?\n/).length <= 2500, "scripts.js exceeds the 2,500-line bootstrap limit");
  assert(pwaRuntime.includes("function createPwaRuntime(context)"), "PWA runtime factory is missing");
  assert(siteRuntime.includes("function createSiteRuntime(context)"), "site runtime factory is missing");
  assert(spaController.includes("function createSpaController(context)"), "SPA controller factory is missing");
  assert(performancePolicy.includes("function createPerformancePolicy(options)"), "performance policy factory is missing");
  assert(performancePolicy.includes('"save-data"'), "save-data mode is missing from performance policy");
  assert(performancePolicy.includes("spaHome: 12") && performancePolicy.includes("spaHome: 4"), "SPA prefetch budgets are missing");
  assert(performancePolicy.includes("METRIC_SAMPLE_RATE = 0.25"), "performance metric sampling is missing");
  assert(telemetry.includes('"perf_audio_start"') && telemetry.includes('"perf_cover_render"'), "performance telemetry events are missing");
  assert(mediaSession.includes("function createMediaSessionRuntime(context)"), "Media Session runtime factory is missing");
  assert(audioCore.includes("const PREVIOUS_RESTART_THRESHOLD_SECONDS = 3"), "previous-track restart threshold is missing");
  assert(audioPrefetch.includes('CACHE_NAME: "infra-next-track-v2"'), "segmented audio warmup cache is missing");
  assert(audioPrefetch.includes("WARMUP_BYTES: 512 * 1024"), "audio startup warmup budget is missing");
  assert(audioPrefetch.includes("status: 200") && audioPrefetch.includes("cachedResponse"), "partial warmup responses must be normalized before Cache.put");
  assert(audioRadio.includes('if (reason === "playing") return true;'), "N+1 warmup must start on real playback");
  assert(serviceWorker.includes("cachedRangeMatch"), "service worker must preserve partial audio range metadata");
  assert(audioCore.includes("const isDirectStart = opts.waitForReadiness !== true"), "normal playback must use the direct start path");
  assert(audioCore.includes('if (!hasPreparedTarget && !isPreparedInitialRandom && PREFETCH_NEXT_ENABLED)'), "incomplete N+1 must be cancelled without blocking playback");
  assert(audioCore.includes("const shouldFastSourceSwitch = isDirectStart"), "normal source switches must not pause before playback");
  assert(!audioCore.includes("IOS_INITIAL_READINESS_TIMEOUT_MS"), "slow iOS readiness wait must not block normal playback");
  assert(!audioCore.includes("audio.src = nextSrc;\n            loadMediaElementForPlayback(audio);"), "normal source assignment must not force media reload");
  assert(!audioRadio.includes('performancePolicy.decide("audio"'), "performance policy must not override historic N+1 timing");
  assert(audioRadio.includes('audioState.homeMode === "radio"') && audioRadio.includes("startRadioPlaybackFromIdle();"), "cold radio play must stay in radio mode");
  assert(audioRadio.includes("getActiveMediaRequestContext"), "media events must be scoped to the active source request");
  assert(mediaSession.includes("if (!recovery.hadProgress) return"), "startup waiting must not trigger destructive recovery");
  assert(mediaSession.includes("recovery.requestToken !== state.startRequestToken"), "waiting recovery must be request-scoped");
  assert(albumUi.includes("syncCurrentTrackDurationFromAudio(audio, srcOverride)"), "duration metadata must be source-scoped");
  assert(audioCore.includes('trackAudioRuntimeEvent("track_restart_previous"'), "previous-track restart telemetry is missing");
  assert(!scripts.includes("function registerServiceWorker() {\n    if (serviceWorkerRegistered)"), "legacy Service Worker lifecycle remains in scripts.js");
  assert(!scripts.includes("function initSpaNavigation() {\n    if (!spaState.enabled)"), "legacy SPA controller remains in scripts.js");
  assert(spaController.includes(".album-cover"), "SPA cover normalization must include home album covers");

  const pages = ["public/index.html"]
    .concat(fs.readdirSync(path.join(publicRoot, "music")).filter((file) => file.endsWith(".html")).map((file) => `public/music/${file}`))
    .concat(fs.readdirSync(path.join(publicRoot, "apps")).filter((file) => file.endsWith(".html")).map((file) => `public/apps/${file}`));
  for (const relative of pages) {
    const html = read(relative);
    for (const file of ["performance-policy.js", "pwa-runtime.js", "site-runtime.js", "spa-controller.js"]) {
      assert(countMatches(html, new RegExp(`${file.replace(".", "\\.")}`, "g")) === 1, `${relative}: ${file} must be loaded once`);
      assert(html.indexOf(file) < html.indexOf("scripts.js"), `${relative}: ${file} must load before scripts.js`);
    }
  }
  for (const file of ["performance-policy.js", "pwa-runtime.js", "site-runtime.js", "spa-controller.js"]) {
    assert(serviceWorker.includes(`./assets/js/${file}?v=${version}`), `service worker does not precache ${file}`);
  }
  assert(serviceWorker.includes("const OPTIONAL_SHELL_ASSETS"), "service worker optional precache manifest is missing");
  const requiredShell = serviceWorker.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
  assert(requiredShell && !requiredShell[1].includes("share-qr.js"), "optional QR assets must not block shell installation");
  assert(serviceWorker.includes("warmOptionalShellAssets"), "service worker optional warmup is missing");
}

try {
  const version = readReleaseVersion();
  const catalog = verifyGeneratedCatalog(version);
  verifyRuntimeWiring(version);
  console.log(JSON.stringify({ ok: true, version, catalog }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
