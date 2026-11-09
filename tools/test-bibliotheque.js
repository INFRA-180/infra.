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
const css = read("public/assets/css/styles.css");
const js = read("public/assets/js/bibliotheque.js");
const home = read("public/assets/js/home-catalog.js");
const fav = read("public/assets/js/favorites-ui.js");
const styles = read("public/assets/css/styles.css");

// Accueil : phrase retirée, cinq onglets dans l'ordre validé (V5 : « Apps & clips » retiré), recherche
expect(!/class="hero-sub"/.test(index), "la phrase sous le logo est revenue");
const tabs = [...index.matchAll(/data-bib-tab="([a-z]+)"/g)].map((m) => m[1]);
expect(tabs.join(",") === "accueil,albums,playlists,titres,favoris", "onglets attendus : " + tabs.join(","));
expect(/data-bib-search/.test(index) && /data-bib-searchbtn/.test(index), "recherche absente");
// Ordre du HTML gardé pour l'outil de mise à jour du catalogue ; ordre visuel en CSS
expect(index.indexOf('data-module-id="albums"') < index.indexOf('data-module-id="playlists"'), "l'ordre du HTML a changé");
expect(/\[data-module-id="playlists"\] \{ order: 1; \}/.test(css), "Playlists n'est plus affichée en premier");
expect(/one-page-layout::after \{ order: 99; \}/.test(css), "l'espace de fin de page n'est plus en dernier");
// Lot 3 (INFRA, 09/11/2026) : la Bibliothèque est fusionnée dans styles.css, après playlists.css
expect(styles.indexOf("Ex-playlists.css") > 0 && styles.indexOf("Ex-bibliotheque.css") > styles.indexOf("Ex-playlists.css"), "ordre de fusion des styles changé");
// Chargement depuis une page album (retour à l'accueil par la navigation interne)
expect(/data-bib-js/.test(home), "home-catalog.js ne charge plus la bibliothèque");
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

// Lot 3 : lecteur de navigation en barre basse (flex, pas grid : la ligne de progression doit rester en haut)
const bar = css.slice(css.indexOf("lot 3"));
expect(/bottom: 0 !important/.test(bar) && /border-radius: 0 !important/.test(bar) && /box-shadow: none !important/.test(bar), "la barre basse n'est plus posée en bas sans carte");
expect(/display: flex !important; \/\* flex, pas grid/.test(bar), "la barre doit rester en flex");
expect(/global-transport-btn\[data-transport-shuffle\]/.test(bar) && /global-transport-btn\.global-transport-mode/.test(bar), "Aléatoire et Radio doivent quitter la barre");
expect(/is-playing \.global-transport-now-title::after/.test(bar), "point rouge de lecture absent");

// Lot 4 : fiches existantes, commandes explicites et titre complet de playlist.
const player = read("public/assets/js/album-player-ui.js");
const share = read("public/assets/js/share-qr.js");
expect(player.includes('heading.textContent = heading.getAttribute("aria-label")'), "titre complet de playlist absent");
expect(player.includes('playCurrentPageCollectionShuffled()'), "commande de lecture aléatoire de la fiche absente");
expect(share.includes('closest("[data-bib-share]")'), "partage explicite de la fiche absent");
expect(css.includes(".bib-collection-hero") && css.includes(".bib-collection-info"), "mise en page de la fiche absente");
for (const page of ["music/d-2-0141-infra.html", "playlists/infra-moon.html"]) {
  const html = read("public/" + page);
  expect(/<main class="page">[\s\S]*<h1[^>]*>[\s\S]*<section class="tracks"[^>]*>[\s\S]*<audio preload="none" data-src=/.test(html), page + " ne fournit plus la fiche directe");
}

// Lot 6 : le même couple CSS/JS doit être disponible depuis les pages directes et le shell hors ligne.
const sw = read("public/sw.js");
const version = home.match(/var VERSION = "(bibliotheque-v\d+-\d{8})"/)?.[1];
expect(Boolean(version), "version datée de la Bibliothèque absente");
// Lot 3 (INFRA, 09/11/2026) : les styles de la Bibliothèque sont dans styles.css, plus de feuille à part.
expect(!index.includes("bibliotheque.css"), "lien bibliotheque.css encore présent sur l’accueil");
expect(!sw.includes("bibliotheque.css"), "bibliotheque.css encore dans le précache");
expect(sw.includes("./assets/js/bibliotheque.js?v=" + version), "JS de la Bibliothèque absent du précache");

// Maquette V4 (INFRA, 08/11/2026)
const albumUi = read("public/assets/js/album-player-ui.js");
expect(/\.global-transport-controls \{\s*position: absolute !important; left: 50% !important;/.test(css), "commandes du lecteur pas centrées");
expect(/\.spa-route-layer\.album-screen::before[\s\S]{0,200}background-image: none !important/.test(css), "fond des fiches pas blanc");
expect(css.includes(".bib-meta-row") && albumUi.includes("bib-meta-row"), "boutons de la fiche pas à droite de la ligne d’infos");
expect(!albumUi.includes("bibliotheque.css") && !home.includes("bibliotheque.css"), "ajout dynamique de bibliotheque.css encore présent");
expect(js.includes("bib-idle") && js.includes("[data-transport-toggle]"), "lecteur au repos absent");
expect(js.includes("data-bib-albumplay"), "▶ sur les pochettes absent");
expect(js.includes('data-bib-goto="playlists">Tout voir'), "« Tout voir » des playlists absent");

// Maquette V5 (INFRA, 09/11/2026) : Playlists, Albums, Vos favoris, Clips, Applications ;
// Clips et Applications repliés par défaut ; clip lu sur place.
const order = (id) => Number((css.match(new RegExp('\\[data-module-id="' + id + '"\\] \\{ order: (\\d+); \\}')) || [])[1]);
expect(order("playlists") < order("albums") && order("albums") < order("favoris") && order("favoris") < order("clips") && order("clips") < order("apps"), "ordre V5 de l'accueil absent");
expect(!/data-bib-view="accueil"\] \.one-page-layout > \[data-module-id="clips"\] \{ display: none/.test(css), "les clips sont encore cachés de l'accueil");
expect(js.includes('store.get("clipsOpen", false)') && js.includes('store.get("appsOpen", false)'), "Clips / Applications pas repliés par défaut");
expect(/not\(\.bib-clips-open\)[^{]*\.bib-clips/.test(css) && /not\(\.bib-apps-open\)[^{]*\.apps-grid/.test(css), "repli CSS des Clips / Applications absent");
expect(js.includes('"Masquer" : "Tout voir"'), "« Tout voir » / « Masquer » absent");
expect(js.includes("Vos favoris") && fav.includes("window.InfraHomeFavorites"), "section « Vos favoris » absente");
expect(/data-clip-shell/.test(index) && /data-clip-close/.test(index) && !/clips-menu/.test(index), "lecteur de clip sur place absent");
const cat = JSON.parse(read("public/data/catalog.json"));
expect(/VOLDEMORT/.test(cat.clips[0].title), "VOLDEMORT doit être le premier clip");
for (const c of cat.clips) {
  const id = (c.youtubeUrl.match(/v=([\w-]+)/) || [])[1];
  expect(fs.existsSync(path.join(ROOT, "public/assets/clips/" + id + "-480.webp")), "vignette locale absente : " + id);
}

// Gestes iPhone (INFRA, 09/11/2026)
expect(js.includes("// ---------- Gestes iPhone") && js.includes("[data-transport-next]") && js.includes('kind === "edge"'), "gestes iPhone absents");

// Le script ne plante pas hors navigateur (bancs d'essai des autres tests)
try { vm.runInNewContext(js, { window: {}, document: {} }); } catch (err) { failures.push("bibliotheque.js plante hors navigateur : " + err.message); }

if (failures.length) {
  console.error("Bibliothèque : " + failures.length + " échec(s)\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Bibliothèque V4 checks passed: tabs, order, frozen styles, loader, list playback, titles as-is, white sheets, centered player, idle player, V5 home (favorites, folded clips and apps).");
