#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const publicRoot = path.resolve(__dirname, "../public");
const homePath = path.join(publicRoot, "index.html");
const scriptPath = path.join(publicRoot, "..", "src/js/home-catalog.js"); // lot E : source dans src/js
const thumbnailDir = "assets/thumbnails/music";
const coverPattern = /^assets\/music\/responsive\/([a-z0-9-]+)-cover-1200\.webp$/;
const albumSizes = "(max-width: 639px) calc(50vw - 23px), (max-width: 959px) calc(33.33vw - 24px), (max-width: 1080px) calc(20vw - 24px), 192px";
const mosaicSizes = "(max-width: 639px) 25vw, 130px";

const html = fs.readFileSync(homePath, "utf8");
const script = fs.readFileSync(scriptPath, "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(publicRoot, "data/catalog.json"), "utf8"));
const covers = new Set(catalog.albums.map((album) => album.thumb));

function thumbnailStem(cover) {
  const match = coverPattern.exec(cover);
  if (!match) throw new Error(`Pochette canonique invalide : ${cover}`);
  return match[1];
}

const homeImages = /<img class="(album-thumb album-cover|playlist-cover-tile)"[^>]+>/g;
const homeWithCandidates = html.replace(homeImages, (tag, classes) => {
  const source = tag.match(/\s(src|data-cover-src)="([^"]+)"/);
  if (!source) throw new Error(`Pochette d'accueil sans source : ${tag}`);
  const [, attribute, cover] = source;
  const stem = thumbnailStem(cover);
  covers.add(cover);
  const prefix = attribute === "src" ? "" : "data-cover-";
  const sizes = classes === "playlist-cover-tile" ? mosaicSizes : albumSizes;
  const candidates = `${thumbnailDir}/${stem}-400.webp 400w, ${cover} 1200w`;
  return tag
    .replace(/\s(?:data-cover-)?(?:srcset|sizes)="[^"]*"/g, "")
    .replace(source[0], `${source[0]} ${prefix}srcset="${candidates}" ${prefix}sizes="${sizes}"`);
});

const generatedBlock = /(  \/\/ BEGIN GENERATED HOME THUMBNAILS[^\n]*\n)[\s\S]*?(  \/\/ END GENERATED HOME THUMBNAILS)/;
if (!generatedBlock.test(script)) throw new Error("Bloc de miniatures absent dans home-catalog.js");
const stems = [...covers].map(thumbnailStem).sort();
const scriptWithInventory = script.replace(generatedBlock, (_match, start, end) => [
  start.trimEnd(),
  `  const HOME_ALBUM_COVER_SIZES = ${JSON.stringify(albumSizes)};`,
  `  const HOME_MOSAIC_COVER_SIZES = ${JSON.stringify(mosaicSizes)};`,
  "  const HOME_THUMBNAILS = new Set([",
  stems.map((stem) => `    ${JSON.stringify(stem)}`).join(",\n"),
  "  ]);",
  end
].join("\n"));

fs.mkdirSync(path.join(publicRoot, thumbnailDir), { recursive: true });
for (const cover of covers) {
  const source = path.join(publicRoot, cover);
  const destination = path.join(publicRoot, thumbnailDir, `${thumbnailStem(cover)}-400.webp`);
  const temporary = `${destination}.tmp`;
  try {
    execFileSync("cwebp", ["-quiet", "-resize", "400", "400", "-q", "80", source, "-o", temporary], { stdio: "inherit" });
    fs.renameSync(temporary, destination);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
if (homeWithCandidates !== html) fs.writeFileSync(homePath, homeWithCandidates);
if (scriptWithInventory !== script) fs.writeFileSync(scriptPath, scriptWithInventory);
console.log(`${stems.length} miniatures WebP 400 × 400 et candidats de l'accueil générés.`);
