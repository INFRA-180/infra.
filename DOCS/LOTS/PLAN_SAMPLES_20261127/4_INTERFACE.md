# Plan Samples — 4. Interface (27/11/2026, agent interface, lecture seule)

**En bref**
1. Accueil Samples : on remplace la grille d'albums par **le mur des samples** (les pochettes des disques d'origine, rangées par album) — recommandé.
2. Deux autres pistes : **étagères** (une rangée par album qui défile de côté) ou **liste** façon page album validée.
3. U3 : les deux pochettes **échangent leur place** au passage : ton morceau passe en grand, le sample devient la petite pochette, flèche retournée ; puis l'inverse au sample suivant. Ça corrige aussi le saut de 60 px (A4).
4. Transitions visibles : la pochette qui sort **traîne** selon l'effet (Reverb = flou qui s'étire, Écho = 3 reflets, Basses = s'assombrit), la barre montre la zone de fondu. Pas de picto d'effet à chaque passage (T28).
5. « Que des samples » : le picto micro et toute la vue A cappella partent ; il reste ✂ Samples · ∞ Mix.
6. Trouvé aujourd'hui : **25 pages d'album sur 31 débordent sur iPhone** (page jusqu'à 799 px au lieu de 375).
7. Petits défauts : écarts inégaux ▶ · BPM · ⤨, picto Fondu qui ressemble à l'aléatoire, étiquette « 1997 » encadrée, durées du menu ≠ T12.
8. Rien de validé n'est changé : ligne du haut, ciseaux, page album A, sélecteur des années, plein écran.
9. Vérifié : navigateur local, son bloqué, aucune lecture lancée, Mac 1280 et iPhone 375. Non vérifié : plein écran en vrai (lu dans le code), vrai iPhone.

---

## 1. Constat écran par écran

Mesures prises dans le navigateur (sans lecture). Ligne de départ : Mac 40 px, iPhone 16 px — conforme.

### 1.1 Accueil Samples — Mac 1280
- Ligne du haut : ▶ rouge · BPM · ⤨ à gauche ; ✂ (nom « Samples » dessous) · ∞ · micro à droite. Axe commun : 200 px, bords 40 / 1240 : **droit**.
- Écarts visibles **inégaux** : ▶ → BPM = 30 px, BPM → ⤨ = 19 px (le mot BPM, 28 px, est dans une case de 44 comme les pictos de 22).
- Dessous : **grille de 31 pochettes d'albums INFRA**, 6 colonnes, « 8 samples » sous chaque titre. C'est **la même image que l'onglet Albums** (U2). Aucun sample visible avant d'ouvrir un album.
- Le mini-lecteur du bas montre le dernier morceau INFRA (ex. « 3351 · ALEXANDRIA »), pas un sample (A9 de l'audit).

### 1.2 Accueil Samples — iPhone 375
- Même ligne, droite (16 → 359). Mêmes écarts inégaux (30 / 19 px).
- Grille d'albums en 2 colonnes : on fait défiler 31 grandes pochettes INFRA, sans voir un seul sample.
- Ligne des onglets du site : « Titres » et « Favoris » sont cachés derrière un fondu à droite (hors lot Samples, à signaler seulement).

### 1.3 Mix — Mac et iPhone
- Pile de 3 pochettes **d'albums** (la maquette V2 validée montrait des **samples** — écart déjà noté en T ter) + « ≈ Auto · Fondu › ».
- iPhone : la pile (120 px) est seule sur sa ligne, **tout le côté droit est vide**, puis « Auto · Fondu » dessous et ~50 px de blanc avant la grille. C'est le « grand vide » d'U2.
- Le picto Fondu (deux courbes croisées) **ressemble au picto aléatoire ⤨** juste au-dessus : on croit voir deux fois « aléatoire ».
- Dessous : **encore la grille d'albums** (« 7 enchaînements »), qui ouvre la même page album que dans Samples.

### 1.4 Page d'un album (proposition A, validée)
- Mac : droit (pochette 240 à 40 px, pictos alignés au bord 1240, liste 40 → 1240). Rien à reprendre.
- **iPhone : 25 albums sur 31 débordent** (nouveau, prouvé) : la page fait de 388 à **799 px** (SANGUIN 799, ADC13 750, TROU NOIR 679, D 2.0141 545…). La pochette n'est plus centrée, « à 0:25 » est coupé à droite, la page glisse de côté. Cause : les lignes `.sx-li` (texte sur une ligne) imposent leur largeur au panneau `.bib-panel` (378 px au lieu de 343). Même famille que A2 (A cappella). Correction : `contain: inline-size` sur `.sx-alist` (ou `min-width: 0` sur le panneau), comme essayé pour A2.

### 1.5 Plein écran (lu dans le code, pas ouvert : aucun son pris le risque)
- Phase sample (Mix et Samples « ton morceau suit ») : grande pochette du sample à gauche (64 %), petite pochette de ton morceau grisée en bas à droite (36 %), crochet ↳ au-dessus (`.sx-main.has-next`).
- **Phase morceau : `paintNow()` cache la petite pochette** (`nx.hidden = inTrack || !st.mix`, `samples.js` ~1846) et la grande devient la pochette de l'album. Le sample disparaît : c'est U3. La grille passe de 2 pochettes à 1 → **saut d'environ 60 px** (A4).
- Étiquette « SAMPLE 1997 » : l'année est dans une **pastille encadrée rouge** (`.sx-tag .sx-yr`, bordure 1 px) — contraire à la charte (« aucun cadre ») ; ailleurs l'année est soulignée en pointillé.
- Transition : la pochette suivante entre en fondu au rythme du son, le BPM compte de l'un à l'autre (`samples-mix-ui.js`, événement `samples:transition`). Rien ne dit quel effet joue, rien ne différencie Fondu / Reverb / Écho / Basses à l'écran. U7 (journal iPhone) : aucun effet déclenché ; c'est d'abord le moteur (part 2), mais l'écran doit pouvoir le montrer.
- Menu ⋯ du Mix : durées « Aucune · 5 s · Auto », alors que **T12 a validé Aucune · 2 · 4 (mesures)**.

---

## 2. Accueil Samples : propositions (la recommandée d'abord)

Gardé dans les trois : la ligne du haut validée (▶ · BPM · ⤨ à gauche, pictos à droite, T46-T55), la page album A, le sélecteur des années, toucher = plein écran (T40). Seul le **contenu sous la ligne** change.

### A — Le mur des samples (recommandée)
- Sous la ligne du haut : **les pochettes des disques d'origine** (290 sur 293 ont déjà leur image ; 42 fausses « SAMPLE 2 · INFRA » à remplacer d'abord, part 1 données).
- **Rangées par album**, dans l'ordre du site. Au-dessus de chaque groupe, une ligne fine : petite pochette INFRA 20 px · « D 2.0141 » · « 8 › » à droite. Toucher cette ligne = la page album validée (rien ne se perd).
- Vignettes : Mac 8 colonnes (~136 px), iPhone **3 colonnes** (~104 px, écart 12). Plus petites que la grille Albums : on voit tout de suite que ce n'est pas la même chose.
- Sous chaque vignette : titre du sample (gras, 1 ligne), puis « Artiste · 1997 » en gris (année soulignée en pointillé = sélecteur des années). Pas de nom de ton morceau sous la vignette (il est dans l'en-tête du groupe et dans le plein écran : pas de doublon).
- BPM ↑ / ↓ ou aléatoire touchés : les en-têtes d'album disparaissent, le mur devient un seul bloc trié ; nouveau toucher = retour à l'ordre des albums (même logique qu'aujourd'hui).
- Toucher une vignette = plein écran sur ce sample, puis la suite (ton morceau suit). Clic droit / appui long : le menu déjà prévu (Lire, YouTube, Écouter ton morceau, Copier le lien).
- Pourquoi : on **voit les samples** dès l'arrivée, ça ne ressemble plus à Albums, et l'iPhone est rempli sans vide.

### B — Les étagères
- Une rangée par album : à gauche l'intitulé « D 2.0141 · 8 › », dessous les pochettes des samples (120 px) qui **défilent de côté** (Apple Music, Spotify).
- Mac : flèches ‹ › au survol de la rangée ; iPhone : glisser.
- Plus compact en hauteur, mais : défilement de côté caché (T22 : pas de barre), conflit avec le glisser entre sections sur iPhone, et on ne voit que 3 samples par album sur iPhone.

### C — La liste
- Une ligne par sample, exactement la forme validée de la page album A (pochette 36, titre, « Artiste · année », « à 0:25 » à droite), avec en-tête par album.
- Le plus clair et le moins de travail (le code de la page album sert tel quel), mais visuellement pauvre : 293 lignes, rien d'« image » à l'arrivée.

### Mix (même lot, petit)
- Pile = **pochettes de samples** (comme la maquette V2), pas d'albums.
- iPhone : pile **et** « Auto · Fondu › » **sur la même ligne** (pile 104 à gauche, réglage centré verticalement à droite), écart 24 avant la suite : le vide disparaît.
- Sous la pile : le même mur qu'en A, une vignette = un enchaînement (pochette du 1er sample + petite pochette INFRA dans le coin, 32 px). À valider : la page Mix a été validée telle quelle (T26), donc **question à INFRA**, pas un changement d'office.

---

## 3. U3 — les pochettes qui changent de place

Règle : **toujours deux pochettes en mode sample** (en grand ce qu'on entend, en petit l'autre), dans les deux phases. La lecture normale (album, radio) garde une seule pochette (T36).

| Moment | Grande (64 %, éclairée) | Petite (36 %, grisée) | Flèche | Toucher la petite |
|---|---|---|---|---|
| Sample joue | pochette du sample | ton morceau | ↳ au-dessus (vers le morceau) | aller à ton morceau (comme aujourd'hui) |
| Passage sample → morceau (0,35 s) | les deux **glissent l'une vers l'autre** : la petite monte et grandit, la grande descend et rétrécit | | la flèche pivote | |
| Ton morceau joue | ton morceau | **le sample** | **↰ retournée** (vers le sample : « vient de ») | réécouter le sample (`data-smp-jump="s0"`) |
| Morceau → sample suivant (durée du Mix) | le sample suivant arrive en fondu au rythme du son (existant) | ton morceau descend en petit ; si le sample suivant mène à un autre morceau, la petite change en fondu | ↳ | |

- Durée de l'échange : 400 ms ; « Aucune » = échange sec ; « Réduire les animations » = simple fondu 150 ms.
- Même hauteur dans toutes les phases → **A4 corrigé** (le doigt ne tombe plus sur le BPM).
- Titre, « SAMPLE 1997 » et barre ne changent pas de règle (T41, T59).
- Code concerné (pour la part code, pas ici) : `paintNow()` (`nx.hidden`, source de `.sx-cov` et de `[data-smp-nextcov]`), `.sx-main.has-next` et `.sx-next .sx-hook` dans `samples-mix.css`, clic droit `.sx-art, .sx-next` (`samples.js` ~4134, côté « morceau » à inverser en phase morceau).

---

## 4. Transitions qui se voient et se comprennent

Contraintes validées : pas de picto d'effet à chaque passage (T28), réglage écrit une fois en tête d'« À suivre », rouge seulement sur la partie sample de la barre (T bis 8).

- **La barre montre le passage** : la zone où les deux sons se chevauchent est un dégradé rouge → blanc de la bonne longueur (2 ou 4 mesures). On voit d'avance où et combien de temps ça mélange.
- **La pochette qui sort imite l'effet** (pendant la durée du passage seulement) :
  - Fondu : fondu croisé (existant).
  - Reverb : la pochette qui sort **s'étale en flou** et pâlit lentement, plus longtemps que le son sec (la queue de reverb).
  - Écho : **3 reflets** de la pochette qui sort, décalés et de plus en plus pâles, au tempo (un par temps).
  - Basses : la pochette qui sort **s'assombrit du bas vers le haut** (les graves partent).
  - Hasard : l'effet choisi s'affiche de la même façon ; son nom apparaît 1 s sous le titre (« Reverb »), en gris, puis s'efface.
- BPM qui compte de l'un à l'autre : gardé.
- « Écouter la transition » (menu ⋯) rejoue ces visuels avec le son, pour comprendre avant d'écouter.
- Dépend du moteur (part 2) : l'événement `samples:transition` doit vraiment partir avec `fx` et `dur` ; aujourd'hui le journal iPhone n'en montre aucun.

---

## 5. Si A cappella disparaît (U9, validé « que des samples »)

Interface à retirer (code et styles), sans rien casser d'autre :
- Picto micro et onglet « A cappella » (`TABS`, `samples.js` ~645) → il reste **✂ Samples · ∞ Mix** ; titre de la barre « Samples ou Mix ».
- Vue A cappella : `voixList()`, `voices()`, `YT_IC`, `SP_IC` de la page, clic `[data-smp-voice]`, menu clic droit `kind: "voix"` (~4163), styles `.sx-vlist`, `.sx-vrow`, `.sx-vmain`, `.sx-src` → **A2 disparaît avec elle**.
- Repère micro du plein écran : `.sx-vmark` (`buildSheet`), `paintVoice`, `currentVoice`, `ICON_MIC` (rempli, contraire à T54), styles `.sx-vmark`, `.sx-vline`, `.sx-vtrk` (`samples-mix-ui.js`, `samples-mix.css`) → **C9 disparaît**.
- Mots « · voix » dans « À suivre » (~1726) et sous le titre (~1862), « N voix » de la grille, `secVoix()`, `sortKey` « voix- », `pref.voix`, section 3 du glisser et de la touche 3 (`SECS`).
- Mémoire de l'appareil : un `pref.sec === "voix"` enregistré doit retomber sur « samples ».
- `open()` : le repli « album sans sample → on montre ses voix » (~1458) part.
- **C1 devient un vrai trou** : 7 morceaux n'ont que des voix (ETNA, PHARMAKON, Co27, TAKEMIKASUCHI, BONHEUR, COMETE, Posé). « Afficher les samples » ne doit **plus être proposé** sur ces morceaux (menu du site, Crédits), au lieu d'ouvrir un lecteur vide.
- Données : 151 voix sur 444 sons ; 293 samples restent. Les retirer de `samples.json` ou seulement les filtrer : choix de la part données (1).

---

## 6. Petits défauts à corriger

| # | Où | Défaut | Correction |
|---|---|---|---|
| D1 | Page album, iPhone | **25/31 albums débordent** (jusqu'à 799 px) | `contain: inline-size` sur `.sx-alist` |
| D2 | Ligne du haut | écarts ▶ → BPM 30 px, BPM → ⤨ 19 px | même écart visible (12) : case BPM à sa largeur, ou toutes les cases à 44 avec dessins centrés |
| D3 | Mix | picto Fondu ≈ picto aléatoire ⤨ | autre dessin pour Fondu (deux rampes ╲╱ qui se croisent à plat) |
| D4 | Plein écran | année « 1997 » dans une pastille encadrée | soulignée en pointillé, comme partout |
| D5 | Menu ⋯ | « Aucune · 5 s · Auto » ≠ T12 | « Aucune · 2 · 4 » mesures |
| D6 | Mix | pile = albums (maquette : samples) | pochettes des samples |
| D7 | Mix, iPhone | pile seule sur sa ligne, côté droit vide, ~50 px de blanc | pile + réglage côte à côte, écart 24 |
| D8 | Pictos du menu ⋯ | Reverb a un point plein, Hasard un dé à points pleins | Reverb au trait (petit rond vide) ; le dé : à montrer à INFRA (points pleins = lisibles) |
| D9 | Plein écran | phase morceau : petite pochette cachée, saut de 60 px | §3 (U3 + A4) |
| D10 | Rappel audit | A3 sélecteur hors écran, A6 `<bdi>` album arabe, A7 ligne restée rose | voir `AUDIT_SAMPLES_20261127.md` |
| D11 | Hors lot | ligne des onglets iPhone : Titres et Favoris cachés à droite | signaler, pas toucher |

---

## 7. Contenu de la maquette à montrer à INFRA (pas de code ici)

Base : captures du vrai site (règle T38 : tout le site, on ne change que ce qui est demandé). Bascule en haut **Ordinateur / iPhone**. Aucun son.

Écrans :
1. **Accueil Samples — A (mur)** : ligne du haut sans micro (✂ · ∞), en-têtes d'album fins, mur de pochettes de samples (vraies pochettes, pas les 42 fausses). État « BPM ↑ » : mur trié sans en-têtes.
2. **Accueil Samples — B (étagères)** et **C (liste)**, mêmes données, pour comparer (bascule A · B · C en haut, comme T39).
3. **Mix** : pile de samples ; iPhone avec pile et « Auto · Fondu › » côte à côte ; dessous, mur des enchaînements (à valider).
4. **Plein écran, 4 états à faire défiler** (bouton « état suivant », pas de son) : sample joue → passage (échange des pochettes) → ton morceau joue (sample en petit, ↰) → sample suivant arrive en fondu.
5. **Transition avec effet** : même passage montré 4 fois — Fondu, Reverb (flou qui s'étire), Écho (3 reflets), Basses (s'assombrit) — et la zone de fondu dans la barre.
6. **Page album iPhone** corrigée (plus de débord), pour preuve côte à côte avant / après.

Tableau des options (obligatoire, `UX/PRINCIPE.md`) :

| Élément | Gestes | L'enlever / le désactiver | Revenir |
|---|---|---|---|
| Mur des samples (vignette) | toucher = plein écran ; clic droit / appui long = menu ; survol Mac = ▶ | — (c'est le contenu) | ← du plein écran, Échap, glisser vers le bas |
| En-tête d'album du mur | toucher = page album ; clic droit = « Samples de l'album » | tri BPM / aléatoire le masque | retoucher le tri = ordre des albums |
| Deux pochettes qui s'échangent | toucher la petite = aller au morceau / réécouter le sample ; clic droit = menu pochette (T19) | Réglages › Mix › Durée « Aucune » (échange sec) ; « Réduire les animations » | Remettre par défaut |
| Visuel de l'effet | rien (suit le son) | Réglages › Mix › Effet « Fondu » ; « Réduire les animations » = simple fondu | Remettre par défaut |
| Zone de fondu dans la barre | toucher la barre = aller à ce point | Durée « Aucune » (pas de zone) | Remettre par défaut |
| Nom de l'effet (Hasard, 1 s) | rien | Effet ≠ Hasard | — |

Questions à poser à INFRA avec la maquette (QCM, recommandé d'abord) : A, B ou C ? · Mix : mur des enchaînements ou grille actuelle ? · Dé de « Hasard » : garder les points pleins ou trait ?
