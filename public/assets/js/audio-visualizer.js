(function () {
  "use strict";

  const DESKTOP_QUERY = "(min-width: 981px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const FRAME_INTERVAL_MS = 1000 / 30;
  const ENERGY_ATTACK_SECONDS = 0.045;
  const ENERGY_RELEASE_SECONDS = 0.26;
  const BEAT_RELEASE_SECONDS = 0.2;
  const MAX_DEVICE_PIXEL_RATIO = 1.5;
  const FFT_SIZE = 512;
  const ANALYSER_SMOOTHING = 0.58;

  let sharedAudio = null;
  let sharedContext = null;
  let sharedSource = null;
  let sharedAnalyser = null;
  let sharedFrequencyData = null;
  let sharedTimeData = null;
  let sharedActivationPromise = null;

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

  function getAudioContextConstructor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function resumeContext(context) {
    if (!context || context.state === "closed") return Promise.resolve(false);
    if (context.state === "running") return Promise.resolve(true);
    if (typeof context.resume !== "function") return Promise.resolve(false);
    try {
      return Promise.resolve(context.resume()).then(function () {
        return context.state === "running";
      }).catch(function () {
        return false;
      });
    } catch (_err) {
      return Promise.resolve(false);
    }
  }

  function getSharedGraph(audio) {
    if (!audio || sharedAudio !== audio || !sharedContext || !sharedAnalyser) return null;
    return {
      context: sharedContext,
      source: sharedSource,
      analyser: sharedAnalyser,
      frequencyData: sharedFrequencyData,
      timeData: sharedTimeData
    };
  }

  function attachAnalyser(context, source) {
    if (!context || !source) return null;
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -18;
    source.connect(analyser);
    sharedAnalyser = analyser;
    sharedFrequencyData = new Uint8Array(analyser.frequencyBinCount);
    sharedTimeData = new Uint8Array(analyser.fftSize);
    return analyser;
  }

  function activateLiveAnalysis(audio) {
    if (!audio || !isDesktopViewport()) return Promise.resolve(null);
    if (sharedAudio && sharedAudio !== audio) return Promise.resolve(null);

    const existing = getSharedGraph(audio);
    if (existing) {
      return resumeContext(existing.context).then(function () {
        return existing;
      });
    }
    if (sharedAudio === audio && sharedContext && sharedSource) {
      return resumeContext(sharedContext).then(function (running) {
        if (!running) return null;
        try {
          attachAnalyser(sharedContext, sharedSource);
        } catch (_err) {
          return null;
        }
        return getSharedGraph(audio);
      });
    }
    if (sharedActivationPromise) return sharedActivationPromise;

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) return Promise.resolve(null);
    if (String(audio.crossOrigin || "").toLowerCase() !== "anonymous") {
      return Promise.resolve(null);
    }

    let context = null;
    try {
      context = new AudioContextConstructor();
    } catch (_err) {
      return Promise.resolve(null);
    }

    sharedActivationPromise = resumeContext(context).then(function (running) {
      if (!running) {
        if (typeof context.close === "function") {
          try {
            context.close();
          } catch (_err) {
            // The media element was never attached, so closing is safe here.
          }
        }
        return null;
      }

      let source = null;
      try {
        source = context.createMediaElementSource(audio);
        // Keep the audible route direct. The analyser is a side branch and is
        // deliberately not connected to the destination.
        source.connect(context.destination);
      } catch (_err) {
        // If the source was created, keep its direct destination route alive:
        // closing this context would mute the already-routed media element.
        if (!source && typeof context.close === "function") {
          try {
            context.close();
          } catch (_closeErr) {
            // Ignore cleanup failures before the source exists.
          }
        }
        return null;
      }

      sharedAudio = audio;
      sharedContext = context;
      sharedSource = source;
      try {
        attachAnalyser(context, source);
      } catch (_err) {
        return null;
      }
      return getSharedGraph(audio);
    }).finally(function () {
      sharedActivationPromise = null;
    });

    return sharedActivationPromise;
  }

  function averageFrequencyRange(values, context, analyser, lowHz, highHz) {
    if (!values || !values.length || !context || !analyser) return 0;
    const nyquist = Math.max(1, Number(context.sampleRate) / 2);
    const first = Math.max(0, Math.floor((lowHz / nyquist) * values.length));
    const last = Math.min(
      values.length - 1,
      Math.max(first, Math.ceil((highHz / nyquist) * values.length))
    );
    let total = 0;
    for (let index = first; index <= last; index += 1) total += values[index];
    return (total / Math.max(1, last - first + 1)) / 255;
  }

  function readLiveEnergy(graph) {
    if (!graph || !graph.analyser) {
      return { bass: 0, mid: 0, treble: 0, rms: 0, energy: 0 };
    }
    graph.analyser.getByteFrequencyData(graph.frequencyData);
    graph.analyser.getByteTimeDomainData(graph.timeData);

    let squared = 0;
    for (let index = 0; index < graph.timeData.length; index += 1) {
      const sample = (graph.timeData[index] - 128) / 128;
      squared += sample * sample;
    }
    const rms = Math.min(1, Math.sqrt(squared / Math.max(1, graph.timeData.length)) * 3.2);
    const bass = averageFrequencyRange(
      graph.frequencyData,
      graph.context,
      graph.analyser,
      40,
      250
    );
    const mid = averageFrequencyRange(
      graph.frequencyData,
      graph.context,
      graph.analyser,
      250,
      2400
    );
    const treble = averageFrequencyRange(
      graph.frequencyData,
      graph.context,
      graph.analyser,
      2400,
      10000
    );
    const spectral = (bass * 0.58) + (mid * 0.29) + (treble * 0.13);
    return {
      bass,
      mid,
      treble,
      rms,
      energy: Math.max(rms * 0.82, spectral)
    };
  }

  function createVisualizer(options) {
    const config = options || {};
    const audio = config.audio || null;
    const canvas = config.canvas || null;
    const root = config.root || null;
    if (!audio || !canvas || !root) return null;
    if (canvas.__infraAudioVisualizer) return canvas.__infraAudioVisualizer;

    const drawingContext = canvas.getContext("2d", { alpha: true });
    if (!drawingContext) return null;

    let active = false;
    let animationFrame = 0;
    let lastFrameAt = 0;
    let lastEnergyAt = 0;
    let lastMotionAt = 0;
    let reactiveEnergy = 0;
    let reactiveBass = 0;
    let reactiveMid = 0;
    let reactiveTreble = 0;
    let previousBass = 0;
    let previousRms = 0;
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
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      return {
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height)
      };
    }

    function smoothValue(current, target, elapsed, attack, release) {
      const response = target > current ? attack : release;
      return current + ((target - current) * (1 - Math.exp(-elapsed / response)));
    }

    function updateEnergy(graph, timestamp, reduced) {
      const live = readLiveEnergy(graph);
      const energyTimestamp = Number(timestamp) || performance.now();
      if (reduced || !lastEnergyAt) {
        reactiveEnergy = live.energy;
        reactiveBass = live.bass;
        reactiveMid = live.mid;
        reactiveTreble = live.treble;
        beatPulse = 0;
      } else {
        const elapsed = Math.max(0, Math.min(0.25, (energyTimestamp - lastEnergyAt) / 1000));
        reactiveEnergy = smoothValue(
          reactiveEnergy,
          live.energy,
          elapsed,
          ENERGY_ATTACK_SECONDS,
          ENERGY_RELEASE_SECONDS
        );
        reactiveBass = smoothValue(reactiveBass, live.bass, elapsed, 0.04, 0.24);
        reactiveMid = smoothValue(reactiveMid, live.mid, elapsed, 0.055, 0.22);
        reactiveTreble = smoothValue(reactiveTreble, live.treble, elapsed, 0.035, 0.16);
        const transient = Math.max(
          0,
          ((live.bass - previousBass) * 3.4) + ((live.rms - previousRms) * 2.2)
        );
        beatPulse = Math.max(
          beatPulse * Math.exp(-elapsed / BEAT_RELEASE_SECONDS),
          Math.min(1, transient)
        );
      }
      previousBass = live.bass;
      previousRms = live.rms;
      lastEnergyAt = energyTimestamp;

      if (!reduced) {
        const motionElapsed = lastMotionAt
          ? Math.max(0, Math.min(0.25, (energyTimestamp - lastMotionAt) / 1000))
          : 0;
        motionPhase += motionElapsed * (
          0.48 +
          (reactiveBass * 1.1) +
          (reactiveMid * 0.55) +
          (beatPulse * 1.45)
        );
      }
      lastMotionAt = energyTimestamp;
    }

    function draw(timestamp) {
      const size = resizeCanvas();
      drawingContext.clearRect(0, 0, size.width, size.height);
      const graph = getSharedGraph(audio);
      if (!active || !isDesktopViewport() || !graph) return;

      const reduced = prefersReducedMotion();
      updateEnergy(graph, timestamp, reduced);
      const centerY = size.height * 0.5;
      const rhythmicEnergy = Math.max(
        0,
        Math.min(1, reactiveEnergy + (reactiveBass * 0.2) + (beatPulse * 0.34))
      );
      const pointCount = Math.max(52, Math.min(112, Math.round(size.width / 7)));
      const layers = [
        {
          color: "rgba(255,255,255,0.09)",
          width: 1.1,
          speed: 0.64,
          frequency: 1.18,
          offset: 0.2,
          band: reactiveBass,
          scale: 0.76
        },
        {
          color: "rgba(255,255,255,0.15)",
          width: 1.3,
          speed: -0.54,
          frequency: 1.7,
          offset: 2.1,
          band: reactiveMid,
          scale: 0.62
        },
        {
          color: "rgba(242,38,45,0.16)",
          width: 1.15,
          speed: 0.48,
          frequency: 2.2,
          offset: 4.4,
          band: reactiveTreble,
          scale: 0.5
        }
      ];

      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";
      for (const layer of layers) {
        drawingContext.beginPath();
        drawingContext.strokeStyle = layer.color;
        drawingContext.lineWidth = layer.width;
        const amplitude = size.height * (
          0.018 +
          (rhythmicEnergy * 0.075) +
          (layer.band * 0.065)
        ) * layer.scale;
        for (let index = 0; index < pointCount; index += 1) {
          const ratio = index / (pointCount - 1);
          const primary = Math.sin(
            (ratio * Math.PI * 2 * layer.frequency) +
            (motionPhase * layer.speed) +
            layer.offset
          );
          const detail = Math.sin(
            (ratio * Math.PI * 2 * (layer.frequency * (2.15 + (reactiveTreble * 0.6)))) -
            (motionPhase * layer.speed * 0.78) +
            (layer.offset * 0.5)
          ) * (0.13 + (layer.band * 0.18));
          const edgeFade = Math.sin(Math.PI * ratio);
          const x = ratio * size.width;
          const y = centerY + ((primary + detail) * amplitude * edgeFade);
          if (index === 0) drawingContext.moveTo(x, y);
          else drawingContext.lineTo(x, y);
        }
        drawingContext.stroke();
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
      if (
        animationFrame ||
        !active ||
        audio.paused ||
        audio.ended ||
        document.hidden ||
        prefersReducedMotion()
      ) {
        draw(performance.now());
        return;
      }
      animationFrame = requestAnimationFrame(frame);
    }

    function refresh() {
      stopAnimation();
      const graph = getSharedGraph(audio);
      if (!active || !isDesktopViewport()) {
        drawingContext.clearRect(0, 0, canvas.width, canvas.height);
        root.classList.remove("is-active");
        return;
      }
      root.classList.add("is-active");
      root.classList.toggle("is-ready", Boolean(graph));
      if (!graph) return;
      resumeContext(graph.context);
      draw(performance.now());
      startAnimation();
    }

    function activate() {
      if (!isDesktopViewport()) return Promise.resolve(false);
      return activateLiveAnalysis(audio).then(function (graph) {
        root.classList.toggle("is-ready", Boolean(graph));
        refresh();
        return Boolean(graph);
      });
    }

    function sync(nextState) {
      active = Boolean(nextState && nextState.active && isDesktopViewport());
      refresh();
    }

    ["play", "playing", "pause", "ended", "loadstart", "seeked"].forEach(function (eventName) {
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
      activate,
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
    create: createVisualizer
  });
})();
