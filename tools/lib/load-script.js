"use strict";

// Chargement des scripts du site dans les tests (lot B, chantier JavaScript, 10/11/2026).
// Un fichier qui fait partie de app.js est d'abord construit seul avec Vite : ses import/export
// (dossier de modules, lots C/D) sont résolus comme dans app.js, puis le code tourne dans vm.
// Un fichier servi tel quel (bibliotheque.js, sw.js…) est exécuté tel quel : c'est ce qui tourne en ligne.
// Résultat gardé en mémoire et sur disque (node_modules/.cache), recalculé dès qu'une source change.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const appSources = require("../build/app-sources.js");

const builderPath = path.join(__dirname, "build-one-script.mjs");
const cacheDir = path.join(appSources.root, "node_modules/.cache/infra-test-scripts");
const memory = new Map();

// Chemin absolu ; un chemin relatif part de la racine du dépôt (pas du dossier courant).
function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(appSources.root, filePath);
}

function isAppEntry(filePath) {
  const target = resolvePath(filePath);
  return appSources.sourceFiles().some((file) => file === target) && !isModuleFile(target);
}

function isModuleFile(target) {
  return appSources
    .sourceFiles()
    .some((file) => appSources.moduleFiles(file).includes(target));
}

// Texte à lire pour les recherches dans le code : le fichier et son dossier de modules.
function sourceText(filePath) {
  return appSources.sourceText(resolvePath(filePath));
}

function digestFor(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(builderPath));
  hash.update(path.relative(appSources.root, filePath));
  hash.update(sourceText(filePath));
  return hash.digest("hex").slice(0, 24);
}

// Code exécutable dans vm pour ce fichier.
function scriptForVm(filePath) {
  const target = resolvePath(filePath);
  if (!isAppEntry(target)) return fs.readFileSync(target, "utf8");
  const key = digestFor(target);
  if (memory.has(key)) return memory.get(key);
  const cached = path.join(cacheDir, key + ".js");
  let code = null;
  try {
    code = fs.readFileSync(cached, "utf8");
  } catch (_error) {
    code = execFileSync(process.execPath, [builderPath, target], {
      cwd: appSources.root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cached, code);
    } catch (_ignored) {
      // Cache facultatif.
    }
  }
  memory.set(key, code);
  return code;
}

// Exécute le fichier dans un contexte vm déjà créé (vm.createContext).
function runInContext(filePath, context, options) {
  const target = resolvePath(filePath);
  return vm.runInContext(scriptForVm(target), context, Object.assign({ filename: target }, options || {}));
}

// Exécute le fichier dans un nouveau contexte (comme vm.runInNewContext).
function runInNewContext(filePath, sandbox, options) {
  const target = resolvePath(filePath);
  return vm.runInNewContext(scriptForVm(target), sandbox, Object.assign({ filename: target }, options || {}));
}

module.exports = { isAppEntry, sourceText, scriptForVm, runInContext, runInNewContext };
