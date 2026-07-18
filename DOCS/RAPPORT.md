# Rapport courant — SITE INFRA

Date : 18 juillet 2026
Baseline : `audiofix348-20260717`
Commit : `f8a19aa`
Service Worker : `infra-shell-20260717-audio348`

## État

- 31 albums, 283 pistes et 283 durées.
- Catalogue live et fallback Git alignés.
- Une pochette WebP 1200 canonique par album.
- Prefetch v9 par segments de 2 MiB, N+1 à N+5.
- Radio globale, Shuffle album et lecture chronologique consolidés.
- Fullscreen, mini-player et Media Session validés par l’utilisateur sur iPhone.
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

Les prochaines actions recommandées sont documentaires et opérationnelles :

1. conserver une référence d’architecture courte ;
2. appliquer une politique de rétention au staging Music/R2 ;
3. nettoyer séparément les anciennes variantes de pochettes ;
4. centraliser progressivement la génération des données et versions.

La validation UX finale reste effectuée par l’utilisateur sur la PWA iPhone.
