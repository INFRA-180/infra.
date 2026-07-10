(function () {
  "use strict";

  const METRIC_SAMPLE_RATE = 0.25;
  const BACKGROUND_BUDGETS = {
    full: { spaHome: 12, spaPage: 4, covers: 2, audio: 1 },
    constrained: { spaHome: 4, spaPage: 1, covers: 1, audio: 0 },
    "save-data": { spaHome: 0, spaPage: 0, covers: 0, audio: 0 }
  };

  function createPerformancePolicy(options) {
    const opts = options || {};
    const queue = [];
    let longTaskObserver = null;

    function isStandalone() {
      const mediaStandalone = typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)").matches
        : false;
      return Boolean(mediaStandalone || navigator.standalone === true);
    }

    function isMobile() {
      return typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 980px)").matches
        : window.innerWidth <= 980;
    }

    function getConnection() {
      return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    }

    function getMode() {
      const connection = getConnection();
      if (connection && connection.saveData) return "save-data";
      const effectiveType = String(connection && connection.effectiveType || "").toLowerCase();
      const downlink = Number(connection && connection.downlink);
      if (effectiveType === "slow-2g" || effectiveType === "2g" || (Number.isFinite(downlink) && downlink > 0 && downlink < 1.5)) {
        return "constrained";
      }
      return isStandalone() || isMobile() ? "constrained" : "full";
    }

    function getContext() {
      const connection = getConnection();
      return {
        performance_mode: getMode(),
        pwa_standalone: isStandalone(),
        mobile_viewport: isMobile(),
        connection_type: String(connection && connection.effectiveType || ""),
        save_data: Boolean(connection && connection.saveData),
        page_kind: document.body && document.body.classList.contains("home-screen")
          ? "home"
          : (document.body && document.body.classList.contains("album-screen") ? "album" : "app"),
        runtime_version: String(document.documentElement.dataset.build || "")
      };
    }

    function shouldSample() {
      return Math.random() < METRIC_SAMPLE_RATE;
    }

    function emit(type, data, options) {
      const eventType = String(type || "").trim();
      if (!eventType) return false;
      const eventOptions = options || {};
      if (eventOptions.sampled !== false && !shouldSample()) return false;
      const detail = {
        type: eventType,
        data: Object.assign(getContext(), data || {})
      };
      queue.push(detail);
      try {
        document.dispatchEvent(new CustomEvent("infra:performance", { detail }));
      } catch (_err) {
        // The queue is consumed by telemetry when CustomEvent is unavailable.
      }
      return true;
    }

    function consumeEvents() {
      return queue.splice(0, queue.length);
    }

    function getBudget(kind, pageKind) {
      const budget = BACKGROUND_BUDGETS[getMode()];
      if (kind === "spa") return pageKind === "home" ? budget.spaHome : budget.spaPage;
      return Number(budget[kind]) || 0;
    }

    function decide(kind, options) {
      const decisionOptions = options || {};
      const explicit = Boolean(decisionOptions.explicit);
      const mode = getMode();
      const budget = getBudget(kind, decisionOptions.pageKind);
      const allowed = explicit || (budget > 0 && !decisionOptions.playbackFragile && !decisionOptions.appPage);
      emit("perf_prefetch_decision", {
        prefetch_kind: String(kind || ""),
        allowed,
        explicit,
        budget,
        blocked_reason: allowed ? "" : (mode === "save-data" ? "save_data" : (decisionOptions.playbackFragile ? "playback_fragile" : "budget"))
      });
      return { allowed, budget, mode };
    }

    function markNavigationStart(data) {
      return emit("perf_spa_navigation_start", data, { sampled: true });
    }

    function markNavigationDone(data) {
      return emit("perf_spa_navigation_done", data, { sampled: true });
    }

    function init() {
      const navigation = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      emit("perf_boot", {
        navigation_type: navigation && navigation.type ? navigation.type : "",
        response_end_ms: navigation && Number.isFinite(navigation.responseEnd) ? Math.round(navigation.responseEnd) : null
      }, { sampled: true });
      document.addEventListener("DOMContentLoaded", function () {
        const entry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
        emit("perf_interactive", {
          dom_content_loaded_ms: entry && Number.isFinite(entry.domContentLoadedEventEnd)
            ? Math.round(entry.domContentLoadedEventEnd)
            : null
        }, { sampled: true });
      }, { once: true });
      if (typeof PerformanceObserver !== "function") return;
      try {
        longTaskObserver = new PerformanceObserver(function (entries) {
          entries.getEntries().forEach(function (entry) {
            emit("perf_long_task", { duration_ms: Math.round(entry.duration || 0) }, { sampled: true });
          });
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch (_err) {
        longTaskObserver = null;
      }
    }

    return Object.freeze({
      getMode,
      getContext,
      getBudget,
      decide,
      emit,
      consumeEvents,
      markNavigationStart,
      markNavigationDone,
      init
    });
  }

  const policy = createPerformancePolicy();
  policy.init();
  window.InfraPerformancePolicy = Object.freeze({
    createPerformancePolicy,
    getPolicy: function () { return policy; }
  });
})();
