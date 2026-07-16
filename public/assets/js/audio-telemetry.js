(function () {
  "use strict";

  const FINE_EVENTS = new Set([
    "album_switch",
    "audio_pause",
    "audio_play",
    "audio_session_state",
    "cache_hit",
    "click_track",
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
    "first_byte",
    "global_playlist_build_done",
    "global_playlist_build_start",
    "heartbeat",
    "initial_random_tap",
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
    "prefetch_cache_rehydrated",
    "prefetch_cancel",
    "prefetch_error",
    "prefetch_plan",
    "prefetch_start",
    "prefetch_suspended",
    "prefetch_window_ready",
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
    "sw_reload_executed",
    "sw_reload_pending",
    "suspend",
    "visibilitychange",
    "waiting"
  ]);
  const MAX_REQUESTS = 24;
  const DB_NAME = "infra_audio_telemetry_v1";
  const DB_STORE = "events";
  const QUEUE_CAP = 100;
  const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
  const FLUSH_THRESHOLD = 40;
  const FLUSH_INTERVAL_MS = 60000;
  const HEARTBEAT_MS = 15000;
  const TELEMETRY_STRING_FIELDS = new Set([
    "event", "trace_id", "build", "track", "album", "source", "ua_class",
    "effective_type", "visibility_state", "trigger", "surface", "branch",
    "reason", "error_name", "action", "strategy", "cache_hint", "state",
    "phase", "mode", "playlist_kind", "audio_session_state", "audio_session_type",
    "from_album", "to_album", "result", "recovery_reason", "intent_reason"
  ]);
  const TELEMETRY_NUMBER_FIELDS = new Set([
    "timestamp_ms", "delta_ms", "duration_before_play_ms", "duration_ms", "delay_ms",
    "ms", "request_token", "ready_state", "network_state", "current_time",
    "buffered_end", "duration", "bytes", "segment_bytes", "transfer_size",
    "encoded_body_size", "decoded_body_size", "rank", "attempt", "ready_count",
    "inflight_count", "from_index", "next_index", "generation", "depth", "status", "restored_count",
    "response_ms", "body_ms", "queue_ms", "cache_ms", "range_start", "range_end",
    "error_code", "timeout_ms", "recovery_ms", "advanced_ms", "buffer_ahead",
    "cancelled_count", "health_session_age_ms", "volume", "click_perf_ms",
    "guard_age_ms", "guard_current_time", "progressed_seconds", "playback_rate"
  ]);
  const TELEMETRY_BOOLEAN_FIELDS = new Set([
    "fine_event", "navigator_on_line", "auto", "error", "health_session_active",
    "cached", "range", "paused", "muted", "sync", "retry", "ready", "same_track",
    "immediate_play", "from_media_session", "from_transport_control", "initial_random",
    "reused_current_source", "user_activation_active", "user_activation_seen",
    "controllerchange", "sw_reload_between", "reload_executed", "audio_fetch",
    "served_from_prefetch", "is_ios", "is_standalone"
  ]);

  function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function createTraceId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_err) {
      // Fallback below.
    }
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function sanitizeTelemetryEvent(input) {
    if (!input || typeof input !== "object") return null;
    const output = {};
    TELEMETRY_STRING_FIELDS.forEach(function (key) {
      if (typeof input[key] !== "string") return;
      const value = input[key].trim().slice(0, key === "track" ? 240 : 120);
      if (value) output[key] = value;
    });
    TELEMETRY_NUMBER_FIELDS.forEach(function (key) {
      if (input[key] === null || input[key] === "") return;
      const value = Number(input[key]);
      if (Number.isFinite(value)) output[key] = value;
    });
    TELEMETRY_BOOLEAN_FIELDS.forEach(function (key) {
      if (typeof input[key] === "boolean") output[key] = input[key];
    });
    if (!Number.isFinite(output.timestamp_ms) || output.timestamp_ms <= 0) return null;
    return output;
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
    const traceIds = new Map();
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
      if (call(ctx, "isTelemetryOriginAllowed") === false) return "";
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
      return {
        effective_type: connection && connection.effectiveType ? String(connection.effectiveType) : "",
        navigator_on_line: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        visibility_state: document.visibilityState || ""
      };
    }

    function getTraceId(requestToken) {
      const token = Number(requestToken);
      if (!Number.isFinite(token) || token <= 0) return "";
      if (!traceIds.has(token)) traceIds.set(token, createTraceId());
      while (traceIds.size > MAX_REQUESTS) {
        traceIds.delete(traceIds.keys().next().value);
      }
      return traceIds.get(token) || "";
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
      const cutoff = Date.now() - QUEUE_TTL_MS;
      const dropped = [];
      queue = queue.filter(function (event) {
        const timestamp = Number(event && event.timestamp_ms);
        const keep = Number.isFinite(timestamp) && timestamp >= cutoff;
        if (!keep && event && event._telemetry_id) dropped.push(event);
        return keep;
      });
      if (queue.length > QUEUE_CAP) {
        dropped.push.apply(dropped, queue.splice(0, queue.length - QUEUE_CAP));
      }
      if (dropped.length) {
        deleteEvents(dropped.map(function (event) { return event._telemetry_id; }).filter(Boolean));
      }
    }

    function loadQueue() {
      if (queueLoaded) return Promise.resolve(queue);
      return withStore("readonly", function (store) {
        return store.getAll();
      }).then(function (stored) {
        const merged = new Map();
        (Array.isArray(stored) ? stored : []).forEach(function (event) {
          const sanitized = sanitizeTelemetryEvent(event);
          if (sanitized && event && event._telemetry_id) {
            merged.set(event._telemetry_id, Object.assign({ _telemetry_id: event._telemetry_id }, sanitized));
          } else if (event && event._telemetry_id) {
            deleteEvents([event._telemetry_id]);
          }
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

    function postBatch(batch) {
      const workerUrl = getWorkerUrl();
      if (!batch.length || typeof fetch !== "function" || !workerUrl) return Promise.resolve(false);
      const payload = batch.map(sanitizeTelemetryEvent).filter(Boolean);
      if (!payload.length) return Promise.resolve(false);
      return fetch(`${workerUrl.replace(/\/+$/, "")}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: false
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
        pruneQueue();
        if (!queue.length) return false;
        const batch = queue.slice(0, QUEUE_CAP);
        const workerUrl = getWorkerUrl();
        if (opts.beacon && navigator.sendBeacon && workerUrl) {
          try {
            const payload = batch.map(sanitizeTelemetryEvent).filter(Boolean);
            const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
            const queued = navigator.sendBeacon(`${workerUrl.replace(/\/+$/, "")}/log`, blob);
            if (queued) {
              removeBatch(batch);
              return true;
            }
          } catch (_err) {
            // Fall through to fetch below when possible.
          }
        }
        return postBatch(batch).then(function (ok) {
          if (ok) removeBatch(batch);
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
      const sanitized = sanitizeTelemetryEvent(Object.assign({ timestamp_ms: Date.now() }, event));
      if (!sanitized) return;
      const queued = Object.assign({ _telemetry_id: createEventId() }, sanitized);
      queue.push(queued);
      pruneQueue();
      persistEvent(queued);
      if (queue.length >= FLUSH_THRESHOLD) {
        scheduleFlush(0);
      }
    }

    function getMonitorTrackValue(payload) {
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
      const audioState = getAudioState();
      const explicitRequestToken = Number(source.request_token);
      const activeRequestToken = Number(audioState.playRequestToken || audioState.startRequestToken);
      const requestToken = Number.isFinite(explicitRequestToken) && explicitRequestToken > 0
        ? explicitRequestToken
        : activeRequestToken;
      const eventNow = now();

      if (eventType === "playing" || eventType === "play_resolved" || eventType === "heartbeat") {
        markHealthSessionActive();
      }

      if (eventType === "click_track" && Number.isFinite(requestToken)) {
        fineStarts.set(requestToken, eventNow);
        fineAuto.set(requestToken, getAutoFlag(eventType, source, requestToken));
        pruneFineMaps();
      }

      const startedAt = Number.isFinite(requestToken) && fineStarts.has(requestToken)
        ? fineStarts.get(requestToken)
        : audioState.audioClickPerfTs;
      const deltaMs = Number.isFinite(startedAt) && startedAt > 0 ? Math.max(0, Math.round(eventNow - startedAt)) : null;
      const auto = getAutoFlag(eventType, source, requestToken);
      const errorName = source.reason || source.error_name || "";
      const trackValue = getMonitorTrackValue(source);
      const providedDeltaMs = Number(source.delta_ms);
      const normalizedDeltaMs = Number.isFinite(providedDeltaMs)
        ? Math.max(0, Math.round(providedDeltaMs))
        : (eventType === "click_track" ? 0 : deltaMs);

      const body = Object.assign({}, source, getEnvironment(), getHealthSessionState(), {
        event: eventType,
        fine_event: true,
        trace_id: getTraceId(requestToken),
        build: getRuntimeVersion(),
        timestamp_ms: Date.now(),
        delta_ms: normalizedDeltaMs,
        duration_before_play_ms: eventType === "click_track" ? 0 : normalizedDeltaMs,
        track: trackValue,
        album: String(source.album || "").toLowerCase(),
        source: source.source || getAudioSource(source.src),
        ua_class: getUaClass(),
        auto,
        error: eventType === "play_rejected",
        error_name: errorName
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
      const requestToken = Number(audioState.playRequestToken || audioState.startRequestToken);
      const monitorError = Boolean(data && data.error === true);
      const body = Object.assign({}, getEnvironment(), data || {}, {
        event: monitorError ? "monitor_error" : "monitor_play",
        trace_id: getTraceId(requestToken),
        build: getRuntimeVersion(),
        timestamp_ms: Date.now(),
        request_token: Number.isFinite(requestToken) ? requestToken : null,
        track: getMonitorTrackValue(payload),
        album: String(payload.album || "").toLowerCase(),
        duration_before_play_ms: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : null,
        error: monitorError,
        ua_class: getUaClass()
      });

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

      loadQueue().then(function () {
        if (queue.length) scheduleFlush(5000);
      }).catch(function () {});

      window.setInterval(function () {
        if (queue.length) flushQueue();
      }, FLUSH_INTERVAL_MS);

      window.addEventListener("online", function () {
        flushQueue();
      });

      window.addEventListener("pagehide", function () {
        flushQueue({ beacon: true });
      });

      window.addEventListener("beforeunload", function () {
        flushQueue({ beacon: true });
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
        if (document.visibilityState === "visible") {
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
