(function () {
  "use strict";

  // Call sites remain verbose for local diagnostics. Only the compact
  // transitions assembled below are written to the session journal.
  const RAW_EVENTS = new Set([
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
    "fullscreen_viewport",
    "visualizer_health",
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
    "media_command",
    "media_capabilities",
    "audio_interruption",
    "transport_nexttrack",
    "transport_previoustrack",
    "play_request",
    "play_complete",
    "playable",
    "prefetch_error",
    "prefetch_cache_rehydrated",
    "prefetch_cache_timeout_recovered",
    "prefetch_cancel",
    "prefetch_done",
    "prefetch_plan",
    "prefetch_preempt",
    "prefetch_start",
    "prefetch_suspended",
    "prefetch_window_ready",
    "served_from_prefetch",
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
    "cover_decode_duration",
    "mini_player_visibility",
    "spa_swap_done",
    "spa_swap_start",
    "spa_scroll_restore",
    "spa_render_done",
    "spa_render_start",
    "nav:album_abort",
    "nav:album_done",
    "nav:album_start",
    "spa_html_response",
    "stalled",
    "sw_controllerchange",
    "sw_reload_executed",
    "sw_reload_pending",
    "suspend",
    "waiting"
  ]);
  const DIRECT_EVENTS = new Set([
    "external_resume_recovery_failed",
    "fullscreen_viewport",
    "mini_player_visibility",
    "prefetch_error",
    "recovery_failed",
    "sw_controllerchange",
    "sw_reload_executed",
    "system_auto_resume_blocked"
  ]);
  const MAX_REQUESTS = 24;
  const DB_NAME = "infra_audio_telemetry_v2";
  const DB_STORE = "sessions";
  const LEGACY_DB_NAME = "infra_audio_telemetry_v1";
  const SESSION_SCHEMA_VERSION = 3;
  const SESSION_EVENT_CAP = 48;
  const SESSION_STORE_CAP = 4;
  const SESSION_TTL_MS = 72 * 60 * 60 * 1000;
  const SESSION_ENVELOPE_MAX_BYTES = 32 * 1024;
  const SLOW_TRACK_TRANSITION_MS = 1000;
  const SLOW_SPA_NAVIGATION_MS = 700;
  const LOCAL_CORRELATION_CAP = 32;
  const TELEMETRY_STRING_FIELDS = new Set([
    "event", "trace_id", "build", "track", "album", "source", "ua_class",
    "effective_type", "visibility_state", "trigger", "surface", "branch",
    "reason", "error_name", "action", "strategy", "cache_hint", "state",
    "swap_mode", "swap_policy",
    "phase", "mode", "playlist_kind", "audio_session_state", "audio_session_type",
    "from_album", "to_album", "result", "recovery_reason", "intent_reason",
    "route_kind", "display_mode", "orientation", "command_token", "origin",
    "surface_hint", "decision", "outcome", "probe_stage", "supported_actions",
    "unsupported_actions", "cleared_actions", "registration_result", "interruption_token",
    "interruption_kind", "before_media_session_state", "after_media_session_state"
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
    "guard_age_ms", "guard_current_time", "progressed_seconds", "playback_rate",
    "play_call_ms", "loadstart_ms", "canplay_ms", "play_resolved_ms", "playing_ms",
    "waiting_count", "stalled_count", "prefetch_age_ms", "render_ms", "swap_ms",
    "screen_width", "screen_height", "inner_width", "inner_height",
    "root_client_width", "root_client_height",
    "visual_viewport_width", "visual_viewport_height",
    "visual_viewport_offset_top", "visual_viewport_offset_left", "visual_viewport_scale",
    "device_pixel_ratio", "safe_area_top", "safe_area_right", "safe_area_bottom", "safe_area_left",
    "css_vh_height", "css_dvh_height",
    "overlay_top", "overlay_bottom", "overlay_width", "overlay_height",
    "overlay_visual_top_gap", "overlay_visual_bottom_gap",
    "panel_top", "panel_bottom", "panel_height",
    "cover_wait_ms", "track_transition_count", "track_playing_count",
    "track_rejected_count", "track_error_count", "prepared_count", "unprepared_count",
    "served_from_prefetch_count", "slow_transition_count", "max_play_to_playing_ms",
    "total_play_to_playing_ms", "prefetch_start_count", "prefetch_done_count",
    "prefetch_error_count", "prefetch_cache_ready_count", "spa_navigation_count",
    "spa_abort_count", "spa_slow_count", "max_spa_navigation_ms",
    "mini_visibility_change_count", "mini_hidden_count", "mini_unexpected_hidden_count",
    "navigation_token", "cover_natural_width", "cover_display_px",
    "first_paint_ms", "visible_cover_count", "visible_cover_ready_count",
    "second_paint_ms", "second_visible_cover_count", "second_visible_cover_ready_count",
    "spa_cover_not_ready_count", "spa_second_cover_not_ready_count",
    "max_first_paint_ms", "max_second_paint_ms",
    "html_cache_hit_count", "html_cache_miss_count",
    "cover_cache_hit_count", "cover_cache_miss_count",
    "storage_probe_count", "storage_persisted_state",
    "storage_persist_request_count", "storage_persist_granted_count",
    "storage_usage_mb", "storage_quota_mb", "storage_shell_present",
    "storage_sw_controlled", "storage_cover_entries", "storage_audio_entries",
    "storage_catalog_entries",
    "visualizer_open_count", "visualizer_activation_count",
    "visualizer_activation_success_count", "visualizer_activation_error_count",
    "visualizer_frame_count", "visualizer_nonzero_frame_count", "visualizer_zero_frame_count",
    "visualizer_max_rms_milli", "visualizer_max_bass_milli",
    "visualizer_max_mid_milli", "visualizer_max_treble_milli",
    "visualizer_energy_range_milli", "visualizer_max_amplitude_px",
    "visualizer_canvas_width", "visualizer_canvas_height",
    "visualizer_canvas_opacity_milli", "visualizer_audio_advanced_ms",
    "visualizer_context_supported", "visualizer_context_running",
    "visualizer_analyser_ready", "visualizer_canvas_visible",
    "command_sequence", "event_sequence", "before_current_time", "after_current_time",
    "probe_600_ms", "probe_1500_ms", "probe_3000_ms", "command_latency_ms",
    "from_ms", "to_ms", "media_command_count", "media_command_success_count",
    "media_command_noop_count", "media_command_dedup_count", "media_command_rejected_count",
    "media_command_no_progress_count", "media_command_recovered_count",
    "media_command_recovery_failed_count", "media_command_incomplete_count",
    "media_play_count", "media_pause_count", "media_previous_count", "media_next_count",
    "media_seek_count", "media_restart_count", "audio_interruption_count"
  ]);
  const TELEMETRY_BOOLEAN_FIELDS = new Set([
    "fine_event", "navigator_on_line", "auto", "error", "health_session_active",
    "cached", "range", "paused", "muted", "sync", "retry", "ready", "same_track",
    "immediate_play", "from_media_session", "from_transport_control", "initial_random",
    "reused_current_source", "user_activation_active", "user_activation_seen",
    "controllerchange", "sw_reload_between", "reload_executed", "audio_fetch",
    "served_from_prefetch", "is_ios", "is_standalone", "prepared", "prefetch_ready",
    "cover_timed_out", "visible", "unexpected", "navigation_active", "fullscreen_open",
    "has_playback_session", "has_source", "is_home", "is_album",
    "cover_ready_at_first_paint", "cover_ready_at_second_paint",
    "before_paused", "after_paused", "confirmed", "recovery_attempted",
    "handler_play", "handler_pause", "handler_previous", "handler_next", "handler_seekto"
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

  const SESSION_SUMMARY_FIELDS = [
    "track_transition_count",
    "track_playing_count",
    "track_rejected_count",
    "track_error_count",
    "prepared_count",
    "unprepared_count",
    "served_from_prefetch_count",
    "slow_transition_count",
    "max_play_to_playing_ms",
    "total_play_to_playing_ms",
    "waiting_count",
    "stalled_count",
    "prefetch_start_count",
    "prefetch_done_count",
    "prefetch_error_count",
    "prefetch_cache_ready_count",
    "spa_navigation_count",
    "spa_abort_count",
    "spa_slow_count",
    "max_spa_navigation_ms",
    "spa_cover_not_ready_count",
    "spa_second_cover_not_ready_count",
    "max_first_paint_ms",
    "max_second_paint_ms",
    "mini_visibility_change_count",
    "mini_hidden_count",
    "mini_unexpected_hidden_count",
    "html_cache_hit_count",
    "html_cache_miss_count",
    "cover_cache_hit_count",
    "cover_cache_miss_count",
    "storage_probe_count",
    "storage_persisted_state",
    "storage_persist_request_count",
    "storage_persist_granted_count",
    "storage_usage_mb",
    "storage_quota_mb",
    "storage_shell_present",
    "storage_sw_controlled",
    "storage_cover_entries",
    "storage_audio_entries",
    "storage_catalog_entries",
    "visualizer_open_count",
    "visualizer_activation_count",
    "visualizer_activation_success_count",
    "visualizer_activation_error_count",
    "visualizer_frame_count",
    "visualizer_nonzero_frame_count",
    "visualizer_zero_frame_count",
    "visualizer_max_rms_milli",
    "visualizer_max_bass_milli",
    "visualizer_max_mid_milli",
    "visualizer_max_treble_milli",
    "visualizer_energy_range_milli",
    "visualizer_max_amplitude_px",
    "visualizer_canvas_width",
    "visualizer_canvas_height",
    "visualizer_canvas_opacity_milli",
    "visualizer_audio_advanced_ms",
    "visualizer_context_supported",
    "visualizer_context_running",
    "visualizer_analyser_ready",
    "visualizer_canvas_visible",
    "media_command_count",
    "media_command_success_count",
    "media_command_noop_count",
    "media_command_dedup_count",
    "media_command_rejected_count",
    "media_command_no_progress_count",
    "media_command_recovered_count",
    "media_command_recovery_failed_count",
    "media_command_incomplete_count",
    "media_play_count",
    "media_pause_count",
    "media_previous_count",
    "media_next_count",
    "media_seek_count",
    "media_restart_count",
    "audio_interruption_count"
  ];

  function createSessionSummary() {
    const summary = {};
    SESSION_SUMMARY_FIELDS.forEach(function (field) { summary[field] = 0; });
    return summary;
  }

  function sanitizeSessionSummary(input) {
    const source = input && typeof input === "object" ? input : {};
    const summary = createSessionSummary();
    SESSION_SUMMARY_FIELDS.forEach(function (field) {
      const value = Number(source[field]);
      summary[field] = Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
    });
    return summary;
  }

  function capSessionEvents(input) {
    const events = Array.isArray(input) ? input.filter(Boolean) : [];
    if (events.length <= SESSION_EVENT_CAP) return events;
    const summaryIndex = events.map(function (event) {
      return event && event.event;
    }).lastIndexOf("session_summary");
    if (summaryIndex < 0) return events.slice(-SESSION_EVENT_CAP);
    const summary = events[summaryIndex];
    const details = events.filter(function (_event, index) { return index !== summaryIndex; });
    return details.slice(-(SESSION_EVENT_CAP - 1)).concat(summary);
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
    const events = capSessionEvents((Array.isArray(input.events) ? input.events : [])
      .map(sanitizeTelemetryEvent)
      .filter(Boolean));
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
      summary: sanitizeSessionSummary(input.summary),
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
        const removableIndex = largest.events.findIndex(function (event) {
          return !event || event.event !== "session_summary";
        });
        if (removableIndex < 0) return null;
        largest.events.splice(removableIndex, 1);
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
    const trackTransitions = new Map();
    const prefetchBySource = new Map();
    const spaTransitions = new Map();
    const spaKeyByTarget = new Map();
    const spaKeyByNavigation = new Map();
    const compactEvents = new Map();
    const mediaCommands = new Map();
    const audioInterruptions = new Map();
    let activeTrackToken = 0;
    let activeSpaKey = "";
    let spaSequence = 0;
    let miniVisibilityState = "";
    let miniVisibilitySequence = 0;
    let mediaEventSequence = 0;

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

    function pruneLocalMap(map, limit) {
      while (map.size > limit) map.delete(map.keys().next().value);
    }

    function localSourceIdentity(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      try {
        const parsed = new URL(raw, window.location.href);
        return `${parsed.origin.toLowerCase()}${parsed.pathname.replace(/\/{2,}/g, "/").toLowerCase()}`;
      } catch (_err) {
        return raw.split(/[?#]/, 1)[0].replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
      }
    }

    function getLocalSourceIdentity(source) {
      if (!source || typeof source !== "object") return "";
      return localSourceIdentity(source.src || source.track_path || source.url || "");
    }

    function getPlaybackMode() {
      const audioState = getAudioState();
      if (audioState.homeMode === "radio") return "radio";
      if (audioState.shuffleOn) return "shuffle";
      return "album";
    }

    function getSessionSummary(session) {
      const target = session || ensureActiveSession();
      if (!target) return null;
      target.summary = sanitizeSessionSummary(target.summary);
      return target.summary;
    }

    function incrementSummary(field, amount, session) {
      const summary = getSessionSummary(session);
      if (!summary || !Object.prototype.hasOwnProperty.call(summary, field)) return;
      summary[field] = Math.max(0, Math.round(Number(summary[field] || 0) + (Number(amount) || 0)));
    }

    function updateSummaryMax(field, value, session) {
      const summary = getSessionSummary(session);
      const number = Number(value);
      if (!summary || !Object.prototype.hasOwnProperty.call(summary, field) || !Number.isFinite(number)) return;
      summary[field] = Math.max(Number(summary[field] || 0), Math.max(0, Math.round(number)));
    }

    function recordCacheObservation(kind, outcome, amount) {
      const cacheKind = String(kind || "").trim().toLowerCase();
      const cacheOutcome = String(outcome || "").trim().toLowerCase();
      const field = cacheKind === "html"
        ? (cacheOutcome === "hit" ? "html_cache_hit_count" : (cacheOutcome === "miss" ? "html_cache_miss_count" : ""))
        : (cacheKind === "cover"
            ? (cacheOutcome === "hit" ? "cover_cache_hit_count" : (cacheOutcome === "miss" ? "cover_cache_miss_count" : ""))
            : "");
      if (!field) return;
      const session = ensureActiveSession();
      if (!session) return;
      incrementSummary(field, Math.max(1, Math.round(Number(amount) || 1)), session);
      persistSession(session);
    }

    function recordStorageSnapshot(input) {
      const source = input && typeof input === "object" ? input : {};
      const session = ensureActiveSession();
      const summary = getSessionSummary(session);
      if (!session || !summary) return;
      const fields = [
        "storage_persisted_state",
        "storage_persist_request_count",
        "storage_persist_granted_count",
        "storage_usage_mb",
        "storage_quota_mb",
        "storage_shell_present",
        "storage_sw_controlled",
        "storage_cover_entries",
        "storage_audio_entries",
        "storage_catalog_entries"
      ];
      summary.storage_probe_count = Math.max(1, Number(summary.storage_probe_count) || 0);
      fields.forEach(function (field) {
        const value = Number(source[field]);
        if (!Number.isFinite(value) || value < 0) return;
        summary[field] = Math.max(0, Math.round(value));
      });
      persistSession(session);
    }

    function refreshCompactEventReferences(session) {
      if (!session) return;
      const retained = new Set(session.events || []);
      compactEvents.forEach(function (record, key) {
        if (record.session_id === session.session_id && !retained.has(record.event)) compactEvents.delete(key);
      });
      pruneLocalMap(compactEvents, SESSION_EVENT_CAP * SESSION_STORE_CAP);
    }

    function appendSanitizedEvent(session, event) {
      if (!session || !event) return null;
      session.events.push(event);
      const before = session.events.length;
      session.events = capSessionEvents(session.events);
      if (before > session.events.length) session.dropped_events += before - session.events.length;
      session.last_at_ms = Math.max(session.last_at_ms || 0, Number(event.timestamp_ms) || Date.now());
      refreshCompactEventReferences(session);
      persistSession(session);
      return event;
    }

    function upsertCompactEvent(key, input, sessionOverride) {
      const event = sanitizeTelemetryEvent(Object.assign({ timestamp_ms: Date.now() }, input || {}));
      const session = sessionOverride || ensureActiveSession();
      if (!event || !session) return null;
      const mapKey = `${session.session_id}|${String(key || event.event || "event")}`;
      const existing = compactEvents.get(mapKey);
      if (existing && existing.event && session.events.includes(existing.event)) {
        Object.keys(existing.event).forEach(function (field) { delete existing.event[field]; });
        Object.assign(existing.event, event);
        session.last_at_ms = Math.max(session.last_at_ms || 0, event.timestamp_ms);
        persistSession(session);
        return existing.event;
      }
      const appended = appendSanitizedEvent(session, event);
      if (appended) compactEvents.set(mapKey, { session_id: session.session_id, event: appended });
      return appended;
    }

    function upsertSessionSummaryEvent(session, timestampMs) {
      if (!session) return null;
      const summary = getSessionSummary(session);
      return upsertCompactEvent("session-summary", Object.assign({
        event: "session_summary",
        fine_event: true,
        build: session.build || getRuntimeVersion(),
        timestamp_ms: Number(timestampMs) || Date.now(),
        track: "session",
        album: "session",
        source: "summary",
        ua_class: session.ua_class || getUaClass()
      }, summary || {}), session);
    }

    function isTerminalMediaCommandOutcome(value) {
      return [
        "success", "noop", "dedup", "rejected", "no_progress",
        "recovered", "recovery_failed", "incomplete"
      ].includes(String(value || ""));
    }

    function mediaCommandOutcomeSummaryField(outcome) {
      const normalized = String(outcome || "");
      if (normalized === "success") return "media_command_success_count";
      if (normalized === "noop") return "media_command_noop_count";
      if (normalized === "dedup") return "media_command_dedup_count";
      if (normalized === "rejected") return "media_command_rejected_count";
      if (normalized === "no_progress") return "media_command_no_progress_count";
      if (normalized === "recovered") return "media_command_recovered_count";
      if (normalized === "recovery_failed") return "media_command_recovery_failed_count";
      if (normalized === "incomplete") return "media_command_incomplete_count";
      return "";
    }

    function mediaActionSummaryField(action) {
      const normalized = String(action || "");
      if (normalized === "play") return "media_play_count";
      if (normalized === "pause") return "media_pause_count";
      if (normalized === "previous") return "media_previous_count";
      if (normalized === "next") return "media_next_count";
      if (normalized.startsWith("seek")) return "media_seek_count";
      return "";
    }

    function processMediaCommand(payload, source, timestampMs) {
      const commandToken = String(source && source.command_token || payload.command_token || "").trim().slice(0, 120);
      if (!commandToken) return false;
      const session = ensureActiveSession();
      if (!session) return true;
      let record = mediaCommands.get(commandToken);
      const firstObservation = !record;
      if (!record) {
        record = {
          event: "media_command",
          command_token: commandToken,
          event_sequence: ++mediaEventSequence,
          timestamp_ms: Number(timestampMs) || Date.now(),
          outcome: "pending",
          counted_outcomes: {},
          restart_counted: false
        };
        mediaCommands.set(commandToken, record);
      }
      const previousOutcome = record.outcome;
      Object.assign(record, payload, {
        event: "media_command",
        command_token: commandToken,
        event_sequence: record.event_sequence,
        timestamp_ms: Number(timestampMs) || Date.now()
      });
      if (firstObservation) {
        incrementSummary("media_command_count", 1, session);
        const actionField = mediaActionSummaryField(record.action);
        if (actionField) incrementSummary(actionField, 1, session);
      }
      if (record.decision === "restart" && !record.restart_counted) {
        incrementSummary("media_restart_count", 1, session);
        record.restart_counted = true;
      }
      if (
        isTerminalMediaCommandOutcome(record.outcome) &&
        record.outcome !== previousOutcome &&
        !record.counted_outcomes[record.outcome]
      ) {
        const outcomeField = mediaCommandOutcomeSummaryField(record.outcome);
        if (outcomeField) incrementSummary(outcomeField, 1, session);
        record.counted_outcomes[record.outcome] = true;
      }
      const compact = Object.assign({}, record);
      delete compact.counted_outcomes;
      delete compact.restart_counted;
      upsertCompactEvent(`media-command:${commandToken}`, compact, session);
      pruneLocalMap(mediaCommands, LOCAL_CORRELATION_CAP);
      return true;
    }

    function processMediaCapabilities(payload, source, timestampMs) {
      const session = ensureActiveSession();
      if (!session) return true;
      upsertCompactEvent("media-capabilities", Object.assign({}, payload, {
        event: "media_capabilities",
        event_sequence: ++mediaEventSequence,
        timestamp_ms: Number(timestampMs) || Date.now(),
        result: String(source && source.registration_result || payload.registration_result || "unknown")
      }), session);
      return true;
    }

    function processAudioInterruption(payload, source, timestampMs) {
      const interruptionToken = String(
        source && source.interruption_token || payload.interruption_token || "interruption"
      ).trim().slice(0, 120);
      const session = ensureActiveSession();
      if (!session) return true;
      const firstObservation = !audioInterruptions.has(interruptionToken);
      const record = Object.assign(
        audioInterruptions.get(interruptionToken) || {},
        payload,
        {
          event: "audio_interruption",
          interruption_token: interruptionToken,
          event_sequence: audioInterruptions.has(interruptionToken)
            ? audioInterruptions.get(interruptionToken).event_sequence
            : ++mediaEventSequence,
          timestamp_ms: Number(timestampMs) || Date.now()
        }
      );
      audioInterruptions.set(interruptionToken, record);
      if (firstObservation) incrementSummary("audio_interruption_count", 1, session);
      upsertCompactEvent(`audio-interruption:${interruptionToken}`, record, session);
      pruneLocalMap(audioInterruptions, LOCAL_CORRELATION_CAP);
      return true;
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
        summary: createSessionSummary(),
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

    function isSourcePrepared(sourceKey, source) {
      if (source && (source.prepared === true || source.prefetched === true || source.prefetch_ready === true)) {
        return true;
      }
      const prefetch = sourceKey ? prefetchBySource.get(sourceKey) : null;
      if (prefetch && prefetch.ready) return true;
      const audioState = getAudioState();
      const readySources = audioState.nextPrefetchReadySrcs;
      if (sourceKey && readySources && typeof readySources.forEach === "function") {
        let found = false;
        readySources.forEach(function (candidate) {
          if (localSourceIdentity(candidate) === sourceKey) found = true;
        });
        if (found) return true;
      }
      return Boolean(
        sourceKey &&
        audioState.nextPrefetchDoneSrc &&
        localSourceIdentity(audioState.nextPrefetchDoneSrc) === sourceKey
      );
    }

    function getOrCreatePrefetchRecord(sourceKey, source, timestampMs) {
      if (!sourceKey) return null;
      let record = prefetchBySource.get(sourceKey);
      if (!record) {
        record = {
          source_key: sourceKey,
          started_at_ms: Number(timestampMs) || Date.now(),
          completed_at_ms: 0,
          ready: false,
          cached: false,
          served: false,
          error: false,
          response_ms: null,
          body_ms: null,
          queue_ms: null,
          cache_ms: null,
          attempt: null,
          rank: null
        };
        prefetchBySource.set(sourceKey, record);
      }
      if (source && typeof source === "object") {
        ["response_ms", "body_ms", "queue_ms", "cache_ms", "attempt", "rank"].forEach(function (field) {
          const value = Number(source[field]);
          if (Number.isFinite(value)) record[field] = value;
        });
      }
      pruneLocalMap(prefetchBySource, LOCAL_CORRELATION_CAP);
      return record;
    }

    function processPrefetchRuntimeEvent(eventType, source, timestampMs) {
      if (![
        "prefetch_start",
        "prefetch_done",
        "prefetch_error",
        "prefetch_cache_timeout_recovered",
        "prefetch_cache_rehydrated"
      ].includes(eventType)) return;
      const session = ensureActiveSession();
      const sourceKey = getLocalSourceIdentity(source);
      let changed = false;
      if (eventType === "prefetch_start") {
        incrementSummary("prefetch_start_count", 1, session);
        const record = getOrCreatePrefetchRecord(sourceKey, source, timestampMs);
        if (record) {
          record.started_at_ms = Number(timestampMs) || record.started_at_ms;
          record.ready = false;
          record.error = false;
        }
      } else if (eventType === "prefetch_done") {
        changed = true;
        incrementSummary("prefetch_done_count", 1, session);
        const record = getOrCreatePrefetchRecord(sourceKey, source, timestampMs);
        if (record) {
          record.ready = true;
          record.completed_at_ms = Number(timestampMs) || Date.now();
        }
      } else if (eventType === "prefetch_error") {
        incrementSummary("prefetch_error_count", 1, session);
        const record = getOrCreatePrefetchRecord(sourceKey, source, timestampMs);
        if (record) record.error = true;
      } else if (eventType === "prefetch_cache_timeout_recovered") {
        changed = true;
        incrementSummary("prefetch_cache_ready_count", 1, session);
        const record = getOrCreatePrefetchRecord(sourceKey, source, timestampMs);
        if (record) {
          record.ready = true;
          record.cached = true;
          record.completed_at_ms = Number(timestampMs) || Date.now();
        }
      } else if (eventType === "prefetch_cache_rehydrated") {
        changed = true;
        const sources = Array.isArray(source && source.sources) ? source.sources : [];
        const restoredCount = Math.max(sources.length, Math.floor(Number(source && source.restored_count) || 0));
        incrementSummary("prefetch_cache_ready_count", restoredCount, session);
        sources.forEach(function (candidate) {
          const candidateKey = localSourceIdentity(candidate);
          const record = getOrCreatePrefetchRecord(candidateKey, source, timestampMs);
          if (!record) return;
          record.ready = true;
          record.cached = true;
          record.completed_at_ms = Number(timestampMs) || Date.now();
        });
      }
      if (changed && session) persistSession(session);
    }

    function getOrCreateTrackTransition(requestToken, payload, source) {
      const token = Number(requestToken);
      if (!Number.isFinite(token) || token <= 0) return null;
      let transition = trackTransitions.get(token);
      const sourceKey = getLocalSourceIdentity(source);
      if (
        transition &&
        sourceKey &&
        transition.source_key &&
        transition.source_key !== sourceKey
      ) {
        return null;
      }
      if (!transition) {
        const timestampMs = Number(payload && payload.timestamp_ms) || Date.now();
        transition = {
          request_token: token,
          started_at_ms: timestampMs,
          source_key: sourceKey,
          track: String(payload && payload.track || "unknown"),
          album: String(payload && payload.album || "").toLowerCase(),
          source: String(payload && payload.source || ""),
          trigger: String(payload && payload.trigger || ""),
          surface: String(payload && payload.surface || ""),
          mode: String(payload && payload.mode || getPlaybackMode()),
          playlist_kind: String(payload && payload.playlist_kind || getAudioState().playlistKind || ""),
          prepared: isSourcePrepared(sourceKey, source),
          served_from_prefetch: false,
          waiting_count: 0,
          stalled_count: 0,
          play_call_at_ms: 0,
          loadstart_at_ms: 0,
          canplay_at_ms: 0,
          play_resolved_at_ms: 0,
          playing_at_ms: 0,
          finalized: false,
          summary_counted: false,
          served_counted: false,
          media_error_recorded: false,
          result: "pending"
        };
        trackTransitions.set(token, transition);
        activeTrackToken = token;
        if (trackTransitions.size > LOCAL_CORRELATION_CAP) {
          const oldestToken = trackTransitions.keys().next().value;
          const oldest = trackTransitions.get(oldestToken);
          if (oldest && !oldest.finalized) finalizeTrackTransition(oldest, "sealed", Date.now());
          trackTransitions.delete(oldestToken);
        }
      }
      if (sourceKey) transition.source_key = sourceKey;
      if (payload && payload.track && payload.track !== "unknown") transition.track = String(payload.track);
      if (payload && payload.album) transition.album = String(payload.album).toLowerCase();
      if (payload && payload.source) transition.source = String(payload.source);
      if (payload && payload.trigger) transition.trigger = String(payload.trigger);
      if (payload && payload.surface) transition.surface = String(payload.surface);
      if (source && (source.prepared === true || source.prefetched === true || source.prefetch_ready === true)) {
        transition.prepared = true;
      } else if (!transition.prepared) {
        transition.prepared = isSourcePrepared(transition.source_key, source);
      }
      return transition;
    }

    function relativeStageMs(transition, timestampMs) {
      const timestamp = Number(timestampMs);
      if (!transition || !Number.isFinite(timestamp) || timestamp <= 0) return null;
      return Math.max(0, Math.round(timestamp - transition.started_at_ms));
    }

    function buildTrackTransitionEvent(transition, timestampMs) {
      const endedAt = Number(transition.finalized_at_ms) || Number(timestampMs) || Date.now();
      const playBase = transition.play_call_at_ms || transition.started_at_ms;
      const playToEnd = Math.max(0, Math.round(endedAt - playBase));
      const prefetch = transition.source_key ? prefetchBySource.get(transition.source_key) : null;
      const event = {
        event: "track_transition",
        fine_event: true,
        trace_id: getTraceId(transition.request_token),
        build: getRuntimeVersion(),
        timestamp_ms: endedAt,
        request_token: transition.request_token,
        track: transition.track || "unknown",
        album: transition.album || "unknown",
        source: transition.source || "",
        ua_class: getUaClass(),
        mode: transition.mode || getPlaybackMode(),
        playlist_kind: transition.playlist_kind || "",
        trigger: transition.trigger || "",
        surface: transition.surface || "",
        result: transition.result || "sealed",
        error_name: transition.error_name || "",
        error: transition.result === "rejected" || transition.result === "error",
        prepared: Boolean(transition.prepared),
        prefetch_ready: Boolean(transition.prepared),
        served_from_prefetch: Boolean(transition.served_from_prefetch),
        delta_ms: playToEnd,
        duration_before_play_ms: playToEnd,
        play_call_ms: relativeStageMs(transition, transition.play_call_at_ms),
        loadstart_ms: relativeStageMs(transition, transition.loadstart_at_ms),
        canplay_ms: relativeStageMs(transition, transition.canplay_at_ms),
        play_resolved_ms: relativeStageMs(transition, transition.play_resolved_at_ms),
        playing_ms: relativeStageMs(transition, transition.playing_at_ms),
        waiting_count: transition.waiting_count,
        stalled_count: transition.stalled_count
      };
      if (prefetch) {
        event.prefetch_age_ms = prefetch.completed_at_ms
          ? Math.max(0, Math.round(transition.started_at_ms - prefetch.completed_at_ms))
          : null;
        event.response_ms = prefetch.response_ms;
        event.body_ms = prefetch.body_ms;
        event.queue_ms = prefetch.queue_ms;
        event.cache_ms = prefetch.cache_ms;
        event.attempt = prefetch.attempt;
        event.rank = prefetch.rank;
        event.cached = Boolean(prefetch.cached);
      }
      return Object.assign(event, getEnvironment());
    }

    function finalizeTrackTransition(transition, result, timestampMs) {
      if (!transition) return null;
      const firstFinalization = !transition.finalized;
      if (firstFinalization) {
        transition.finalized = true;
        transition.result = String(result || "sealed");
        transition.finalized_at_ms = Number(timestampMs) || Date.now();
      }
      const event = buildTrackTransitionEvent(transition, timestampMs);
      const session = ensureActiveSession();
      if (firstFinalization && session) {
        const latency = Number(event.delta_ms) || 0;
        incrementSummary("track_transition_count", 1, session);
        if (transition.result === "playing") incrementSummary("track_playing_count", 1, session);
        if (transition.result === "rejected") incrementSummary("track_rejected_count", 1, session);
        if (transition.result === "error") incrementSummary("track_error_count", 1, session);
        incrementSummary(transition.prepared ? "prepared_count" : "unprepared_count", 1, session);
        if (transition.result === "playing") {
          if (latency >= SLOW_TRACK_TRANSITION_MS) incrementSummary("slow_transition_count", 1, session);
          incrementSummary("total_play_to_playing_ms", latency, session);
          updateSummaryMax("max_play_to_playing_ms", latency, session);
        }
        transition.summary_counted = true;
      }
      if (transition.served_from_prefetch && !transition.served_counted && session) {
        incrementSummary("served_from_prefetch_count", 1, session);
        transition.served_counted = true;
      }
      return upsertCompactEvent(`track:${transition.request_token}`, event, session);
    }

    function markTransitionServed(requestToken, source, timestampMs) {
      const token = Number(requestToken) || activeTrackToken;
      const sourceKey = getLocalSourceIdentity(source);
      const prefetch = getOrCreatePrefetchRecord(sourceKey, source, timestampMs);
      if (prefetch) prefetch.served = true;
      let transition = token ? trackTransitions.get(token) : null;
      if (
        transition &&
        sourceKey &&
        transition.source_key &&
        transition.source_key !== sourceKey
      ) {
        transition = null;
      }
      if (!transition && sourceKey) {
        trackTransitions.forEach(function (candidate) {
          if (!transition && candidate.source_key === sourceKey) transition = candidate;
        });
      }
      if (!transition) return;
      if (transition.served_from_prefetch) return;
      transition.served_from_prefetch = true;
      transition.prepared = true;
      if (transition.finalized) finalizeTrackTransition(transition, transition.result, timestampMs);
    }

    function processTrackRuntimeEvent(eventType, payload, source, requestToken, timestampMs) {
      const token = Number(requestToken) || activeTrackToken;
      if (eventType === "waiting") {
        incrementSummary("waiting_count", 1);
        const pending = token ? trackTransitions.get(token) : null;
        if (pending && !pending.finalized) pending.waiting_count += 1;
        return;
      }
      if (eventType === "stalled") {
        incrementSummary("stalled_count", 1);
        const pending = token ? trackTransitions.get(token) : null;
        if (pending && !pending.finalized) pending.stalled_count += 1;
        return;
      }
      if (eventType === "served_from_prefetch") {
        markTransitionServed(token, source, timestampMs);
        return;
      }
      const stageEvents = new Set([
        "startTrack_enter", "click_track", "source_resolved", "source_assigned",
        "play_request", "load_called", "ready_wait_start", "ready_wait_end",
        "play_call", "first_byte", "canplay", "playable", "play_resolved",
        "play_rejected", "playing", "error"
      ]);
      if (!stageEvents.has(eventType) || !token) return false;
      const transition = getOrCreateTrackTransition(token, payload, source);
      if (!transition) return false;
      const at = Number(timestampMs) || Date.now();
      const wasFinalized = transition.finalized;
      if (eventType === "play_call" && !transition.play_call_at_ms) transition.play_call_at_ms = at;
      if (eventType === "first_byte" && !transition.loadstart_at_ms) transition.loadstart_at_ms = at;
      if ((eventType === "canplay" || eventType === "playable") && !transition.canplay_at_ms) {
        transition.canplay_at_ms = at;
      }
      if (eventType === "play_resolved" && !transition.play_resolved_at_ms) transition.play_resolved_at_ms = at;
      if (eventType === "playing") {
        if (wasFinalized) return false;
        transition.playing_at_ms = at;
        finalizeTrackTransition(transition, "playing", at);
      } else if (eventType === "play_rejected") {
        if (wasFinalized) return false;
        transition.error_name = String(source.reason || source.error_name || source.error_message || "play_rejected");
        finalizeTrackTransition(transition, "rejected", at);
      } else if (eventType === "error") {
        transition.error_name = String(source.reason || source.error_name || source.error_message || "media_error");
        if (!wasFinalized) finalizeTrackTransition(transition, "error", at);
        if (wasFinalized && !transition.media_error_recorded) {
          transition.media_error_recorded = true;
          incrementSummary("track_error_count", 1);
          return true;
        }
        return false;
      }
      return false;
    }

    function getSpaTargetIdentity(source) {
      if (!source || typeof source !== "object") return "";
      const fromUrl = source.to_url || source.url || "";
      const urlIdentity = localSourceIdentity(fromUrl);
      if (urlIdentity) return urlIdentity;
      return String(source.to_album || source.album || "unknown").trim().toLowerCase();
    }

    function getOrCreateSpaTransition(eventType, payload, source, timestampMs) {
      const targetIdentity = getSpaTargetIdentity(source);
      const navigationToken = Math.max(0, Math.round(Number(source.navigation_token || payload.navigation_token) || 0));
      if (eventType === "nav:album_start") {
        const key = navigationToken
          ? `${targetIdentity || "nav"}|nav:${navigationToken}`
          : `${targetIdentity || "nav"}|${++spaSequence}`;
        const transition = {
          key,
          target_identity: targetIdentity,
          started_at_ms: Number(timestampMs) || Date.now(),
          from_album: String(payload.from_album || ""),
          to_album: String(payload.to_album || payload.album || ""),
          cached: Boolean(payload.cached),
          cover_wait_ms: 0,
          cover_timed_out: false,
          render_ms: 0,
          swap_ms: 0,
          finalized: false,
          result: "pending"
        };
        transition.navigation_token = navigationToken;
        spaTransitions.set(key, transition);
        if (targetIdentity) spaKeyByTarget.set(targetIdentity, key);
        if (navigationToken) spaKeyByNavigation.set(navigationToken, key);
        activeSpaKey = key;
        pruneLocalMap(spaTransitions, LOCAL_CORRELATION_CAP);
        pruneLocalMap(spaKeyByTarget, LOCAL_CORRELATION_CAP);
        pruneLocalMap(spaKeyByNavigation, LOCAL_CORRELATION_CAP);
        return transition;
      }
      const knownKey = (navigationToken ? spaKeyByNavigation.get(navigationToken) : "") ||
        (targetIdentity ? spaKeyByTarget.get(targetIdentity) : "");
      let transition = spaTransitions.get(knownKey || activeSpaKey);
      if (!transition && ["album_open_tap", "spa_render_start", "spa_swap_start"].includes(eventType)) {
        const key = navigationToken
          ? `${targetIdentity || "nav"}|nav:${navigationToken}`
          : `${targetIdentity || "nav"}|${++spaSequence}`;
        transition = {
          key,
          target_identity: targetIdentity,
          started_at_ms: Number(timestampMs) || Date.now(),
          from_album: String(payload.from_album || ""),
          to_album: String(payload.to_album || payload.album || ""),
          cached: Boolean(payload.cached),
          cover_wait_ms: 0,
          cover_timed_out: false,
          render_ms: 0,
          swap_ms: 0,
          finalized: false,
          result: "pending"
        };
        transition.navigation_token = navigationToken;
        spaTransitions.set(key, transition);
        if (targetIdentity) spaKeyByTarget.set(targetIdentity, key);
        if (navigationToken) spaKeyByNavigation.set(navigationToken, key);
        activeSpaKey = key;
        pruneLocalMap(spaTransitions, LOCAL_CORRELATION_CAP);
        pruneLocalMap(spaKeyByTarget, LOCAL_CORRELATION_CAP);
        pruneLocalMap(spaKeyByNavigation, LOCAL_CORRELATION_CAP);
      }
      if (!transition) return null;
      if (payload.from_album) transition.from_album = String(payload.from_album);
      if (payload.to_album || payload.album) transition.to_album = String(payload.to_album || payload.album);
      if (typeof payload.cached === "boolean") transition.cached = payload.cached;
      return transition;
    }

    function buildSpaNavigationEvent(transition, timestampMs) {
      const endedAt = Number(timestampMs) || Date.now();
      return Object.assign({}, getEnvironment(), {
        event: "spa_navigation",
        fine_event: true,
        build: getRuntimeVersion(),
        timestamp_ms: endedAt,
        track: "navigation",
        album: String(transition.to_album || "unknown").toLowerCase(),
        source: "spa",
        ua_class: getUaClass(),
        from_album: transition.from_album || "",
        to_album: transition.to_album || "",
        route_kind: transition.route_kind || "",
        swap_mode: transition.swap_mode || "",
        swap_policy: transition.swap_policy || "",
        result: transition.result || "done",
        reason: transition.reason || "",
        navigation_token: transition.navigation_token || 0,
        cached: Boolean(transition.cached),
        error: transition.result !== "done",
        delta_ms: Math.max(0, Math.round(endedAt - transition.started_at_ms)),
        duration_ms: Math.max(0, Math.round(endedAt - transition.started_at_ms)),
        cover_wait_ms: transition.cover_wait_ms || 0,
        cover_timed_out: Boolean(transition.cover_timed_out),
        render_ms: transition.render_ms || 0,
        swap_ms: transition.swap_ms || 0,
        response_ms: transition.response_ms || 0,
        strategy: transition.strategy || "",
        cache_hint: transition.cache_hint || "",
        cover_natural_width: transition.cover_natural_width || 0,
        cover_display_px: transition.cover_display_px || 0,
        first_paint_ms: transition.first_paint_ms || 0,
        visible_cover_count: transition.visible_cover_count || 0,
        visible_cover_ready_count: transition.visible_cover_ready_count || 0,
        cover_ready_at_first_paint: transition.cover_ready_at_first_paint !== false,
        second_paint_ms: transition.second_paint_ms || 0,
        second_visible_cover_count: transition.second_visible_cover_count || 0,
        second_visible_cover_ready_count: transition.second_visible_cover_ready_count || 0,
        cover_ready_at_second_paint: transition.cover_ready_at_second_paint !== false,
        controllerchange: Boolean(transition.controllerchange),
        sw_reload_between: Boolean(transition.sw_reload_between)
      });
    }

    function finalizeSpaTransition(transition, result, timestampMs) {
      if (!transition) return null;
      const firstFinalization = !transition.finalized;
      if (firstFinalization) {
        transition.finalized = true;
        transition.result = String(result || "done");
      }
      const event = buildSpaNavigationEvent(transition, timestampMs);
      const session = ensureActiveSession();
      if (firstFinalization && session) {
        incrementSummary("spa_navigation_count", 1, session);
        if (transition.result !== "done") incrementSummary("spa_abort_count", 1, session);
        if (event.delta_ms >= SLOW_SPA_NAVIGATION_MS) incrementSummary("spa_slow_count", 1, session);
        if (event.visible_cover_count > 0 && event.cover_ready_at_first_paint === false) {
          incrementSummary("spa_cover_not_ready_count", 1, session);
        }
        if (event.second_visible_cover_count > 0 && event.cover_ready_at_second_paint === false) {
          incrementSummary("spa_second_cover_not_ready_count", 1, session);
        }
        updateSummaryMax("max_spa_navigation_ms", event.delta_ms, session);
        updateSummaryMax("max_first_paint_ms", event.first_paint_ms, session);
        updateSummaryMax("max_second_paint_ms", event.second_paint_ms, session);
      }
      return upsertCompactEvent(`spa:${transition.key}`, event, session);
    }

    function processSpaRuntimeEvent(eventType, payload, source, timestampMs) {
      const spaEvents = new Set([
        "album_open_tap", "album_open_done", "album_open_fail", "nav:album_start",
        "nav:album_done", "nav:album_abort", "spa_render_start", "spa_render_done",
        "spa_swap_start", "spa_swap_done", "cover_decode_duration", "spa_html_response"
      ]);
      if (!spaEvents.has(eventType)) return;
      const transition = getOrCreateSpaTransition(eventType, payload, source, timestampMs);
      if (!transition) return;
      if (
        eventType === "cover_decode_duration" &&
        source &&
        (source.album_cover_only || source.blocking)
      ) {
        transition.cover_wait_ms = Math.max(transition.cover_wait_ms, Math.round(Number(source.duration_ms) || 0));
        transition.cover_timed_out = Boolean(transition.cover_timed_out || source.timed_out);
        transition.cover_natural_width = Math.max(
          Number(transition.cover_natural_width) || 0,
          Math.round(Number(source.cover_natural_width) || 0)
        );
        transition.cover_display_px = Math.max(
          Number(transition.cover_display_px) || 0,
          Math.round(Number(source.cover_display_px) || 0)
        );
      }
      if (eventType === "spa_render_done") transition.render_ms = Math.round(Number(source.duration_ms) || 0);
      if (eventType === "spa_swap_done") {
        transition.swap_ms = Math.round(Number(source.duration_ms) || 0);
        transition.swap_mode = String(source.swap_mode || "");
        transition.swap_policy = String(source.swap_policy || "");
        transition.route_kind = String(source.route_kind || "");
        transition.first_paint_ms = Math.max(0, Math.round(Number(source.first_paint_wait_ms) || 0));
        transition.visible_cover_count = Math.max(0, Math.round(Number(source.paint_relevant_cover_count) || 0));
        transition.visible_cover_ready_count = Math.max(0, Math.round(Number(source.paint_relevant_cover_ready_count) || 0));
        transition.cover_ready_at_first_paint = source.paint_relevant_cover_ready !== false;
        transition.second_paint_ms = Math.max(0, Math.round(Number(source.second_paint_wait_ms) || 0));
        transition.second_visible_cover_count = Math.max(0, Math.round(Number(source.second_paint_relevant_cover_count) || 0));
        transition.second_visible_cover_ready_count = Math.max(0, Math.round(Number(source.second_paint_relevant_cover_ready_count) || 0));
        transition.cover_ready_at_second_paint = source.second_paint_relevant_cover_ready !== false;
      }
      if (eventType === "spa_html_response") {
        transition.strategy = String(source.strategy || "");
        transition.cache_hint = String(source.cache_hint || "");
        transition.response_ms = Math.max(0, Math.round(Number(source.response_ms) || 0));
      }
      if (source.reason) transition.reason = String(source.reason);
      if (typeof source.controllerchange === "boolean") transition.controllerchange = source.controllerchange;
      if (typeof source.sw_reload_between === "boolean") transition.sw_reload_between = source.sw_reload_between;
      if (transition.finalized) return;
      if (eventType === "album_open_done" || eventType === "nav:album_done") {
        finalizeSpaTransition(transition, "done", timestampMs);
      } else if (eventType === "album_open_fail") {
        finalizeSpaTransition(transition, "failed", timestampMs);
      } else if (eventType === "nav:album_abort") {
        finalizeSpaTransition(transition, "aborted", timestampMs);
      }
    }

    function processMiniPlayerVisibility(payload, source, timestampMs) {
      let state = String(source && source.state || payload.state || "").trim().toLowerCase();
      if (state !== "visible" && state !== "hidden") {
        if (typeof source.visible !== "boolean") return false;
        state = source.visible ? "visible" : "hidden";
      }
      if (state === miniVisibilityState) return true;
      miniVisibilityState = state;
      miniVisibilitySequence += 1;
      const reason = String(source.reason || payload.reason || "state_change");
      const unexpected = typeof source.unexpected === "boolean"
        ? source.unexpected
        : (state === "hidden" && !/fullscreen|overlay|now_playing/i.test(reason));
      const session = ensureActiveSession();
      if (!session) return true;
      incrementSummary("mini_visibility_change_count", 1, session);
      if (state === "hidden") incrementSummary("mini_hidden_count", 1, session);
      if (unexpected) incrementSummary("mini_unexpected_hidden_count", 1, session);
      upsertCompactEvent(`mini:${miniVisibilitySequence}`, Object.assign({}, payload, {
        event: "mini_player_visibility",
        timestamp_ms: Number(timestampMs) || Date.now(),
        state,
        visible: state === "visible",
        reason,
        unexpected,
        error: false
      }), session);
      return true;
    }

    function processVisualizerHealth(payload, source, timestampMs) {
      const session = ensureActiveSession();
      const summary = getSessionSummary(session);
      if (!session || !summary) return false;
      const fields = [
        "visualizer_open_count",
        "visualizer_activation_count",
        "visualizer_activation_success_count",
        "visualizer_activation_error_count",
        "visualizer_frame_count",
        "visualizer_nonzero_frame_count",
        "visualizer_zero_frame_count",
        "visualizer_max_rms_milli",
        "visualizer_max_bass_milli",
        "visualizer_max_mid_milli",
        "visualizer_max_treble_milli",
        "visualizer_energy_range_milli",
        "visualizer_max_amplitude_px",
        "visualizer_powder_particle_count",
        "visualizer_powder_surface_ready",
        "visualizer_powder_kick_count",
        "visualizer_powder_airborne_count",
        "visualizer_powder_max_airborne_count",
        "visualizer_powder_max_rise_px",
        "visualizer_powder_earth_particle_count",
        "visualizer_powder_moon_particle_count",
        "visualizer_powder_upper_particle_count",
        "visualizer_powder_lower_particle_count",
        "visualizer_powder_helix_particle_count",
        "visualizer_powder_helix_active_count",
        "visualizer_powder_helix_max_active_count",
        "visualizer_powder_helix_max_offset_px",
        "visualizer_powder_gravity_milli",
        "visualizer_powder_moon_gravity_milli",
        "visualizer_powder_max_update_ms",
        "visualizer_canvas_width",
        "visualizer_canvas_height",
        "visualizer_canvas_opacity_milli",
        "visualizer_audio_advanced_ms",
        "visualizer_context_supported",
        "visualizer_context_running",
        "visualizer_analyser_ready",
        "visualizer_canvas_visible"
      ];
      fields.forEach(function (field) {
        const value = Number(source && source[field]);
        if (!Number.isFinite(value) || value < 0) return;
        summary[field] = Math.max(Number(summary[field]) || 0, Math.round(value));
      });
      upsertCompactEvent("visualizer_health", Object.assign({}, payload, {
        event: "visualizer_health",
        timestamp_ms: Number(timestampMs) || Date.now(),
        result: String(source && source.result || ""),
        state: String(source && source.state || ""),
        reason: String(source && source.reason || "probe"),
        error: Boolean(source && source.error_name),
        error_name: String(source && source.error_name || "")
      }), session);
      return true;
    }

    function finalizeOpenTransitions(reason, timestampMs) {
      trackTransitions.forEach(function (transition) {
        if (!transition.finalized) finalizeTrackTransition(transition, reason || "sealed", timestampMs);
      });
      mediaCommands.forEach(function (command) {
        if (isTerminalMediaCommandOutcome(command.outcome)) return;
        processMediaCommand(Object.assign({}, command, {
          outcome: "incomplete",
          reason: String(reason || "sealed")
        }), command, timestampMs);
      });
      spaTransitions.forEach(function (transition) {
        if (!transition.finalized) {
          transition.reason = transition.reason || String(reason || "sealed");
          finalizeSpaTransition(transition, "aborted", timestampMs);
        }
      });
    }

    function sessionSummaryHasActivity(session) {
      const summary = getSessionSummary(session);
      return Boolean(summary && SESSION_SUMMARY_FIELDS.some(function (field) {
        return Number(summary[field]) > 0;
      }));
    }

    function sealCurrentSession(reason) {
      const current = currentSessionId ? sessions.get(currentSessionId) : null;
      if (!current || current.status !== "active") return null;
      const endedAt = Date.now();
      finalizeOpenTransitions("sealed", endedAt);
      if (current.events.length || sessionSummaryHasActivity(current)) {
        upsertSessionSummaryEvent(current, endedAt);
      }
      currentSessionId = "";
      trackTransitions.clear();
      spaTransitions.clear();
      spaKeyByTarget.clear();
      spaKeyByNavigation.clear();
      compactEvents.clear();
      mediaCommands.clear();
      audioInterruptions.clear();
      activeTrackToken = 0;
      activeSpaKey = "";
      if (!current.events.length) {
        sessions.delete(current.session_id);
        deleteStoredSessions([current.session_id]);
        return null;
      }
      current.status = "sealed";
      current.close_reason = String(reason || "hidden").slice(0, 40);
      current.ended_at_ms = endedAt;
      current.last_at_ms = Math.max(current.last_at_ms || 0, current.ended_at_ms);
      persistSession(current);
      return current;
    }

    function sealInterruptedSessions() {
      sessions.forEach(function (session) {
        if (session.status !== "active" || session.session_id === currentSessionId) return;
        if (session.events.length || sessionSummaryHasActivity(session)) {
          upsertSessionSummaryEvent(session, session.last_at_ms || session.started_at_ms);
        }
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
      appendSanitizedEvent(session, sanitized);
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
      if (!RAW_EVENTS.has(eventType)) return;
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
      const timestampMs = Date.now();
      const errorEvent = eventType === "play_rejected" ||
        eventType === "error" ||
        eventType === "prefetch_error" ||
        (eventType === "media_command" && ["rejected", "no_progress", "recovery_failed", "incomplete"].includes(String(source.outcome || ""))) ||
        /_failed$/.test(eventType);
      const payload = Object.assign({}, source, getEnvironment(), getHealthSessionState(), {
        event: eventType,
        fine_event: true,
        trace_id: getTraceId(requestToken),
        build: getRuntimeVersion(),
        timestamp_ms: timestampMs,
        delta_ms: normalizedDeltaMs,
        duration_before_play_ms: eventType === "click_track" ? 0 : normalizedDeltaMs,
        track: getMonitorTrackValue(source),
        album: String(source.album || "").toLowerCase(),
        source: source.source || getAudioSource(source.src),
        ua_class: getUaClass(),
        mode: source.mode || getPlaybackMode(),
        playlist_kind: source.playlist_kind || audioState.playlistKind || "",
        auto: getAutoFlag(eventType, source, requestToken),
        error: errorEvent,
        error_name: eventType === "visualizer_health"
          ? (source.error_name || "")
          : (source.reason || source.error_name || source.error_message || "")
      });

      if (eventType === "media_command") {
        processMediaCommand(payload, source, timestampMs);
        return;
      }
      if (eventType === "media_capabilities") {
        processMediaCapabilities(payload, source, timestampMs);
        return;
      }
      if (eventType === "audio_interruption") {
        processAudioInterruption(payload, source, timestampMs);
        return;
      }

      if (eventType.startsWith("prefetch_")) {
        processPrefetchRuntimeEvent(eventType, source, timestampMs);
      }
      const storeStandaloneTrackEvent = processTrackRuntimeEvent(
        eventType,
        payload,
        source,
        requestToken,
        timestampMs
      );
      processSpaRuntimeEvent(eventType, payload, source, timestampMs);
      if (eventType === "mini_player_visibility") {
        processMiniPlayerVisibility(payload, source, timestampMs);
        return;
      }
      if (eventType === "visualizer_health") {
        processVisualizerHealth(payload, source, timestampMs);
        return;
      }
      if (DIRECT_EVENTS.has(eventType) || storeStandaloneTrackEvent) enqueue(payload);
    }

    function buildMonitorPayload(track, index, src) {
      return call(ctx, "buildMonitorPayload", track, index, src) || {};
    }

    function sendMonitoringLog(track, index, src, data) {
      const workerUrl = getWorkerUrl();
      if (typeof fetch !== "function" || !workerUrl) return;
      if (!data || data.error !== true) markHealthSessionActive();
      const monitorError = Boolean(data && data.error === true);
      if (!monitorError) return;
      trackRuntimeEvent("error", Object.assign(
        buildMonitorPayload(track, index, src),
        data || {},
        { request_token: Number(getAudioState().playRequestToken || getAudioState().startRequestToken) }
      ));
    }

    function logAuditEvent(type, track, index, src, data) {
      trackRuntimeEvent(type, Object.assign(buildMonitorPayload(track, index, src), data || {}));
    }

    function startHeartbeat() {
      // Session v3 is event-driven; periodic telemetry is intentionally disabled.
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
      initLifecycle,
      recordCacheObservation,
      recordStorageSnapshot
    };
  }

  window.InfraAudioTelemetry = {
    now,
    createTelemetry
  };
})();
