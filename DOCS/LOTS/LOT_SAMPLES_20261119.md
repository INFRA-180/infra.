# Lot Samples, Mix, Acapella, Crédits : registre (19/11/2026)

Demandes d'INFRA du 19/11 après la v468. Rien n'est codé pour l'instant.
Ordre de travail voulu par INFRA :
1. arborescence et Git ;
2. ce registre ;
3. vérifier le code local ;
4. regarder sur le web comment font les autres ;
5. proposer une maquette ou un point, à valider ensemble ;
6. patch.

Statuts possibles : ouvert · maquette · validé · fait · reporté.

## A. Décisions d'INFRA (validées, à appliquer)

| # | Demande | Statut |
|---|---|---|
| A1 | Gris trop pâles (numéros, durées, onglets non choisis) : les passer au **noir**. | validé |
| A2 | Lignes d'album sur ordinateur trop hautes : libre à l'agent de changer. | ouvert (choix agent) |
| A3 | Favoris sur ordinateur (colonne étroite) : libre à l'agent de changer. | ouvert (choix agent) |
| A4 | Premier Play à froid (Radio ou ordre de l'album) : INFRA n'a pas d'avis. L'agent propose. | ouvert (proposition) |
| A5 | Ordre des sections : **Samples · Mix · Acapella** (Mix avant Acapella). | validé |

## B. Lecteur Samples (sample classique)

| # | Demande | Statut |
|---|---|---|
| B1 | Afficher **quelle section** du morceau a été samplée (ex. Marjolaine : on voit le sample, pas la partie). | ouvert |
| B2 | Montrer **quand le sample commence dans le morceau** d'INFRA, avec un repère sur la barre. | ouvert |
| B3 | Bouton **« Aller au morceau »** qui ouvre ou lance le morceau à cet endroit. | ouvert |
| B4 | Quitter le lecteur Samples **en glissant vers le bas**, comme le grand lecteur. | ouvert |
| B5 | Au clic sur un album, ne pas lancer d'office un sample : **laisser choisir le morceau** d'abord. | ouvert |
| B6 | À garder : la liste « À suivre », le morceau lié et le **BPM** (jugés très utiles). | validé |
| B7 | Revoir toute la « politique de sample » : quoi montrer, dans quel ordre, de façon **hyper lisible**. | maquette |

## C. Mix (transitions)

| # | Demande | Statut |
|---|---|---|
| C1 | Les transitions sont **coupées**. Il faut une vraie transition, un fondu enchaîné réel, pas un saut. | ouvert |
| C2 | Le Mix est jugé **plus lisible** que Samples : s'en inspirer pour Samples. | validé |

## D. Acapella et données

| # | Demande | Statut |
|---|---|---|
| D1 | Vérifier qu'il ne reste **aucune voix seule** dans la section Samples ni dans la playlist Spotify créée par l'agent. | ouvert |
| D2 | Au pire, créer une **playlist Acapella à part** pour séparer les deux. | ouvert |
| D3 | Acapella plus clair : montrer **quand la voix entre** dans le morceau (les données existent). | ouvert |
| D4 | CONTEMPLATION : l'entrée du sample tombe après la fin du morceau. 3 samples n'ont aucun temps. Corriger les données. | ouvert |
| D5 | Envoyer plusieurs agents pour **séquencer** les samples (sections, temps d'entrée) à partir des infos existantes. | ouvert |

## E. Nouvelle section Crédits

| # | Demande | Statut |
|---|---|---|
| E1 | Ajouter une dernière catégorie **Crédits** : pour chaque morceau, le logiciel, l'ordinateur et le lieu quand on les a. | maquette |

## F. YouTube (téléphone surtout)

| # | Demande | Statut |
|---|---|---|
| F1 | **Pas de pub YouTube** sur téléphone : chercher une vraie solution. Limite connue : l'iframe officielle ne permet pas de bloquer les pubs. Pistes : `youtube-nocookie`, sources propres (R2), extraits hébergés. Vérifier ce que les règles de YouTube autorisent. | ouvert (recherche web) |
| F2 | Au lancement d'un sample, la vidéo reste **en pause** : elle doit démarrer seule. Déjà demandé. | ouvert |
| F3 | Le **lecteur YouTube ne doit pas être affiché** (lecture invisible). Déjà demandé. | ouvert |

## G. Méthode

- Rien n'a été essayé sur un vrai iPhone.
- Chaque nouvelle phrase d'INFRA s'ajoute ici avant de coder ; la liste entière est renvoyée à chaque ajout.
- Le lot est fini quand tout est fermé ou reporté. La sauvegarde du site se fait après l'implémentation (`BACKUPS/`).

## H. Recherche web (19/11, agent web)

- YouTube intégré : interdit de bloquer les pubs, de cacher le lecteur (min. 200×200, visible) ou de séparer le son. youtube-nocookie garde les pubs. La plupart des titres samplés sont réclamés par des labels, donc des pubs sont possibles.
- iPhone : `setVolume` sur une iframe ne fait rien, donc aucun vrai fondu possible avec YouTube. La lecture automatique échoue quand `playVideo` arrive après un délai ou sur un lecteur chargé après le toucher.
- Piste n° 1 : extraits Apple de 30 s (iTunes Search API, `previewUrl`, CORS ouvert, gratuit, sans compte), lus en Web Audio : sans pub, cachés, vrais fondus. Il faut un lien Apple Music à côté. Limite : Apple choisit les 30 s, ce n'est pas forcément le passage samplé.
- Piste n° 2 : Deezer (30 s, les liens expirent). Spotify : à écarter (plus d'extraits depuis le 27/11/2024).
- Héberger soi-même des extraits : risque de droits d'auteur, déconseillé.

## I. Vérification du code local (19/11, agent code)

- Données : 422 samples. 419 ont le passage source (`s0`/`s1`) et la seconde d'entrée dans le morceau (`at`). Il n'existe aucun libellé de section : on l'affichera comme « passage 1:12 → 1:20 ». 45 samples sont sans artiste.
- À corriger : CONTEMPLATION (`at` 152,7 s pour un morceau de 125 s) ; MARSELHA (titre et artiste inversés, sans temps) ; « Remembrances » (CERISES) et « Laure » (PECHES) sans temps.
- Crédits : aucune donnée (logiciel, ordinateur, lieu). Il faudra qu'INFRA les donne, ou les lire dans les projets Ableton.
- Voix : seul le champ `v` les détecte. Une vingtaine de raps complets ne sont pas marqués (Kendrick, Jul ×5, Freeze ×2, 2Pac…). Deux chemins mélangent voix et samples dans la liste et dans le lien YouTube (`samples.js` 823-826 et 1845).
- Pause au lancement : la page ne relance jamais `playVideo` quand le lecteur est prêt, et sur iPhone le toucher ne passe pas dans l'iframe YouTube.
- Mix coupé :
  - iPhone : aucun fondu possible, on coupe sec.
  - Ordinateur : le lecteur suivant est déclaré prêt trop tôt et ramené en arrière au moment du fondu ; le fondu ne dure qu'1 s.
- Clic sur un album : le premier sample part d'office (`samples.js` 1818-1834).
- Glisser vers le bas : déjà écrit dans le grand lecteur (`transport-builder.js` 375-600), à réutiliser avec une zone de prise hors vidéo.
- Ordre des onglets : `samples.js` 558-567.

## J. Proposition (à valider)

1. Applicable sans autre choix :
   - gris → noir ;
   - onglets Samples · Mix · Acapella ;
   - glisser vers le bas ;
   - clic sur un album → liste des morceaux, rien ne démarre ;
   - pour chaque sample, afficher « passage x → y de l'original, entre à z dans ton morceau » avec un repère sur la barre et un bouton « Aller au morceau » ;
   - voix jamais mélangées aux samples ;
   - lignes d'album et Favoris resserrés sur ordinateur.
2. Choix de la source du son (le cœur du lot) :
   - (a) **mixte, recommandé** : extraits Apple de 30 s en Web Audio pour l'écoute et les fondus (sans pub, caché, démarre seul), plus un bouton « Passage exact sur YouTube » visible ;
   - (b) YouTube seul, visible, avec pubs et coupures sur iPhone ;
   - (c) héberger ses propres extraits du passage exact : parfait techniquement, mais risque de droits d'auteur.
   - Limite de (a) : Apple choisit les 30 s, ce n'est pas le passage samplé.
3. Voix non marquées : déplacer les ~20 raps complets vers Acapella, liste à valider.
4. Crédits : INFRA donne logiciel, ordinateur et lieu par album, ou l'agent lit les projets Ableton.

## K. Réponse d'INFRA (19/11)

- Apple : **refusé**.
- Règles YouTube : sans importance, usage perso, rien à vendre. On peut cacher le lecteur.
- Question d'INFRA : pourquoi « coupé » alors que le fondu marchait hier ? Réponse : le fondu marche sur Mac. Sur iPhone, Apple bloque le réglage du volume d'une vidéo YouTube, donc on coupe sec. C'est une limite de l'iPhone, pas une règle de YouTube.
- Pubs sur iPhone : au pire, INFRA utilisera Brave. Demande : un bloqueur de pub iPhone qui marche partout (à vérifier sur iPhone).
- Reste à choisir :
  - (a) YouTube amélioré : caché, se relance tout seul, fondus réparés sur Mac, coupes sur iPhone ;
  - (b) extraits du passage exact sur R2, déjà en place pour la musique : vrais fondus partout, sans pub. Le site est public, donc les extraits le seraient aussi.

## L. Décision d'INFRA (19/11) : extraits sur R2, YouTube en secours — validé

- Poids estimé : 477 passages tirés de 390 vidéos, soit environ 4 h 10 de son, 5 h 10 avec 4 s de marge de chaque côté pour les fondus.
  - 128 kbps : ≈ 290 Mo ; 192 kbps : ≈ 440 Mo ; 256 kbps : ≈ 580 Mo.
  - Pochettes (390, 600 px) : ≈ 30 Mo.
  - Tout tient dans l'offre gratuite de R2 (10 Go).
- Sources : les fichiers locaux d'INFRA. Emplacement à confirmer.
- Pochettes : d'abord les métadonnées du fichier, sinon le web (pochette de l'album, puis miniature YouTube).
- YouTube reste en secours, et en lien « voir l'original ».
- Étapes :
  1. inventaire des fichiers locaux ;
  2. découpe des passages (s0 − 4 s → s1 + 4 s) ;
  3. pochettes ;
  4. envoi sur R2 via le Worker audio ;
  5. lecteur Web Audio avec vrais fondus ;
  6. secours YouTube.
- Qualité choisie par INFRA : **très bonne (256 kbps, ≈ 580 Mo)**. On pourra convertir plus léger plus tard. Pochettes en WebP.
- Pistes pour trouver les originaux, d'après INFRA :
  - projets Ableton (sûr pour les récents) ;
  - `Music/Sample Loop` ;
  - un vieux dossier de rangement dans `Music` ;
  - dossiers Soulseek.
  - Les introuvables pourront être téléchargés via INFRA_SEEK.

## M. Plan de recherche et de fabrication (19/11)

1. **Recherche (5 agents, lecture seule)** :
   - Ableton : lire les projets pour savoir quel fichier chaque morceau utilise et quel passage ;
   - Sample Loop et SAMPLE DIVERS ;
   - Soulseek et INFRA_SEEK ;
   - le reste de `Music` et l'iTunes, avec le vieux dossier de rangement ;
   - le reste du disque, plus les outils.
   - Résultats dans le dossier temporaire de la session, rien n'est déplacé.
2. **Croisement** : un fichier retenu par original (le plus long et le plus propre), avec un score de confiance. Liste des manquants.
3. **Manquants** : téléchargement par INFRA_SEEK, ou yt-dlp en dernier recours. **Seulement après le oui d'INFRA.**
4. **Calage** : `s0`/`s1` sont des temps de la vidéo YouTube. Un fichier local peut être décalé (intro, version différente). On recale avec le passage lu dans le projet Ableton, sinon par comparaison du son.
5. **Découpe** : passage de s0 − 4 s à s1 + 4 s, en AAC 256 kbps (`.m4a`, lu partout, iPhone compris), avec un fondu très court aux bords. Une seule copie par passage.
6. **Pochettes** : celle du fichier, sinon le web (album), sinon la miniature YouTube. Converties en WebP 600 px.
7. **Envoi sur R2** par le Worker audio, chemin `samples/<id>.m4a`. Les originaux restent sur le Mac. La limite par visiteur s'applique.
8. **Lecteur** : Web Audio avec de vrais fondus, iPhone compris, démarrage au toucher, rien d'affiché. YouTube reste en secours si un extrait manque, plus le lien « voir l'original ».
9. Vérifier sur le site en ligne, puis faire une sauvegarde.

## N. Bilan de la recherche des originaux (19/11, 5 agents, lecture seule)

- **387 sur 390 trouvés sur le Mac** : 368 sûrs, 19 à vérifier (extrait coupé, fichier plus court que le passage, ou rapprochement faible). 223 ont été trouvés par plusieurs agents.
- Formats : 133 FLAC, 131 WAV ou AIFF, 122 MP3, 1 M4A.
- Où :
  - Sample Loop (souvent avec l'identifiant YouTube dans le nom) ;
  - Soulseek (FLAC) ;
  - SAMPLE DIVERS/SAMPLE PERDU ;
  - iTunes/Compilations/SAMPLE 2 ;
  - projets Ableton (fichiers déplacés retrouvés par leur nom) ;
  - Téléchargements/MEDIA (3).
- **Manquants (3)** : Emerald Web « Aqua Regia (Side B) », « Sounds of Solaris », « 13 POLAR REGIONS ». À télécharger après le oui d'INFRA.
- Calage : sur 342 originaux dont le passage est lu dans Ableton, 297 commencent au même endroit que `s0` (à 1,5 s près). Les temps du site correspondent donc déjà aux fichiers locaux. Les ~45 autres sont à vérifier (plusieurs clips, version différente).
- Fichiers de travail (temporaires) : `manifest.json` (1 fichier par original), `weak.json`, `missing.json`, dans le dossier temporaire de la session. Copiés dans `_private/samples-extraits/` (non publié).
- Les .als : ~6 800, dont 5 739 sauvegardes automatiques d'Ableton ; ~700 vrais projets. Plus ancien projet repéré : « Ballade en forêt », 12/11/2020, Live 10.1.4.

## O. Demande d'INFRA (19/11) : remettre dans les projets Ableton les fichiers manquants, identiques

- Fait : les 3 manquants ont été téléchargés depuis la vidéo YouTube d'origine (`_private/samples-extraits/sources/`).
- Demande : remettre dans les projets Ableton les fichiers qui manquent, **exactement les mêmes** (même début, même calage).
- Faisable : chaque projet garde le chemin, la taille et la durée exacte (en échantillons) du fichier. On peut donc prouver qu'un fichier est identique.
  - Cas 1 : fichier présent ailleurs sur le Mac, même nom et même taille. C'est le même fichier, le calage est parfait.
  - Cas 2 : fichier absent, re-téléchargé. On contrôle la durée exacte ; si elle diffère, le calage peut être décalé de quelques millisecondes, à signaler projet par projet.
  - Les anciens chemins visent `iTunes/Music/...`, la bibliothèque Music, qui est en lecture seule. Proposition : un dossier « Fichiers retrouvés » ; Ableton les retrouve seul via « Rechercher », sans modifier les .als.
- **Statut : à faire après le oui d'INFRA, car on écrit dans les dossiers Ableton.**

## P. Fabrication locale des extraits (19/11), dans `_private/samples-extraits/`, non publié

- **446 passages sur 446 découpés** : AAC 256 kbps (`aac_at`), de s0 − 4 s à s1 + 4 s, fondu de 30 ms aux bords. **512 Mo.**
- Sources :
  - fichiers locaux ;
  - 3 originaux manquants téléchargés en entier ;
  - 3 passages pris au milieu de longs mix YouTube, téléchargés seulement sur la partie utile.
  - Les fichiers « [cut-hh-mm-ss] » de Sample Loop sont des bouts de vidéo : leur début sert de décalage, le calage est exact.
- **Pochettes 387/387**, WebP 600 px, 15 Mo :
  - 271 tirées des fichiers ;
  - 29 pochettes officielles d'album (Apple), à regarder une fois ;
  - 87 images YouTube.
- **Calage** :
  - 359 originaux confirmés (même durée que la vidéo YouTube, découpe, ou passage confirmé par le projet Ableton) ;
  - **28 à vérifier à l'oreille** (`calage_a_verifier.json`).
- À écouter : Action Bronson « Vega » (passage presque silencieux, sans doute décalé) et « Rue Modeste 4 » (très faible, fichier douteux).
- 54 vidéos YouTube n'ont pas répondu : indisponibles, bloquées par un label, ou limite de YouTube atteinte. Le secours YouTube ne marchera pas pour certaines : un argument de plus pour R2.
- Scripts : `build-extraits.js`, `fix.js`, `covers2.js` (dans `_private`).

## Q. En ligne (19/11) : v469, `c8cd50a`, déploiement réussi

- Lecteur Web Audio avec les extraits R2 : F1, F2 et F3 faits (sans pub, démarrage seul, pas de vidéo). C1 fait : vrais fondus.
- Vérifié sur le site en ligne en headless (WebKit, mobile et ordinateur) : le son démarre et la pochette s'affiche. **iPhone réel non essayé.**
- Reste du lot :
  - A1 gris → noir ; A2 lignes d'album ; A3 Favoris ; A5 onglets Samples · Mix · Acapella ;
  - B1 à B5 : section samplée, repère d'entrée, « Aller au morceau », glisser vers le bas, pas de lancement automatique au clic sur un album ;
  - D1 à D4 : raps non marqués comme voix, données à corriger ;
  - E1 : Crédits ;
  - 28 calages à écouter ;
  - remise des fichiers dans Ableton (attend le oui d'INFRA).

## R. En ligne (19/11) : v470, `421c1fd`

- Le 1er déploiement a échoué à cause d'un incident GitHub (artefact introuvable) ; relancé, réussi.
- Faits et vérifiés sur le site en ligne :
  - A1 numéros et durées en noir ;
  - A5 onglets Samples · Mix · Acapella ;
  - B1 passage samplé ; B2 entrée dans le morceau (texte, sans repère sur la barre) ; B3 « Aller au morceau » ;
  - B4 glisser vers le bas ; B5 album ouvert sans lecture.
- Reste :
  - A2 lignes d'album ; A3 Favoris ;
  - D1 à D4 : raps à classer en Acapella, données ;
  - E1 Crédits ;
  - 28 calages à écouter ;
  - fichiers à remettre dans Ableton (attend le oui) ;
  - iPhone réel.

## S. v471-472 en ligne (20/11/2026)

- Poussé 5b77d2b, déploiement vert.
- Site en ligne, réseau lent simulé : le son démarre tout de suite (lecture en flux).
- Télémétrie : `samples_open` et `samples_section` reçus par le serveur (réponse 204).
- Non vérifié sur un vrai iPhone.

## T. Demande d'INFRA (20/11) : page Mix façon Spotify, pictos — brainstorming, rien codé

| # | Demande | Statut |
|---|---|---|
| T1 | Une **page Mix** comme la nouvelle version de Spotify : on lance, ça enchaîne **avec transitions**. | ouvert (idées) |
| T2 | **Pictogrammes** à la place des mots « Samples / Mix / A cappella » (ex. micro pour A cappella) ; le picto choisi est **surligné**. | ouvert (idées) |
| T3 | Barre remontée en haut, plus lisible, on choisit d'un toucher. | ouvert (idées) |
| T4 | « Trouve un truc » côté expérience : proposition de l'agent attendue. | ouvert (idées) |
| T5 | Maquette après choix d'INFRA sur les idées. | ouvert |
| T6 | Dans le menu **« ⋯ »** : **options du Mix**. Durée de transition : **10 s, 5 s, aucune**. | ouvert (idées) |
| T7 | 2-3 **effets** au choix : fondu entrée/sortie, **reverb**, autre ; ou **aléatoire** de tous les effets. | ouvert (idées) |
| T8 | « Pousse le truc plus loin » : propositions de l'agent attendues avant la maquette. | ouvert (idées) |

### T bis. Choix d'INFRA (20/11) : « ouais » = toutes les options recommandées de `AGENTS_MIX_20261120/RAPIDE.md` § 2 — validé

1. Effets sur le sample seulement ; ton morceau garde fondu Mac / coupe iPhone. 2. Durée : Aucune · 5 s · Auto (4 mesures, plafonnée par l'extrait) ; 10 s = refaire les extraits plus tard. 3. Durée pour sample → sample et morceau → sample ; sample → morceau reste 0,35 s. 4. Effets : Fondu, Reverb, Écho, Filtre de basses, Hasard qui écoute. 5. Pictos pleins, nom sous le choisi seulement. 6. Page Mix : pile de 3 pochettes + ligne « ≈ Auto · Fondu › ». 7. « A cappella ». 8. Rouge seulement sur la partie sample de la barre, plus doux. 9. Mix passage par passage : plus tard. 10. Défaut : Fondu. 11. Signature ✦ : plus tard (non retenue en a). 12. Technique d'abord.
- « Go » : 3 agents préparent le code en local (branches à part, rien en ligne) ; l'agent principal fait la maquette V2. Après validation : réglages, puis publication avec le oui.

### T ter. Préparation du code (20/11, Claude + 3 agents) — local, rien en ligne
- Maquette V2 : `DOCS/maquettes/MAQUETTE_SAMPLES_MIX_V2_20261120.html` + `.md` — **à valider**.
- Code réuni sur la branche locale **`prep-mix-v2`** (copie `.claude/worktrees/prep-mix-v2`, exclue de Git par `.git/info/exclude`) : moteur (`9d2e950`), interface (`16160e1`), tests et télémétrie (`0848e49`), branchement (`40dd7e6`). `npm test` vert ; essai navigateur : page Mix, menu ⋯, réglages → moteur, A cappella, sans erreur console.
- Non vérifié : son à l'oreille, vrai iPhone.
- Écarts code / maquette à régler après validation : ligne « Auto · Fondu » à droite (maquette : sous le titre) ; pile = pochettes d'albums (maquette : samples) ; A cappella = grille d'albums (maquette : liste avec mini-lignes) ; « Annuler » 4 s absent.
- À trancher : plancher de durée 2 s quand l'extrait a peu de marge ; ajout des champs au Worker (patch dans `AGENTS_MIX_20261120/`, oui d'INFRA).
- Publication : fusion dans `codex/beta-site`, `npm run bump`, push, puis lire le déploiement — seulement avec le oui d'INFRA.
| T9 | **Mix sans a cappella** : le Mix ne joue jamais de voix ; A cappella = section à part « pour ceux qui veulent ». Le site se base sur **Mix et Samples** (la recherche de samples). | validé |
| T10 | **Vue album** dans Samples à refaire, pensée pour **diguer** (fouiller les samples d'un album). | maquette |
| T11 | Maquette V2 **validée en partie** (21/11). | partiel |
| T12 | Durée de transition **en mesures** : Aucune · 2 · 4 maintenant ; 8 · 16 quand les extraits seront recoupés. | validé |
| T13 | **Frise des années** gardée : plus parlante en pictos ; des **traits** au lieu des ronds ; survol = pochette + titre + album ; clic = l'affichage reste bloqué. | maquette |
| T14 | Page album : présenter **le son d'origine et ton morceau côte à côte** pour comparer en naviguant ; le geste reste à trouver. | maquette |
| T15 | **A cappella** = la playlist des **vrais morceaux d'origine** (faits par les artistes) dont INFRA a pris la voix ; pas de voix isolées non traitées. Lecture par **YouTube ou Spotify**, avec leurs icônes. | maquette |
| T16 | **Mix : un seul lecteur**, celui de la lecture classique (plein écran, flèche ‹ retour en haut à gauche, « À suivre » en bas). Plus de lecteur à part avec une croix ✕. | maquette |
| T17 | **Mix : montrer chaque enchaînement** avec les deux pochettes et une flèche (sample en cours → suivant), pour comprendre la coupure. | maquette |
| T18 | **Défaut d'entrée — LAVERNA** (V-23π56) : le sample (Honest, Nuspirit Helsinki) est au début du morceau, mais le site le fait entrer à 0:24.6 (`at`), sur la voix. Piste : repère `at` faux. À prouver à l'oreille ou par analyse avant correction. | à enquêter |
| T19 | **Clic droit sur la pochette** (lecteur) : télécharger la pochette · ouvrir dans un nouvel onglet · crédits · télécharger le morceau · afficher le sample. | maquette |
| T20 | **Pictos** : tous à vérifier ; le bouton Partager est coupé. | à corriger |
| T21 | **Bande blanche** tout à droite de la page. | à corriger |
| T22 | **Aucune barre de défilement**, nulle part : le défilement marche, la barre ne se voit jamais. | à corriger |
| T23 | **Lecteur : deux pochettes côte à côte** reliées par un trait-flèche (en cours → à venir). La pochette jouée est pleine et éclairée, celle en attente est grisée ; au passage, ou au clic, elles s'inversent. S'ajoute à la frise et aux duos. | maquette |
| T24 | Les deux pochettes (jouée éclairée, en attente grisée) **aussi en plein écran**. | maquette |
| T25 | Mix dans **tout le site**, picto radio à revoir, **radio ultime** (tracks + samples mélangés), **options visiteur** retenues sur l'appareil → cadrage dans une session à part (`mix-radio-site`). | reporté (autre session) |
| T26 | Maquette V3 : **Mix validé**. Retours : pochettes manquantes dans la maquette ; **traits de la frise trop gros** ; **flèche entre original et morceau trop grande** ; **A/B incompréhensible** → refaire propre et minimaliste. | maquette |
| T27 | **Maquette finale** : Samples + Mix + radio + réglages réunis dans une seule belle maquette (reprend la V1 Mix/radio de l'autre discussion, lecture seule). | maquette |
| T28 | Radio + samples : la **flèche entre les pochettes est encore trop longue** ; le **picto de l'effet n'a pas à s'afficher à chaque transition**. | maquette |
| T29 | **Picto Mix** : plus « infini », une boucle fermée. | maquette |
| T30 | Lecteur : **pas deux pochettes superposées**, mais **une en haut (un peu plus grande) et une en bas (plus petite)**, reliées par une petite flèche. INFRA demande l'avis de l'agent. | maquette |
| T31 | **⋯ sur la ligne Accueil / Albums…** : Réglages, Crédits, autres options (couleur du thème…). | maquette |
| T32 | **Menus et Réglages en carte transparente**, pas blanche. | maquette |
| T33 | Rangée du bas du lecteur : **aléatoire et radio** restent. **Répéter** passe dans le menu des options (aléatoire, radio, sample, répéter), puis Réglages. | maquette |
| T34 | Haut du lecteur : le mode devient un **pictogramme** ; le **⋯ du haut est enlevé** (en double) ; **engrenage ⚙ à côté du cœur** pour les Réglages. Mac et iPhone. | maquette |
| T35 | Frise : **traits beaucoup plus petits** ; **enlever le titre** « D'où viennent les sons · un trait = un sample » ; **vinyle aligné sur la ligne** de la frise ; **vinyle mieux dessiné, avec plus de sillons**. | maquette finale retouchée |
| T36 | Deux pochettes l'une sous l'autre : prévues **pour les samples** (sample → ton morceau), pas pour la lecture normale (album, radio). INFRA rappelle aussi une présentation plein écran essayée avant, « pas mal ». → INFRA : lecture normale = **une seule pochette**, go. | maquette finale retouchée |
| T37 | Frise : **ligne un peu plus épaisse et plus noire** (traits un peu plus épais aussi). | maquette |
| T38 | « Il faut quand même la navigation » : la maquette doit **reprendre tout le vrai site** (navigation comprise) et ne changer que ce qui est demandé ; trop de choses ajoutées sans demande. → refaite sur les captures du vrai site ; enlevés (QCM INFRA) : couleurs, thème sombre, fausse Accueil, menu du mode. | maquette |
| T39 | Page **Samples pas claire**. Idée d'INFRA : dans un album, toucher un titre (en bas) ouvre la lecture **plein écran**. Demande **plusieurs propositions**. → INFRA : « tout » → A, B, C dans la même maquette. | maquette, choix d'INFRA |
| T40 | INFRA préfère la **lecture plein écran** : toucher un sample ou un album ne doit pas jouer seulement en bas (il n'avait pas compris qu'il fallait toucher le mini-lecteur ; rien ne le disait). | maquette |
| T41 | **Travailler le plein écran du sample** (plus propre que la page). | maquette |
| T42 | **Frise moche, trop large, traits superposés, trop de place** ; grand blanc en haut à droite de l'en-tête. L'enlever ou trouver autre chose : **petit, géométrique, lisible, ludique** ; regarder le web ; être plus inventif. → grille des années / carrés empilés / décennies, en haut à droite de l'en-tête. | maquette |
| T43 | **Idée du disque (frise en vinyle) refusée : « moche », à supprimer totalement.** Envoyer des agents sur le web voir comment on fait de belles frises. | refusé (disque supprimé) ; recherche faite |
| T44 | Grille des années / carrés empilés / décennies **refusés** (« trop gros », « un jeu d'échecs », « non »). INFRA veut un **sélecteur** : de **petits traits**, on **tourne** (molette, ou tirer vers le haut / le bas) et **l'année s'affiche** ; **appuyer sur l'année donne le morceau**. | maquette |
| T45 | En-tête de l'album : **pictos ▶ ∞ aléatoire à droite, remontés** (tout remonte). Le **sélecteur des années est bien** (validé dans l'idée) mais à travailler **« en mode montre suisse d'horloger »**, et à **intégrer** : s'ouvre par un picto, ou **en cliquant sur l'année du sample**. Partir sur une **recherche de professionnels**. | maquette (recherche faite) |
| T46 | **Espace Samples à revoir** : les pictos Samples · Mix · A cappella **sur la même ligne** que « ▶ Tous les samples · BPM · aléatoire ». | maquette |
| T47 | **Pages (forme, plein écran) : validé** (« à peu près clair »). Plein écran : « marche bien ». | VALIDE |
| T48 | **Picto du sélecteur pas reconnaissable**, pas besoin du trait rouge. **Carte des années responsive** par rapport à l'écran. | maquette |
| T49 | Mode découverte d'un album pas clair : le nom du morceau puis ses samples dessous, alors que **le sample vient avant**. Réfléchir à l'ordre. | maquette |
| T50 | **Page d'un album : proposition A validée** (« plus clair ») : les samples, puis ↳ ton morceau. | VALIDE |
| T51 | Accueil Samples : **pictos à droite** de « Tous les samples » ; **aligner** « Tous les samples », BPM et aléatoire (bizarre). | maquette |
| T52 | **Picto Samples (vinyle) à changer** : un sample = un découpage → **ciseaux** ? ou un **vinyle mieux dessiné**. | maquette (choix) |
| T53 | Ligne Samples : **mieux**. Picto ciseaux **nul** → un **vrai picto ciseaux**. **Enlever « Tous les samples · 299 samples »**, ne garder que le bouton ▶. | maquette |
| T54 | **Aucun picto plein** : le site n'a que des pictos au trait. Le picto choisi se voit par la couleur (noir au lieu de gris) et son nom, jamais par un remplissage. | maquette |
| T55 | Pictos **mal alignés**, **trop gros** ; **les ciseaux gênent par leur taille** à côté des autres. **Vérifier chaque picto du site**, faire « hyper propre ». **Clic droit partout** : dès qu'on clique droit sur quelque chose, ça doit marcher. Envoyer **5 à 8 agents** : vérifier tout le site (pictos, gestes, oublis) et valider la maquette, dont **4 sur la maquette** (le plus important). | maquette corrigée (6 agents) ; reste code → .md |
| T56 | Géométrie trop serrée : la phrase « Les samples enchaînés du plus lent au plus rapide » est collée aux pochettes ; en aléatoire elle est fausse → **l'enlever**, tout remonte. | maquette |
| T57 | « Push » pour essayer en mode web, puis on travaille le reste. → INFRA (QCM) : **maquette en lien web privé** ; site public inchangé, rien sur GitHub. | en ligne (lien privé) |
| T58 | **Picto de la frise** (sélecteur des années) **pas bien intégré** : à retravailler. | maquette |
| T59 | Lancer la playlist dans Samples (▶, BPM…) : à travailler. Ton morceau **reste en dessous** (« c'est bien »). Plein écran en mode sample : **les deux barres comme avant** (sample, puis ton morceau). **Enlever l'album encadré en haut à droite.** Pouvoir **tester la lecture en mode album**. | maquette |
| T60 | **« go code »** : coder la maquette finale dans le vrai site (branche `prep-mix-v2`). Lots : C1 ligne du haut et pictos · C2 page album A + sélecteur des années · C3 plein écran du sample (deux pochettes, deux barres, « Puis … ») · C4 clic droit / appui long · C5 A cappella (chansons d'origine). Mise en ligne seulement sur oui d'INFRA. → C1 (`26e66b3`) et C2 (`4f500a1`) codés sur `prep-mix-v2`, testés en local, pas en ligne. C3 : INFRA « Yes, track follows ». C3 `17c85f6`, C4 `75becec`, C5 `b78953e` codés et testés sans son (ordinateur et iPhone), tests Samples verts. **Pas en ligne.** Reste : passage audio sample → ton morceau à écouter par INFRA ; durées en mesures (T12, Aucune · 2 · 4) pas encore dans le moteur ; Réglages et radio du site (autre lot). → **En ligne le 21/11 : version audiofix473-20261121** (commit `19f08aa`, déploiement GitHub réussi, version et nouveau code Samples relus sur le site en ligne). | en ligne, à essayer par INFRA |
| T61 | Essai en ligne (v473) : sur **LIBERTA**, un sample manque ; seul un sample vocal (d'ambiance) est mis. Pochette du bas : vue en Mix, pas sûr du reste ; à un moment, **seuls les samples** s'entendaient (ton morceau ne suivait pas ?). **Le fondu du picto (transition) n'est pas beau**, et **les transitions ont l'air de ne pas marcher**. Tout vérifier. → Vérifié sur ordinateur (son coupé) : sample → YOSHIMITSU → sample suivant, l'enchaînement marche. LIBERTA : le sample principal (Toshiya Sukegawa, « Space Creation ») a un lien YouTube **douteux** (vidéo de l'album entier, réédition 1993) → exclu ; même cas pour 73 liens douteux et 38 sans résultat. Fondu refait (`020e852`, local). Journal d'essai pas encore reçu. INFRA (QCM) : appareil « les deux / je ne sais plus » ; liens douteux → **valider la liste** : page https://claude.ai/artifact/CWjMZ8PCZV597Atdx1v6B4 (70 liens, LIBERTA en tête, réponses gardées). Nouveau fondu **en ligne : audiofix474-20261121** (`f1e8ad9`). | en cours (liens à valider) |
| T62 | Les 70 liens douteux : **INFRA laisse l'agent les valider** (« moi je peux pas le faire »). Méthode : titre, chaîne et durée de la vidéo (sans téléchargement) comparés au fichier du projet Ableton ; dans le doute, non. → **25 oui, 32 non** (rapport `INVENTAIRE_SAMPLES/VALIDATION_LIENS_AGENT_20261121.md`). 22 ajoutés à `samples.json` avec extraits tirés des fichiers locaux (LIBERTA : Space Creation) ; 3 sans fichier local mis de côté. 8 pochettes tirées des fichiers ; 13 à chercher (Apple Music / YouTube) → demande à INFRA ; envoi des 21 extraits sur R2 → avec la mise en ligne. → INFRA « go » : 13 pochettes (3 Apple Music, 10 YouTube), 21 extraits sur R2 (servis), **en ligne : audiofix475-20261121** (`71f41a8`), 444 sons. | en ligne |

## U. Demande d'INFRA (27/11, Claude) : essai des Samples — lecture seule d'abord, rien codé avant « go »

| # | Demande | Statut |
|---|---|---|
| U1 | **Des transitions ne marchent pas** (essai iPhone du 25/11, v479). | à préciser (QCM) ; télémétrie aveugle : le Worker jette les détails des passages |
| U2 | **Page d'accueil des Samples pas claire** : la grille ressemble à l'onglet Albums. | ouvert (propositions) |
| U3 | **Sample → morceau : la pochette du sample s'en va.** Elle devrait revenir « dans l'autre sens » : le morceau passe en grand, le sample devient la petite pochette. | ouvert (proposition) |
| U4 | **Vérifier chaque sample : « beaucoup d'erreurs »** (444 sons). | en cours (2 agents : données, son) |
| U5 | Trouvé : **36 pochettes de samples = une image INFRA** (« SAMPLE 2 » + logo), tirée des tags des fichiers locaux. | erreur certaine, à corriger |
| U6 | Audit des données (agent, 27/11) : 198 erreurs certaines, 753 à vérifier, 300 sons sur 444 touchés. **Cause n° 1 : `temps.py` compte depuis le début du projet Ableton, pas depuis le début de l'export** (LAVERNA : boucle d'export à 0:24.6, durée 4:00 = morceau publié) → `at` et `go` faux dans 33 morceaux sûrs, 16 probables. Aussi : 40 sons pris sur des pistes coupées, 75 titres/artistes sales, 6 pochettes « DayDreams » fausses, 8 extraits d'un autre passage, 3 sons sans temps ni extrait. Rapport copié dans `INVENTAIRE_SAMPLES/AUDIT_DONNEES_20261127.md`. | à corriger après « go » ; contrôle à l'oreille-machine en cours |
| U7 | (27/11 soir) « Des fois ça bug. » **Reverbs et transitions « pas codées »** : à coder, tout. Journal iPhone du jour : ton morceau n'est jamais préparé à l'avance (démarre en 1 à 2 s → trou ou coupe) ; aucun effet déclenché ; le serveur jette le détail des passages. | ouvert → méga plan |
| U8 | **4 agents pour un méga plan** (données, moteur audio, web, interface) → `DOCS/LOTS/PLAN_SAMPLES_20261127/PLAN.md`. | fait, attend Q1-Q3 |
| U9 | **Que des samples** dans la section : pas d'a cappella, pas de voix. | validé |
| U10 | QCM INFRA (27/11) : Mix = **sample puis ton morceau, sans aucune voix** ; accueil = **mur des samples** ; **retirer** les 32 samples sur pistes coupées et les 5 sons parlés. « Code tout » = go pour tout le plan. | validé → code |
| U11 | **Codé (27/11)** : données (254 samples, 50 entrées recalées, 8 extraits refaits, 30 pochettes, 68 noms ; `D1_FAIT.md`), moteur (ton morceau joué dans le moteur des samples, effets à chaque passage, mesures Aucune · 2 · 4, pause casque, retour d'arrière-plan, fin de liste ; `M_FAIT.md`), interface (mur des samples, deux pochettes qui s'échangent, plus d'A cappella, iPhone sans débordement). Tests verts, essai navigateur son coupé. Fusionné dans `codex/beta-site` (`78c70a4`), version audiofix488 préparée **non commitée** ; **push refusé par le garde-fou, attend le oui d'INFRA**. Patch Worker : `_private/docs/worker-samples-pass-20261127.patch` (non déployé). | prêt, pas en ligne |
