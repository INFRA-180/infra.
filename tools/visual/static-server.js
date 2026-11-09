#!/usr/bin/env node
"use strict";

// Petit serveur local pour les captures (lot 1, INFRA 09/11/2026) : sert public/ tel quel,
// sans dépendance, avec le bon type de fichier. Port : VISUAL_PORT (8793 par défaut).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../public");
const port = Number(process.env.VISUAL_PORT || 8793);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".otf": "font/otf", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml"
};

http.createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) { response.writeHead(403).end(); return; }
  fs.readFile(filePath, (error, data) => {
    if (error) { response.writeHead(404, { "Content-Type": "text/plain" }).end("not found"); return; }
    response.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log(`visual server http://127.0.0.1:${port}/`));
