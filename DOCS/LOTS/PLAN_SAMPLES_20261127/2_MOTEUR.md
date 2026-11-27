# 2 · Moteur audio et transitions (27/11/2026, Claude, lecture seule)

1. Les effets (reverb, écho, filtre) **sont codés et branchés**, mais ne jouent qu'à **un seul endroit** : quand ton morceau a joué sa minute entière et laisse la place au sample suivant.
2. INFRA saute ou avance presque toujours avant cette minute → **il n'entend jamais d'effet** (journal iPhone : zéro `samples_mix_fx`).
3. Entre deux samples d'un même morceau : fondu fixe d'1 s, jamais d'effet, réglages ignorés. Sample → ton morceau : 0,35 s, sans effet (voulu).
4. Sur iPhone, ton morceau passe par le lecteur du site, dont le volume est bloqué : **coupe nette** à l'entrée comme à la sortie, durées grisées.
5. Ton morceau n'est lancé que 3 s avant son entrée, depuis zéro : il met 1 à 2,3 s à démarrer, puis se recale → **trou ou mauvais départ** (« des fois ça bug »).
6. Saut ‹ › : le sample suivant est souvent lu « en flux » ; le fondu se joue avant que le son arrive → **silence puis son brutal**.
7. Pause depuis l'écran verrouillé ou le casque : le Mix ne le sait pas et **repart tout seul** au retour (minuterie de 60 s jamais annulée).
8. Proposition : jouer **la minute de ton morceau dans le même moteur que les samples** (un extrait préparé, comme les samples) → vrais fondus et effets partout, iPhone compris, sans toucher au lecteur du site.
9. Question à trancher d'abord (QCM) : « que des samples dans le Mix » veut-il dire **sans ton morceau** ? Si oui, tout devient plus simple (lot M0).
10. Plan : 7 petits lots (M1 → M7), télémétrie d'abord, pour voir chaque passage raté au prochain essai.

---

## 0. Question préalable (QCM, recommandé en premier)

INFRA : « que des samples dans le Mix, pas d'a cappella, pas de voix ».
- **A (recommandé, à confirmer)** : le Mix garde « sample(s) → ton morceau → sample suivant », mais **aucune voix isolée** (déjà le cas : `duoOk` exclut `v`, `samples.js:212`) ; les sons vocaux mal étiquetés sont un sujet de données (agent 1).
- **B** : le Mix devient **une suite de samples seulement** (ton morceau n'est plus joué). Tous les passages deviennent sample → sample dans le moteur Web Audio : vrais fondus et effets sur Mac et iPhone avec le code existant ; M3 et M4 tombent.
- **C** : les deux, au choix dans le menu ⋯ (« avec ton morceau / samples seuls »).

## 1. Inventaire des passages

Rappel des chemins : un « item » du Mix = un ou plusieurs samples d'un morceau (`chainOf`, `samples.js:226`), joués par le moteur Web Audio (extraits R2, `engStart` `samples.js:3411`), puis **60 s de ton morceau** par le lecteur du site (`<audio id="infraGlobalAudio">`, via `InfraLibraryPlayback.playPaths`, `samples.js:2363`). Section Samples = même moteur (`open`, `samples.js:1438`). A cappella seule utilise le chemin « sample → sample » (`engAuto`).

| Passage | Code | Mac (on entend) | iPhone (on entend) | Effet ? |
|---|---|---|---|---|
| Sample → sample **du même morceau** (parties) | `nextSeg` `samples.js:304`, plan `seg` fixe `SEGXF = 1` s (`:53`, `:323`, `:3616`) | fondu 1 s | fondu 1 s (gain Web Audio) | **jamais** ; réglages Durée/Effet ignorés |
| Sample → **ton morceau** | `preroll` `:2464` (3 s avant, muet) puis `mixIn` `:2491`, plan `in` 0,35 s | entrée nette, recalage possible | entrée nette ; si pas préparé : attente fixe 1,3 s (`:2507`) puis son ouvert même si le morceau n'a pas démarré → trou | non (voulu, T bis 3) |
| **Ton morceau → sample suivant** (fin de la minute) | `scheduleOut` `:2545` → `mixOut` `:2549` → `play(next, …, true, 0, planOf("out"))` `:1524` | fondu volume du morceau + entrée du sample avec effet | morceau **à plein volume 0,9 s puis coupé** (`:1550`) ; durée bridée à 2 s (`:2756`) | **oui, seul endroit** (rôle « in » sur le sample qui entre, `applyFx` `:2951`) |
| Saut **›** pendant le sample | `step` `:1613` → `play` plan `skip` 2 s | fondu 2 s si l'extrait est en mémoire ; sinon flux : fondu joué dans le vide, son qui arrive d'un coup | idem, latence 1-2 s plus fréquente | non (`skip` hors `MIXED`, `:2728`) |
| Saut **›** pendant ton morceau | `play` → `stopDuo(true)` → `pauseMusic` ; plan `first` 0,05 s (`hadVoice` faux, `:1582`) | coupe, puis silence le temps que le sample charge | idem | non |
| **‹** (> 3 s joué) / début du sample | `prev` `:1621` → `seekTo(0)` → `play(cur, …, 0)` | coupe + rechargement | idem | non |
| **Glisser dans la barre** (seek) | `seekTo` `:2072` ; dans le sample : `engSeek` (fondu 0,06 s) ; vers ton morceau : `startTrack(..., "track")` `:2106` (muet 150 ms après `playing`) | court silence, recalage | 1-2 s de silence (fetch 206) | non |
| **Fin de liste** | `mixOut` sans suivant `:2553` : fondu linéaire 3 s puis pause | fondu 3 s | 3,2 s plein volume puis coupe | non |
| **Écouter la transition** (menu ⋯, touche T) | `previewTransition` `:3727` : saute 6 s avant la fin de la minute | le seul moyen d'entendre un effet vite | idem, mais morceau coupé net | oui (celui de « out ») |
| **Arrière-plan** (onglet caché Mac, app iPhone en fond) | horloge `clockTick` toutes les 20 ms (`:2620`), `engTick` 100 ms (`:3579`) ; minuteurs ralentis | volume du morceau par marches d'1 s ; passages en retard | minuteurs gelés ; contexte souvent « interrupted » ; voir § 3 | — |
| **Retour au premier plan** | `visibilitychange` `:3630` : seulement `ctx.resume()` | — | toutes les tâches en retard partent d'un coup (`clockJob` retombe sur l'heure murale, `:2598`) : `mixIn`/`mixOut` en rafale ; aucune resynchronisation de la position | — |
| **Écran verrouillé** | rien de spécifique ; Media Session = celle du site (titre de ton morceau, `playPaths`) | — | commandes de l'écran verrouillé pilotent la file du site (1 titre), pas le Mix ; pause → le Mix l'ignore (bug B4) | — |

## 2. Les effets : branchés, audibles, mais presque jamais joués

- Chaîne : voix → passe-haut → gain → bus (`voiceNodes` `:3002`, `bus` `:2873`). Reverb : réponse générée 2,4 s (`reverbIn` `:2884`). Écho : retard 3/4 de temps, retour 0,45 (`echoIn` `:2908`). Filtre (« Basses ») : passe-haut qui monte à 900 Hz (`applyFx` `:2956`). **Tout est branché et audible** sur Mac et iPhone (gain Web Audio).
- **Quand ?** `applyFx` n'est appelé que pour les plans `smp` (A cappella) et `out` (`transition` `:2795`, `MIXED` `:2728`). Dans Mix et Samples, `st.mix` est vrai (`:1447`) : la branche `engAuto`/`smp` n'est jamais prise (`engTick` `:3588` sort avant). Reste **un passage par item : ton morceau → sample suivant, après 60 s**.
- **Pourquoi INFRA ne les entend jamais :**
  1. il saute/avance avant la fin de la minute (journal : aucun `samples_mix_fx`) ;
  2. entre samples d'un même morceau : fondu fixe 1 s (`seg`) ;
  3. sur iPhone, `planOf` bride « out » à 2 s (`:2756` + plancher `OVERLAP`) : une reverb « à l'envers » de 2 s sur un sample qui monte, pendant que ton morceau reste à plein volume puis coupe → l'effet est masqué ;
  4. si le sample suivant n'a pas d'extrait (YouTube) : effet ramené à « fondu » (`:2766`) ;
  5. les durées « 5 s / Auto » sont grisées sur iPhone dans le Mix (`supports` `:3678`) ;
  6. les durées en mesures validées (T12 : Aucune · 2 · 4) ne sont **pas codées** (`samples-mix-core.js:24` : `none, 5, auto`).

## 3. Bugs

### Certains (prouvés par lecture du code)
- **B1 Ton morceau jamais prêt** : lancé seulement `LEAD = 3` s avant (`:52`, `:3599`), par `playPaths` qui remplace la file du site par un seul titre (`favorites-ui.js:1172`) → le préchargement du site (2 Mo du **début** du fichier, `audio-prefetch.js:31`) ne sert jamais : on entre au milieu du morceau (`entryOf`, `:2461`). D'où `unprepared` et 1,1-2,3 s au journal. Puis `onNextPlaying` + recalage à 1,2 s (`:2396`, `:2416`) = **deuxième requête** 206 → plus de 3 s possible.
- **B2 Entrée sans préparation** (saut ou seek dans la dernière partie) : `mixIn` attend 1,3 s fixe (`:2507`) puis ouvre le son et coupe le sample, que le morceau joue ou non → silence.
- **B3 Fondu « dans le vide » en flux** : `engStart` programme le fondu à `now + 0,02 s` (`:3419-3426`) alors que l'élément `<audio>` du lot n'a pas commencé ; sur réseau lent le fondu finit avant le son → silence puis entrée brutale. Fréquent après un saut (préchargement seulement de la partie suivante, et 4 s après le départ, `:3437`, `:3473`).
- **B4 Pause extérieure ignorée** : aucun écouteur `pause` sur le lecteur du site (`grep` : seulement `playing`/`ended`, `:1820`, `:2403`). Pause par casque, écran verrouillé, centre de contrôle → `scheduleOut` (60 s) court toujours → le sample suivant **repart seul** (au retour au premier plan sur iPhone, rafale B5).
- **B5 Retour d'arrière-plan** : les tâches en retard partent toutes ensemble (`clockTick` `:2620`) ; aucune resynchronisation (position, voix finies pendant le verrouillage).
- **B6 iPhone, sortie de ton morceau** : plein volume 0,9 s par-dessus le sample, puis coupe (`:1550`) ; fin de liste : 3,2 s puis coupe (`:2555`, volume en lecture seule).
- **B7 A1 de l'audit** : `unlockAudio` (`:2565`) déclenche l'écouteur `play` (`:2281`) → sample mis en pause à l'ouverture.
- **B8 Saut pendant la sortie de ton morceau** : `stopDuo(false)` efface le fondu en cours puis remet `volume = 1` (`:2360`) → ton morceau **remonte d'un coup** jusqu'à la pause par `engStart`.
- **B9 Réglages sans effet** : sample → sample (même morceau) ignore Durée/Effet ; T12 (mesures) absent.
- **B10 Télémétrie aveugle** : le Worker jette `fx`, `dur_s`, `pre`, `fade`, `bpm`… (patch prêt : `AGENTS_MIX_20261120/worker-samples-fields.patch`, non appliqué).

### Supposés (à prouver sur iPhone)
- S1 Écran verrouillé : contexte Web Audio suspendu ou « interrupted » → samples muets alors que ton morceau (lecteur du site) continue (WebKit 283419, 261554 ; `3_WEB.md` 20/11).
- S2 iOS 26, app sur l'écran d'accueil : muet au retour d'arrière-plan (WebKit 291892, 295518).
- S3 Mac : le visualiseur branche déjà le lecteur du site dans **son propre** contexte Web Audio (`audio-visualizer.js:176`, ordinateur seulement) ; un seul `createMediaElementSource` possible par élément → interdit d'en créer un second dans `samples.js`.
- S4 `forceAudioFullVolume` du site (`audio-core.js:895`) peut écraser le fondu d'entrée Mac quand le morceau démarre après l'ouverture du son.

## 4. Architecture cible

### Options pour ton morceau
| | A. Lecteur du site dans Web Audio (`MediaElementAudioSourceNode` sur l'`<audio>` unique) | **B. Minute de ton morceau jouée par le moteur Samples (recommandé)** | C. Rien ne change (coupe iPhone) |
|---|---|---|---|
| Fondus/effets iPhone | oui | **oui** | non |
| Touche au lecteur du site | **oui** (règle AGENTS « ne pas modifier audio ») ; tout le site passe par Web Audio | non | non |
| Écran verrouillé / arrière-plan | **risque fort** : contexte suspendu = **tout le site muet** (S1, S2) ; conflit avec le visualiseur (S3) | même risque que les samples aujourd'hui, limité au Mix | inchangé |
| Préparation | prefetch du site inutile (milieu du fichier) | **extrait préchargé comme un sample** → départ à l'échantillon près | B1 reste |
| Media Session | celle du site | à poser par Samples pendant le Mix (voir M6) | celle du site |

**B en détail**
1. **Extrait de ton morceau** : pour chaque item du Mix, un fichier `streams/samples/t/<morceau>_<entrée>.m4a` = de `entrée − 4 s` à `entrée + 64 s` (AAC ~192 k, ~1,6 Mo). Fabriqué localement comme les extraits des samples (agent 1 / données ; **après correction des `at`/`go`**, U6). Secours si absent : le fichier R2 complet joué par un lecteur du lot (`poolEl`, déjà branché dans Web Audio, `crossOrigin` posé) avec `#t=`, préparé **muet par le gain 10 s avant** (pas 3).
2. **Une seule horloge, une seule fonction** : ton morceau devient une « voix » comme un sample (`startVoice` / `startStreamVoice`) ; `transition()` gère les 4 cas (`seg`, `in`, `out`, `skip`) avec les mêmes règles ; les passages sont **programmés à l'avance sur l'horloge audio** (paramètres `AudioParam`), donc indépendants des minuteurs ralentis.
3. **Le lecteur du site est mis en pause** pendant tout le Mix (déjà le cas pour les samples) ; aucune modification d'`audio-core`, du prefetch, du visualiseur.
4. **Préchargement** : pendant le sample, précharger l'extrait de ton morceau ; pendant ton morceau, précharger le premier sample suivant ; après un saut, précharger **les deux** suivants. Mémoire : un extrait de 68 s décodé ≈ 24 Mo ; garder au plus 1 morceau + 2 samples décodés (`MAXBUF` par type), ou lire l'extrait du morceau en flux depuis un `Blob` préchargé (aucun décodage).
5. **Flux sans « fondu dans le vide »** : ouvrir le gain d'une voix en flux seulement à son `playing` (rattrapage de l'instant), sinon attendre le tampon.
6. **Pause / arrière-plan** : écouter `pause`/`play` des lecteurs et `statechange` du contexte ; tâches en retard de plus d'1 s **jetées** puis resynchronisation (position recalculée, voix relancée au bon endroit).
7. **Media Session pendant le Mix** (décision d'INFRA, touche « Media Session ») : titre/pochette du son entendu, play/pause/suivant/précédent → Mix ; rendue au site à la fermeture. Sur iPhone, l'écran verrouillé ne s'affiche qu'avec un élément média qui joue : privilégier la lecture **en flux** (élément du lot) pour ton morceau. À vérifier sur appareil.

Risques B : CORS R2 déjà en place pour les extraits (mêmes en-têtes) ; nombre d'extraits à fabriquer et publier (oui d'INFRA, R2) ; écran verrouillé iPhone non garanti (S1) — pire cas : le Mix s'arrête au verrouillage, comme les samples aujourd'hui ; la section Samples (« ton morceau suit ») suit le même chemin.

## 5. Plan de code (petits lots, dans l'ordre)

| Lot | Contenu | Fichiers | Tests |
|---|---|---|---|
| **M0** | Réponse au QCM § 0. Si B : Mix = samples seuls, plans `smp` partout, M3-M4 sautés | — | — |
| **M1 Télémétrie** | Appliquer le patch Worker (oui d'INFRA) + champs § 6 ; un événement `samples_pass` par passage | `samples.js`, `samples-mix-core.js` (TELEMETRY), `audio-telemetry.js`, Worker | `test-samples.js` (c) : champs gardés ; `test-audio-telemetry-privacy.js` |
| **M2 Corrections sûres** | B7 (drapeau de déblocage), B4 (écouteur `pause` → `clearOut`, reprise → `scheduleOut`), B5 (tâches en retard jetées + resync), B8 (pas de `volume = 1` pendant une sortie), B3 (gain ouvert au `playing`) | `samples.js` | nouveaux cas dans `test-samples.js` avec une fausse horloge (vm) : pause → pas de `mixOut` ; retard 30 s → une seule tâche |
| **M3 Ton morceau dans le moteur** | Voix « morceau » (flux R2 complet par `poolEl`, préparé 10 s avant, gain 0) ; `mixIn`/`mixOut` passent par `transition()` ; lecteur du site en pause ; `canFade` et grisage iPhone retirés | `samples.js` | test : plans `in`/`out` identiques Mac/iPhone ; `supports("dur", …)` vrai partout |
| **M4 Extraits de ton morceau** | Champ `tx` dans `samples.json` (nom, début, durée) ; tampon préchargé ; repli M3 | données (agent 1), `samples.js` | `test-samples.js` (a) : `tx` couvre `entrée − 4 → entrée + 60` |
| **M5 Réglages partout + T12** | Durées en **mesures** (Aucune · 2 · 4) dans `samples-mix-core.js` ; effet appliqué aussi à `seg` (samples d'un même morceau) et à `skip` (court) ; « out » avec effet sur les **deux** voix | `samples-mix-core.js`, `samples.js`, `samples-mix-ui.js` | (b) : `transitionSeconds("2", 120) = 4 s`, plafonds par marge |
| **M6 Écran verrouillé** | Media Session du Mix (décision d'INFRA) ; reprise après « interrupted » | `samples.js` | essai iPhone par INFRA, lecture du journal |
| **M7 Fin de liste et cas limites** | Fondu de fin par le gain ; fin de liste → reprise en boucle ou arrêt propre (choix INFRA) | `samples.js` | test plan « end » |

Ordre de livraison : M1 + M2 ensemble (une version d'essai), puis M3, M5, M4 (données prêtes), M6.

## 6. Télémétrie à ajouter (aucun titre, aucune adresse)

Un événement **`samples_pass`** par passage, envoyé quand il se termine :
- `kind` (`seg` `in` `out` `skip` `seek` `first` `resume` `end`), `cause` (`auto` `skip` `prev` `seek` `lock` `ended`), `fx` joué, `dur_s` prévu ;
- `late_ms` (retard réel entre l'instant prévu et le premier son du nouveau titre), `gap_ms` (silence mesuré : instant où la voix sortante est éteinte → `playing` de l'entrante), `pre` (préparé), `buf` (tampon / flux / YouTube), `ready_state` du lecteur à l'ouverture ;
- `ctx` (`running` `suspended` `interrupted`), `vis` (page visible ou non), `fade` (volume réglable).
Champs à ajouter au Worker en plus du patch : chaînes `kind`, `cause`, `buf`, `ctx` ; nombres `late_ms`, `gap_ms` (`ready_state`, `delta_ms` existent déjà) ; booléen `vis`. Ajouter aussi `samples_lock` (pause/reprise venue de l'extérieur) et `samples_resync` (retour d'arrière-plan : `late_ms`, `dropped`).

Avec ça, au prochain essai : chaque passage raté = un `samples_pass` avec `gap_ms` > 300 ou `late_ms` > 200, sa cause et l'état du contexte.

## 7. Non vérifié
- Rien n'a été écouté (son coupé, lecture du code seulement) ; comportement réel iPhone (verrouillage, iOS 26 PWA) non testé.
- Taille réelle des extraits de ton morceau et place sur R2 : à mesurer au lot M4.
