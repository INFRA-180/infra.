# 3 — Ce que font les autres (recherche web, 27/11/2026)

**En bref (à lire seul)**
1. Samples courts : les décoder en Web Audio (buffers). C'est le seul chemin sans trou et avec effets fiables, sur iPhone comme sur Mac.
2. Morceaux complets : garder un seul `<audio>` branché sur Web Audio (gain + effets). Sur iPhone, le volume de `<audio>` est bloqué : un fondu n'est possible qu'en passant par Web Audio.
3. Écran verrouillé et arrière-plan : c'est le point le plus fragile sur iPhone. Le contexte audio s'endort. Hors de l'écran, prévoir des transitions simples (coupe nette ou fondu court).
4. Mettre `navigator.audioSession.type = "playback"`, sinon le bouton silencieux de l'iPhone coupe le son Web Audio.
5. iOS 26.0 et 26.1 en écran d'accueil : le son disparaissait souvent. iOS 26.2 corrige au moins la partie `<audio>`. Il faut tester sur l'iPhone réel.
6. Effets légers : une reverb partagée avec réponse générée (1,5 à 2,5 s), un écho calé au tempo et un filtre qui se ferme sur 8 à 16 temps. Aucun fichier à charger.
7. Spotify (Mix, 2025), Apple Music (AutoMix, iOS 26) et djay proposent tous un mode auto et quelques styles nommés : Fondu, Montée, Écho, Filtre. Ils affichent aussi le BPM.
8. WhoSampled présente un écran de comparaison original ↔ morceau, avec le moment exact du sample et la partie prise.
9. Bibliothèques : aucune n'est indispensable. Du Web Audio écrit à la main suffit, avec Gapless-5 comme modèle à lire. Tone.js est trop lourd et Howler peu maintenu.
10. Rien n'a été mesuré ici : ce sont des lectures. Les chiffres d'effets sont des points de départ à régler à l'oreille.

Légende : **[V]** vérifié dans une source officielle ou un bug WebKit · **[C]** rapporté par la communauté, non confirmé · **[H]** hypothèse ou pratique à tester.

---

## 1. iOS Safari / PWA : `<audio>` branché sur Web Audio

**Recommandation** : brancher l'unique `<audio>` (m4a AAC) sur `createMediaElementSource → GainNode → bus d'effets`, créé une seule fois au premier geste. Régler `navigator.audioSession.type = "playback"`. Au retour au premier plan (`visibilitychange`), faire `suspend()` puis `resume()`. Si le contexte ne repart pas, prévoir un repli en coupe simple.

- **[V] Le volume de `<audio>` est en lecture seule sur iOS.** Il vaut toujours 1. Seul `muted` fonctionne. Un fondu doit donc passer par un GainNode. Sources : bug WebKit 151589 (https://bugs.webkit.org/show_bug.cgi?id=151589) et Apple Forums (https://developer.apple.com/forums/thread/116406).
- **[C] Le GainNode agit bien sur du MP4/AAC**, pas sur du WebM/Opus (même bug 151589). C'est favorable au m4a AAC.
- **[C] Bugs historiques de `MediaElementAudioSourceNode` sur iOS** :
  - silence sur la bêta d'iOS 17 (https://jordaneldredge.com/f00d09ef-5286-4429-a499-255585c3bb43/, 2023) ;
  - crépitements selon la fréquence d'échantillonnage (https://bugs.webkit.org/show_bug.cgi?id=215314) ;
  - silence si la source est un MediaSource : préférer une URL simple (https://bugs.webkit.org/show_bug.cgi?id=266922).
  
  Aucun bug n'a été trouvé pour 2025-2026 sur le cas « URL m4a directe ». **[H]** Ça marche, à confirmer sur l'iPhone.
- **[V] Bouton silencieux** : par défaut, Web Audio est en mode « ambient » et se coupe quand l'iPhone est en silencieux. `navigator.audioSession.type = "playback"` règle ce cas. Sources : MDN (https://developer.mozilla.org/docs/Web/API/AudioSession/type) et bug WebKit 237322.
- **[C] Arrière-plan et verrouillage** :
  - le contexte audio est suspendu en arrière-plan même en « playback » (bug WebKit 264473, https://bugs.webkit.org/show_bug.cgi?id=264473 : « more work for the background case ») ;
  - Gapless-5 conseille `useWebAudio: false` pour la lecture en arrière-plan sur iOS (README, https://github.com/regosen/Gapless-5).
  
  **[H]** Écran verrouillé, un `<audio>` branché sur Web Audio peut se taire. Il faut le tester tôt : c'est le risque n°1 du plan.
- **[C] L'état « interrupted »** (non standard) reste parfois bloqué après un retour au premier plan. Le contournement rapporté consiste à faire suspend puis resume sur `visibilitychange`. Sources : bugs WebKit 281955 et 283419 (fin 2024), avec la remarque WebKit qu'« interrupted » n'est pas dans la norme.
- **[C] iOS 26 en écran d'accueil** : Web Audio et même `<audio>` deviennent muets après le premier lancement. Bug WebKit 291892 (https://bugs.webkit.org/show_bug.cgi?id=291892), toujours ouvert. Un seul témoignage dit « corrigé en 26.2 bêta 3 » (19/11/2025).
  - **[V]** Le bug voisin 295518 (lecture média en PWA) est marqué corrigé dans iOS 26.2 par WebKit.
  - Autre fil : MacRumors (https://forums.macrumors.com/threads/ios-26-audio-issues-in-pwa-web-apps.2466839).
- **[V/C] Media Session** :
  - prise en charge sur iOS 15 et plus (https://caniuse.com/mdn-api_mediasession) ;
  - la pochette sur l'écran verrouillé est capricieuse et l'icône « 10 s » est imposée (https://dbushell.com/2023/03/20/ios-pwa-media-session-api/, 2023) ;
  - les boutons écran verrouillé ne répondent plus après la fin d'un morceau en PWA (bug 261858) ou après environ 30 s de pause (https://developer.apple.com/forums/thread/762582).
  
  **[H]** Enchaîner sans jamais laisser l'`<audio>` en état « ended » aide.

## 2. Crossfade sans trou sur iPhone

**Recommandation** :
- Samples : `AudioBufferSourceNode` programmés au temps exact avec `start(when)`, le suivant préchargé et décodé pendant que le précédent joue.
- Sample vers morceau : le sample se joue en buffer pendant que l'`<audio>` démarre sous lui, à gain 0, puis on fait un fondu.
- Morceau vers morceau avec un seul `<audio>`, deux options :
  - (a) précharger les 10 à 20 premières secondes du morceau suivant en buffer (requête Range sur R2). Le début se joue en buffer pendant que l'`<audio>` bascule de source et se cale, puis passage au flux. **[H]**, c'est l'astuce de Gapless-5 inversée ;
  - (b) accepter un second `<audio>` seulement pour la transition.

- **[V] Gapless-5** (MIT, https://github.com/regosen/Gapless-5) démarre en HTML5 Audio, puis bascule en Web Audio une fois le fichier chargé. Il propose un crossfade en ms (25 à 50 ms contre les petits trous). Son README rappelle que HTML5 Audio tronque la fin et que Web Audio doit tout charger avant de jouer. Dernière publication repérée : 1.6.x. Pas d'activité 2025 vérifiée.
- **[V]** gapless.js (jgeurts, https://npmjs.com/package/gapless.js) utilise le même principe hybride.
- **[V] Les MP3 ont des trous d'encodage, l'AAC en m4a se découpe proprement** si les métadonnées de délai sont présentes (Chrome, https://developer.chrome.com/blog/media-source-extensions-for-audio). Cela conforte le choix du m4a. Pas de MSE pour l'audio sur iOS : voir le bug 266922 cité au § 1.
- **[H]** Décoder des morceaux entiers en buffer sur iPhone coûte beaucoup de mémoire (environ 10 Mo par minute en stéréo float). C'est réservé aux samples et aux têtes de morceaux.

## 3. Effets légers et « pro » en Web Audio

**Recommandation** : un seul bus d'effets partagé, construit une fois.
- **Reverb** : un `ConvolverNode` avec une réponse générée (bruit stéréo × décroissance exponentielle, 1,5 à 2,5 s, filtrée vers 6 à 8 kHz), calculée une fois au démarrage. Aucun fichier IR à télécharger.
- **Écho** : `DelayNode` réglé à 60/BPM × 0,75 (croche pointée) ou × 0,5, avec un retour de 0,3 à 0,45 et un passe-bas vers 3 à 4 kHz dans la boucle.
- **Filtre** : `BiquadFilterNode` passe-bas, Q de 0,7 à 1, avec `exponentialRampToValueAtTime` de 18 kHz vers 250 à 400 Hz sur 8 à 16 temps pour le morceau qui sort. Le morceau qui entre peut s'ouvrir en passe-haut.
- **Recette type** : sur 4 à 8 temps, monter la reverb et l'écho du sortant jusqu'à 0,3 à 0,5. Couper le son sec du sortant sur un premier temps. La traîne continue pendant que l'entrant monte. Tout se programme au temps du contexte, aligné sur la grille BPM (temps = 60/BPM).

- **[V]** ConvolverNode : le coût augmente avec la longueur de la réponse, sans plafond. Réponses à 1, 2 ou 4 canaux. Sources : W3C ISSUE-73 (https://www.w3.org/2011/audio/track/issues/73) et WebKit ConvolverNode.cpp. **[C]** Aucun chiffre publié pour l'iPhone : il faudra mesurer, sans le faire pendant qu'INFRA essaie.
- **[C]** Les valeurs d'écho (croche pointée, retour 0,38) et le filtre balayé viennent d'un projet DJ Web Audio (NEON DJ, https://mintlify.wiki/kepabilbao67-bot/musicplayer2/mixer/effects). Tone.js exprime les délais en temps musicaux : « 4n » vaut 0,5 s à 120 BPM (https://frontendmasters.com/courses/web-audio/tone-js-effects).
- **[V]** Reverb algorithmique en alternative (Freeverb : peignes et passe-tout) : https://itnext.io/algorithmic-reverb-and-web-audio-api-e1ccec94621a. Elle est plus coûteuse en nœuds. Le convolver natif reste plus simple.
- **[H]** Les réglages chiffrés ci-dessus sont des points de départ, à valider à l'oreille par INFRA.

## 4. Comment les autres présentent les transitions

- **Spotify « Mix »** (bêta 19/08/2025, généralisé le 22/09/2025, ordinateur le 19/05/2026) : un mode « Auto » ou personnalisé avec des préréglages « Fade » et « Rise ». On règle le volume, l'égaliseur, les effets et les courbes. L'écran affiche des formes d'onde et des repères de temps pour choisir le point de transition, le BPM et la tonalité Camelot, et un interrupteur mix oui/non. Sources : https://newsroom.spotify.com/tag/transitions et https://techcrunch.com/2025/08/19/spotifys-latest-feature-lets-you-add-your-own-transitions-to-playlists **[V]**
- **Apple Music AutoMix** (iOS 26, 2025) : étirement temporel et calage des temps. La transition est de longueur variable, saute les intros longues et retire les silences. Réglage : Musique > Transitions. AirPlay depuis 26.1. Sources : https://www.macrumors.com/2025/06/12/ios-26-automix-apple-music/ et https://9to5mac.com/2025/11/07/ios-26-1-expands-music-apps-latest-feature-with-airplay-upgrade. **[C]** Des utilisateurs disent que le point de transition tombe parfois mal (forum MacRumors).
- **djay (Algoriddim)** : transitions Automix nommées Automatic, Fade, Filter, EQ, Echo, Dissolve, Riser et Neural Mix (séparation des pistes). Manuel : https://help.algoriddim.com/user-manual/djay-pro-mac/settings/automix **[V]**
- **WhoSampled** : écran de comparaison entre l'original et le morceau qui le sample. On bascule de l'un à l'autre (pas de lecture simultanée confirmée). L'écran indique le moment exact du sample, le type (boucle, voix, batterie…) et la partie prise. Sources : App Store (https://apps.apple.com/us/app/whosampled/id529092671) et Stuff.tv. **[C]**
- **Idée pour le site [H]** : deux pochettes, celle de l'original puis une flèche vers celle du morceau, avec « sample à 0:42 », et le nom du style de transition affiché brièvement (« Écho », « Filtre »). Le BPM s'affiche discrètement, comme chez Spotify.

## 5. Bibliothèques légères

| Bibliothèque | Utilité | État | Avis |
|---|---|---|---|
| Web Audio natif | tout | standard | **à retenir** |
| Gapless-5 (MIT) | lecture hybride sans trou | 1.6.x, activité 2025 non vérifiée | à lire comme modèle, pas forcément à intégrer |
| gapless.js (MIT) | même principe | peu actif [C] | modèle |
| Tone.js 15.x | effets et temps musicaux | maintenu (1 mainteneur), environ 75 Ko gzip (https://depscope.dev/pkg/npm/tone) | trop lourd pour l'usage |
| howler.js 2.2.4 | lecture simple | dernière version environ 2023, beaucoup de tickets iOS ouverts (https://qiita.com/mogamoga1337/items/0e787fc2964c62d018b1, 02/2025) | à éviter |

**[H]** Le besoin réel tient en quelques centaines de lignes : un contexte, un bus d'effets, un ordonnanceur BPM et le préchargement.

## Non vérifié / à tester sur l'iPhone d'INFRA
- `<audio>` m4a branché sur Web Audio, écran verrouillé, sur iOS 26.2 et plus.
- Retour au premier plan : le contexte repart-il seul ?
- Coût réel du convolver (2 s, stéréo) sur iPhone.
- Les boutons de l'écran verrouillé restent-ils actifs après un enchaînement ?
