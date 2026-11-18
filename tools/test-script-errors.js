#!/usr/bin/env node
"use strict";
// Lot 9 (Claude, 18/11/2026) : la remontée des erreurs JavaScript tourne vraiment (test de comportement).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs
  .readFileSync(path.resolve(__dirname, "../src/js/runtime/script-errors.js"), "utf8")
  .replace(/^export\s+/gm, "");
const listeners = {};
const window = {
  __infraEarlyErrors: [{ error: new TypeError("détail privé : /Users/x/Music"), module: "favorites.js" }],
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
};
const timers = [];
const ctx = { window, document: { readyState: "complete" }, setTimeout: (fn) => timers.push(fn), console };
vm.runInNewContext(source + "\nthis.install = installScriptErrorReporting; this.report = reportScriptError;", ctx);

const sent = [];
ctx.install((type, payload) => sent.push({ type, payload }));
timers.splice(0).forEach((fn) => fn());

// 1. Erreur d'un bloc protégé survenue avant l'installation : envoyée, sans le message (privé)
assert.equal(sent.length, 1);
assert.equal(sent[0].type, "script_error");
assert.equal(sent[0].payload.error_name, "TypeError");
assert.equal(sent[0].payload.source, "favorites.js");
assert.ok(!JSON.stringify(sent[0]).includes("Users"), "aucun message ni chemin privé envoyé");

// 2. Erreur de script : fichier sans chemin ni paramètres, ligne gardée ; doublon ignoré
const err = new RangeError("x");
listeners.error[0]({ target: window, error: err, filename: "https://infra-180.github.io/infra./assets/js/app.js?v=audiofix451", lineno: 42 });
listeners.error[0]({ target: window, error: err, filename: "https://infra-180.github.io/infra./assets/js/app.js?v=audiofix451", lineno: 42 });
assert.equal(sent.length, 2);
assert.equal(sent[1].payload.source, "app.js");
assert.equal(sent[1].payload.checkpoint, "42");

// 3. Image ou son qui ne charge pas : ignoré ; promesse annulée volontairement : ignorée
listeners.error[0]({ target: { tagName: "IMG" } });
listeners.unhandledrejection[0]({ reason: { name: "AbortError" } });
assert.equal(sent.length, 2);
listeners.unhandledrejection[0]({ reason: new Error("y") });
assert.equal(sent[2].payload.phase, "promise");

// 4. Au plus 10 rapports par session
for (let i = 0; i < 30; i += 1) listeners.error[0]({ target: window, error: new Error("z"), filename: "a.js", lineno: 100 + i });
assert.equal(sent.length, 10);

// 5. Le rapport ne casse jamais la page, même si la télémétrie plante
const ctx2 = { window: { addEventListener() {} }, document: { readyState: "complete" }, setTimeout: () => {}, console };
vm.runInNewContext(source + "\nthis.install = installScriptErrorReporting; this.report = reportScriptError;", ctx2);
ctx2.install(() => { throw new Error("télémétrie en panne"); });
assert.equal(ctx2.report(new Error("a"), "m", "module", "", 0), true);

console.log("Script error reporting checks passed: early module errors, no private text, file/line only, dedupe, resources ignored, 10 max, never throws.");
