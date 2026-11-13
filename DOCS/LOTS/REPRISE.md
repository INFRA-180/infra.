---
date: 2026-11-13
type: REPRISE
état: en_cours
---

# REPRISE — SITE INFRA

État courant et tâches en attente.

## QR Code rond — maquette prête (13/11, Claude)

**Demande d'INFRA** : « je veux que le QR code soit rond ».

**Fait (maquette seulement, code du site inchangé)** : `DOCS/maquettes/MAQUETTE_QR_ROND_20261113.html`, détail dans `MAQUETTE_QR_ROND_20261113.md`.
- Nouvelle variante **QR rond** (par défaut) : le code reste au centre, et des pastilles décoratives remplissent tout le disque rouge ; yeux ronds ; 2 modules vides autour du code.
- Variante **QR rond + pastille centrale** (« I. » au centre).
- Preuve : lecteur QR de macOS (CIDetector) sur capture → les 2 variantes donnent `https://infra-180.github.io/infra./`. L'ancienne variante « Pastilles rondes » (yeux carrés arrondis) : illisible pour ce lecteur.
- Non vérifié : lecture par l'appareil photo d'un vrai iPhone.

- 13/11 suite — INFRA : « qr ronds mais sans les yeux ou qui s'intègre mieux ». Les yeux (repères des coins) sont obligatoires pour la lecture : ils sont maintenant dessinés **avec les mêmes pastilles** que le reste. Variantes **Yeux en pastilles** (par défaut) et **Yeux en pastilles + pupille** (centre en un rond plein). Les 2 lues par macOS (CIDetector) → bon lien.

- 13/11 suite 2 — Yeux en **cercles pointillés** (par défaut, lus par macOS même à 200 px) ; **géométrie de la carte** mesurée et corrigée dans la maquette (rond trop près du logo, marges inégales ; détail dans `MAQUETTE_QR_ROND_20261113.md`) ; **carte transparente** proposée : verre clair, verre fumé, blanche.
- 13/11 — **Maquette installation PWA** proposée : `DOCS/maquettes/MAQUETTE_PWA_INSTALL_20261113.html` + `.md` (pictogramme permanent dans l'en-tête, bandeau dès la 2e visite ou 30 s d'écoute, ✕ = repos 14 j, 3 refus max, bouton Installer natif Chrome/Android/Mac, Mac Safari « Ajouter au Dock »).

- **13/11 — VALIDÉ par INFRA** : QR **yeux en cercles pointillés** + **carte verre fumé** (INFRA s'est corrigé le 13/11 : fumé, pas clair) + géométrie corrigée (maquette `MAQUETTE_QR_ROND_20261113.html`). À reporter dans `src/js/share-qr.js` + CSS après « go ».
- 13/11 — Installation PWA : INFRA hésite (« un truc facile mais pas tout le temps présent, même sur navigateur »). Avis Claude (proposé) : pas de pictogramme permanent dans l'en-tête ; bandeau automatique rare (téléphone seulement, 2e visite ou 30 s d'écoute, ✕ = 30 jours, 2 fois max) ; une entrée « Installer » rangée dans la carte de partage (sous le QR), là où on la cherche, sur tous les appareils.

- 13/11 — INFRA : « go maquette def ». Fait : `DOCS/maquettes/MAQUETTE_PARTAGE_INSTALL_DEF_20261113.html` + `.md` — carte QR validée (cercles pointillés, verre fumé, géométrie mesurée) + installation discrète (« Installer » dans la carte de partage, bandeau téléphone seulement, ✕ = 30 j, 2 refus max). QR lu par macOS, scénarios rejoués.

- 13/11 — **Reporté dans le site (audiofix449)** après « Go, reporte » : QR rond cercles pointillés + verre fumé + géométrie. Installation **changée par INFRA en cours de route** : ni bandeau automatique ni « Installer » dans la carte ; petit pictogramme en haut à droite de l'accueil les 2 premières visites seulement (détail : `DOCS/IMPLEMENTATION_NOTES.md`).

**FAIT (13/11, Claude) — carte QR qui reste affichée** (code modifié, non commité) :
- `src/js/share-qr.js` : plus aucune fermeture par le fond (écouteurs `pointerdown`/`pointerup`/`pointercancel`/`click` du fond retirés, `closedby="any"` → `"closerequest"`) ; garde sur le doigt qui ouvre (`openingPointerId`) pour que le relâchement de l'appui long, même tombé pile sur la croix, n'ait aucun effet (libérée 600 ms après le relâchement).
- Échap conservé sur ordinateur (convention clavier).
- Preuve (navigateur, écran 375×812, gestes simulés) : ouverte après appui long ✓ ; reste ouverte au relâchement sur la croix ✓ ; reste ouverte après appui sur le fond ✓ ; après glissement ✓ ; après un appui très long (3 s) puis relâchement sur la croix ✓ ; se ferme par la croix ✓ ; par Échap ✓. `npm test` : vert (24 contrôles, audit de publication passé).
- Non vérifié : iPhone réel.

**Demande d'origine (13/11)** — carte QR ouverte par appui long sur le logo :
- elle doit **rester affichée** quand on relâche le doigt, pour pouvoir montrer/scanner le QR ;
- on la quitte **seulement avec la croix** : pas de fermeture en touchant le fond, en relâchant, ni par glissement.
- Code concerné : `src/js/share-qr.js` (`closeFromPointer` sur le fond : `pointerup` / `click` sur `dialog`, `closedby="any"`, `cancel`). À vérifier : la touche Échap sur ordinateur (proposé : la garder, convention clavier).
- INFRA fait la suite dans une autre session. → repris ici le 13/11 par Claude.

**Ensuite** : INFRA teste sur iPhone réel.

---

## Statut général

- ✓ Lecture seule — exploration du code effectuée
- ⏳ En attente du choix d'INFRA sur la maquette QR rond
- Tests passants : aucune modification appliquée
