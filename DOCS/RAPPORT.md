# RAPPORT — audiofix322 safe areas et préfetch transport

Date : 2026-07-14
Runtime : `audiofix322-20260714`
Service Worker : `infra-shell-20260714-audio322`

## Correctifs audiofix322

- Au démarrage d'une piste par le transport, un préfetch en vol n'est plus annulé s'il correspond à la piste demandée ou à son N+1 immédiat. Les gardes `ready`, `in-flight` et `attempted` existantes empêchent toujours un second préfetch de la même source.
- Le segment reste strictement à 4 MiB. Le cache `infra-next-track-segments-v6`, la profondeur 4, la concurrence 2, le match Service Worker et la reconstruction `206 Partial Content` sont inchangés.
- Sous 980 px, le mini-player est désormais un dock à `bottom: 0`; `env(safe-area-inset-bottom)` est inclus dans son padding interne afin de protéger la Home Indicator sans laisser de bande vide sous le lecteur.
- La hauteur mesurée du dock contient déjà la safe area. Les paddings consommateurs de `--mobile-player-space` ne l'ajoutent donc plus une seconde fois.
- Sous 640 px, le Now Playing reste limité à `100dvh`; les anciennes compensations `bottom: -safe-area` et `100dvh + safe-area` ont été supprimées. Le padding bas protège toujours la Home Indicator et `.now-playing-up-next` est ancré en bas du panneau.
- `viewport-fit=cover`, le fond dynamique sous la status bar et la protection de la Home Indicator sont conservés.

Validation visuelle et audio sur iPhone PWA : INFRA.

## Confirmation publique

- Les 36 documents PWA publics — accueil, 31 albums, 3 apps et Sphragis — contiennent `viewport-fit=cover` dans la meta viewport et `apple-mobile-web-app-status-bar-style` à `black-translucent`.
- Le 37e fichier HTML sous `public/` est le fichier de vérification Google. Il reste volontairement inchangé afin de préserver son contenu de vérification exact.
- `setThemeColor()` synchronise simultanément `meta[name="theme-color"]`, `--pwa-status-bg`, le fond de `html` et le fond de `body`.
- La fermeture du now-playing appelle le cycle existant `restoreNowPlayingThemeColor()` : il restaure la couleur sauvegardée avant ouverture, ou la valeur par défaut calculée par `syncPwaStatusColor()`.
- Les safe areas existantes sont conservées dans `public/assets/css/styles.css` : header haut, overlay, contenu et mini-player bas utilisent toujours `env(safe-area-inset-top)` et/ou `env(safe-area-inset-bottom)`.
- Le now-playing mobile remplit exactement le viewport et conserve son fond dynamique derrière les zones système. `À suivre` reste juste au-dessus du padding de Home Indicator; le haut, déjà validé visuellement, n’est pas modifié.

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
- Validation iPhone encore requise après déploiement : la télémétrie doit afficher `audiofix322-20260714`; elle permettra de confirmer la conservation du préfetch lors des skips rapides, tandis que le rendu réel validera les deux safe areas.
