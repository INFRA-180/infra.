# Navigation — inventaire, cause du clignotement, pile d'écrans (11/11/2026, Claude) — **proposé**

> Mise à jour 11/11 soir : INFRA a répondu « Oui, code-la » à la maquette V7 ; lot Nav-1 publié (`audiofix434`), lot Nav-2 publié (`audiofix436`). Reste : arrivée par la droite (point 2 de la V7).

Demande d'INFRA (11/11) : « je vais dans l'album, au retour les images clignotent, se réaffichent » ; voudrait un retour « presque comme une capture d'écran » ; « charger tout le site et naviguer dedans » ; « voir du point de vue interface, tous les raccourcis ». **Go** pour l'inventaire, le tableau, les propositions et la maquette ; le code après validation de la maquette.
Maquette : `DOCS/maquettes/MAQUETTE_BIBLIOTHEQUE_V7_NAVIGATION_20261111.html` (texte : `DOCS/maquettes/MAQUETTE_V7_20261111.md`).

## 1. Cause du clignotement (mesurée et lue dans le code, non filmée sur iPhone)

- **L'accueil n'est pas reconstruit au retour.** Mesuré dans WebKit (Playwright, iPhone 15) sur 5 parcours : accueil, onglets Albums, Playlists, Titres → album → retour (lien « ← Accueil » et retour du navigateur). À chaque fois, les **mêmes** images (54, ou 345 sur Titres) et la même position de défilement (300 px). Le site garde déjà l'accueil en mémoire (`captureLiveHomeRoute` / `restoreLiveHomeRoute`, `src/js/spa-renderer.js`).
- **Ce qui clignote, c'est le repeint.** Pendant qu'on est dans l'album, l'accueil gardé passe à l'état `retained` (`styles.css`) : `position: fixed; height: 100dvh; overflow: hidden; opacity: 0`. Il est donc **invisible et coupé à la hauteur d'un écran** : les pochettes qui étaient à l'écran (on avait défilé) se retrouvent hors de la zone visible. WebKit peut alors libérer leurs images décodées. Au retour, il les redécode et les repeint → les cases se vident puis se remplissent. Le fondu de 160 ms ajouté le 09/11 (la page quittée reste posée par-dessus, `covering`) le cache en partie, d'où le « c'est un peu mieux » d'INFRA.
- Télémétrie du 11/11 matin : 8 navigations, `dom_reused` 2 fois. Les 6 autres sont des allers (accueil → album), pas des retours : chiffre cohérent avec la mesure.

## 2. Inventaire de tous les chemins de navigation (code au 11/11, `audiofix433`)

| Geste ou raccourci | Où | Aujourd'hui | Avec la pile (proposé) |
|---|---|---|---|
| Toucher une pochette, une playlist | accueil, onglets | ouvre la fiche (vraie adresse `music/…html`, sans recharger) | ouvre la fiche **par-dessus** ; l'écran d'où l'on vient reste peint dessous |
| Glisser une pochette d'album ← → | accueil | ouvre l'album (7 essais ce matin, tous annulés : défilement vertical, normal) | inchangé |
| « ← Accueil » | fiche album / playlist | retour, accueil gardé mais repeint (clignote) | retire la fiche du dessus : l'écran du dessous est déjà là, **aucun repeint** |
| Bord gauche → (glisser) | fiche album / playlist, iPhone | « clique » sur le retour à la fin du geste, rien ne suit le doigt | la fiche **suit le doigt**, l'écran du dessous apparaît en reculant légèrement, comme sur iPhone |
| Retour du navigateur / de la souris | ordinateur, Safari | revient à l'accueil gardé | retire la fiche du dessus (chaque fiche ouverte = une étape d'historique) |
| Onglets Accueil / Albums / Playlists / Titres | bibliothèque | changent la vue, **sans étape de retour** (le retour du navigateur sort de l'accueil) | inchangé (convention iPhone : les onglets ne s'empilent pas) |
| Toucher l'onglet déjà actif | bibliothèque | rien | **proposé** : remonte en haut (convention iPhone) |
| Recherche (loupe), Échap pour fermer | bibliothèque | ouvre / ferme ; le texte tapé est gardé au retour d'un album (accueil réutilisé) | inchangé |
| Barre du lecteur : ← / → | partout, iPhone | titre suivant / précédent | inchangé |
| Barre du lecteur : ↑ | partout, iPhone | ouvre le grand lecteur | inchangé |
| Grand lecteur : glisser ↓ | partout | ferme le grand lecteur | inchangé |
| Nom de l'album dans le grand lecteur | grand lecteur | ouvre l'album (lien `data-transport-now-album`) | ouvre l'album **par-dessus l'écran en cours** (ex. playlist → album) ; le retour revient à la playlist |
| Appui long | pochettes, file d'attente | QR de partage, menu de la file | inchangé |
| Échap | ordinateur | ferme le grand lecteur, la recherche, le tri, la fenêtre de téléchargement (chacun de son côté) | **une seule règle « retour »** dans cet ordre : grand lecteur → fiche du dessus → recherche → tri |
| Alt + ← (Windows) / Cmd + [ (Mac) | ordinateur | retour du navigateur (revient à la page d'avant, sans tenir compte du grand lecteur ni de la recherche ouverts) | **proposé** : même règle « retour » que Échap |
| Espace | ordinateur | lecture / pause | inchangé |
| ← / → | ordinateur | titre précédent / suivant | inchangé (pas « retour » : déjà pris par la lecture) |
| ↑ / ↓, S | fiche album, ordinateur | titre précédent / suivant, aléatoire | inchangé |
| F7 / F9 | ordinateur | titre suivant | inchangé |
| / | ordinateur | rien sur le site (existe dans les maquettes) | **proposé** : ouvre la recherche |
| Lien partagé ouvert directement | tous | ouvre la vraie page de l'album | inchangé : la pile commence à cet album, « retour » ramène à la bibliothèque |

## 3. Incohérences repérées
1. Le bord gauche ne fait rien dans la bibliothèque et sur les onglets (pas de « retour » possible) — normal, mais à garder tel quel : pas d'étape cachée.
2. Le retour par le bord n'est pas suivi par le doigt sur le site (il l'est dans la maquette V6, proposée le 09/11, jamais validée).
3. Échap est géré en 4 endroits séparés ; Alt + ← / Cmd + [ font un retour d'historique qui ignore le grand lecteur ou la recherche ouverts.
4. Ouvrir l'album depuis le grand lecteur **remplace** l'écran en cours : on perd la playlist d'où l'on venait.

## 4. Pile d'écrans — principe proposé pour le code
- Chaque écran ouvert (bibliothèque, fiche, fiche suivante) reste **visible et peint** sous le suivant (pas `opacity: 0`, pas coupé à un écran) ; seul l'écran du dessus reçoit les touchers. Retour = retirer l'écran du dessus : rien à redécoder.
- Profondeur gardée : 5 écrans ; au-delà, le plus ancien est libéré (mémoire iPhone).
- Vignettes 400 px de tous les albums préparées (téléchargées + décodées) quand l'app est au repos, après l'accueil.
- Chaque fiche ouverte = une étape d'historique (vraie adresse gardée pour le partage et Google).
- Si iOS a vidé la mémoire (app longtemps en arrière-plan) : l'écran est reconstruit et n'apparaît qu'une fois ses images prêtes.
- Mesures avant/après : vidéo du retour dans l'app installée (simulateur), trame par trame ; télémétrie des retours.

## 5. Questions pour INFRA
1. Maquette V7 : le retour qui suit le doigt avec l'écran du dessous qui recule, ça te va ?
2. Échap / Alt + ← / Cmd + [ = une seule règle « retour » : d'accord ?
3. Onglet actif touché = remonter en haut, et « / » = recherche : d'accord ?
