#!/usr/bin/env node
"use strict";
// Lot 9 (Claude, 18/11/2026) : avant chaque mise en ligne, la forme de chaque fichier de données est vérifiée,
// et les informations recopiées à plusieurs endroits doivent dire la même chose (version, adresse du Worker,
// liste des albums). Écrit à la main, sans dépendance. Lancé par npm test (tools/release-audit.js).
// Usage : node tools/check-data-schemas.js [dossier public] (par défaut : public/ du projet)
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pub = path.resolve(process.argv[2] || path.join(root, "public"));
const errors = [];
const fail = (msg) => errors.push(msg);
const read = (rel) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(pub, rel), "utf8"));
  } catch (error) {
    fail(`${rel} : illisible (${error.message})`);
    return null;
  }
};
const str = (v) => typeof v === "string" && v.trim().length > 0;
const num = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
function need(obj, where, fields) {
  for (const [key, test] of Object.entries(fields)) {
    if (!obj || !test(obj[key])) fail(`${where}.${key} : manquant ou invalide (${JSON.stringify(obj && obj[key])})`);
  }
}
const VERSION = /^audiofix\d+-\d{8}$/;
const STREAM = /^assets\/music\/streams\/[^/]+\/[^/]+\/[^/]+\.m4a$/i;

const catalog = read("data/catalog.json");
const tracks = read("data/tracks.json");
const durations = read("data/track-durations.json");
const playlists = read("data/playlists.json");

if (catalog) {
  for (const kind of ["apps", "albums", "clips"]) if (!Array.isArray(catalog[kind])) fail(`catalog.json.${kind} : doit être une liste`);
  (catalog.albums || []).forEach((a, i) => need(a, `catalog.albums[${i}]`, { id: str, title: str, page: str, thumb: str }));
  (catalog.apps || []).forEach((a, i) => need(a, `catalog.apps[${i}]`, { id: str, title: str, page: str }));
  (catalog.clips || []).forEach((c, i) => need(c, `catalog.clips[${i}]`, { id: str, title: str, youtubeUrl: str }));
  const ids = (catalog.albums || []).map((a) => a.id);
  if (new Set(ids).size !== ids.length) fail("catalog.json : identifiant d'album en double");
  for (const a of catalog.albums || []) {
    if (str(a.page) && !fs.existsSync(path.join(pub, a.page))) fail(`catalog.json : page absente ${a.page}`);
    if (str(a.thumb) && !fs.existsSync(path.join(pub, a.thumb))) fail(`catalog.json : vignette absente ${a.thumb}`);
    // 19/11 : ALEXANDRIA était publié sans sa miniature 400 px → pas de pochette sur l'accueil et dans la Bibliothèque
    const stem = (String(a.thumb || "").match(/responsive\/([a-z0-9-]+)-cover-1200\.webp$/) || [])[1];
    if (stem && !fs.existsSync(path.join(pub, `assets/thumbnails/music/${stem}-400.webp`))) fail(`miniature 400 px absente pour ${a.id} (node tools/generate-bibliotheque-thumbnails.js)`);
  }
}
let trackCount = 0;
if (tracks) {
  need(tracks, "tracks.json", { version: (v) => VERSION.test(v), albums: Array.isArray });
  (tracks.albums || []).forEach((a, i) => {
    need(a, `tracks.albums[${i}]`, { slug: str, title: str, page: str, cover: str, tracks: (v) => Array.isArray(v) && v.length > 0 });
    (a.tracks || []).forEach((t, j) => {
      trackCount += 1;
      need(t, `tracks.albums[${i}].tracks[${j}]`, { title: str, src: (v) => STREAM.test(v), seconds: num, index: num });
    });
  });
  if (catalog && (tracks.albums || []).length !== (catalog.albums || []).length) {
    fail(`albums : ${(tracks.albums || []).length} dans tracks.json, ${(catalog.albums || []).length} dans catalog.json`);
  }
}
if (durations) {
  need(durations, "track-durations.json", { version: (v) => VERSION.test(v), trackCount: num, tracks: Array.isArray });
  if (durations.trackCount !== (durations.tracks || []).length) fail("track-durations.json : trackCount ≠ nombre de titres");
  if (tracks && durations.trackCount !== trackCount) fail(`titres : ${trackCount} dans tracks.json, ${durations.trackCount} dans track-durations.json`);
  (durations.tracks || []).forEach((t, i) => need(t, `track-durations.tracks[${i}]`, { title: str, src: (v) => STREAM.test(v), seconds: num }));
}
if (playlists) {
  need(playlists, "playlists.json", { version: (v) => VERSION.test(v), playlists: Array.isArray });
  if (playlists.playlistCount !== (playlists.playlists || []).length) fail("playlists.json : playlistCount ≠ nombre de playlists");
  (playlists.playlists || []).forEach((p, i) => {
    need(p, `playlists[${i}]`, { slug: str, name: str, page: str, tracks: Array.isArray });
    (p.tracks || []).forEach((t, j) => need(t, `playlists[${i}].tracks[${j}]`, { title: str, albumSlug: str, src: (v) => STREAM.test(v) }));
  });
}
// Une seule version partout
const versions = new Set([tracks && tracks.version, durations && durations.version, playlists && playlists.version].filter(Boolean));
const scripts = fs.existsSync(path.join(root, "src/js/scripts.js")) ? fs.readFileSync(path.join(root, "src/js/scripts.js"), "utf8") : "";
const buildTag = (scripts.match(/window\.INFRA_BUILD_TAG = "([^"]+)"/) || [])[1];
if (buildTag) versions.add(buildTag);
const sw = fs.readFileSync(path.join(pub, "sw.js"), "utf8");
const swVersion = (sw.match(/const VERSION = "infra-shell-(\d{8})-audio(\d+)"/) || []).slice(1);
if (swVersion.length) versions.add(`audiofix${swVersion[1]}-${swVersion[0]}`);
if (versions.size !== 1) fail(`versions différentes : ${[...versions].join(", ")}`);
// Une seule adresse du Worker partout
const hosts = new Set();
for (const [file, text] of [["src/js/scripts.js", scripts], ["public/sw.js", sw], ["public/index.html", fs.readFileSync(path.join(pub, "index.html"), "utf8")]]) {
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.pages\.dev)|AUDIO_PROXY_HOST = "([^"]+)"/g)) hosts.add(`${m[1] || m[2]}`);
  if (!text) fail(`${file} : vide`);
}
if (hosts.size !== 1) fail(`adresse du Worker différente selon les fichiers : ${[...hosts].join(", ")}`);

// Section Samples (18/11/2026) : chaque album existe dans tracks.json, chaque son a un identifiant YouTube valide.
const samples = read("data/samples.json");
if (samples) {
  if (!Array.isArray(samples.albums)) fail("samples.json.albums : doit être une liste");
  const known = new Set(((tracks && tracks.albums) || []).map((a) => a.title));
  (samples.albums || []).forEach((a, i) => {
    need(a, `samples.albums[${i}]`, { title: str });
    if (tracks && !known.has(a.title)) fail(`samples.albums[${i}].title : album inconnu de tracks.json (${a.title})`);
    (a.tracks || []).forEach((t, j) =>
      (t.items || []).forEach((it, k) => {
        const where = `samples.albums[${i}].tracks[${j}].items[${k}]`;
        if (!/^[\w-]{11}$/.test(String(it && it.y))) fail(`${where}.y : identifiant YouTube invalide`);
        if (!it) return;
        // 20/11/2026 : forme des temps, passages, extraits, tempo, pochette et voix (le sens est vérifié par tools/test-samples.js)
        if ("v" in it && it.v !== 1) fail(`${where}.v : 1 ou absent`);
        if ("c" in it && it.c !== 1) fail(`${where}.c : 1 ou absent`);
        if ("tb" in it && !(num(it.tb) && it.tb > 0)) fail(`${where}.tb : BPM > 0 attendu`);
        const timed = ["s0", "s1", "at", "x", "p"].some((key) => key in it);
        if (!timed) return; // son sans temps : exclu du Mix (D4, liste dans tools/test-samples.js)
        need(it, where, { s0: num, s1: num, at: num });
        if (num(it.s0) && num(it.s1) && !(it.s0 < it.s1)) fail(`${where} : s0 doit être avant s1`);
        const parts = "p" in it ? it.p : [[it.s0, it.s1]];
        if (!Array.isArray(parts) || !parts.length || !parts.every((q) => Array.isArray(q) && q.length === 2 && num(q[0]) && num(q[1]) && q[0] < q[1])) {
          fail(`${where}.p : liste de passages [début, fin] attendue`);
          return;
        }
        if (!Array.isArray(it.x) || it.x.length !== parts.length) fail(`${where}.x : un extrait par passage attendu`);
        else
          it.x.forEach((x, n) => {
            if (!Array.isArray(x) || !/^[\w-]{11}_\d+-\d+$/.test(String(x[0])) || !num(x[1]) || !(num(x[2]) && x[2] > 0)) {
              fail(`${where}.x[${n}] : [nom, début, durée] attendu`);
            }
          });
      })
    );
  });
}

if (errors.length) {
  console.error(`Data schema checks FAILED (${errors.length}) :\n- ${errors.slice(0, 30).join("\n- ")}`);
  process.exit(1);
}
console.log(`Data schema checks passed: ${(catalog && catalog.albums.length) || 0} albums, ${trackCount} titres, ${(playlists && playlists.playlists.length) || 0} playlists, version ${[...versions][0]}, Worker ${[...hosts][0]}.`);
