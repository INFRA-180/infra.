# Agent A · moteur son du Mix (20/11/2026)

Branche `worktree-agent-a11a29c147749fb78`. Un seul fichier de code : `public/assets/js/samples.js` (zone moteur). Rien poussé, pas de bump.

## En bref

Les passages entre sons passent tous par **une fonction `transition()`**, calée sur l'horloge audio. Les options du Mix (durée, effet) marchent sur **sample → sample** (Samples, A cappella) et **ton morceau → sample** (Mix). **Sample → ton morceau** reste à 0,35 s, « pile et fort ». Sur iPhone, ton morceau garde la **coupe nette**.

## Ce qui est fait

1. **Une fonction de transition** : `transition(from, to, plan)`. Elle prend en charge le fondu à puissance égale, l'effet sur le sample et les événements pour l'interface. Le plan vient de `planOf(kind, from, to, o)`. Elle remplace les 7 chemins (`play` en fondu, `mixIn`, `mixOut`, `nextSeg`, `swapToNext`, `engAuto`, `engTick`). `xfade` et `ramp` sont supprimés.
2. **Horloge audio** : `clockAt` et `clockRamp` remplacent les `setTimeout` du son. Ce sont des tâches lues toutes les 20 ms sur `ctx.currentTime`, avec un repli sur l'heure murale si le contexte est arrêté. Le volume de ton morceau et celui de YouTube (hors Web Audio) suivent la même horloge. La « minute » de ton morceau est aussi comptée sur cette horloge.
3. **Bus de sortie** : chaque voix suit le chemin `source → passe-haut 10 Hz (transparent) → gain → bus.in → bus.out → sortie`. Les effets prennent un envoi avant le gain de la voix et reviennent dans `bus.out`.
4. **Effets**, sur le sample seulement :
   - **Fondu** : puissance égale.
   - **Reverb** : convolution, réponse générée (bruit qui décroît, 2,4 s), créée une seule fois.
   - **Écho** : retard de ¾ de temps au BPM du sample, retour 0,45, passe-bas 2,4 kHz.
   - **Basses** : passe-haut qui monte de 20 à 900 Hz sur le sample qui sort. Entre deux samples, les basses du sample qui entre attendent le milieu.
   - **Hasard qui écoute** : écart de BPM < 4 → fondu ; de 4 à 12 → basses ; > 12 → écho.
   - Ton morceau → sample : l'effet est joué « à l'envers » sur le sample qui entre (il sort de la reverb, les basses reviennent).
5. **Durées** :
   - **Aucune** = coupe de 0,03 s.
   - **5 s**.
   - **Auto** = 960 / BPM, bornée de 4 à 12 s, 8 s sans BPM.
   - Toujours plafonnée à **2 × la vraie marge** de chaque extrait (champ `x`, jamais 4 s fixe). Les règles viennent de `window.InfraSamplesMixCore` (agent fiabilité), avec un repli interne identique.
   - **Plancher** : si la marge est trop courte (la moitié des passages), la durée ne descend jamais sous le fondu validé d'avant (2 s), sauf « Aucune ». Sans plancher, la moitié des passages serait devenue des coupes sèches.
6. **Bugs du § 3a corrigés** :
   - Un seul écouteur `playing` à la fois (`onNextPlaying` / `dropPlaying`, avec expiration à 20 s), pour « Aller au morceau » et pour `startTrack`.
   - Refus passager de la lecture en flux → nouvel essai aussitôt par le tampon décodé. Un vrai échec met l'extrait de côté 2 min, puis pour la session au 2e échec.
   - Les 3 lecteurs du lot sont débloqués pendant le geste.
   - `ctx.resume()` au retour sur la page (`visibilitychange`).
   - Fermer pendant un fondu long coupe aussi le sample qui sortait.

## API (sur `window.InfraSamples`)

| Appel | Effet |
|---|---|
| `mix.getOptions()` | `{dur, fx, defaults, durations:["none","5","auto"], effects:["fade","reverb","echo","bass","listen"], trackFades}` |
| `mix.setOptions({dur, fx})` | Enregistre dans `infra-samples` (localStorage, try/catch). Accepte aussi `aucune`, `fondu`, `basses`, `hasard`, `random`. Renvoie les options et émet `samples:options`. |
| `mix.resetOptions()` | Auto + Fondu |
| `mix.nextTransition()` | Prochain passage, tel qu'il sera joué : `{kind, dur, fx, picked, fromBpm, toBpm, toCover}` ou `null` |
| `mix.previewTransition()` | Saute 6 s avant la prochaine transition. Mix : fin de la minute de ton morceau. |
| `mix.supports(kind, value)` | `false` = à griser. iPhone dans le Mix : seule la durée « none » reste vraie. |
| `current()` | Ce qu'on entend : `{mode, phase, title, artist, track, album, bpm, tempo, cover, playing}` |

Événement `samples:transition` sur `document`. Champs de `detail` :

| Champ | Contenu |
|---|---|
| `phase` | `start` ou `end` |
| `kind` | `smp`, `out`, `in`, `seg` ou `skip` |
| `fx` | Effet **vraiment joué** : `fade`, `reverb`, `echo`, `bass` ou `cut` |
| `picked` | Effet choisi |
| `dur` | Secondes réelles, après plafond |
| `fromBpm`, `toBpm` | BPM affichés |
| `toCover` | Pochette qui arrive |
| `opt` | `{dur, fx}` : le choix de l'utilisateur |

Télémétrie envoyée : `samples_mix_fx`, `samples_mix_opt`, `samples_mix_try` (noms du cœur), plus `samples_audio_retry`. Elle doit être dans la liste blanche (agent télémétrie).

## Reste à faire (après la maquette)

- **Chargement** : `samples-mix-core.js` doit être chargé avant `samples.js`, et il faut l'ajouter au service worker. L'agent principal s'en charge à la fusion. `samples.js` est chargé à la demande par `bibliotheque.js` et `track-actions.js`, pas par `index.html`.
- **Réglages à l'oreille** : niveau de la reverb (0,8 · envoi 0,9), écho (¾ de temps, retour 0,45), basses (900 Hz), seuils du hasard.
- **Fondu décentré** : il permettrait des fondus plus longs quand un seul côté a de la marge.
- **Mix, sample → morceau** : aucun effet aujourd'hui. Choix à faire par INFRA, par exemple une traîne d'écho.
- **Passages d'un même enchaînement** (Mix, deux samples du même morceau) : restent à 1 s.
- **Écart de départ en lecture en flux** : le 1er son peut partir un peu avant son instant prévu (`el.play()` immédiat). Non traité (§ 3a, bug 5).
- **Petits retards restants** : `unhush` (150 ms) et le recalage de 1,2 s de ton morceau restent des minuteries, car ils attendent un chargement.

## Prouvé / non vérifié

- **Prouvé** :
  - Lint du projet OK.
  - `node tools/release-audit.js` OK (26 contrôles).
  - Essai sans écran (Chromium) sans aucune erreur console :
    - la page Samples s'ouvre ;
    - les options sont lues et enregistrées ;
    - un écho de 8 s a été joué entre deux samples (les deux voix sont en cours de fondu) ;
    - les événements `start` et `end` sont reçus ;
    - le Mix s'ouvre avec Reverb.
- **Non vérifié** :
  - Le son à l'oreille.
  - Ton morceau → sample joué en entier.
  - iPhone réel (écran verrouillé, retour d'arrière-plan, coupe nette) : non essayé.
