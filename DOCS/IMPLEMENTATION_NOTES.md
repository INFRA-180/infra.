## 2026-06-29 - Covers PWA forcees en 480 pendant la navigation

Demande :
- Reduire le clignotement restant des covers PWA en evitant le melange 480 -> 900 pendant les transitions.

Decisions :
- En mobile PWA seulement, utiliser `480.webp` comme variante stable pour la cover album cible, la cover temporaire issue de l'accueil et les covers d'accueil restaurees.
- Garder le comportement desktop avec `srcset` et `900.webp`.
- En PWA, limiter aussi le warmup de session aux variantes 480 pour eviter de preparer une variante qui ne sera pas peinte.

Compromis :
- La PWA favorise la stabilite et la vitesse plutot que la variante 900. Sur les dimensions actuelles de l'interface mobile, 480 reste suffisant.

Validation :
- A verifier sur iPhone PWA reel apres publication : plus de swap visible 480 -> 900 au tap et au retour accueil.
