#!/usr/bin/env node
"use strict";

// Une seule commande pour monter les trois versions du site (INFRA, 09/11/2026, lot 2) :
//   - audiofixNNN-AAAAMMJJ        (scripts et feuilles, ?v=…)
//   - infra-shell-AAAAMMJJ-audioNNN (Service Worker et contrat SPA)
//   - bibliotheque-vN-AAAAMMJJ    (bibliotheque.js ; styles dans styles.css depuis le lot 3)
// Oublier l'une d'elles laisse l'iPhone sur d'anciens fichiers.
// Usage : npm run bump            (écrit)
//         npm run bump -- --dry   (montre sans écrire)

const fs = require("node:fs");
const path = require("node:path");

const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".txt", ".xml"]);
const SKIP_DIRS = new Set(["music", "thumbnails", "fonts", "clips", "branding", "pwa", "vendor"]);

function today(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.basename(directory) === "assets" && SKIP_DIRS.has(entry.name)) continue;
      walk(filePath, files);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(filePath);
    }
  }
  return files;
}

function readCurrent(publicRoot) {
  const scripts = fs.readFileSync(path.join(publicRoot, "assets/js/scripts.js"), "utf8");
  const sw = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
  const homeCatalog = fs.readFileSync(path.join(publicRoot, "assets/js/home-catalog.js"), "utf8");
  const build = (scripts.match(/window\.INFRA_BUILD_TAG = "(audiofix(\d+)-\d{8})";/) || []);
  const shell = (sw.match(/const VERSION = "(infra-shell-\d{8}-audio\d+)";/) || []);
  const bib = (homeCatalog.match(/var VERSION = "(bibliotheque-v(\d+)-\d{8})"/) || []);
  if (!build[1] || !shell[1] || !bib[1]) {
    throw new Error("versions introuvables (scripts.js, sw.js ou home-catalog.js)");
  }
  return { build: build[1], buildNumber: Number(build[2]), shell: shell[1], bib: bib[1], bibNumber: Number(bib[2]) };
}

function nextVersions(current, date) {
  const n = current.buildNumber + 1;
  return {
    build: `audiofix${n}-${date}`,
    shell: `infra-shell-${date}-audio${n}`,
    bib: `bibliotheque-v${current.bibNumber + 1}-${date}`
  };
}

function bump(publicRoot, options = {}) {
  const date = options.date || today();
  const current = readCurrent(publicRoot);
  const next = nextVersions(current, date);
  const pairs = [[current.build, next.build], [current.shell, next.shell], [current.bib, next.bib]];
  const changed = [];
  for (const filePath of walk(publicRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    let output = source;
    for (const [from, to] of pairs) output = output.split(from).join(to);
    if (output !== source) {
      changed.push(filePath);
      if (!options.dry) fs.writeFileSync(filePath, output);
    }
  }
  return { current, next, changed };
}

module.exports = { bump, readCurrent, nextVersions, today };

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const dry = process.argv.includes("--dry");
  const result = bump(path.join(root, "public"), { dry });
  console.log(`${dry ? "Simulation — " : ""}${result.changed.length} fichiers`);
  console.log(`  ${result.current.build} → ${result.next.build}`);
  console.log(`  ${result.current.shell} → ${result.next.shell}`);
  console.log(`  ${result.current.bib} → ${result.next.bib}`);
  if (!dry) console.log("Ensuite : npm test");
}
