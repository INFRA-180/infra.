#!/usr/bin/env node
"use strict";

const { codeAssertMatch, codeHas, codeMatch, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicRoot = path.resolve(__dirname, "../public");
const homeScript = fs.readFileSync(path.join(publicRoot, "assets/js/home-catalog.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(publicRoot, "data/catalog.json"), "utf8"));
const album = catalog.albums.find(({ thumb }) => fs.existsSync(path.join(publicRoot, thumbnailPath(thumb))));
assert.ok(album, "at least one album must have a published Home thumbnail");
const canonicalPath = album.thumb;
const smallPath = thumbnailPath(canonicalPath);
const baseURI = "https://site.test/infra./";
const canonical = baseURI + canonicalPath;
const small = baseURI + smallPath;

function thumbnailPath(canonicalSource) {
  return `assets/thumbnails/music/${path.basename(canonicalSource, "-cover-1200.webp")}-400.webp`;
}

function element(tagName) {
  const attributes = new Map();
  const node = {
    tagName,
    style: {},
    children: [],
    dataset: {},
    complete: true,
    classList: { contains(name) { return codeHas(String(node.className || "").split(" "), name); } },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
    removeAttribute(name) { attributes.delete(name); },
    appendChild(child) { node.children.push(child); },
    querySelector(selector) {
      const [tag, ...classes] = selector.split(".");
      return node.children.find((child) => child.tagName === tag && classes.every((name) => child.classList.contains(name)));
    }
  };
  Object.defineProperty(node, "src", {
    get() { return node.getAttribute("src") || ""; },
    set(value) { node.setAttribute("src", value); }
  });
  return node;
}

const mosaic = element("img");
mosaic.className = "playlist-cover-tile";
mosaic.dataset.coverSrc = canonicalPath;
const document = {
  baseURI,
  createElement: element,
  querySelectorAll(selector) {
    return selector === "img[data-cover-src]" && mosaic.dataset.coverSrc ? [mosaic] : [];
  }
};
const window = {};
vm.runInNewContext(homeScript, { document, window, URL });
const home = window.InfraHomeCatalog.createHomeCatalog();
const albumImage = (item, index) => home.buildCatalogCard(item, "album", index).children[0].children[0];

const eager = albumImage(album, 0);
assert.equal(eager.src, canonical, "the eager card must keep its canonical fallback");
assert.equal(eager.getAttribute("srcset"), `${small} 400w, ${canonical} 1200w`,
  "a known Home cover must offer a 400 px candidate and the original");
assert.ok(eager.getAttribute("sizes"), "the browser must know the display slot");
assert.equal(eager.loading, "eager");

const lazy = albumImage(album, 2);
assert.equal(lazy.dataset.coverSrc, canonical, "a later card keeps the source deferred");
assert.equal(lazy.src, "");
assert.equal(lazy.getAttribute("srcset"), null, "the lazy card cannot start a request before observation");
assert.equal(lazy.dataset.coverSrcset, `${small} 400w, ${canonical} 1200w`);

const future = { ...album, thumb: "assets/music/responsive/new-artwork-deadbeef-cover-1200.webp" };
const ungenerated = albumImage(future, 0);
assert.equal(ungenerated.src, baseURI + future.thumb);
assert.equal(ungenerated.getAttribute("srcset"), null, "an unpublished derivative cannot trigger a failed request");

const row = home.buildCatalogCard(album, "album", 0);
const [card] = row.children;
const [image] = card.children;
card.setAttribute("href", album.page);
image.removeAttribute("srcset");
image.removeAttribute("sizes");
image.setAttribute("src", canonicalPath);
image.setAttribute("width", album.width);
image.setAttribute("height", album.height);
image.setAttribute("alt", album.thumbAlt);
image.setAttribute("loading", "eager");
const grid = {
  children: [row],
  dataset: { staticCatalog: "albums" },
  querySelectorAll(selector) { return selector === "img.album-cover[src]" ? [image] : []; }
};
assert.equal(home.hydrateStaticHomeAlbumGrid(grid, [album]), true);
assert.equal(image.getAttribute("srcset"), `${small} 400w, ${canonical} 1200w`,
  "a watcher-generated eager card regains candidates during hydration");

home.reconcileHomeAlbumGrid(grid, [future]);
assert.equal(image.src, baseURI + future.thumb, "an updated live cover replaces the old artwork");
assert.equal(image.getAttribute("srcset"), null, "an old candidate cannot mask an updated cover");
assert.equal(mosaic.src, canonical);
assert.equal(mosaic.getAttribute("srcset"), `${small} 400w, ${canonical} 1200w`,
  "a watcher-generated mosaic gets responsive candidates when observed");
assert.ok(mosaic.getAttribute("sizes"));

const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const images = [...html.matchAll(/<img class="(album-thumb album-cover|playlist-cover-tile)"[^>]+>/g)];
assert.ok(images.length > 16, "the Home contains album cards and mosaic tiles");
for (const [tag] of images) {
  const canonicalSource = codeMatch(tag, /\s(?:src|data-cover-src)="([^"]+)"/)?.[1];
  codeAssertMatch(canonicalSource || "", /-cover-1200\.webp$/);
  const responsive = codeMatch(tag, /\s((?:data-cover-)?srcset)="([^"]+)"/);
  if (!responsive && !process.argv.includes("--strict-static")) continue;
  assert.ok(responsive, `missing responsive candidates for ${canonicalSource}`);
  const deferred = codeTest(/\sdata-cover-src="/, tag);
  assert.equal(responsive[1], deferred ? "data-cover-srcset" : "srcset");
  assert.ok(codeHas(tag, deferred ? ' data-cover-sizes="' : ' sizes="'));
  const candidate = thumbnailPath(canonicalSource);
  assert.equal(responsive[2], `${candidate} 400w, ${canonicalSource} 1200w`);
  const buffer = fs.readFileSync(path.join(publicRoot, candidate));
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    assert.equal(buffer.readUIntLE(24, 3) + 1, 400);
    assert.equal(buffer.readUIntLE(27, 3) + 1, 400);
  } else {
    assert.equal(chunk, "VP8 ");
    assert.equal(buffer.readUInt16LE(26) & 0x3fff, 400);
    assert.equal(buffer.readUInt16LE(28) & 0x3fff, 400);
  }
  assert.ok(buffer.length < fs.statSync(path.join(publicRoot, canonicalSource)).size);
}

console.log("Bibliothèque Home thumbnails: eager/deferred cards, mosaic hydration, live fallback and 400 px assets.");
