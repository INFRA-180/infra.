#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(repoRoot, "public");
const gitignorePath = path.join(repoRoot, ".gitignore");

const allowedTrackedRoots = new Set([
  ".github",
  ".gitignore",
  "DOCS",
  "README.md",
  "public",
  "tools"
]);
const binaryExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".otf",
  ".png",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2"
]);

const blockedPublicPaths = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)_private(\/|$)/i,
  /(^|\/)(DOCS|RAPPORTS?|debug|tests?|workers)(\/|$)/i,
  /(^|\/)(APP_CONTRACT\.toml|debug\.html|manifest-test\.webmanifest)$/i,
  /\.(aif|aiff|db|flac|m4a|mov|mp3|mp4|ogg|sqlite|sqlite3|wav|zip)$/i
];

const blockedPublicContent = [
  { label: "Sphragis payloads", regex: /\bSPHRAGIS_PAYLOADS\b|\bsphragisPayloads\b/ },
  { label: "Sphragis key derivation", regex: /\bderiveSphragisKey\b|infra-sphragis-v1/ },
  { label: "Sphragis local decrypt", regex: /\bdecryptSphragis\b|crypto\.subtle\.decrypt/ },
  { label: "monitor key", regex: /\bMONITOR_KEY\b/ },
  { label: "Cloudflare token", regex: /\b(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN)\b/ },
  { label: "private key", regex: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { label: "worker config", regex: /\baccount_id\s*=|\bwrangler\.toml\b/ }
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isProbablyText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return !binaryExtensions.has(ext);
}

function verifyPublicFiles() {
  if (!fs.existsSync(publicRoot)) {
    fail("public/ is missing");
    return;
  }

  for (const filePath of walkFiles(publicRoot)) {
    const relative = toPosix(path.relative(repoRoot, filePath));

    for (const blocked of blockedPublicPaths) {
      if (blocked.test(relative)) fail(`Blocked public path: ${relative}`);
    }

    if (!isProbablyText(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const rule of blockedPublicContent) {
      if (rule.regex.test(content)) fail(`Blocked public content (${rule.label}): ${relative}`);
    }
  }
}

function verifyTrackedRoots() {
  let tracked = "";
  try {
    tracked = execFileSync("git", ["ls-files"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
  } catch (_err) {
    return;
  }

  for (const file of tracked.split("\n").filter(Boolean)) {
    const root = file.split("/")[0];
    if (!allowedTrackedRoots.has(root)) fail(`Unexpected tracked root: ${file}`);
  }
}

function verifyIgnoredPrivateFiles() {
  if (!fs.existsSync(gitignorePath)) {
    fail(".gitignore is missing");
    return;
  }

  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  const requiredIgnores = ["AGENTS.md", "_private/", ".secrets/", ".wrangler/"];

  for (const pattern of requiredIgnores) {
    if (!gitignore.includes(pattern)) fail(`Missing .gitignore rule: ${pattern}`);
  }
}

verifyPublicFiles();
verifyTrackedRoots();
verifyIgnoredPrivateFiles();

if (process.exitCode) process.exit(process.exitCode);
console.log("public boundary OK");
