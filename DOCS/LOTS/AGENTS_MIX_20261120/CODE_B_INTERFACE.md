# Code B · Interface Samples / Mix / A cappella (agent interface, 20/11/2026)

Branche locale à part, rien poussé, rien en ligne, pas de `npm run bump`. Choix appliqués : `LOT_SAMPLES_20261119.md` § T bis.

## Fait

- **Barre de pictos collée en haut** (sous la barre de la bibliothèque) : vinyle · deux ondes croisées · micro. Choisi = plein + nom dessous ; autres en trait gris 35 %, sans nom ; aucun fond. Cibles 44 pt. Remplace les grands mots et la phrase dessous (la phrase reste dans la bulle d'aide).
- **Gestes** : Mac touches 1 / 2 / 3, ← / → sur la barre ; iPhone glisser sur la page à plus de 24 pt du bord. Au bord (Samples vers la droite, A cappella vers la gauche), le glisser passe à l'onglet voisin de la bibliothèque, comme avant.
- **« A cappella »** à l'écran (la clé interne reste `voix`, la mémoire d'INFRA est gardée).
- **Page Mix** : pile de 3 pochettes (toucher = lancer « Tout le Mix »), « 237 enchaînements · 60 → 158 BPM », BPM / aléatoire V1, ligne « ≈ Auto · Fondu › » qui ouvre les options. Grille d'albums V1 inchangée.
- **Menu ⋯** (page Mix et lecteur Mix, avant le ✕) : réutilise le style `ta-menu` du site (popover Mac, feuille du bas iPhone, version sombre dans le lecteur). Durée Aucune · 5 s · Auto ; Effet Fondu · Reverb · Écho · Basses · Hasard ; « Écouter la transition » ; « Remettre par défaut ». Échap ferme le menu sans fermer le lecteur. Mac : **T** = écouter la transition.
- **Options grisées tant qu'elles ne marchent pas** : sans l'API de l'agent son, tout est grisé avec « Pas encore disponible » (Mac) ou « Pas encore sur iPhone » (iPhone).
- **Pendant une transition** (`samples:transition`) : la pochette suivante glisse sur l'actuelle à la vitesse du fondu, picto de l'effet sur le bord, BPM qui compte de l'ancien au nouveau. « Aucune » = rien ne glisse.
- **« À suivre » du Mix** : petit picto d'effet entre deux lignes, à la place du trait.
- **A cappella** : mini-ligne de ton morceau avec le micro à l'entrée de la voix ; toucher = « Aller au morceau ». Rien si pas de temps, ou si l'entrée tombe après la fin du morceau (D4).
- **Rouge** : seulement la partie sample de la barre, ton plus doux. La ligne en cours dans « À suivre » et la légende passent en blanc gras.
- **Réduire les animations** : pas de glissé (simple fondu), BPM qui saute à la fin, picto fixe en bas au centre, pas de suivi du doigt.
- **Télémétrie** (par `InfraTrackEvent`, sans contenu privé) : `samples_mix_opt {dur, fx}`, `samples_mix_try`, `samples_tab_swipe {from, to}`, `samples_voice_mark {at}`.

Fichiers : `public/assets/css/samples-mix.css` (nouveau), `public/assets/js/samples-mix-ui.js` (nouveau), `public/assets/js/samples.js` (seulement la zone des styles, de la page et de la construction du lecteur, lignes 483-731 d'origine).

## Réglages à faire après validation de la maquette

Tous en tête de `samples-mix.css` (`:root`) et de `samples-mix-ui.js` (`CFG`) :
1. `--sx-red` : ton du rouge (proposé `#e5605f`, ancien `#e0353b`).
2. `--sx-tab-off` : gris des pictos non choisis (0,35) ; `--sx-tab-icon` : 26 Mac / 28 iPhone.
3. `--sx-stack` : taille de la pile (128 Mac / 104 iPhone) ; `--sx-row-ink` : blanc des lignes non jouées dans « À suivre ».
Autres : `--sx-xf-ease`, `--sx-xfm-alpha`, `--sx-menu-dim` ; `CFG.autoBars/autoMin/autoMax`, `CFG.iosOff`, `CFG.swipeMin`.

## Contrat attendu de l'agent son

- `InfraSamples.mix.getOptions / setOptions / resetOptions / previewTransition` : utilisés seulement s'ils existent.
- Facultatif : `mix.supports(kind, value) === false` grise une option ; `InfraSamples.current()` donne l'élément entendu (sinon le repère de voix lit le lecteur).
- `samples:transition` : le mieux est `dur` en **secondes réelles** (sinon « auto » est recalculé ici : 4 mesures, 4 à 12 s, 8 s sans BPM) et `fx` = l'effet **vraiment joué** (jamais `random`).

## Prouvé / non vérifié

- **Prouvé** : lint vert ; `node tools/release-audit.js` vert (26 contrôles) ; `tools/test-bibliotheque.js` vert. Essai headless Chromium, Mac 1280 et iPhone 375 : page Samples sans erreur console (seuls messages déjà là : `web-share`, `postMessage` de YouTube) ; barre collée en défilant ; menu grisé sans API ; avec une API simulée : choix, ligne mise à jour, remise par défaut, « Écouter », événements envoyés ; touches 1 et → ; glisser Mix → A cappella, et passage à la bibliothèque au bord ; transition simulée (glissé, picto, BPM), « Aucune », mouvement réduit ; repère de voix.
- **Non vérifié** : vrai iPhone et Safari ; avec le vrai son de l'agent son (fusion) ; thèmes autres que blanc ; réception des 4 événements par le Worker (liste blanche de `audio-telemetry.js`, agent 3).
- **Pas fait** (plan, pas dans T bis) : « Annuler » 4 s / ⌘Z, carte de la pile qui part à chaque transition, micro qui « respire », effet par transition dans « À suivre ».
- **À brancher à la publication** : ajouter `samples-mix.css` et `samples-mix-ui.js` au précache hors ligne de `sw.js` (sans eux, la page marche, mais sans pictos stylés ni menu hors ligne).
