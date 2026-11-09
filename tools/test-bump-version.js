#!/usr/bin/env node
"use strict";

// Lot 2 (INFRA, 09/11/2026) : les trois versions montent ensemble, partout, et rien d'autre ne bouge.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bump } = require("./bump-version.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bump-version-"));
const write = (relative, text) => {
  const filePath = path.join(tmp, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
};

try {
  write("assets/js/scripts.js", 'window.INFRA_BUILD_TAG = "audiofix420-20261109";\nconst SPA_SHELL_VERSION = "infra-shell-20261109-audio419";\n');
  write("sw.js", 'const VERSION = "infra-shell-20261109-audio419";\n"./assets/js/scripts.js?v=audiofix420-20261109",\n"./assets/css/bibliotheque.css?v=bibliotheque-v9-20261109",\n');
  write("index.html", '<link href="assets/css/bibliotheque.css?v=bibliotheque-v9-20261109"><script src="assets/js/scripts.js?v=audiofix420-20261109"></script>\n');
  write("assets/js/home-catalog.js", 'var VERSION = "bibliotheque-v9-20261109";\n');
  write("music/album.html", '<script src="../assets/js/scripts.js?v=audiofix420-20261109"></script>\n');
  write("assets/music/notes.txt", "audiofix420-20261109\n"); // dossier média : jamais touché
  write("data/untouched.json", '{"a":1}\n');

  const dry = bump(tmp, { dry: true, date: "20261110" });
  assert.equal(dry.changed.length, 5);
  assert.match(fs.readFileSync(path.join(tmp, "index.html"), "utf8"), /audiofix420-20261109/, "la simulation n'écrit rien");

  const result = bump(tmp, { date: "20261110" });
  assert.deepEqual(result.next, {
    build: "audiofix421-20261110",
    shell: "infra-shell-20261110-audio421",
    bib: "bibliotheque-v10-20261110"
  });
  const sw = fs.readFileSync(path.join(tmp, "sw.js"), "utf8");
  assert.match(sw, /const VERSION = "infra-shell-20261110-audio421"/);
  assert.match(sw, /scripts\.js\?v=audiofix421-20261110/);
  assert.match(sw, /bibliotheque\.css\?v=bibliotheque-v10-20261110/);
  assert.match(fs.readFileSync(path.join(tmp, "assets/js/scripts.js"), "utf8"), /SPA_SHELL_VERSION = "infra-shell-20261110-audio421"/);
  assert.match(fs.readFileSync(path.join(tmp, "music/album.html"), "utf8"), /audiofix421-20261110/);
  assert.equal(fs.readFileSync(path.join(tmp, "assets/music/notes.txt"), "utf8"), "audiofix420-20261109\n");
  assert.equal(fs.readFileSync(path.join(tmp, "data/untouched.json"), "utf8"), '{"a":1}\n');
  for (const file of ["sw.js", "index.html", "assets/js/scripts.js", "assets/js/home-catalog.js"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, file), "utf8"), /audiofix420|audio419|bibliotheque-v9-/);
  }
  console.log("Version bump checks passed: three versions together, media untouched.");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
