# D1 · Données des Samples — fait (27/11/2026, Claude)

Branche `worktree-agent-a8e5246c239414ac9` (6 commits, **rien poussé**, pas de `npm run bump`). `npm test` vert, frontière publique OK.

## En bref
1. **Musique seulement** : 0 voix. 444 sons → **254 samples**, 255 morceaux → **238**.
2. **Entrées recalées** : 50 samples changent de moment d'entrée (48 de plus d'1 s). LAVERNA : Honest entre à **0:00** (avant 0:24,6).
3. **8 extraits refaits** depuis le fichier joué dans le projet, sous un nouveau nom, envoyés sur R2 et vérifiés.
4. **30 pochettes** fausses remplacées ; 173 pochettes devenues inutiles supprimées.
5. **68 noms** nettoyés ; plus aucun « André Navarro II » ni artiste vide.
6. **Test anti-retour** : rouge sur l'ancien fichier, vert sur le neuf.
7. **À écouter par toi : 33 sons**, en 3 groupes (plus bas).

## Chiffres
| | Avant | Après |
|---|---:|---:|
| Sons dans Samples | 444 (293 musique, 151 voix) | 254 (musique) |
| Morceaux | 255 | 238 |
| Retirés | — | 151 voix · 32 pistes coupées · 5 parlés/non musicaux · 2 sans temps |
| Morceaux sortis | — | 7 voix seules (ETNA, PHARMAKON, Co27, TAKEMIKASUCHI, BONHEUR, COMETE, Posé) + 10 dont tous les sons sont retirés |
| Entrées (`at`) changées | — | 50 |
| Moment fort (`go`) | 77 | 103 (refait en entier) |
| Extraits R2 refaits | — | 8 (`_v2`, NASCAR sous `6s-wjQ7hx_0`) |
| Pochettes | 408 fichiers | 235 (30 remplacées) |
| Noms corrigés | — | 68 sons |

**Confiance des 254 entrées** : 146 sûres (projet et son d'accord) · 9 sûres par le morceau · 68 selon le projet, inchangées · 8 début d'export inconnu, inchangées · **22 à l'oreille**.
(Le commit 2 annonce 148/9/68/22 : ces nombres comptaient aussi 3 sons retirés ensuite.)

## Avant / après (5 exemples)
| Morceau | Sample | Avant | Après | Preuve |
|---|---|---:|---:|---|
| LAVERNA | Honest | 0:24,6 | **0:00** | son net (r 0,84), boucle du projet |
| SHKADOV | Vapor Frames | 0:40,9 | **0:00,4** | son très net (r 0,99) |
| VENUS | She's No Memory | 0:19,5 | **0:03,3** | le son corrige la règle de l'audit (0:00) |
| H-He | 水の彩 (Mitsuhiro Sakakibara) | 0:03,3 | **0:03,2** | correction de l'audit rejetée : l'actuel était juste |
| VOSTOK 1 | For the Dragons | 0:55,9 | **0:00,1** | le projet ne savait pas, le son tranche (r 0,83) |

## Liste d'écoute pour INFRA (33 sons)
Écoute **ton morceau** au moment indiqué : le sample doit y entrer. Dis « bon » ou donne le bon moment ; je l'écris dans `_outils/cale_oreille.json`.

**Groupe 1 — entrée déplacée, sans preuve au son (22)**
| Morceau | Sample | Écouter à | Avant |
|---|---|---:|---:|
| SOLVABLE | Can't We Smile? | 0:00 | 0:28 |
| LIMONE | Comentando | 0:02 | 0:35 |
| STROMBOLI | BGM #08 (Tori no Hoshi) | 0:03 | 0:53 |
| AMIATA | Teresa no Tameiki | 0:08 | 0:39 |
| MAGGIORE | BGM #02 (Center Shiken) | 0:00 | 0:37 |
| NYQUIST | あと何日 | 0:00 | 0:14 |
| BRUCE LEE | It Looks Like Love | 0:00 | 0:29 |
| FRIOUL | Alcajazz Theme | 0:03 | 0:20 |
| OIZYS | Samadhi | 0:00 (le son dit 0:04) | 0:16 |
| SEREIA DO MAR | La Valse Des Ames Perdues | 0:00 | 0:26 |
| IKÚ | I Hadn't Known | 0:00 | 0:13 |
| WACK | 90s ambient IDMbreakbeat | 0:00 | 1:22 |
| HYDRA | 𝒿𝒶𝓂𝑒𝓈 ★ 𝒦 | 0:00 | 0:25 |
| ESENGO | Fess Up | 0:00 | 0:44 |
| REVEILLE TOI | Space 1 | 0:00 | 0:03 |
| MIEL | Aqua Regia | 0:00 | 0:16 |
| FLEXIBLE | Waterglide | 0:00 | 0:34 |
| FLEXIBLE | Zippo | 0:16 | 0:37 |
| PREGUNTAS | Curiosa | 0:00 | 0:13 |
| Houston | Joie de vivre | 0:00 | 0:12 |
| YAYA | Castillo De Arena | 0:00 | 0:06 |
| AIRE | Gouriki Stage Theme | 0:35 (inchangé ; tempo variable dans le projet) | 0:35 |

**Groupe 2 — début de l'export inconnu, entrée inchangée (8)**
F = mω²r Contemplation (0:02, le son dit 0:22) · H2o Epílogo (0:00) · SHAJAR AL-DURR The Astounding Eyes of Rita (0:13) · SENTIR Setho (0:00) · LIN I Had No Right (0:00) · LDC13 Connecté HOURGLASS (0:00) · Chaire de poule V1 et V2 Wandering Days (0:00 ; le son dit 0:14 pour V1).

**Groupe 3 — à confirmer à l'œil (3)**
Rue Modeste 4 (YOSHIMITSU, IEMANJA) : titre, artiste et pochette inconnus (image de la vidéo). · Pochettes refaites de « Peaceful Things » (Pop Eye, image « Tumbling Dice ») et « SENSORIUM EP ». · 6 sons en « Artiste inconnu » (Keyser Söze, Rue Modeste 4, berceuses Kamananga, Bloop, River Master, Sounds of Solaris).

## Prouvé / supposé / non vérifié
- **Prouvé** : 146 entrées (projet et son d'accord) ; 8 extraits coupés dans le fichier exact du projet, présents sur R2 (durée lue sur l'URL) ; tests rouges puis verts.
- **Supposé** : 66 + 8 entrées selon le projet seul ; noms « Soichi Terada », « Nigel Westlake », « Kohta Takahashi » (connaissance) ; place dans la vidéo YouTube des 4 copies consolidées (laissée telle quelle).
- **Non vérifié** : écoute humaine, pochettes à l'œil sur le site, iPhone ; l'écran A cappella vide (lot I2).

## Ce qui reste douteux
- Titres en lettres décoratives (« 𝒿𝒶𝓂𝑒𝓈 ★ 𝒦 », « Waterglide - 𝕊𝕖𝕝𝕧𝕒𝕥𝕚𝕔𝕒 ») : hors liste du plan, non touchés.
- Année `an` = date de mise en ligne (2025) pour les sons des chaînes de diggers.
- Extraits des voix retirées : restent sur R2 (rien supprimé, ton oui attendu).
- `build-extraits.js` : non modifié ; la bonne méthode est `_private/samples-extraits/refait-d1-20261127.py` (coupe dans le fichier du projet, nouveau nom).

## Outils (locaux, hors dépôt ; copies `.avant-20261127`)
`_outils/temps.py` v3 (début d'export, pistes coupées, copies) · `cale.py` (nouveau : projet + son → `cale.json`) · `publie.py` v3 (écrit tout `samples.json` : x, c, version 2 ; `--sortie`) · `retires.json` (nouveau, raison de chaque retrait) · `fort.py` et `corrige.py` (`--fichier`) · `corrections.json` (+68 noms). Chaîne : `temps.py --ecrire → cale.py → publie.py → corrige.py → fort.py --tout → publie.py → corrige.py`.
