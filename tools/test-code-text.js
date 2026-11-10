#!/usr/bin/env node
"use strict";

// Étape 4e (INFRA) : les recherches dans le code ne dépendent plus du formatage,
// mais restent strictes sur le contenu.
const assert = require("node:assert/strict");
const {
  squash,
  codeHas,
  codeIndexOf,
  codeLastIndexOf,
  codeTest,
  codeMatch,
  codeSearch,
  codeAssertMatch,
  codeAssertDoesNotMatch
} = require("./lib/code-text.js");

const compact = 'function start(a,b){if(!ready){boot(a,b);}return items.map(function(x){return x*2;});}';
const pretty = `function start(a, b) {
  if (!ready) {
    boot(
      a,
      b
    );
  }
  return items.map(function (x) {
    return x * 2;
  });
}`;

assert.equal(squash(pretty), squash(compact));

// includes : exact d'abord, puis sans espaces ; jamais de faux positif sur le contenu
assert.equal(codeHas(pretty, "if (!ready) {\n        boot(a, b);"), true);
assert.equal(codeHas(pretty, "boot(a, c)"), false);
assert.equal(codeHas(["a", "b"], "b"), true, "les tableaux gardent leur comportement");
assert.equal(codeHas(new Set(["a"]).has("a") ? "abc" : "", "b"), true);

// positions : toujours dans le texte d'origine
const at = codeIndexOf(pretty, "boot(a, b);");
assert.equal(pretty.slice(at, at + 5), "boot(");
assert.equal(codeIndexOf(pretty, "absent()"), -1);
const from = codeIndexOf(pretty, "return", at);
assert.equal(pretty.slice(from, from + 12), "return items");
const last = codeLastIndexOf(pretty, "return x*2");
assert.equal(pretty.slice(last, last + 6), "return");
assert.equal(codeIndexOf([3, 4], 4), 1);

// expressions régulières : blancs ignorés hors des classes de caractères
assert.equal(codeTest(/boot\(a, b\);\s*\}\s*return items/, pretty), true);
assert.equal(codeTest(/function start\(a,\s+b\) \{[\s\S]*?return x \* 2;/, pretty), true);
assert.equal(codeTest(/boot\(a, c\)/, pretty), false);
assert.equal(codeTest(/a[ ]b/, "ab"), false, "une classe de caractères n'est pas relâchée");
assert.equal(codeTest(/a[ ]b/, "a b"), true);
const match = codeMatch(pretty, /items\.map\(function \(x\) \{ return (x \* \d);/);
assert.equal(match && match[1], "x*2");
assert.equal(pretty.slice(match.index, match.index + 9), "items.map");
assert.equal(codeSearch(pretty, /return x\*2/), last);
assert.equal(codeMatch("v=12", /v=(\d+)/)[1], "12");
assert.deepEqual("a1b2".match(/\d/g), codeMatch("a1b2", /\d/g), "les recherches globales ne changent pas");

// strict sur les limites : un blanc au bord n'est jamais relâché, deux mots ne fusionnent pas
const tag = '<img class="x" data-cover-src="a.webp">';
assert.equal(codeTest(/\ssrc="/, tag), false, "data-cover-src n'est pas un src");
assert.equal(codeTest(/\ssrc="/, '<img class="x"\n  src="a.webp">'), true);
assert.equal(codeHas(tag, " src="), false);
assert.equal(codeHas("const returnx = 1;", "return x"), false, "deux mots ne fusionnent pas");
assert.equal(codeHas("return\n    x;", "return x;"), true);
assert.equal(codeTest(/const total$/, "const totalAmount"), false);

codeAssertMatch(pretty, /boot\(a,b\)/);
codeAssertDoesNotMatch(pretty, /boot\(b,a\)/);
assert.throws(() => codeAssertMatch(pretty, /boot\(b, a\)/, "ordre des arguments"), /ordre des arguments/);
assert.throws(() => codeAssertDoesNotMatch(pretty, /boot\(a, b\)/, "présent"), /présent/);

console.log("Code text checks passed: formatting-insensitive, content-strict, original positions.");
