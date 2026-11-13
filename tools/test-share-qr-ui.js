#!/usr/bin/env node
"use strict";

const { codeHas, codeIndexOf, codeMatch } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "src/js/share-qr.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");
const logoPath = path.join(root, "public/assets/branding/infra-logo-white-photoroom-title.png");

assert.ok(fs.existsSync(logoPath), "official INFRA wordmark is missing");
assert.ok(codeHas(script, 'const SHARE_BRAND_RED = "#e52c31"'), "QR modal does not use the official logo red");
assert.ok(codeHas(script, 'const QR_FILL = "#000000"'), "QR modules are not black");
assert.ok(codeHas(script, "context.fillStyle = SHARE_BRAND_RED"), "QR background is not the official INFRA red");
// Vrai QR lisible par un appareil photo (INFRA, 13/11/2026) : repères normalisés, marge de
// silence de 4 modules sans décor, correction M (29 modules au lieu de 37).
assert.ok(codeHas(script, 'const QR_EC_LEVEL = "M"'), "QR no longer uses the readable error-correction level");
assert.ok(codeHas(script, "ecLevel: QR_EC_LEVEL"), "QR matrix ignores the error-correction level");
assert.ok(codeHas(script, "const QR_RING = 2"), "QR code lost its quiet zone");
// Rond, dedans compris (INFRA, 13/11/2026) : disque rouge, modules et repères ronds.
assert.ok(codeHas(styles, "border-radius: 50%;\n}"), "QR field is no longer round");
assert.ok(codeHas(script, "dot(cx, cy, 3.5 * unit)"), "QR finder patterns are not round");
assert.ok(codeHas(script, "dot(cx, cy, 2.5 * unit)"), "QR finder patterns lost their light ring");
assert.ok(codeHas(script, "dot(cx, cy, 1.5 * unit)"), "QR finder patterns lost their centre");
assert.ok(codeHas(script, "fillerNoise"), "decorative dots around the code are gone");
assert.ok(!codeHas(script, "QR_EYE_DOTS"), "QR finder patterns are dotted circles again (unreadable by a camera)");
assert.ok(codeHas(script, "if (isFinderModule(r, q, n)) continue;"), "finder modules are drawn twice");
// Verre adapté au thème (INFRA, 13/11/2026) : fumé sur fond sombre, clair sinon.
assert.ok(codeHas(script, 'parts.dialog.dataset.glass = dark ? "fume" : "clair"'), "share card glass no longer follows the theme");
assert.ok(codeHas(styles, '.share-dialog[data-glass="clair"] .share-dialog-panel'), "light glass is missing from the stylesheet");
assert.ok(codeHas(script, "drawRoundQr(QrCreator, url)"), "share dialog does not draw the round QR");
assert.ok(!codeHas(script, "data-share-install"), "install entry is back in the share card (refused by INFRA, 13/11/2026)");
assert.ok(
  codeHas(script, "../branding/infra-logo-white-photoroom-title.png"),
  "QR modal does not reuse the official site logo"
);

const dialogStart = codeIndexOf(script, "dialog.innerHTML = [");
const dialogEnd = codeIndexOf(script, '].join("");', dialogStart);
const dialogMarkup = script.slice(dialogStart, dialogEnd);
assert.ok(dialogStart >= 0 && dialogEnd > dialogStart, "QR dialog markup is missing");
assert.ok(
  codeIndexOf(dialogMarkup, "share-dialog-close") < codeIndexOf(dialogMarkup, "share-copy"),
  "close must remain on the left of copy in the modal header"
);
assert.strictEqual(
  (codeMatch(dialogMarkup, /<rect /g) || []).length,
  2,
  "copy icon must be exactly two overlapping squares"
);
assert.ok(
  codeHas(dialogMarkup, 'data-share-copy-toast role="status" aria-live="polite"'),
  "copy result is not exposed as a temporary live toast"
);
assert.ok(!codeHas(dialogMarkup, "share-link"), "legacy visible URL field is still rendered");
assert.ok(!codeHas(dialogMarkup, "Copier le lien</button>"), "legacy text copy button is still rendered");

const copyHandlerStart = codeIndexOf(script, 'copyButton.addEventListener("click"');
const copyHandlerEnd = codeIndexOf(script, "\n\n    getPersistRoot()", copyHandlerStart);
const copyHandler = script.slice(copyHandlerStart, copyHandlerEnd);
assert.ok(copyHandlerStart >= 0 && copyHandlerEnd > copyHandlerStart, "copy click handler is missing");
assert.ok(codeHas(copyHandler, "await copyText(copyUrl, dialog)"), "clipboard write is not called from the explicit click");
assert.ok(codeHas(copyHandler, 'showCopyFeedback(copied ? "Lien copié"'), "successful copy does not show the expected toast");
assert.ok(
  codeHas(script, "copyStateTimer = window.setTimeout(resetCopyFeedback, 1600)"),
  "copy toast is not automatically cleared"
);

assert.ok(
  codeHas(styles, "grid-template-columns: 44px minmax(0, 1fr) 44px"),
  "modal header does not expose balanced 44 px controls"
);
assert.ok(codeHas(styles, ".share-dialog-close {\n  grid-column: 1;"), "close control is not on the left");
assert.ok(codeHas(styles, ".share-copy {\n  grid-column: 3;"), "copy control is not on the right");
assert.ok(
  codeHas(styles, "background: var(--share-brand-red, #e52c31)") &&
    codeHas(styles, "border-radius: 50%"),
  "QR is not presented as the circular INFRA red dot"
);
assert.ok(codeHas(styles, ".share-copy-toast.is-visible"), "copy notification has no visible state");
assert.ok(codeHas(styles, ".share-brand-logo"), "official logo has no modal layout");
assert.ok(codeHas(styles, "background: rgba(20, 22, 28, 0.48)"), "share card is not smoked glass");
assert.ok(codeHas(styles, "padding: 18px 20px 30px"), "share card lost its measured bottom margin");

console.log("INFRA QR modal controls and branding: ok");
