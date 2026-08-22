# Architecture courante — SITE INFRA

État de référence : 22 août 2026.

Ce document décrit uniquement le système actif. Les anciennes décisions restent dans
`IMPLEMENTATION_NOTES.md`, mais ne remplacent pas cette référence.

## Baseline

- Runtime : `audiofix400-20260822`
- Service Worker : `infra-shell-20260822-audio400`
- CSS : `audiofix400-20260822` — géométrie mobile déterministe avant JavaScript
- Catalogue : 31 albums et 284 pistes
- Origine audio : proxy R2 Range `https://infra180-api.pages.dev/audio/`
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
- `audio-telemetry.js` : lot compact v4 de session.
- `home-catalog.js` : hydratation de l'accueil et swipe gauche/droite des cartes album.

Un seul élément `<audio>` global est autorisé.
Sur les navigateurs exposant Audio Session, ce lecteur déclare le type `playback` avant son
initialisation. La déclaration reste inactive tant qu’aucun son n’est joué ; Media Session
continue de publier séparément les métadonnées et commandes système. Après une interruption
téléphonique reconnue, seule la transition `interrupted → active` autorise la reprise interne
WebKit, pendant 8 secondes, sur la même source et autour de la position gardée. Une reprise native
observée conserve le même token ; les reprises cachées inconnues restent bloquées.

### Mini-player desktop et Document PiP

Sur un navigateur desktop exposant `documentPictureInPicture`, le mini-player devient
détachable lorsqu’un drag est relâché à moins de 18 px d’un bord de viewport. La fenêtre PiP
native reste au-dessus des autres applications et l’utilisateur la déplace avec les mécanismes
de son système ; le site ne force pas sa position.

Le document PiP partage l’état et les commandes du lecteur global : lecture/pause,
Previous/Next, Radio, Shuffle, favori et seek. Le mini-player de la page est masqué pendant
l’ouverture, la navigation SPA conserve la fenêtre, puis `pagehide` restaure le lecteur. Sa
surface est plein cadre sous la barre de sécurité du navigateur, avec uniquement 14 px de
respiration interne. La taille demandée est bornée à 320–560 px de large et 180–420 px de haut,
avec un repli initial à 360×180 ; en dessous de 380×150 la vue reste compacte, au-dessus elle
affiche aussi la cover. Les commandes restent toutes accessibles et passent automatiquement
entre les dispositions compacte, intermédiaire et large au resize. Sans support Document PiP,
le drag reste strictement interne à la page.

Le diagnostic du visualiseur est agrégé localement : un événement compact
`visualizer_health` par session décrit l’activation Web Audio, le signal détecté et la
visibilité du canvas. Il rejoint le lot différé existant sans envoi par frame.

## Modes de lecture

- Play à froid sur l’accueil : Radio globale préparée.
- Play à froid sur une page album ou playlist : Radio et Shuffle désactivés, première piste de
  la collection affichée. Une source existante reste prioritaire et reprend sans changement de file.
- Bouton Play d'une page album : l'album affiché devient explicitement la file active ; une file
  étrangère démarre sa piste 1, tandis qu'une piste déjà active du même album bascule Play/Pause.
- Accueil tactile : un swipe horizontal gauche ou droit dominant de 58 px sur une carte du module
  Albums ouvre cette page ; le scroll vertical, les playlists et l'appui long QR restent distincts.
- Page playlist : ordre Music complet conservé, même entre plusieurs albums.
- File `À suivre` ouverte en plein écran : les pistes futures se réordonnent par drag/drop à la
  souris ou par appui long tactile/stylet. Un mouvement avant 420 ms reste un scroll normal ;
  après activation, un ghost unique apparaît au-dessus du fullscreen et la source reste invisible
  dans le layout. Les previews de 170 ms sont sérialisées et coalescées, puis un unique FLIP final
  est attendu après le rerender. La liste auto-défile aux bords, la piste en cours demeure fixe et
  la playlist Music source reste en lecture seule.
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
manuelle doit passer par `COVER_OVERRIDES` avec copie de la source et SHA-256. Le générateur
conserve ses intermédiaires sous `_private/runtime` et refuse d'écraser une URL non versionnée
avec des pixels différents.

Sur l'accueil, seule la première cover est prioritaire haute ; les deux premières sont eager.
Les autres gardent leurs dimensions mais reçoivent leur URL à l'approche du viewport, puis sont
révélées après décodage. Les icônes Applications restent sans `src` tant que leur menu est fermé.

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

En PWA mobile, le passage entre routes utilise par défaut un handoff `dual_route` sans snapshot
compositeur. La source visible et la destination stagée portent chacune leurs variables de thème
calculées ; le fond de sécurité global suit atomiquement la couche supérieure. La destination
dispose de deux frames de rendu avant promotion, puis la source reste une frame complète avant
détachement. Le DOM Home vivant est conservé hors écran. Au retour, ses classes et son ordre de
modules sont d'abord repris, le scroll sauvegardé est appliqué au frame suivant, puis une unique
correction d'ancre est effectuée au second frame et enregistrée dans l'historique. Le contrôle
`?pwa-swap=view` reste disponible pour comparer une View
Transition native. La cover hero réserve un carré 1200×1200 et décode en mode synchrone ; les
images de la grille Accueil restent paresseuses et asynchrones.

Une mise à jour du Service Worker n'active jamais `skipWaiting` depuis un client visible et ne
recharge jamais la PWA. Le nouveau shell reste `waiting` tant que l'ancienne version possède un
client, puis s'active après la fermeture naturelle de tous les clients. `clients.claim()` reste
utilisé pour la première installation. Les documents album/playlists restent précachés ; le
runtime ne lance plus de warmup massif et ne précharge une route qu'à l'intention utilisateur.

## Partage par QR

Un appui long sur le logo, une cover d’accueil ou une cover d’album ouvre une modale
persistante. Elle contient un QR noir sur le disque rouge exact du logo `#e52c31`, le
wordmark officiel, une fermeture à gauche et une copie à droite. Le résultat de copie est
annoncé par un toast temporaire `aria-live`. Le lien est écrit directement depuis le clic
utilisateur avec `navigator.clipboard.writeText`, puis avec le fallback de sélection existant
si Safari le refuse.

## Télémétrie

Un seul lot compact v4 est produit par session :

- 48 événements maximum ;
- 32 Kio maximum ;
- quatre sessions locales sur 72 heures ;
- un envoi final lorsque la session est réellement close ;
- reprise IndexedDB en cas d’échec ;
- aucun heartbeat ou envoi continu.

Une lecture ou une interruption active en arrière-plan reste dans la même session et ne provoque
aucun envoi réseau. Les fenêtres cachées sont agrégées localement ; leur compteur de pistes repose
uniquement sur la source logique réellement audible, jamais sur le prefetch. Une transition
remplacée est clôturée `superseded` à l'arrivée du nouveau token.

Les commandes Media Session sont regroupées par jeton avec leur décision et trois sondes bornées.
Leur résultat est monotone : 200 ms de progression confirmée suffisent à conserver `success` au
scellement. Interruption, reprise native ou gardée et commande partagent leurs tokens existants.
La visibilité de page reste un indice et n’est jamais présentée comme une preuve de l’écran
verrouillé ou du centre de contrôle.

Ce même résumé contient un inventaire borné du stockage local, les hits/miss HTML et covers,
le mode de swap, le type de route, la restauration Home/scroll, les invariants de couches et
l’état de la cover aux première et deuxième frames peintes. La file rapporte ses vraies fins de
preview/FLIP sans événement supplémentaire. Cette observabilité n’ajoute ni requête Worker ni clé
KV. La PWA demande le stockage persistant une seule fois, à la première interaction.

Le watchdog de lancement est clôturé dès la première frame applicative prête, mais les observers
LCP/CLS/INP restent actifs. Un unique `launch_summary` est finalisé sur masquage, `pagehide` ou au
plus tard 10 secondes après la navigation, afin de ne plus confondre disponibilité UI et LCP final.

Les URLs complètes, chemins privés et identifiants personnels ne quittent pas le navigateur.

## Contrôle de release

La commande de référence est :

```bash
node tools/release-audit.js
```

Elle doit passer avant chaque push. La validation PWA iPhone reste ensuite effectuée par
l’utilisateur.
