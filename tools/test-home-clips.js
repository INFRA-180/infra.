#!/usr/bin/env node
"use strict";

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
    toggle(value, enabled) {
      if (enabled) values.add(value);
      else values.delete(value);
    },
    contains(value) { return values.has(value); }
  };
}

function createNode(tagName) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    tagName: String(tagName || "").toUpperCase(),
    children: [],
    className: "",
    classList: createClassList(),
    dataset: {},
    textContent: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(child) {
      this.children = child && child.isFragment ? child.children.slice() : (child ? [child] : []);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "src") this.src = "";
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) {
      const listener = listeners.get(type);
      if (listener) listener.call(this);
    }
  };
}

function createHarness() {
  const shell = createNode("div");
  const iframe = createNode("iframe");
  const grid = createNode("ul");
  const menu = createNode("details");
  const module = createNode("section");
  menu.open = false;
  iframe.closest = (selector) => selector === ".clip-player-shell" ? shell : null;
  module.querySelector = (selector) => selector === ".clips-menu" ? menu : null;

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
      return null;
    },
    querySelectorAll(selector) {
      if (selector !== ".clip-card[data-clip-id]") return [];
      return grid.children.map((item) => item.children[0]).filter(Boolean);
    }
  };

  const sandbox = {
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
  const catalog = sandbox.InfraHomeCatalog.createHomeCatalog({ clipState });
  return { catalog, grid, iframe, menu, shell };
}

(function testFirstClipLoadsWhenMenuOpens() {
  const harness = createHarness();
  harness.catalog.renderClipsSection([
    { id: "clip-1", title: "Premier clip", youtubeId: "firstVideo" },
    { id: "clip-2", title: "Second clip", youtubeId: "secondVideo" }
  ]);

  assert.equal(harness.iframe.src, "", "the closed clips menu must not load YouTube");
  assert.equal(harness.shell.classList.contains("is-idle"), true);

  harness.menu.open = true;
  harness.menu.dispatch("toggle");

  assert.match(
    harness.iframe.src,
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/firstVideo\?/
  );
  assert.equal(harness.iframe.src.includes("autoplay=1"), false, "opening must show the thumbnail without autoplay");
  assert.equal(harness.shell.classList.contains("is-idle"), false);

  harness.grid.children[1].children[0].dispatch("click");
  assert.match(harness.iframe.src, /\/embed\/secondVideo\?/);
  assert.equal(harness.iframe.src.includes("autoplay=1"), true, "an explicit clip click must keep autoplay");

  harness.menu.open = false;
  harness.menu.dispatch("toggle");
  assert.equal(harness.iframe.src, "", "closing must unload the hidden player");

  harness.menu.open = true;
  harness.menu.dispatch("toggle");
  assert.match(harness.iframe.src, /\/embed\/secondVideo\?/);
  assert.equal(harness.iframe.src.includes("autoplay=1"), false, "reopening must restore the thumbnail without autoplay");
})();

console.log("Home clips regression test passed: first YouTube thumbnail loads on menu open.");
