# Rapport courant — SITE INFRA

Date : 18 juillet 2026
Baseline : `audiofix351-20260718`
Service Worker : `infra-shell-20260718-audio351`

## État

- 31 albums, 283 pistes et 283 durées.
- Catalogue live et fallback Git alignés.
- Une pochette WebP 1200 canonique par album.
- Aucun ancien dérivé de cover 480/900, JPG ou PNG dans le périmètre public.
- Prefetch v9 par segments de 2 MiB, N+1 à N+5.
- Radio globale, Shuffle album et lecture chronologique consolidés.
- Fullscreen, mini-player et Media Session validés par l’utilisateur sur iPhone.
- Page Favoris simplifiée : titre stable, sélection ronde, fermeture `×` et retrait par
  poubelle.
- Navigation SPA avec handoff peint WebKit feature-détecté, sans snapshot/canvas, scroll
  séparé de la mutation DOM, retour Accueil par DOM conservé et cover hero synchrone.
- Cache local PWA observable dans le lot de session existant, sans nouvel envoi Worker/KV.
- Export Worker paginé puis trié globalement : les sessions réellement récentes sont de
  nouveau accessibles au diagnostic.
- CSS `audiofix347-20260717` figé.
- Frontière de publication limitée à `public/`.

## Contrôles

La commande de référence est :

```bash
node tools/release-audit.js
```

Elle couvre la syntaxe JavaScript, le catalogue, les pochettes canoniques, le cache audio,
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
