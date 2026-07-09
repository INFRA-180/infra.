(function () {
  "use strict";

  const legacyThemeMap = { marine: "blanc", rouge: "rouge-fluo", graphite: "bleu-fluo", violet: "vert-fluo", "orange-fluo": "orange-fluo" };
  const themePresets = {
    blanc: { "--accent": "#1a1a1a", "--ink": "#111111", "--ink-soft": "rgba(17, 17, 17, 0.66)", "--line": "rgba(17, 17, 17, 0.2)", "--bg-glow-1": "rgba(255, 255, 255, 0.9)", "--bg-glow-2": "rgba(255, 255, 255, 0.72)", "--bg-start": "#ffffff", "--bg-mid": "#f6f6f6", "--bg-end": "#ebebeb", "--overlay-bg": "rgba(10, 10, 10, 0.38)", "--panel-bg": "rgba(255, 255, 255, 0.96)", "--panel-border": "rgba(17, 17, 17, 0.22)", "--code-bg": "rgba(17, 17, 17, 0.08)", "--pill-bg": "#111111", "--pill-ink": "#ffffff" },
    "rouge-fluo": { "--accent": "#320b09", "--ink": "#1a0705", "--ink-soft": "rgba(26, 7, 5, 0.72)", "--line": "rgba(26, 7, 5, 0.22)", "--bg-glow-1": "rgba(247, 16, 10, 0.34)", "--bg-glow-2": "rgba(255, 112, 100, 0.26)", "--bg-start": "#fff3f2", "--bg-mid": "#ff6a63", "--bg-end": "#f7100a", "--overlay-bg": "rgba(26, 7, 5, 0.38)", "--panel-bg": "rgba(255, 243, 241, 0.94)", "--panel-border": "rgba(26, 7, 5, 0.24)", "--code-bg": "rgba(26, 7, 5, 0.09)", "--pill-bg": "#1a0705", "--pill-ink": "#ffffff" },
    "bleu-fluo": { "--accent": "#e8edff", "--ink": "#f7f9ff", "--ink-soft": "rgba(247, 249, 255, 0.78)", "--line": "rgba(233, 240, 255, 0.28)", "--bg-glow-1": "rgba(40, 64, 230, 0.3)", "--bg-glow-2": "rgba(0, 0, 152, 0.34)", "--bg-start": "#0f1798", "--bg-mid": "#0000b4", "--bg-end": "#000098", "--overlay-bg": "rgba(5, 7, 40, 0.44)", "--panel-bg": "rgba(11, 16, 108, 0.94)", "--panel-border": "rgba(233, 240, 255, 0.26)", "--code-bg": "rgba(233, 240, 255, 0.12)", "--pill-bg": "#f1f5ff", "--pill-ink": "#ffffff" },
    "vert-fluo": { "--accent": "#0b3a14", "--ink": "#082408", "--ink-soft": "rgba(8, 36, 8, 0.72)", "--line": "rgba(8, 36, 8, 0.22)", "--bg-glow-1": "rgba(1, 247, 0, 0.32)", "--bg-glow-2": "rgba(134, 255, 134, 0.28)", "--bg-start": "#efffeb", "--bg-mid": "#83ff82", "--bg-end": "#01f700", "--overlay-bg": "rgba(8, 36, 8, 0.38)", "--panel-bg": "rgba(241, 255, 241, 0.95)", "--panel-border": "rgba(8, 36, 8, 0.24)", "--code-bg": "rgba(8, 36, 8, 0.09)", "--pill-bg": "#082408", "--pill-ink": "#ffffff" },
    "orange-fluo": { "--accent": "#3a1700", "--ink": "#2a1100", "--ink-soft": "rgba(42, 17, 0, 0.72)", "--line": "rgba(42, 17, 0, 0.22)", "--bg-glow-1": "rgba(255, 106, 0, 0.34)", "--bg-glow-2": "rgba(255, 176, 110, 0.3)", "--bg-start": "#fff3ea", "--bg-mid": "#ffb06b", "--bg-end": "#ff6a00", "--overlay-bg": "rgba(42, 17, 0, 0.38)", "--panel-bg": "rgba(255, 244, 234, 0.95)", "--panel-border": "rgba(42, 17, 0, 0.24)", "--code-bg": "rgba(42, 17, 0, 0.09)", "--pill-bg": "#2a1100", "--pill-ink": "#ffffff" },
    "jaune-fluo": { "--accent": "#2f2900", "--ink": "#2a2400", "--ink-soft": "rgba(42, 36, 0, 0.72)", "--line": "rgba(42, 36, 0, 0.24)", "--bg-glow-1": "rgba(255, 232, 6, 0.3)", "--bg-glow-2": "rgba(255, 242, 84, 0.28)", "--bg-start": "#fffde8", "--bg-mid": "#fff250", "--bg-end": "#ffe806", "--overlay-bg": "rgba(33, 30, 0, 0.4)", "--panel-bg": "rgba(255, 253, 224, 0.95)", "--panel-border": "rgba(42, 36, 0, 0.24)", "--code-bg": "rgba(42, 36, 0, 0.1)", "--pill-bg": "#2a2400", "--pill-ink": "#ffffff" }
  };

  function createSiteRuntime(context) {
    const ctx = context || {};
    const runtime = ctx.runtime || { baseUrl: new URL("./", window.location.href), query: "" };
    const navigateTo = typeof ctx.navigateTo === "function" ? ctx.navigateTo : function () {};
    const getQuickActions = typeof ctx.getQuickActions === "function" ? ctx.getQuickActions : function () { return []; };
    let currentTheme = "blanc";
    let adminScriptPromise = null;

    function normalizePwaHeadAssetLinks() {
      document.querySelectorAll("link[href]").forEach(function (link) {
        const raw = String(link.getAttribute("href") || "").trim();
        if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return;
        let path = raw;
        while (path.startsWith("./")) path = path.slice(2);
        while (path.startsWith("../")) path = path.slice(3);
        while (path.startsWith("/")) path = path.slice(1);
        if (!path.startsWith("assets/pwa/") && !path.startsWith("manifest.webmanifest")) return;
        try { link.setAttribute("href", new URL(path, runtime.baseUrl).href); } catch (_err) {}
      });
    }

    function isAdminModeEnabled() {
      try { return new URLSearchParams(window.location.search || "").get("edit") === "1"; } catch (_err) { return false; }
    }

    function purgeAdminUi() {
      const mount = document.getElementById("adminMount");
      if (mount) mount.replaceChildren();
      Array.from(document.querySelectorAll("[data-admin-only]")).forEach(function (node) { node.remove(); });
      [document.getElementById("adminHeaderTemplate"), document.getElementById("adminQuickMenuTemplate")].filter(Boolean).forEach(function (node) { node.remove(); });
    }

    function applyAdminUiVisibility(enabled) {
      document.body.classList.toggle("admin-mode", Boolean(enabled));
      Array.from(document.querySelectorAll("[data-admin-only]")).forEach(function (node) {
        if (!enabled) node.remove(); else node.hidden = false;
      });
      if (!enabled) {
        const menu = document.getElementById("quickMenu");
        if (menu) { menu.classList.remove("is-open"); menu.setAttribute("aria-hidden", "true"); }
      }
    }

    function normalizeThemeName(value) {
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return "blanc";
      return themePresets[raw] ? raw : (legacyThemeMap[raw] || raw);
    }

    function ensureMetaTag(name, content) {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", name); document.head.appendChild(meta); }
      meta.setAttribute("content", content);
      return meta;
    }

    function getPwaStatusColor(preset) {
      if (document.body && document.body.classList.contains("sphragis-screen")) return "#151515";
      if (document.body && document.body.classList.contains("album-screen")) return preset["--bg-mid"] || "#f6f6f6";
      return preset["--bg-start"] || "#ffffff";
    }

    function syncPwaStatusColor() {
      const color = getPwaStatusColor(themePresets[currentTheme] || themePresets.blanc);
      document.documentElement.style.setProperty("--pwa-status-bg", color);
      document.documentElement.style.backgroundColor = color;
      if (document.body) document.body.style.setProperty("--pwa-status-bg", color);
      ensureMetaTag("theme-color", color);
      ensureMetaTag("apple-mobile-web-app-status-bar-style", "black-translucent");
    }

    function applyThemePreset(themeName, persist) {
      const key = themePresets[normalizeThemeName(themeName)] ? normalizeThemeName(themeName) : "blanc";
      const preset = themePresets[key];
      const root = document.documentElement;
      const body = document.body;
      Object.keys(preset).forEach(function (cssVar) { root.style.setProperty(cssVar, preset[cssVar]); if (body) body.style.setProperty(cssVar, preset[cssVar]); });
      root.style.backgroundColor = preset["--bg-end"];
      root.style.removeProperty("background");
      if (body) {
        body.style.color = preset["--ink"];
        ["background", "background-color", "background-image", "background-repeat", "background-size", "background-attachment"].forEach(function (name) { body.style.removeProperty(name); });
      }
      currentTheme = key;
      root.setAttribute("data-theme", key);
      if (body) body.setAttribute("data-theme", key);
      syncPwaStatusColor();
      if (persist) { try { localStorage.setItem("infra_theme_preset_v2", key); } catch (_err) {} }
    }

    function getCurrentThemeColor() {
      const meta = document.querySelector('meta[name="theme-color"]');
      return String((meta && meta.getAttribute("content")) || "").trim() || "#111111";
    }

    function setThemeColor(color) {
      ensureMetaTag("theme-color", /^#[0-9a-f]{6}$/i.test(String(color || "").trim()) ? color : "#111111");
    }

    function initThemePreset() {
      let saved = "blanc";
      try {
        const raw = localStorage.getItem("infra_theme_preset_v2") || localStorage.getItem("infra_theme_preset_v1");
        const normalized = normalizeThemeName(raw);
        if (themePresets[normalized]) saved = normalized;
      } catch (_err) {}
      applyThemePreset(saved, false);
    }

    function getAdminScriptUrl() { return new URL(`assets/js/scripts.admin.js${runtime.query}`, runtime.baseUrl).href; }
    function ensureAdminScriptLoaded() {
      if (window.InfraAdmin && typeof window.InfraAdmin.init === "function") return Promise.resolve(window.InfraAdmin);
      if (adminScriptPromise) return adminScriptPromise;
      adminScriptPromise = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = getAdminScriptUrl(); script.async = true; script.dataset.infraAdmin = "1";
        script.onload = function () { resolve(window.InfraAdmin); };
        script.onerror = function () { reject(new Error("admin script failed to load")); };
        document.head.appendChild(script);
      }).catch(function (err) { adminScriptPromise = null; throw err; });
      return adminScriptPromise;
    }

    async function initAdminFeatures() {
      try { await ensureAdminScriptLoaded(); } catch (_err) { return; }
      if (!window.InfraAdmin || typeof window.InfraAdmin.init !== "function") return;
      window.InfraAdmin.init({ navigateTo, getQuickActions, applyThemePreset, getCurrentTheme: function () { return currentTheme; } });
      applyAdminUiVisibility(true);
    }

    function teardownAdminFeatures() {
      if (window.InfraAdmin && typeof window.InfraAdmin.teardown === "function") window.InfraAdmin.teardown();
      applyAdminUiVisibility(false);
      purgeAdminUi();
    }

    return { normalizePwaHeadAssetLinks, isAdminModeEnabled, applyThemePreset, initThemePreset, getPwaStatusColor, syncPwaStatusColor, getCurrentThemeColor, setThemeColor, getThemePreset: function () { return themePresets[currentTheme] || themePresets.blanc; }, getCurrentTheme: function () { return currentTheme; }, initAdminFeatures, teardownAdminFeatures };
  }

  window.InfraSiteRuntime = Object.assign(window.InfraSiteRuntime || {}, { createSiteRuntime });
})();
