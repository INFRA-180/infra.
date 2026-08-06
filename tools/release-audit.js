#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const expected = Object.freeze({
  build: "audiofix386-20260806",
  shell: "infra-shell-20260806-audio386",
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
    const visualizerIndex = source.indexOf(`assets/js/audio-visualizer.js?v=${expected.build}`);
    const transportIndex = source.indexOf(`assets/js/transport-ui.js?v=${expected.build}`);
    if (visualizerIndex < 0 || transportIndex < 0 || visualizerIndex > transportIndex) {
      fail(`desktop visualizer is not loaded before transport in ${path.relative(root, filePath)}`);
    }
  }
  if (playerDocuments < expected.albums + 1) {
    fail(`only ${playerDocuments} player documents reference the current runtime`);
  }
  console.log(`Version checks passed across ${playerDocuments} player documents.`);
}

function verifyAudioVisuals() {
  const legacyVisualDataPath = path.join(publicRoot, "data/audio-visuals.json");
  const visualizerSource = fs.readFileSync(
    path.join(publicRoot, "assets/js/audio-visualizer.js"),
    "utf8"
  );
  if (fs.existsSync(legacyVisualDataPath)) {
    fail("precomputed audio visual data is still shipped");
  }
  if (
    !visualizerSource.includes("window.AudioContext || window.webkitAudioContext") ||
    !visualizerSource.includes("createMediaElementSource(audio)") ||
    !visualizerSource.includes("createAnalyser()") ||
    !visualizerSource.includes("source.connect(context.destination)") ||
    !visualizerSource.includes("source.connect(analyser)") ||
    !visualizerSource.includes("getByteFrequencyData") ||
    !visualizerSource.includes("getByteTimeDomainData") ||
    !visualizerSource.includes('crossOrigin || "").toLowerCase() !== "anonymous"') ||
    !visualizerSource.includes("(prefers-reduced-motion: reduce)") ||
    !visualizerSource.includes("FRAME_INTERVAL_MS = 1000 / 30") ||
    !visualizerSource.includes("ENERGY_ATTACK_SECONDS = 0.045") ||
    !visualizerSource.includes("ENERGY_RELEASE_SECONDS = 0.26") ||
    !visualizerSource.includes("SPECTRUM_SPATIAL_KERNEL = Object.freeze([1, 4, 6, 4, 1])") ||
    !visualizerSource.includes("smoothSpectrumSpatially(points)") ||
    !visualizerSource.includes("FFT_SIZE = 2048") ||
    !visualizerSource.includes("MIN_FREQUENCY_HZ = 40") ||
    !visualizerSource.includes("MAX_FREQUENCY_HZ = 16000") ||
    !visualizerSource.includes("Math.pow(ratioRange") ||
    !visualizerSource.includes("const centerY = size.height * 0.5") ||
    !visualizerSource.includes("size.height * 0.25") ||
    !visualizerSource.includes("const PURE_FFT_MODE = true") ||
    !visualizerSource.includes("POWDER_EARTH_PARTICLE_COUNT = 250000") ||
    !visualizerSource.includes("POWDER_MOON_PARTICLE_COUNT = 250000") ||
    !visualizerSource.includes("POWDER_PARTICLE_COUNT = 500000") ||
    !visualizerSource.includes("POWDER_HELIX_PARTICLE_COUNT = 60000") ||
    !visualizerSource.includes("createPowderParticles(PURE_FFT_MODE ? 0 : POWDER_PARTICLE_COUNT)") ||
    !visualizerSource.includes("height: new Float32Array(particleCount)") ||
    !visualizerSource.includes("side: new Uint8Array(particleCount)") ||
    !visualizerSource.includes("gravityClass: new Uint8Array(particleCount)") ||
    !visualizerSource.includes("helixOffset: new Float32Array(particleCount)") ||
    !visualizerSource.includes("helixBaseSin: new Float32Array(particleCount)") ||
    !visualizerSource.includes("bandIndex: new Uint16Array(particleCount)") ||
    !visualizerSource.includes("powderContext.createImageData(width, height)") ||
    !visualizerSource.includes("EARTH_GRAVITY_METERS_PER_SECOND2 = 9.80665") ||
    !visualizerSource.includes("MOON_GRAVITY_METERS_PER_SECOND2 = 1.62") ||
    !visualizerSource.includes("updatePowderBandMap(values.length)") ||
    !visualizerSource.includes("powderContainmentEnvelope[index] = Math.max(") ||
    !visualizerSource.includes("Math.sqrt(") ||
    !visualizerSource.includes("velocity -= gravity * step") ||
    !visualizerSource.includes("(sides[index] ? 1 : -1)") ||
    !visualizerSource.includes("powderHelixRotationPhase") ||
    !visualizerSource.includes("HELIX_DRIVE_ATTACK_SECONDS = 0.09") ||
    !visualizerSource.includes("frameHeight * (0.035 + (signal * 0.18))") ||
    !visualizerSource.includes("targetOffset - helixOffset") ||
    !visualizerSource.includes("const restingOpacity = moving ? 1 : 0.34") ||
    !visualizerSource.includes("drawingContext.quadraticCurveTo(") ||
    !visualizerSource.includes("powderContainmentRawEnvelope[index],") ||
    !visualizerSource.includes("drawingContext.drawImage(") ||
    !visualizerSource.includes("if (!PURE_FFT_MODE) {\n        updatePowderPhysics(") ||
    !visualizerSource.includes("if (!PURE_FFT_MODE) drawPowder(size, centerY);") ||
    visualizerSource.includes("drawingContext.clip()") ||
    visualizerSource.includes('drawingContext.strokeStyle = "rgba(255,255,255,0.13)"') ||
    !visualizerSource.includes("document.hidden")
  ) {
    fail("desktop live visualizer is missing its audio graph or lifecycle guards");
  }
  if (/analyser\.connect\s*\(\s*context\.destination/.test(visualizerSource)) {
    fail("desktop analyser creates a duplicate audible destination path");
  }

  console.log("Desktop pure FFT policy passed: live analyser, no median line, no particle allocation.");
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
    "tools/test-audio-visualizer.js",
    "tools/test-audiofix330-runtime.js",
    "tools/test-audiofix337-spa.js",
    "tools/test-catalog-loader-startup.js",
    "tools/test-home-clips.js",
    "tools/test-music-playlists.js",
    "tools/test-queue-reorder-input.js",
    "tools/test-favorites-page-ui.js",
    "tools/test-share-qr-ui.js",
    "tools/test-spa-page-cache.js",
    "tools/test-transport-pip.js",
    "tools/verify-audio-stability.js",
    "tools/verify-public-boundary.js"
  ];
  for (const test of tests) run(test, process.execPath, [test]);
  console.log(`Regression suite passed: ${tests.length} checks.`);
}

function main() {
  verifyVersions();
  verifyCatalog();
  verifyAudioVisuals();
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
