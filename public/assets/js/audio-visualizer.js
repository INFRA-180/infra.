(function () {
  "use strict";

  const DATA_FILE = "data/audio-visuals.json";
  const DESKTOP_QUERY = "(min-width: 981px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const FRAME_INTERVAL_MS = 1000 / 30;
  const ENERGY_ATTACK_SECONDS = 0.055;
  const ENERGY_RELEASE_SECONDS = 0.38;
  const BEAT_RELEASE_SECONDS = 0.18;
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
    let lastEnergyAt = 0;
    let lastMotionAt = 0;
    let reactiveEnergy = 0.36;
    let previousRawEnergy = 0.36;
    let beatPulse = 0;
    let motionPhase = 0;
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
        reactiveEnergy = decoded ? sampleEnvelope(decoded, 0) : 0.36;
        previousRawEnergy = reactiveEnergy;
        beatPulse = 0;
        lastEnergyAt = 0;
        lastMotionAt = 0;
        motionPhase = 0;
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
      const centerY = size.height * 0.5;
      const rawEnergy = sampleEnvelope(envelope, progress);
      const energyTimestamp = Number(timestamp) || performance.now();
      if (reduced || !lastEnergyAt) {
        reactiveEnergy = rawEnergy;
        beatPulse = 0;
      } else {
        const elapsed = Math.max(0, Math.min(0.25, (energyTimestamp - lastEnergyAt) / 1000));
        const response = rawEnergy > reactiveEnergy
          ? ENERGY_ATTACK_SECONDS
          : ENERGY_RELEASE_SECONDS;
        const smoothing = 1 - Math.exp(-elapsed / response);
        reactiveEnergy += (rawEnergy - reactiveEnergy) * smoothing;
        const positiveRise = Math.max(0, rawEnergy - previousRawEnergy);
        beatPulse = Math.max(
          beatPulse * Math.exp(-elapsed / BEAT_RELEASE_SECONDS),
          Math.min(1, positiveRise * 4.2)
        );
      }
      previousRawEnergy = rawEnergy;
      lastEnergyAt = energyTimestamp;

      if (reduced) {
        motionPhase = progress * 2;
      } else {
        const motionElapsed = lastMotionAt
          ? Math.max(0, Math.min(0.25, (energyTimestamp - lastMotionAt) / 1000))
          : 0;
        motionPhase += motionElapsed * (0.55 + (reactiveEnergy * 0.65) + (beatPulse * 0.9));
      }
      lastMotionAt = energyTimestamp;

      const rhythmicEnergy = Math.max(0, Math.min(1, reactiveEnergy + (beatPulse * 0.28)));
      const pointCount = Math.max(52, Math.min(112, Math.round(size.width / 7)));
      const layers = [
        { color: "rgba(255,255,255,0.09)", width: 1.1, speed: 0.66, frequency: 1.22, offset: 0.2, scale: 0.52 },
        { color: "rgba(255,255,255,0.15)", width: 1.3, speed: -0.52, frequency: 1.66, offset: 2.1, scale: 0.72 },
        { color: "rgba(242,38,45,0.16)", width: 1.15, speed: 0.43, frequency: 2.08, offset: 4.4, scale: 0.6 }
      ];

      context.lineCap = "round";
      context.lineJoin = "round";
      for (const layer of layers) {
        context.beginPath();
        context.strokeStyle = layer.color;
        context.lineWidth = layer.width;
        for (let index = 0; index < pointCount; index += 1) {
          const ratio = index / (pointCount - 1);
          const nearbyProgress = progress + ((ratio - 0.5) * 0.045);
          const energy = sampleEnvelope(envelope, nearbyProgress);
          const envelopeStrength = 0.2 + (energy * 0.6) + (rhythmicEnergy * 0.2);
          const amplitude = size.height * (0.032 + (rhythmicEnergy * 0.065)) * layer.scale;
          const primary = Math.sin(
            (ratio * Math.PI * 2 * layer.frequency) +
            (motionPhase * layer.speed) +
            layer.offset
          );
          const detail = Math.sin(
            (ratio * Math.PI * 2 * (layer.frequency * 2.35)) -
            (motionPhase * layer.speed * 0.72) +
            (layer.offset * 0.5)
          ) * 0.2;
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
