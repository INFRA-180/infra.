# Méga plan Samples (27/11/2026, Claude + 4 agents) — à valider par INFRA

Détail : `1_DONNEES.md` · `2_MOTEUR.md` · `3_WEB.md` · `4_INTERFACE.md`. Registre : `LOT_SAMPLES_20261119.md` § U.
Scripts de l'agent données (son vs projet) : `INVENTAIRE_SAMPLES/_outils/plan_20261127/` (local).

## En bref
1. **Données fausses** : le moment où le sample entre est décalé de 15 à 80 s dans beaucoup de morceaux (prouvé au son : LAVERNA, SHKADOV…). Cause : l'outil compte depuis le début du projet, pas de l'export.
2. **Effets jamais entendus** : reverb/écho/filtre codés, mais ne jouent qu'à la fin de la minute de ton morceau ; tu sautes avant.
3. **Trou sur iPhone** : ton morceau n'est jamais prêt (lancé 3 s avant, seul le début du fichier est préchargé).
4. **Interface** : accueil = grille d'albums ; pochette du sample qui disparaît ; 25 pages d'album trop larges sur iPhone.

## Lots, dans l'ordre
| Lot | Contenu | Dépend de |
|---|---|---|
| D1 | Données : temps.py v3 (début d'export, pistes coupées, copies), calage par le son, retrait des 151 voix, 28 pochettes, 81 noms, 9 extraits à refaire, test anti-retour | — |
| M1 | Télémétrie : patch Worker + `samples_pass` à chaque passage | — |
| M2 | Bugs sûrs : ouverture en pause, pause casque ignorée, retour d'arrière-plan, remontée de volume, fondu avant le son | — |
| M3-M4 | Ton morceau joué dans le moteur des samples (minute préparée comme un extrait) → vrais fondus et effets sur iPhone | D1, choix Q1 |
| M5 | Durées en mesures (Aucune · 2 · 4) ; effets à **chaque** passage | M3 |
| M6-M7 | Écran verrouillé, fin de liste | M3, essai iPhone |
| I1 | Débordement iPhone, deux pochettes qui s'échangent (U3), sans saut | — |
| I2 | Accueil Samples (mur des samples), retrait A cappella | maquette validée |
| L | Mise en ligne : `npm run bump`, push, lecture du déploiement, essai iPhone par INFRA | tout |

## Questions à INFRA
Q1 Mix « que des samples » : A sample → ton morceau, sans voix (recommandé) · B samples seuls · C choix dans ⋯.
Q2 Accueil : A mur des samples (recommandé) · B étagères · C liste.
Q3 Pistes coupées (32) et sons parlés (5) : A retirer (recommandé) · B garder · C liste d'écoute.
