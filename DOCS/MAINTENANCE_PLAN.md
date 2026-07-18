# Plan de maintenance — SITE INFRA

État de référence : 18 juillet 2026.

Ce plan ne donne aucune autorisation de suppression. Toute purge physique doit faire l’objet
d’un lot séparé, d’un inventaire final et d’un accord explicite.

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

## Priorité 2 — rétention du runtime Music/R2

Constat au 18 juillet :

- source : `_private/runtime/audio-r2-sync/`
- volume : environ 15 Go ;
- générations : environ 2 586 ;
- accumulation principalement issue d’anciens essais MARSELHA, CDM et H2O.

Éléments à protéger impérativement :

- `_private/runtime/audio-r2-sync/live-catalog.json`
- `_private/runtime/audio-r2-sync/source-tracks.sqlite`
- `_private/runtime/audio-r2-sync/auto-sync.log`
- `_private/runtime/audio-r2-sync/auto-sync-error.log`
- `.sqlite_local/itunes_r2_sync.sqlite*`
- le dernier répertoire de publication confirmé pour chaque piste encore référencée.

Destination de sauvegarde proposée pour un futur nettoyage :

`/Users/infra/CODEX_APP/SITE_INFRA./BACKUPS/audio-r2-sync-retention-YYYYMMDD/`

Procédure future :

1. arrêter temporairement le LaunchAgent ;
2. produire la liste exacte des références du catalogue live et Git ;
3. copier les fichiers protégés vers la destination ;
4. vérifier les hashes et ouvrir les deux catalogues ;
5. supprimer uniquement les répertoires de staging non référencés ;
6. redémarrer le LaunchAgent et vérifier un passage sans changement.

La bibliothèque Music ne doit jamais être modifiée.

## Priorité 3 — nettoyage des pochettes historiques

Constat :

- 137 fichiers physiques correspondant à des pochettes ;
- 31 WebP 1200 référencés par le catalogue ;
- 69 WebP responsive non référencés ;
- 37 anciens JPG/PNG non référencés par le runtime.

Sources à inventorier :

- `public/assets/music/responsive/`
- `public/assets/music/*-cover.jpg`
- `public/assets/music/*-cover.png`

Sources originales à préserver :

- `public/assets/music/sources/`

Destination de sauvegarde proposée :

`/Users/infra/CODEX_APP/SITE_INFRA./BACKUPS/legacy-covers-YYYYMMDD/`

Le nettoyage devra être un commit assets isolé. Les 31 URLs canoniques et les quatre originaux
de `sources/` devront rester byte-identiques.

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

## Sujet optionnel — léger clignotement des covers

Ne rien modifier tant que le défaut reste mineur. S’il devient gênant, mesurer uniquement :

- tap album ;
- obtention du document ;
- insertion DOM ;
- decode de la cover canonique ;
- premier paint visible.

Éviter de réintroduire clone, snapshot, longue attente decode ou nouvelle variante 480/900 :
l’historique montre que ces solutions ont ajouté des courses et des blocages.
