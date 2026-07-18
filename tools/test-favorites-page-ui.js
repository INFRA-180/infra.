#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "public/assets/js/favorites-ui.js"),
  "utf8"
);
const styles = fs.readFileSync(
  path.join(root, "public/assets/css/styles.css"),
  "utf8"
);

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert(start >= 0 && end > start, `unable to isolate ${name}()`);
  return source.slice(start, end);
}

const shell = functionBody("renderFavoritesShell", "renderFavoritesPage");
const render = functionBody("renderFavoritesPage", "bindFavoritesView");
const selection = functionBody("syncFavoritesSelectionUi", "toggleFavoritesSelectionPath");

assert(shell.includes("<h2 data-favorites-title>Favoris</h2>"));
assert(render.includes('title.textContent = "Favoris"'));
assert(!source.includes("Favoris ·"), "the Favorites title must not contain count or duration");
assert(!source.includes("formatTotalDuration"), "the obsolete total-duration formatter must stay removed");

const removePosition = shell.indexOf("data-favorites-remove-selected");
const togglePosition = shell.indexOf("data-favorites-select-toggle");
assert(removePosition >= 0 && togglePosition > removePosition, "trash must appear before the close action");
assert(shell.includes("album-selection-toggle favorites-remove-selected"));
assert(shell.includes("album-selection-toggle favorites-select-toggle"));
assert(shell.includes("FAVORITES_TRASH_ICON"));
assert(shell.includes("SELECT_MODE_ICON"));

assert(selection.includes("selecting ? DONE_MODE_ICON : SELECT_MODE_ICON"));
assert(selection.includes('toggle.setAttribute("aria-label", selecting ? "Terminer la sélection" : "Sélectionner des titres")'));
assert(selection.includes("remove.innerHTML = FAVORITES_TRASH_ICON"));
assert(selection.includes("remove.disabled = selectedCount <= 0"));
assert(source.includes("<circle cx=\\\"12\\\" cy=\\\"12\\\""), "track selectors must remain circular");

assert(/\.album-selection-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(styles));
assert(/\.favorites-selecting \.favorites-select-btn\s*\{[\s\S]*?display:\s*grid;/.test(styles));

console.log("Favorites page header and selection controls: ok");
