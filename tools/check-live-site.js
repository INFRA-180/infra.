#!/usr/bin/env node
"use strict";
// Lot 9 (Claude, 18/11/2026) : contrôle du site EN LIGNE après chaque publication (étape finale du workflow).
// « Poussé » ≠ « en ligne » (leçon du 10/11) : on vérifie que la page, app.js, sw.js et les données publiées
// portent la version qu'on vient d'envoyer, que les JSON se lisent, et que le Worker répond.
// Usage : node tools/check-live-site.js [adresse du site]   (par défaut : le site public)
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = String(process.argv[2] || "https://infra-180.github.io/infra./").replace(/\/?$/, "/");
const scripts = fs.readFileSync(path.join(root, "src/js/scripts.js"), "utf8");
const expected = (scripts.match(/window\.INFRA_BUILD_TAG = "([^"]+)"/) || [])[1];
const worker = (scripts.match(/const WORKER_URL = "([^"]+)"/) || [])[1];
const parts = expected.match(/^audiofix(\d+)-(\d{8})$/);
if (!parts) throw new Error(`Version locale illisible : ${expected}`);
const swExpected = `infra-shell-${parts[2]}-audio${parts[1]}`;

const bust = () => `t=${Date.now()}`;
async function get(url) {
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + bust(), { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}
async function checkOnce() {
  const problems = [];
  const sw = await get(base + "sw.js");
  if (!sw.includes(`const VERSION = "${swExpected}"`)) problems.push(`sw.js n'est pas en ${swExpected}`);
  const html = await get(base);
  if (!html.includes(expected)) problems.push(`index.html ne cite pas ${expected}`);
  const app = await get(`${base}assets/js/app.js?v=${expected}`);
  if (!new RegExp(`["'\`]${expected}["'\`]`).test(app)) problems.push(`app.js n'est pas en ${expected}`); // minifié : guillemets ou accents graves
  for (const file of ["catalog.json", "tracks.json", "track-durations.json", "playlists.json"]) {
    try {
      const data = JSON.parse(await get(`${base}data/${file}`));
      if (data.version && data.version !== expected) problems.push(`data/${file} en ${data.version}`);
    } catch (error) {
      problems.push(`data/${file} illisible (${error.message})`);
    }
  }
  if (worker) {
    try {
      JSON.parse(await get(`${worker}/catalog/tracks.json`));
    } catch (error) {
      problems.push(`Worker catalogue : ${error.message}`);
    }
  }
  return problems;
}
(async () => {
  let problems = [];
  // GitHub Pages met quelques instants à servir la nouvelle version : jusqu'à 10 essais, 20 s d'écart.
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      problems = await checkOnce();
    } catch (error) {
      problems = [error.message];
    }
    if (!problems.length) {
      console.log(`Site en ligne vérifié : ${base} en ${expected} (page, app.js, sw.js, données, Worker).`);
      return;
    }
    if (attempt < 10) await new Promise((resolve) => setTimeout(resolve, 20000));
  }
  console.error(`Site en ligne NON conforme après 10 essais :\n- ${problems.join("\n- ")}`);
  process.exit(1);
})();
