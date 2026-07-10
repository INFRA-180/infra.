(function () {
  "use strict";

  const FINE_EVENTS = new Set([
    "album_switch",
    "audio_pause",
    "audio_play",
    "audio_session_state",
    "cache_hit",
    "click_track",
    "cover_error",
    "cover_prepare_done",
    "cover_prepare_error",
    "cover_prepare_item",
    "cover_prepare_start",
    "cover_decode_duration",
    "cover_loaded",
    "cover_request",
    "error",
    "album_continuity_extend",
    "album_open_done",
    "album_open_fail",
    "album_open_tap",
    "canplay",
    "external_play_resume",
    "external_play_start",
    "external_play_duplicate",
    "external_resume_stuck",
    "external_resume_recovery_start",
    "external_resume_recovery_resolved",
    "external_resume_recovery_failed",
    "fav:path_missing",
    "fav:path_resolved",
    "fav:write",
    "fav_select_tap",
    "first_byte",
    "favorite_add",
    "favorite_remove",
    "favorites_open",
    "favorites_play",
    "favorites_reorder",
    "favorites_render_done",
    "favorites_render_fail",
    "favorites_render_start",
    "favorites_visible",
    "home_fav_tap",
    "global_playlist_build_done",
    "global_playlist_build_start",
    "heartbeat",
    "initial_random_tap",
    "ios_recovery_wait",
    "source_resolved",
    "source_assigned",
    "startTrack_enter",
    "system_auto_resume_blocked",
    "load_called",
    "media_session_nexttrack",
    "media_session_pause",
    "media_session_play",
    "media_session_previoustrack",
    "transport_nexttrack",
    "transport_previoustrack",
    "play_request",
    "play_complete",
    "playable",
    "prefetch_done",
    "prefetch_error",
    "prefetch_start",
    "ready_wait_start",
    "ready_wait_end",
    "recovery_start",
    "recovery_resolved",
    "recovery_failed",
    "resume_probe",
    "served_from_prefetch",
    "silent_check",
    "ended",
    "auto_advance_attempt",
    "play_call",
    "play_resolved",
    "play_rejected",
    "playing",
    "perf_boot",
    "perf_interactive",
    "perf_long_task",
    "perf_audio_start",
    "perf_cover_render",
    "perf_module_load_error",
    "perf_prefetch_decision",
    "perf_spa_navigation_start",
    "perf_spa_navigation_done",
    "seek",
    "spa_swap_done",
    "spa_swap_start",
    "spa_scroll_restore",
    "spa_render_done",
    "spa_render_start",
    "nav:album_abort",
    "nav:album_done",
    "nav:album_start",
    "stalled",
    "sw_controllerchange",
    "sw_optional_cache_error",
    "sw_reload_executed",
    "sw_reload_pending",
    "suspend",
    "visibilitychange",
    "waiting"
  ]);
  const MAX_REQUESTS = 24;
  const DB_NAME = "infra_audio_telemetry_v1";
  const DB_STORE = "events";
  const QUEUE_CAP = 500;
  const FLUSH_THRESHOLD = 12;
  const FLUSH_DELAY_MS = 6000;
  const RETRY_INTERVAL_MS = 5 * 60 * 1000;
  const FLUSH_BATCH_CAP = 24;
  const HEARTBEAT_MS = 5 * 60 * 1000;

  function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function createSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_err) {
      // Fallback below.
    }
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function call(ctx, name) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;
    try {
      return ctx[name].apply(ctx, Array.prototype.slice.call(arguments, 2));
    } catch (_err) {
      return undefined;
    }
  }

  function createTelemetry(context) {
    const ctx = context || {};
    const fineStarts = new Map();
    const fineAuto = new Map();
    const sessionId = createSessionId();
    let dbPromise = null;
    let queue = [];
    let queueLoaded = false;
    let flushInFlight = false;
    let flushTimer = null;
    let heartbeatTimer = null;
    let eventCounter = 0;
    let lifecycleInitialized = false;
    let healthSessionActive = false;
    let healthSessionStartedAt = 0;

    function getWorkerUrl() {
      return String(call(ctx, "getWorkerUrl") || "").trim();
    }

    function getRuntimeVersion() {
      return String(call(ctx, "getRuntimeVersion") || "").trim();
    }

    function getAudioState() {
      return call(ctx, "getAudioState") || {};
    }

    function getAudio() {
      return call(ctx, "getAudio") || getAudioState().audio || null;
    }

    function getUaClass() {
      if (call(ctx, "isIosDevice")) {
        return call(ctx, "isStandaloneDisplayMode") ? "ios_pwa" : "ios_safari";
      }
      if (call(ctx, "isAndroidDevice")) return "android";
      return "desktop";
    }

    function getEnvironment() {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      let localTime = "";
      try {
        localTime = new Date().toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short"
        });
      } catch (_err) {
        localTime = new Date().toString();
      }
      return {
        effective_type: connection && connection.effectiveType ? String(connection.effectiveType) : "",
        navigator_on_line: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        visibility_state: document.visibilityState || "",
        local_time: localTime
      };
    }

    function getAutoFlag(type, data, requestToken) {
      if (data && data.trigger === "auto") return true;
      if (data && data.auto === true) return true;
      if (Number.isFinite(requestToken) && fineAuto.has(requestToken)) {
        return Boolean(fineAuto.get(requestToken));
      }
      return false;
    }

    function pruneFineMaps() {
      while (fineStarts.size > MAX_REQUESTS) {
        const key = fineStarts.keys().next().value;
        fineStarts.delete(key);
        fineAuto.delete(key);
      }
    }

    function getBufferedEnd() {
      const audio = getAudio();
      if (!audio || !audio.buffered || !audio.buffered.length) return null;
      try {
        const end = audio.buffered.end(audio.buffered.length - 1);
        return Number.isFinite(end) ? Math.round(end * 1000) / 1000 : null;
      } catch (_err) {
        return null;
      }
    }

    function getRuntimeProbeState() {
      const audio = getAudio();
      return {
        current_time: audio && Number.isFinite(audio.currentTime) ? Math.round(audio.currentTime * 1000) / 1000 : null,
        buffered_end: getBufferedEnd(),
        duration: audio && Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) / 1000 : null,
        ready_state: audio ? audio.readyState : null,
        network_state: audio ? audio.networkState : null
      };
    }

    function markHealthSessionActive() {
      if (healthSessionActive) return;
      healthSessionActive = true;
      healthSessionStartedAt = Date.now();
    }

    function markHealthSessionInactive() {
      healthSessionActive = false;
      healthSessionStartedAt = 0;
    }

    function getHealthSessionState() {
      return {
        health_session_active: Boolean(healthSessionActive),
        health_session_age_ms: healthSessionActive && healthSessionStartedAt
          ? Math.max(0, Date.now() - healthSessionStartedAt)
          : 0
      };
    }

    function createEventId() {
      eventCounter += 1;
      return [
        "ev",
        Date.now().toString(36),
        eventCounter.toString(36),
        Math.random().toString(36).slice(2, 8)
      ].join("-");
    }

    function openDb() {
      if (!("indexedDB" in window)) return Promise.resolve(null);
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve) {
        let request;
        try {
          request = indexedDB.open(DB_NAME, 1);
        } catch (_err) {
          resolve(null);
          return;
        }
        request.onupgradeneeded = function () {
          const db = request.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE, { keyPath: "_telemetry_id" });
          }
        };
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          resolve(null);
        };
        request.onblocked = function () {
          resolve(null);
        };
      });
      return dbPromise;
    }

    function withStore(mode, callback) {
      return openDb().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          let transaction;
          try {
            transaction = db.transaction(DB_STORE, mode);
            const store = transaction.objectStore(DB_STORE);
            const result = callback(store);
            transaction.oncomplete = function () {
              resolve(result && Object.prototype.hasOwnProperty.call(result, "result") ? result.result : result);
            };
            transaction.onerror = function () {
              resolve(null);
            };
            transaction.onabort = function () {
              resolve(null);
            };
          } catch (_err) {
            resolve(null);
          }
        });
      });
    }

    function deleteEvents(ids) {
      if (!ids || !ids.length) return;
      withStore("readwrite", function (store) {
        ids.forEach(function (id) {
          store.delete(id);
        });
        return true;
      }).catch(function () {});
    }

    function pruneQueue() {
      if (queue.length <= QUEUE_CAP) return;
      const dropCount = queue.length - QUEUE_CAP;
      const dropped = queue.splice(0, dropCount);
      deleteEvents(dropped.map(function (event) { return event._telemetry_id; }));
    }

    function loadQueue() {
      if (queueLoaded) return Promise.resolve(queue);
      return withStore("readonly", function (store) {
        return store.getAll();
      }).then(function (stored) {
        const merged = new Map();
        (Array.isArray(stored) ? stored : []).forEach(function (event) {
          if (event && event._telemetry_id) merged.set(event._telemetry_id, event);
        });
        queue.forEach(function (event) {
          if (event && event._telemetry_id) merged.set(event._telemetry_id, event);
        });
        queue = Array.from(merged.values()).sort(function (a, b) {
          return Number(a.timestamp_ms || 0) - Number(b.timestamp_ms || 0);
        });
        queueLoaded = true;
        pruneQueue();
        return queue;
      });
    }

    function persistEvent(event) {
      withStore("readwrite", function (store) {
        return store.put(event);
      }).catch(function () {});
    }

    function removeBatch(batch) {
      const ids = new Set(batch.map(function (event) { return event._telemetry_id; }));
      queue = queue.filter(function (event) {
        return !ids.has(event._telemetry_id);
      });
      deleteEvents(Array.from(ids));
    }

    function postBatch(batch, options) {
      const opts = options || {};
      const workerUrl = getWorkerUrl();
      if (!batch.length || typeof fetch !== "function" || !workerUrl) return Promise.resolve(false);
      return fetch(`${workerUrl.replace(/\/+$/, "")}/log`, {
        method: "POST",
        // A simple content type avoids a CORS preflight during page lifecycle transitions.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(batch),
        keepalive: Boolean(opts.keepalive)
      }).then(function (response) {
        return response && response.ok;
      }).catch(function () {
        return false;
      });
    }

    function flushQueue(options) {
      const opts = options || {};
      if (flushInFlight) return Promise.resolve(false);
      flushInFlight = true;
      return loadQueue().then(function () {
        if (!queue.length) return false;
        const batch = queue.slice(0, FLUSH_BATCH_CAP);
        if (typeof fetch !== "function" && opts.beacon && navigator.sendBeacon && getWorkerUrl()) {
          try {
            const blob = new Blob([JSON.stringify(batch)], { type: "text/plain;charset=UTF-8" });
            const queued = navigator.sendBeacon(`${getWorkerUrl().replace(/\/+$/, "")}/log`, blob);
            if (queued) {
              removeBatch(batch);
              return true;
            }
          } catch (_err) {
            // Fall through to fetch below when possible.
          }
        }
        return postBatch(batch, { keepalive: Boolean(opts.keepalive) }).then(function (ok) {
          if (ok) {
            removeBatch(batch);
            if (queue.length) scheduleFlush(queue.length >= FLUSH_THRESHOLD ? 1200 : FLUSH_DELAY_MS);
          } else {
            scheduleFlush(RETRY_INTERVAL_MS);
          }
          return ok;
        });
      }).finally(function () {
        flushInFlight = false;
      });
    }

    function scheduleFlush(delayMs) {
      if (flushTimer) return;
      flushTimer = window.setTimeout(function () {
        flushTimer = null;
        flushQueue();
      }, Math.max(0, Number(delayMs) || 0));
    }

    function enqueue(event) {
      if (!event || typeof event !== "object") return;
      const queued = Object.assign({ _telemetry_id: createEventId() }, event);
      queue.push(queued);
      pruneQueue();
      persistEvent(queued);
      scheduleFlush(queue.length >= FLUSH_THRESHOLD ? 0 : FLUSH_DELAY_MS);
    }

    function getMonitorTrackValue(payload) {
      const path = String(payload && payload.track_path ? payload.track_path : "").trim();
      if (path) {
        return path
          .replace(/^assets\/music\/streams\//, "")
          .replace(/^assets\/audio\//, "audio/");
      }
      return String(payload && payload.track ? payload.track : "unknown");
    }

    function getAudioSource(src) {
      return call(ctx, "getAudioSource", src) || "";
    }

    function trackRuntimeEvent(type, data) {
      const workerUrl = getWorkerUrl();
      if (ctx.fineTelemetryEnabled === false || typeof fetch !== "function" || !workerUrl) return;
      const eventType = String(type || "").trim();
      if (!FINE_EVENTS.has(eventType)) return;

      const source = data && typeof data === "object" ? data : {};
      const requestToken = Number(source.request_token);
      const eventNow = now();

      if (eventType === "playing" || eventType === "play_resolved" || eventType === "heartbeat") {
        markHealthSessionActive();
      }

      if (eventType === "click_track" && Number.isFinite(requestToken)) {
        fineStarts.set(requestToken, eventNow);
        fineAuto.set(requestToken, getAutoFlag(eventType, source, requestToken));
        pruneFineMaps();
      }

      const audioState = getAudioState();
      const startedAt = Number.isFinite(requestToken) && fineStarts.has(requestToken)
        ? fineStarts.get(requestToken)
        : audioState.audioClickPerfTs;
      const deltaMs = Number.isFinite(startedAt) && startedAt > 0 ? Math.max(0, Math.round(eventNow - startedAt)) : null;
      const auto = getAutoFlag(eventType, source, requestToken);
      const errorName = source.reason || source.error_name || "";
      const trackPath = String(source.track_path || "").trim();
      const trackValue = getMonitorTrackValue(source);
      const providedDeltaMs = Number(source.delta_ms);
      const normalizedDeltaMs = Number.isFinite(providedDeltaMs)
        ? Math.max(0, Math.round(providedDeltaMs))
        : (eventType === "click_track" ? 0 : deltaMs);

      const body = Object.assign({}, source, getEnvironment(), getHealthSessionState(), {
        event: eventType,
        fine_event: true,
        session_id: sessionId,
        build: getRuntimeVersion(),
        timestamp_ms: Date.now(),
        ts_client: new Date().toISOString(),
        delta_ms: normalizedDeltaMs,
        duration_before_play_ms: eventType === "click_track" ? 0 : normalizedDeltaMs,
        track: trackValue,
        track_path: trackPath,
        album: String(source.album || "").toLowerCase(),
        source: source.source || getAudioSource(source.src),
        ua_class: getUaClass(),
        auto,
        error: eventType === "play_rejected",
        error_name: errorName,
        browser: String(navigator.userAgent || "")
      });

      enqueue(body);
    }

    function buildMonitorPayload(track, index, src) {
      return call(ctx, "buildMonitorPayload", track, index, src) || {};
    }

    function sendMonitoringLog(track, index, src, data) {
      const workerUrl = getWorkerUrl();
      if (typeof fetch !== "function" || !workerUrl) return;
      if (!data || data.error !== true) markHealthSessionActive();
      const payload = buildMonitorPayload(track, index, src);
      const audioState = getAudioState();
      const elapsed = audioState.playRequestTs ? Date.now() - audioState.playRequestTs : null;
      const body = Object.assign({
        track: getMonitorTrackValue(payload),
        album: String(payload.album || "").toLowerCase(),
        duration_before_play_ms: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : null,
        error: false,
        browser: String(navigator.userAgent || "")
      }, getEnvironment(), data || {});

      enqueue(body);
    }

    function logAuditEvent(type, track, index, src, data) {
      trackRuntimeEvent(type, Object.assign(
        buildMonitorPayload(track, index, src),
        data || {}
      ));
    }

    function startHeartbeat() {
      if (heartbeatTimer) return;
      heartbeatTimer = window.setInterval(function () {
        const audioState = getAudioState();
        const audio = getAudio();
        const playableSrc = call(ctx, "getCurrentPlayableAudioSrc", audio);
        if (!audio || audio.paused || !playableSrc) return;
        if (!healthSessionActive) return;
        trackRuntimeEvent("heartbeat", Object.assign(
          buildMonitorPayload(
            call(ctx, "getCurrentPlaylistTrack"),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getRuntimeProbeState()
        ));
      }, HEARTBEAT_MS);
    }

    function stopHeartbeat() {
      if (!heartbeatTimer) return;
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    function hasPendingEvents() {
      return queue.length > 0;
    }

    function initLifecycle() {
      if (lifecycleInitialized) return;
      lifecycleInitialized = true;

      const performancePolicy = window.InfraPerformancePolicy && typeof window.InfraPerformancePolicy.getPolicy === "function"
        ? window.InfraPerformancePolicy.getPolicy()
        : null;
      if (performancePolicy && typeof performancePolicy.consumeEvents === "function") {
        performancePolicy.consumeEvents().forEach(function (event) {
          if (event && event.type) trackRuntimeEvent(event.type, event.data || {});
        });
      }
      document.addEventListener("infra:performance", function (event) {
        const detail = event && event.detail ? event.detail : null;
        if (detail && detail.type) trackRuntimeEvent(detail.type, detail.data || {});
      });

      loadQueue().then(function () {
        if (queue.length) scheduleFlush(5000);
      }).catch(function () {});

      window.setInterval(function () {
        if (queue.length) flushQueue({ keepalive: document.visibilityState === "hidden" });
      }, RETRY_INTERVAL_MS);

      window.addEventListener("online", function () {
        flushQueue();
      });

      window.addEventListener("pagehide", function () {
        flushQueue({ keepalive: true, beacon: true });
      });

      document.addEventListener("visibilitychange", function () {
        const audioState = getAudioState();
        const audio = getAudio();
        trackRuntimeEvent("visibilitychange", Object.assign(
          buildMonitorPayload(
            call(ctx, "getCurrentPlaylistTrack"),
            audioState.currentIndex,
            audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || ""
          ),
          getRuntimeProbeState(),
          { visibility_state: document.visibilityState || "" }
        ));
        if (document.visibilityState === "hidden") {
          flushQueue({ keepalive: true, beacon: true });
        } else {
          flushQueue();
        }
      });
    }

    return {
      now,
      getBufferedEnd,
      getRuntimeProbeState,
      flushQueue,
      enqueue,
      markHealthSessionInactive,
      startHeartbeat,
      stopHeartbeat,
      trackRuntimeEvent,
      sendMonitoringLog,
      logAuditEvent,
      hasPendingEvents,
      initLifecycle
    };
  }

  window.InfraAudioTelemetry = {
    now,
    createTelemetry
  };
})();
