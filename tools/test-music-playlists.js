#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const expected = [
  { slug: "infra-sun", name: "INFRA ☀", symbol: "☀", count: 29, first: "LIBERTA", last: "ΜΑΣΣΑΛΙΑ" },
  { slug: "infra-moon", name: "INFRA ☾", symbol: "☾", count: 108, first: "AIRE", last: "زيتون" },
  { slug: "infra-snow", name: "INFRA ❄", symbol: "❄", count: 45, first: "Moteur", last: "VESTA" },
  { slug: "infra-falcon", name: "INFRA 𓅃", symbol: "𓅃", count: 52, first: "Haut", last: "RECONTRE" }
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
  if (!page.includes(`data-playlist-slug="${contract.slug}"`) || !page.includes(`<h1>${contract.name}</h1>`)) {
    fail(`${pageRelative} has incorrect playlist metadata`);
  }
  if (!page.includes(`class="playlist-hero-symbol" aria-hidden="true">${contract.symbol}</span>`)) {
    fail(`${pageRelative} does not expose the expected sign`);
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
