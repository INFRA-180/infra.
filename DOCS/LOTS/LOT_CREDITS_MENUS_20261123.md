---
date: 2026-11-23
type: LOT
état: en cours — lots 1, 2, 5, 6 en ligne ; maquette V25 à valider
agent: Claude (session « Crédits et clics droits »)
---

# Lot Crédits + clic droit partout + contrôles (23/11/2026)

Vision (à valider) : **Mac et iPhone (les deux)** — partout sur le site, le clic droit (appui long sur iPhone)
ouvre un petit menu utile (lire, samples, crédits, télécharger, partager, copier le lien), et chaque morceau/album
a de **beaux Crédits** (qui, où, quand, samples écoutables, sons, effets).

## Registre

| # | Demande d'INFRA (23/11) | État |
|---|---|---|
| R1 | Section / page **Crédits** belle (morceau et album) | maquette **V25** prête (`DOCS/maquettes/MAQUETTE_V25_20261123.md`), attend l'avis d'INFRA |
| R2 | **Chaque clic droit fait quelque chose** | **en ligne v477** (`6c64169`) |
| R3 | Clic droit musique → sample ; album → pareil ; **playlists** (INFRA 23/11 : « important dans tout le site ») | **en ligne v477** |
| R4 | Politique des samples | fait : 23 raps → voix, 29 voix au vrai artiste, 2 inversés (**v479**, `e3e2c1a`) ; extraits : « le plus simple » → gardés tels quels (risque noté ci-dessous) |
| R5 | 6 agents | fait |
| R6 | Moteur : fluidité | fait : navigation périmée + défilement (v476), progression et numéros (v478) |
| R7 | Connexions | fait : liens de téléchargement à jour (v476), ménage R2 protège les samples (`_private` `e8ce2e0`), délai des extraits (v476) |
| R8 | « Les 20 raps, tu les classes en voix » (23/11) | **fait v479** |
| R9 | Extraits : « raccourcir ou passer, le plus simple » (23/11) | **passé** (rien changé) ; à revoir si une plainte arrive |

**Reporté** : adresse du Worker en une seule source (9 endroits, gain faible, risque) ; 49 samples sans artiste ;
faux positifs Spotify (5, à retirer de la playlist avec la connexion d'INFRA) ; outil `build-credits` → après
validation V25 ; page « Retrait sur demande » (non demandée).

## Constats vérifiés par l'agent principal

- Catalogue servi par le Worker = **18/11** (`catalog-20261118T230920Z`) : **21 liens Google Drive** encore en ligne, 3 dans le dépôt (apps). Le site peut proposer de vieux liens de téléchargement.
- Ménage R2 (`_private/tools/sync-itunes-r2-catalog.js:2986`) : classe les **467 extraits de samples** comme à effacer ; seul le plafond 25 % les protège ; erreur au journal toutes les 5 min (725 lignes).
- `samples.json` : 444 entrées, **441 extraits audio hébergés sur R2, dont les 128 voix**.
- `spa-renderer.js:892` attente de pochette sans limite = **choix voulu** (commentaire) ; le vrai bug est l'absence de contrôle « navigation encore d'actualité » après l'attente (`:1772` → `:1797`).
- `track-actions.js:297` : `touchmove` non passif posé en permanence sur tout le document.

## Clic droit — existant (agent 1)
- Fait : lignes de morceau (Télécharger · Partager · Copier le lien), ⋯ du grand lecteur, tout l'onglet Samples.
- Absent : cartes/en-têtes d'album, playlists, Favoris, mini-lecteur, clic droit sur le grand lecteur.
- **Bloqué sans rien ouvrir** : pochettes et logo (`share-qr.js:724`).
- Pas de traits entre groupes ; 3 appuis longs à 480/500/600 ms ; « Lire ensuite » / « Ajouter à la file » n'existent pas dans `audio-core`.

## Clic droit — carte proposée (— = trait)
- **Morceau** : Lire ensuite · Ajouter à la file — Favori · Afficher les samples* · Crédits · Aller à l'album — Télécharger le morceau · Télécharger l'album — Partager… · Copier le lien
- **Grand lecteur** : idem + Copier le lien à cet instant
- **Mini-lecteur** : Ouvrir le lecteur · Aller à l'album · Afficher les samples* — Favori — Partager… · Copier le lien
- **Album (carte, pochette, en-tête)** : Lire · Aléatoire · Lire ensuite · Ajouter à la file — Samples de l'album · Crédits de l'album — Télécharger l'album — Partager… · Copier le lien
- **Playlist** : Lire · Aléatoire · Lire ensuite · Ajouter à la file — Partager… · Copier le lien
- **Logo** : Partager le site… (QR) · Copier le lien du site (appui long = QR gardé)
- **Sample** : existant + traits + vrai lien vers le sample
- Champs texte, liens texte, texte sélectionné : menu du navigateur gardé.
\* seulement si le morceau a des samples.
Technique : un seul module de menu pour tout le site (un seul appui long, 500 ms).

## Crédits (agents 2 et 3)
- Code actuel : « Crédits » du ⋯ = simple liste « Samples utilisés », seulement si le morceau a des samples.
- Données : `DOCS/maquettes/sources_V24/credits.json` (291 morceaux, dates, BPM, 931 sons Splice, 15 889 VST) **non publié, du 18/11**. Manque : ALEXANDRIA (11) + 1 morceau de D 2.0141 ; 20 morceaux sans projet `.als` ; tonalité et paroles absentes.
- Proposé : outil privé `_private/tools/credits/build-credits.py` → `public/data/credits.json` (sans chemin), un seul fichier pour la page, le clic droit et le lecteur.
- Mise en page recommandée : **morceau** = « résumé puis détail » (en-tête qui·où·quand·BPM, Samples ouverts avec ▶, Sons et Effets repliés avec une ligne de résumé, 5 plugins puis « Tout voir ») ; Mac = panneau à droite, iPhone = feuille du bas. **Album** = « livret » (morceaux en accordéon, puis samples, créateurs, plugins les plus utilisés).
- Chaque nom mène quelque part (artiste samplé → ses autres samples chez INFRA ; plugin → morceaux où il sert). Rouge seulement pour le ▶ en cours.
- Reste à trancher sur V24 : image des plugins, lieux, format des dates, sons non reconnus.

## Politique des samples (agent 4)
- Données : 49 samples sans artiste ; 29 voix au nom d'une chaîne d'a cappella (Krem Labs…) au lieu du rappeur ; 2 voix avec feat ; 20 raps non marqués « voix » (donc dans la playlist « sans voix ») ; titres/artistes inversés (France Gall, Windows 95) ; 5 faux positifs Spotify au-dessus du seuil (ex. The Nurons → The Weeknd).
- Droit (pas un avis d'avocat) : risque n°1 = **extraits audio de 30-50 s hébergés sur R2** (CJUE Pelham, 2019 et 2026) ; ensuite les zips téléchargeables ; ensuite plainte DMCA (GitHub ferme les récidivistes). Splice : jamais un son seul exposé, le crédit texte suffit. Spotify : jamais mélangé dans le Mix. YouTube : lecteur visible, pas d'audio seul.
- Mesures proposées : extraits ≤ 15 s (ou YouTube pour les voix), page « Mentions / retrait sur demande », corriger les artistes.

## Moteur et connexions (agents 5 et 6)
- Vert : déploiements (8/8), version en ligne = dépôt (475), Worker rapide (0,13-0,25 s), Service Worker ne garde aucune erreur, catalogue avec secours, visualiseur, préchargement, aucune fuite.
- À corriger : (a) navigation périmée qui remplace la page ; (b) `touchmove` permanent ; (c) barre de progression réécrite ~11×/s ; (d) numéros de piste redessinés à chaque événement audio ; (e) catalogue en ligne du 18/11 ; (f) ménage R2 qui vise les samples ; (g) extraits de samples sans délai max ; (h) adresse du Worker écrite à 9 endroits ; (i) `_private/state/ÉTAT.md` arrêté au 09/11.
- Télémétrie : aucun export local récent, non lue.

## Lots proposés (attendent « go »)
1. **Réparations sûres** : (a) (b) (e) (f) (g) — petits patchs, tests du fichier touché.
2. **Clic droit partout** : module unique + carte ci-dessus + « Lire ensuite / Ajouter à la file ».
3. **Données Crédits** : outil `build-credits` + `credits.json` (ALEXANDRIA comprise) + correction des artistes de samples.
4. **Page Crédits** : maquette V25 (morceau + album) à montrer avant code.
5. **Politique** : extraits, page Mentions, faux positifs Spotify — selon le choix d'INFRA.
6. **Propreté moteur** : (c) (d) (h).
