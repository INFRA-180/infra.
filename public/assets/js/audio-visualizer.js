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
  const POWDER_PARTICLE_COUNT = 10000;

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

  function createPowderParticles(count) {
    const particleCount = Math.max(0, Math.floor(Number(count) || 0));
    const particles = new Array(particleCount);
    let seed = 0x1f2e3d4c;
    function random() {
      seed = ((seed * 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const pairCount = Math.floor(particleCount / 2);
    for (let pair = 0; pair < pairCount; pair += 1) {
      const x = random();
      const distance = Math.pow(random(), 1.7);
      const size = 0.45 + (Math.pow(random(), 1.8) * 1.05);
      const opacity = 0.13 + (random() * 0.32);
      const accent = random() < 0.06;
      particles[pair * 2] = { x, vertical: -distance, size, opacity, accent };
      particles[(pair * 2) + 1] = { x, vertical: distance, size, opacity, accent };
    }
    if (particleCount % 2) {
      particles[particleCount - 1] = {
        x: random(),
        vertical: 0,
        size: 0.75,
        opacity: 0.28,
        accent: false
      };
    }
    return particles;
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
    const powderParticles = createPowderParticles(POWDER_PARTICLE_COUNT);
    let powderSurface = null;
    let powderContext = null;
    let powderImageData = null;
    let powderPixels = null;
    let powderSurfaceWidth = 0;
    let powderSurfaceHeight = 0;
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
        height: Math.max(1, bounds.height),
        ratio
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

    function traceSpectrum(values, size, centerY, maximumHeight, direction, reverse, continuePath) {
      const denominator = Math.max(1, values.length - 1);
      const verticalDirection = direction < 0 ? -1 : 1;
      for (let point = 0; point < values.length; point += 1) {
        const index = reverse ? values.length - 1 - point : point;
        const x = (index / denominator) * size.width;
        const y = centerY + (
          Math.max(0, Math.min(1, values[index])) * maximumHeight * verticalDirection
        );
        if (point === 0 && !continuePath) drawingContext.moveTo(x, y);
        else drawingContext.lineTo(x, y);
      }
    }

    function ensurePowderSurface(size) {
      const width = Math.max(1, Math.round(size.width * size.ratio));
      const height = Math.max(1, Math.round(size.height * size.ratio));
      if (!powderSurface) {
        try {
          powderSurface = document.createElement("canvas");
          powderContext = powderSurface.getContext("2d", { alpha: true });
        } catch (_err) {
          powderSurface = null;
          powderContext = null;
        }
      }
      if (!powderSurface || !powderContext) return false;
      if (
        powderImageData &&
        powderSurfaceWidth === width &&
        powderSurfaceHeight === height
      ) {
        return true;
      }
      powderSurface.width = width;
      powderSurface.height = height;
      powderSurfaceWidth = width;
      powderSurfaceHeight = height;
      try {
        powderImageData = powderContext.createImageData(width, height);
        powderPixels = powderImageData.data;
      } catch (_err) {
        powderImageData = null;
        powderPixels = null;
      }
      return Boolean(powderImageData && powderPixels);
    }

    function paintPowderPoint(x, y, size, accent, alpha) {
      const radius = size >= 1.6 ? 1 : 0;
      const alphaByte = Math.max(0, Math.min(255, Math.round(alpha * 255)));
      if (!alphaByte) return;
      const red = accent ? 229 : 255;
      const green = accent ? 44 : 255;
      const blue = accent ? 49 : 255;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const pixelY = y + offsetY;
        if (pixelY < 0 || pixelY >= powderSurfaceHeight) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const pixelX = x + offsetX;
          if (pixelX < 0 || pixelX >= powderSurfaceWidth) continue;
          const offset = ((pixelY * powderSurfaceWidth) + pixelX) * 4;
          if (alphaByte < powderPixels[offset + 3]) continue;
          powderPixels[offset] = red;
          powderPixels[offset + 1] = green;
          powderPixels[offset + 2] = blue;
          powderPixels[offset + 3] = alphaByte;
        }
      }
    }

    function drawPowder(values, size, centerY, maximumHeight) {
      if (!ensurePowderSurface(size)) return;
      powderPixels.fill(0);
      const energy = Math.max(0, Math.min(1, reactiveEnergy));
      const brightness = 0.56 + (energy * 0.28);
      const denominator = Math.max(1, values.length - 1);
      for (let index = 0; index < powderParticles.length; index += 1) {
        const particle = powderParticles[index];
        const spectrumPosition = particle.x * denominator;
        const spectrumIndex = Math.floor(spectrumPosition);
        const nextIndex = Math.min(values.length - 1, spectrumIndex + 1);
        const blend = spectrumPosition - spectrumIndex;
        const localLevel = (
          ((Number(values[spectrumIndex]) || 0) * (1 - blend)) +
          ((Number(values[nextIndex]) || 0) * blend)
        );
        const localHeight = Math.max(1.5, localLevel * maximumHeight);
        const distance = Math.abs(particle.vertical);
        const edgeFade = Math.min(1, particle.x / 0.035, (1 - particle.x) / 0.035);
        const alpha = Math.max(
          0,
          Math.min(
            0.62,
            particle.opacity * brightness * (1 - (Math.pow(distance, 3) * 0.68)) * edgeFade
          )
        );
        if (alpha <= 0.003) continue;
        paintPowderPoint(
          Math.round(particle.x * Math.max(0, powderSurfaceWidth - 1)),
          Math.round((centerY + (particle.vertical * localHeight)) * size.ratio),
          particle.size * size.ratio,
          particle.accent,
          alpha * (particle.accent ? 0.7 : 1)
        );
      }
      powderContext.putImageData(powderImageData, 0, 0);
      drawingContext.globalAlpha = 1;
      drawingContext.drawImage(
        powderSurface,
        0,
        0,
        powderSurfaceWidth,
        powderSurfaceHeight,
        0,
        0,
        size.width,
        size.height
      );
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
        visualizer_powder_particle_count: POWDER_PARTICLE_COUNT,
        visualizer_powder_surface_ready: powderImageData ? 1 : 0,
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
      const centerY = size.height * 0.5;
      const maximumHeight = Math.min(size.height * 0.25, 64);
      const dynamicHeight = maximumHeight * (0.96 + (reactiveEnergy * 0.04));
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
      traceSpectrum(spectrumEnvelope, size, centerY, dynamicHeight, -1, false);
      traceSpectrum(spectrumEnvelope, size, centerY, dynamicHeight, 1, true, true);
      drawingContext.closePath();
      drawingContext.fillStyle = "rgba(255,255,255,0.055)";
      drawingContext.fill();

      drawingContext.save();
      drawingContext.clip();
      drawPowder(spectrumEnvelope, size, centerY, dynamicHeight);
      drawingContext.restore();

      drawingContext.beginPath();
      drawingContext.strokeStyle = "rgba(255,255,255,0.13)";
      drawingContext.lineWidth = 1;
      drawingContext.moveTo(0, centerY);
      drawingContext.lineTo(size.width, centerY);
      drawingContext.stroke();

      drawingContext.beginPath();
      drawingContext.strokeStyle = "rgba(229,44,49,0.24)";
      drawingContext.lineWidth = 1;
      traceSpectrum(immediateSpectrum, size, centerY, dynamicHeight * 0.96, -1, false);
      traceSpectrum(immediateSpectrum, size, centerY, dynamicHeight * 0.96, 1, false);
      drawingContext.stroke();

      drawingContext.beginPath();
      drawingContext.strokeStyle = "rgba(255,255,255,0.48)";
      drawingContext.lineWidth = 1.6;
      traceSpectrum(spectrumEnvelope, size, centerY, dynamicHeight, -1, false);
      traceSpectrum(spectrumEnvelope, size, centerY, dynamicHeight, 1, false);
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
