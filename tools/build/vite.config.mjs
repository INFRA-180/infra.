// Construction du JavaScript du site avec Vite (choix d'INFRA, 10/11/2026).
// npm run build → public/assets/js/app.js (nom fixe : le Service Worker, l'audit et l'outil
// de catalogue de Codex attendent des noms stables). Le fichier construit est gardé dans Git :
// le site en ligne ne dépend jamais de Vite ni de npm (règle de résilience d'INFRA).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { defineConfig } from "vite";

const { banner } = createRequire(import.meta.url)("./app-sources.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const legacyDir = path.join(root, "public/assets/js") + path.sep;

// Anciens scripts (étape 4a) : chacun dans son propre bloc protégé, comme quand ils étaient
// des fichiers séparés — une erreur au démarrage d'un fichier n'arrête pas les autres.
function isolateLegacyScripts() {
  return {
    name: "infra-isolate-legacy-scripts",
    transform(code, id) {
      if (!id.startsWith(legacyDir) || !id.endsWith(".js")) return null;
      // Modules ES (import/export) : scripts.js et runtime/ — pas d'enveloppe, comme l'ancien scripts.js d'un seul tenant.
      if (id === legacyDir + "scripts.js" || id.startsWith(legacyDir + "runtime" + path.sep)) return null;
      const name = path.basename(id);
      return {
        code: `try {\n${code}\n} catch (error) {\n  console.error("[INFRA] ${name} :", error);\n}\n`,
        map: null
      };
    }
  };
}

// En-tête avec l'empreinte des sources, écrit après la réduction (que rien ne le retire).
function stampBanner() {
  return {
    name: "infra-stamp-banner",
    writeBundle(options, bundle) {
      for (const file of Object.keys(bundle)) {
        if (!file.endsWith(".js")) continue;
        const target = path.join(options.dir, file);
        fs.writeFileSync(target, banner() + "\n" + fs.readFileSync(target, "utf8"));
      }
    }
  };
}

export default defineConfig({
  root,
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  plugins: [isolateLegacyScripts(), stampBanner()],
  build: {
    outDir: path.join(root, "public/assets/js"),
    emptyOutDir: false,
    target: "safari15",
    minify: true,
    sourcemap: false,
    reportCompressedSize: false,
    lib: {
      entry: path.join(here, "app-entry.js"),
      formats: ["iife"],
      name: "InfraApp",
      fileName: () => "app.js"
    }
  }
});
