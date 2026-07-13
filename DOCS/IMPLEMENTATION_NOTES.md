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

## 2026-07-13 — Telemetry export ordering

- The Worker now writes telemetry batches with a reverse-time key. KV lists keys in ascending lexical order, so the prior capped export could only reach old batches even when newer batches existed.
- The Worker export now selects the newest batch keys directly; legacy batches remain readable as a fallback until the new batch format has data.

## 2026-07-13 — Pages publication boundary

- The public-boundary verifier now allows the project implementation notes file to stay tracked under `DOCS/`, matching the repository workflow requirement to document non-trivial site changes.
- The public payload guard remains unchanged: `public/` still blocks private folders, local worker sources, debug/test paths, large media archives, database files, monitor keys, Cloudflare tokens, and worker configuration.

## 2026-07-13 — Safari iOS AbortError recovery

- `AbortError` during a track transition now resets and reloads the intended source before the single retry, instead of retrying `play()` against the same possibly interrupted media element state.
- The retry readiness window is longer on iOS and emits `source_assigned` / readiness telemetry with `reset_for_abort`, so the next PWA test can distinguish a clean retry from a generic slow network wait.

## 2026-07-14 — iOS transport navigation serialization

- On iOS, transport / Media Session next-previous commands are deferred when a `play()` start or audio recovery is already in flight. Only the latest deferred navigation is replayed after playback stabilizes or after a short max wait.
- Telemetry now records `transport_navigation_deferred` and `transport_navigation_replayed`, making it possible to verify whether rapid taps were absorbed instead of interrupting Safari's media element during `play()`.

## 2026-07-14 — PWA runtime update reload

- The Service Worker controller-change reload now runs quickly when no audio is playing, instead of waiting for a long idle window that could let a user test on the previous runtime.
- User interaction no longer postpones a pending runtime reload for several seconds unless audio playback, track startup, or the now-playing overlay is active.
