#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const expected = Object.freeze({
  build: "audiofix351-20260718",
  shell: "infra-shell-20260718-audio351",
  albums: 31,
  tracks: 283
});

function fail(message) {
  throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function walk(directory, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(filePath, predicate));
    else if (!predicate || predicate(filePath)) files.push(filePath);
  }
  return files;
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) fail(`${label} failed`);
}

function verifyCatalog() {
  const catalog = readJson("public/data/catalog.json");
  const tracks = readJson("public/data/tracks.json");
  const durations = readJson("public/data/track-durations.json");
  const catalogAlbums = Array.isArray(catalog.albums) ? catalog.albums : [];
  const trackAlbums = Array.isArray(tracks.albums) ? tracks.albums : [];
  const durationTracks = Array.isArray(durations.tracks) ? durations.tracks : [];
  const flattenedTracks = trackAlbums.flatMap((album) => album.tracks || []);

  if (catalogAlbums.length !== expected.albums) {
    fail(`catalog has ${catalogAlbums.length} albums instead of ${expected.albums}`);
  }
  if (trackAlbums.length !== expected.albums) {
    fail(`tracks.json has ${trackAlbums.length} albums instead of ${expected.albums}`);
  }
  if (flattenedTracks.length !== expected.tracks) {
    fail(`tracks.json has ${flattenedTracks.length} tracks instead of ${expected.tracks}`);
  }
  if (durations.trackCount !== expected.tracks || durationTracks.length !== expected.tracks) {
    fail(`duration catalogue is not aligned on ${expected.tracks} tracks`);
  }

  const catalogByPage = new Map(catalogAlbums.map((album) => [album.page, album]));
  const pages = new Set();
  const covers = new Set();

  for (const album of trackAlbums) {
    const catalogAlbum = catalogByPage.get(album.page);
    if (!catalogAlbum) fail(`album page is missing from catalog.json: ${album.page}`);
    if (catalogAlbum.thumb !== album.cover) {
      fail(`cover mismatch for ${album.page}: ${catalogAlbum.thumb} != ${album.cover}`);
    }
    if (!/\/[^/]+-cover-1200\.webp$/.test(album.cover || "")) {
      fail(`album does not use a canonical 1200 WebP: ${album.page}`);
    }
    const coverPath = path.join(publicRoot, album.cover);
    const pagePath = path.join(publicRoot, album.page);
    if (!fs.existsSync(coverPath)) fail(`missing canonical cover: ${album.cover}`);
    if (!fs.existsSync(pagePath)) fail(`missing album document: ${album.page}`);
    pages.add(album.page);
    covers.add(album.cover);
  }

  if (pages.size !== expected.albums) fail("album page references are not unique");
  if (covers.size !== expected.albums) fail("canonical cover references are not unique");

  const trackSources = flattenedTracks.map((track) => track.src);
  if (new Set(trackSources).size !== trackSources.length) {
    fail("audio source paths are not unique");
  }
  const durationSources = new Set(durationTracks.map((track) => track.src));
  for (const source of trackSources) {
    if (!durationSources.has(source)) fail(`duration is missing for ${source}`);
  }

  console.log(`Catalog checks passed: ${expected.albums} albums / ${expected.tracks} tracks.`);
}

function verifyVersions() {
  const scripts = fs.readFileSync(path.join(publicRoot, "assets/js/scripts.js"), "utf8");
  const sw = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
  if (!scripts.includes(`window.INFRA_BUILD_TAG = "${expected.build}"`)) {
    fail(`runtime build is not ${expected.build}`);
  }
  if (!sw.includes(`const VERSION = "${expected.shell}"`)) {
    fail(`Service Worker is not ${expected.shell}`);
  }

  const htmlFiles = walk(publicRoot, (filePath) => filePath.endsWith(".html"));
  let playerDocuments = 0;
  for (const filePath of htmlFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("assets/js/scripts.js?v=")) continue;
    playerDocuments += 1;
    if (!source.includes(`assets/js/scripts.js?v=${expected.build}`)) {
      fail(`stale runtime reference in ${path.relative(root, filePath)}`);
    }
  }
  if (playerDocuments < expected.albums + 1) {
    fail(`only ${playerDocuments} player documents reference the current runtime`);
  }
  console.log(`Version checks passed across ${playerDocuments} player documents.`);
}

function verifyNoLegacyRuntimeCovers() {
  const textFiles = walk(publicRoot, (filePath) =>
    /\.(?:css|html|js|json|webmanifest)$/i.test(filePath)
  );
  const legacyReferences = [];
  for (const filePath of textFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (/cover-(?:480|900)\.webp/.test(source)) {
      legacyReferences.push(path.relative(root, filePath));
    }
  }
  if (legacyReferences.length) {
    fail(`legacy 480/900 runtime cover references: ${legacyReferences.join(", ")}`);
  }

  const tracks = readJson("public/data/tracks.json");
  const expectedCovers = new Set(
    (tracks.albums || []).map((album) => String(album.cover || "").replace(/^\/+/, ""))
  );
  const musicRoot = path.join(publicRoot, "assets/music");
  const physicalCovers = new Set(
    walk(musicRoot, (filePath) => {
      const relativeMusicPath = path.relative(musicRoot, filePath);
      return !relativeMusicPath.startsWith(`sources${path.sep}`) &&
        /cover.*\.(?:webp|jpe?g|png)$/i.test(path.basename(filePath));
    }).map((filePath) => path.relative(publicRoot, filePath).split(path.sep).join("/"))
  );

  const extras = [...physicalCovers].filter((cover) => !expectedCovers.has(cover));
  const missing = [...expectedCovers].filter((cover) => !physicalCovers.has(cover));
  if (
    expectedCovers.size !== expected.albums ||
    physicalCovers.size !== expected.albums ||
    extras.length ||
    missing.length
  ) {
    fail(
      `canonical cover inventory mismatch ` +
      `(expected=${expectedCovers.size}, physical=${physicalCovers.size}, ` +
      `extras=${extras.join(",") || "none"}, missing=${missing.join(",") || "none"})`
    );
  }

  console.log(
    `Canonical cover policy passed: ${physicalCovers.size} physical covers, ` +
    "one per album, no 480/900 runtime reference."
  );
}

function verifySyntax() {
  const javascript = walk(path.join(publicRoot, "assets/js"), (filePath) =>
    filePath.endsWith(".js")
  );
  javascript.push(path.join(publicRoot, "sw.js"));
  for (const filePath of javascript) {
    run(`syntax ${path.relative(root, filePath)}`, process.execPath, ["--check", filePath]);
  }
  console.log(`JavaScript syntax checks passed: ${javascript.length} files.`);
}

function runRegressionSuite() {
  const tests = [
    "tools/test-audio-prefetch-cache.js",
    "tools/test-audio-prefetch-sw.js",
    "tools/test-audio-telemetry-privacy.js",
    "tools/test-audiofix330-runtime.js",
    "tools/test-audiofix337-spa.js",
    "tools/test-catalog-loader-startup.js",
    "tools/test-favorites-page-ui.js",
    "tools/test-spa-page-cache.js",
    "tools/verify-audio-stability.js",
    "tools/verify-public-boundary.js"
  ];
  for (const test of tests) run(test, process.execPath, [test]);
  console.log(`Regression suite passed: ${tests.length} checks.`);
}

function main() {
  verifyVersions();
  verifyCatalog();
  verifyNoLegacyRuntimeCovers();
  verifySyntax();
  runRegressionSuite();
  run("git diff check", "git", ["diff", "--check"]);
  console.log(`Release audit passed for ${expected.build}.`);
}

try {
  main();
} catch (error) {
  console.error(`Release audit failed: ${error.message}`);
  process.exitCode = 1;
}
