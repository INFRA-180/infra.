#!/usr/bin/env node
"use strict";
const { codeAssertMatch, codeHas } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
// Clips sur l'accueil (maquette V5 validée par INFRA le 09/11/2026) : vignettes locales,
// rien de YouTube chargé avant un toucher, clip lu sur place, titre affiché une seule fois,
// fermeture qui décharge le lecteur, musique mise en pause au lancement d'un clip.

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(__dirname, "../public/assets/js/home-catalog.js");

function createClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function createNode(tagName) {
  const attributes = new Map();
  const listeners = new Map();
  const node = {
    tagName: String(tagName || "").toUpperCase(),
    children: [],
    classList: createClassList(),
    dataset: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    get firstChild() { return this.children[0] || null; },
    get src() { return attributes.get("src") || ""; },
    set src(value) { attributes.set("src", String(value)); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(child) {
      this.children = child && child.isFragment ? child.children.slice() : (child ? [child] : []);
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    click() { const listener = listeners.get("click"); if (listener) listener.call(this, { target: this }); }
  };
  return node;
}

function createHarness(options) {
  const opts = options || {};
  const module = createNode("section");
  const grid = createNode("ul");
  const shell = createNode("div");
  const iframe = createNode("iframe");
  const title = createNode("span");
  const close = createNode("button");
  const toggle = createNode("button");
  let musicPaused = 0;
  toggle.addEventListener("click", () => { musicPaused += 1; });
  shell.hidden = true;
  module.querySelector = (selector) => ({
    "[data-clip-shell]": shell,
    "[data-clip-title]": title,
    "[data-clip-close]": close
  })[selector] || null;

  const document = {
    body: { classList: createClassList() },
    createElement: createNode,
    createDocumentFragment() {
      const fragment = createNode("fragment");
      fragment.isFragment = true;
      return fragment;
    },
    querySelector(selector) {
      if (selector === '[data-module-id="clips"]') return module;
      if (selector === '[data-catalog-grid="clips"]') return grid;
      if (selector === "[data-clip-iframe]") return iframe;
      if (selector === ".global-transport.is-playing [data-transport-toggle]") return opts.musicPlaying ? toggle : null;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const sandbox = {
    URL,
    URLSearchParams,
    Promise,
    document,
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SOURCE_PATH, "utf8"), sandbox, { filename: SOURCE_PATH });

  const clipState = { clips: [], activeId: "", currentSrc: "" };
  const catalog = sandbox.InfraHomeCatalog.createHomeCatalog({ clipState, fallbackCatalog: opts.fallbackCatalog });
  return { catalog, module, grid, shell, iframe, title, close, musicPaused: () => musicPaused };
}

const CLIPS = [
  { id: "clip-2", title: "Premier clip", youtubeId: "firstVideo" },
  { id: "clip-1", title: "Second clip", youtubeId: "secondVideo" }
];
const tile = (harness, index) => harness.grid.children[index].children[0];

(function testClipsWaitForATouch() {
  const harness = createHarness();
  harness.catalog.renderClipsSection(CLIPS);
  assert.equal(harness.grid.children.length, 2);
  assert.equal(harness.iframe.src, "", "no YouTube player before a touch");
  assert.equal(harness.shell.hidden, true);
  const image = tile(harness, 0).children[0].children[0];
  codeAssertMatch(image.getAttribute("src"), /clips\/firstVideo-480\.webp$/, "thumbnail must be the local WebP");
})();

(function testClipPlaysInPlaceAndPausesMusic() {
  const harness = createHarness({ musicPlaying: true });
  harness.catalog.renderClipsSection(CLIPS);
  tile(harness, 1).click();
  codeAssertMatch(harness.iframe.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/secondVideo\?/);
  assert.equal(codeHas(harness.iframe.src, "autoplay=1"), true, "a touch starts the clip");
  assert.equal(codeHas(harness.iframe.src, "enablejsapi=1"), true, "the clip must accept a pause from the music");
  assert.equal(harness.shell.hidden, false);
  assert.equal(harness.title.textContent, "Second clip");
  assert.equal(harness.grid.children[1].hidden, true, "the playing clip's tile leaves the row (title shown once)");
  assert.equal(harness.grid.children[0].hidden, false);
  assert.equal(harness.module.classList.contains("is-playing"), true);
  assert.equal(harness.musicPaused(), 1, "music pauses when a clip starts");
})();

(function testCloseUnloadsThePlayer() {
  const harness = createHarness();
  harness.catalog.renderClipsSection(CLIPS);
  tile(harness, 0).click();
  harness.close.click();
  assert.equal(harness.iframe.src, "", "closing must unload the player");
  assert.equal(harness.shell.hidden, true);
  assert.equal(harness.grid.children.every((li) => !li.hidden), true);
  assert.equal(harness.module.classList.contains("is-playing"), false);
})();

(function testRebuiltHomeStartsClosed() {
  const harness = createHarness();
  harness.catalog.renderClipsSection(CLIPS);
  tile(harness, 0).click();
  harness.iframe.removeAttribute("src");
  harness.catalog.renderClipsSection(CLIPS);
  assert.equal(harness.shell.hidden, true, "a rebuilt home must not reopen a clip by itself");
})();

(function testSiteOrderWinsOverLiveCatalog() {
  const harness = createHarness({ fallbackCatalog: { clips: [
    { id: "clip-2", youtubeUrl: "https://www.youtube.com/watch?v=secondVideo" },
    { id: "clip-1", youtubeUrl: "https://www.youtube.com/watch?v=firstVideo" }
  ] } });
  harness.catalog.renderClipsSection(CLIPS);
  assert.equal(tile(harness, 0).dataset.clipId, "clip-1", "the site's clip order wins over the live catalog order");
})();

console.log("Home clips checks passed: local thumbnails, play in place, single title, close unloads, music pause, site order.");
