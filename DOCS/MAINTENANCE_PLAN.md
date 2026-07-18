# Plan de maintenance — SITE INFRA

État de référence : 18 juillet 2026.

Les purges autorisées du 18 juillet sont terminées. Toute nouvelle suppression devra de
nouveau être précédée d’un inventaire et d’une sauvegarde adaptée.

## Priorité 1 — geler le runtime stable

Conserver sans modification spéculative :

- `public/assets/js/audio-core.js`
- `public/assets/js/audio-radio.js`
- `public/assets/js/audio-prefetch.js`
- `public/assets/js/media-session.js`
- `public/assets/js/spa-router.js`
- `public/assets/js/spa-renderer.js`
- `public/assets/css/styles.css`
- `public/sw.js`

Une intervention sur ces fichiers exige un bug reproductible, une preuve dans le code ou une
télémétrie exploitable.

## Priorité 2 — rétention du runtime Music/R2 — terminée

- Sauvegarde vérifiée :
  `/Users/infra/CODEX_APP/SITE_INFRA./BACKUPS/audio-r2-sync-retention-20260718/`
- 2 581 générations de staging non référencées supprimées, soit environ 15,6 Go.
- Les cinq générations locales encore actives, le catalogue live, le fallback, SQLite,
  les manifests, les logs et l’inventaire avec hashes sont conservés.
- Le LaunchAgent est relancé après chaque maintenance.

La bibliothèque Music reste strictement en lecture seule.

## Priorité 3 — nettoyage des pochettes historiques — terminé

- 31 WebP 1200 canoniques conservés : exactement une cover par album.
- Les quatre originaux de `public/assets/music/sources/` sont conservés.
- 69 anciennes variantes WebP 480/900 et 37 anciens JPG/PNG non référencés sont retirés.
- `tools/release-audit.js` refuse désormais toute cover physique supplémentaire, manquante
  ou différente du catalogue.

## Priorité 4 — source de vérité générée

À moyen terme, réduire les mises à jour mécaniques en générant depuis un manifest unique :

- `public/data/catalog.json`
- `public/data/tracks.json`
- `public/data/track-durations.json`
- les 31 pages album ;
- `catalog-fallback.js` ;
- les références versionnées du runtime et du Service Worker.

Cette évolution doit rester un outil de génération hors runtime. Elle ne justifie ni framework,
ni bundler, ni réécriture du lecteur.

## Priorité 5 — dette de code

La modularisation actuelle est suffisante pour stabiliser le produit. Ne pas extraire de
nouveaux modules uniquement pour réduire le nombre de lignes.

Ordre recommandé :

1. identifier un wrapper ou chemin legacy avec couverture de test ;
2. prouver qu’il n’a plus de consommateur ;
3. retirer un seul groupe cohérent ;
4. exécuter l’audit complet ;
5. laisser l’utilisateur valider la PWA.

## Navigation et covers — stabilisées par audiofix351

- La destination SPA est insérée avant le retrait de l’ancienne route.
- Le retour Accueil réutilise son DOM et réconcilie les cartes sans vider la grille.
- La mutation DOM et le scroll sont séparés d’une frame.
- Le handoff natif peint est utilisé seulement si WebKit expose `startViewTransition`.
- La cover hero canonique est décodée au maximum une fois et en mode synchrone ; la grille
  Accueil reste asynchrone.
- Clone, snapshot, canvas, attente graphique fixe et variantes 480/900 restent interdits.
- Les futurs diagnostics utilisent le résumé de session existant : cache HTML, cache cover
  et état de la cover aux deux premières frames, sans augmenter les appels Worker/KV.
