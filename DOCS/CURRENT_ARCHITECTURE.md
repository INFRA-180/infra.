# Architecture courante — SITE INFRA

État de référence : 1er août 2026.

Ce document décrit uniquement le système actif. Les anciennes décisions restent dans
`IMPLEMENTATION_NOTES.md`, mais ne remplacent pas cette référence.

## Baseline

- Runtime : `audiofix377-20260801`
- Service Worker : `infra-shell-20260801-audio377`
- CSS : `audiofix377-20260801`
- Catalogue : 31 albums et 283 pistes
- Cache audio : `infra-next-track-segments-v9`
- Couverture : une URL WebP 1200×1200 canonique par album
- Sauvegarde comparative : tag `backup-audiofix373-20260724`

## Publication

GitHub Pages publie exclusivement `public/`.

```text
public/
├── index.html
├── music/                    31 pages album
├── playlists/                4 pages de playlists Music
├── apps/                     3 applications
├── assets/
│   ├── css/
│   ├── js/
│   ├── music/
│   └── pwa/
├── data/                     catalogue, pistes et durées
└── sw.js
```

`_private/`, `.secrets/`, `.sqlite_local/`, les backups et la bibliothèque Music ne sont
jamais publiés.

## Exécution client

Le site reste statique et sans étape de build. Les scripts sont modulaires par responsabilité,
mais chargés comme scripts classiques et coordonnés par des API globales contrôlées.

Principaux composants :

- `scripts.js` : bootstrap et orchestration transverse ;
- `audio-core.js` : source, lecture, Previous/Next et transitions ;
- `audio-radio.js` : Radio, Shuffle, files matérialisées et plan de prefetch ;
- `audio-prefetch.js` : requêtes Range et cache segmenté ;
- `catalog-loader.js` : catalogue live, cache local et fallback Git ;
- `spa-router.js` et `spa-renderer.js` : navigation album sans perdre le lecteur global ;
- `transport-ui.js`, `now-playing.js`, `album-player-ui.js` : interfaces du lecteur ;
- `audio-visualizer.js` : analyse Web Audio live et animation fullscreen desktop ;
- `media-session.js` : commandes iOS, écran verrouillé et centre de contrôle ;
- `audio-telemetry.js` : lot compact de session.

Un seul élément `<audio>` global est autorisé.

### Mini-player desktop et Document PiP

Sur un navigateur desktop exposant `documentPictureInPicture`, le mini-player devient
détachable lorsqu’un drag est relâché à moins de 18 px d’un bord de viewport. La fenêtre PiP
native reste au-dessus des autres applications et l’utilisateur la déplace avec les mécanismes
de son système ; le site ne force pas sa position.

Le document PiP partage l’état et les commandes du lecteur global : lecture/pause,
Previous/Next, Radio, Shuffle, favori et seek. Le mini-player de la page est masqué pendant
l’ouverture, la navigation SPA conserve la fenêtre, puis `pagehide` restaure le lecteur. En
dessous de 380×150 la vue reste compacte ; au-dessus, elle affiche aussi la cover. Sans support
Document PiP, le drag reste strictement interne à la page.

Le diagnostic du visualiseur est agrégé localement : un événement compact
`visualizer_health` par session décrit l’activation Web Audio, le signal détecté et la
visibilité du canvas. Il rejoint le lot différé existant sans envoi par frame.

## Modes de lecture

- Play à froid sur l’accueil : Radio globale préparée.
- Play à froid sur une page album ou playlist : Radio et Shuffle désactivés, première piste de
  la collection affichée. Une source existante reste prioritaire et reprend sans changement de file.
- Page playlist : ordre Music complet conservé, même entre plusieurs albums.
- Radio active : file globale matérialisée.
- Radio inactive et Shuffle actif : album courant uniquement, avec historique.
- Radio inactive et Shuffle inactif : ordre de l’album puis album chronologique adjacent.

Changer de mode ne doit pas réassigner la source ni relancer inutilement la piste courante.

## Prefetch

- Segments initiaux de 2 MiB.
- Fenêtre N+1 à N+5.
- N+1 prioritaire.
- Deux téléchargements simultanés maximum.
- Six entrées maximum.
- Aucun fichier complet téléchargé spéculativement.
- Les segments utiles survivent à un changement de piste.

Le Service Worker reconstruit des réponses `206` exactes depuis le cache v9 et relaie le reste
vers R2. Toute modification de cette chaîne exige une régression reproductible ou une preuve
télémétrique.

## Catalogue et audio

La bibliothèque `/Users/infra/Music/iTunes/Music/Infra_` est strictement en lecture seule.
La synchronisation locale :

1. détecte un changement stable ;
2. convertit hors de la bibliothèque ;
3. publie un objet R2 immuable ;
4. vérifie HEAD et Range ;
5. publie atomiquement un catalogue complet ;
6. conserve le dernier catalogue valide comme rollback.

Le catalogue live, CacheStorage et les JSON inclus dans Git forment les trois niveaux de
repli. Le fallback Git est actuellement aligné sur le live à 283 pistes.

Les quatre playlists Music sont exportées en lecture seule dans `data/playlists.json`. Elles
représentent 234 occurrences et 225 pistes uniques du catalogue public. Les identifiants
persistants Music servent uniquement au rapprochement local et ne sont jamais publiés.

La visualisation desktop n’a plus de fichier de données par piste. Elle lit uniquement le
signal instantané de l’élément audio global lorsqu’un utilisateur ouvre le fullscreen.
`audiofix374` est une version comparative FFT pure : les contours rouge immédiat et blanc
lissé, le remplissage miroir et l’axe fréquentiel logarithmique 40 Hz–16 kHz sont conservés,
mais aucune ligne médiane ni particule n’est affichée. Le mode n’alloue pas les tableaux des
500 000 grains, ne lance pas leur simulation et ne compose aucun tampon de poudre. Le code
physique reste disponible derrière le commutateur local pour comparer proprement avec la
sauvegarde `backup-audiofix373-20260724`.

## Pochettes

Le contrat runtime est strict :

- un album ;
- une URL canonique `*-cover-1200.webp` ;
- la même URL sur l’accueil, la page album, le mini-player, le fullscreen et Media Session.

Les WebP 480/900 et les anciens JPG/PNG ne sont plus stockés dans `public/`. Une exception
manuelle doit passer par `COVER_OVERRIDES` avec copie de la source et SHA-256.

## PWA et fullscreen

La géométrie iPhone validée est figée :

- `viewport-fit=cover` ;
- fullscreen standalone en `100vh` ;
- aucun `100lvh` ;
- aucun remplissage graphique sous la Home Indicator ;
- aucun changement de hauteur, ancrage bas ou safe area sans preuve sur l’iPhone réel.

Le lecteur et `#infraSpaPersist` survivent aux changements de page.

À partir de 981 px, le fullscreen desktop affiche la comparaison FFT pure décrite plus haut.
Le graphe Web Audio est créé une seule fois depuis le clic d’ouverture ; l’analyseur reste une
branche séparée de la sortie audio. Le rendu est limité à 30 i/s, s’arrête en pause, à la
fermeture ou quand l’onglet est caché, et devient statique avec `prefers-reduced-motion`.

Sur Safari compatible, le passage entre routes utilise le handoff peint natif des View
Transitions sans animation visuelle. La mutation DOM et le repositionnement du scroll sont
séparés d’une frame. La cover hero de l’album décode en mode synchrone ; les images de la
grille Accueil restent paresseuses et asynchrones.

## Partage par QR

Un appui long sur le logo, une cover d’accueil ou une cover d’album ouvre une modale
persistante. Elle contient un QR noir sur le disque rouge exact du logo `#e52c31`, le
wordmark officiel, une fermeture à gauche et une copie à droite. Le résultat de copie est
annoncé par un toast temporaire `aria-live`. Le lien est écrit directement depuis le clic
utilisateur avec `navigator.clipboard.writeText`, puis avec le fallback de sélection existant
si Safari le refuse.

## Télémétrie

Un seul lot compact v3 est produit par session :

- 48 événements maximum ;
- 32 Kio maximum ;
- quatre sessions locales sur 72 heures ;
- un envoi à `hidden/pagehide` ;
- reprise IndexedDB en cas d’échec ;
- aucun heartbeat ou envoi continu.

Les commandes Media Session sont regroupées par jeton avec leur décision et trois sondes
bornées. La visibilité de page reste un indice et n’est jamais présentée comme une preuve de
l’écran verrouillé ou du centre de contrôle.

Ce même résumé contient un inventaire borné du stockage local, les hits/miss HTML et covers,
ainsi que l’état de la cover aux première et deuxième frames peintes. Cette observabilité
n’ajoute ni requête Worker ni clé KV. La PWA demande le stockage persistant une seule fois,
à la première interaction.

Les URLs complètes, chemins privés et identifiants personnels ne quittent pas le navigateur.

## Contrôle de release

La commande de référence est :

```bash
node tools/release-audit.js
```

Elle doit passer avant chaque push. La validation PWA iPhone reste ensuite effectuée par
l’utilisateur.
