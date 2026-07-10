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
- `playPrevious` implements restart-or-previous behavior: above three seconds it seeks the current track to zero; at or below three seconds it selects the preceding track. The same central action is used by mini-player, now-playing, Media Session, lock screen, and AirPods.

### iPhone PWA validation protocol

1. Open the installed Safari PWA from a cold launch and confirm home, album, and back navigation without a full reload.
2. Start a track, then verify pause, play, previous, and next from the lock screen and AirPods.
3. Open and close now-playing during playback, background the PWA, then return to the foreground and confirm the player and artwork remain coherent.
4. Install a newer release while playback is active: no reload may occur until playback and the overlay are inactive; confirm the deferred reload then installs the new cache.
5. Review telemetry after the session for `sw_controllerchange`, deferred reload events, media-session actions, and playback recovery events.

## 2026-07-10 - audiofix285 performance policy

- `performance-policy.js` selects `full`, `constrained`, or `save-data` using the available Network Information signals and conservative PWA/mobile fallbacks. It is the common budget authority for SPA, cover, and next-track preparation.
- Automatic SPA preparation uses the mode budget and never bypasses an existing memory-cache entry. Cover preparation is limited to two concurrent jobs in full mode and one in constrained mode; automatic preparation is disabled under `save-data`.
- The next-track cache remains capped at one track and is only started after stable playback. A user track change keeps the existing abort-and-replace lifecycle.
- Anonymous, 25%-sampled performance events carry only duration, page kind, performance mode, PWA state, connection class, and runtime version. Failures that can affect resilience remain unsampled.
- The service worker installs the offline player shell with `cache.addAll()` and warms QR/admin extras independently. A failed optional resource is reported to the page but cannot block activation of the new worker.
- `tools/audit-performance.js` reports static shell/request-budget evidence for each release. Browser validation remains the authority for request counts, first sound, and SPA timing.

## 2026-07-10 - Superseded audio transport experiment

- This release experiment made normal starts call `play()` immediately after source assignment and made every in-app next/previous action use the fast source-switch path.
- It was superseded because it removed the historic bounded Safari guard and reintroduced the prefetch race previously measured on iPhone when the N+1 target was still downloading.

## 2026-07-10 - Historical audio flow restoration

- The N+1 controller returns to the mature behavior established before the performance-policy release: one bounded next-track cache, original timing, and cancellation when a user action supersedes an incomplete preparation.
- An in-app next/previous action uses the no-pause fast path only when its N+1 target is fully ready. This restores the safeguard introduced after measured iPhone `AbortError` failures caused by an in-flight preparation racing the requested track.
- Cold Safari starts retain the original bounded 110 ms readiness guard. This is distinct from the later multi-second Safari delay: it prevents a rejected `play()` from entering the slow source-reset recovery loop.
- `performance-policy.js` continues to govern SPA and cover preparation. It no longer alters the established audio N+1 controller.
