# Rapport courant — SITE INFRA

Date : 20 juillet 2026
Baseline : `audiofix364-20260720`
Service Worker : `infra-shell-20260720-audio364`

## État

- 31 albums, 283 pistes et 283 durées.
- Catalogue live et fallback Git alignés.
- Une pochette WebP 1200 canonique par album.
- Aucun ancien dérivé de cover 480/900, JPG ou PNG dans le périmètre public.
- Prefetch v9 par segments de 2 MiB, N+1 à N+5.
- Radio globale, Shuffle album et lecture chronologique consolidés.
- Géométrie fullscreen stable restaurée ; la sonde observe le bug de status bar iOS 26 sans
  modifier le layout. Mini-player et Media Session restent inchangés.
- Fullscreen desktop : titre, album et `À suivre` restent à leur opacité normale, sans timer
  dépendant des mouvements de souris.
- Visualisation desktop : spectre FFT réel 40 Hz–16 kHz sur axe logarithmique gauche→droite,
  axe central fixe, rendu miroir amplifié et activation visible dès l’ouverture à froid, à
  30 i/s maximum. Le graphe singleton garde sa sortie audible directe, sa branche d’analyse
  séparée et l’arrêt du rendu sans fermeture du contexte.
- Diagnostic visualiseur : une seule entrée compacte par session mesure build, activation,
  état du contexte, signal, progression audio, frames et canvas, sans audio brut ni requête
  Worker supplémentaire.
- Page Favoris simplifiée : titre stable, sélection ronde, fermeture `×` et retrait par
  poubelle.
- Navigation SPA avec handoff peint WebKit feature-détecté, sans snapshot/canvas, scroll
  séparé de la mutation DOM, retour Accueil par DOM conservé et cover hero synchrone.
- Cache local PWA observable dans le lot de session existant, sans nouvel envoi Worker/KV.
- Export Worker paginé puis trié globalement : les sessions réellement récentes sont de
  nouveau accessibles au diagnostic.
- Partage QR redessiné en modale : disque rouge officiel, modules noirs, vrai logo, fermeture
  à gauche, copie à droite et toast temporaire accessible.
- CSS `audiofix364-20260720` figé.
- Frontière de publication limitée à `public/`.

## Contrôles

La commande de référence est :

```bash
node tools/release-audit.js
```

Elle couvre la syntaxe JavaScript, le catalogue, le graphe d’analyse audio live, les pochettes
canoniques, le cache audio,
le Service Worker, la navigation SPA, la télémétrie, la stabilité PWA et la frontière
public/privé.

## Décision

Le runtime est en phase de maintenance. Aucun changement spéculatif de l’audio, du prefetch,
du fullscreen, du CSS, de Media Session ou de la navigation ne doit être engagé sans
régression reproductible.

Les nettoyages opérationnels du 18 juillet sont terminés :

1. environ 15,6 Go de staging Music/R2 non référencé supprimés après sauvegarde ;
2. ancienne copie complète redondante de 10 Go retirée, bundles Git conservés ;
3. 106 anciennes covers et 20 variantes d’icônes sans consommateur retirées ;
4. inventaire public désormais contrôlé automatiquement par l’audit de release.

La prochaine amélioration structurelle utile reste la centralisation progressive de la
génération des données et versions, sans modifier le runtime stable.

La validation UX finale reste effectuée par l’utilisateur sur la PWA iPhone.
