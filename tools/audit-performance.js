#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const pages = [
  "index.html",
  ...fs.readdirSync(path.join(publicRoot, "music")).filter((file) => file.endsWith(".html")).map((file) => path.join("music", file)),
  ...fs.readdirSync(path.join(publicRoot, "apps")).filter((file) => file.endsWith(".html")).map((file) => path.join("apps", file))
];

function scriptsFor(page) {
  const html = fs.readFileSync(path.join(publicRoot, page), "utf8");
  return (html.match(/<script\s+src="[^"]+"/g) || []).length;
}

const sw = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
const required = (sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/) || ["", ""])[1];
const optional = (sw.match(/const OPTIONAL_SHELL_ASSETS = \[([\s\S]*?)\];/) || ["", ""])[1];
const countAssets = (source) => (source.match(/^\s*"\.\//gm) || []).length;
const bytesFor = (source) => (source.match(/"(\.\/assets\/js\/[^?\"]+)/g) || []).reduce((sum, match) => {
  const relative = match.slice(1);
  try { return sum + fs.statSync(path.join(publicRoot, relative)).size; } catch (_err) { return sum; }
}, 0);

console.log(JSON.stringify({
  pages: pages.length,
  script_tags: {
    home: scriptsFor("index.html"),
    album: scriptsFor(pages.find((page) => page.startsWith("music/"))),
    app: scriptsFor(pages.find((page) => page.startsWith("apps/")))
  },
  service_worker: {
    required_assets: countAssets(required),
    optional_assets: countAssets(optional),
    required_js_bytes: bytesFor(required),
    optional_js_bytes: bytesFor(optional)
  },
  note: "Static release audit. Browser request, audio-start, and SPA timing metrics are emitted anonymously by performance-policy.js."
}, null, 2));
