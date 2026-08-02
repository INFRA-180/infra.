# Hygiène Git — SITE INFRA.

Ce document est la politique Git publique et canonique du site. Les instructions locales
ou propres aux agents peuvent la compléter, mais ne doivent pas la contredire.

## Dépôts et responsabilités

- `origin` désigne le dépôt GitHub public.
- `local` désigne le miroir bare local de secours.
- `codex/beta-site` est la branche publiée par GitHub Pages.
- Le dépôt public contient le site, ses tests et sa documentation publique.
- Les secrets, bases SQLite, journaux, caches, sauvegardes et opérations privées restent
  hors du dépôt public. Une branche Git n'est jamais un espace de stockage privé.

## Travail quotidien

1. Partir d'un `codex/beta-site` propre et synchronisé.
2. Créer une branche courte par sujet : `feat/`, `fix/`, `docs/` ou `chore/`.
3. Pour les travaux parallèles, créer un worktree distinct par branche.
4. Préserver les changements non liés déjà présents dans un worktree.
5. Stager explicitement les fichiers du sujet ; ne pas automatiser `git add -A`.
6. Faire un commit par sujet, avec un message décrivant le résultat.

Exemple :

```bash
git fetch origin
git worktree add ../WORKTREES/site-pip -b feat/pip-next origin/codex/beta-site
```

Une branche est supprimée après intégration. Une version stable importante est conservée
par un tag annoté ; un bundle vérifié sert de sauvegarde durable.

## Validation obligatoire

Avant chaque commit destiné à la publication :

```bash
git diff --check
npm test
git status --short
```

`npm test` exécute l'audit complet : syntaxe, catalogue, pochettes, invariants audio/PWA,
frontière public/privé et cohérence Git. La CI relance ce même audit avant GitHub Pages.

Les hooks locaux peuvent accélérer le retour, mais la CI reste l'autorité car les hooks ne
sont pas installés automatiquement lors d'un clone.

## Contrat de version PWA

Toute modification d'un fichier CSS ou JavaScript publié doit vérifier les quatre éléments
suivants comme une seule unité de publication :

1. les paramètres de version dans les pages HTML ;
2. la liste précachée dans `public/sw.js` ;
3. la version du cache du Service Worker ;
4. les attentes de `tools/release-audit.js` et `tools/verify-audio-stability.js`.

Une modification fonctionnelle ne doit pas être publiée sous une URL de ressource déjà mise
en cache. Le test réel de la PWA installée sur iPhone reste une validation utilisateur.

## Publication

1. Vérifier que le commit ne contient que le sujet prévu.
2. Exécuter `npm test`.
3. Intégrer par avance rapide ou pull request dans `codex/beta-site`.
4. Pousser sans réécrire l'historique.
5. Pour un jalon stable, créer un tag annoté explicite.

Aucun force-push, commit automatique ou erreur de push ignorée n'est admis sur la branche
publiée. Un outil automatique peut auditer et signaler ; il ne doit pas décider du contenu
d'un commit.

## Sauvegardes et entretien

Avant de supprimer une ancienne copie :

1. créer un bundle de la branche actuelle et des tags ;
2. vérifier le bundle avec `git bundle verify` ;
3. enregistrer son SHA-256 et le commit couvert ;
4. sauvegarder séparément tout patch de travail non commité ;
5. confirmer les chemins exacts avant suppression.

Le miroir local doit pointer sur le même commit publié que `origin`. L'entretien périodique
est en lecture seule par défaut : état des branches et worktrees, divergence des remotes,
frontière des secrets, intégrité des bundles et `git fsck`. Un `git gc` n'est lancé que sur
un dépôt propre et après vérification des sauvegardes.
