"use strict";

// Liste et empreinte des sources de public/assets/js/app.js (chantier JavaScript, INFRA 10/11/2026).
// L'empreinte est écrite en tête de app.js par la construction (npm run build) et revérifiée
// par l'audit : un app.js qui ne correspond plus à ses sources bloque la publication.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const entryPath = path.join(__dirname, "app-entry.js");

// Fichiers importés par app-entry.js, chacun suivi de son dossier de modules s'il en a un
// (scripts.js → runtime/ ; lot C/D : audio-radio.js → audio-radio/, transport-ui.js → transport-ui/).
function sourceFiles() {
  const entry = fs.readFileSync(entryPath, "utf8");
  const files = Array.from(entry.matchAll(/^import "(.+)";$/gm), (match) =>
    path.resolve(__dirname, match[1])
  );
  return files.flatMap((file) => [...moduleFiles(file), file]);
}

// Dossier de modules d'un fichier d'entrée (il peut ne pas exister).
function moduleDir(entryFile) {
  const name = path.basename(entryFile, ".js");
  return path.join(path.dirname(entryFile), name === "scripts" ? "runtime" : name);
}

function moduleFiles(entryFile) {
  // Tout le dossier (modules importés par l'entrée ou entre eux), dans un ordre stable.
  const dir = moduleDir(entryFile);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => path.join(dir, name));
}

function runtimeModules(scriptsFile) {
  return moduleFiles(scriptsFile);
}

// Texte d'un fichier d'entrée suivi de ses modules, pour les contrôles qui lisent le code.
function sourceText(entryFile) {
  return [entryFile, ...moduleFiles(entryFile)].map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

// Texte complet du lecteur (scripts.js puis ses modules), pour les contrôles qui lisent le code.
function runtimeSource() {
  return sourceText(path.join(root, "src/js/scripts.js"));
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

module.exports = { root, sourceFiles, moduleDir, moduleFiles, runtimeModules, sourceText, runtimeSource, sourcesDigest, banner };
