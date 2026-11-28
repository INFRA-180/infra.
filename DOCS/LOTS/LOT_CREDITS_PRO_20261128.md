---
date: 2026-11-28
type: LOT
état: codé en local, tests verts — attend le oui d'INFRA pour la mise en ligne
agent: Claude (session « Crédits complets »)
---

# Lot Crédits pro (28/11/2026)

Vision (à valider) : **Mac et iPhone (les deux)** — chaque morceau a une fiche Crédits « pro » : ce qu'INFRA a fait
(arrangement, mixage, mastering, production), quand le projet a commencé (date et heure), avec quelle version
d'Ableton, les instruments, les plugins, les samples (lien vers la fiche Samples). Ouverte au clic droit / appui
long « Crédits », et dans une **section Crédits** du site.

## Registre

| # | Demande d'INFRA (28/11) | État |
|---|---|---|
| C1 | « Est-ce qu'on a mis clic droit les crédits sur une track ? » | **oui** (lignes, mini-lecteur, grand lecteur, albums) ; vérifié dans le navigateur local 28/11 |
| C2 | Montrer que c'est **INFRA** : arrangement, mixage, mastering, production | **fait** : « INFRA » en gras + rôles (morceau, album, onglet) |
| C3 | Les **samples** dans les crédits | **fait** : « Contient un sample de « … » » + « Voir dans Samples › » |
| C4 | **Version d'Ableton** | **fait** : 285 morceaux (outil `build-credits.py` corrigé) |
| C5 | **VST / plugins, instruments** | **fait** : chaîne de mastering visible, plugins repliés, instruments réellement joués (72 morceaux) |
| C6 | **Date et heure** de début du projet | **fait** : 285 morceaux (plus ancienne trace : dossier ou sons datés) + dernière session |
| C7 | **Lieu** si possible | aucune donnée dans les projets → « Marseille » |
| C8 | « en mode **pro** » | **validé** V26 (QCM 28/11 : « Oui, tel quel ») |
| C9 | Une **section Crédits** | **fait** : 7e onglet « Crédits » (QCM 28/11) |
| C11 | (via session Mix, 28/11) Mix : clic droit sur le nom du morceau sous la lecture → Crédits, avec **l'a cappella** et un **lien vers le morceau d'origine**, « seulement si on en a envie » | **fait côté crédits** : bloc « Voix » replié (121 morceaux, lien « Écouter l'original ↗ », aucun son) ; appel `InfraCredits.openTrack(slug, n)` ; point d'entrée dans le Mix = session Mix |
| C10 | Morceaux sans crédits | **14 relus** (ALEXANDRIA ×8, Mn 54.938, MgFeSiO, سَلام ×4) ; **18 restent** sans projet (AKIRA : 4 versions → choix d'INFRA ; 10 introuvables, peut-être sur le disque SAVE 1) |

## Qui fait quoi
- Cette session : données crédits (`_private/tools/credits/`, `public/data/credits.json`), `public/assets/js/credits.js`,
  entrées « Crédits » de `src/js/track-actions.js`, section Crédits.
- Ne touche pas : `public/assets/js/samples*.js`, `samples.json`, `INVENTAIRE_SAMPLES/_outils/` (session « Mix du futur »).

## Fait (28/11, local, non commité)
- Maquette V26 `DOCS/maquettes/MAQUETTE_CREDITS_PRO_V26_20261128.html` + `.md`, validée en QCM.
- Données : `_private/tools/credits/` — `sessions-audit.py` + `sessions-20261128.json` (heures, version, pistes, instruments), `voix-audit.py` + `voix-20261128.json`, `extras.py` → `source-extras-20261128.json` (14 projets relus en lecture seule), `build-credits.py` étendu → `public/data/credits.json`.
- Site : `credits.js` (V26 + page de l'onglet), `bibliotheque.js` (vue `credits`), `styles.css`, `index.html` (onglet), test `test-bibliotheque.js` (7 onglets).
- Vérifié dans le navigateur local : onglet, crédits d'album, de morceau, clic droit, largeur iPhone. Pas d'essai sur un vrai iPhone.
- Limites : instruments seulement si la piste joue vraiment ; liens des voix : 26 prouvés, les autres trouvés automatiquement ; « Depuis 2022 » vient du plus vieux projet (H2o, prises de 2022 reprises).
