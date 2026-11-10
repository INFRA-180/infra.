// Construit UN fichier du site avec Vite, en mémoire, pour les tests (lot B, 10/11/2026).
// Usage : node tools/lib/build-one-script.mjs <fichier.js>  → code construit sur la sortie standard.
// Mêmes règles que app.js (Vite, cible safari15) mais non réduit, pour des erreurs lisibles.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const entry = path.resolve(process.argv[2] || "");

const result = await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: "silent",
  build: {
    write: false,
    emptyOutDir: false,
    target: "safari15",
    minify: false,
    sourcemap: false,
    reportCompressedSize: false,
    lib: {
      entry,
      formats: ["iife"],
      name: "InfraTestScript",
      fileName: () => "script.js"
    }
  }
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output || []);
const chunk = outputs.find((item) => item.type === "chunk");
if (!chunk) {
  console.error("build-one-script : aucun code produit pour " + entry);
  process.exit(1);
}
process.stdout.write(chunk.code);
