#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const expected = [
  { slug: "infra-moon", name: "INFRA ☾", symbol: "☾", asset: "playlist-sign-moon-512.png", archivedCover: "playlist-cover-moon-1200.webp", covers: ["v-23pi56-cover-1200.webp", "anunnaki-cover-1200.webp", "kali-cover-1200.webp", "asase-yaa-cover-1200.webp"], count: 108, first: "AIRE", last: "زيتون" },
  { slug: "infra-sun", name: "INFRA ☀", symbol: "☀", asset: "playlist-sign-sun-512.png", archivedCover: "playlist-cover-sun-1200.webp", covers: ["ballades-cover-1200.webp", "h-1-008-cover-1200.webp", "he-4-0026-cover-1200.webp", "naviguer-cover-1200.webp"], count: 29, first: "LIBERTA", last: "ΜΑΣΣΑΛΙΑ" },
  { slug: "infra-snow", name: "INFRA ❄", symbol: "❄", asset: "playlist-sign-snow-512.png", archivedCover: "playlist-cover-snow-1200.webp", covers: ["adc-13-6e983f31-cover-1200.webp", "cyberpunk-cover-1200.webp", "h-1-008-cover-1200.webp", "ldc13-cover-1200.webp"], count: 45, first: "Moteur", last: "VESTA" },
  { slug: "infra-falcon", name: "INFRA 𓅃", symbol: "𓅃", asset: "playlist-sign-falcon-512.png", archivedCover: "playlist-cover-falcon-1200.webp", covers: ["abricot-cover-1200.webp", "black-stallion-cover-1200.webp", "cerises-cover-1200.webp", "impression-cover-1200.webp"], count: 52, first: "Haut", last: "RECONTRE" }
];

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const playlistData = readJson("public/data/playlists.json");
const tracksData = readJson("public/data/tracks.json");
const playlists = Array.isArray(playlistData.playlists) ? playlistData.playlists : [];

if (playlistData.source !== "Music macOS user playlists (read-only)") {
  fail("playlist export is not marked read-only");
}
if (playlistData.playlistCount !== 4 || playlists.length !== 4) {
  fail(`expected 4 playlists, found ${playlists.length}`);
}
if (playlistData.trackOccurrences !== 234) {
  fail(`expected 234 playlist occurrences, found ${playlistData.trackOccurrences}`);
}
if (read("public/data/playlists.json").includes("musicPersistentID")) {
  fail("public playlist data exposes Music persistent IDs");
}

const catalogTracks = new Map();
for (const album of tracksData.albums || []) {
  for (const track of album.tracks || []) {
    catalogTracks.set(track.src, { album, track });
  }
}

const seenSources = new Set();
for (let playlistIndex = 0; playlistIndex < expected.length; playlistIndex += 1) {
  const contract = expected[playlistIndex];
  const playlist = playlists[playlistIndex];
  if (!playlist || playlist.slug !== contract.slug || playlist.name !== contract.name || playlist.symbol !== contract.symbol) {
    fail(`playlist ${playlistIndex + 1} identity or order is incorrect`);
  }
  if (playlist.count !== contract.count || playlist.tracks.length !== contract.count) {
    fail(`${contract.name} has ${playlist.tracks.length} tracks instead of ${contract.count}`);
  }
  if (playlist.tracks[0].title !== contract.first || playlist.tracks.at(-1).title !== contract.last) {
    fail(`${contract.name} does not preserve Music.app ordering`);
  }
  if (Object.hasOwn(playlist, "cover")) {
    fail(`${contract.name} still exposes a dedicated playlist cover`);
  }
  if (!fs.existsSync(path.join(publicRoot, "assets/branding", contract.asset))) {
    fail(`${contract.name} is missing its stable sign asset: ${contract.asset}`);
  }
  if (!fs.existsSync(path.join(publicRoot, "assets/branding", contract.archivedCover))) {
    fail(`${contract.name} archived cover was not preserved: ${contract.archivedCover}`);
  }
  const firstDistinctCovers = [];
  const seenAlbums = new Set();
  playlist.tracks.forEach((track) => {
    if (seenAlbums.has(track.albumSlug) || firstDistinctCovers.length >= 4) return;
    seenAlbums.add(track.albumSlug);
    firstDistinctCovers.push(path.basename(track.artwork));
  });
  if (JSON.stringify(firstDistinctCovers) !== JSON.stringify(contract.covers)) {
    fail(`${contract.name} first four distinct album covers changed: ${firstDistinctCovers.join(", ")}`);
  }
  contract.covers.forEach((cover) => {
    if (!fs.existsSync(path.join(publicRoot, "assets/music/responsive", cover))) {
      fail(`${contract.name} is missing an album cover: ${cover}`);
    }
  });

  playlist.tracks.forEach((playlistTrack, trackIndex) => {
    if (playlistTrack.position !== trackIndex + 1) {
      fail(`${contract.name} has an invalid position at ${trackIndex + 1}`);
    }
    const catalogMatch = catalogTracks.get(playlistTrack.src);
    if (!catalogMatch) fail(`${contract.name} references an unknown source: ${playlistTrack.src}`);
    if (catalogMatch.album.title !== playlistTrack.album || catalogMatch.track.title !== playlistTrack.title) {
      fail(`${contract.name} metadata mismatch at position ${playlistTrack.position}`);
    }
    seenSources.add(playlistTrack.src);
  });

  const pageRelative = `public/playlists/${contract.slug}.html`;
  const page = read(pageRelative);
  if (!page.includes('<body class="album-screen playlist-screen"')) {
    fail(`${pageRelative} is not initialized as a playlist screen`);
  }
  if (!page.includes(`data-playlist-slug="${contract.slug}"`) || !page.includes(`<h1 class="playlist-visible-title" aria-label="${contract.name}">${contract.symbol}</h1>`)) {
    fail(`${pageRelative} has incorrect playlist metadata`);
  }
  if (!page.includes("assets/css/playlists.css?v=playlist-collage-20260802")) {
    fail(`${pageRelative} does not load the playlist collage styles`);
  }
  const pageCovers = [...page.matchAll(/class="playlist-cover-tile" src="\.\.\/assets\/music\/responsive\/([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(pageCovers) !== JSON.stringify(contract.covers) || page.includes("playlist-cover-image")) {
    fail(`${pageRelative} does not render its four-album mosaic`);
  }
  if ((page.match(/class="playlist-cover-tile"[^>]+loading="eager"/g) || []).length !== 4 || (page.match(/class="playlist-cover-tile"[^>]+fetchpriority="high"/g) || []).length !== 1) {
    fail(`${pageRelative} has incorrect hero mosaic loading priorities`);
  }
  const publicLogoUrl = "https://infra-180.github.io/infra./assets/pwa/icon-512-logo-white.png";
  if (!page.includes(`<meta property="og:image" content="${publicLogoUrl}"`) || !page.includes(`<meta name="twitter:image" content="${publicLogoUrl}"`)) {
    fail(`${pageRelative} does not expose the generic INFRA image in social metadata`);
  }
  if (page.includes(contract.archivedCover) || page.includes(`"image": "${publicLogoUrl}"`)) {
    fail(`${pageRelative} still exposes a dedicated cover or schema image`);
  }
  const rows = page.match(/class="track-player playlist-track"/g) || [];
  if (rows.length !== contract.count) {
    fail(`${pageRelative} renders ${rows.length} rows instead of ${contract.count}`);
  }
  const renderedSources = [...page.matchAll(/<audio preload="none" data-src="\.\.\/([^"]+)"/g)].map((match) => match[1]);
  const expectedSources = playlist.tracks.map((track) => track.src);
  if (JSON.stringify(renderedSources) !== JSON.stringify(expectedSources)) {
    fail(`${pageRelative} does not preserve playlist source order`);
  }
  if (!page.includes("assets/js/audio-visualizer.js?v=") || !page.includes("assets/js/album-player-ui.js?v=")) {
    fail(`${pageRelative} is missing the shared player runtime`);
  }
}

if (seenSources.size !== 225) {
  fail(`expected 225 unique sources across playlists, found ${seenSources.size}`);
}

const index = read("public/index.html");
const playlistsPosition = index.indexOf('data-module-id="playlists"');
const albumsPosition = index.indexOf('data-module-id="albums"');
if (playlistsPosition < 0 || albumsPosition < 0 || albumsPosition > playlistsPosition) {
  fail("Albums is not the first music section on the home page");
}
if (!/<section class="module one-col" data-module-id="albums">\s*<details class="albums-menu" open>/.test(index)) {
  fail("Albums is not open by default");
}
if (!/<section class="module one-col" data-module-id="playlists">\s*<details class="albums-menu playlists-menu">/.test(index) || /<details class="albums-menu playlists-menu" open>/.test(index)) {
  fail("Playlists is not closed by default");
}
for (const contract of expected) {
  if (!index.includes(`href="playlists/${contract.slug}.html"`) || !index.includes(contract.name)) {
    fail(`home page is missing ${contract.name}`);
  }
  const cardStart = index.indexOf(`href="playlists/${contract.slug}.html"`);
  const cardEnd = index.indexOf("</a>", cardStart);
  const card = index.slice(cardStart, cardEnd);
  const cardCovers = [...card.matchAll(/class="playlist-cover-tile" src="assets\/music\/responsive\/([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(cardCovers) !== JSON.stringify(contract.covers) || card.includes("playlist-cover-image") || card.includes(contract.archivedCover)) {
    fail(`home page mosaic is incorrect for ${contract.name}`);
  }
  if ((card.match(/class="playlist-cover-tile"[^>]+loading="lazy"/g) || []).length !== 4 || (card.match(/class="playlist-cover-tile"[^>]+fetchpriority="low"/g) || []).length !== 4) {
    fail(`home page mosaic loading is incorrect for collapsed ${contract.name}`);
  }
  if (!card.includes(`<span class="playlist-card-title">${contract.symbol}</span>`) || card.includes(`<span class="playlist-card-title">${contract.name}</span>`)) {
    fail(`home page does not show only the sign for ${contract.name}`);
  }
}

const homePlaylistSection = index.slice(index.indexOf("<!-- PLAYLIST_GRID_START -->"), index.indexOf("<!-- PLAYLIST_GRID_END -->"));
const homeOrder = [...homePlaylistSection.matchAll(/href="playlists\/(infra-[^"]+)\.html"/g)].map((match) => match[1]);
if (JSON.stringify(homeOrder) !== JSON.stringify(expected.map((contract) => contract.slug))) {
  fail(`home playlist order is incorrect: ${homeOrder.join(" -> ")}`);
}
const seoPlaylistSection = index.slice(index.indexOf("<!-- PLAYLIST_SEO_LINKS_START -->"), index.indexOf("<!-- PLAYLIST_SEO_LINKS_END -->"));
const seoOrder = [...seoPlaylistSection.matchAll(/href="playlists\/(infra-[^"]+)\.html"/g)].map((match) => match[1]);
if (JSON.stringify(seoOrder) !== JSON.stringify(expected.map((contract) => contract.slug))) {
  fail(`SEO playlist order is incorrect: ${seoOrder.join(" -> ")}`);
}

const playlistStyles = read("public/assets/css/playlists.css");
if (!playlistStyles.includes(".playlist-cover-tile") || !playlistStyles.includes("grid-template-columns: repeat(2") || playlistStyles.includes(".playlist-cover-image")) {
  fail("playlist album mosaics are not styled correctly");
}
for (const contract of expected) {
  if (!playlistStyles.includes(`background-image: url("../branding/${contract.asset}")`)) {
    fail(`${contract.name} does not use its stable sign asset`);
  }
}
if (!playlistStyles.includes("@media (min-width: 981px)") || !playlistStyles.includes("--playlist-sign-size: 0.74rem") || !playlistStyles.includes("--playlist-sign-size: clamp(1.2rem, 3.8vw, 1.75rem)")) {
  fail("desktop playlist titles do not follow the album title sizing");
}

const serviceWorker = read("public/sw.js");
if (!serviceWorker.includes("assets/css/playlists.css?v=playlist-collage-20260802") || !serviceWorker.includes("data/playlists.json?v=playlist-collage-20260802")) {
  fail("the PWA does not cache the current playlist stylesheet");
}
for (const contract of expected) {
  if (!serviceWorker.includes(`assets/branding/${contract.asset}`)) {
    fail(`the PWA does not cache ${contract.asset}`);
  }
  if (serviceWorker.includes(`assets/branding/${contract.archivedCover}`)) {
    fail(`the PWA still caches archived cover ${contract.archivedCover}`);
  }
}

const albumUi = read("public/assets/js/album-player-ui.js");
const audioCore = read("public/assets/js/audio-core.js");
const audioRadio = read("public/assets/js/audio-radio.js");
const scripts = read("public/assets/js/scripts.js");
if (!albumUi.includes('document.body.classList.contains("playlist-screen") ? "playlist" : "album"')) {
  fail("playlist pages do not declare their queue type");
}
if (!audioCore.includes('audioState.playlistKind !== "playlist"')) {
  fail("track starts overwrite the playlist queue type");
}
if (!audioRadio.includes('["global", "favorites", "playlist"].includes(audioState.playlistKind)')) {
  fail("playlist queues are not persisted across the session");
}
if ((scripts.match(/if \(audioState\.playlistKind !== "album"\) return -1;/g) || []).length < 2) {
  fail("album continuity can still escape a playlist queue");
}

console.log("Music playlist checks passed: 4 playlists / 234 occurrences / 225 unique tracks.");
