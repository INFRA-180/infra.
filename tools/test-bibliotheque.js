#!/usr/bin/env node
// Bibliothèque V3 (maquette validée par INFRA le 08/11/2026) : contrats des lots 1 et 2.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

const index = read("public/index.html");
const css = read("public/assets/css/bibliotheque.css");
const js = read("public/assets/js/bibliotheque.js");
const home = read("public/assets/js/home-catalog.js");
const fav = read("public/assets/js/favorites-ui.js");
const styles = read("public/assets/css/styles.css");

// Accueil : phrase retirée, six onglets dans l'ordre validé, recherche
expect(!/class="hero-sub"/.test(index), "la phrase sous le logo est revenue");
const tabs = [...index.matchAll(/data-bib-tab="([a-z]+)"/g)].map((m) => m[1]);
expect(tabs.join(",") === "accueil,albums,playlists,titres,favoris,apps", "onglets attendus : " + tabs.join(","));
expect(/data-bib-search/.test(index) && /data-bib-searchbtn/.test(index), "recherche absente");
// Ordre du HTML gardé pour l'outil de mise à jour du catalogue ; ordre visuel en CSS
expect(index.indexOf('data-module-id="albums"') < index.indexOf('data-module-id="playlists"'), "l'ordre du HTML a changé");
expect(/\[data-module-id="playlists"\] \{ order: 1; \}/.test(css), "Playlists n'est plus affichée en premier");
expect(/one-page-layout::after \{ order: 99; \}/.test(css), "l'espace de fin de page n'est plus en dernier");
// styles.css reste intact (empreinte du lecteur validé)
expect(!/Bibliothèque V3/.test(styles), "styles.css ne doit pas contenir la bibliothèque");
// Chargement depuis une page album (retour à l'accueil par la navigation interne)
expect(/data-bib-css/.test(home) && /data-bib-js/.test(home), "home-catalog.js ne charge plus la bibliothèque");
// Les onglets sont des boutons : la navigation interne ne les intercepte pas
expect(!/<a[^>]+data-bib-tab/.test(index), "un onglet est un lien");
// Lecture d'une liste : même chemin que les favoris, liste non limitée à un album
expect(/window\.InfraLibraryPlayback = \{ playPaths: startLibraryPlaybackAt \}/.test(fav), "point d'entrée de lecture absent");
const hook = fav.slice(fav.indexOf("function startLibraryPlaybackAt"), fav.indexOf("window.InfraLibraryPlayback"));
expect(/audioState\.playlistKind = "playlist"/.test(hook), "la liste doit être de type playlist (sinon limitée à un album)");
expect(/startTrack\(index,/.test(hook) && /userGesture: true/.test(hook), "lecture non lancée dans le geste");
expect(/api\.playPaths\(/.test(js), "les titres ne lancent pas la lecture");
// Titres écrits tels quels
expect(/text-transform: none !important/.test(css), "les titres sont remis en majuscules");

// Le script ne plante pas hors navigateur (bancs d'essai des autres tests)
try { vm.runInNewContext(js, { window: {}, document: {} }); } catch (err) { failures.push("bibliotheque.js plante hors navigateur : " + err.message); }

if (failures.length) {
  console.error("Bibliothèque : " + failures.length + " échec(s)\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Bibliothèque V3 checks passed: tabs, order, frozen styles, loader, list playback, titles as-is.");
