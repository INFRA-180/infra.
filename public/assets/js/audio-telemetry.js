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
    "prefetch_error",
    "prefetch_suspended",
    "prefetch_window_ready",
    "ready_wait_start",
    "ready_wait_end",
    "recovery_start",
    "recovery_resolved",
    "recovery_failed",
    "resume_probe",
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
    "waiting"
  ]);
  const MAX_REQUESTS = 24;
  const DB_NAME = "infra_audio_telemetry_v2";
  const DB_STORE = "sessions";
  const LEGACY_DB_NAME = "infra_audio_telemetry_v1";
  const SESSION_SCHEMA_VERSION = 2;
  const SESSION_EVENT_CAP = 48;
  const SESSION_STORE_CAP = 4;
  const SESSION_TTL_MS = 72 * 60 * 60 * 1000;
  const SESSION_ENVELOPE_MAX_BYTES = 32 * 1024;
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

  function createRandomId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_err) {
      // Fallback below.
    }
    return `${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createTraceId() {
    return `t-${createRandomId()}`;
  }

  function createSessionId() {
    return `s-${Date.now().toString(36)}-${createRandomId()}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 96);
  }

  function byteLength(value) {
    const text = String(value || "");
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
    try {
      return unescape(encodeURIComponent(text)).length;
    } catch (_err) {
      return text.length * 2;
    }
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

  function sanitizeStoredSession(input) {
    if (!input || typeof input !== "object") return null;
    const sessionId = String(input.session_id || "").trim().slice(0, 96);
    const startedAt = Number(input.started_at_ms);
    if (!/^s-[a-z0-9-]{12,94}$/.test(sessionId) || !Number.isFinite(startedAt) || startedAt <= 0) {
      return null;
    }
    const status = input.status === "sealed" ? "sealed" : "active";
    const events = (Array.isArray(input.events) ? input.events : [])
      .map(sanitizeTelemetryEvent)
      .filter(Boolean)
      .slice(-SESSION_EVENT_CAP);
    const lastAt = Number(input.last_at_ms);
    const endedAt = Number(input.ended_at_ms);
    return {
      schema_version: SESSION_SCHEMA_VERSION,
      session_id: sessionId,
      status,
      build: String(input.build || "").trim().slice(0, 120),
      ua_class: String(input.ua_class || "").trim().slice(0, 32),
      effective_type: String(input.effective_type || "").trim().slice(0, 32),
      started_at_ms: startedAt,
      last_at_ms: Number.isFinite(lastAt) && lastAt >= startedAt ? lastAt : startedAt,
      ended_at_ms: status === "sealed" && Number.isFinite(endedAt) && endedAt >= startedAt ? endedAt : 0,
      close_reason: String(input.close_reason || "").trim().slice(0, 40),
      dropped_events: Math.max(0, Math.floor(Number(input.dropped_events) || 0)),
      events
    };
  }

  function toSessionReport(input) {
    const session = sanitizeStoredSession(input);
    if (!session || session.status !== "sealed" || !session.events.length) return null;
    const endedAt = session.ended_at_ms || session.last_at_ms || session.started_at_ms;
    return {
      schema_version: SESSION_SCHEMA_VERSION,
      session_id: session.session_id,
      build: session.build,
      ua_class: session.ua_class,
      effective_type: session.effective_type,
      started_at_ms: session.started_at_ms,
      ended_at_ms: endedAt,
      duration_ms: Math.max(0, endedAt - session.started_at_ms),
      close_reason: session.close_reason || "unknown",
      dropped_events: session.dropped_events,
      events: session.events.map(function (event) { return Object.assign({}, event); })
    };
  }

  function buildSessionEnvelope(inputReports) {
    const reports = (Array.isArray(inputReports) ? inputReports : [])
      .map(toSessionReport)
      .filter(Boolean)
      .slice(0, SESSION_STORE_CAP);
    if (!reports.length) return null;

    let envelope = { schema_version: SESSION_SCHEMA_VERSION, reports };
    let serialized = JSON.stringify(envelope);
    while (byteLength(serialized) > SESSION_ENVELOPE_MAX_BYTES && reports.length) {
      let largest = null;
      reports.forEach(function (report) {
        if (!largest || report.events.length > largest.events.length) largest = report;
      });
      if (largest && largest.events.length > 1) {
        largest.events.shift();
        largest.dropped_events += 1;
      } else if (reports.length > 1) {
        reports.shift();
      } else {
        return null;
      }
      envelope = { schema_version: SESSION_SCHEMA_VERSION, reports };
      serialized = JSON.stringify(envelope);
    }
    return byteLength(serialized) <= SESSION_ENVELOPE_MAX_BYTES
      ? { envelope, serialized }
      : null;
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
    const sessions = new Map();
    let dbPromise = null;
    let sessionsLoaded = false;
    let sessionsLoadingPromise = null;
    let flushInFlightPromise = null;
    let lifecycleFlushAfterInFlight = false;
    let currentSessionId = "";
    let lifecycleInitialized = false;
    let lifecycleDeliveryAttempted = false;
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
      while (traceIds.size > MAX_REQUESTS) traceIds.delete(traceIds.keys().next().value);
      return traceIds.get(token) || "";
    }

    function getAutoFlag(type, data, requestToken) {
      if (data && data.trigger === "auto") return true;
      if (data && data.auto === true) return true;
      if (Number.isFinite(requestToken) && fineAuto.has(requestToken)) return Boolean(fineAuto.get(requestToken));
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
          if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "session_id" });
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { resolve(null); };
        request.onblocked = function () { resolve(null); };
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
            transaction.onerror = function () { resolve(null); };
            transaction.onabort = function () { resolve(null); };
          } catch (_err) {
            resolve(null);
          }
        });
      });
    }

    function deleteStoredSessions(ids) {
      if (!Array.isArray(ids) || !ids.length) return;
      withStore("readwrite", function (store) {
        ids.forEach(function (id) { store.delete(id); });
        return true;
      }).catch(function () {});
    }

    function persistSession(session) {
      const sanitized = sanitizeStoredSession(session);
      if (!sanitized) return;
      withStore("readwrite", function (store) { return store.put(sanitized); }).catch(function () {});
    }

    function clearLegacyDb() {
      if (!("indexedDB" in window) || typeof indexedDB.deleteDatabase !== "function") return;
      try { indexedDB.deleteDatabase(LEGACY_DB_NAME); } catch (_err) {}
    }

    function pruneSessions() {
      const cutoff = Date.now() - SESSION_TTL_MS;
      const dropped = [];
      sessions.forEach(function (session, id) {
        const timestamp = Number(session.ended_at_ms || session.last_at_ms || session.started_at_ms);
        if (!Number.isFinite(timestamp) || timestamp < cutoff) {
          sessions.delete(id);
          dropped.push(id);
        }
      });
      const ordered = Array.from(sessions.values()).sort(function (left, right) {
        return Number(left.last_at_ms || left.started_at_ms) - Number(right.last_at_ms || right.started_at_ms);
      });
      while (ordered.length > SESSION_STORE_CAP) {
        let index = ordered.findIndex(function (session) { return session.session_id !== currentSessionId; });
        if (index < 0) index = 0;
        const removed = ordered.splice(index, 1)[0];
        if (removed) {
          sessions.delete(removed.session_id);
          dropped.push(removed.session_id);
        }
      }
      if (dropped.length) deleteStoredSessions(dropped);
    }

    function loadSessions() {
      if (sessionsLoaded) return Promise.resolve(Array.from(sessions.values()));
      if (sessionsLoadingPromise) return sessionsLoadingPromise;
      sessionsLoadingPromise = withStore("readonly", function (store) { return store.getAll(); })
        .then(function (stored) {
          (Array.isArray(stored) ? stored : []).forEach(function (candidate) {
            const session = sanitizeStoredSession(candidate);
            if (session && !sessions.has(session.session_id)) sessions.set(session.session_id, session);
          });
          sessionsLoaded = true;
          pruneSessions();
          return Array.from(sessions.values());
        })
        .finally(function () { sessionsLoadingPromise = null; });
      return sessionsLoadingPromise;
    }

    function createActiveSession() {
      const environment = getEnvironment();
      const startedAt = Date.now();
      const session = {
        schema_version: SESSION_SCHEMA_VERSION,
        session_id: createSessionId(),
        status: "active",
        build: getRuntimeVersion(),
        ua_class: getUaClass(),
        effective_type: environment.effective_type || "",
        started_at_ms: startedAt,
        last_at_ms: startedAt,
        ended_at_ms: 0,
        close_reason: "",
        dropped_events: 0,
        events: []
      };
      currentSessionId = session.session_id;
      lifecycleDeliveryAttempted = false;
      sessions.set(session.session_id, session);
      pruneSessions();
      persistSession(session);
      return session;
    }

    function ensureActiveSession() {
      const current = currentSessionId ? sessions.get(currentSessionId) : null;
      if (current && current.status === "active") return current;
      if (lifecycleInitialized && document.visibilityState === "hidden") return null;
      return createActiveSession();
    }

    function sealCurrentSession(reason) {
      const current = currentSessionId ? sessions.get(currentSessionId) : null;
      currentSessionId = "";
      if (!current || current.status !== "active") return null;
      if (!current.events.length) {
        sessions.delete(current.session_id);
        deleteStoredSessions([current.session_id]);
        return null;
      }
      current.status = "sealed";
      current.close_reason = String(reason || "hidden").slice(0, 40);
      current.ended_at_ms = Date.now();
      current.last_at_ms = Math.max(current.last_at_ms || 0, current.ended_at_ms);
      persistSession(current);
      return current;
    }

    function sealInterruptedSessions() {
      sessions.forEach(function (session) {
        if (session.status !== "active" || session.session_id === currentSessionId) return;
        session.status = "sealed";
        session.close_reason = "interrupted";
        session.ended_at_ms = session.last_at_ms || session.started_at_ms;
        persistSession(session);
      });
    }

    function removeReports(reports) {
      const ids = reports.map(function (report) { return report.session_id; }).filter(Boolean);
      ids.forEach(function (id) { sessions.delete(id); });
      deleteStoredSessions(ids);
    }

    function postSealedSessions(options) {
      const opts = options || {};
      const workerUrl = getWorkerUrl();
      if (typeof fetch !== "function" || !workerUrl) return Promise.resolve(false);
      const sealed = Array.from(sessions.values())
        .filter(function (session) { return session.status === "sealed" && session.events.length; })
        .sort(function (left, right) { return left.started_at_ms - right.started_at_ms; })
        .slice(0, SESSION_STORE_CAP);
      const built = buildSessionEnvelope(sealed);
      if (!built) return Promise.resolve(false);
      const sentReports = built.envelope.reports;
      return fetch(`${workerUrl.replace(/\/+$/, "")}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: built.serialized,
        credentials: "omit",
        keepalive: Boolean(opts.keepalive)
      }).then(function (response) {
        if (!response || !response.ok) return false;
        removeReports(sentReports);
        return true;
      }).catch(function () { return false; });
    }

    function flushQueue(options) {
      const opts = options || {};
      const keepalive = Boolean(opts.beacon || opts.keepalive);
      if (flushInFlightPromise) {
        // A startup retry can still be in flight when iOS hides the PWA. Keep
        // exactly one lifecycle flush pending so the newly sealed session is
        // attempted as soon as that request settles instead of waiting for a
        // later launch.
        if (keepalive) lifecycleFlushAfterInFlight = true;
        return flushInFlightPromise;
      }
      flushInFlightPromise = loadSessions()
        .then(function () {
          pruneSessions();
          return postSealedSessions({ keepalive });
        })
        .finally(function () {
          flushInFlightPromise = null;
          if (!lifecycleFlushAfterInFlight) return;
          lifecycleFlushAfterInFlight = false;
          flushQueue({ keepalive: true });
        });
      return flushInFlightPromise;
    }

    function enqueue(event) {
      if (!event || typeof event !== "object") return;
      const sanitized = sanitizeTelemetryEvent(Object.assign({ timestamp_ms: Date.now() }, event));
      if (!sanitized) return;
      const session = ensureActiveSession();
      if (!session) return;
      session.events.push(sanitized);
      if (session.events.length > SESSION_EVENT_CAP) {
        session.dropped_events += session.events.length - SESSION_EVENT_CAP;
        session.events.splice(0, session.events.length - SESSION_EVENT_CAP);
      }
      session.last_at_ms = Math.max(session.last_at_ms || 0, sanitized.timestamp_ms);
      persistSession(session);
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

      if (eventType === "playing" || eventType === "play_resolved") markHealthSessionActive();
      if (eventType === "click_track" && Number.isFinite(requestToken)) {
        fineStarts.set(requestToken, eventNow);
        fineAuto.set(requestToken, getAutoFlag(eventType, source, requestToken));
        pruneFineMaps();
      }

      const startedAt = Number.isFinite(requestToken) && fineStarts.has(requestToken)
        ? fineStarts.get(requestToken)
        : audioState.audioClickPerfTs;
      const deltaMs = Number.isFinite(startedAt) && startedAt > 0 ? Math.max(0, Math.round(eventNow - startedAt)) : null;
      const providedDeltaMs = Number(source.delta_ms);
      const normalizedDeltaMs = Number.isFinite(providedDeltaMs)
        ? Math.max(0, Math.round(providedDeltaMs))
        : (eventType === "click_track" ? 0 : deltaMs);
      enqueue(Object.assign({}, source, getEnvironment(), getHealthSessionState(), {
        event: eventType,
        fine_event: true,
        trace_id: getTraceId(requestToken),
        build: getRuntimeVersion(),
        timestamp_ms: Date.now(),
        delta_ms: normalizedDeltaMs,
        duration_before_play_ms: eventType === "click_track" ? 0 : normalizedDeltaMs,
        track: getMonitorTrackValue(source),
        album: String(source.album || "").toLowerCase(),
        source: source.source || getAudioSource(source.src),
        ua_class: getUaClass(),
        auto: getAutoFlag(eventType, source, requestToken),
        error: eventType === "play_rejected",
        error_name: source.reason || source.error_name || ""
      }));
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
      enqueue(Object.assign({}, getEnvironment(), data || {}, {
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
      }));
    }

    function logAuditEvent(type, track, index, src, data) {
      trackRuntimeEvent(type, Object.assign(buildMonitorPayload(track, index, src), data || {}));
    }

    function startHeartbeat() {
      // Session v2 is event-driven; periodic telemetry is intentionally disabled.
    }

    function stopHeartbeat() {
      // Kept as a no-op for the public API used by scripts.js.
    }

    function hasPendingEvents() {
      return Array.from(sessions.values()).some(function (session) { return session.events.length > 0; });
    }

    function attemptLifecycleDelivery(reason) {
      const sealed = sealCurrentSession(reason);
      if (!sealed || lifecycleDeliveryAttempted) return;
      lifecycleDeliveryAttempted = true;
      flushQueue({ beacon: true });
    }

    function initLifecycle() {
      if (lifecycleInitialized) return;
      lifecycleInitialized = true;
      clearLegacyDb();
      loadSessions().then(function () {
        sealInterruptedSessions();
        pruneSessions();
        ensureActiveSession();
        // A previous iOS force-quit cannot send on exit. Retry only those sealed
        // sessions once on the next launch; the current session remains local.
        flushQueue();
      }).catch(function () { ensureActiveSession(); });

      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
          attemptLifecycleDelivery("hidden");
          return;
        }
        if (document.visibilityState === "visible") ensureActiveSession();
      });
      window.addEventListener("pagehide", function () {
        if (!lifecycleDeliveryAttempted) attemptLifecycleDelivery("pagehide");
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
