# RAPPORT — audiofix320 PWA safe-area continuity

Date : 2026-07-14
Runtime : `audiofix320-20260714`
Service Worker : `infra-shell-20260714-audio320`

## Confirmation publique

- Les 36 documents PWA publics — accueil, 31 albums, 3 apps et Sphragis — contiennent `viewport-fit=cover` dans la meta viewport et `apple-mobile-web-app-status-bar-style` à `black-translucent`.
- Le 37e fichier HTML sous `public/` est le fichier de vérification Google. Il reste volontairement inchangé afin de préserver son contenu de vérification exact.
- `setThemeColor()` synchronise simultanément `meta[name="theme-color"]`, `--pwa-status-bg`, le fond de `html` et le fond de `body`.
- La fermeture du now-playing appelle le cycle existant `restoreNowPlayingThemeColor()` : il restaure la couleur sauvegardée avant ouverture, ou la valeur par défaut calculée par `syncPwaStatusColor()`.
- Les safe areas existantes sont conservées dans `public/assets/css/styles.css` : header haut, overlay, contenu et mini-player bas utilisent toujours `env(safe-area-inset-top)` et/ou `env(safe-area-inset-bottom)`.
- Le now-playing mobile étend son propre fond dynamique (pochette floutée + dégradé) derrière l’indicateur Home. `À suivre` conserve son padding de safe area et reste juste au-dessus de la zone système, sans bande de couleur séparée; le haut, déjà validé visuellement, n’est pas modifié.

## Vérifications sans capture

- Contrôle Node statique : 36/36 documents PWA avec viewport/status-bar, quatre cibles `setThemeColor`, fichier Google intact.
- `node --check public/assets/js/scripts.js` : OK.
- `node tools/verify-public-boundary.js` : OK.
- `node tools/verify-audio-stability.js` : OK.
- `git diff --check` : OK.
- La logique Service Worker n’a pas changé : uniquement bump de version et URLs versionnées du shell.

Validation visuelle iPhone PWA : INFRA.

## Installation du shell Service Worker

- `SHELL_ASSETS` contient 41 URLs ; contrôle public par requêtes HEAD : **41/41 HTTP 200**.
- Aucun asset manquant : `scripts.js`, `audio-core.js`, `audio-prefetch.js`, `scripts.admin.js`, `share-qr.js` et `vendor/qr-creator.min.js` répondent tous 200.
- 38 assets critiques restent installés atomiquement avec `cache.addAll(CRITICAL_SHELL_ASSETS)`.
- 3 assets optionnels (`scripts.admin.js`, `share-qr.js`, QR vendor) sont chargés avec `Promise.allSettled` et ne peuvent plus bloquer l'installation du SW.
- Test automatisé : un échec simulé de `scripts.admin.js` laisse l'installation aller jusqu'à `skipWaiting`; un échec critique bloque toujours l'installation.
- Validation iPhone encore requise après déploiement : la télémétrie doit afficher `audiofix320-20260714`. Elle seule permettra de confirmer l'installation réelle sur l'appareil.
