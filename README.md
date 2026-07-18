# SITE INFRA.

Site public et PWA audio INFRA.

## Référence

- Site publié : `public/`
- Branche : `codex/beta-site`
- Baseline stable : `audiofix354-20260719`
- Service Worker : `infra-shell-20260719-audio354`
- Catalogue : 31 albums, 283 pistes

La validation UX finale est réalisée sur l’iPhone de l’utilisateur. Les contrôles locaux
restent des vérifications de code et ne remplacent pas ce test réel.

## Points d’entrée

- Interface : `public/index.html`
- Orchestration : `public/assets/js/scripts.js`
- Moteur audio : `public/assets/js/audio-core.js`
- Radio et prefetch : `public/assets/js/audio-radio.js`
- Service Worker : `public/sw.js`
- Architecture actuelle : `DOCS/CURRENT_ARCHITECTURE.md`
- Maintenance : `DOCS/MAINTENANCE_PLAN.md`

## Vérification

```bash
node tools/release-audit.js
```

Cette commande contrôle la syntaxe, le catalogue, les pochettes canoniques, les invariants
audio/PWA, la frontière public/privé et le diff Git.

## Publication

GitHub Pages publie uniquement `public/`. Toute modification validée est committée sur
`codex/beta-site`, puis poussée vers `origin`.

Les secrets, bases SQLite, outils privés, sauvegardes et sources Music restent hors du
dépôt public.
