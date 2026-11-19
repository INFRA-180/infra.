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
