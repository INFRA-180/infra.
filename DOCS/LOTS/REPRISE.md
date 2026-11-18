---
date: 2026-11-13
type: REPRISE
état: en_cours
---

# REPRISE — SITE INFRA

État courant et tâches en attente.

## Registre du 18/11 (Claude) — lots 0 et 1 faits, lots 2 à 4 attendent « go »

**Plan complet : `DOCS/PLAN_GRAND_LOT_20261118.md`** (local, `PLAN_*` ignoré par Git). INFRA 18/11 : « cover » = pochette visible dans l'aperçu du morceau ; zip par album choisi.

1. **FAIT — App Musique qui s'ouvre.** Cause : la synchro lançait Musique toutes les 5 min (`read-music-library.jxa`, `Music.launch()`), même sans changement. Patch (`_private/tools/watch-itunes-r2-catalog.js`) : empreinte du dossier `Infra_` + de la bibliothèque Musique ; Musique n'est interrogée que si l'empreinte change, si une reprise est prévue, ou si Musique est déjà ouverte. Test : `_private/tools/test-music-quiet-gate.js` (vert). Synchro redémarrée le 18/11 21:04. Non vérifié : une soirée entière sans ouverture (à lire dans `auto-sync.log` : « Musique n'est pas interrogee »).
2. **FAIT — Publication bloquée depuis le 11/11.** Deux causes : notes non commitées, puis outil de publication resté sur l'ancien emplacement de `scripts.js` (lot E du 11/11 : `src/js/` + Vite). Patch : `site-publication-files.js` prépare et applique `public/` **et** `src/js/`, `app.js` reconstruit est ajouté à la publication. Tests verts. Album D 2.0141 publié tout seul (`9c434af`, déploiement OK). **Règle : commiter les notes tout de suite, sinon la publication automatique attend.**
3. **Chaufferie** (sections lentes à froid) : la page attend la pochette 1200 sans délai max (`spa-renderer.js:891`) ; 2 pochettes préparées seulement (`scripts.js:535`) ; vignettes 400 effacées à chaque mise en ligne ; Titres charge la 1200. Gestes : `touchmove` non passif (`bibliotheque.js`).
4. **Statistiques d'écoute à rendre propres** : `audio-telemetry.js` 3 267 lignes, 144 appels `trackAudioRuntimeEvent` dans `src/js`, mêlés au démarrage d'un titre (`audio-core.js:762-815`). Garder le tableau de bord et les incidents.
5. **Téléchargements Cloudflare au lieu de Drive** : faisable (worker `infra180-audio` + bucket R2 `infra-audio` déjà en place). 18 albums + 3 apps sur Drive. **Bug** : le lien de l'album Gaia = celui de l'app REVERB.
   - 18/11 INFRA : supprimer tous les liens Drive, **tous les albums** (32) téléchargeables depuis l'app. Proposé : un zip par album (AAC 320 + pochette), préparé d'avance sur R2 (~2 Go en plus, sous les 10 Go gratuits) ; pas de zip « tout » (trop lourd pour un téléphone). Questions ouvertes : zip seul ou + titre à l'unité ; apps (3) aussi sur R2.
   - 18/11 INFRA : **zip par album** ; la pochette doit se voir dans l'aperçu de chaque morceau ; le téléchargement doit être **stylé, intégré** : menu **« ⋯ »** (Télécharger, Partager…), comme un site de streaming.
   - 18/11 « Go maquette ⋯ » → **maquette V21 prête** : `DOCS/maquettes/MAQUETTE_BIBLIOTHEQUE_V21_20261118.html` + `MAQUETTE_V21_20261118.md` (⋯ sur album, lignes, grand lecteur ; clic droit, appui long, clavier ; feuille du bas sur téléphone). **Attend l'avis d'INFRA** ; ensuite lot 2 (zips Cloudflare + report dans le site).
   - 18/11 **VALIDÉ par INFRA** : « c'est bien » ; clic droit « pas du tout invasif ». Demandes : clic droit / appui long → **télécharger le morceau** (pas seulement l'album) ; sur iPhone il arrive dans **Fichiers** (l'app Musique : impossible depuis un site, confirmé) ; le morceau porte sa pochette. **Cœur des lignes** : INFRA propose de l'enlever (il est dans ⋯), hésite (« c'est pratique ») → avis de Claude demandé → maquette V22.
   - 18/11 **maquette V22 prête** : `DOCS/maquettes/MAQUETTE_BIBLIOTHEQUE_V22_20261118.html` + `MAQUETTE_V22_20261118.md` — « Télécharger le morceau » (`INFRA. - <Titre>.m4a`, pochette intégrée) dans ⋯ / clic droit / appui long ; cœur retiré des lignes, petite marque rouge si favori, cœur du grand lecteur gardé. **Attend l'avis d'INFRA.**

6. **Samples et Crédits sur le site** — suivi par la session « Samples par musique et playlists YouTube » (Claude) ; **registre et plan : `SITE_INFRA./INVENTAIRE_SAMPLES/PLAN_SAMPLES_SITE_20261118.md`**, maquette v2 `MAQUETTE_SAMPLES_V2_20261118.html` (validée dans l'idée). Décidé : playlists **Spotify** sur le compte d'INFRA (une par album + totales, publiques ; Premium OK) ; YouTube écran verrouillé impossible sur iPhone (Safari/PWA) ; miroir YouTube sur Cloudflare écarté. En attente : INFRA crée l'app Spotify (developer.spotify.com, retour `http://127.0.0.1:8888/callback`) et donne le Client ID. Idées notées ici le 18/11 (album sample au clic droit, Apple Music via Raccourci, page Crédits avec VST / master / lieux Marseille-Sud, quitter la playlist en restant sur l'album) → à fusionner dans ce plan.
   - **Qui fait quoi (18/11, mis à jour)** : INFRA veut tout suivre dans **ce fil** (session Claude du site) ; la session « Samples » a passé la main. Crédits : **produit, mixé et masterisé par INFRA**. Prochaine étape Spotify : INFRA crée l'app et donne le Client ID.
   - 18/11 INFRA, Crédits : **arrangé, mixé, masterisé et produit par INFRA** ; aucune prise de son, tout sur ordinateur ; lieu Marseille (sinon « le Sud »). VST **par piste**. Sons **Splice** : prouvé que la base locale de Splice (`~/Library/Application Support/com.splice.Splice/…/sounds.db`, lue sur copie) donne pack + créateur : 963 sons des projets reconnus, 219 morceaux, 74 créateurs. **Transformations** (« drum pitché, BPM plus rapide = arrangement ») : prouvé lisibles dans les `.als` (MARJOLAINE : Crystal Wave −3 demi-tons, ~143 → 120 BPM, découpé en clips). App ou site ? → **site** (déjà une app installable) + outil local qui relit les `.als` et refait les crédits seul. Date de création = plus ancienne trace (Backup/, sons datés) : lisible pour 400 projets sur 400. **Grand plan v2** : `DOCS/PLAN_GRAND_LOT_20261118.md` (registre de 24 demandes, lots 2 à 8). **Maquette V23 Crédits prête** : `DOCS/maquettes/MAQUETTE_BIBLIOTHEQUE_V23_20261118.html` + `MAQUETTE_V23_20261118.md`. **Attend l'avis d'INFRA** sur V22 et V23.
   - 18/11 INFRA sur V23 : **« incroyable »** (validée dans l'idée). Demandes : (a) **écouter chaque sample depuis les crédits** (téléphone compris) ; (b) **artistes justes** : lire les **métadonnées** des fichiers (ex. « META » : l'artiste n'est pas « feat. Jul ») ; (c) **regrouper** samples et voix en une seule liste (pas de rubrique « Voix ») ; (d) **survol d'un plugin → à quoi il ressemble** (« incrédible ») ; (e) **mise en page de la partie effets** (trop de lecture) ; (f) le rouge « pique les yeux » ; (g) matériel : **Mac M1 Max 64 Go**, **casque Beyerdynamic**, pas d'enceintes, **test voiture Golf 4 GTI**. (h) **« Vérifie tous les moteurs, tous les codes, ultra résilient »** → audit de résilience (lot 9). → **maquette V24 prête** : `DOCS/maquettes/MAQUETTE_BIBLIOTHEQUE_V24_20261118.html` + `MAQUETTE_V24_20261118.md` (samples regroupés avec artistes des métadonnées, ▶ écouter sans quitter la page, effets par type / par piste, fiche plugin au survol, matériel). **Audits de résilience faits** (front : `DOCS/AUDIT_RESILIENCE_FRONT_20261118.md` ; moteurs : `_private/docs/AUDIT_RESILIENCE_MOTEURS_20261118.md`) → lot 9 du plan. Attend l'avis d'INFRA (V22, V24, image des plugins). — 18/11 INFRA : sur une **voix**, il ne garde **que l'artiste principal**, jamais le feat (ex. META = Le Rat Luciano ; Et je deviens fou = Jul) → appliqué dans V24 (titre sans « (feat. …) ») ; 40 voix sur 143 sans artiste connu (pas de fichier d'origine) → à retrouver au lot 3, validées par INFRA.

## QR Code rond — maquette prête (13/11, Claude)

**Demande d'INFRA** : « je veux que le QR code soit rond ».

**Fait (maquette seulement, code du site inchangé)** : `DOCS/maquettes/MAQUETTE_QR_ROND_20261113.html`, détail dans `MAQUETTE_QR_ROND_20261113.md`.
- Nouvelle variante **QR rond** (par défaut) : le code reste au centre, et des pastilles décoratives remplissent tout le disque rouge ; yeux ronds ; 2 modules vides autour du code.
- Variante **QR rond + pastille centrale** (« I. » au centre).
- Preuve : lecteur QR de macOS (CIDetector) sur capture → les 2 variantes donnent `https://infra-180.github.io/infra./`. L'ancienne variante « Pastilles rondes » (yeux carrés arrondis) : illisible pour ce lecteur.
- Non vérifié : lecture par l'appareil photo d'un vrai iPhone.

- 13/11 suite — INFRA : « qr ronds mais sans les yeux ou qui s'intègre mieux ». Les yeux (repères des coins) sont obligatoires pour la lecture : ils sont maintenant dessinés **avec les mêmes pastilles** que le reste. Variantes **Yeux en pastilles** (par défaut) et **Yeux en pastilles + pupille** (centre en un rond plein). Les 2 lues par macOS (CIDetector) → bon lien.

- 13/11 suite 2 — Yeux en **cercles pointillés** (par défaut, lus par macOS même à 200 px) ; **géométrie de la carte** mesurée et corrigée dans la maquette (rond trop près du logo, marges inégales ; détail dans `MAQUETTE_QR_ROND_20261113.md`) ; **carte transparente** proposée : verre clair, verre fumé, blanche.
- 13/11 — **Maquette installation PWA** proposée : `DOCS/maquettes/MAQUETTE_PWA_INSTALL_20261113.html` + `.md` (pictogramme permanent dans l'en-tête, bandeau dès la 2e visite ou 30 s d'écoute, ✕ = repos 14 j, 3 refus max, bouton Installer natif Chrome/Android/Mac, Mac Safari « Ajouter au Dock »).

- **13/11 — VALIDÉ par INFRA** : QR **yeux en cercles pointillés** + **carte verre fumé** (INFRA s'est corrigé le 13/11 : fumé, pas clair) + géométrie corrigée (maquette `MAQUETTE_QR_ROND_20261113.html`). À reporter dans `src/js/share-qr.js` + CSS après « go ».
- 13/11 — Installation PWA : INFRA hésite (« un truc facile mais pas tout le temps présent, même sur navigateur »). Avis Claude (proposé) : pas de pictogramme permanent dans l'en-tête ; bandeau automatique rare (téléphone seulement, 2e visite ou 30 s d'écoute, ✕ = 30 jours, 2 fois max) ; une entrée « Installer » rangée dans la carte de partage (sous le QR), là où on la cherche, sur tous les appareils.

- 13/11 — INFRA : « go maquette def ». Fait : `DOCS/maquettes/MAQUETTE_PARTAGE_INSTALL_DEF_20261113.html` + `.md` — carte QR validée (cercles pointillés, verre fumé, géométrie mesurée) + installation discrète (« Installer » dans la carte de partage, bandeau téléphone seulement, ✕ = 30 j, 2 refus max). QR lu par macOS, scénarios rejoués.

- 13/11 — **Reporté dans le site (audiofix449)** après « Go, reporte » : QR rond cercles pointillés + verre fumé + géométrie. Installation **changée par INFRA en cours de route** : ni bandeau automatique ni « Installer » dans la carte ; petit pictogramme en haut à droite de l'accueil les 2 premières visites seulement (détail : `DOCS/IMPLEMENTATION_NOTES.md`).

**FAIT (13/11, Claude) — carte QR qui reste affichée** (code modifié, non commité) :
- `src/js/share-qr.js` : plus aucune fermeture par le fond (écouteurs `pointerdown`/`pointerup`/`pointercancel`/`click` du fond retirés, `closedby="any"` → `"closerequest"`) ; garde sur le doigt qui ouvre (`openingPointerId`) pour que le relâchement de l'appui long, même tombé pile sur la croix, n'ait aucun effet (libérée 600 ms après le relâchement).
- Échap conservé sur ordinateur (convention clavier).
- Preuve (navigateur, écran 375×812, gestes simulés) : ouverte après appui long ✓ ; reste ouverte au relâchement sur la croix ✓ ; reste ouverte après appui sur le fond ✓ ; après glissement ✓ ; après un appui très long (3 s) puis relâchement sur la croix ✓ ; se ferme par la croix ✓ ; par Échap ✓. `npm test` : vert (24 contrôles, audit de publication passé).
- Non vérifié : iPhone réel.

**Demande d'origine (13/11)** — carte QR ouverte par appui long sur le logo :
- elle doit **rester affichée** quand on relâche le doigt, pour pouvoir montrer/scanner le QR ;
- on la quitte **seulement avec la croix** : pas de fermeture en touchant le fond, en relâchant, ni par glissement.
- Code concerné : `src/js/share-qr.js` (`closeFromPointer` sur le fond : `pointerup` / `click` sur `dialog`, `closedby="any"`, `cancel`). À vérifier : la touche Échap sur ordinateur (proposé : la garder, convention clavier).
- INFRA fait la suite dans une autre session. → repris ici le 13/11 par Claude.

**13/11 (Claude) — carte transparente selon le thème + vrai QR** (code modifié, non commité, non publié) :
- Verre **clair** sur thème clair (blanc très transparent, voile allégé, logo d'origine) et **fumé** sur thème sombre (logo blanc). Détecté par l'encre du thème (`--ink`), pas par une liste de thèmes.
- QR : le lien encodé était déjà bon ; c'est la **lisibilité** qui pêchait. Repères normalisés (carrés pleins) au lieu des cercles de pastilles, marge de silence 4 modules, correction M (29 modules au lieu de 37), pastilles plus grosses. Marge de lecture ×1,7 (flou 3 au lieu de 2, réduction à 70 px au lieu de 120).
- `npm test` vert ; `tools/test-share-qr-ui.js` mis à jour (il figeait l'ancien dessin). Détail : `DOCS/IMPLEMENTATION_NOTES.md`.
- **Proposé, en attente d'INFRA** : passer le QR d'un disque à un **carré arrondi rouge**. Mesuré : 7,9 px par module au lieu de 5,6, lisible jusqu'à un flou de 4 et une réduction à 70 px sur le lien du site — c'est le plus gros gain possible, mais ça change la forme ronde validée le 13/11.

**13/11 (Claude) — patch publié** : QR **rond gardé** (repères en cercles pleins, correction M, 29 modules, disque élargi, marge 2) — lu jusqu'à un flou de 3 et réduit à 70 px, contre flou 2 / 120 px avant ; verre selon le **mode du système** (et non le thème du site) ; fermeture par la croix, **hors du cadre** et Échap, jamais au relâchement ni au glissement ; **versions montées** (`audiofix450`) — sans ça l'iPhone gardait l'ancien code.

**Ensuite** : INFRA teste sur iPhone réel (scanner le QR avec un autre appareil).

---

## Statut général

- ✓ Lecture seule — exploration du code effectuée
- ⏳ En attente du choix d'INFRA sur la maquette QR rond
- Tests passants : aucune modification appliquée
