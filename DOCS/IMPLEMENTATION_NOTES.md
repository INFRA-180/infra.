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
