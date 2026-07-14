# RAPPORT — rollback public complet au 3 juillet 2026

Date : 2026-07-14
Commit source : `760092e` — `fix: harden telemetry export and ios resume`
Runtime restauré : `audiofix280-20260703`
Service Worker restauré : `infra-shell-20260701-audio279`

## Périmètre restauré

L'intégralité du dossier public a été restaurée depuis le dernier commit daté du 3 juillet : CSS, lecteur et modules audio, Service Worker, catalogue et durées, accueil, 31 pages album, 3 pages apps et interface publique Sphragis.

Aucun correctif postérieur au 3 juillet n'a été conservé dans `public/`. Le rollback est porté par un nouveau commit réversible; l'historique Git n'a pas été réécrit.

## Vérifications

- Arbre `public/` identique au commit `760092e` : OK.
- Syntaxe de tous les JavaScript publics et du Service Worker : OK.
- Frontière publique : OK.
- Catalogue : 31 albums, 280 pistes, 280 durées, aucune alerte.
- Assets du shell présents : OK.
- Chromium mobile 390 × 844 : accueil chargé, Play vers `COMETE`, Suivant vers `PIXEL`, lecteur plein écran et `À suivre` ouverts, zéro erreur console.

## Validation restante

La PWA iPhone doit être complètement fermée puis rouverte après le déploiement afin d'adopter le runtime et le Service Worker restaurés. Une suppression/réinstallation peut être nécessaire si iOS conserve l'ancien shell installé.
