#!/usr/bin/env node
"use strict";

const { codeHas, codeIndexOf, codeMatch, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const runtimeSource = require("./build/app-sources.js").runtimeSource(); // scripts.js + modules runtime/
const serviceWorkerSource = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
const catalogBaseline = JSON.parse(fs.readFileSync(path.join(publicRoot, "data/catalog.json"), "utf8"));
const tracksBaseline = JSON.parse(fs.readFileSync(path.join(publicRoot, "data/tracks.json"), "utf8"));
const buildMatch = codeMatch(runtimeSource, /window\.INFRA_BUILD_TAG = "([^"]+)";/);
const shellMatch = codeMatch(serviceWorkerSource, /const VERSION = "([^"]+)";/);
const expected = Object.freeze({
  build: buildMatch ? buildMatch[1] : "",
  shell: shellMatch ? shellMatch[1] : "",
  albums: Array.isArray(catalogBaseline.albums) ? catalogBaseline.albums.length : 0,
  tracks: Array.isArray(tracksBaseline.albums)
    ? tracksBaseline.albums.flatMap((album) => album.tracks || []).length
    : 0
});

if (!codeTest(/^audiofix\d+-\d{8}$/, expected.build)) fail(`invalid runtime build: ${expected.build || "missing"}`);
if (!codeTest(/^infra-shell-\d{8}-audio\d+$/, expected.shell)) fail(`invalid shell build: ${expected.shell || "missing"}`);
if (expected.albums < 31 || expected.tracks < 284) fail("catalogue regressed below the published baseline");

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
    if (!codeTest(/\/[^/]+-cover-1200\.webp$/, album.cover || "")) {
      fail(`album does not use a canonical 1200 WebP: ${album.page}`);
    }
    const coverPath = path.join(publicRoot, album.cover);
    const pagePath = path.join(publicRoot, album.page);
    if (!fs.existsSync(coverPath)) fail(`missing canonical cover: ${album.cover}`);
    if (!fs.existsSync(pagePath)) fail(`missing album document: ${album.page}`);
    const pageSource = fs.readFileSync(pagePath, "utf8");
    const pageCoverSrc = `../${album.cover}`;
    if (!codeHas(pageSource, `<link rel="preload" href="${pageCoverSrc}" as="image" type="image/webp" fetchpriority="high" />`)) {
      fail(`album cover preload is missing from ${album.page}`);
    }
    if (!codeHas(pageSource, `<img class="cover" width="1200" height="1200" src="${pageCoverSrc}" loading="eager" decoding="sync" fetchpriority="high"`)) {
      fail(`album hero dimensions/decoding contract is missing from ${album.page}`);
    }
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

function verifyBuiltApp() {
  // app.js doit correspondre à ses sources (sinon : npm run build) et garder l'ordre d'origine.
  const { sourceFiles, sourcesDigest } = require("./build/app-sources.js");
  const app = fs.readFileSync(path.join(publicRoot, "assets/js/app.js"), "utf8");
  const stamp = (codeMatch(app, /^\/\*! INFRA\. app\.js [^\n]*sources:([0-9a-f]{16}) \*\//) || [])[1];
  if (stamp !== sourcesDigest()) fail("public/assets/js/app.js is not up to date with its sources: run npm run build");
  const order = sourceFiles().map((file) => path.basename(file));
  const visualizer = codeIndexOf(order, "audio-visualizer.js");
  const transport = codeIndexOf(order, "transport-ui.js");
  if (visualizer < 0 || transport < 0 || visualizer > transport) fail("desktop visualizer is not bundled before transport");
  if (order[order.length - 1] !== "scripts.js") fail("scripts.js must stay last in app.js");
  console.log(`Built app.js matches its ${order.length} sources (${stamp}).`);
}

function verifyVersions() {
  const scripts = require("./build/app-sources.js").runtimeSource();
  const sw = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
  if (!codeHas(scripts, `window.INFRA_BUILD_TAG = "${expected.build}"`)) {
    fail(`runtime build is not ${expected.build}`);
  }
  if (!codeHas(sw, `const VERSION = "${expected.shell}"`)) {
    fail(`Service Worker is not ${expected.shell}`);
  }
  if (!codeHas(scripts, `const SPA_SHELL_VERSION = "${expected.shell}"`)) {
    fail(`runtime Service Worker contract is not ${expected.shell}`);
  }
  if (!codeHas(scripts, 'const AUDIO_BASE = "https://infra180-api.pages.dev/audio"')) {
    fail("runtime audio origin is not the Worker R2 proxy");
  }
  if (codeHas(scripts, ".r2.dev") || codeHas(sw, ".r2.dev")) {
    fail("non-production r2.dev audio endpoint remains in the active runtime");
  }

  const htmlFiles = walk(publicRoot, (filePath) => filePath.endsWith(".html"));
  let playerDocuments = 0;
  for (const filePath of htmlFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (!codeHas(source, "assets/js/app.js?v=")) continue;
    playerDocuments += 1;
    // Chantier JavaScript (INFRA, 10/11/2026) : une seule balise, le fichier construit par Vite.
    if (!codeHas(source, `assets/js/app.js?v=${expected.build}`)) {
      fail(`stale runtime reference in ${path.relative(root, filePath)}`);
    }
    const legacyTag = codeMatch(source, /assets\/js\/(?!app\.js|bibliotheque\.js|sphragis\.js)[a-z-]+\.js\?v=/);
    if (legacyTag) fail(`individual runtime script still loaded in ${path.relative(root, filePath)}: ${legacyTag[0]}`);
  }
  if (playerDocuments < expected.albums + 1) {
    fail(`only ${playerDocuments} player documents reference the current runtime`);
  }
  console.log(`Version checks passed across ${playerDocuments} player documents.`);
}

function verifyCriticalStartupPath() {
  const styles = fs.readFileSync(path.join(publicRoot, "assets/css/styles.css"), "utf8");
  if (codeTest(/^\s*@import\s+/im, styles) || codeTest(/fonts\.googleapis\.com/i, styles)) {
    fail("critical stylesheet must not depend on a remote CSS import");
  }

  const htmlFiles = walk(publicRoot, (filePath) => filePath.endsWith(".html"));
  let playerDocuments = 0;
  for (const filePath of htmlFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (!codeHas(source, "assets/js/app.js?v=")) continue;
    playerDocuments += 1;
    const blockingRuntimeScript = codeMatch(source, /<script\s+src="[^"]*assets\/js\/[^"]+"(?![^>]*\bdefer\b)[^>]*><\/script>/i);
    if (blockingRuntimeScript) {
      fail(`parser-blocking runtime script in ${path.relative(root, filePath)}: ${blockingRuntimeScript[0]}`);
    }
    if (!codeHas(source, 'infra:launch-watchdog:v1') || !codeHas(source, `build:"${expected.build}"`)) {
      fail(`startup watchdog is missing or stale in ${path.relative(root, filePath)}`);
    }
    if (codeTest(/maximum-scale\s*=|user-scalable\s*=\s*no/i, source)) {
      fail(`viewport zoom is disabled in ${path.relative(root, filePath)}`);
    }
  }
  if (!playerDocuments) fail("no player document found for startup-path verification");

  console.log(`Critical startup path passed: local CSS and deferred scripts across ${playerDocuments} player documents.`);
}

function verifyAudioVisuals() {
  const legacyVisualDataPath = path.join(publicRoot, "data/audio-visuals.json");
  const visualizerSource = fs.readFileSync(
    path.join(root, "src/js/audio-visualizer.js"),
    "utf8"
  );
  if (fs.existsSync(legacyVisualDataPath)) {
    fail("precomputed audio visual data is still shipped");
  }
  if (
    !codeHas(visualizerSource, "window.AudioContext || window.webkitAudioContext") ||
    !codeHas(visualizerSource, "createMediaElementSource(audio)") ||
    !codeHas(visualizerSource, "createAnalyser()") ||
    !codeHas(visualizerSource, "source.connect(context.destination)") ||
    !codeHas(visualizerSource, "source.connect(analyser)") ||
    !codeHas(visualizerSource, "getByteFrequencyData") ||
    !codeHas(visualizerSource, "getByteTimeDomainData") ||
    !codeHas(visualizerSource, 'crossOrigin || "").toLowerCase() !== "anonymous"') ||
    !codeHas(visualizerSource, "(prefers-reduced-motion: reduce)") ||
    !codeHas(visualizerSource, "FRAME_INTERVAL_MS = 1000 / 30") ||
    !codeHas(visualizerSource, "ENERGY_ATTACK_SECONDS = 0.045") ||
    !codeHas(visualizerSource, "ENERGY_RELEASE_SECONDS = 0.26") ||
    !codeHas(visualizerSource, "SPECTRUM_SPATIAL_KERNEL = Object.freeze([1, 4, 6, 4, 1])") ||
    !codeHas(visualizerSource, "smoothSpectrumSpatially(points)") ||
    !codeHas(visualizerSource, "FFT_SIZE = 2048") ||
    !codeHas(visualizerSource, "MIN_FREQUENCY_HZ = 40") ||
    !codeHas(visualizerSource, "MAX_FREQUENCY_HZ = 16000") ||
    !codeHas(visualizerSource, "Math.pow(ratioRange") ||
    !codeHas(visualizerSource, "const centerY = size.height * 0.5") ||
    !codeHas(visualizerSource, "size.height * 0.25") ||
    !codeHas(visualizerSource, "const PURE_FFT_MODE = true") ||
    !codeHas(visualizerSource, "POWDER_EARTH_PARTICLE_COUNT = 250000") ||
    !codeHas(visualizerSource, "POWDER_MOON_PARTICLE_COUNT = 250000") ||
    !codeHas(visualizerSource, "POWDER_PARTICLE_COUNT = 500000") ||
    !codeHas(visualizerSource, "POWDER_HELIX_PARTICLE_COUNT = 60000") ||
    !codeHas(visualizerSource, "createPowderParticles(PURE_FFT_MODE ? 0 : POWDER_PARTICLE_COUNT)") ||
    !codeHas(visualizerSource, "height: new Float32Array(particleCount)") ||
    !codeHas(visualizerSource, "side: new Uint8Array(particleCount)") ||
    !codeHas(visualizerSource, "gravityClass: new Uint8Array(particleCount)") ||
    !codeHas(visualizerSource, "helixOffset: new Float32Array(particleCount)") ||
    !codeHas(visualizerSource, "helixBaseSin: new Float32Array(particleCount)") ||
    !codeHas(visualizerSource, "bandIndex: new Uint16Array(particleCount)") ||
    !codeHas(visualizerSource, "powderContext.createImageData(width, height)") ||
    !codeHas(visualizerSource, "EARTH_GRAVITY_METERS_PER_SECOND2 = 9.80665") ||
    !codeHas(visualizerSource, "MOON_GRAVITY_METERS_PER_SECOND2 = 1.62") ||
    !codeHas(visualizerSource, "updatePowderBandMap(values.length)") ||
    !codeHas(visualizerSource, "powderContainmentEnvelope[index] = Math.max(") ||
    !codeHas(visualizerSource, "Math.sqrt(") ||
    !codeHas(visualizerSource, "velocity -= gravity * step") ||
    !codeHas(visualizerSource, "(sides[index] ? 1 : -1)") ||
    !codeHas(visualizerSource, "powderHelixRotationPhase") ||
    !codeHas(visualizerSource, "HELIX_DRIVE_ATTACK_SECONDS = 0.09") ||
    !codeHas(visualizerSource, "frameHeight * (0.035 + signal * 0.18)") ||
    !codeHas(visualizerSource, "targetOffset - helixOffset") ||
    !codeHas(visualizerSource, "const restingOpacity = moving ? 1 : 0.34") ||
    !codeHas(visualizerSource, "drawingContext.quadraticCurveTo(") ||
    !codeHas(visualizerSource, "powderContainmentRawEnvelope[index],") ||
    !codeHas(visualizerSource, "drawingContext.drawImage(") ||
    !codeHas(visualizerSource, "if (!PURE_FFT_MODE) {\n        updatePowderPhysics(") ||
    !codeHas(visualizerSource, "if (!PURE_FFT_MODE) drawPowder(size, centerY);") ||
    codeHas(visualizerSource, "drawingContext.clip()") ||
    codeHas(visualizerSource, 'drawingContext.strokeStyle = "rgba(255,255,255,0.13)"') ||
    !codeHas(visualizerSource, "document.hidden")
  ) {
    fail("desktop live visualizer is missing its audio graph or lifecycle guards");
  }
  if (codeTest(/analyser\.connect\s*\(\s*context\.destination/, visualizerSource)) {
    fail("desktop analyser creates a duplicate audible destination path");
  }

  console.log("Desktop pure FFT policy passed: live analyser, no median line, no particle allocation.");
}

function verifyNoLegacyRuntimeCovers() {
  const textFiles = walk(publicRoot, (filePath) =>
    codeTest(/\.(?:css|html|js|json|webmanifest)$/i, filePath)
  );
  const legacyReferences = [];
  for (const filePath of textFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (codeTest(/cover-(?:480|900)\.webp/, source)) {
      legacyReferences.push(path.relative(root, filePath));
    }
  }
  if (legacyReferences.length) {
    fail(`legacy 480/900 runtime cover references: ${legacyReferences.join(", ")}`);
  }

  const tracks = readJson("public/data/tracks.json");
  const scripts = require("./build/app-sources.js").runtimeSource();
  const home = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
  const homeCatalog = fs.readFileSync(path.join(root, "src/js/home-catalog.js"), "utf8");
  const sw = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
  const expectedCovers = new Set(
    (tracks.albums || []).map((album) => String(album.cover || "").replace(/^\/+/, ""))
  );
  const musicRoot = path.join(publicRoot, "assets/music");
  const physicalCovers = new Set(
    walk(musicRoot, (filePath) => {
      const relativeMusicPath = path.relative(musicRoot, filePath);
      return !relativeMusicPath.startsWith(`sources${path.sep}`) &&
        codeTest(/cover.*\.(?:webp|jpe?g|png)$/i, path.basename(filePath));
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
  const allowlistMatch = codeMatch(sw, /const CANONICAL_COVER_PATHS = new Set\(\[([\s\S]*?)\]\);/);
  if (!allowlistMatch) fail("Service Worker canonical cover allowlist is missing");
  const cachedCovers = new Set(JSON.parse(`[${allowlistMatch[1]}]`));
  const unexpectedCached = [...cachedCovers].filter((cover) => !expectedCovers.has(cover));
  const uncachedCanonical = [...expectedCovers].filter((cover) => !cachedCovers.has(cover));
  if (cachedCovers.size !== expected.albums || unexpectedCached.length || uncachedCanonical.length) {
    fail(
      `Service Worker cover allowlist mismatch ` +
      `(cached=${cachedCovers.size}, unexpected=${unexpectedCached.join(",") || "none"}, ` +
      `missing=${uncachedCanonical.join(",") || "none"})`
    );
  }
  if (
    !codeHas(sw, `const MAX_COVER_CACHE_ENTRIES = ${expected.albums}`) ||
    !codeHas(sw, "await reconcileCoverCache()") ||
    !codeHas(scripts, "const ALBUM_COVER_IMAGE_CACHE_LIMIT = 4") ||
    !codeHas(scripts, "const ALBUM_COVER_PREPARE_LIMIT = 2") ||
    !codeHas(scripts, "covers.slice(0, Math.min(ALBUM_COVER_PREPARE_LIMIT, covers.length))")
  ) {
    fail("bounded cover cache/warmup policy is incomplete");
  }
  const homeAlbumImages = [...home.matchAll(/<img class="album-thumb album-cover"[^>]+>/g)].map((match) => match[0]);
  const eagerHomeCovers = homeAlbumImages.filter((tag) => codeTest(/\ssrc="/, tag));
  const deferredHomeCovers = homeAlbumImages.filter((tag) => codeTest(/\sdata-cover-src="/, tag));
  const deferredPlaylistTiles = [...home.matchAll(/<img class="playlist-cover-tile"[^>]+>/g)]
    .filter((match) => codeTest(/\sdata-cover-src="/, match[0]));
  if (
    homeAlbumImages.length !== expected.albums ||
    eagerHomeCovers.length !== 2 ||
    deferredHomeCovers.length !== expected.albums - 2 ||
    eagerHomeCovers.filter((tag) => codeTest(/fetchpriority="high"/, tag)).length !== 1 ||
    eagerHomeCovers.filter((tag) => codeTest(/fetchpriority="auto"/, tag)).length !== 1 ||
    deferredPlaylistTiles.length !== 16 ||
    !codeHas(homeCatalog, 'querySelectorAll("img[data-cover-src]")') ||
    !codeHas(homeCatalog, 'rootMargin: "320px 0px"')
  ) {
    fail("home cover network deferral policy is incomplete");
  }

  console.log(
    `Canonical cover policy passed: ${physicalCovers.size} physical covers, ` +
    "one per album, exact SW allowlist, warmup capped at 2, offscreen network deferred."
  );
}

function verifySyntax() {
  const javascript = walk(path.join(publicRoot, "assets/js"), (filePath) =>
    filePath.endsWith(".js")
  ).concat(walk(path.join(root, "src/js"), (filePath) => filePath.endsWith(".js"))); // lot E : sources dans src/js
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
    "tools/test-home-album-swipe.js",
    "tools/test-cover-square-contract.js",
    "tools/test-home-clips.js",
    "tools/test-music-playlists.js",
    "tools/test-queue-reorder-input.js",
    "tools/test-favorites-page-ui.js",
    "tools/test-bibliotheque.js",
    "tools/test-bibliotheque-thumbnails.js",
    "tools/test-share-qr-ui.js",
    "tools/test-spa-page-cache.js",
    "tools/test-service-worker-update-lifecycle.js",
    "tools/test-audiofix402-fluidity.js",
    "tools/test-transport-pip.js",
    "tools/test-bump-version.js",
    "tools/test-code-text.js",
    "tools/verify-audio-stability.js",
    "tools/verify-public-boundary.js"
  ];
  for (const test of tests) run(test, process.execPath, [test]);
  console.log(`Regression suite passed: ${tests.length} checks.`);
}

function main() {
  verifyBuiltApp();
  verifyVersions();
  verifyCriticalStartupPath();
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
