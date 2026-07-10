(function () {
  "use strict";

  function createPwaRuntime(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL("./", window.location.href), query: "" };
    const runtimeVersion = String(ctx.runtimeVersion || "");
    const now = typeof ctx.now === "function" ? ctx.now : function () { return Date.now(); };
    const getCurrentPlayableAudioSrc = typeof ctx.getCurrentPlayableAudioSrc === "function"
      ? ctx.getCurrentPlayableAudioSrc
      : function () { return ""; };
    const track = typeof ctx.trackAudioRuntimeEvent === "function" ? ctx.trackAudioRuntimeEvent : function () {};
    const flushTelemetry = typeof ctx.flushAudioTelemetryQueue === "function" ? ctx.flushAudioTelemetryQueue : function () {};
    const minIdleMs = Number(ctx.minIdleMs) || 8000;
    const minVisibleMs = Number(ctx.minVisibleMs) || 2000;
    const updateCheckMinMs = Number(ctx.updateCheckMinMs) || 60000;
    const pageOpenedAt = now();
    let registered = false;
    let controllerChangeBound = false;
    let reloading = false;
    let reloadPending = false;
    let reloadTimer = 0;
    let registrationRef = null;
    let lastUpdateCheckAt = 0;
    let controllerChangeAt = 0;
    let reloadExecutedAt = 0;
    let lastUserInteractionAt = now();
    let visibleSinceAt = document.visibilityState === "visible" ? now() : 0;

    function getReloadState() {
      const audio = audioState.audio;
      const audioPlaying = Boolean(audio && !audio.paused && getCurrentPlayableAudioSrc(audio));
      const trackStarting = Boolean(audioState.trackStartInFlight);
      const overlayOpen = Boolean(audioState.nowPlayingOpen || audioState.nowPlayingClosing);
      const visible = document.visibilityState === "visible";
      const current = now();
      const idleForMs = Math.max(0, Math.round(current - lastUserInteractionAt));
      const visibleForMs = visible && visibleSinceAt ? Math.max(0, Math.round(current - visibleSinceAt)) : 0;
      return {
        audioPlaying,
        trackStarting,
        overlayOpen,
        visible,
        idleForMs,
        visibleForMs,
        idleSafe: idleForMs >= minIdleMs,
        visibleSafe: visibleForMs >= minVisibleMs
      };
    }

    function buildReloadTelemetry(extra) {
      const state = getReloadState();
      return Object.assign({
        page_delta_ms: Math.max(0, Math.round(now() - pageOpenedAt)),
        controllerchange_delta_ms: controllerChangeAt ? Math.max(0, Math.round(now() - controllerChangeAt)) : null,
        reload_executed_delta_ms: reloadExecutedAt ? Math.max(0, Math.round(now() - reloadExecutedAt)) : null,
        visibility_state: document.visibilityState || "",
        idle_for_ms: state.idleForMs,
        visible_for_ms: state.visibleForMs,
        audio_playing: state.audioPlaying,
        track_starting: state.trackStarting,
        overlay_open: state.overlayOpen
      }, extra || {});
    }

    function isReloadSafe() {
      const state = getReloadState();
      return state.visible && state.idleSafe && state.visibleSafe && !state.audioPlaying && !state.trackStarting && !state.overlayOpen;
    }

    function getDeferredDelayMs() {
      const state = getReloadState();
      if (!state.visible || state.audioPlaying || state.trackStarting || state.overlayOpen) return 0;
      return Math.max(180, minIdleMs - state.idleForMs + 180, minVisibleMs - state.visibleForMs + 180);
    }

    function clearReloadTimer() {
      if (!reloadTimer) return;
      window.clearTimeout(reloadTimer);
      reloadTimer = 0;
    }

    function attemptDeferredReload() {
      clearReloadTimer();
      if (!reloadPending || reloading) return;
      if (!isReloadSafe()) {
        const delay = getDeferredDelayMs();
        if (delay > 0) scheduleDeferredServiceWorkerReload(delay);
        return;
      }
      reloadPending = false;
      reloading = true;
      reloadExecutedAt = now();
      track("sw_reload_executed", buildReloadTelemetry());
      flushTelemetry({ beacon: true });
      window.setTimeout(function () { window.location.reload(); }, 80);
    }

    function scheduleDeferredServiceWorkerReload(delayMs) {
      if (!reloadPending || reloading) return;
      clearReloadTimer();
      reloadTimer = window.setTimeout(attemptDeferredReload, Math.max(0, Number(delayMs) || 180));
    }

    function markReloadPending() {
      try {
        const key = "infra_sw_controller_reload_runtime_v2";
        if (String(sessionStorage.getItem(key) || "").trim() === runtimeVersion) return false;
        sessionStorage.setItem(key, runtimeVersion);
      } catch (_err) {
        // The in-memory guard still prevents repeated reloads in this session.
      }
      reloadPending = true;
      track("sw_reload_pending", buildReloadTelemetry());
      return true;
    }

    function noteInteraction() {
      lastUserInteractionAt = now();
      if (reloadPending) scheduleDeferredServiceWorkerReload(minIdleMs + 180);
    }

    function requestServiceWorkerUpdateCheck(reason) {
      if (!registrationRef || typeof registrationRef.update !== "function") return;
      const current = now();
      if (reason !== "registered" && lastUpdateCheckAt && current - lastUpdateCheckAt < updateCheckMinMs) return;
      lastUpdateCheckAt = current;
      registrationRef.update().catch(function () {});
    }

    function registerServiceWorker() {
      if (registered) return;
      registered = true;
      if (!("serviceWorker" in navigator)) return;
      if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

      if (!controllerChangeBound) {
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (reloading) return;
          controllerChangeAt = now();
          track("sw_controllerchange", buildReloadTelemetry());
          if (markReloadPending()) scheduleDeferredServiceWorkerReload();
        });
        navigator.serviceWorker.addEventListener("message", function (event) {
          const data = event && event.data ? event.data : null;
          if (!data || data.type !== "INFRA_SW_OPTIONAL_CACHE_ERROR") return;
          track("sw_optional_cache_error", {
            asset: String(data.asset || ""),
            reason: String(data.reason || "cache_add_failed")
          });
        });
        controllerChangeBound = true;
      }

      const swUrl = new URL(`sw.js${runtime.query}`, runtime.baseUrl).href;
      navigator.serviceWorker.register(swUrl, { scope: runtime.baseUrl.pathname, updateViaCache: "none" })
        .then(function (registration) {
          registrationRef = registration;
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
          requestServiceWorkerUpdateCheck("registered");
          registration.addEventListener("updatefound", function () {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", function () {
              if (worker.state === "installed" && navigator.serviceWorker.controller && registration.waiting) {
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(function () {});
    }

    ["pointerdown", "touchstart", "click", "keydown", "scroll"].forEach(function (eventName) {
      window.addEventListener(eventName, noteInteraction, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      visibleSinceAt = now();
      requestServiceWorkerUpdateCheck("visible");
      if (reloadPending) scheduleDeferredServiceWorkerReload(minVisibleMs + 180);
    });

    return {
      registerServiceWorker,
      scheduleDeferredServiceWorkerReload,
      requestServiceWorkerUpdateCheck,
      getReloadState,
      getControllerChangeAt: function () { return controllerChangeAt; },
      getReloadExecutedAt: function () { return reloadExecutedAt; }
    };
  }

  window.InfraPwaRuntime = Object.assign(window.InfraPwaRuntime || {}, { createPwaRuntime });
})();
