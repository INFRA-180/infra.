# RAPPORT — audiofix318 PWA status-bar full-bleed

Date : 2026-07-14
Runtime : `audiofix318-20260714`
Service Worker : `infra-shell-20260714-audio318`

## Confirmation publique

- Les 36 documents PWA publics — accueil, 31 albums, 3 apps et Sphragis — contiennent `viewport-fit=cover` dans la meta viewport et `apple-mobile-web-app-status-bar-style` à `black-translucent`.
- Le 37e fichier HTML sous `public/` est le fichier de vérification Google. Il reste volontairement inchangé afin de préserver son contenu de vérification exact.
- `setThemeColor()` synchronise simultanément `meta[name="theme-color"]`, `--pwa-status-bg`, le fond de `html` et le fond de `body`.
- La fermeture du now-playing appelle le cycle existant `restoreNowPlayingThemeColor()` : il restaure la couleur sauvegardée avant ouverture, ou la valeur par défaut calculée par `syncPwaStatusColor()`.
- Les safe areas existantes sont conservées dans `public/assets/css/styles.css` : header haut, overlay, contenu et mini-player bas utilisent toujours `env(safe-area-inset-top)` et/ou `env(safe-area-inset-bottom)`.

## Vérifications sans capture

- Contrôle Node statique : 36/36 documents PWA avec viewport/status-bar, quatre cibles `setThemeColor`, fichier Google intact.
- `node --check public/assets/js/scripts.js` : OK.
- `node tools/verify-public-boundary.js` : OK.
- `node tools/verify-audio-stability.js` : OK.
- `git diff --check` : OK.
- La logique Service Worker n’a pas changé : uniquement bump de version et URLs versionnées du shell.

Validation visuelle iPhone PWA : INFRA.
