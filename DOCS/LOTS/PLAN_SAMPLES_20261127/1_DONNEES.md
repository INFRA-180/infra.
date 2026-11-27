# 1 · Données des Samples (27/11/2026, Claude, lecture seule)

1. **Le plus gros défaut est confirmé par le son lui-même.** Dans beaucoup de morceaux, le sample entre au tout début, mais le site le fait entrer 15 à 80 s plus tard.
2. La correction de l'audit (« enlever le début de l'export ») est **juste dans 22 cas sur 23** où le son tranche. Elle est fausse une fois (H-He) et **imprécise 4 fois** (VENUS, SUPERNOVA, OIZYS, HYDRA).
3. **La machine ne tranche pas pour un sample sur trois** : sample trop filtré, haché ou caché sous la voix (WACK, MAGGIORE…).
4. Méthode retenue : **le projet Ableton ET le son, comparés pour chaque sample**. S'ils sont d'accord, c'est sûr. S'ils ne le sont pas, le son gagne quand il est net. Sinon, c'est toi qui écoutes.
5. Les **extraits joués par le site sont bons à 90 %** (396 sur 441). **9 extraits musicaux** jouent le mauvais passage, dont 3 décalés de 10 s.
6. **On retire 151 voix** (a cappella). 7 morceaux n'ont que des voix : ils sortent de Samples.
7. **À décider par toi** : 5 sons parlés ou non musicaux (interviews, discours, nature, son de Windows) et 32 samples sur des pistes coupées.
8. **28 pochettes musicales fausses** à remplacer : 23 « SAMPLE 2 » et 5 boîtes « DayDreams ». **81 noms** à nettoyer (29 ont « André Navarro II » comme artiste).
9. Un test bloquera le retour de ces erreurs : voix, noms sales, pochette partagée, entrée hors du morceau.
10. À écouter par toi à la fin : une courte liste, environ 35 sons, en 3 groupes.

Légende : **prouvé** = mesuré sur le son ; **supposé** = déduit du projet seul ; **non vérifié** = ni l'un ni l'autre.

---

## A. Preuve par le son (étape 1)

### Méthode (lecture seule, rien joué sur les haut-parleurs)

- **Morceau publié** : lu en flux avec ffmpeg depuis la même adresse que le site (comme `fort.py`). Rien n'est enregistré, sauf des enveloppes de travail.
- **Sample** : le clip du projet, lu dans le fichier local, depuis son début (`s0`). On applique sa **vraie vitesse dans Ableton** (warp lu sur les marqueurs : `atempo`) et sa **transposition** (`asetrate`), puis on garde 10 s du morceau.
- **Comparaison** : énergie par bande de fréquence, 50 mesures par seconde, corrélation en Python pur. Trois variantes, et on garde la plus nette :
  - v1 : 6 bandes d'octave ;
  - v2 : « mini-rendu » de tous les clips du sample à leur place (samples hachés) ;
  - v3 : forme du spectre sur 12 demi-octaves, insensible au volume.
- **Score** `r` : 1 = identique, en dessous de 0,45 = trop faible pour conclure. `r(actuel)` et `r(corrigé)` = score à ±0,5 s de chaque valeur.
- **Mesuré** : 265 samples musicaux et 178 voix (≈ 260 morceaux). Le lot de preuve ci-dessous en retient 32.
- Scripts et résultats bruts : `/private/tmp/claude-501/-Users-infra-CODEX-APP-SITE-INFRA-/4d3252e5-95ef-4135-b302-475c78d3603a/scratchpad/plan_donnees/`, dans `als.py`, `corr*.py`, `merge.json`, `offsets.json` et `calage.json`. Le dossier est temporaire : copier `corr.py` et `corr3.py` dans `_outils/` au moment du lot.

### Échantillon de preuve (32 sons)

« Corrigé » = règle de l'audit (`at − début de l'export`). Les temps sont en secondes dans le morceau publié.

| # | Morceau | Sample | Actuel | Corrigé | **Son mesuré** | r (actuel → corrigé) | Verdict |
|---|---|---|---:|---:|---:|---|---|
| 1 | LAVERNA | Honest (boucle d'export) | 24,6 | 0,0 | **0,3** | 0,13 → 0,83 (max 0,84) | correction **prouvée** |
| 2 | LAVERNA | Gangsta Bitches (voix) | 43,1 | 18,5 | **18,5** | 0,09 → 0,43 | même décalage, prouvé à 0,1 s près (score faible) |
| 3 | SHKADOV | Vapor Frames | 40,9 | 0,0 | **0,4** | 0,26 → 0,98 (max 0,99) | **prouvée** |
| 4 | SHKADOV | R.I.P. Pop Smoke (voix) | 47,1 | 6,2 | **6,6** | −0,12 → 0,66 | **prouvée** |
| 5 | SI | Si l'on pouvait… (France Gall) | 21,1 | 0,0 | **0,0** | 0,34 → 0,65 | **prouvée** |
| 6 | SOLVABLE | Can't We Smile? | 28,4 | 0,0 | 0,0 | 0,07 → 0,38 | va dans le bon sens, **score faible** |
| 7 | WACK | 90s ambient IDMbreakbeat | 82,3 | 0,0 | — | 0,07 / 0,16 (max 0,22) | **non prouvé** (sample noyé ; version publiée peut-être antérieure au projet) |
| 8 | MAGGIORE | BGM #02 (haché, clips de 1,3 s) | 37,8 | 0,0 | — | max 0,16 | **non prouvé** ; la voix du même morceau entre à **0,0** (r 0,50) → correction probable |
| 9 | VENUS | She's No Memory | 19,5 | 0,0 | **3,3** | 0,08 → 0,69 (max 0,78) | **corrigé imprécis** : vrai = 3,3 |
| 10 | PHI | In Da Club (DJ Rashad) | 24,0 | 0,0 | **0,0** | 0,24 → 0,51 (max 0,58) | **prouvée** |
| 11 | MONETA | The Silence Between Dreams | 20,3 | 0,0 | **0,3** | 0,18 → 0,76 | **prouvée** |
| 12 | MIZUHANOME | Nexus On The Beach | 19,1 | 0,0 | **0,1** | 0,19 → 0,98 | **prouvée** |
| 13 | DELOS | Beach of the Pliocene | 18,7 | 0,0 | **0,1** | 0,41 → 0,96 | **prouvée** |
| 14 | JULABES | Aruarian Dance | 3,2 | 0,0 | **0,0** | 0,12 → 0,93 | **prouvée** |
| 15 | H | Marvellus | 24,9 | 0,0 | **0,0** | 0,30 → 0,87 | **prouvée** |
| 16 | GABIAN | Zanac X Zanac | 19,6 | 0,0 | 0,0 | 0,14 → 0,82 | **prouvée** |
| 17 | SUIJIN | Ideas For Virtual Reality (boucle) | 14,8 | 0,0 | **0,1** | 0,10 → 0,76 | **prouvée** |
| 18 | MICROGRAVITE | Taeko Ohnuki (boucle) | 21,3 | 0,0 | **0,1** | 0,11 → 0,85 | **prouvée** |
| 19 | FRAZIER | Where Lovers Walk | 163,8 | 141,2 | **142,3** | 0,08 → 0,40 (max 0,50) | prouvée **à 1 s près** |
| 20 | LUNE DE SANG | Glass Shutters (« probable ») | 26,8 | 5,1 | **5,1** | 0,01 → 0,55 | **prouvée** |
| 21 | CDM | Haaland (voix, « probable ») | 54,3 | 1,9 | **2,0** | 0,04 → 0,67 | **prouvée** |
| 22 | PANAREA | THUG LUV (voix, « probable ») | 195,2 | 168,5 | **168,5** | 0,24 → 0,81 | **prouvée** |
| 23 | PANAREA | Mai (voix, « probable ») | 26,8 | 0,0 | **0,0** | 0,08 → 0,58 | **prouvée** |
| 24 | **H-He** | 水の彩 | 3,3 | 0,0 | **3,2** | **0,88** → 0,04 | correction **fausse** : l'actuel est juste |
| 25 | SUPERNOVA | Star Stories | 14,8 | 2,9 | **0,0** | −0,04 → −0,10 (max 0,83) | ni l'un ni l'autre : vrai = **0,0** |
| 26 | OIZYS | Samadhi | 16,6 | 0,0 | **4,2** | 0,02 → 0,37 (max 0,54) | ni l'un ni l'autre : vrai ≈ **4,2** |
| 27 | HYDRA | ZÉ PEQUEÑA (piste coupée) | 50,5 | 25,2 | **10,6** | −0,02 → 0,31 (max 0,62) | ni l'un ni l'autre ; à écouter |
| 28 | VOSTOK 1 | For the Dragons (« projet ne correspond pas ») | 55,9 | — | **0,1** | 0,06 (max 0,83) | le son corrige là où le projet ne sait pas |
| 29 | HECATE | Searching The Stars (témoin) | 0,0 | 0,0 | 0,1 | 0,97 | actuel juste |
| 30 | Deux Tours | Nefertite (témoin) | 0,0 | 0,0 | 0,0 | 0,97 | actuel juste |
| 31 | VESTA | Keyser Söze (témoin) | 0,0 | 0,0 | 0,1 | 0,92 | actuel juste |
| 32 | CERISES · 14 | Dindi (piste coupée) | 0,0 | 0,0 | — | max 0,29 | rien trouvé : cohérent avec « pas entendu », **non prouvé** |

### Résultat sur tous les samples musicaux (265 mesurés)

| Cas | Nombre |
|---|---:|
| Pas de décalage, et le son confirme l'actuel | 115 |
| Décalage de l'audit **confirmé** par le son | **22** |
| Décalage de l'audit **faux** (H-He) | 1 |
| Ni l'actuel ni le corrigé : le son donne une 3e valeur (SUPERNOVA, OIZYS, HYDRA, PREGUNTAS…) | 5 |
| Projet « ne correspond pas » : le son tranche (VOSTOK 1, F = mω²r…) | 11 |
| Le son trouve le sample ailleurs, souvent une répétition plus nette de la boucle (pas une erreur en soi) | 25 |
| Ambigu (boucle répétée tôt : MISTRAL) | 1 |
| **Trop faible pour conclure** (sample filtré, haché, sous la voix) | **85** |

**Par morceau** : 63 morceaux ont au moins 2 sons nets qui donnent le même début d'export.

- 55 collent à la règle de l'audit, à 1 s près.
- 8 n'y collent pas : H-He, SUPERNOVA (+2,8 s), VOSTOK 1, NATA, COMETE, VOIR. Les autres sont des répétitions de boucle.

Le début de l'export vaut pour **tout le morceau**. Un seul son net suffit donc à corriger tous les samples du morceau, y compris ceux que la machine n'entend pas.

### Conclusion de l'étape 1

- **« at − début de l'export » est juste.** Prouvé sur 22 samples musicaux et 9 voix, dans des morceaux « sûrs » comme « probables ». LAVERNA : Honest entre à **0:00**, Gangsta Bitches à **0:18,5**.
- **Ce n'est pas suffisant seul.** Le début d'export que devine l'audit est faux ou imprécis dans environ 1 morceau sur 8 (H-He, VENUS, SUPERNOVA, OIZYS).
- **Le son seul ne suffit pas non plus.** Il ne tranche pas pour 85 samples sur 265 (32 %). Il trouve parfois une répétition plus tardive de la boucle au lieu de l'entrée.
- **Méthode retenue : les deux, avec contrôle croisé, par morceau puis par sample** (détail en B2).

---

## B. Plan de correction, outil par outil

Chaîne actuelle : `inventaire.py → liens.py → temps.py → publie.py → corrige.py`. S'y ajoutent `fort.py` et une étape **non sauvegardée** qui a ajouté `x`, `c` et `version: 2` à `samples.json` le 19/11 : elle n'existe dans aucun fichier. Il faut l'écrire (B4), sinon relancer `publie.py` **efface les extraits et les pochettes** du site.

### B1. `temps.py` v3 (lecture du projet)

1. **Pistes coupées** : ignorer les clips d'une piste dont le haut-parleur est coupé (`Mixer/Speaker/Manual = false`), ou dont un **groupe parent** est coupé (`TrackGroupId`, en remontant). Si tous les clips d'un son sont coupés, noter `muet: true` au lieu de publier.
2. **Copies consolidées** (« … [2026-05-09 005201].aif ») : les rattacher au son d'origine par le nom sans date. Leurs temps sont dans la copie : retrouver où la copie commence dans le fichier complet **par corrélation audio** (méthode de `calage.json`). Ensuite `s0 = début de la copie + s0 dans la copie`.
3. **Début de l'export, par morceau**, dans l'ordre :
   - boucle du transport (`Transport/LoopStart`), si sa durée = durée publiée à 1 s près ;
   - sinon le premier son non coupé, si « premier → dernier son » = durée publiée à 1,5 s près ;
   - sinon `inconnu`.
   - Sortie : `debut_export` et `source_debut` (boucle / premier son / inconnu).
4. **Automation de tempo** (1 seul cas, AIRE) : convertir les temps avec la courbe de tempo, pas avec le tempo fixe.
5. **Vitesse réelle du clip** (warp local) et transposition fine (`PitchFine`) : les sortir pour `cale.py`.
6. Sortie `temps.json` : garder `at_projet` (brut) **et** `at = at_projet − debut_export`, plus `muet`, `consolide`, `debut_export`.

### B2. Nouveau `cale.py` (contrôle par le son) — reprend `corr.py` et `corr3.py`

1. **Par morceau** : mesurer le début de l'export avec **tous** les clips nets du projet, samples et voix. Garder la médiane des valeurs qui s'accordent à 1 s près. Pour une boucle, prendre la **première** entrée forte (≥ 0,85 × le meilleur score), pas la plus forte.
2. **Par sample**, règle de décision :
   - projet et son d'accord (≤ 1,5 s) → `at` du projet, **sûr** ;
   - désaccord, son net (r ≥ 0,6, pas de 2e pic aussi haut) → `at` du son, **mesuré** ;
   - son faible, mais début d'export du morceau mesuré sur un autre son → `at` du projet recalé, **sûr par le morceau** ;
   - sinon → **à l'oreille** (liste pour INFRA).
3. Sortie `_outils/cale.json` : `{clé: {at, source, r, verdict}}`. Puis relancer `fort.py --tout` : ses clés contiennent `at`, donc l'ancien `fort.json` ne colle plus.
4. Durée : ~20 min pour tout (Python pur, 4 fils), sans réseau sauf la lecture en flux des morceaux. **Pas pendant qu'INFRA essaie le site** (même Mac).

### B3. Extraits R2 (`_private/samples-extraits/`)

Contrôle fait : chaque extrait local, au point `s0`, comparé au fichier utilisé dans le projet. **396 sur 441 au bon endroit (prouvé)**, 12 non contrôlables (fichier du projet absent), 33 douteux ou décalés.

À refaire (samples musicaux seulement) :

| Morceau | Sample | Problème | Preuve |
|---|---|---|---|
| 22 A 6 | Marvellus `H7FKf4e0IT8` | extrait **10 s trop tard** (fichier « cut » retéléchargé, autre début) | prouvé (r 0,95) |
| TELLER ULAM | Star Stories `vHCKLL2FlfY` | extrait **10 s trop tard** (même cause) | prouvé (r 1,00) |
| OYÁ | Wet Land `Z3m7HXeiHpg` | extrait 2 s trop tard (même cause) | prouvé (r 0,99) |
| VESTA | Keyser Söze `g9NuJ2ot9os` | +1,5 s (copie consolidée) | prouvé (r 0,90) |
| YOSHIMITSU | Rue Modeste 4 `tKQLKpjZ82k` | temps lus dans une copie consolidée | audit + contrôle faible |
| HECATE | Searching The Stars `dsRzAhE813U` | idem | audit + contrôle faible |
| ORANGE | It Be's That Way `1wSP7Gy-JEA` | idem (copie de 25 s) | audit + contrôle faible |
| Eau Claire | Daybreak `SXQdPbsLmuY` | idem (copie de 15 s) | audit + contrôle faible |
| PBB · NASCAR | Torn Apart `6s-wjQ7hx_0` | extrait d'une autre vidéo (`84MOZlcSln4_…`) | audit (nom de fichier) |

À vérifier ensuite : CONNECTE / LDC13 Connecté (HOURGLASS, mix d'une heure, r 0,37), MIEL SALIMATA (piste coupée), et les 12 sons dont le fichier du projet est absent (liste « autre fichier » de l'audit, B).

Correctif de `build-extraits.js` :

- le décalage d'un fichier « cut » se lit dans **le fichier réellement utilisé**, pas dans la copie retéléchargée ;
- refuser une source dont la durée diffère de celle notée dans le projet (le `.als` garde la durée exacte en échantillons).

Les nouveaux extraits prennent un **nouveau nom** (`<y>_<s0>-<s1>`). On n'écrase jamais un nom déjà sur R2 : le cache est « immutable ». Envoi : `upload-r2.sh` (reprend où il s'arrête). Les extraits des voix retirées restent sur R2 tant qu'INFRA n'a pas dit oui à leur suppression.

**Le recalage de `at` ne change aucun extrait** : `s0`/`s1` ne bougent pas, donc les noms restent.

### B4. `publie.py` v3 (écrit `samples.json` en entier)

1. N'écrit plus que la **musique** : on saute `type == 'voix'` et les `v: 1` de `corrections.json`. Les 151 voix sortent, ainsi que les 7 morceaux sans musique : ETNA, PHARMAKON, Co27, TAKEMIKASUCHI, BONHEUR, COMETE, Posé. La vue A cappella part (voir 4_INTERFACE).
2. Prend `at` dans `cale.json`, et `go` dans le nouveau `fort.json`.
3. Écrit lui-même `x` (depuis `extraits.json`), `c` (pochette présente) et `version: 2`. C'est l'étape manquante.
4. Exclut `muet: true` et la liste « retirés » validée par INFRA. Entrée tenue en dehors du code : `_outils/retires.json`, avec la raison de chaque retrait.
5. Puis `corrige.py` (noms), inchangé.

### B5. Sons à retirer

| Groupe | Nombre | Statut |
|---|---:|---|
| Voix (a cappella, raps) | 151 | demande d'INFRA → retirer |
| Non musicaux : « Lil' Kim and Luke Interview », « Alain Aspect : Intrication quantique… », « Un giorno in pretura » (Totò Riina, parlé), « 13 POLAR REGIONS » (WWF, nature), « The Microsoft Sound » (sans temps) | 5 | **à décider** (recommandé : retirer les 4 premiers ; Microsoft Sound retiré faute de temps) |
| Sans temps ni extrait : Remembrances… (CERISES), Laure (PECHES) | 2 | retirer, sauf si `temps.py` v3 les retrouve |
| Musique sur pistes toutes coupées (liste en annexe 2) | 32 | **à écouter** ; le son ne les retrouve pas, sauf HYDRA (r 0,62) et Chaire de poule V1/V2 (r 0,64-0,68) |
| CONTEMPLATION « Do it like me » (piste coupée, entrée après la fin du morceau) | 1 | retirer, sauf si INFRA l'entend |

### B6. Vidéos YouTube (lien « voir l'original »)

- La vidéo s'arrête avant le passage :
  - LIT, Iasos : passage à 15:00, vidéo de 6:10 ;
  - IEMANJA, Rue Modeste 4 : 1:14 pour 0:59 ;
  - PBB 500, Balloon in the City : 4:29 pour 2:35.
  - → trouver la version longue (vérification d'INFRA) ; sinon garder l'extrait et cacher « voir sur YouTube ».
- Introuvables : `-Musemesis-`, `d4VCHgL-uak` (Doja Cat), et A$AP Rocky (lié à une version instrumentale). Ce sont des voix : leur retrait règle le problème.

### B7. Pochettes (`public/assets/samples/<y>.webp`)

28 pochettes musicales fausses (après retrait des voix). Source à prendre, dans l'ordre :

1. **iTunes Search** (comme `covers2.js`, score ≥ 0,75) pour les disques connus ;
2. sinon la **miniature YouTube** : sur les chaînes de diggers (André Navarro II, Music for empty rooms, DUSTintheDNA), elle montre la pochette du disque ;
3. refuser toute image dont l'empreinte est celle de « SAMPLE 2 » (`12df58c8…`) ou de DAYDREAMS (`88a3748e…`).

| Image fausse | Sons (id) | Source proposée |
|---|---|---|
| « SAMPLE 2 » | `ZwMgu73F7rs` Djailau, `FxJeB70x9B0` Peaceful Things, `XMyhizr1DDI` Dindi, `l7SmgxHbEzo` Birds Fly So High, `3TmCDNGYUVY` Kōjōnotsuki, `Lxu2eWiYy7E` Laura, `1_yITt9c6Uo` Evening, `jwkWXDoAc9U` The Exoutic Touch, `pKu_goKfniE` Kuroi yuki, `gEWYrg7NB9o` Yorikos nightmare, `Z4WP4RH3_cg` Castillo De Arena, `UC3-56C7J-0` Here I Am | iTunes, sinon YouTube |
| « SAMPLE 2 » | `ntows0lXU1M`, `mFzTSeyDoC0`, `3RTGdx3Tjbo`, `v-W2qBPJwv8`, `Jmk_VvkKY1A`, `B42J1J9TRfY`, `oFUwYhHrSjw`, `tuvWF30UsyM`, `bwkWuwI4O9Y`, `jaFypbbIOuA` (André Navarro II), `BMWGqR2XLhk` (Music for empty rooms), `2OEtY6tDtlE` (DUSTintheDNA) | miniature YouTube |
| « SAMPLE 2 » | `tKQLKpjZ82k` Rue Modeste 4 (titre inconnu) | YouTube ; **à confirmer** par INFRA |
| DAYDREAMS | `HaFlz0dyxg0` LAKE EFFECT, `T2w3VLOarNY` FINAL DIVE, `Hb4bARgep3E` SENSORIUM, `6nGITYREWF4` VAPOR DRIVE, `org3q6kXgWc` HOURGLASS | miniature YouTube du mix |
| Partagées douteuses | `-Pr_5jyOqGY` / `4N6CCn71AqQ` ; `meKFPBUYQR4` / `tQRp0HpRcL0` | iTunes, sinon YouTube |

Les pochettes des voix retirées deviennent orphelines. Le test les signale déjà : on les supprime avec les voix (ménage de fin de lot, Git garde l'archive).

### B8. Titres et artistes (`corrections.json` + `corrige.py`)

Règles, appliquées par un script qui **propose**, puis écrites une à une dans `corrections.json` (clé = id) :

1. **Chaîne de digger en artiste** (« André Navarro II », « Music for empty rooms », « DUSTintheDNA », « mrthereismusic ») : le titre YouTube est « ARTISTE - Titre ». Couper au premier « - », mettre l'artiste en casse normale et enlever « [US] Gospel, Soul… (198?) ».
2. **« - Topic »** : à enlever de l'artiste (4 cas).
3. **Bruit dans le titre** : « ： », « :: », « Atmospheric DnB & Jungle », « Vinyl Rip », « 【PSX】 OST », « [Japan] Library… », « （） ».
4. **Numéro de piste** : à enlever seulement s'il vient du fichier (« 02 Sunshine… », « 03 - Time Station », « 10 Balloon… », « 13 POLAR… »). On garde les vrais titres : « 5 STARS », « 78 Rotações », « 7 sur 7 », « 49.3 ». L'audit les signalait à tort.
5. **Artiste vide** (≈ 35 sons musicaux) : tags du fichier, puis chaîne « - Topic », puis recherche. Sinon « Artiste inconnu », jamais vide.

Liste complète des 81 sons musicaux concernés : annexe 1.

### B9. Test automatique (`tools/test-samples.js`, ne lit que `public/` : pas de dépendance au Mac)

Ajouter des contrôles qui **font échouer** le test :

- aucun `v` (plus de voix) ; chaque son a `at`, `s0`, `s1`, `x` et `c` ;
- `at` + 2 s ≤ durée du morceau ; `go` ≥ `at` ;
- `x[i][0]` commence par l'id `y` du son (fin de l'exception NASCAR) ;
- artiste non vide ; refus de `- Topic`, des chaînes de diggers connues, de `：`, `::`, `Vinyl Rip`, `Atmospheric DnB` et de `^0\d[ -]` dans les titres ;
- pochettes : interdire les empreintes « SAMPLE 2 » et DAYDREAMS. Une même image pour deux artistes différents = erreur (liste d'exceptions pour un même album, ex. Ele A).

Vider la liste `KNOWN` (D4) au fur et à mesure.

Contrôle local en plus, **hors test du site** (il lit le Mac) : `_outils/verifie.py`, lancé avant chaque publication.

- `samples.json` doit correspondre à `cale.json` (même `at` à 0,1 s près) ;
- aucun `verdict: oreille` non validé ;
- chaque extrait doit être recalé sur son fichier (`calage.json`).

---

## C. Ordre, risques, oreille d'INFRA

**Ordre**

1. Questions à INFRA (QCM ci-dessous).
2. `temps.py` v3.
3. `cale.py` → `cale.json`, puis `fort.py --tout`.
4. Extraits à refaire + `build-extraits.js` corrigé.
5. Pochettes.
6. `corrections.json`.
7. `publie.py` v3 → `corrige.py`.
8. Tests.
9. Liste d'écoute.
10. **Commit seulement après le oui d'INFRA.**

**Risques**

- Un commit local part en ligne (leçon du 19/11) : rien n'est commité avant le oui.
- Relancer `publie.py` tel quel efface `x` et `c` : il faut B4 d'abord.
- `fort.json` indexé par `at` : à refaire en entier.
- Projets modifiés après l'export (WACK, AIRE, AMIATA, H2o…) : ni le projet ni le son ne sont sûrs → oreille.
- Mesures longues : jamais pendant qu'INFRA essaie le site.

**Ce qui demande l'oreille d'INFRA (≈ 35 sons, 3 groupes)**

1. **Entrées non prouvées des morceaux décalés** (≈ 12) : WACK, MAGGIORE, SOLVABLE, PANAREA Menu, AMIATA, STROMBOLI, SEREIA DO MAR, ESENGO, FLEXIBLE, HYDRA, OIZYS, Houston.
2. **Pistes coupées** (32, annexe 2) : on garde le son seulement s'il s'entend dans ton morceau.
3. **Sons non musicaux** (5) et **Rue Modeste 4** (titre et pochette inconnus).

**QCM (recommandé en premier)**

- Voix : A) toutes retirées de Samples · B) gardées ailleurs.
- Sons parlés et nature (5) : A) retirés · B) gardés.
- Pistes coupées non entendues : A) retirées · B) gardées si le son est dans le projet.
- Extraits des voix sur R2 : A) laissés (aucun coût visible) · B) supprimés.

**Prouvé / supposé / non vérifié**

- **Prouvé** (son) :
  - décalage confirmé pour 22 samples et 9 voix ;
  - 1 correction fausse (H-He) et 4 imprécises ;
  - 396 extraits au bon endroit, 4 décalés (10 s, 10 s, 2 s, 1,5 s).
- **Supposé** (projet seul) :
  - les 85 samples où le son est trop faible ;
  - le statut « pas entendu » des pistes coupées ;
  - les 5 copies consolidées (cause lue dans le projet, contrôle audio faible).
- **Non vérifié** : écoute humaine, pochettes à l'œil, vrai iPhone.

---

## Annexe 1 — 81 sons musicaux à renommer

| id | Titre actuel | Artiste actuel | Problème |
|---|---|---|---|
| `gMIcmHcRfxQ` | Today I Taught Them How To How To Skip Stones Across the Lake |  | artiste vide |
| `SBiwLibZqfw` | OM Chanting @ 432 Hz |  | artiste vide |
| `m1x3ujfF8qk` | Deadly Arts ost： Gouriki Stage Theme |  | artiste vide, titre sale |
| `g9NuJ2ot9os` | La légende de Keyser Söze |  | artiste vide |
| `I2ScPfzh474` | Juan Carlos Núñez・Jose Ignacio Cabrujas ⧸ Epilogo |  | artiste vide |
| `2I6bUkAzBvE` | Sierra On line ： Glass Shutters |  | artiste vide, titre sale |
| `tKQLKpjZ82k` | Rue Modeste 4 |  | artiste vide |
| `HaFlz0dyxg0` | LAKE EFFECT ：： Atmospheric DnB & Jungle ：： |  | artiste vide, titre sale |
| `T2w3VLOarNY` | 2K Atmospheric DnB | FINAL DIVE | titre sale (titre/artiste inversés) |
| `OeZ_63iKPho` | Alain Aspect ： Intrication quantique… |  | artiste vide, titre sale (parlé : B5) |
| `6bghDcbzfEU` | Tape 05 |  | artiste vide |
| `v5NwLLDTp-U` | Zanac X Zanac 【PSX】 OST 11 snowfield story |  | artiste vide, titre sale |
| `yzll20dmfvM` | Asa No Meisou |  | artiste vide |
| `2z2nzne8fFQ` | Time after time |  | artiste vide |
| `vfQXVJlovyQ` | Congo Brazzaville |  | artiste vide |
| `4WtDUkK_PXE` | The Silence Between Dreams And Tomorrow |  | artiste vide |
| `zvaZ5frxOys` | Zeytuni Zar |  | artiste vide |
| `w9K-tMIfSzA` | Kamananga Ka Sebajura, berceuses |  | artiste vide |
| `Hb4bARgep3E` | SENSORIUM EP ：： Atmospheric DnB & Jungle |  | artiste vide, titre sale |
| `GqeaFVsz30w` | 03 - Time Station | Ape Escape Soundtrack | numéro de piste |
| `6UuE01lrkco` | Move Me |  | artiste vide |
| `1c19LDcRyZ0` | Do it like me - Yurufuwa Gang |  | artiste vide (artiste dans le titre) |
| `6nGITYREWF4` | VAPOR DRIVE Atmospheric DnB & Jungle |  | artiste vide, titre sale |
| `ixcM4SQoC3w` | Beach of the Pliocene Vinyl Rip - Huappy Spins | Ken Ichiro Isoda | titre sale |
| `ZAbzCRayymw` | Bloop Vinyl Rip |  | artiste vide, titre sale |
| `U2A4toBXVLA` | Taeko Ohnuki Inori 1983 |  | artiste vide (artiste dans le titre) |
| `vHCKLL2FlfY` | Star Stories (Super Mario Galaxy) Vinyl Rip |  | artiste vide, titre sale |
| `enHG2yiPNHY` | Lost In The Sky - 𝕊𝕖𝕝𝕧𝕒𝕥𝕚𝕔𝕒 | Tim Stebbing | titre sale |
| `IZE8gZQMba0` | River Master Ultimate Vinyl Rip |  | artiste vide, titre sale |
| `RRSOo88_jBk` | O TERÇO - Ponto final | André Navarro II | chaîne en artiste |
| `DXkwiLCSc-A` | TRANQUILA - Juicy BAE |  | artiste vide |
| `org3q6kXgWc` | HOURGLASS Atmospheric DnB & Jungle |  | artiste vide, titre sale |
| `jDuRSyU99cU` | Lil' Kim and Luke Interview |  | artiste vide (parlé : B5) |
| `QnAwfzWqJEI` | DAYDREAMS CARTRIDGE :: Atmospheric DnB & Jungle :: | arcologies | titre sale |
| `8HR95q_40CE` | Four Post Cards | Hiroshi Yoshimura 吉村 弘 | titre sale (à revoir) |
| `tb5RzAcbC2A` | Jerry Smith His Name Is Jesus |  | artiste vide |
| `9YiMRk6bAOo` | TAKE U DEA - SALIMATA |  | artiste vide |
| `g6pNqG3b-GY` | Curiosa - Alaï |  | artiste vide |
| `8mB38-iyScY` | Take It Up - Remix - DEELA |  | artiste vide |
| `SVNMRhjbDO4` | 5 STARS | LE JUIICE - Topic | « - Topic » (garder « 5 STARS ») |
| `zybL_RaGwLM` | 水の彩 【榊原光裕】 | FX1able | titre sale, artiste = chaîne |
| `V7Fkg5Lfr-E` | 安西史孝 Fumitaka Anzai - 樹魔・伝説 トラック_05再生 [Japan] Library, Psych Ambient | Music for empty rooms | chaîne en artiste, titre sale |
| `ntows0lXU1M` | MITSURU ONO & THE SWING BEAVERS - Rain | André Navarro II | chaîne en artiste |
| `Ga34G_sKyzs` | Sounds of Solaris |  | artiste vide |
| `BMWGqR2XLhk` | Roland Gresham - The Touch Of The Master's Hand [US] Gospel, Soul, Disco (198?) | Music for empty rooms | chaîne en artiste, titre sale |
| `rRgE6uAcjd8` | JIRO YANAGAKI - Breeze | André Navarro II | chaîne en artiste |
| `ocNoZlNgBfw` | 10 Balloon in the City |  | artiste vide, numéro de piste |
| `ugEJzZsDczc` | Jacques André - L'étoile + Dors, 1973 - track "Dors" | mrthereismusic | chaîne en artiste |
| `HzZps8kSQaw` | Tim Boyles - Slow Walkin | DUSTintheDNA | chaîne en artiste |
| `yymQaMrb2VA` | 02 Sunshine Of Your Love |  | artiste vide, numéro de piste |
| `tQRp0HpRcL0` | Another Time, Another Place (Remastered 2005) | Earl Klugh - Topic | « - Topic » |
| `mFzTSeyDoC0` | ALBERTO BALDAN BEMBO - Trop's | André Navarro II | chaîne en artiste |
| `JEpxF9Aw5a4` | JEREMY STEIG - Home | André Navarro II | chaîne en artiste |
| `uznf_Uq6mX8` | Summer Sound | Joe & Bing - Topic | « - Topic » |
| `A9GlyE7Z7IQ` | Remembrances... | Federico Dubbini - Topic | « - Topic » (sans temps : B5) |
| `X6s5fZCStSY` | 78 Rotações | Jards Macalé | rien à changer (vrai titre) |
| `r4RuaOX7HS0` | RIOLAND & GOLDFEDER - Tension | André Navarro II | chaîne en artiste |
| `3RTGdx3Tjbo` | THE BRIAN BENNETT BAND - Clearing skies | André Navarro II | chaîne en artiste |
| `JEGMCyEvgj0` | OM - Samarkand | André Navarro II | chaîne en artiste |
| `zoD5h5UuAyI` | YOSUI INOUE - Slope | André Navarro II | chaîne en artiste |
| `niW3LE1FRys` | EDDY LOUISS - Colchiques | André Navarro II | chaîne en artiste |
| `LyavSdeIG70` | JIRO INAGAKI & HIS SOUL MEDIA - Joie de vivre | André Navarro II | chaîne en artiste |
| `1J1BXAZQWRk` | DAVID HORN & RODNEY ALEXANDER - Walk These Streets | André Navarro II | chaîne en artiste |
| `NPn2x2CAfic` | CHARLES KYNARD - Lime twig | André Navarro II | chaîne en artiste |
| `2OEtY6tDtlE` | Rudi Berger & Peter Mutter - Jazz Improvisation (Karin's Tune) | DUSTintheDNA | chaîne en artiste |
| `tiLyN7MKSgQ` | TRANZAM - Morning | André Navarro II | chaîne en artiste |
| `l8ulo93QqwE` | GEORGIAN TVR ENSEMBLE - Swing | André Navarro II | chaîne en artiste |
| `luKTMiG03ag` | FRANÇOISE HARDY - Oui, je dis adieu | André Navarro II | chaîne en artiste |
| `bGRB-g_ElGA` | THE UNDISPUTED TRUTH - Take a vacation from life (And visit your dreams) | André Navarro II | chaîne en artiste |
| `2WEzwev45YM` | SUISHO TOSHA & NORIO MAEDA - Concerto for Shino Flute and Rock Band - Second movement | André Navarro II | chaîne en artiste |
| `a4V2enqGjSI` | GIALMA 3 - Gialma | André Navarro II | chaîne en artiste |
| `v-W2qBPJwv8` | LILY - So long | André Navarro II | chaîne en artiste |
| `Jmk_VvkKY1A` | KAYOKO ISHU - La leçon particulière | André Navarro II | chaîne en artiste |
| `B42J1J9TRfY` | YUSAKU MATSUDA - Sutorippā no komori-uta | André Navarro II | chaîne en artiste |
| `psr9S8iV-j8` | PATRICK VASORI - Novembre | André Navarro II | chaîne en artiste |
| `wyDZr_iPbUY` | ETHEL BEATTY - I know you care | André Navarro II | chaîne en artiste |
| `oFUwYhHrSjw` | I MARC 4 - Jeane | André Navarro II | chaîne en artiste |
| `tuvWF30UsyM` | NAOKO TSUBOTA - Aru mono wa ki kara ochita | André Navarro II | chaîne en artiste |
| `bwkWuwI4O9Y` | AKAI TORI - Red flower white flower | André Navarro II | chaîne en artiste |
| `Dsu3wGVf1dc` | 13 POLAR REGIONS |  | numéro, artiste vide (nature : B5) |
| `jaFypbbIOuA` | TAKEO WATANABE & YUSHI MATSUYAMA - Shinrai no kizuna | André Navarro II | chaîne en artiste |

## Annexe 2 — 32 samples musicaux sur des pistes toutes coupées (à écouter)

MARSELHA Só · H2o Le Singe · CONTEMPLATION Do it like me · HYDRA ZÉ PEQUEÑA · MORPHEA O Ga Ju · ANTARES Martona · AMORE O Terço · JOLIE Feasing · MIEL SALIMATA · CHIAPAS TRANQUILA · FRAZIER Jerry Smith · INVESTISSEMENT Zona D'Ombra · INVESTISSEMENT Hurry up Tomorrow · NEIGE Cortège · BLEU TAKE U DEA · GIGGS El-Hadra · GIGGS Take It Up · POURPRE 5 STARS · COMMENT ON FAIT Non Factor · Puedo Retrato · 14 Dindi · VOIR Clearing skies · Domicile Jazz Improvisation · Moteur Wall St Underwater · Pilote Gialma · Chaque jour de plus Sutorippā · OUI Eulalia · Eau Claire Daybreak · Camelia Honey · Chaire de poule V1 et V2 Red flower white flower · Mot Doux Leque.
