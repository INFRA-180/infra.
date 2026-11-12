# PWA et supports — contrôle du 12/11/2026 (Claude), lecture seule

Demande d'INFRA (12/11) : « vérifie si la PWA est bien paramétrée pour Android, Google Chrome, les autres navigateurs, et que ça marche sur Mac, Android, iPhone ». Code du site non modifié.
Sources : fichiers du dépôt (`public/manifest.webmanifest`, `public/index.html`, `public/sw.js`, `src/js/`) et connaissance des règles d'installation (manifeste W3C, critères Chrome) — **aucune recherche web faite ce jour**, à sourcer si un point est contesté.

## Ce qui est bon (prouvé dans les fichiers)
| Point | Chez nous |
|---|---|
| Manifeste lié | 40 pages sur 42 (les 2 autres : fichier de vérification Google, Sphragis) |
| Nom, nom court, langue, `id`, `start_url`, `scope` | « INFRA. », `fr`, `./` partout |
| Affichage | `standalone` (+ `display_override` standalone → minimal-ui → browser) |
| Icônes | 192 et 512 « any », 192 et 512 « maskable », 1024 ; tailles réelles conformes |
| Service Worker | `sw.js` avec gestionnaire `fetch` (hors ligne) — requis par Chrome Android pour proposer l'installation |
| iPhone | `apple-touch-icon` 180, `apple-mobile-web-app-capable`, barre d'état `black-translucent`, titre « INFRA. », `viewport-fit=cover` |
| Android | `mobile-web-app-capable`, `theme-color` |

## À corriger (proposé, au moment du code)
1. **Icône Android « maskable » rognée** : le logo occupe toute la largeur (8 → 504 px sur 512) alors qu'Android peut découper l'icône en cercle ; la zone sûre est un cercle de 40 % du côté (rayon 205 px). Mesuré : le dessin va jusqu'à 251 px du centre → le « I » et le point rouge seraient coupés sur beaucoup de téléphones Android. Correction : refaire `icon-maskable-192/512` avec le logo réduit (≈ 400 px de large sur 512), fond blanc plein.
2. **Retour Android (bouton ou geste système) avec le grand lecteur ouvert** : le site n'ajoute pas d'étape d'historique à l'ouverture du lecteur (`now-playing.js`, seul `popstate` dans `runtime/page-init.js` → navigation de page). Le retour Android ferait donc **changer de page sous le lecteur** au lieu de le fermer. Lu dans le code, **non vérifié sur un vrai Android**. Correction proposée : ouvrir le lecteur = une étape d'historique ; retour = fermer le lecteur (comme les fiches dans la maquette).
3. Description du manifeste sans accents (« telechargement ») → « téléchargement ».
4. (Option) `screenshots` dans le manifeste : Chrome Android affiche alors une fenêtre d'installation plus riche. Pas obligatoire.

## Supports — ce qui a été essayé avec la maquette V12
| Support | Essai | Résultat |
|---|---|---|
| Mac, Chrome (navigateur intégré) | gestes trackpad simulés, mesures au pixel | OK |
| Mac, Safari | — | **non essayé** (Safari a son propre retour à deux doigts) |
| iPhone, Safari (simulateur iOS 26.2) | vrais glissers du simulateur + sonde | OK après correction (cf. MAQUETTE_V12) |
| iPhone, app installée (écran d'accueil) | — | non essayé pour la V12 (à faire avec le code, sur un port neuf) |
| Android, Chrome | émulation 375 px, agent Android, tactile | OK (logique) ; **aucun émulateur Android sur ce Mac** |
| Firefox, Samsung Internet, Edge | — | non essayés |

## Ce qu'on oublie peut-être (proposé, à valider)
- Retour Android sur le lecteur (point 2 ci-dessus) : le plus important.
- Clavier sur ordinateur : Espace = lecture / pause, ⌘1…⌘5 = onglets (aujourd'hui, ← → seulement quand les onglets ont le focus).
- Lecture continue quand l'écran Android se verrouille (Media Session déjà en place côté site ; à vérifier sur un vrai Android).
- iPad : trackpad et doigt en même temps (les deux moteurs existent, non essayé).

## Mise à jour 12/11 soir
- Émulateur Android installé (licence acceptée par INFRA) : **Android 15, Chrome**, AVD `SITE_INFRA_TEST_ANDROID`.
- Point 2 (retour Android avec le grand lecteur ouvert) : corrigé **dans la maquette V14** et vérifié sur l'émulateur (lecteur fermé, page gardée) ; à reporter dans le code du site (lot 3).
