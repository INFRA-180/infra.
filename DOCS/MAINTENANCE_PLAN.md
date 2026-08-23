# Plan de maintenance — SITE INFRA

État de référence : 24 août 2026.

Origine audio de production actuelle : proxy Worker
`https://infra180-api.pages.dev/audio/`. Aucun runtime actif ne doit réintroduire le endpoint
de développement `r2.dev`. Un domaine R2 personnalisé pourra remplacer ce proxy seulement quand
une zone DNS appartenant au même compte Cloudflare sera disponible.

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
- La purge distante conservatrice du 21 août est sauvegardée sous
  `/Users/infra/CODEX_APP/SITE_INFRA./BACKUPS/r2-dedup-20260821/` : 4 402 copies exactes
  retirées sans toucher aux 284 pistes alors actives.
- La rétention minimale finale a ensuite retiré 209 audios inactifs et 3 602 JSON historiques.
  État vérifié après `D 2.0141` : 286 objets / 2,104 Go, soit 285 audios actifs et
  `catalog/latest.json` ; les 285 contrôles de lecture Range passent. Le tampon local historique a été supprimé après
  vérification et seuls les rapports légers restent dans
  `/Users/infra/CODEX_APP/SITE_INFRA./BACKUPS/r2-minimal-retention-20260821/`.
- Avant tout upload audio, `sync-itunes-r2-catalog.js` recalcule l'inventaire distant, avertit à
  8 Go et bloque seulement une projection supérieure à 9 Go. Il n'existe pas de plafond fixe à
  3 Go ou en nombre de pistes. Contrôle manuel :
  `node _private/tools/sync-itunes-r2-catalog.js audit-r2-budget`.
- Le Worker ne conserve plus de release/candidat JSON. Après une publication et toutes les six
  heures, le LaunchAgent actif recalcule l'allowlist live et retire les objets audio orphelins.

La bibliothèque Music reste strictement en lecture seule.

## Priorité 3 — nettoyage des pochettes historiques — terminé

- 32 WebP 1200 canoniques conservés : exactement une cover par album.
- Les quatre originaux de `public/assets/music/sources/` sont conservés.
- 69 anciennes variantes WebP 480/900 et 37 anciens JPG/PNG non référencés sont retirés.
- `tools/release-audit.js` refuse désormais toute cover physique supplémentaire, manquante
  ou différente du catalogue.

## Priorité 4 — source de vérité générée — active

Le générateur local met désormais à jour depuis Music et le manifest synchronisé :

- `public/data/catalog.json`
- `public/data/tracks.json`
- `public/data/track-durations.json`
- les 32 pages album, avec découverte automatique des futurs dossiers ;
- `catalog-fallback.js` ;
- les références versionnées du runtime et du Service Worker.

La surveillance conserve une publication Git en attente et ne la poursuit que sur la branche
attendue avec un dépôt propre. Cet outil reste hors runtime, sans framework ni bundler.

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
