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
  const match = scripts.match(/const LOCAL_CATALOG_VERSION = "([^"]+)"/);
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

  assert(!albumUi.includes("track-controls"), "album UI must not inject transport controls");
  assert(!albumUi.includes("data-track-prev"), "album UI must not own previous-track control");
  assert(covers.includes("function createRuntime(context)"), "covers module must own the cover runtime");
  assert(scripts.includes("const coverRuntimeApi = createCoverRuntimeApi();"), "scripts must bootstrap the cover runtime");
  assert(!scripts.includes("function warmAlbumCoverCache(reason)"), "cover cache runtime must not remain in scripts.js");
  assert(!css.includes(".track-controls"), "unused album transport CSS remains");
  assert(!css.includes(".track-ctrl"), "unused album transport control CSS remains");
  assert(serviceWorker.includes(`./data/catalog.json?v=${version}`), "service worker catalog version differs");
  assert(serviceWorker.includes(`./data/tracks.json?v=${version}`), "service worker tracks version differs");
  assert(serviceWorker.includes(`./data/track-durations.json?v=${version}`), "service worker duration version differs");
  assert(telemetry.includes("const RETRY_INTERVAL_MS = 5 * 60 * 1000"), "telemetry retry cadence is not bounded");
  assert(telemetry.includes('document.visibilityState === "hidden"'), "telemetry must flush when the app is hidden");
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
