"use strict";

// Liste et empreinte des sources de public/assets/js/app.js (chantier JavaScript, INFRA 10/11/2026).
// L'empreinte est écrite en tête de app.js par la construction (npm run build) et revérifiée
// par l'audit : un app.js qui ne correspond plus à ses sources bloque la publication.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const entryPath = path.join(__dirname, "app-entry.js");

function sourceFiles() {
  const entry = fs.readFileSync(entryPath, "utf8");
  return Array.from(entry.matchAll(/^import "(.+)";$/gm), (match) => path.resolve(__dirname, match[1]));
}

function sourcesDigest() {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(entryPath));
  for (const file of sourceFiles()) {
    hash.update(path.relative(root, file));
    hash.update(fs.readFileSync(file));
  }
  hash.update(fs.readFileSync(path.join(__dirname, "vite.config.mjs")));
  return hash.digest("hex").slice(0, 16);
}

function banner() {
  return `/*! INFRA. app.js — construit par Vite (npm run build), ne pas modifier à la main. sources:${sourcesDigest()} */`;
}

module.exports = { root, sourceFiles, sourcesDigest, banner };
