#!/usr/bin/env node
"use strict";

const { codeAssertMatch, codeMatch } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");
const album = fs.readFileSync(path.join(root, "public/music/v-23pi56-infra.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src/js/spa-renderer.js"), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = codeMatch(styles, new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : "";
}

const albumCoverRule = cssRule(".cover");
codeAssertMatch(albumCoverRule, /width:\s*100%/);
codeAssertMatch(albumCoverRule, /height:\s*auto/);
codeAssertMatch(albumCoverRule, /aspect-ratio:\s*1\s*\/\s*1/);
codeAssertMatch(albumCoverRule, /object-fit:\s*contain/);

const nowPlayingCoverRule = cssRule(".now-playing-cover");
codeAssertMatch(nowPlayingCoverRule, /width:\s*100%/);
codeAssertMatch(nowPlayingCoverRule, /height:\s*auto/);
codeAssertMatch(nowPlayingCoverRule, /aspect-ratio:\s*1\s*\/\s*1/);
codeAssertMatch(nowPlayingCoverRule, /object-fit:\s*contain/);

codeAssertMatch(album, /<img class="cover" width="1200" height="1200"[^>]+v-23pi56-cover-1200\.webp/, "V-23π56 must retain square intrinsic dimensions");
codeAssertMatch(renderer, /Math\.abs\(ratioMilli - 1000\) <= 10/, "rendered cover geometry needs a one-percent tolerance");
codeAssertMatch(renderer, /cover_render_width_px/);
codeAssertMatch(renderer, /cover_render_height_px/);
codeAssertMatch(renderer, /cover_aspect_ratio_milli/);
codeAssertMatch(renderer, /cover_object_fit/);

console.log("Cover square contract checks passed: intrinsic 1200², square CSS and rendered geometry telemetry.");
