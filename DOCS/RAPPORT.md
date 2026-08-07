# Rapport courant — SITE INFRA

Date : 7 août 2026
Baseline : `audiofix388-20260807`
Service Worker : `infra-shell-20260807-audio388`

## État

- 31 albums, 283 pistes et 283 durées.
- 4 playlists Music en lecture seule, 234 occurrences et 225 pistes uniques.
- Catalogue live et fallback Git alignés.
- Une pochette WebP 1200 canonique par album.
- Aucun ancien dérivé de cover 480/900, JPG ou PNG dans le périmètre public.
- Prefetch v9 par segments de 2 MiB, N+1 à N+5.
- Radio globale, Shuffle album et lecture chronologique consolidés.
- Play à froid contextuel : Radio sur l’accueil, première piste et ordre de la collection sur
  un album ou une playlist ; une session existante n’est jamais remplacée par la navigation.
- Sur l'accueil tactile, un swipe droit dominant sur une carte du module Albums ouvre la page
  par la SPA sans voler le scroll vertical ni l'appui long QR. Chaque page album expose un seul
  bouton Play/Pause qui adopte explicitement l'album affiché et démarre sa piste 1 depuis une
  autre file ; les playlists conservent leur interface actuelle.
- La PWA demande le type Audio Session `playback` avant d’initialiser son lecteur global quand
  le navigateur l’expose. Une reprise WebKit après appel n’est admise qu’après la transition
  `interrupted → active`, dans une fenêtre de 8 secondes et sur la même piste ; une Pause
  explicite annule cette autorisation et les navigateurs incompatibles conservent le repli.
- `Previous` redémarre la piste courante après 3 secondes sur l’interface et Media Session,
  sans rechargement ni second `play()`.
- Mini-player desktop détachable par drag sur un bord en vraie fenêtre Document PiP. Le PiP
  reste au-dessus des applications, se déplace nativement, partage toutes les commandes et
  l’état du lecteur, survit à la navigation SPA et révèle la cover quand il est agrandi. Le
  player remplit toute la surface sous la barre de sécurité, sans double cadre, et réorganise
  toutes ses commandes en dispositions compacte, intermédiaire ou large au resize.
- Géométrie fullscreen stable restaurée ; la sonde observe le bug de status bar iOS 26 sans
  modifier le layout. Mini-player et Media Session restent inchangés.
- Fullscreen desktop : titre, album et `À suivre` restent à leur opacité normale, sans timer
  dépendant des mouvements de souris.
- Dans la file `À suivre`, le drag/drop souris reste actif et un appui long de 420 ms permet
  désormais le même réordonnancement sur PWA tactile et desktop tactile, avec annulation sur
  intention de scroll, repère de dépôt et auto-défilement. La piste saisie se lève doucement
  au-dessus du fullscreen en 150 ms ; la piste en cours reste fixe.
- Visualisation desktop comparative FFT pure : spectre réel 40 Hz–16 kHz sur axe logarithmique,
  contours rouge immédiat et blanc lissé, remplissage miroir et courbes quadratiques à 30 i/s
  maximum. La ligne médiane et les particules sont absentes ; aucun tableau de grains, aucune
  simulation physique et aucun tampon de poudre ne sont alloués.
- Diagnostic visualiseur : une seule entrée compacte par session mesure build, activation,
  état du contexte, signal, progression audio, frames et canvas, sans audio brut ni requête
  Worker supplémentaire.
- Télémétrie Media Session v3 regroupée par commande, avec sondes bornées et sans URL audio,
  user-agent brut ni affirmation abusive sur l’écran verrouillé.
- Page Favoris simplifiée : titre stable, sélection ronde, fermeture `×` et retrait par
  poubelle.
- Navigation SPA mobile par swap atomique simple sans snapshot compositeur, transitions de fond
  neutralisées pendant les deux premières frames, scroll séparé de la mutation DOM, retour
  Accueil par DOM conservé et cover hero 1200×1200 synchrone. La View Transition reste un
  contrôle de comparaison activable par `?pwa-swap=view`.
- Cache local PWA observable dans le lot de session existant, sans nouvel envoi Worker/KV.
- Export Worker paginé puis trié globalement : les sessions réellement récentes sont de
  nouveau accessibles au diagnostic.
- Partage QR redessiné en modale : disque rouge officiel, modules noirs, vrai logo, fermeture
  à gauche, copie à droite et toast temporaire accessible.
- CSS `audiofix388-20260807` : apparence du player restaurée à l’état pré-`audio377`, PiP
  plein cadre adaptatif, modes actifs blancs, animation d’égaliseur d’origine et fantôme de
  déplacement tactile visible avec levée courte, désactivée en réduction des animations.
- Frontière de publication limitée à `public/`.

## Contrôles

La commande de référence est :

```bash
node tools/release-audit.js
```

Elle couvre la syntaxe JavaScript, le catalogue, les playlists, le graphe d’analyse audio live,
les pochettes canoniques, le cache audio,
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
