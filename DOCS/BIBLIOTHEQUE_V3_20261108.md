# Bibliothèque V3

Interface validée le 8 novembre 2026. Les six lots ont été autorisés pour publication sur `codex/beta-site`.

- L’accueil réunit les albums, les mosaïques de playlists, les titres, les favoris et les apps et clips. La recherche et le tri restent locaux.
- Les fiches conservent leurs URL directes. Elles partagent les commandes de lecture, de sélection et de partage du site. La lecture explicite d’une playlist utilise sa propre file. La lecture aléatoire d’une fiche démarre dans sa collection.
- La grille propose 32 vignettes WebP de 400 px (795 302 octets au total) et les originaux de 1 200 px via `srcset`. Les fiches et le lecteur utilisent les originaux. Pour une nouvelle pochette, l’accueil utilise l’original tant que sa vignette n’a pas été générée.
- Pour générer les vignettes manquantes et les attributs de l’accueil statique, lancer `node tools/generate-bibliotheque-thumbnails.js` avec `cwebp` disponible. La régénération automatique du catalogue conserve les vignettes existantes et la page les retrouve au chargement.
- La version `audiofix413-20261108` précache le CSS et le JavaScript Bibliothèque V3 sous leurs nouvelles URL. Une PWA déjà ouverte peut appliquer cette génération à sa prochaine ouverture. La validation sur iPhone réel reste à faire.
