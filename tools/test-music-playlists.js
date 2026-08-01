#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const expected = [
  { slug: "infra-sun", name: "INFRA ☀", symbol: "☀", count: 29, first: "LIBERTA", last: "ΜΑΣΣΑΛΙΑ", covers: ["ballades-cover-1200.webp", "h-1-008-cover-1200.webp", "he-4-0026-cover-1200.webp", "naviguer-cover-1200.webp"] },
  { slug: "infra-moon", name: "INFRA ☾", symbol: "☾", count: 108, first: "AIRE", last: "زيتون", covers: ["v-23pi56-cover-1200.webp", "anunnaki-cover-1200.webp", "kali-cover-1200.webp", "asase-yaa-cover-1200.webp"] },
  { slug: "infra-snow", name: "INFRA ❄", symbol: "❄", count: 45, first: "Moteur", last: "VESTA", covers: ["adc-13-6e983f31-cover-1200.webp", "cyberpunk-cover-1200.webp", "h-1-008-cover-1200.webp", "ldc13-cover-1200.webp"] },
  { slug: "infra-falcon", name: "INFRA 𓅃", symbol: "𓅃", count: 52, first: "Haut", last: "RECONTRE", covers: ["abricot-cover-1200.webp", "black-stallion-cover-1200.webp", "cerises-cover-1200.webp", "impression-cover-1200.webp"] }
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

  const firstDistinctCovers = [];
  const seenAlbums = new Set();
  for (const track of playlist.tracks) {
    if (seenAlbums.has(track.albumSlug)) continue;
    seenAlbums.add(track.albumSlug);
    firstDistinctCovers.push(path.basename(track.artwork));
    if (firstDistinctCovers.length === 4) break;
  }
  if (JSON.stringify(firstDistinctCovers) !== JSON.stringify(contract.covers)) {
    fail(`${contract.name} does not select its first four distinct album covers`);
  }
  for (const cover of contract.covers) {
    if (!fs.existsSync(path.join(publicRoot, "assets/music/responsive", cover))) {
      fail(`${contract.name} references a missing cover: ${cover}`);
    }
  }

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
  if (!page.includes("assets/css/playlists.css?v=playlist-collage-20260801")) {
    fail(`${pageRelative} does not load the playlist collage styles`);
  }
  const pageCovers = [...page.matchAll(/class="playlist-cover-tile" src="\.\.\/assets\/music\/responsive\/([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(pageCovers) !== JSON.stringify(contract.covers)) {
    fail(`${pageRelative} does not render the expected four-cover mosaic`);
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
if (playlistsPosition < 0 || albumsPosition < 0 || playlistsPosition > albumsPosition) {
  fail("Playlists is not the first music section on the home page");
}
if (!/<details class="albums-menu playlists-menu" open>/.test(index)) {
  fail("Playlists is not open by default");
}
if (!/<section class="module one-col" data-module-id="albums">\s*<details class="albums-menu">/.test(index)) {
  fail("Albums is not closed by default");
}
for (const contract of expected) {
  if (!index.includes(`href="playlists/${contract.slug}.html"`) || !index.includes(contract.name)) {
    fail(`home page is missing ${contract.name}`);
  }
  const cardStart = index.indexOf(`href="playlists/${contract.slug}.html"`);
  const cardEnd = index.indexOf("</a>", cardStart);
  const card = index.slice(cardStart, cardEnd);
  const cardCovers = [...card.matchAll(/class="playlist-cover-tile" src="assets\/music\/responsive\/([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(cardCovers) !== JSON.stringify(contract.covers)) {
    fail(`home page mosaic is incorrect for ${contract.name}`);
  }
  if (!card.includes(`<span class="playlist-card-title">${contract.symbol}</span>`) || card.includes(`<span class="playlist-card-title">${contract.name}</span>`)) {
    fail(`home page does not show only the sign for ${contract.name}`);
  }
}

const playlistStyles = read("public/assets/css/playlists.css");
if (!playlistStyles.includes("grid-template-columns: repeat(2")) {
  fail("playlist mosaics are not styled correctly");
}
if (!playlistStyles.includes("color: #000000") || !playlistStyles.includes("font-size: clamp(1.12rem, 1.8vw, 1.46rem)") || !playlistStyles.includes("font-size: clamp(2.8rem, 7vw, 5.6rem)")) {
  fail("playlist mosaics or black signs are not styled correctly");
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
