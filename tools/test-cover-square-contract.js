#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");
const album = fs.readFileSync(path.join(root, "public/music/v-23pi56-infra.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "public/assets/js/spa-renderer.js"), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : "";
}

const albumCoverRule = cssRule(".cover");
assert.match(albumCoverRule, /width:\s*100%/);
assert.match(albumCoverRule, /height:\s*auto/);
assert.match(albumCoverRule, /aspect-ratio:\s*1\s*\/\s*1/);
assert.match(albumCoverRule, /object-fit:\s*contain/);

const nowPlayingCoverRule = cssRule(".now-playing-cover");
assert.match(nowPlayingCoverRule, /width:\s*100%/);
assert.match(nowPlayingCoverRule, /height:\s*auto/);
assert.match(nowPlayingCoverRule, /aspect-ratio:\s*1\s*\/\s*1/);
assert.match(nowPlayingCoverRule, /object-fit:\s*contain/);

assert.match(
  album,
  /<img class="cover" width="1200" height="1200"[^>]+v-23pi56-cover-1200\.webp/,
  "V-23π56 must retain square intrinsic dimensions"
);
assert.match(renderer, /Math\.abs\(ratioMilli - 1000\) <= 10/, "rendered cover geometry needs a one-percent tolerance");
assert.match(renderer, /cover_render_width_px/);
assert.match(renderer, /cover_render_height_px/);
assert.match(renderer, /cover_aspect_ratio_milli/);
assert.match(renderer, /cover_object_fit/);

console.log("Cover square contract checks passed: intrinsic 1200², square CSS and rendered geometry telemetry.");
