// Thème, mode admin, stockage et Service Worker.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { COVERS_CACHE_NAME, LIVE_CATALOG_CACHE_NAME, PREFETCH_NEXT_CACHE_NAME, SERVICE_WORKER_UPDATE_CHECK_MIN_MS, SPA_SHELL_CACHE_NAME, STORAGE_PERSIST_REQUEST_KEY, audioState, audioTelemetryApi, legacyThemeStorageKey, pwaInstallApi, runtime, spaState, themePresets, themeStorageKey } from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import { normalizeThemeName, purgeAdminUi } from "./favorites-bridge.js";
import { getQuickActions } from "./catalog-playback.js";
import { navigateTo } from "./navigation.js";
import { getCurrentPlayableAudioSrc } from "./audio-sources.js";
import { trackAudioRuntimeEvent } from "./playback.js";

let currentTheme = "blanc";

let storageObservationStarted = false;

let adminScriptPromise = null;

let serviceWorkerRegistered = false;

let serviceWorkerControllerChangeBound = false;

let serviceWorkerRegistrationRef = null;

let serviceWorkerReportedVersion = "";

let serviceWorkerLastUpdateCheckAt = 0;

let serviceWorkerControllerChangeAt = 0;

function isAdminModeEnabled() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("edit") === "1";
  } catch (_err) {
    return false;
  }
}

function applyAdminUiVisibility(isEnabled) {
  document.body.classList.toggle("admin-mode", Boolean(isEnabled));
  const adminNodes = Array.from(document.querySelectorAll("[data-admin-only]"));
  adminNodes.forEach((node) => {
    if (!isEnabled) {
      node.remove();
      return;
    }
    node.hidden = false;
  });

  if (!isEnabled) {
    const quickMenu = document.getElementById("quickMenu");
    if (quickMenu) {
      quickMenu.classList.remove("is-open");
      quickMenu.setAttribute("aria-hidden", "true");
    }
  }
}

function applyThemePreset(themeName, shouldPersist) {
  const normalizedName = normalizeThemeName(themeName);
  const key = themePresets[normalizedName] ? normalizedName : "blanc";
  const preset = themePresets[key];
  const root = document.documentElement;
  const body = document.body;

  Object.keys(preset).forEach((cssVar) => {
    root.style.setProperty(cssVar, preset[cssVar]);
    if (body) {
      body.style.setProperty(cssVar, preset[cssVar]);
    }
  });

  // Keep root/background inline styles minimal; CSS variables drive the fixed background canvas.
  root.style.backgroundColor = preset["--bg-end"];
  root.style.removeProperty("background");

  if (body) {
    body.style.color = preset["--ink"];
    body.style.removeProperty("background");
    body.style.removeProperty("background-color");
    body.style.removeProperty("background-image");
    body.style.removeProperty("background-repeat");
    body.style.removeProperty("background-size");
    body.style.removeProperty("background-attachment");
  }

  currentTheme = key;
  root.setAttribute("data-theme", key);
  if (body) body.setAttribute("data-theme", key);
  syncPwaStatusColor();

  if (shouldPersist) {
    try {
      localStorage.setItem(themeStorageKey, key);
    } catch (_err) {
      // Ignore write errors (private mode, disabled storage, etc.).
    }
  }
}

function isDarkColor(color) {
  const raw = String(color || "").trim();
  const match = raw.match(/^#([0-9a-f]{6})$/i);
  if (!match) return false;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const luminance = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
  return luminance < 128;
}

function ensureMetaTag(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
  return meta;
}

function getPwaStatusColor(preset) {
  if (document.body && document.body.classList.contains("sphragis-screen")) return "#151515";
  if (document.body && document.body.classList.contains("album-screen")) return preset["--bg-mid"] || "#f6f6f6";
  return preset["--bg-start"] || "#ffffff";
}

function syncPwaStatusColor() {
  const preset = themePresets[currentTheme] || themePresets.blanc;
  const color = getPwaStatusColor(preset);
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty("--pwa-status-bg", color);
  root.style.backgroundColor = color;
  if (body) {
    body.style.setProperty("--pwa-status-bg", color);
  }
  ensureMetaTag("theme-color", color);
  ensureMetaTag("apple-mobile-web-app-status-bar-style", "black-translucent");
}

function getCurrentThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const content = meta ? String(meta.getAttribute("content") || "").trim() : "";
  return content || "#111111";
}

function setThemeColor(color) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(String(color || "").trim()) ? color : "#111111";
  ensureMetaTag("theme-color", safeColor);
}

function initThemePreset() {
  let saved = "blanc";
  try {
    const raw = localStorage.getItem(themeStorageKey) || localStorage.getItem(legacyThemeStorageKey);
    const normalized = normalizeThemeName(raw);
    if (normalized && themePresets[normalized]) saved = normalized;
  } catch (_err) {
    saved = "blanc";
  }
  applyThemePreset(saved, false);
}

function getAdminScriptUrl() {
  const path = `assets/js/scripts.admin.js${runtime.query}`;
  return new URL(path, runtime.baseUrl).href;
}

async function ensureAdminScriptLoaded() {
  if (window.InfraAdmin && typeof window.InfraAdmin.init === "function") {
    return window.InfraAdmin;
  }
  if (adminScriptPromise) return adminScriptPromise;

  adminScriptPromise = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = getAdminScriptUrl();
    script.async = true;
    script.dataset.infraAdmin = "1";
    script.onload = function () { resolve(window.InfraAdmin); };
    script.onerror = function () { reject(new Error("admin script failed to load")); };
    document.head.appendChild(script);
  }).catch(function (err) {
    adminScriptPromise = null;
    throw err;
  });

  return adminScriptPromise;
}

async function initAdminFeatures() {
  try {
    await ensureAdminScriptLoaded();
  } catch (_err) {
    return;
  }

  if (!window.InfraAdmin || typeof window.InfraAdmin.init !== "function") return;
  window.InfraAdmin.init({
    navigateTo,
    getQuickActions,
    applyThemePreset,
    getCurrentTheme: function () { return currentTheme; }
  });
  applyAdminUiVisibility(true);
}

function teardownAdminFeatures() {
  if (window.InfraAdmin && typeof window.InfraAdmin.teardown === "function") {
    window.InfraAdmin.teardown();
  }
  applyAdminUiVisibility(false);
  purgeAdminUi();
}

function buildServiceWorkerTransitionTelemetry(extra) {
  const audio = audioState.audio;
  const audioPlaying = Boolean(audio && !audio.paused && getCurrentPlayableAudioSrc(audio));
  const overlayOpen = Boolean(
    audioState.nowPlayingOpen ||
    audioState.nowPlayingClosing ||
    audioState.transportPipOpen ||
    audioState.transportPipOpening
  );
  return Object.assign({
    audioPlaying,
    trackStarting: Boolean(audioState.trackStartInFlight),
    overlayOpen,
    controllerchange_delta_ms: serviceWorkerControllerChangeAt
      ? Math.max(0, Math.round(getAudioTelemetryNow() - serviceWorkerControllerChangeAt))
      : null,
    visibility_state: document.visibilityState || "",
    audio_playing: audioPlaying,
    track_starting: Boolean(audioState.trackStartInFlight),
    overlay_open: overlayOpen,
    navigation_active: Boolean(spaState.navigationActive)
  }, extra || {});
}

function readStoragePersistRequestMarker() {
  try {
    return localStorage.getItem(STORAGE_PERSIST_REQUEST_KEY) === "1";
  } catch (_err) {
    return false;
  }
}

function writeStoragePersistRequestMarker() {
  try {
    localStorage.setItem(STORAGE_PERSIST_REQUEST_KEY, "1");
  } catch (_err) {
    // Persistence is still requested even if the marker cannot be written.
  }
}

function countExistingCacheEntries(cacheNames, cacheName) {
  if (!Array.isArray(cacheNames) || !cacheNames.includes(cacheName)) return Promise.resolve(0);
  if (typeof caches === "undefined" || typeof caches.open !== "function") return Promise.resolve(0);
  return caches.open(cacheName)
    .then(function (cache) { return cache.keys(); })
    .then(function (keys) { return Array.isArray(keys) ? keys.length : 0; })
    .catch(function () { return 0; });
}

function beginPwaStorageObservation() {
  if (storageObservationStarted || !isStandaloneDisplayMode()) return;
  storageObservationStarted = true;
  ["pointerdown", "touchstart", "keydown"].forEach(function (eventName) {
    window.removeEventListener(eventName, beginPwaStorageObservation, true);
  });

  const storageManager = navigator.storage || null;
  const shouldRequestPersistence = Boolean(
    storageManager &&
    typeof storageManager.persist === "function" &&
    !readStoragePersistRequestMarker()
  );
  let persistRequestCount = 0;
  let persistPromise = Promise.resolve(null);
  if (shouldRequestPersistence) {
    persistRequestCount = 1;
    writeStoragePersistRequestMarker();
    try {
      persistPromise = Promise.resolve(storageManager.persist()).catch(function () { return false; });
    } catch (_err) {
      persistPromise = Promise.resolve(false);
    }
  } else if (storageManager && typeof storageManager.persisted === "function") {
    try {
      persistPromise = Promise.resolve(storageManager.persisted()).catch(function () { return null; });
    } catch (_err) {
      persistPromise = Promise.resolve(null);
    }
  }

  const estimatePromise = storageManager && typeof storageManager.estimate === "function"
    ? Promise.resolve(storageManager.estimate()).catch(function () { return {}; })
    : Promise.resolve({});
  const cacheNamesPromise = typeof caches !== "undefined" && typeof caches.keys === "function"
    ? caches.keys().catch(function () { return []; })
    : Promise.resolve([]);

  Promise.all([persistPromise, estimatePromise, cacheNamesPromise]).then(function (results) {
    const persisted = results[0];
    const estimate = results[1] && typeof results[1] === "object" ? results[1] : {};
    const cacheNames = Array.isArray(results[2]) ? results[2] : [];
    return Promise.all([
      countExistingCacheEntries(cacheNames, COVERS_CACHE_NAME),
      countExistingCacheEntries(cacheNames, PREFETCH_NEXT_CACHE_NAME),
      countExistingCacheEntries(cacheNames, LIVE_CATALOG_CACHE_NAME)
    ]).then(function (entryCounts) {
      const bytesPerMiB = 1024 * 1024;
      audioTelemetryApi.recordStorageSnapshot({
        storage_persisted_state: persisted === true ? 2 : (persisted === false ? 1 : 0),
        storage_persist_request_count: persistRequestCount,
        storage_persist_granted_count: persistRequestCount && persisted === true ? 1 : 0,
        storage_usage_mb: Math.max(0, Math.round((Number(estimate.usage) || 0) / bytesPerMiB)),
        storage_quota_mb: Math.max(0, Math.round((Number(estimate.quota) || 0) / bytesPerMiB)),
        storage_shell_present: cacheNames.includes(SPA_SHELL_CACHE_NAME) ? 1 : 0,
        storage_sw_controlled: navigator.serviceWorker && navigator.serviceWorker.controller ? 1 : 0,
        storage_cover_entries: entryCounts[0] || 0,
        storage_audio_entries: entryCounts[1] || 0,
        storage_catalog_entries: entryCounts[2] || 0
      });
    });
  }).catch(function () {
    // Storage telemetry is a best-effort session summary only.
  });
}

function requestServiceWorkerUpdateCheck(reason) {
  if (!serviceWorkerRegistrationRef || typeof serviceWorkerRegistrationRef.update !== "function") return;
  const now = getAudioTelemetryNow();
  if (reason !== "registered" && serviceWorkerLastUpdateCheckAt && now - serviceWorkerLastUpdateCheckAt < SERVICE_WORKER_UPDATE_CHECK_MIN_MS) {
    return;
  }
  serviceWorkerLastUpdateCheckAt = now;
  serviceWorkerRegistrationRef.update().catch(function () {
    // Ignore update probe failures; the app keeps using the active shell.
  });
}

// Mise à jour iPhone (INFRA, 08/11/2026) : iOS met la PWA en veille sans jamais fermer sa fenêtre,
// si bien qu'une nouvelle version attendait sans fin. Quand l'app est visible et que rien ne joue,
// la version en attente est activée puis la page rechargée une fois. Jamais pendant la lecture.
let serviceWorkerIdleUpdateRequested = false;

function isBusyForServiceWorkerUpdate() {
  if (document.visibilityState !== "visible") return true;
  const audio = audioState.audio;
  if (audio && !audio.paused && !audio.ended) return true;
  if (Number.isFinite(audioState.pendingStartTime) && audioState.pendingStartTime !== null) return true;
  const root = document.documentElement;
  if (root.classList.contains("now-playing-open") || root.classList.contains("pwa-swap-active")) return true;
  return false;
}

function applyWaitingServiceWorkerWhenIdle() {
  const registration = serviceWorkerRegistrationRef;
  if (!registration || !registration.waiting || serviceWorkerIdleUpdateRequested) return;
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  if (isBusyForServiceWorkerUpdate()) return;
  serviceWorkerIdleUpdateRequested = true;
  try {
    registration.waiting.postMessage({ type: "INFRA_SW_ACTIVATE_IDLE" });
  } catch (_err) {
    serviceWorkerIdleUpdateRequested = false;
  }
}

function watchServiceWorkerInstall(registration) {
  if (!registration || typeof registration.addEventListener !== "function") return;
  registration.addEventListener("updatefound", function () {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", function () {
      if (worker.state === "installed") window.setTimeout(applyWaitingServiceWorkerWhenIdle, 600);
    });
  });
}

function rememberServiceWorkerReportedVersion(version) {
  serviceWorkerReportedVersion = String(version || "").slice(0, 80);
}

function requestActiveServiceWorkerVersion() {
  const controller = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!controller || typeof controller.postMessage !== "function") return;
  try {
    controller.postMessage({ type: "INFRA_SW_VERSION_REQUEST" });
  } catch (_err) {
    // A controller swap can invalidate the old endpoint between reads.
  }
}

function registerServiceWorker() {
  if (serviceWorkerRegistered) return;
  serviceWorkerRegistered = true;

  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

  if (!serviceWorkerControllerChangeBound) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      serviceWorkerControllerChangeAt = getAudioTelemetryNow();
      serviceWorkerReportedVersion = "";
      window.setTimeout(requestActiveServiceWorkerVersion, 0);
      trackAudioRuntimeEvent("sw_controllerchange", buildServiceWorkerTransitionTelemetry({
        strategy: "natural_lifecycle"
      }));
    });
    serviceWorkerControllerChangeBound = true;
  }

  const swUrl = new URL(`sw.js${runtime.query}`, runtime.baseUrl).href;
  navigator.serviceWorker
    .register(swUrl, { scope: runtime.baseUrl.pathname, updateViaCache: "none" })
    .then(function (registration) {
      serviceWorkerRegistrationRef = registration;
      watchServiceWorkerInstall(registration);
      window.setTimeout(applyWaitingServiceWorkerWhenIdle, 1200);
      requestActiveServiceWorkerVersion();
      requestServiceWorkerUpdateCheck("registered");
    })
    .catch(function () {
      // Ignore SW registration failures.
    });
}

function isIosDevice() {
  const ua = String(navigator.userAgent || "");
  if (/iPhone|iPad|iPod/i.test(ua)) return true;

  const platform = String(navigator.platform || "");
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function isAndroidDevice() {
  const ua = String(navigator.userAgent || "");
  return /Android/i.test(ua);
}

function isStandaloneDisplayMode() {
  const mediaStandalone = typeof window.matchMedia === "function"
    ? window.matchMedia("(display-mode: standalone)").matches
    : false;
  const legacyStandalone = typeof navigator.standalone === "boolean" ? navigator.standalone : false;
  return Boolean(mediaStandalone || legacyStandalone);
}

function isMobilePwaCoverNavigation() {
  if (!isStandaloneDisplayMode()) return false;
  const mobileDevice = isIosDevice() || isAndroidDevice();
  const mobileViewport = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 980px)").matches
    : window.innerWidth <= 980;
  return Boolean(mobileDevice || mobileViewport);
}

function getIosBrowserKind() {
  return pwaInstallApi.getIosBrowserKind();
}

function getAndroidBrowserKind() {
  return pwaInstallApi.getAndroidBrowserKind();
}

function getInstallBrowserKind() {
  return pwaInstallApi.getInstallBrowserKind();
}

function isSafariOnIos() {
  return pwaInstallApi.isSafariOnIos();
}

function getPwaGuideContent(browserKind) {
  return pwaInstallApi.getPwaGuideContent(browserKind);
}

function fillPwaGuide(guideText, guideSteps, browserKind) {
  return pwaInstallApi.fillPwaGuide(guideText, guideSteps, browserKind);
}

function readPwaChoice() {
  return pwaInstallApi.readPwaChoice();
}

function persistPwaChoice(choice) {
  return pwaInstallApi.persistPwaChoice(choice);
}

function ensurePwaInstallPromptUi() {
  return pwaInstallApi.ensurePwaInstallPromptUi();
}

function initPwaInstallPrompt(adminMode) {
  return pwaInstallApi.initPwaInstallPrompt(adminMode);
}

export { currentTheme, storageObservationStarted, adminScriptPromise, serviceWorkerRegistered, serviceWorkerControllerChangeBound, serviceWorkerRegistrationRef, serviceWorkerReportedVersion, serviceWorkerLastUpdateCheckAt, serviceWorkerControllerChangeAt, isAdminModeEnabled, applyAdminUiVisibility, applyThemePreset, isDarkColor, ensureMetaTag, getPwaStatusColor, syncPwaStatusColor, getCurrentThemeColor, setThemeColor, initThemePreset, getAdminScriptUrl, ensureAdminScriptLoaded, initAdminFeatures, teardownAdminFeatures, buildServiceWorkerTransitionTelemetry, readStoragePersistRequestMarker, writeStoragePersistRequestMarker, countExistingCacheEntries, beginPwaStorageObservation, requestServiceWorkerUpdateCheck, serviceWorkerIdleUpdateRequested, isBusyForServiceWorkerUpdate, applyWaitingServiceWorkerWhenIdle, watchServiceWorkerInstall, rememberServiceWorkerReportedVersion, requestActiveServiceWorkerVersion, registerServiceWorker, isIosDevice, isAndroidDevice, isStandaloneDisplayMode, isMobilePwaCoverNavigation, getIosBrowserKind, getAndroidBrowserKind, getInstallBrowserKind, isSafariOnIos, getPwaGuideContent, fillPwaGuide, readPwaChoice, persistPwaChoice, ensurePwaInstallPromptUi, initPwaInstallPrompt };
