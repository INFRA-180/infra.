# Implementation Notes

## 2026-07-17 — synchronisation Music/R2 événementielle et idempotente

- La boucle `He 4.0026` venait de l’ordre `publication live → génération statique → snapshot SQLite` : la génération reconstruisait le plan contre le catalogue déjà publié, détectait la même URL versionnée et échouait avant le snapshot. Le watcher relançait alors indéfiniment MARSELHA, CDM et H2o.
- Le LaunchAgent a été arrêté avant correction. La release live valide `catalog-20260717T112959Z-30b7200f03` a ensuite été adoptée dans SQLite depuis son manifeste local, sans conversion ni upload supplémentaire ; `diff-db` revient à zéro.
- Le flux automatique ne modifie plus le site statique ni le build PWA : il convertit uniquement les masters changés, upload/contrôle R2, publie le catalogue dynamique utilisé par la PWA, puis snapshotte SQLite. La génération du fallback Git reste une opération manuelle explicite.
- Une reprise compare d’abord SQLite au catalogue live. Si une publication a réussi avant un arrêt ou un échec tardif, son manifeste est adopté et le fichier n’est pas renvoyé. En l’absence d’un manifeste local strictement concordant, le lot est bloqué plutôt que dupliqué.
- La surveillance reste fondée sur `fs.watch` récursif/FSEvents, avec debounce et contrôle de stabilité. Le scan de sécurité passe de 60 secondes à 6 heures ; un scan est conservé au lancement pour rattraper veille/redémarrage.
- Un échec dispose d’une seule reprise après 30 minutes, puis le lot identique est mis en quarantaine jusqu’à un nouveau changement source. Le LaunchAgent et ses enfants tournent avec `Nice=10`.
- `/Users/infra/Music/iTunes/Music/Infra_` est une source strictement en lecture seule. Les deux outils refusent de démarrer si le projet, le runtime, SQLite ou le staging sont configurés sous cette racine. La signature des métadonnées de ses 286 fichiers est restée identique avant/après l’intervention.
- Validation locale : syntaxe Node/plist, adoption H2o, SQLite 11 pistes pour `He 4.0026`, `diff-db` 286/283/3 avec tous les compteurs à zéro, garde de frontière source et redémarrage LaunchAgent sans nouvelle synchronisation.

## 2026-07-17 — audiofix344 iOS lock-screen timeline scrubbing

- The accepted `audiofix343` restored Previous/Next on the iOS lock screen and in Notification Center, but it also removed `seekto`; WebKit could still display position from `setPositionState()` while having no action handler capable of applying a direct timeline change.
- Standalone iOS now registers `seekto` through the existing bounded `applyMediaSessionSeek()` path while continuing to remove `seekbackward` and `seekforward` explicitly. Previous/Next remain registered after those actions and are still reasserted after every successful track start and before the hidden-state handoff.
- The intended iOS action contract is therefore `play`, `pause`, `seekto`, `previoustrack`, `nexttrack`, without ±10-second commands. Other browser behavior is unchanged.
- Atomic public identifiers are `audiofix344-20260717` and `infra-shell-20260717-audio344`. The stylesheet remains byte-identical (SHA-256 `54beb11ab3d8c755749cce3c9e2fd8ce4e0bd092b0a0af48168b1cff252bd688`); audio source selection, prefetch, Worker/R2, playback modes and visual geometry are unchanged. Final lock-screen timeline validation remains the user's installed-iPhone test.

## 2026-07-17 — audiofix343 iOS lock-screen track controls

- The regression was introduced in `audiofix335`: a successful source change stopped forcing the Media Session action binding. WebKit can rebuild its remote-command set when the active media source changes or when a standalone PWA moves to the lock screen, allowing the default ±10-second seek commands to replace the intended playlist controls.
- Standalone iOS now explicitly removes `seekto`, `seekbackward` and `seekforward` with null handlers before registering `previoustrack` and `nexttrack`. The same four-action contract (`play`, `pause`, `previoustrack`, `nexttrack`) is reasserted after every successful track start and immediately before a visibility-hidden handoff. Other browsers retain the existing seek controls.
- This single Media Session contract serves both the iOS lock screen and Notification Center. Playback source, Radio/Album/Shuffle navigation, Media Session metadata/artwork, position reporting, prefetch, Worker/R2 and audio recovery are unchanged.
- Atomic public identifiers are `audiofix343-20260717` and `infra-shell-20260717-audio343`. The stylesheet is byte-identical (SHA-256 `54beb11ab3d8c755749cce3c9e2fd8ce4e0bd092b0a0af48168b1cff252bd688`): no visual, viewport, fullscreen, safe-area, Home Indicator or mini-player geometry change. Validation is code-only; final lock-screen and Notification Center validation remains the user's installed-iPhone test.

## 2026-07-17 — audiofix342 WebKit history quota and single album artwork source

- Backup before change: `bfef82c41905b6769b390a8fbbb361e330853105` is preserved by the verified bundle `SITE_backup/SITE_history_bfef82c_audiofix341_2026-07-17.bundle` and the annotated tag `backup-audiofix341-20260717`.
- The final audiofix341 iPhone telemetry showed `ADC 13`, `ABRICOT` and `PECHES` already available from `client:client_memory` with `response_ms=0`, followed by no `spa_render_start`. The remaining synchronous boundary was the unguarded History API write. The Home scroll listener also called `replaceState()` at animation-frame rate, which can exhaust WebKit's documented History API frequency quota before a card near the bottom is tapped.
- Scroll history persistence is now a 240 ms trailing debounce with unchanged-position suppression. `pushState()` and `replaceState()` go through the non-throwing router writer; a refused write records a compact `history_write_*` navigation reason and falls back to the exact document instead of leaving the current page frozen. The click and popstate entry points also terminate unexpected Promise failures with a real document navigation.
- Album catalogue normalization now always exposes one canonical `*-cover-1200.webp` URL and strips legacy `srcset`/`sizes`, including stale `/catalog/latest` payloads such as ADC13's JPEG plus 480/900 candidates. Home rendering defensively applies responsive candidates only to app icons. The local private catalogue synchronizer also generates and publishes the 1200 WebP as the single album-page/Home source for future releases.
- The only CSS change is the mobile navigation mini-player bottom inset from `20px + env(safe-area-inset-bottom)` to `16px + env(safe-area-inset-bottom)`. Its height, horizontal inset, fullscreen overlay/panel, viewport, status-bar treatment, Home Indicator safe area and bottom anchoring model are unchanged. New stylesheet SHA-256: `54beb11ab3d8c755749cce3c9e2fd8ce4e0bd092b0a0af48168b1cff252bd688`.
- Atomic public identifiers are `audiofix342-20260717` and `infra-shell-20260717-audio342`. Validation is code-only: History quota failure, debounced scroll contract, cached-route fallback, 31 catalogue pages/covers, canonical artwork, runtime audio invariants and Service Worker segment/shell behavior. Final installed-iPhone UX validation remains the user's test.

## 2026-07-17 — audiofix341 deterministic local album documents

- Real `audiofix340` iPhone sessions separated the remaining album stalls from rendering: successful album opens completed in 48–67 ms, while `BALLADES`, `سَلام`, `TROU NOIR` and `SANGUIN` remained unfinished for 2.5–18.9 s. Every stalled record had `response_ms=0`, `render_ms=0` and `cover_wait_ms=0`; all 31 catalogue pages were present in the installed manifest and returned public HTTP 200. The wait was therefore before the HTML response, not in the cover, DOM swap, mini-player or album data.
- SPA intent and click now share one URL-keyed request. Resolution order is completed client memory, the exact versioned shell through window `CacheStorage`, then one 2.5-second network fallback. A stale completion is rejected before history or DOM mutation. The page cache holds 40 documents and cache-only idle warmup reads all 31 album pages (about 263 KiB raw HTML) from the installed shell without starting network traffic.
- Versioned album HTML is immutable for the lifetime of its Worker. A shell hit is now strictly cache-first and no longer starts background revalidation; a real cache miss is network-deduplicated inside the Worker. Pointer/touch intent no longer forces a refresh, and successful renders no longer schedule another HTML fetch. The current page and persistent mini-player remain visible until the existing atomic swap.
- Atomic public identifiers are `audiofix341-20260717` and `infra-shell-20260717-audio341`. Audio playback, R2/Range `206`, prefetch cache v9, canonical 1200 WebP covers and telemetry delivery limits are unchanged. `styles.css?v=audiofix332-20260716` remains byte-identical (SHA-256 `2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`): no design, viewport, fullscreen geometry, safe-area or bottom-anchor change. Validation is code-only; final installed-iPhone UX validation remains the user's test.

## 2026-07-17 — audiofix340 active Worker handoff and HTML telemetry

- Real `audiofix339` sessions confirmed that successful album transitions were consistently fast (39–78 ms), while unfinished taps remained open on `سَلام` (18.1 s and 31.4 s), `ÉTOILES` (16.6 s) and `RUE DE PARIS` (7.3 s) until the PWA was hidden. All reported zero cover wait and no image timeout, locating the delay before render in the HTML response path. The public 339 JavaScript did not identify the controlling Worker, so a 339 page could still be controlled by an older network-first Worker without the telemetry proving it.
- A waiting Service Worker may now receive `SKIP_WAITING` only when the current client has no playing/starting audio, no fullscreen transition and no SPA navigation in progress. Controller change keeps the existing deferred-idle reload guard, so an update cannot interrupt playback or an active route. The active Worker also answers a version probe; the client retains that version across subsequent navigation diagnostics.
- Every shell-first HTML response carries same-origin diagnostic headers for Worker version, cache hit/miss, strategy and response latency. The existing single compact `spa_navigation` record absorbs those values as `strategy`, `cache_hint` and `response_ms`; it does not add a periodic request or a second Cloudflare telemetry delivery. This distinguishes an old controller, a true cache miss and a slow network response in the user's next lifecycle batch.
- Atomic public identifiers are `audiofix340-20260717` and `infra-shell-20260717-audio340`. The 31-document shell, canonical 1200 WebP covers, audio cache v9 and N+1…N+5 scheduler are unchanged. `styles.css?v=audiofix332-20260716` remains byte-identical: no design, viewport, fullscreen geometry, safe-area or bottom-anchor change. Validation is code-only; final PWA UX validation remains the user's test.

## 2026-07-17 — audiofix339 deterministic album navigation

- Real `audiofix338` iPhone telemetry isolated the apparent album freeze from audio and cover delivery. A cold `سَلام` navigation remained open for 7540 ms and a cold `TROU NOIR` navigation for 3040 ms before the PWA was hidden, both with `cached=false`; the next cached `سَلام` opening completed in 59 ms. Live checks returned `200` for every album page and canonical cover and `206` for all 283 catalogue audio sources. The fault was therefore the document path: SPA `fetch()` requests have no `document` destination, reached the Service Worker's network-first HTML branch, and displayed a foreground cover clone while waiting.
- All 31 album documents are now installed in the versioned shell. Native document navigations and SPA HTML fetches share the same cache-first/background-revalidate policy, so a first album tap no longer depends on mobile network once the new Service Worker is installed. Audio, R2, Range `206`, cache v9 and the N+1…N+5 scheduler are unchanged.
- Album taps no longer create the foreground cover clone. The current page and persistent mini-player remain visible and interactive until the already-cached destination is ready for the atomic DOM swap; a stale transition visual is cleared defensively. Home-return restoration keeps its separately bounded snapshot behavior. Session sealing now records `hidden`/`pagehide` as the reason for an unfinished SPA transition instead of exporting an unexplained abort.
- Atomic public identifiers are `audiofix339-20260717` and `infra-shell-20260717-audio339` across all 35 player documents. `styles.css?v=audiofix332-20260716` remains byte-identical (SHA-256 `2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`): no cover styling, design, viewport, fullscreen geometry, safe-area or bottom-anchor change. Validation is code-only; final installed-iPhone/mobile-network UX validation remains the user's test.

## 2026-07-17 — audiofix338 canonical covers and bounded PWA recovery

- The validated `audiofix337` rolling audio window remains intact: cache v9, 2 MiB startup segments, N+1…N+5 order, two mobile lanes, Range `206`, current-track priority and selective cancellation are unchanged. The only playback recovery added is a source- and token-guarded retry for an immediate first `NotSupportedError`: the same source is reset once, readiness is bounded to 650 ms on iOS, and a second failure returns to the existing recovery path instead of looping.
- Every catalogue album now has exactly one public artwork variant: one 1200×1200 WebP encoded at quality 90. Home cards, album pages, mini-player, fullscreen, backdrop, favourites and Media Session resolve the same canonical URL; legacy `srcset`, `sizes` and 480/900 runtime selection are removed. Live catalogue records are normalized at ingestion so a remote release cannot reintroduce another cover size. Lazy decoding is preserved, PWA warmup is limited to four visible covers and yields immediately to audio or navigation. The isolated `infra-covers-v2` cache prevents old responsive variants from being reused.
- SPA album requests now carry a navigation token from tap to terminal result. A repeated tap on the same in-flight album is coalesced instead of aborting its own transition; stale completions cannot clear the active route; an eight-second document timeout falls back to native navigation. Compact session telemetry correlates by token and retains the terminal reason, decoded cover width and physical display width, while all local correlation maps remain bounded.
- A newly installed Service Worker no longer calls or receives `skipWaiting` during an active client session. It remains waiting until the existing PWA clients close, avoiding a controller swap during audio startup while retaining normal activation cleanup on the next launch.
- Atomic public identifiers are `audiofix338-20260717` and `infra-shell-20260717-audio338` across all 35 player documents. `styles.css?v=audiofix332-20260716` remains byte-identical (SHA-256 `2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`): no design, viewport, fullscreen geometry, safe-area, bottom anchor or `100lvh` change. Validation is code-only (JavaScript syntax, runtime modes, SPA/transport, cache v9, Range/Service Worker migration, telemetry privacy, catalogue startup, canonical cover inventory/dimensions and frozen CSS); final installed-iPhone/mobile-network UX validation remains the user's test.

## 2026-07-17 — audiofix337 PWA transition latency and navigation continuity

- The audiofix336 iPhone test confirmed a much smoother application but still showed roughly one to two seconds between tracks, occasional mini-player disappearance and route flashes. Historical Safari telemetry over 37 transitions separates the causes: the JavaScript tap-to-`audio.play()` hot path was already fast (23 ms median, 33 ms p95), while WebKit requested the uncached tail immediately after consuming the prepared prefix. Prepared transitions still reached `playing` in 956 ms median and 2400 ms p95, so the source-switch architecture remains unchanged.
- Startup segments move to the incompatible `infra-next-track-segments-v9` cache and increase from 1 MiB to 2 MiB. The authoritative N+1…N+5 order, two-lane concurrency, six-entry cap, eight-second current-buffer gate, four-second abort, current-media priority, selective cancellation and rolling N+6…N+10 cycle are unchanged. The Service Worker accepts only v9 metadata, removes v8 at activation, keeps the exact WebKit `bytes=0-1` probe path and returns bounded zero-copy `206` responses without downloading complete files.
- SPA navigation now finalizes an open/closing fullscreen synchronously before capturing the source route, strips runtime-only body/snapshot classes, preserves the single `#infraSpaPersist` transport/audio root and reconciles the mini-player before the first destination paint. Native same-document View Transitions are bypassed only in standalone iOS, where the persistent root already provides an atomic swap. Destination status/root colour is also synchronized in that prepaint turn, removing the two-frame opportunity to show the previous route background. No CSS, cover policy, layout or fullscreen geometry changed.
- Remote telemetry remains one lifecycle delivery per hidden/pagehide session, with the existing limits of 48 retained events, four sessions, 72 hours and 32 KiB. Verbose local playback/prefetch/SPA stages are correlated into one `track_transition` per request, one `spa_navigation` per route and transition-only `mini_player_visibility` events. Full source paths are used only for in-memory correlation (including same-basename tracks) and are never exported. A protected `session_summary` retains prepared/unprepared counts, served prefetch hits, audible latency, waits/stalls, navigation, mini-player disappearance, errors and dropped-event totals even when detail events reach the cap.
- The compatible Worker was deployed before the public client as version `0b9dc831-f28f-4975-ab39-9b2f74a82e87` (source SHA-256 `e6d0e6fde410f2cf6aae1dd99fe800af0451ac3732197c3f55b7460bfd4c7787`). Protected status returns 200, unauthenticated status 401 and the public catalogue 200 after deployment; old session-v2 records remain readable.
- Atomic public identifiers are `audiofix337-20260717` and `infra-shell-20260717-audio337` across all 35 player documents. `styles.css?v=audiofix332-20260716` remains byte-identical (SHA-256 `2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`): no viewport, height, bottom anchor, safe-area, Home Indicator fill or `100lvh` change. Validation is code-only (syntax, runtime modes/cycle, cache v9/Range/SW migration, SPA/transport, client/Worker telemetry, catalogue, hardening and public boundary); final installed-iPhone/mobile-network UX validation remains the user's test.

## 2026-07-16 — audiofix336 PWA audio consolidation

- `audiofix335` had deliberately stopped linear playback at an album boundary, contrary to the validated requirement. Linear Next/Previous now extends the existing queue to the adjacent album in the explicit catalogue chronology; the same materialized order feeds transport, fullscreen queue and prefetch. Continuity is bounded at the first/last album and never wraps, so the queue cannot grow by repeatedly appending the catalogue.
- Mode changes are now single-owner and source-preserving. Radio remains global. Pressing Shuffle while Radio is active leaves Radio and rebuilds only the current album without restarting the current source. Shuffle Next uses one materialized album plan; Previous/Next walk a real per-session Shuffle history. Fast repeated transport taps keep request-token guards, and an obsolete async Radio transition cannot overwrite a newer mode.
- Mobile prefetch inspects N+1 in CacheStorage first. On a miss, only N+1 may use the network; N+2…N+5 cache inspection continues in the background without duplicate downloads, and the two mobile lanes fill the tail only after N+1 is ready or has exhausted its retry budget. N+1 gets one bounded third attempt for transient failures after exponential backoff and the stable-buffer gate; a reordered plan preempts the weakest old lane so the new N+1 cannot be starved. A prepared transport change retains useful work; an unprepared change, `waiting`, `stalled`, seek or media error aborts every speculative lane so the real source owns the mobile connection. Cache inspection invalidates stale “ready” flags, only the current buffered range can open the safety gate, invalid responses cancel their unread body, and a caller timeout waits for the serialized CacheStorage mutation then inspects its result before any network retry. Cache v8, 1 MiB segments, six-entry cap, Range `206`, R2/CORS and Service Worker routing remain unchanged.
- Repeated work was removed from the hot path: unchanged Radio queues are no longer re-synced, identical playback queues no longer rewrite `sessionStorage`, mini-player listeners cannot be rebound after a fullscreen reconstruction, album row Play stays inside the user gesture, and retry no longer resets the source before `startTrack`. Full asset-path matching replaces the unsafe filename comparison (two different albums contain `04-favora.m4a`). AbortError retry, media error recovery and mid-track stall recovery are token/source guarded; failure counters clear only after `playing`, so a broken URL cannot loop forever.
- Covers are resolved once per album URL and shared between mini-player, fullscreen/backdrop and Media Session. The closed fullscreen queue no longer creates up to 48 cover images; it renders on demand with 480 px thumbnails. SPA album navigation waits only for the destination cover, never displays the previous album cover as a placeholder, and no longer waits for an unrelated eight-cover warmup. Background warmup is idle-only, aborts as soon as audio starts and cannot resume during internal recovery. Legacy same-origin `/assets/...` cover URLs are repaired to the GitHub Pages `/infra./assets/...` prefix before fetch. Media Session consumes one canonical 900 px artwork URL directly, without a second Image/canvas/blob pipeline.
- Telemetry is session-based and quota-bounded: 48 events, four pending sessions, 72-hour TTL and a 32 KiB envelope. There is no heartbeat, periodic/threshold/online flush or `beforeunload` send. Hidden/pagehide makes one deduplicated keepalive attempt; if a previous-session retry is already in flight, exactly one follow-up is coalesced for the newly closed session. A failed sealed session stays in IndexedDB and is retried once on a later launch. Worker session keys are deterministic for retry deduplication while legacy status/export records remain readable.
- The supplied HAR and source audit distinguish the public fallback (31 albums / 280 tracks) from the moving live catalogue (31 / 283). The live auto-sync currently republishes `MARSELHA`, `CDM` and `H2o` before failing immutability checks, so audiofix336 intentionally does not freeze those unstable URLs into Git. Generator repair and an atomic 283-track fallback sync remain a separate operation. The Antique Olive relative CSS 404 is also left separate because the fullscreen stylesheet is frozen.
- Atomic public identifiers are `audiofix336-20260716` and `infra-shell-20260716-audio336` across all 35 player documents. `styles.css?v=audiofix332-20260716` remains byte-identical: no viewport, height, bottom anchor, safe-area, Home Indicator fill or `100lvh` change. Validation is code-only (syntax, runtime mocks, modes/history, prefetch/cache/Range/SW, telemetry client/Worker, catalogue and public boundary); final installed-iPhone/mobile-network UX validation remains the user's test.

## 2026-07-16 — audiofix335 strict album context, immediate time and lifecycle telemetry

- The supplied iPhone HAR (805 requests) confirms that the Service Worker already handles the bounded startup cache correctly: 21 of 23 Safari full-range requests were clipped to the cached 1 MiB `206` segment. The two R2 full-body responses had no ready segment beforehand. No speculative Range-routing change is therefore warranted.
- Linear album playback now stops at the last track instead of extending into the next album. Any restored non-Radio queue, including historical `album`, `global` and `favorites` payloads, is re-scoped to the active album (current page first, catalogue album fallback) before it can navigate or prefetch. With Radio off, toggling Shuffle reconstructs the current album context first; Radio itself remains the global playlist. These mode changes preserve the current source and position.
- A source-metadata-pending state makes the mini-player and fullscreen show `0:00` and zero progress immediately on a source change, then releases actual duration/progress on `loadedmetadata` or `durationchange`. Media Session handler binding is no longer needlessly forced on each track, and asynchronous artwork commits are ignored if their track is no longer current.
- Page lifecycle telemetry now uses anonymous `fetch(..., { credentials: "omit", keepalive: true })`, retaining the IndexedDB batch on failure instead of using cross-origin `sendBeacon`. Normal high-volume prefetch trace events are no longer sent remotely; diagnostic errors, suspension and ready-window signals remain.
- SPA cover fallback URLs in inline `onerror` handlers are rebased with the swapped document, fixing the real `/assets/music/v-23pi56-cover.jpg` root-path 404 without changing visual CSS.
- Release identifiers prepared across all 35 player documents are `audiofix335-20260716` and `infra-shell-20260716-audio335`. The frozen `styles.css` asset remains byte-identical (`2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`): no viewport, fullscreen geometry, safe area, bottom anchor or `100lvh` modification is included.
- Regression coverage covers strict album ending/migration, Radio and scoped Shuffle, immediate time state, stale Media Session artwork, explicit Safari full-range cache clipping, telemetry lifecycle privacy, cache migration, prefetch ordering and release boundaries. The unrelated Antique Olive font 404 remains documented separately because correcting its relative CSS path would change the frozen stylesheet; the HAR contains no source-map request.

## 2026-07-16 — audiofix334 measured mobile prefetch window

- Safari Web Inspector plus privacy-safe production telemetry measured nine iPhone transport taps in the audiofix333 session. Five 4 MiB prefetches started, only one completed (in 6186 ms), and no track was served from prefetch; taps arrived only 901–2201 ms after each fetch began. First bytes still arrived in 39–65 ms, proving that the dominant failure was segment readiness and WebKit buffering rather than the cached `206` reconstruction or CORS path.
- Startup segments move to the incompatible `infra-next-track-segments-v8` generation and shrink from 4 MiB to 1 MiB. At the catalogue's approximately 320 kbit/s encoding this still represents about 26 seconds of audio, matching the startup buffer observed on the phone, while the retained N+1…N+5 window falls from about 20 MiB to 5 MiB (six cached entries including the current segment at most).
- The eight-second current-buffer safety gate is retained, but it may now open from `progress`/`canplay` before the delayed `playing` event. N+1 is always selected first and N+2 immediately occupies the second permitted connection; completion or retry of N+1 no longer blocks the rest of the window. Rebase cancels the new current source and obsolete targets only, preserving useful in-flight and ready entries without a global reset. A real `waiting`/`stalled` event sheds only the least-priority speculative lane and retains the closest target; explicit seeking remains the forced full suspension path.
- Every explicit transport Previous/Next uses the synchronous source-switch path even when its target is not ready: no 100 ms fade and no 110 ms iOS readiness wait. Cache replacement uses one atomic `put` without a preceding delete gap, and pruning remains serialized with writes rather than being queued on every plan rebase.
- Prefetch plan, completion, cancellation, suspension, window-ready and cache-rehydration telemetry are retained without transmitting source URL arrays. The private `infra180-audio` Worker also preserves response/body/queue/cache and served-range timings; deployed version is `fd6b78d3-2e94-4add-9e33-ebea1fbefe72`, with local source SHA-256 `f99f82950025c444fc40af3afe3bbc58e0d1dc1c234a644a415eb50738b78e9d`.
- Atomic public identifiers are `audiofix334-20260716` and `infra-shell-20260716-audio334` across all 35 player documents. The validated fullscreen stylesheet remains byte-identical on `audiofix332-20260716` (SHA-256 `2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`); no viewport, height, bottom anchor, safe-area or `100lvh` change is present. Regression coverage includes a real 1 MiB cache/zero-copy `206`, pre-playing buffer gate, simultaneous N+1/N+2, retry without starvation, integrated Core+Radio five-tap N+6…N+10 rollover, telemetry privacy/Worker schema and v7-to-v8 migration. Final latency acceptance remains the user's installed-iPhone/mobile-network test.

## 2026-07-16 — audiofix333 rolling prefetch race and WebKit probe fast path

- The installed-iPhone test accepted audiofix332 startup and transport. Prefetch telemetry from earlier mobile sessions showed that an already prepared track normally reached playback in roughly 0.2–0.4 s; the remaining defects were therefore audited in the rolling scheduler and Service Worker rather than by changing the validated audio source or fullscreen geometry.
- A track change previously rebased the N+1…N+5 plan and then force-aborted every remaining request. The first step had already removed only the current/obsolete targets, so the second step discarded still-useful N+2…N+5 bodies and caused duplicate mobile downloads. Useful controllers now survive a fast skip only when the selected track was already prepared/served, and are rebound to the new authoritative generation, index and rank. An unprepared selected track still force-suspends speculation to receive mobile bandwidth priority; new work waits for its next `playing`/stable-buffer gate.
- The two permitted fetches previously entered the single CacheStorage mutation queue before their 4 MiB bodies were read. Body validation now proceeds concurrently, while delete/put/prune mutations remain serialized. The request timeout is cleared as soon as a body is completely validated, so time spent waiting for a cache write cannot create a false network timeout. Stage telemetry now distinguishes response, body, queue and cache time.
- WebKit commonly probes MP4/M4A with `Range: bytes=0-1`. New v7 entries retain those two validated bytes in cache metadata, allowing the Service Worker to return the exact two-byte `206` without materializing the 4 MiB cached body. Existing v7 entries without the additive header remain structurally compatible but are not promoted/rehydrated as ready; they are refreshed once when they re-enter the active window. Segment size 4 MiB, depth five, concurrency two, six-entry cap, direct R2/CORS routing and selective pruning are unchanged.
- Atomic identifiers are `audiofix333-20260716` and `infra-shell-20260716-audio333` across the 35 player documents and JavaScript shell assets. `styles.css` remains on the already validated `audiofix332-20260716` key and is byte-identical (`2e4be5a34461bb0107ef4d6c4cc2bb4737738f10e8743a2b0f2cd18b192bdcdb`); no viewport, height, bottom anchor, safe-area or `100lvh` change is present.
- Regression coverage passes for parallel body validation, serialized cache writes, fast-skip controller preservation/completion, N+1 priority, rolling N+6…N+10 order, timeout/retry, exact two-byte `206`, no-cors bypass, CORS, telemetry privacy, catalogue startup, public boundary, release boundary and frozen CSS. Final latency validation remains the user's installed-iPhone/mobile-network test after publication.

## 2026-07-16 — audiofix332 WebKit CORS/Range and telemetry privacy

- Real-device Safari Web Inspector proved that failed M4A requests were valid `206 Partial Content` responses with `Sec-Fetch-Mode: no-cors` and `Source: Service worker`. The prefetch fetches were already CORS, but the shared media element explicitly removed `crossorigin`, and the Service Worker intercepted every R2 GET including native no-cors media Range requests.
- Every global, restored, reset and direct audio source now sets `crossOrigin = "anonymous"` before assigning `src`. The Service Worker intercepts only simple Range GETs whose request mode is already `cors`; no-cors, non-Range and multi-Range media requests bypass `respondWith` and remain native WebKit loads. Cached startup segments remain v7 and synthetic hits keep bounded `206`, exact active-origin ACAO and `Vary: Origin`.
- Remote audio telemetry is restricted client-side to `https://infra-180.github.io`. Cover/favorites startup noise is no longer transmitted. The local queue is capped at 100 entries with a 24-hour TTL, and network payloads exclude the full User-Agent, local time, complete URLs, paths, free-form messages, local queue identifiers and global session identifiers. A random trace exists only per playback attempt.
- The Cloudflare Worker now reconstructs telemetry from a strict primitive allowlist, accepts `/log` only from the official Origin, and gives new KV batches a seven-day TTL. Status/export remain protected and merge `batch2:`, `batch:` and `log:` records before chronological limiting; Sphragis, catalogue and audio endpoints retain their existing CORS contracts. Existing older KV batches are not destructively purged by this rollout.
- Runtime `waiting`, `stalled`, `suspend` and heartbeat events inherit the active Play token when they do not carry one explicitly, so their privacy-safe per-attempt trace remains scientifically usable without a global session identifier. The deployed Worker version is `bab3e7f7-f24d-48aa-b499-f7a08de4e59d`; the local private source SHA-256 is `33e0fabfe00c94215dc54aea893181246d2eea24c183a9815cbccd04db5d487d`.
- Cloudflare account inspection found no DNS zone, Worker Custom Domain or R2 Custom Domain. A direct account-subdomain replacement was rejected by Cloudflare without changing live state, so a neutral `infra180-api.pages.dev` façade was deployed instead and connected to `infra180-audio` through an internal Service Binding. Public runtime, catalogue, telemetry and Sphragis now use that neutral hostname; the second account Worker and the existing cached PWA endpoint are not disrupted. The personal hostname is absent from shipped code, and the existing R2 CORS rule for the GitHub Pages origin was verified live with a `206 bytes 0-1` response.
- The neutral façade production deployment is `b4f8c3d8-fc25-46b7-830f-acd62d3ac59e`. Its `_worker.js` SHA-256 is `823e2a704ab1015c773adef378bc40799e04576f478270906a9577ce898966d6`; it forwards the original Request unchanged through the `AUDIO_API` Service Binding, preserving Origin, Range and authorization semantics. Live checks returned catalogue `200`, protected status `401`, official `/log` preflight and POST `204`, foreign Origin `403`, Sphragis rejection without disclosure, and audio `206 bytes 0-1` with Range/CORS headers.
- Once GitHub Pages served the neutral runtime and collision-free Sphragis asset, public `workers.dev` and preview URLs were disabled only for `infra180-audio`; the account's unrelated `infra180` Worker remains public. The old audio hostname now returns `404`, while the Pages façade still returns catalogue `200` and audio Range `206`. The private Wrangler configuration SHA-256 is `aaaa17b0711ac99f9d93aa98c59c384b9b4c3a1e83ea3596a04661e6a0ac0930`.
- The Sphragis runtime receives the collision-free asset key `sphragis20260716` in both its page and the new shell cache, preventing an older Service Worker or HTTP cache from retaining the personal endpoint after migration.
- Atomic public identifiers are `audiofix332-20260716` and `infra-shell-20260716-audio332`. Prefetch depth, 4 MiB segment size, two-lane concurrency and cache v7 are intentionally unchanged so the iPhone test isolates the CORS/Service Worker correction. The frozen fullscreen stylesheet remains byte-identical; no viewport, height, lower anchor, safe-area or `100lvh` change is included.
- Regression coverage includes CORS prefetch requests, no-cors Service Worker bypass, Range hits/misses and `If-Range`, per-attempt telemetry traces, local TTL/cap, field stripping, Worker Origin enforcement/TTL/schema, cold Play, rolling N+1…N+5, album persistence, public boundary and a browser navigation smoke test with zero runtime errors. Final media validation remains the user's installed-iPhone/mobile-network test.

## 2026-07-15 — audiofix331 PWA startup, persistent segment reuse and mobile UI polish

- PWA navigation again returns the installed HTML shell cache-first and revalidates it in the background. Catalogue startup reads the three local/SW JSON documents and the previous validated live CacheStorage bundle without network waiting; the cached live release wins when present, while `/catalog/latest` refresh runs detached and is awaited only when neither local source exists, removing the observed 3500 ms startup gate without freezing Worker-only releases out of later launches.
- The global transport remains visible on a cold album route without inventing a playback session. Its Play control can start the prepared album, while fullscreen remains unavailable until a real source exists. Mini-player current and duration placeholders are now always `0:00`, including the exact `currentTime === 0` case after metadata becomes available.
- The Now Playing cover keeps the frozen audiofix329 dimensions and position. Only its rasterization changes: the wrapper owns the rounded clip and the image is composited with a centered `scale(1.002)` overscan, eliminating the one-physical-pixel WebKit edge without changing viewport, panel, bottom anchoring or safe areas.
- Cache v7 is now inspected from stored metadata headers before any network fetch. Valid N+1…N+5 segments rehydrate the ready window without reading bodies or rewriting entries; generation, plan-key and current-source guards reject stale asynchronous results. A prepared cold Radio queue opportunistically promotes its first already-cached track before the user tap, but never waits for CacheStorage inside the gesture stack and never downloads audio before Play.
- The Service Worker streams a full cached startup segment directly as a bounded `206` response instead of copying its 4 MiB body through `arrayBuffer()` only when the entry carries the integrity-at-write marker added after body-length validation. Legacy/unmarked entries take the checked copy path once, sub-ranges retain checked slicing, corrupt metadata/body falls back to R2, and cache depth 5, segment size 4 MiB, concurrency 2 and the v7 namespace remain unchanged.
- Atomic release identifiers are `audiofix331-20260715` and `infra-shell-20260715-audio331` across all 35 player documents and the 41-entry shell. No `100lvh`, viewport, fullscreen height, bottom fill or Home Indicator change is included.
- Validation: cache headers/body guards, Range `206` fast path, stale hydration races, synchronous cold Play, cyclic/shuffle order, catalogue-local startup with a suspended live endpoint, public boundary, 31 albums/280 tracks/280 durations, 35-document version boundary, diff check and Chromium 390×844 album cold/open/inter-album smoke all pass with no console warning/error. Final installed-PWA and cover-edge acceptance remains the user's iPhone/mobile-network test after publication.

## 2026-07-15 — audiofix330 mobile Radio startup and rolling segment window

- The home mini-player now prepares the real Radio catalogue and a materialized Radio queue from `tracks.json` without issuing any audio request. While that metadata is unavailable, cold Play remains disabled; the first accepted tap activates Radio and calls `audio.play()` directly in the same user-gesture stack, bypassing the historical 110 ms readiness wait.
- Upcoming playback uses one authoritative order shared by the Next command and prefetch. Radio, linear album continuity and materialized Shuffle expose a rolling N+1…N+5 window; every consumed head rebases the window and appends the next target, so five changes naturally advance preparation to N+6…N+10.
- Startup cache v7 stores 4 MiB initial segments, gives N+1 absolute priority while its two-attempt budget remains, then lets N+2…N+5 continue if that single file is unavailable. It permits at most two requests in flight and begins only after `playing` plus at least eight buffered seconds on the current track. Normal navigation keeps useful segments, aborts obsolete work and caps storage at six entries (about 20 MiB ahead / 24 MiB including the current prepared track); no playback path clears the complete cache.
- The Service Worker serves a cached segment only as a valid bounded `206 Partial Content` response when the requested Range starts inside that segment and `If-Range` is compatible. Other ranges go to R2; corrupt entries alone are evicted, old prefetch cache generations are removed during activation, and cache-hit telemetry is scoped to the requesting client.
- Album navigation no longer destroys a paused or starting session. Source, position, queue and the persistent mini-player survive route changes; fullscreen finish, cancel and timeout converge on the same finalizer. Album pages no longer inject their redundant top Previous/Play/Next/Shuffle controls, while row Play, favorites, downloads and the global transport remain.
- The frozen fullscreen stylesheet remains byte-for-byte `audiofix329-20260715` (no viewport, height, bottom anchor, safe-area or `100lvh` change). JavaScript is published atomically as `audiofix330-20260715` with Service Worker `infra-shell-20260715-audio330`.
- Regression coverage: synchronous cold Play, linear and materialized-Shuffle ordering, N+1 priority, rolling N+6…N+10 cycle, buffer gate, two-lane concurrency, selective cancellation, cache v7 normalization, Range `206`, timeout/migration behavior, fullscreen cancellation and the 35-document release boundary. Final latency and no-stall acceptance remain the user's real-iPhone/mobile-network validation.

## 2026-07-15 — audiofix329 iOS standalone full-screen viewport correction

- Restored `viewport-fit=cover` on the main PWA shell so WebKit can paint the artwork behind the status bar and expose the top/bottom safe-area insets.
- Real-device Web Inspector measurements showed an `844px` screen but a `797px` `100dvh`/fixed overlay in standalone. A standalone-only mobile override now lets `100vh` size the open roots, overlay and panel to the covered screen, following the workaround documented in WebKit bug 254868.
- The overlay remains `position: fixed; inset: 0`; the existing body scroll lock, top-safe control padding, artwork-only top extension and removal of `.now-playing-overlay::after` are unchanged.
- No `100lvh`, negative bottom anchor, bottom pseudo-element or separate fill under the Home Indicator is introduced.
- Release assets: `audiofix329-20260715` stylesheet and `infra-shell-20260715-audio329`. Final visual confirmation remains the user's real-iPhone validation after publication.

## 2026-07-15 — audiofix327 artwork-only status-bar extension

- Retained the exact `audiofix325` mobile fullscreen geometry already present in `audiofix326`: the fixed overlay remains at `inset: 0`, and the panel keeps its existing `100vh` / `100dvh` height, bottom anchoring, safe-area padding and content flow.
- Kept the `audiofix326` removal of `.now-playing-overlay::after`; no replacement layer is painted behind the Home Indicator.
- Only the mobile `.now-playing-backdrop` artwork surface extends upward by `env(safe-area-inset-top)`. Its right, bottom and left edges remain at `0`, so the panel, content and lower fullscreen edge do not move.
- Top-safe spacing remains on the panel and controls. No `100lvh`, lower fill, bottom offset or bottom pseudo-element is introduced.
- The stylesheet asset is bumped to `audiofix327-20260715` and the shell cache to `infra-shell-20260715-audio327`; JavaScript remains on `audiofix326-20260715` because audio, transport, Media Session, prefetch and Service Worker routing behavior are unchanged.

## 2026-07-15 — audiofix326 iOS fullscreen status-bar layer removal

- A real installed-PWA test on iPhone 13 Pro / iOS 18.7.1 proved that .now-playing-overlay::after paints directly behind the status-bar clock and icons, while a runtime theme-color change does not alter the Home Indicator area.
- Removed only the solid .now-playing-overlay::after safe-area layer. The dynamic backdrop and overlay remain at inset: 0; top safe-area spacing stays on the panel and controls; the lower player layout is unchanged.
- setThemeColor(safeColor) remains intact because the physical-device test excluded it as the source of the lower system area.
- The release is atomically versioned as audiofix326-20260715 across the 35 player HTML documents, runtime identifiers and Service Worker precache, with cache namespace infra-shell-20260715-audio326.
- Audio, N+1 prefetch, Media Session, transport behavior and Service Worker routing are unchanged. Final conformity remains conditional on the installed iOS 18.7.1 PWA test after publication.

## 2026-07-15 — audiofix325 iOS fullscreen safe-area split

- A real iPhone test showed that audiofix324's artwork-derived color on `html` and `body` also painted the lower system area behind the Home Indicator as a separate band.
- The extracted dark color is now stored only on `.now-playing-overlay` as `--now-playing-safe-area-bg` and painted by `.now-playing-overlay::after` at the top with `height: env(safe-area-inset-top)`. The existing full-screen `::before` gradients remain unchanged.
- `html.now-playing-open` and `body.now-playing-open` use the player's static `#050609` fallback instead of any artwork color. The overlay's normal translucent surface and no-backdrop-filter fallback are restored, while the backdrop remains `position: absolute; inset: 0` behind the Home Indicator.
- `viewport-fit=cover`, `black-translucent`, the top-safe control offsets, lower-player layout and `#infraSpaPersist` parentage are unchanged. Transport, audio, N+1 prefetch and the Service Worker are untouched.
- Only `styles.css` and `now-playing.js` receive the targeted `audiofix325-20260715` asset query in the 35 player documents; the runtime and Service Worker stay on their existing audiofix324 identifiers.
- Validation: JS/SW syntax, public and Sphragis boundaries, catalog (31 albums / 280 tracks / 41 shell assets), 36 PWA heads, diff check and Chromium mobile 390×844 open/close passed. The extracted color existed only on the overlay, a simulated 47 px top inset ended at 47 px, roots/theme were restored on close and playback continued. Final iOS PWA confirmation remains required.

## 2026-07-15 — audiofix324 iOS status-bar artwork continuity

- Restored `viewport-fit=cover` on all 36 PWA HTML documents while retaining `apple-mobile-web-app-capable=yes`, `black-translucent` and manifest `display: standalone` (no fullscreen workaround).
- The fullscreen overlay remains inside `#infraSpaPersist`: the audited ancestor chain has no `transform`, `filter`, `perspective` or `contain`, and the SPA renderer requires that persistent root.
- `.now-playing-overlay` stays viewport-fixed at `inset: 0`; `.now-playing-backdrop` is now absolute at `inset: 0`. The painted layers carry no top safe-area offset.
- The artwork-derived dark color now backs `html.now-playing-open`, `body.now-playing-open`, the overlay and `theme-color`; closing clears the temporary surface color and restores the previous page background/theme.
- Top safe-area compensation remains on the panel, close control and interactive queue content. The lower player layout, audio, Service Worker Range routing and N+1 prefetch logic are unchanged.
- Validation: JS/SW syntax, public boundary, catalog (31 albums / 280 tracks / 41 shell assets), all 36 heads, diff check, and Chromium mobile 390×844 open/close smoke passed with no UI/runtime error during the cycle. A later localhost-only R2 CORS error came from the unchanged N+1 prefetch. Real iOS 18.7 PWA validation remains required.
- Runtime/SW cache-busting uses the collision-free pair `audiofix324-20260715` / `infra-shell-20260715-audio324`.

## 2026-07-14 — rollback audiofix324 to e637b42

- Production telemetry for audiofix324 after rapid-track tests showed 5 playback attempts with a median play_call to playing delay of 3512.5 ms and a maximum of 5854 ms.
- Four AbortError events occurred while the document was hidden; no prefetch_start or served_from_prefetch events were recorded in those sessions.
- Restored the tracked public tree exactly from commit e637b42 (audiofix323), preserving the known-good passive startup recovery and previous prefetch behavior.

## 2026-07-14 — audiofix324 radio prefetch start and zeroed mini-player time

- Radio N+1 prefetch may now start on a confirmed "playing" event for an already-ready track with at least 250 ms of progress; short-track, near-end, in-flight and attempted guards remain unchanged.
- The full-file cache, 15 MiB limit, single-entry policy and Service Worker Range handling are unchanged.
- The mini-player now displays "0:00" instead of "--:--" while the active source duration is not available; catalog and Up Next unknown-duration placeholders remain unchanged.
- Runtime/SW cache-busting was bumped to "audiofix324-20260714" / "infra-shell-20260714-audio324".

## 2026-07-14 — audiofix323 passive iOS startup recovery

- Kept the July 3 full-file N+1 prefetch unchanged: one `infra-next-track` entry, one in-flight request and the existing 15 MiB cap.
- `waiting`/`stalled` recovery is now passive until the media element has emitted `playing` and progressed beyond 250 ms; this prevents the 700 ms recovery timer from calling `audio.load()` during an iOS startup and aborting the user Play request.
- No CSS, player layout, Service Worker routing, Range reconstruction, Media Session, favorites, Worker/R2 or segment logic changed.
- Runtime/SW cache-busting was bumped to `audiofix323-20260714` / `infra-shell-20260714-audio323`.


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

## 2026-07-15 — Restore the July 3 PWA viewport geometry

- The main PWA shell no longer opts into `viewport-fit=cover`, restoring the July 3 viewport mapping that reached the physical bottom of the iPhone screen.
- Live Web Inspector measurements on the installed PWA showed a `844px` screen but a `797px` viewport and matching `html`, `body`, overlay, and panel bottoms; the missing `47px` matched the top safe-area inset.
- No mobile overlay or panel height, bottom anchor, or bottom filler changed. The removed status-bar overlay layer, safe top control spacing, and artwork-only top extension remain intact.
- Release shell: `infra-shell-20260715-audio328`; the unchanged fullscreen stylesheet remains `audiofix327-20260715`.
