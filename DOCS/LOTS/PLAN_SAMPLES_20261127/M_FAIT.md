# Moteur Samples : M1 → M7 faits (27/11/2026, Claude, agent moteur)

Branche locale `worktree-agent-a7ad778669264b85e`, rien en ligne (pas de push, pas de `npm run bump`, Worker non déployé, rien sur R2).

## En bref
1. **Ton morceau passe par le même moteur que les samples** : vrais fondus et effets sur iPhone, plus de coupe nette, plus de trou au départ (« des fois ça bug »).
2. **Il est préparé pendant le sample** : il entre pile à l'instant prévu (essai : 0 ms de retard, aucun silence).
3. **Effets à chaque passage** : entre deux samples, entre les parties d'un sample, de ton morceau vers le sample suivant. Sample → ton morceau reste net (0,35 s).
4. **Durées en mesures** : Aucune · 2 · 4 (défaut 4). Plus rien de grisé sur iPhone.
5. **Pause du casque ou de l'écran verrouillé** : le Mix ne repart plus tout seul.
6. **Fin de liste** : fondu de 3 s, arrêt propre, lecture repart du début.
7. **Télémétrie** : un `samples_pass` par passage (retard, silence, source, contexte). Le Worker doit être mis à jour pour les garder (patch prêt, à déployer avec ton oui).

## Commits (un lot chacun)
| Lot | Commit | Contenu |
|---|---|---|
| M1 | `d1e76b7` | `samples_pass` (kind, cause, fx, dur_s, late_ms, gap_ms, pre, buf, ctx, vis), 30 au plus par page ; champs gardés côté site ; patch Worker `worker-samples-pass.patch` |
| M2 | `1dbe1c8` | B7, B4, B5, B8, B3, B2, B6 corrigés sur l'ancien chemin (repli d'un pas si M3 pose problème) |
| M3 | `7919fef` | option B : la minute de ton morceau = voix Web Audio ; lecteur du site en pause pendant le Mix ; outil `outils/extraits_morceaux.py` |
| M5 | `65ffaa3` | T12 mesures, effets sur `seg` et sur les deux sons de `out` |
| M6 | `07d284f` | page cachée : passages posés 4,5 s à l'avance ; suspend/resume au retour ; coupures notées |
| M7 | `dfedbab` | fin de liste propre partout |

## Comment ton morceau est joué (M3)
- Source 1 : extrait préparé sur R2, champ `tx` de `samples.json` = `[nom, début, durée]`, fichier `…/streams/samples/t/<nom>.m4a` (entrée − 4 s → entrée + 64 s). Téléchargé et décodé dès la dernière partie du sample. **Aucun extrait n'existe encore** (404 vérifié) : l'outil est écrit, pas lancé.
- Source 2 (repli, utilisée aujourd'hui) : le fichier R2 du morceau lu en flux par un lecteur du lot déjà branché dans Web Audio, lancé muet 10 s avant l'entrée, recalé 2 s avant. CORS vérifié en lecture seule (`access-control-allow-origin: *`, Range 206).
- Lecture d'une plage par requête Range puis décodage : écartée (m4a AAC : l'index `moov` est en tête et les offsets pointent dans tout le fichier ; un morceau tronqué ne se décode pas de façon fiable, surtout sur Safari).
- Pas de son à l'heure (réseau) : le sample continue (sa marge), ton morceau entre dès qu'il a du son ; 8 s au plus, puis son suivant.

## Prouvé (sans son : Web Audio routé vers un gain nul, lecteurs muets, YouTube bloqué, serveur local 8823)
- Mix : sample → ton morceau (flux préparé, `late_ms` 0, `gap_ms` 0) ; ton morceau → sample suivant avec Reverb sur les deux sons ; saut › pendant ton morceau (fondu 2 s) ; « Aller à ton morceau » (le sample attend le son du morceau, 287 ms) ; pause / reprise dans le sample et dans ton morceau, sans redémarrage seul ; lecteur du site relancé → Mix en pause (`samples_lock site_play`) ; ‹ ; fin de liste puis reprise au début.
- Passage entre deux parties en 2 mesures avec Reverb (5,2 s à 92 BPM), à l'instant prévu.
- Section Samples : entrée de ton morceau à la seconde près puis fin propre.
- Menu ⋯ : « Durée en mesures : Aucune · 2 · 4 », rien de grisé ; ancien réglage « Auto » relu comme 4.
- Aucune erreur console ; fermeture : tout s'arrête, contexte suspendu.
- `npm test` vert à chaque lot ; `node tools/verify-public-boundary.js` OK ; `tools/test-samples.js` : horloge simulée (retour d'arrière-plan), partie « morceau », mesures, effets par passage.

## À essayer sur iPhone (non vérifié ici)
1. Mix : l'entrée de ton morceau et sa sortie vers le sample suivant (fondu, effet) — avant : coupe nette.
2. Écran verrouillé pendant le Mix : le son continue-t-il ? (risque WebKit connu : contexte suspendu). Au déverrouillage : reprise propre ?
3. Pause depuis le casque ou l'écran verrouillé : le Mix doit rester en pause.
4. Bouton silencieux de l'iPhone : le Mix doit sonner (audioSession « playback »).
5. Journal à lire ensuite : `samples_pass` avec `gap_ms` > 300 ou `late_ms` > 200, `samples_lock`, `samples_resync` — **après déploiement du patch Worker**, sinon les champs sont jetés par le serveur.

## Reste à faire (avec ton oui)
- **Worker** : `DOCS/LOTS/PLAN_SAMPLES_20261127/worker-samples-pass.patch` (commande en tête du fichier ; `--dry-run` passe sur le Worker actuel).
- **Extraits de ton morceau** : copier `DOCS/LOTS/PLAN_SAMPLES_20261127/outils/extraits_morceaux.py` dans `INVENTAIRE_SAMPLES/_outils/`, le lancer (≈ 290 extraits, ≈ 2,2 Mo chacun), envoyer sur R2 (`--r2` affiche la commande), ajouter `tx` dans `publie.py` (`--publie` affiche le code). À faire **après** la correction des entrées `at`/`go` (lot D1), sinon les extraits seraient à refaire.
- **Media Session du Mix** (titre du sample sur l'écran verrouillé, boutons → Mix) : pas posée. Le site ne sait pas reprendre ses propres commandes avant de rejouer un morceau ; il faudrait exposer `bindMediaSessionActions({ force: true })` du lecteur du site (règle AGENTS : ne pas toucher Media Session sans preuve). Aujourd'hui, l'écran verrouillé pilote le lecteur du site ; s'il le relance, le Mix se met en pause.
- Mise en ligne : fusion, `npm run bump`, push, lecture du déploiement.

## Petits bouts d'affichage (pour l'agent interface, non faits ici)
- Pendant ~1,2 s avant l'entrée de ton morceau (4,5 s page cachée), la barre reste figée à la fin du sample.
- La sortie de ton morceau étant programmée en avance, la page passe au sample suivant ~1,2 s avant qu'on l'entende (comme avant).
- Fin de liste : rien n'indique « fin » à part le bouton lecture et la barre pleine (idée : « Fin du Mix · rejouer »).
- Le menu ⋯ affiche « 2 » et « 4 » sous « Durée en mesures » ; la ligne du Mix dit « 4 mesures · Fondu ».

## Notes pour la fusion
- Fichiers touchés : `public/assets/js/samples.js` (moteur, `open`/`close`, `play`, `seekTo`, `toggle`, `barState`, `isPlaying`, messages YouTube — pas `render`, `albumPage`, `paint`, `paintNow`, `buildSheet`, `injectCss`), `samples-mix-core.js`, `samples-mix-ui.js` (durées), `src/js/audio-telemetry.js` + `app.js` reconstruit, `tools/test-samples.js`.
- Crochet de test `InfraSamples._t` : n'existe que si `window.__INFRA_SAMPLES_TEST__` est posé avant le chargement de `samples.js`.
- Cet agent était isolé dans sa copie : ce fichier et le patch Worker sont dans la branche (`DOCS/LOTS/PLAN_SAMPLES_20261127/`), pas dans le dépôt principal.
