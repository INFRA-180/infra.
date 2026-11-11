#!/usr/bin/env node
"use strict";

const { codeHas, codeIndexOf, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src/js/favorites-ui.js"),
  "utf8"
);
const styles = fs.readFileSync(
  path.join(root, "public/assets/css/styles.css"),
  "utf8"
);

function functionBody(name, nextName) {
  const start = codeIndexOf(source, `function ${name}`);
  const end = codeIndexOf(source, `function ${nextName}`, start + 1);
  assert(start >= 0 && end > start, `unable to isolate ${name}()`);
  return source.slice(start, end);
}

const shell = functionBody("renderFavoritesShell", "renderFavoritesPage");
const render = functionBody("renderFavoritesPage", "bindFavoritesView");
const selection = functionBody("syncFavoritesSelectionUi", "toggleFavoritesSelectionPath");

assert(codeHas(shell, "<h2 data-favorites-title>Favoris</h2>"));
assert(codeHas(render, 'title.textContent = "Favoris"'));
assert(!codeHas(source, "Favoris ·"), "the Favorites title must not contain count or duration");
assert(!codeHas(source, "formatTotalDuration"), "the obsolete total-duration formatter must stay removed");

const removePosition = codeIndexOf(shell, "data-favorites-remove-selected");
const togglePosition = codeIndexOf(shell, "data-favorites-select-toggle");
assert(removePosition >= 0 && togglePosition > removePosition, "trash must appear before the close action");
assert(codeHas(shell, "album-selection-toggle favorites-remove-selected"));
assert(codeHas(shell, "album-selection-toggle favorites-select-toggle"));
assert(codeHas(shell, "FAVORITES_TRASH_ICON"));
assert(codeHas(shell, "SELECT_MODE_ICON"));

assert(codeHas(selection, "selecting ? DONE_MODE_ICON : SELECT_MODE_ICON"));
assert(codeHas(selection, 'toggle.setAttribute("aria-label", selecting ? "Terminer la sélection" : "Sélectionner des titres")'));
assert(codeHas(selection, "remove.innerHTML = FAVORITES_TRASH_ICON"));
assert(codeHas(selection, "remove.disabled = selectedCount <= 0"));
assert(codeTest(/<circle cx=\\?"12\\?" cy=\\?"12\\?"/, source), "track selectors must remain circular"); // guillemets échappés ou non (formatage)

assert(codeTest(/\.album-selection-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, styles));
assert(codeTest(/\.favorites-selecting \.favorites-select-btn\s*\{[\s\S]*?display:\s*grid;/, styles));

console.log("Favorites page header and selection controls: ok");
