# Implementation Notes

## 2026-07-09 - Audio runtime coherence

- The global transport is the only owner of previous, play/pause, next, and shuffle controls. Album pages keep track selection, progress, and favorites only.
- Telemetry is event-batched in IndexedDB, flushes when the document becomes hidden, and uses a five-minute retry/health cadence instead of a one-minute active-playback cadence.
- Local catalog documents share one release query version. Public generation now updates the actual `catalog-fallback.js` module and application pages as well as HTML, JSON, and the service worker.
- The automatic Music-to-R2 watcher continues to publish immutable Worker releases only. Generating and publishing the Git fallback remain an explicit release step.
- SPA navigation rechecks its navigation token after asynchronous page initialization before applying completion side effects.

## 2026-07-09 - Cover runtime modularization

- The cover cache, decode, telemetry, and PWA continuity runtime now belongs to `assets/js/covers.js`.
- `scripts.js` keeps only the injected dependency bridge, reducing it from 5,780 to 4,997 lines without adding another network-loaded module.
- The audio release verifier asserts this ownership boundary so the cover runtime cannot drift back into the bootstrap file.

## 2026-07-10 - Runtime split and iPhone validation

- `pwa-runtime.js` owns Service Worker registration, update probes, deferred reload guards, visibility handling, and related telemetry. It never reloads while playback, a track start, or the now-playing overlay is active.
- `site-runtime.js` owns theme presets, `theme-color`, PWA status color, and the admin lifecycle. `pwa-install.js` remains limited to installation prompts and mobile guidance.
- `spa-controller.js` owns history, page cache coordination, link intent prefetch, SPA page initialization, and home-route restoration. `spa-router.js` remains URL/cache oriented and `spa-renderer.js` remains responsible for DOM rendering and swaps.
- `media-session.js` exposes `createMediaSessionRuntime` for system controls, metadata, artwork, seek position, iOS standalone restrictions, and resynchronisation.
- `scripts.js` is the shared state and dependency-injection bootstrap. Its adapter section is mechanically compacted during the release build; public behavior remains in dedicated modules.

### iPhone PWA validation protocol

1. Open the installed Safari PWA from a cold launch and confirm home, album, and back navigation without a full reload.
2. Start a track, then verify pause, play, previous, and next from the lock screen and AirPods.
3. Open and close now-playing during playback, background the PWA, then return to the foreground and confirm the player and artwork remain coherent.
4. Install a newer release while playback is active: no reload may occur until playback and the overlay are inactive; confirm the deferred reload then installs the new cache.
5. Review telemetry after the session for `sw_controllerchange`, deferred reload events, media-session actions, and playback recovery events.
