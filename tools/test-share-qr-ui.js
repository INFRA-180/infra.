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
assert.ok(codeHas(script, 'ecLevel: "H"'), "inverted-color QR does not use high error correction");
// QR rond validé par INFRA (13/11/2026) : 2 modules vides autour du code, puis le disque rempli de pastilles ;
// repères en cercles de 20 pastilles. Lu par le lecteur QR de macOS.
assert.ok(codeHas(script, "const QR_RING = 2"), "QR code lost its empty ring around the data");
assert.ok(codeHas(script, "const QR_EYE_DOTS = 20"), "QR finder patterns are not dotted circles");
assert.ok(codeHas(script, "if (isFinderModule(r, q, n)) continue;"), "square finder modules are still drawn");
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
