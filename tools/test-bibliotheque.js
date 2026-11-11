#!/usr/bin/env node
// Bibliothèque V3 (maquette validée par INFRA le 08/11/2026) : contrats des lots 1 et 2.
"use strict";
const { codeHas, codeIndexOf, codeMatch, codeTest } = require("./lib/code-text.js"); // recherches insensibles au formatage (étape 4e)
const fs = require("fs");
const path = require("path");
const loadScript = require("./lib/load-script.js"); // scripts construits comme app.js (lot B)
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

const index = read("public/index.html");
const css = read("public/assets/css/styles.css");
const js = read("public/assets/js/bibliotheque.js");
const home = read("src/js/home-catalog.js");
const fav = read("src/js/favorites-ui.js");
const styles = read("public/assets/css/styles.css");

// Accueil : phrase retirée, cinq onglets dans l'ordre validé (V5 : « Apps & clips » retiré), recherche
expect(!codeTest(/class="hero-sub"/, index), "la phrase sous le logo est revenue");
const tabs = [...index.matchAll(/data-bib-tab="([a-z]+)"/g)].map((m) => m[1]);
expect(tabs.join(",") === "accueil,albums,playlists,titres,favoris", "onglets attendus : " + tabs.join(","));
expect(codeTest(/data-bib-search/, index) && codeTest(/data-bib-searchbtn/, index), "recherche absente");
// Ordre du HTML gardé pour l'outil de mise à jour du catalogue ; ordre visuel en CSS
expect(codeIndexOf(index, 'data-module-id="albums"') < codeIndexOf(index, 'data-module-id="playlists"'), "l'ordre du HTML a changé");
expect(codeTest(/\[data-module-id="playlists"\] \{ order: 1; \}/, css), "Playlists n'est plus affichée en premier");
expect(codeTest(/one-page-layout::after \{ order: 99; \}/, css), "l'espace de fin de page n'est plus en dernier");
// Lot 3 (INFRA, 09/11/2026) : la Bibliothèque est fusionnée dans styles.css, après playlists.css
expect(codeIndexOf(styles, "Ex-playlists.css") > 0 && codeIndexOf(styles, "Ex-bibliotheque.css") > codeIndexOf(styles, "Ex-playlists.css"), "ordre de fusion des styles changé");
// Chargement depuis une page album (retour à l'accueil par la navigation interne)
expect(codeTest(/data-bib-js/, home), "home-catalog.js ne charge plus la bibliothèque");
// Les onglets sont des boutons : la navigation interne ne les intercepte pas
expect(!codeTest(/<a[^>]+data-bib-tab/, index), "un onglet est un lien");
// Lecture d'une liste : même chemin que les favoris, liste non limitée à un album
expect(codeTest(/window\.InfraLibraryPlayback = \{ playPaths: startLibraryPlaybackAt \}/, fav), "point d'entrée de lecture absent");
const hook = fav.slice(codeIndexOf(fav, "function startLibraryPlaybackAt"), codeIndexOf(fav, "window.InfraLibraryPlayback"));
expect(codeTest(/audioState\.playlistKind = "playlist"/, hook), "la liste doit être de type playlist (sinon limitée à un album)");
expect(codeTest(/startTrack\(index,/, hook) && codeTest(/userGesture: true/, hook), "lecture non lancée dans le geste");
expect(codeTest(/api\.playPaths\(/, js), "les titres ne lancent pas la lecture");
// Titres écrits tels quels
expect(codeTest(/text-transform: none !important/, css), "les titres sont remis en majuscules");

// Lot 3 : lecteur de navigation en barre basse (flex, pas grid : la ligne de progression doit rester en haut)
const bar = css.slice(codeIndexOf(css, "lot 3"));
expect(codeTest(/bottom: 0 !important/, bar) && codeTest(/border-radius: 0 !important/, bar) && codeTest(/box-shadow: none !important/, bar), "la barre basse n'est plus posée en bas sans carte");
expect(codeTest(/display: flex !important; \/\* flex, pas grid/, bar), "la barre doit rester en flex");
expect(codeTest(/global-transport-btn\[data-transport-shuffle\]/, bar) && codeTest(/global-transport-btn\.global-transport-mode/, bar), "Aléatoire et Radio doivent quitter la barre");
expect(codeTest(/is-playing \.global-transport-now-title::after/, bar), "point rouge de lecture absent");

// Lot 4 : fiches existantes, commandes explicites et titre complet de playlist.
const player = read("src/js/album-player-ui.js");
const share = read("src/js/share-qr.js");
expect(codeHas(player, 'heading.textContent = heading.getAttribute("aria-label")'), "titre complet de playlist absent");
expect(codeHas(player, 'playCurrentPageCollectionShuffled()'), "commande de lecture aléatoire de la fiche absente");
expect(codeHas(share, 'closest("[data-bib-share]")'), "partage explicite de la fiche absent");
expect(codeHas(css, ".bib-collection-hero") && codeHas(css, ".bib-collection-info"), "mise en page de la fiche absente");
for (const page of ["music/d-2-0141-infra.html", "playlists/infra-moon.html"]) {
  const html = read("public/" + page);
  expect(codeTest(/<main class="page">[\s\S]*<h1[^>]*>[\s\S]*<section class="tracks"[^>]*>[\s\S]*<audio preload="none" data-src=/, html), page + " ne fournit plus la fiche directe");
}

// Lot 6 : le même couple CSS/JS doit être disponible depuis les pages directes et le shell hors ligne.
const sw = read("public/sw.js");
const version = codeMatch(home, /var VERSION = "(bibliotheque-v\d+-\d{8})"/)?.[1];
expect(Boolean(version), "version datée de la Bibliothèque absente");
// Lot 3 (INFRA, 09/11/2026) : les styles de la Bibliothèque sont dans styles.css, plus de feuille à part.
expect(!codeHas(index, "bibliotheque.css"), "lien bibliotheque.css encore présent sur l’accueil");
expect(!codeHas(sw, "bibliotheque.css"), "bibliotheque.css encore dans le précache");
expect(codeHas(sw, "./assets/js/bibliotheque.js?v=" + version), "JS de la Bibliothèque absent du précache");

// Maquette V4 (INFRA, 08/11/2026)
const albumUi = read("src/js/album-player-ui.js");
expect(codeTest(/\.global-transport-controls \{\s*position: absolute !important; left: 50% !important;/, css), "commandes du lecteur pas centrées");
expect(codeTest(/\.spa-route-layer\.album-screen::before[\s\S]{0,200}background-image: none !important/, css), "fond des fiches pas blanc");
expect(codeHas(css, ".bib-meta-row") && codeHas(albumUi, "bib-meta-row"), "boutons de la fiche pas à droite de la ligne d’infos");
expect(!codeHas(albumUi, "bibliotheque.css") && !codeHas(home, "bibliotheque.css"), "ajout dynamique de bibliotheque.css encore présent");
expect(codeHas(js, "bib-idle") && codeHas(js, "[data-transport-toggle]"), "lecteur au repos absent");
expect(codeHas(js, "data-bib-albumplay"), "▶ sur les pochettes absent");
expect(codeHas(js, 'data-bib-goto="playlists">Tout voir'), "« Tout voir » des playlists absent");

// Maquette V5 (INFRA, 09/11/2026) : Playlists, Albums, Vos favoris, Clips, Applications ;
// Clips et Applications repliés par défaut ; clip lu sur place.
const order = (id) => Number((codeMatch(css, new RegExp('\\[data-module-id="' + id + '"\\] \\{ order: (\\d+); \\}')) || [])[1]);
expect(order("playlists") < order("albums") && order("albums") < order("favoris") && order("favoris") < order("clips") && order("clips") < order("apps"), "ordre V5 de l'accueil absent");
expect(!codeTest(/data-bib-view="accueil"\] \.one-page-layout > \[data-module-id="clips"\] \{ display: none/, css), "les clips sont encore cachés de l'accueil");
expect(codeHas(js, 'store.get("clipsOpen", false)') && codeHas(js, 'store.get("appsOpen", false)'), "Clips / Applications pas repliés par défaut");
expect(codeTest(/not\(\.bib-clips-open\)[^{]*\.bib-clips/, css) && codeTest(/not\(\.bib-apps-open\)[^{]*\.apps-grid/, css), "repli CSS des Clips / Applications absent");
expect(codeHas(js, '"Masquer" : "Tout voir"'), "« Tout voir » / « Masquer » absent");
expect(codeHas(js, "Vos favoris") && codeHas(fav, "window.InfraHomeFavorites"), "section « Vos favoris » absente");
expect(codeTest(/data-clip-shell/, index) && codeTest(/data-clip-close/, index) && !codeTest(/clips-menu/, index), "lecteur de clip sur place absent");
const cat = JSON.parse(read("public/data/catalog.json"));
expect(codeTest(/VOLDEMORT/, cat.clips[0].title), "VOLDEMORT doit être le premier clip");
for (const c of cat.clips) {
  const id = (codeMatch(c.youtubeUrl, /v=([\w-]+)/) || [])[1];
  expect(fs.existsSync(path.join(ROOT, "public/assets/clips/" + id + "-480.webp")), "vignette locale absente : " + id);
}

// Gestes iPhone (INFRA, 09/11/2026)
expect(codeHas(js, "// ---------- Gestes iPhone") && codeHas(js, "[data-transport-next]") && codeHas(js, 'kind === "edge"'), "gestes iPhone absents");

// Le script ne plante pas hors navigateur (bancs d'essai des autres tests)
try { loadScript.runInNewContext("public/assets/js/bibliotheque.js", { window: {}, document: {} }); } catch (err) { failures.push("bibliotheque.js plante hors navigateur : " + err.message); }

if (failures.length) {
  console.error("Bibliothèque : " + failures.length + " échec(s)\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Bibliothèque V4 checks passed: tabs, order, frozen styles, loader, list playback, titles as-is, white sheets, centered player, idle player, V5 home (favorites, folded clips and apps).");
