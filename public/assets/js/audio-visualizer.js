(function () {
  "use strict";

  const DESKTOP_QUERY = "(min-width: 981px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const FRAME_INTERVAL_MS = 1000 / 30;
  const ENERGY_ATTACK_SECONDS = 0.045;
  const ENERGY_RELEASE_SECONDS = 0.26;
  const SPECTRUM_ATTACK_SECONDS = 0.035;
  const SPECTRUM_RELEASE_SECONDS = 0.18;
  const MAX_DEVICE_PIXEL_RATIO = 1.5;
  const FFT_SIZE = 2048;
  const ANALYSER_SMOOTHING = 0.42;
  const MIN_FREQUENCY_HZ = 40;
  const MAX_FREQUENCY_HZ = 16000;

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

  function readLogSpectrum(values, context, pointCount) {
    const count = Math.max(2, Number(pointCount) || 2);
    const points = new Array(count);
    if (!values || !values.length || !context) return points.fill(0);

    const nyquist = Math.max(1, Number(context.sampleRate) / 2);
    const minHz = Math.min(MIN_FREQUENCY_HZ, nyquist);
    const maxHz = Math.max(minHz, Math.min(MAX_FREQUENCY_HZ, nyquist * 0.96));
    const ratioRange = maxHz / Math.max(1, minHz);
    const denominator = Math.max(1, count - 1);

    function frequencyAt(ratio) {
      return minHz * Math.pow(ratioRange, Math.max(0, Math.min(1, ratio)));
    }

    for (let index = 0; index < count; index += 1) {
      const ratio = index / denominator;
      const leftRatio = Math.max(0, (index - 0.5) / denominator);
      const rightRatio = Math.min(1, (index + 0.5) / denominator);
      const lowHz = frequencyAt(leftRatio);
      const highHz = frequencyAt(rightRatio);
      const firstBin = Math.max(0, Math.floor((lowHz / nyquist) * values.length));
      const lastBin = Math.min(
        values.length - 1,
        Math.max(firstBin, Math.ceil((highHz / nyquist) * values.length))
      );
      let total = 0;
      let peak = 0;
      for (let bin = firstBin; bin <= lastBin; bin += 1) {
        const value = Number(values[bin]) || 0;
        total += value;
        peak = Math.max(peak, value);
      }
      const average = total / Math.max(1, lastBin - firstBin + 1);
      const normalized = ((average * 0.68) + (peak * 0.32)) / 255;
      const noiseFloor = 0.045 + (ratio * 0.012);
      const frequencyGain = 1.38 + (ratio * 0.2);
      points[index] = Math.pow(
        Math.max(0, Math.min(1, (normalized - noiseFloor) * frequencyGain)),
        0.72
      );
    }
    return points;
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
    let lastSpectrumAt = 0;
    let reactiveEnergy = 0;
    let spectrumEnvelope = [];
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
      } else {
        const elapsed = Math.max(0, Math.min(0.25, (energyTimestamp - lastEnergyAt) / 1000));
        reactiveEnergy = smoothValue(
          reactiveEnergy,
          live.energy,
          elapsed,
          ENERGY_ATTACK_SECONDS,
          ENERGY_RELEASE_SECONDS
        );
      }
      lastEnergyAt = energyTimestamp;
      return live;
    }

    function updateSpectrum(graph, timestamp, pointCount, reduced) {
      const targets = readLogSpectrum(graph.frequencyData, graph.context, pointCount);
      const spectrumTimestamp = Number(timestamp) || performance.now();
      const elapsed = lastSpectrumAt
        ? Math.max(0, Math.min(0.25, (spectrumTimestamp - lastSpectrumAt) / 1000))
        : 0;
      if (spectrumEnvelope.length !== targets.length) {
        spectrumEnvelope = targets.slice();
      } else {
        for (let index = 0; index < targets.length; index += 1) {
          spectrumEnvelope[index] = reduced || !lastSpectrumAt
            ? targets[index]
            : smoothValue(
              spectrumEnvelope[index],
              targets[index],
              elapsed,
              SPECTRUM_ATTACK_SECONDS,
              SPECTRUM_RELEASE_SECONDS
            );
        }
      }
      lastSpectrumAt = spectrumTimestamp;
      return targets;
    }

    function traceSpectrum(values, size, baselineY, maximumHeight) {
      const denominator = Math.max(1, values.length - 1);
      for (let index = 0; index < values.length; index += 1) {
        const x = (index / denominator) * size.width;
        const y = baselineY - (Math.max(0, Math.min(1, values[index])) * maximumHeight);
        if (index === 0) drawingContext.moveTo(x, y);
        else drawingContext.lineTo(x, y);
      }
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
      const pointCount = Math.max(72, Math.min(160, Math.round(size.width / 5)));
      const immediateSpectrum = updateSpectrum(graph, timestamp, pointCount, reduced);
      const baselineY = size.height * 0.82;
      const maximumHeight = Math.min(size.height * 0.38, 82);
      const dynamicHeight = maximumHeight * (0.9 + (reactiveEnergy * 0.16));
      const envelopePeak = spectrumEnvelope.reduce(function (peak, value) {
        return Math.max(peak, Number(value) || 0);
      }, 0);
      maximumAmplitudePx = Math.max(
        maximumAmplitudePx,
        Math.min(maximumHeight, envelopePeak * dynamicHeight)
      );
      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";

      drawingContext.beginPath();
      drawingContext.moveTo(0, baselineY);
      traceSpectrum(spectrumEnvelope, size, baselineY, dynamicHeight);
      drawingContext.lineTo(size.width, baselineY);
      drawingContext.closePath();
      drawingContext.fillStyle = "rgba(255,255,255,0.055)";
      drawingContext.fill();

      drawingContext.beginPath();
      drawingContext.strokeStyle = "rgba(229,44,49,0.24)";
      drawingContext.lineWidth = 1;
      traceSpectrum(immediateSpectrum, size, baselineY, dynamicHeight * 0.96);
      drawingContext.stroke();

      drawingContext.beginPath();
      drawingContext.strokeStyle = "rgba(255,255,255,0.48)";
      drawingContext.lineWidth = 1.6;
      traceSpectrum(spectrumEnvelope, size, baselineY, dynamicHeight);
      drawingContext.stroke();
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
