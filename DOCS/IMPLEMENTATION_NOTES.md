# Implementation Notes

## 2026-07-12 — PWA cold-start catalogue preparation

- The home PWA prepares the global playlist immediately after application startup, without downloading a complete audio file.
- A Play action reuses `tracksData` when it is already in memory and invalidates any obsolete idle preparation before starting playback.
- The historical 110 ms iPhone readiness guard, the 30-second N+1 prefetch threshold, and Service Worker audio Range handling are unchanged. Complete-file N+1 prefetch remains deferred because starting it during the initial `playing` event competes with the first audio buffer on mobile networks.

## 2026-07-13 — Radio cold-start and observable transitions

- A cold Play action from the home mini-player now explicitly switches to Radio before creating its first playback queue. This gives the player a concrete N+1 queue from the first track.
- The PWA shell and catalog use release `audiofix303-20260713` / `infra-shell-20260713-audio303`, so an installed PWA receives this runtime rather than a previously cached July 3 shell.
- Core playback transition telemetry is flushed after a short batch delay (600 ms), rather than waiting for the 40-event / 60-second background threshold. This makes a short manual PWA test observable without increasing normal event volume materially.
- The historical readiness guard and Service Worker Range behavior remain unchanged in this release.

## 2026-07-13 — Radio active-state visibility

- The mini-player Radio button now keeps the accent color when its `is-on` state is active. The previous mode-specific CSS override made the active state visually indistinguishable from normal playback.
- This is a UI-only correction: the Radio queue, readiness guard, and N+1 prefetch behavior are unchanged.
