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
  let sharedActivationResult = "idle";
  let sharedActivationError = "";

  function setActivationStatus(result, error) {
    sharedActivationResult = String(result || "unknown").slice(0, 120);
    sharedActivationError = String(error && error.name ? error.name : (error || "")).slice(0, 120);
  }

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
    if (!audio || !isDesktopViewport()) {
      setActivationStatus("desktop_inactive");
      return Promise.resolve(null);
    }
    if (sharedAudio && sharedAudio !== audio) {
      setActivationStatus("different_audio");
      return Promise.resolve(null);
    }

    const existing = getSharedGraph(audio);
    if (existing) {
      return resumeContext(existing.context).then(function (running) {
        setActivationStatus(running ? "ready" : "resume_failed");
        return existing;
      });
    }
    if (sharedAudio === audio && sharedContext && sharedSource) {
      return resumeContext(sharedContext).then(function (running) {
        if (!running) return null;
        try {
          attachAnalyser(sharedContext, sharedSource);
        } catch (error) {
          setActivationStatus("analyser_failed", error);
          return null;
        }
        setActivationStatus("ready");
        return getSharedGraph(audio);
      });
    }
    if (sharedActivationPromise) return sharedActivationPromise;

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setActivationStatus("unsupported");
      return Promise.resolve(null);
    }
    if (String(audio.crossOrigin || "").toLowerCase() !== "anonymous") {
      setActivationStatus("crossorigin_missing");
      return Promise.resolve(null);
    }

    let context = null;
    try {
      context = new AudioContextConstructor();
    } catch (error) {
      setActivationStatus("context_failed", error);
      return Promise.resolve(null);
    }

    sharedActivationPromise = resumeContext(context).then(function (running) {
      if (!running) {
        setActivationStatus("resume_failed");
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
      } catch (error) {
        setActivationStatus("source_failed", error);
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
      } catch (error) {
        setActivationStatus("analyser_failed", error);
        return null;
      }
      setActivationStatus("ready");
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
    const reportHealth = typeof config.reportHealth === "function"
      ? config.reportHealth
      : function () {};
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
    let healthProbeTimer = 0;
    let openCount = 0;
    let activationCount = 0;
    let activationSuccessCount = 0;
    let activationErrorCount = 0;
    let drawnFrameCount = 0;
    let nonzeroFrameCount = 0;
    let zeroFrameCount = 0;
    let maximumRms = 0;
    let maximumBass = 0;
    let maximumMid = 0;
    let maximumTreble = 0;
    let minimumEnergy = Infinity;
    let maximumEnergy = 0;
    let maximumAmplitudePx = 0;
    let audioAdvancedMs = 0;
    let previousAudioTime = null;

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
      return live;
    }

    function updateHealthFromFrame(live) {
      const sample = live || {};
      const rms = Math.max(0, Number(sample.rms) || 0);
      const bass = Math.max(0, Number(sample.bass) || 0);
      const mid = Math.max(0, Number(sample.mid) || 0);
      const treble = Math.max(0, Number(sample.treble) || 0);
      const energy = Math.max(0, Number(sample.energy) || 0);
      drawnFrameCount += 1;
      maximumRms = Math.max(maximumRms, rms);
      maximumBass = Math.max(maximumBass, bass);
      maximumMid = Math.max(maximumMid, mid);
      maximumTreble = Math.max(maximumTreble, treble);
      minimumEnergy = Math.min(minimumEnergy, energy);
      maximumEnergy = Math.max(maximumEnergy, energy);
      if (rms > 0.004 || bass > 0.01 || mid > 0.01 || treble > 0.01) {
        nonzeroFrameCount += 1;
      } else {
        zeroFrameCount += 1;
      }

      const audioTime = Number(audio.currentTime);
      if (Number.isFinite(audioTime)) {
        if (Number.isFinite(previousAudioTime)) {
          const advanced = audioTime - previousAudioTime;
          if (advanced > 0 && advanced <= 2) audioAdvancedMs += advanced * 1000;
        }
        previousAudioTime = audioTime;
      }
    }

    function getHealthSnapshot(reason) {
      const graph = getSharedGraph(audio);
      const bounds = canvas.getBoundingClientRect();
      let opacity = 0;
      try {
        opacity = typeof window.getComputedStyle === "function"
          ? Number(window.getComputedStyle(root).opacity)
          : (root.classList.contains("is-active") && root.classList.contains("is-ready") ? 1 : 0);
      } catch (_err) {
        opacity = 0;
      }
      return {
        reason: String(reason || "probe"),
        result: sharedActivationResult,
        state: sharedContext ? String(sharedContext.state || "unknown") : "absent",
        error_name: sharedActivationError,
        visualizer_open_count: openCount,
        visualizer_activation_count: activationCount,
        visualizer_activation_success_count: activationSuccessCount,
        visualizer_activation_error_count: activationErrorCount,
        visualizer_frame_count: drawnFrameCount,
        visualizer_nonzero_frame_count: nonzeroFrameCount,
        visualizer_zero_frame_count: zeroFrameCount,
        visualizer_max_rms_milli: Math.round(maximumRms * 1000),
        visualizer_max_bass_milli: Math.round(maximumBass * 1000),
        visualizer_max_mid_milli: Math.round(maximumMid * 1000),
        visualizer_max_treble_milli: Math.round(maximumTreble * 1000),
        visualizer_energy_range_milli: Math.round(
          Math.max(0, maximumEnergy - (Number.isFinite(minimumEnergy) ? minimumEnergy : maximumEnergy)) * 1000
        ),
        visualizer_max_amplitude_px: Math.round(maximumAmplitudePx),
        visualizer_canvas_width: Math.round(Math.max(0, Number(bounds.width) || 0)),
        visualizer_canvas_height: Math.round(Math.max(0, Number(bounds.height) || 0)),
        visualizer_canvas_opacity_milli: Math.round(Math.max(0, Math.min(1, opacity || 0)) * 1000),
        visualizer_audio_advanced_ms: Math.round(Math.max(0, audioAdvancedMs)),
        visualizer_context_supported: getAudioContextConstructor() ? 1 : 0,
        visualizer_context_running: sharedContext && sharedContext.state === "running" ? 1 : 0,
        visualizer_analyser_ready: graph ? 1 : 0,
        visualizer_canvas_visible: (
          bounds.width > 0 &&
          bounds.height > 0 &&
          opacity > 0 &&
          root.classList.contains("is-active") &&
          root.classList.contains("is-ready")
        ) ? 1 : 0
      };
    }

    function emitHealth(reason) {
      try {
        reportHealth(getHealthSnapshot(reason));
      } catch (_err) {
        // Diagnostics must never affect playback or rendering.
      }
    }

    function clearHealthProbe() {
      if (!healthProbeTimer || typeof clearTimeout !== "function") return;
      clearTimeout(healthProbeTimer);
      healthProbeTimer = 0;
    }

    function scheduleHealthProbe() {
      clearHealthProbe();
      if (typeof setTimeout !== "function") return;
      healthProbeTimer = setTimeout(function () {
        healthProbeTimer = 0;
        if (active) emitHealth("active_probe");
      }, 1600);
    }

    function draw(timestamp) {
      const size = resizeCanvas();
      drawingContext.clearRect(0, 0, size.width, size.height);
      const graph = getSharedGraph(audio);
      if (!active || !isDesktopViewport() || !graph) return;

      const reduced = prefersReducedMotion();
      const live = updateEnergy(graph, timestamp, reduced);
      updateHealthFromFrame(live);
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
        maximumAmplitudePx = Math.max(maximumAmplitudePx, amplitude);
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
      activationCount += 1;
      if (!isDesktopViewport()) {
        activationErrorCount += 1;
        emitHealth("activation");
        return Promise.resolve(false);
      }
      return activateLiveAnalysis(audio).then(function (graph) {
        if (graph) activationSuccessCount += 1;
        else activationErrorCount += 1;
        root.classList.toggle("is-ready", Boolean(graph));
        refresh();
        emitHealth("activation");
        return Boolean(graph);
      });
    }

    function sync(nextState) {
      const nextActive = Boolean(nextState && nextState.active && isDesktopViewport());
      if (nextActive && !active) {
        openCount += 1;
        previousAudioTime = Number.isFinite(Number(audio.currentTime)) ? Number(audio.currentTime) : null;
        scheduleHealthProbe();
      } else if (!nextActive && active) {
        clearHealthProbe();
        emitHealth("close");
      }
      active = nextActive;
      refresh();
    }

    ["play", "playing", "pause", "ended", "loadstart", "seeked"].forEach(function (eventName) {
      audio.addEventListener(eventName, refresh, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) emitHealth("hidden");
      refresh();
    }, { passive: true });

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
        clearHealthProbe();
        emitHealth("stop");
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
