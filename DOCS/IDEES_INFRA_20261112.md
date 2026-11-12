# Idées et décisions d'INFRA — bibliothèque ordinateur / téléphone (12/11/2026)

Point demandé par INFRA (« un point MD de mes idées, avant de lancer »). À lire avec `DOCS/POINT_V9_20261112.md` et `DOCS/SUIVI_BIBLIOTHEQUE.md`.
Maquettes du jour : V10 → V17 dans `DOCS/maquettes/` (chacune avec son `MAQUETTE_Vxx_20261112.md`). **Référence : V17** (`MAQUETTE_BIBLIOTHEQUE_V17_20261112.html`, sources `sources_V17/`) ; V18 et V19 (changement d'onglet sans écran vide) essayées et refusées par INFRA le 12/11. Site **non modifié** ; notes du jour commitées le 12/11 (maquettes locales, hors Git).

## Validé par INFRA
- **Maquette validée dans son ensemble (12/11 soir), référence V17** : « je valide la maquette, c'est bon ».
- Mise en page ordinateur **alignée à gauche, pleine largeur** ; le **logo INFRA au milieu**.
- Grand lecteur ordinateur : pochette + bloc de lecture (titre, barre, commandes) d'un seul tenant ; **« À suivre » en dessous, dans la même page** (toucher « À suivre » descend jusqu'à la file).
- **Toute la ligne** d'un titre de section ouvre / déplie (Clips, Applications, Playlists, Albums, Favoris).
- ▶ sur le numéro des titres au survol.
- Changement d'onglet animé **comme le retour** (l'écran sort, le suivant arrive de l'autre côté) ; animation « sympa ».
- **Point rouge** des onglets : part de l'onglet quitté (ne revient plus de la gauche).
- **Pas de flèches** (chevrons) sur les titres de section, **pas de « Tout voir » / « Voir les 32 »** : on clique sur le titre.
- « Vos favoris » → **« Favoris »** ; en-têtes d'onglet sans redire le nombre déjà dans l'onglet.
- **Trois thèmes** au bouton en haut à droite : **blanc → noir → rouge** ; rouge = rouge du logo **#E52C31** ; le rond du logo disparaît en rouge, « pas grave ». V15 : « c'est parfait ».
- Plein écran sur ordinateur : bien (le blanc autour des Titres hors plein écran n'est pas un défaut).

## Gestes (demandés par INFRA)
- **Trackpad deux doigts** : vers la droite = retour d'un album / d'une playlist ; vers la gauche / la droite sur la bibliothèque = **onglet suivant / précédent** ; grand lecteur : **vers le bas ou vers la droite = le fermer**. Souris : clics seulement.
- Doigt (iPhone, Android) : même logique.
- **Pas trop sensible** (« ça saute alors que j'ai pas envie »), mais **pouvoir le lancer jusqu'au bout** (dernier / premier onglet).
- Corrigé en maquette : geste perdu « une fois sur deux » (élan du trackpad, Safari iPhone) ; réglages repris d'Android (zone morte 16 px, geste 2:1, moitié d'écran ou geste vif, lancé ≥ 2 500 px/s).

## Lecteur du bas (barre de lecture)
- Les commandes ⏮ ▶ ⏭ vont **au milieu**, sur **tous les supports** (ordinateur ET téléphone : « ça a toujours été au milieu ») — fait en V17, à vérifier.

## Exigences de qualité
- **Géométrie au pixel, sur chaque support** (Mac, iPhone, Android) : « il y a souvent des petites incohérences », « il faut que ce soit propre ».
- Ça doit **marcher sur tous les supports** (Android autorisé : émulateur installé, licence acceptée).

## Encore ouvert / à faire
1. **Contrôle géométrique complet** (en cours) : outil `DOCS/maquettes/sources_V17/audit-geometrie.js` écrit, **pas encore lancé** ; à passer à 1440, 800, 375, puis Safari iPhone et Chrome Android ; corriger chaque « presque aligné » ; rapport en .md.
2. Vérifier la V17 (commandes au milieu sur téléphone : titre plus court, à regarder avec un long titre).
3. PWA : icône Android « maskable » rognée ; bouton retour Android qui ferme le lecteur (fait en maquette V14, à coder) ; accents de la description (`DOCS/PWA_SUPPORTS_20261112.md`).
4. Puis **code en 3 lots** (après validation) : 1) mise en page ordinateur, 2) gestes, 3) PWA.
5. Proposé, non tranché : raccourcis clavier (Espace, ⌘1…⌘5) ; en rouge, centrer le mot INFRA seul ; contraste blanc / rouge 4,4 (juste sous 4,5).
