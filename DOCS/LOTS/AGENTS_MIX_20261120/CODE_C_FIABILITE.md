# Agent C · fiabilité (20/11/2026)

Branche locale à part, rien poussé, rien déployé, pas de `bump`. `samples.js` et le CSS non touchés.

## En bref

1. **Télémétrie Samples réparée côté site** : les 6 événements jetés (`samples_part`, `samples_seek`, `samples_toggle`, `samples_sort`, `samples_mix_in`, `samples_jump`) et les 5 nouveaux du Mix (`samples_mix_opt`, `samples_mix_fx`, `samples_mix_try`, `samples_tab_swipe`, `samples_voice_mark`) sont dans la liste blanche (`src/js/audio-telemetry.js`, envoi direct). `app.js` reconstruit.
2. **Leurs détails passaient à la trappe aussi** : `sec`, `sort`, `k`, `n`, `bpm`… étaient effacés avant l'envoi. Ajoutés comme champs autorisés : texte `sec sort scope to fx opt choice tab`, nombres `n k bpm at bpm_gap dur_s`, oui/non `pre fade`. Rien de privé (pas de titre, pas d'adresse).
3. **Nouveau cœur du Mix** `public/assets/js/samples-mix-core.js` (global `InfraSamplesMixCore` + module Node), fonctions pures que le moteur pourra brancher : durée (Aucune 0,03 s · 5 s · Auto = 4 mesures = 960/BPM, bornée 4-12 s, 8 s sans BPM), plafond = 2 × marge de l'extrait (8 s aujourd'hui), sample → morceau fixe 0,35 s ; « Hasard qui écoute » (écart < 4 BPM → fondu, 4-12 → basses, > 12 → écho, tempo inconnu → fondu) ; fondu à puissance égale (cos/sin) et ses courbes pour `setValueCurveAtTime`.
4. **Nouveau test** `tools/test-samples.js`, branché dans `npm test` (`tools/release-audit.js`) : données, cœur du Mix, et « chaque événement Samples envoyé est bien gardé ».
5. **`tools/check-data-schemas.js`** contrôle maintenant la forme de `s0 s1 at x p tb c v`.

## Attend le oui d'INFRA (Worker, non fait)

Le Worker (`_private/workers/infra180-audio/src/index.js`) n'a **pas de liste d'événements** : il accepte les noms. Mais il a **ses propres listes de champs** : sans ajout, `sec`, `bpm`, `k`… seront effacés à l'arrivée. Modification prête (non appliquée, non déployée), 3 lignes :
- `LOG_STRING_FIELDS` : ajouter `"sec", "sort", "scope", "to", "fx", "opt", "choice", "tab"`
- `LOG_NUMBER_FIELDS` : ajouter `"n", "k", "bpm", "at", "bpm_gap", "dur_s"`
- `LOG_BOOLEAN_FIELDS` : ajouter `"pre", "fade"`
Puis déployer le Worker **avec le oui d'INFRA**. Sans ça, les événements arrivent quand même (nom, mode, heure), sans leurs détails.

Aussi à la publication : `npm run bump` (sinon `app.js` garde la même version et les navigateurs gardent l'ancien), et ajouter `samples-mix-core.js` au chargement de `samples.js` et au `sw.js` quand le moteur l'utilisera.

## Données (signalé, ne fait pas échouer)

Liste `KNOWN` dans `tools/test-samples.js` : CONTEMPLATION (entrée 152,7 s > morceau 125 s), 3 sons sans temps (MARSELHA, Question avec réponse le zin, Soleil qui se leve), et **nouveau** : NYQUIST / LIVE SESSION MALVADO (passage 415-460 s), extrait R2 de 7 s seulement au lieu de ~49 s. Le test dit quand une ligne est corrigée.
Seulement **238 passages sur 476** ont 4 s de marge des deux côtés (début de vidéo, fin de vidéo) : le moteur doit passer la **vraie marge de chaque extrait** à `transitionSeconds(choix, bpm, marge)`, pas 4 s fixe.
Le nom d'extrait de NASCAR garde l'ancien identifiant YouTube (lien corrigé en v471) : normal, accepté.

## Prouvé / non vérifié

- Prouvé : `npm test` code 0 (lint, build, 27 contrôles dont le nouveau) ; test rouge avant le patch (11 événements manquants dans l'ancienne liste) ; `check-data-schemas` rouge sur une donnée cassée exprès (copie temporaire).
- Non vérifié : réception réelle des événements par le Worker (pas déployé) ; tests privés du Worker non lancés sur la modification ; le cœur du Mix n'est branché nulle part (c'est le travail de l'agent moteur) ; rien sur iPhone.
