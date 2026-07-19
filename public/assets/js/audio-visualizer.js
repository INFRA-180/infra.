(function () {
  "use strict";

  const DATA_FILE = "data/audio-visuals.json";
  const DESKTOP_QUERY = "(min-width: 981px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const FRAME_INTERVAL_MS = 1000 / 30;
  const MAX_DEVICE_PIXEL_RATIO = 1.5;
  const moduleScript = document.currentScript;
  const moduleUrl = moduleScript && moduleScript.src
    ? new URL(moduleScript.src, window.location.href)
    : new URL("assets/js/audio-visualizer.js", window.location.href);
  const siteRootUrl = new URL("../../", moduleUrl);
  const dataUrl = new URL(`${DATA_FILE}${moduleUrl.search || ""}`, siteRootUrl);
  let envelopeDataPromise = null;

  function getMediaQuery(query) {
    return typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
  }

  function isDesktopViewport() {
    const query = getMediaQuery(DESKTOP_QUERY);
    return !query || query.matches;
  }

  function prefersReducedMotion() {
    const query = getMediaQuery(REDUCED_MOTION_QUERY);
    return Boolean(query && query.matches);
  }

  function getVisualKey(srcLike) {
    const raw = String(srcLike || "").trim();
    if (!raw) return "";
    let pathname = raw;
    try {
      pathname = new URL(raw, window.location.href).pathname;
    } catch (_err) {
      pathname = raw.split(/[?#]/, 1)[0];
    }
    try {
      pathname = decodeURIComponent(pathname);
    } catch (_err) {
      // Keep an encoded path when malformed escape sequences are present.
    }
    const parts = pathname.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.slice(-2).join("/").normalize("NFC");
  }

  function decodeEnvelope(encoded) {
    if (!encoded) return null;
    try {
      const binary = window.atob(encoded);
      const values = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        values[index] = binary.charCodeAt(index);
      }
      return values;
    } catch (_err) {
      return null;
    }
  }

  function loadEnvelopeData() {
    if (envelopeDataPromise) return envelopeDataPromise;
    envelopeDataPromise = fetch(dataUrl.href, {
      cache: "force-cache",
      credentials: "same-origin"
    }).then(function (response) {
      if (!response.ok) throw new Error(`audio visuals ${response.status}`);
      return response.json();
    }).then(function (payload) {
      return payload && payload.tracks ? payload.tracks : {};
    }).catch(function () {
      return {};
    });
    return envelopeDataPromise;
  }

  function sampleEnvelope(values, position) {
    if (!values || !values.length) return 0.36;
    const clamped = Math.max(0, Math.min(1, position));
    const scaled = clamped * (values.length - 1);
    const left = Math.floor(scaled);
    const right = Math.min(values.length - 1, left + 1);
    const mix = scaled - left;
    return ((values[left] * (1 - mix)) + (values[right] * mix)) / 255;
  }

  function createVisualizer(options) {
    const config = options || {};
    const audio = config.audio || null;
    const canvas = config.canvas || null;
    const root = config.root || null;
    if (!audio || !canvas || !root) return null;
    if (canvas.__infraAudioVisualizer) return canvas.__infraAudioVisualizer;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;

    let active = false;
    let envelope = null;
    let envelopeKey = "";
    let requestedKey = "";
    let animationFrame = 0;
    let lastFrameAt = 0;
    let resizeObserver = null;

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.max(1, Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return {
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height)
      };
    }

    function syncEnvelope() {
      const key = getVisualKey(audio.currentSrc || audio.src || "");
      if (!key) {
        requestedKey = "";
        envelopeKey = "";
        envelope = null;
        root.classList.remove("is-ready");
        return Promise.resolve();
      }
      if (key === envelopeKey && envelope) return Promise.resolve();
      if (key === requestedKey) return loadEnvelopeData().then(function () {});

      requestedKey = key;
      root.classList.remove("is-ready");
      return loadEnvelopeData().then(function (tracks) {
        if (requestedKey !== key) return;
        const decoded = decodeEnvelope(tracks[key]);
        envelopeKey = decoded ? key : "";
        envelope = decoded;
        root.classList.toggle("is-ready", Boolean(decoded));
      });
    }

    function draw(timestamp) {
      const size = resizeCanvas();
      context.clearRect(0, 0, size.width, size.height);
      if (!active || !isDesktopViewport() || !envelope) return;

      const duration = Number(audio.duration);
      const currentTime = Number(audio.currentTime);
      const progress = Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime)
        ? Math.max(0, Math.min(1, currentTime / duration))
        : 0;
      const reduced = prefersReducedMotion();
      const phase = reduced ? progress * 2 : (Number(timestamp) || performance.now()) / 1000;
      const centerY = size.height * 0.5;
      const currentEnergy = sampleEnvelope(envelope, progress);
      const pointCount = Math.max(52, Math.min(112, Math.round(size.width / 7)));
      const layers = [
        { color: "rgba(255,255,255,0.09)", width: 1.1, speed: 0.34, frequency: 1.25, offset: 0.2, scale: 0.52 },
        { color: "rgba(255,255,255,0.16)", width: 1.35, speed: -0.26, frequency: 1.72, offset: 2.1, scale: 0.72 },
        { color: "rgba(242,38,45,0.17)", width: 1.2, speed: 0.2, frequency: 2.16, offset: 4.4, scale: 0.6 }
      ];

      context.lineCap = "round";
      context.lineJoin = "round";
      for (const layer of layers) {
        context.beginPath();
        context.strokeStyle = layer.color;
        context.lineWidth = layer.width;
        for (let index = 0; index < pointCount; index += 1) {
          const ratio = index / (pointCount - 1);
          const nearbyProgress = progress + ((ratio - 0.5) * 0.18);
          const energy = sampleEnvelope(envelope, nearbyProgress);
          const envelopeStrength = 0.18 + (energy * 0.82);
          const amplitude = size.height * (0.045 + (currentEnergy * 0.055)) * layer.scale;
          const primary = Math.sin(
            (ratio * Math.PI * 2 * layer.frequency) +
            (phase * layer.speed) +
            layer.offset
          );
          const detail = Math.sin(
            (ratio * Math.PI * 2 * (layer.frequency * 2.35)) -
            (phase * layer.speed * 0.72) +
            (layer.offset * 0.5)
          ) * 0.24;
          const edgeFade = Math.sin(Math.PI * ratio);
          const x = ratio * size.width;
          const y = centerY + ((primary + detail) * amplitude * envelopeStrength * edgeFade);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
    }

    function stopAnimation() {
      if (!animationFrame) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function frame(timestamp) {
      animationFrame = 0;
      if (!active || audio.paused || audio.ended || document.hidden || prefersReducedMotion()) {
        draw(timestamp);
        return;
      }
      if (!lastFrameAt || timestamp - lastFrameAt >= FRAME_INTERVAL_MS) {
        lastFrameAt = timestamp;
        draw(timestamp);
      }
      animationFrame = requestAnimationFrame(frame);
    }

    function startAnimation() {
      if (animationFrame || !active || audio.paused || audio.ended || document.hidden || prefersReducedMotion()) {
        draw(performance.now());
        return;
      }
      animationFrame = requestAnimationFrame(frame);
    }

    function refresh() {
      stopAnimation();
      if (!active || !isDesktopViewport()) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        root.classList.remove("is-active");
        return;
      }
      root.classList.add("is-active");
      syncEnvelope().then(function () {
        if (!active) return;
        draw(performance.now());
        startAnimation();
      });
    }

    function sync(nextState) {
      active = Boolean(nextState && nextState.active && isDesktopViewport());
      refresh();
    }

    ["play", "playing", "pause", "ended", "loadstart", "durationchange", "seeked"].forEach(function (eventName) {
      audio.addEventListener(eventName, refresh, { passive: true });
    });
    document.addEventListener("visibilitychange", refresh, { passive: true });

    const desktopQuery = getMediaQuery(DESKTOP_QUERY);
    const motionQuery = getMediaQuery(REDUCED_MOTION_QUERY);
    if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", refresh);
    }
    if (motionQuery && typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", refresh);
    }
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(function () {
        if (active) draw(performance.now());
      });
      resizeObserver.observe(root);
    } else {
      window.addEventListener("resize", refresh, { passive: true });
    }

    const controller = {
      sync,
      refresh,
      stop: function () {
        active = false;
        stopAnimation();
        refresh();
      }
    };
    canvas.__infraAudioVisualizer = controller;
    return controller;
  }

  window.InfraAudioVisualizer = Object.assign(window.InfraAudioVisualizer || {}, {
    create: createVisualizer,
    getVisualKey
  });
})();
