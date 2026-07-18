#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "public/assets/js/share-qr.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");
const logoPath = path.join(root, "public/assets/branding/infra-logo-white-photoroom-title.png");

assert.ok(fs.existsSync(logoPath), "official INFRA wordmark is missing");
assert.ok(script.includes('const SHARE_BRAND_RED = "#e52c31"'), "QR modal does not use the official logo red");
assert.ok(script.includes('const QR_FILL = "#000000"'), "QR modules are not black");
assert.ok(script.includes('background: SHARE_BRAND_RED'), "QR background is not the official INFRA red");
assert.ok(script.includes('ecLevel: "H"'), "inverted-color QR does not use high error correction");
assert.ok(script.includes("quiet: 4"), "QR does not preserve a four-module quiet zone");
assert.ok(
  script.includes("../branding/infra-logo-white-photoroom-title.png"),
  "QR modal does not reuse the official site logo"
);

const dialogStart = script.indexOf("dialog.innerHTML = [");
const dialogEnd = script.indexOf('].join("");', dialogStart);
const dialogMarkup = script.slice(dialogStart, dialogEnd);
assert.ok(dialogStart >= 0 && dialogEnd > dialogStart, "QR dialog markup is missing");
assert.ok(
  dialogMarkup.indexOf("share-dialog-close") < dialogMarkup.indexOf("share-copy"),
  "close must remain on the left of copy in the modal header"
);
assert.strictEqual(
  (dialogMarkup.match(/<rect /g) || []).length,
  2,
  "copy icon must be exactly two overlapping squares"
);
assert.ok(
  dialogMarkup.includes('data-share-copy-toast role="status" aria-live="polite"'),
  "copy result is not exposed as a temporary live toast"
);
assert.ok(!dialogMarkup.includes("share-link"), "legacy visible URL field is still rendered");
assert.ok(!dialogMarkup.includes("Copier le lien</button>"), "legacy text copy button is still rendered");

const copyHandlerStart = script.indexOf('copyButton.addEventListener("click"');
const copyHandlerEnd = script.indexOf("\n\n    getPersistRoot()", copyHandlerStart);
const copyHandler = script.slice(copyHandlerStart, copyHandlerEnd);
assert.ok(copyHandlerStart >= 0 && copyHandlerEnd > copyHandlerStart, "copy click handler is missing");
assert.ok(copyHandler.includes("await copyText(copyUrl, dialog)"), "clipboard write is not called from the explicit click");
assert.ok(copyHandler.includes('showCopyFeedback(copied ? "Lien copié"'), "successful copy does not show the expected toast");
assert.ok(
  script.includes("copyStateTimer = window.setTimeout(resetCopyFeedback, 1600)"),
  "copy toast is not automatically cleared"
);

assert.ok(
  styles.includes("grid-template-columns: 44px minmax(0, 1fr) 44px"),
  "modal header does not expose balanced 44 px controls"
);
assert.ok(styles.includes(".share-dialog-close {\n  grid-column: 1;"), "close control is not on the left");
assert.ok(styles.includes(".share-copy {\n  grid-column: 3;"), "copy control is not on the right");
assert.ok(
  styles.includes("background: var(--share-brand-red, #e52c31)") &&
    styles.includes("border-radius: 50%"),
  "QR is not presented as the circular INFRA red dot"
);
assert.ok(styles.includes(".share-copy-toast.is-visible"), "copy notification has no visible state");
assert.ok(styles.includes(".share-brand-logo"), "official logo has no modal layout");

console.log("INFRA QR modal controls and branding: ok");
