# Implementation Notes

## 2026-07-14 — complete public rollback to July 3

- Restored the entire tracked `public/` tree exactly from commit `760092e`, the last repository commit dated July 3, 2026.
- The restored release is `audiofix280-20260703` with Service Worker `infra-shell-20260701-audio279`.
- The rollback includes CSS, player UI, audio runtime/modules, Service Worker, catalog/durations, home, 31 album pages, 3 app pages and the public Sphragis interface.
- No later fix was retained inside `public/`; the rollback is a new reversible commit and does not rewrite repository history.
- Validation: exact tree equality with `760092e`, JavaScript/SW syntax, public-boundary check, catalog check (31 albums, 280 tracks/durations), shell assets, and Chromium mobile Play/Next/Now Playing with zero console errors.

## 2026-07-14 — audiofix322 safe-area ownership and retained transport prefetch

- Mobile pages now use a bottom dock at `bottom: 0`; the Home Indicator inset is internal padding, and page scroll reserves consume the measured dock height without adding the inset a second time.
- Mobile Now Playing no longer extends below `100dvh`. Its existing top artwork/status-bar behavior remains unchanged, its bottom padding still protects the Home Indicator, and the flex layout anchors `À suivre` at the bottom.
- A transport start keeps the current in-flight prefetch generation when it still contains the requested track or its immediate N+1. Existing ready/in-flight/attempted guards continue to prevent duplicate prefetch requests.
- Segment size, prefetch concurrency/depth, Service Worker Range behavior, Media Session, Worker/R2 and audio architecture are unchanged.

## 2026-07-14 — audiofix321 canplay prefetch and compact mobile transport inset

- Normal N+1 preparation now starts from the active track's `canplay` event instead of waiting for `playing`; the existing ready/in-flight/attempted guards keep the later `playing` call idempotent.
- The 4 MiB startup segment, queue depth/concurrency, Service Worker Range matching and `206 Partial Content` reconstruction are unchanged.
- Below 980 px, the global transport now sits at `8px + env(safe-area-inset-bottom)` instead of `20px + env(safe-area-inset-bottom)`. The measured `--mobile-player-space` automatically follows the computed bottom position and is reduced by the same 12 px.
- Now Playing safe areas, header, audio core, Media Session, favorites and Worker/R2 are unchanged.

## 2026-07-14 — audiofix320 PWA bottom safe-area continuity

- iPhone PWA validation confirmed that the status-bar side is now full-bleed. The remaining black strip was the lower safe area behind the Home indicator, not the status bar.
- The now-playing root fallback now uses `--pwa-status-bg` instead of hard-coded black. On mobile, the artwork-backed overlay itself extends through `env(safe-area-inset-bottom)`; the panel keeps that inset as bottom padding, so `À suivre` remains usable directly above the Home gesture area without a separate colour band.
- The top safe area, transport, audio runtime, Service Worker routing, favorites and Media Session are unchanged.

## 2026-07-14 — audiofix320 tolerant shell installation

- Audited all 41 `SHELL_ASSETS` URLs against GitHub Pages: every asset returned HTTP 200; no missing file was found.
- Kept 38 critical shell assets under atomic `cache.addAll`, while moving admin, share QR and the QR vendor to an optional `Promise.allSettled` phase.
- Added regression coverage proving that an optional failure reaches `skipWaiting` and that a critical failure still rejects installation.
- Cache matching, HTML cache-first behavior, audio, Media Session, Worker/R2 and favorites remain unchanged.

## 2026-07-14 — audiofix318 PWA status-bar full-bleed

- All 36 PWA HTML documents (home, 31 album pages, 3 app pages and Sphragis) now opt into `viewport-fit=cover`; the Google verification file remains byte-for-byte a verification artifact.
- The three app pages now also declare `apple-mobile-web-app-status-bar-style=black-translucent`, matching the rest of the PWA documents.
- While the now-playing overlay is open, `setThemeColor()` synchronizes the document theme-color meta tag, `--pwa-status-bg`, and the inline backgrounds of `html` and `body`. Closing restores the pre-overlay color through the existing saved-theme lifecycle.
- `audiofix318-20260714` / `infra-shell-20260714-audio318` refreshes the shell cache only; Service Worker routing and audio behavior are unchanged.

## 2026-07-14 — PWA runtime adoption and playback-correlation telemetry

- Production inspection found a browser page still loading `audiofix315` while the origin already served `audiofix316`. The Service Worker previously activated updates but deliberately suppressed every client reload, so an active installed PWA could remain on its old JavaScript runtime.
- Release `audiofix317` reloads only after a Service Worker `controllerchange` and a second safety check confirms that the page is visible, idle, has no active audio, no startup in flight, and no now-playing overlay. A fresh interaction cancels the short grace window; pause, end, overlay close, or a later idle state retries the update. Playback is never reloaded.
- Service Worker activation now retains only the current shell and runtime caches. A successful new install has already precached the complete shell before activation, so obsolete shell versions cannot continue accumulating or be selected by the new controller.
- Telemetry adds `sw_runtime_state` (controller/active/waiting worker URLs) and associates `loadstart` with the playback request token. This makes stale-runtime adoption and the interval between source assignment, media loadstart, canplay, and playing measurable in the next iOS PWA test.

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

## 2026-07-14 — iOS AbortError passive settle

- The first iOS `AbortError` no longer resets, pauses, or reloads the audio source immediately. The player now waits on the same source for `playing`, `canplay`, or `error` before retrying.
- Telemetry records `abort_settle_start` and `abort_settle_end`; `playing` resolves the start without a retry, `canplay` triggers one same-source retry, and reset is kept as the last fallback after error/timeout.

## 2026-07-14 — Prefetched audio Range bypass

- The Service Worker no longer reconstructs audio `Range` responses from a fully cached N+1 prefetch by reading the whole file into memory.
- When Safari asks for a Range on a prefetched audio file, the prefetch entry is removed and the request falls through to R2, with `served_from_prefetch` telemetry marked `bypass`.

## 2026-07-14 — iOS AbortError short settle retry

- Safari iOS `AbortError` recovery now waits only a short settle window before resetting the same source and retrying playback.
- `served_from_prefetch` telemetry now preserves `status: 0` and reports `bypass`, so Service Worker Range bypasses are visible in reports.

## 2026-07-14 — iOS AbortError aggressive retry window

- The iOS `AbortError` settle window is reduced to a micro-delay before source reset and retry, because telemetry showed the previous 1.05–1.25s settle added visible latency without preventing repeated waits.
- The readiness wait after reset is also shortened so retry playback starts quickly even when Safari has not yet promoted the media element to `canplay`.

## 2026-07-14 — iOS AbortError timeout floor and cover edge cleanup

- `waitForAbortPlaybackSettle` now respects the caller-provided short timeout, with only an 80 ms floor, so the iOS `AbortError` recovery window is no longer forced to about 800 ms.
- Player cover surfaces now keep clipping on the wrapper and use a tiny image bleed with WebKit compositing hints to avoid right-edge aliasing artifacts without changing source artwork.

## 2026-07-14 — Cold-start stability and next-launch Service Worker update

- Telemetry tied repeated iOS `AbortError` failures to the 700 ms waiting-recovery timer: it called `audio.load()` while the original `play()` promise was still pending. Startup `waiting` and `stalled` events are now passive; only `playing` confirms a playback request.
- Cross-origin R2 media requests bypass the Service Worker entirely, preserving Safari's native Range-request path. Next-track full-file prefetch is disabled on iOS to avoid competing with the active media request.
- A newly installed Service Worker no longer takes control and reloads the active application during a Play gesture. The new runtime activates on the next application launch, while the shell is served cache-first and refreshed in the background.
- Home catalog loading is local-first and preserves the first rendered DOM. Startup telemetry now records navigation, paint, largest-contentful-paint, cumulative layout shift, catalog hydration, initialization, and ready timing.
- `tools/verify-audio-stability.js` protects these invariants and checks that all public album pages reference the current audio runtime.

## 2026-07-14 — Restore immediate iOS Radio N+1 preparation

- `audiofix313` disabled next-track prefetch on iOS and cleared its cache. Production telemetry then measured a 3335 ms median `play_resolved` delay, despite first-byte events arriving within 39–57 ms; the delay was Safari buffering each unprepared M4A after the transport tap.
- N+1 prefetch is enabled again on iOS and starts as soon as a Radio track reaches `playing`, while R2 media Range requests continue to bypass the Service Worker.
- Transport next/previous switches now use the immediate source-switch path even when the target prefetch has not completed, removing the extra readiness guard from the user gesture.
- The release is `audiofix314-20260714` / `infra-shell-20260714-audio314`.

## 2026-07-14 — Safari startup-segment pipeline

- Production `audiofix314` telemetry proved that full-file `fetch()` preloading did not feed Safari's media pipeline: a 6.3 MB N+1 download competed for 2.8 seconds, then the actual media element still waited 9.3 seconds. Rapid taps were also deferred internally for up to 1.63 seconds.
- `audiofix315` requests only the first 1 MiB of upcoming M4A files, stores at most four startup segments, and reconstructs valid `206 Partial Content` responses only while the requested Range is covered. Later ranges fall through to R2 unchanged.
- The first Radio queue entry is selected and warmed immediately after `tracks.json` is ready, before the cold Play gesture. Normal Radio N+1 warming still starts at `playing`.
- The cold transport gesture activates Radio synchronously and keeps that prepared queue; it no longer launches an asynchronous mode change capable of replacing the target while `play()` is pending.
- User next/previous commands are no longer serialized behind an unstable playback request; the newest tap switches source immediately and obsolete promise results remain ignored by their request token.
- Executable cache and Service Worker Range tests live in `tools/test-audio-prefetch-cache.js` and `tools/test-audio-prefetch-sw.js`.

## 2026-07-14 — Multi-track startup queue and reliable PWA activation

- The last user session was still running `audiofix314`, despite `audiofix315` being published: telemetry recorded `sw_update_ready`, proving the new Service Worker remained waiting and the tested JavaScript was stale. New workers now call `skipWaiting()` after their shell cache is complete; an already-waiting worker is also released without forcing a reload during playback.
- `audiofix316` restores the proven modular prefetch shape: the first four Radio entries are prepared as 1 MiB startup segments, with two concurrent requests and six retained cache entries. Preparation begins before the cold Play gesture and continues in the background after each completed segment.
- Prefetch telemetry now separates response-header latency (`response_ms`) from response-body/cache latency (`body_ms`) and reports HTTP status, in-flight count, and ready count. This distinguishes R2 latency from media-element buffering.
- Direct production probes measured roughly 1.3–4.0 seconds for uncached R2 starts. The private R2-binding Worker canary was deployed and verified but is not used as the public audio base because warmed measurements did not beat the direct endpoint consistently.
- `GAIA/NATA` was independently confirmed as an R2 `ServiceUnavailable` object. The same catalog key was rebuilt from the local AIFF source and replaced; Range requests now return `206` again without a catalog/API change.
- Release: `audiofix316-20260714`, Service Worker `infra-shell-20260714-audio316`, segment cache `infra-next-track-segments-v6`.
