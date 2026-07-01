# Notes d'implementation

## 2026-07-01 - audiofix276 partage QR PWA

Demande :
- Corriger la fenetre QR impossible a quitter en PWA.
- Retirer la notification de copie automatique et laisser la copie au choix.
- Ajouter un etat visuel quand le logo ou une cover declenche le partage.
- Rendre la fenetre QR plus transparente, type glass.

Decisions :
- Supprimer la copie automatique a l'ouverture : le lien reste visible et le bouton `Copier le lien` devient l'action explicite.
- Ajouter plusieurs sorties de fenetre : croix agrandie, bouton `Fermer`, tap hors panneau, Escape et fallback sans `showModal`.
- Marquer l'element partage comme `is-share-pressing` puis `is-share-selected` pour rendre l'appui long visible.
- Reactiver `pointer-events` uniquement sur `.share-dialog`, car `#infraSpaPersist` est volontairement neutre pour le layout et bloquait les taps de la fenetre QR.
- Bump PWA en `audiofix276-20260701` et Service Worker `infra-shell-20260701-audio276`.

Validation :
- Syntaxe JS/SW OK.
- Validateurs public boundary, catalogue, hardening, Sphragis et `git diff --check` OK.
- Chromium local mobile : appui long logo ouvre le QR, aucune copie automatique, aucune notification, croix ferme, selection logo nettoyee.
- Chromium local mobile : appui long cover accueil ouvre l'album, bouton Copier copie une seule fois, bouton Fermer ferme, tap hors panneau ferme.
- Chromium local album : appui long cover album ouvre le QR album, Escape ferme.
- Chromium local desktop : appui long logo ouvre `INFRA.`, rendu glass verifie, build `audiofix276-20260701`.
