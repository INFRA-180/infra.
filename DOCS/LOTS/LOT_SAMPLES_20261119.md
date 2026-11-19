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
