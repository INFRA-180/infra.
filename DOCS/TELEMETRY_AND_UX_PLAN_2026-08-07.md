# Télémétrie v4 et correctifs UX PWR — contrat du 7 août 2026

## Portée et séquencement

Ce document fixe le contrat de la télémétrie PWR et le protocole qui précède les correctifs
visuels. La livraison est volontairement séparée en deux vagues :

1. Worker et client de télémétrie v4, publication directe sans canary ;
2. campagne iPhone, analyse du rapport puis correctifs UX guidés par les mesures.

La première vague ne modifie donc pas encore les seuils du swipe, l'animation de la file, le
swap des covers ni la reprise audio. Elle observe leurs parcours actuels afin que le correctif
suivant repose sur une histoire corrélée et non sur des requêtes réseau unitaires.

## Contrat de cycle de vie

- Un passage `hidden` conserve la session si l'audio joue, démarre, récupère ou porte une
  interruption système. Il ouvre une fenêtre locale `background_window`, persiste son état dans
  IndexedDB et n'émet aucune requête.
- `hidden` sans activité audio scelle la session et tente son unique envoi final par
  `fetch(..., { keepalive: true })`.
- `pagehide.persisted === true` applique la règle de `hidden`, car le document peut rejoindre le
  BFCache. `pagehide.persisted === false` scelle et envoie, car le document est déchargé.
- Une interruption ou pause système ne clôt pas la session. Une Pause distante explicitement
  réussie lorsque l'app est cachée la clôt ; un nouveau Play distant caché peut créer une nouvelle
  session.
- Un force-quit iOS ne garantit aucun callback final. Une session locale abandonnée est scellée
  et retentée au lancement suivant. Une suppression des données Safari/PWA avant cette relance
  reste indétectable depuis le Web.
- La progression cachée met à jour la même fenêtre au plus toutes les 30 secondes de progression
  audio réelle. Il n'existe ni heartbeat réseau, ni Durable Object, ni Queue Cloudflare.

## Événements compacts

| Événement | Cardinalité | Rôle |
|---|---:|---|
| `launch_summary` | 1 par lancement | tête HTML, DOM prêt, paints, frame utile, init, catalogue et Service Worker |
| `background_window` | 4 max. | durée cachée, progression, pistes, attentes, erreurs, interruptions, commandes et reprise |
| `audio_interruption` | 1 par token | événement existant mis à jour jusqu'au résultat |
| `media_command` | contrat existant | une commande corrélée à ses probes et à son résultat |
| `spa_navigation` | événement enrichi | déclencheur, surface, rang, scroll, cache, covers et deux premières frames |
| `album_swipe` | 6 max. | un composite par geste, de l'entrée au résultat ou à l'annulation |
| `queue_reorder` | 4 max. | un composite par geste, de l'activation au commit ou à l'annulation |
| `session_summary` | toujours protégé | compteurs et maxima de la session |

Les événements composites sont mis à jour par token : leurs étapes internes ne consomment pas
une entrée par callback. La navigation conserve sa famille `spa_navigation` existante au lieu
d'en créer une concurrente.

## Budget, confidentialité et stockage

- 48 événements maximum par session, enveloppe finale de 32 Kio maximum ;
- quatre sessions locales au plus, rétention locale de 72 heures ;
- rétention Worker de sept jours ; un `GET` de déduplication et au plus un `put` KV par rapport ;
- priorité de conservation : `session_summary`, `launch_summary`, dernier
  `background_window`, interruptions et erreurs ;
- éviction prioritaire : anciens succès de swipe, file, navigation et commandes ;
- aucune URL ou source audio complète, aucun User-Agent brut, identifiant local ou texte libre.

Le Worker accepte les schémas 2, 3 et 4. Les rapports v4 sont stockés sous
`session4:<session_id>` et disposent d'un contrat machine partagé avec les tests de parité.

## Correctifs UX différés jusqu'au rapport

- Swipe album dans les deux directions : verrou d'axe à 10 px, seuil de 58 px, dominance
  horizontale 1,2, déplacement signé limité à 88 px, navigation unique et fallback natif à froid.
- File « À suivre » : conservation du ghost et de sa levée, déplacement FLIP 170 ms des lignes
  intermédiaires et dernier FLIP après le rerender, sans déplacer la piste courante.
- Covers : choix entre décodage ciblé, maintien de la route source ou réutilisation du DOM vivant
  selon l'état observé aux deux premières frames et le temps HTML.
- Démarrage : aucun reload Service Worker avant `startupReady`, défini par la fin de `initPage()`,
  la disponibilité du catalogue et deux frames applicatives.
- Appels : reprise unique et gardée seulement si le retour `active` ne progresse pas et qu'aucune
  pause explicite n'a été observée.

## Campagne iPhone après publication v4

1. lancement froid ;
2. album du haut par tap ;
3. album du bas puis retour ;
4. swipe gauche puis swipe droit ;
5. lecture cachée pendant deux minutes ;
6. appel accepté ou refusé puis reprise ;
7. Play, Pause, Next et Previous depuis l'écran verrouillé ;
8. réordonnancement tactile vers le haut puis vers le bas ;
9. pause finale puis passage en arrière-plan pour déclencher l'envoi.

L'acceptation exige une session unique pour le parcours audio continu, les mêmes tokens pour les
interruptions, commandes et navigations, aucun dépassement de budget, un seul rapport final et
une seule écriture KV par session.

## Références officielles

- [MDN — `visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
- [Chrome — Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [MDN — Media Session](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession)
- [Apple — Handling audio interruptions](https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions)
- [WebKit — Debugging Media in Web Inspector](https://webkit.org/blog/8923/debugging-media-in-web-inspector/)
- [Cloudflare — Workers KV limits](https://developers.cloudflare.com/kv/platform/limits/)
- [Cloudflare — How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
