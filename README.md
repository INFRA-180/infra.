# SITE INFRA.

Site public et PWA audio INFRA.

## Demarrage rapide

Prérequis : Node.js 20 ou plus récent et Python 3. Aucune dépendance npm n'est à installer.

```bash
git clone https://github.com/INFRA-180/infra..git
cd infra.
npm test
npm run dev
```

Le site est alors disponible sur `http://localhost:8080`. La politique de branches,
validation, publication et sauvegarde est décrite dans `DOCS/GIT_WORKFLOW.md`.

## Référence

- Site publié : `public/`
- Branche : `codex/beta-site`
- Baseline publiée : `audiofix383-20260802`
- Service Worker : `infra-shell-20260802-audio383`
- CSS publié : `audiofix381-20260802`
- Catalogue : 31 albums, 283 pistes
- Playlists : 4 pages, 234 occurrences, 225 pistes uniques
- Play à froid contextuel : Radio sur l’accueil, piste 1 sur un album ou une playlist

La validation UX finale est réalisée sur l’iPhone de l’utilisateur. Les contrôles locaux
restent des vérifications de code et ne remplacent pas ce test réel.

## Points d’entrée

- Interface : `public/index.html`
- Orchestration : `public/assets/js/scripts.js`
- Moteur audio : `public/assets/js/audio-core.js`
- Radio et prefetch : `public/assets/js/audio-radio.js`
- Playlists : `public/data/playlists.json` et `public/playlists/`
- Service Worker : `public/sw.js`
- Architecture actuelle : `DOCS/CURRENT_ARCHITECTURE.md`
- Maintenance : `DOCS/MAINTENANCE_PLAN.md`
- Hygiène Git : `DOCS/GIT_WORKFLOW.md`

## Vérification

```bash
npm test
```

Cette commande contrôle la syntaxe, le catalogue, les pochettes canoniques, les invariants
audio/PWA, la frontière public/privé et le diff Git.

## Publication

GitHub Pages publie uniquement `public/`. Toute modification validée est committée sur
`codex/beta-site`, puis poussée vers `origin`.

Les secrets, bases SQLite, outils privés, sauvegardes et sources Music restent hors du
dépôt public.
