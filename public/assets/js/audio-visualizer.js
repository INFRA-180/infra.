(function () {
  "use strict";

  const DESKTOP_QUERY = "(min-width: 981px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const FRAME_INTERVAL_MS = 1000 / 30;
  const ENERGY_ATTACK_SECONDS = 0.045;
  const ENERGY_RELEASE_SECONDS = 0.26;
  const SPECTRUM_ATTACK_SECONDS = 0.035;
  const SPECTRUM_RELEASE_SECONDS = 0.18;
  const SPECTRUM_SPATIAL_KERNEL = Object.freeze([1, 4, 6, 4, 1]);
  const SPECTRUM_SPATIAL_KERNEL_WEIGHT = 16;
  const HELIX_DRIVE_ATTACK_SECONDS = 0.09;
  const HELIX_DRIVE_RELEASE_SECONDS = 0.24;
  const MAX_DEVICE_PIXEL_RATIO = 1.5;
  const FFT_SIZE = 2048;
  const ANALYSER_SMOOTHING = 0.42;
  const MIN_FREQUENCY_HZ = 40;
  const MAX_FREQUENCY_HZ = 16000;
  const POWDER_EARTH_PARTICLE_COUNT = 250000;
  const POWDER_MOON_PARTICLE_COUNT = 250000;
  const POWDER_PARTICLE_COUNT = 500000;
  const POWDER_HELIX_PARTICLE_COUNT = 60000;
  const POWDER_HELIX_TURNS = 3.25;
  const POWDER_HELIX_IDLE_RADIUS_PX = 2.4;
  const EARTH_GRAVITY_METERS_PER_SECOND2 = 9.80665;
  const MOON_GRAVITY_METERS_PER_SECOND2 = 1.62;
  const POWDER_PIXELS_PER_METER = 100;
  const POWDER_EARTH_GRAVITY_PX_PER_SECOND2 =
    EARTH_GRAVITY_METERS_PER_SECOND2 * POWDER_PIXELS_PER_METER;
  const POWDER_MOON_GRAVITY_PX_PER_SECOND2 =
    MOON_GRAVITY_METERS_PER_SECOND2 * POWDER_PIXELS_PER_METER;
  const POWDER_AIR_DRAG_PER_SECOND = 0.18;
  const POWDER_MAX_PHYSICS_STEP_SECONDS = 1 / 60;

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
    return smoothSpectrumSpatially(points);
  }

  function smoothSpectrumSpatially(values) {
    const count = values && values.length ? values.length : 0;
    if (!count) return [];
    if (count < 3) return Array.from(values);
    const smoothed = new Array(count);
    const last = count - 1;
    for (let index = 0; index < count; index += 1) {
      let total = 0;
      for (let kernelIndex = 0; kernelIndex < SPECTRUM_SPATIAL_KERNEL.length; kernelIndex += 1) {
        const sourceIndex = Math.max(
          0,
          Math.min(last, index + kernelIndex - 2)
        );
        total += (
          Math.max(0, Math.min(1, Number(values[sourceIndex]) || 0)) *
          SPECTRUM_SPATIAL_KERNEL[kernelIndex]
        );
      }
      smoothed[index] = total / SPECTRUM_SPATIAL_KERNEL_WEIGHT;
    }
    return smoothed;
  }

  function createPowderParticles(count) {
    const particleCount = Math.max(0, Math.floor(Number(count) || 0));
    const particles = {
      count: particleCount,
      x: new Float32Array(particleCount),
      height: new Float32Array(particleCount),
      velocity: new Float32Array(particleCount),
      restOffset: new Float32Array(particleCount),
      opacity: new Uint8Array(particleCount),
      accent: new Uint8Array(particleCount),
      side: new Uint8Array(particleCount),
      gravityClass: new Uint8Array(particleCount),
      helixClass: new Uint8Array(particleCount),
      helixStrand: new Uint8Array(particleCount),
      helixOffset: new Float32Array(particleCount),
      helixVelocity: new Float32Array(particleCount),
      helixBaseSin: new Float32Array(particleCount),
      helixBaseCos: new Float32Array(particleCount),
      response: new Float32Array(particleCount),
      launchThreshold: new Float32Array(particleCount),
      restitution: new Float32Array(particleCount),
      nextLaunchAt: new Float64Array(particleCount),
      bandIndex: new Uint16Array(particleCount),
      bandBlend: new Float32Array(particleCount),
      bandPointCount: 0
    };
    let seed = 0x1f2e3d4c;
    function random() {
      seed = ((seed * 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let index = 0; index < particleCount; index += 1) {
      particles.x[index] = random();
      particles.side[index] = index & 1;
      particles.gravityClass[index] = (index >> 1) & 1;
      particles.helixClass[index] = index % 25 < 3 ? 1 : 0;
      particles.helixStrand[index] = (Math.floor(index / 25) + index) & 1;
      if (particles.helixClass[index]) {
        const basePhase = (
          particles.x[index] * POWDER_HELIX_TURNS * Math.PI * 2
        ) + (particles.helixStrand[index] ? Math.PI : 0);
        particles.helixBaseSin[index] = Math.sin(basePhase);
        particles.helixBaseCos[index] = Math.cos(basePhase);
        particles.helixOffset[index] = (
          particles.side[index] ? 1 : -1
        ) * POWDER_HELIX_IDLE_RADIUS_PX;
      }
      particles.restOffset[index] = particles.gravityClass[index]
        ? 3.5 + (Math.pow(random(), 0.7) * 11)
        : 2.2 + (Math.pow(random(), 0.8) * 8);
      particles.opacity[index] = 2 + Math.floor(random() * 7);
      particles.accent[index] = random() < 0.045 ? 1 : 0;
      particles.response[index] = particles.gravityClass[index]
        ? 0.9 + (random() * 0.1)
        : 0.68 + (random() * 0.3);
      particles.launchThreshold[index] = 0.08 + (random() * 0.84);
      particles.restitution[index] = 0.08 + (random() * 0.1);
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
    let powderContainmentEnvelope = [];
    let powderContainmentRawEnvelope = [];
    let powderBandMaxHeights = new Float32Array(0);
    let previousPowderSpectrum = [];
    let powderSpectrumFlux = [];
    let lastPowderPhysicsAt = 0;
    let powderAirborneCount = 0;
    let powderKickCount = 0;
    let maximumPowderAirborneCount = 0;
    let maximumPowderRisePx = 0;
    let powderHelixActiveCount = 0;
    let maximumPowderHelixActiveCount = 0;
    let maximumPowderHelixOffsetPx = 0;
    let powderHelixRotationPhase = 0;
    let powderHelixDrive = 0;
    let maximumPowderUpdateMs = 0;
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
      if (!values.length) return;

      function coordinates(point) {
        const index = reverse ? values.length - 1 - point : point;
        return {
          x: (index / denominator) * size.width,
          y: centerY + (
            Math.max(0, Math.min(1, values[index])) * maximumHeight * verticalDirection
          )
        };
      }

      let previous = coordinates(0);
      if (continuePath) drawingContext.lineTo(previous.x, previous.y);
      else drawingContext.moveTo(previous.x, previous.y);
      if (typeof drawingContext.quadraticCurveTo !== "function") {
        for (let point = 1; point < values.length; point += 1) {
          const current = coordinates(point);
          drawingContext.lineTo(current.x, current.y);
        }
        return;
      }
      for (let point = 1; point < values.length; point += 1) {
        const current = coordinates(point);
        drawingContext.quadraticCurveTo(
          previous.x,
          previous.y,
          (previous.x + current.x) * 0.5,
          (previous.y + current.y) * 0.5
        );
        previous = current;
      }
      drawingContext.quadraticCurveTo(previous.x, previous.y, previous.x, previous.y);
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

    function updatePowderBandMap(pointCount) {
      const count = Math.max(2, Number(pointCount) || 2);
      if (powderParticles.bandPointCount === count) return;
      const denominator = Math.max(1, count - 1);
      for (let index = 0; index < powderParticles.count; index += 1) {
        const position = powderParticles.x[index] * denominator;
        const first = Math.min(count - 1, Math.floor(position));
        powderParticles.bandIndex[index] = first;
        powderParticles.bandBlend[index] = position - first;
      }
      powderParticles.bandPointCount = count;
    }

    function settlePowderParticles() {
      powderParticles.height.fill(0);
      powderParticles.velocity.fill(0);
      powderParticles.nextLaunchAt.fill(0);
      powderParticles.helixVelocity.fill(0);
      for (let index = 0; index < powderParticles.count; index += 1) {
        if (!powderParticles.helixClass[index]) continue;
        powderParticles.helixOffset[index] = (
          powderParticles.side[index] ? 1 : -1
        ) * POWDER_HELIX_IDLE_RADIUS_PX;
      }
      powderAirborneCount = 0;
      powderHelixActiveCount = 0;
      powderHelixRotationPhase = 0;
      powderHelixDrive = 0;
      lastPowderPhysicsAt = 0;
      previousPowderSpectrum.fill(0);
      powderSpectrumFlux.fill(0);
    }

    function updatePowderPhysics(values, frameHeight, timestamp, reduced, allowLaunch) {
      const updateStartedAt = performance.now();
      const physicsTimestamp = Number(timestamp) || performance.now();
      updatePowderBandMap(values.length);
      if (previousPowderSpectrum.length !== values.length) {
        previousPowderSpectrum = values.map(function (value) {
          return Math.max(0, Math.min(1, Number(value) || 0));
        });
        powderSpectrumFlux = new Array(values.length).fill(0);
      }
      let averageFlux = 0;
      for (let index = 0; index < values.length; index += 1) {
        const current = Math.max(0, Math.min(1, Number(values[index]) || 0));
        powderSpectrumFlux[index] = Math.max(0, current - previousPowderSpectrum[index]);
        averageFlux += powderSpectrumFlux[index];
      }
      averageFlux /= Math.max(1, values.length);

      if (reduced) {
        settlePowderParticles();
      }

      if (powderBandMaxHeights.length !== values.length) {
        powderBandMaxHeights = new Float32Array(values.length);
        powderContainmentEnvelope = new Array(values.length).fill(0);
        powderContainmentRawEnvelope = new Array(values.length).fill(0);
      } else {
        powderBandMaxHeights.fill(0);
      }

      const elapsed = lastPowderPhysicsAt
        ? Math.max(0, Math.min(0.08, (physicsTimestamp - lastPowderPhysicsAt) / 1000))
        : FRAME_INTERVAL_MS / 1000;
      lastPowderPhysicsAt = physicsTimestamp;
      const stepCount = Math.max(1, Math.ceil(elapsed / POWDER_MAX_PHYSICS_STEP_SECONDS));
      const step = elapsed / stepCount;
      const drag = Math.exp(-POWDER_AIR_DRAG_PER_SECOND * step);
      const helixDriveTarget = allowLaunch && !reduced
        ? Math.max(0, Math.min(1, (reactiveEnergy * 0.45) + (averageFlux * 1.5)))
        : 0;
      powderHelixDrive = reduced
        ? 0
        : smoothValue(
          powderHelixDrive,
          helixDriveTarget,
          elapsed,
          HELIX_DRIVE_ATTACK_SECONDS,
          HELIX_DRIVE_RELEASE_SECONDS
        );
      const helixDrive = powderHelixDrive;
      const helixRotationSpeed = allowLaunch ? 0.42 + (helixDrive * 1.45) : 0;
      powderHelixRotationPhase = (
        powderHelixRotationPhase + (helixRotationSpeed * elapsed)
      ) % (Math.PI * 2);
      const helixRotationSin = Math.sin(powderHelixRotationPhase);
      const helixRotationCos = Math.cos(powderHelixRotationPhase);
      let airborne = 0;
      let helixActive = 0;
      const lastBand = Math.max(0, values.length - 1);
      const bandIndices = powderParticles.bandIndex;
      const bandBlends = powderParticles.bandBlend;
      const heights = powderParticles.height;
      const velocities = powderParticles.velocity;
      const gravityClasses = powderParticles.gravityClass;
      const nextLaunchTimes = powderParticles.nextLaunchAt;
      const launchThresholds = powderParticles.launchThreshold;
      const restOffsets = powderParticles.restOffset;
      const responses = powderParticles.response;
      const restitutions = powderParticles.restitution;
      const sides = powderParticles.side;
      const helixClasses = powderParticles.helixClass;
      const helixStrands = powderParticles.helixStrand;
      const helixOffsets = powderParticles.helixOffset;
      const helixVelocities = powderParticles.helixVelocity;
      const helixBaseSines = powderParticles.helixBaseSin;
      const helixBaseCosines = powderParticles.helixBaseCos;

      for (let index = 0; index < powderParticles.count; index += 1) {
        const first = bandIndices[index];
        const second = Math.min(lastBand, first + 1);
        const blend = bandBlends[index];
        const localLevel = (
          (values[first] * (1 - blend)) +
          (values[second] * blend)
        );
        const localFlux = (
          (powderSpectrumFlux[first] * (1 - blend)) +
          (powderSpectrumFlux[second] * blend)
        );
        let height = heights[index];
        let velocity = velocities[index];
        const gravity = gravityClasses[index]
          ? POWDER_MOON_GRAVITY_PX_PER_SECOND2
          : POWDER_EARTH_GRAVITY_PX_PER_SECOND2;
        if (helixClasses[index]) {
          const direction = helixStrands[index] ? -1 : 1;
          const wave = (
            (helixBaseSines[index] * helixRotationCos) +
            (direction * helixBaseCosines[index] * helixRotationSin)
          );
          const signal = Math.max(
            0,
            Math.min(1, (localLevel * 0.82) + (localFlux * 0.75) + (helixDrive * 0.06))
          );
          const idleOffset = (sides[index] ? 1 : -1) * POWDER_HELIX_IDLE_RADIUS_PX;
          const radius = allowLaunch && signal > 0.008
            ? Math.min(
              frameHeight - 1,
              POWDER_HELIX_IDLE_RADIUS_PX +
                (frameHeight * (0.035 + (signal * 0.18)) * responses[index])
            )
            : POWDER_HELIX_IDLE_RADIUS_PX;
          const targetOffset = allowLaunch && signal > 0.008
            ? wave * radius
            : idleOffset;
          let helixOffset = helixOffsets[index];
          let helixVelocity = helixVelocities[index];
          const helixSpring = allowLaunch
            ? (gravityClasses[index] ? 15 : 32)
            : (gravityClasses[index] ? 24 : 36);
          const helixDampingRate = allowLaunch
            ? (gravityClasses[index] ? 2.4 : 5.8)
            : (gravityClasses[index] ? 4.8 : 7);
          const helixDamping = Math.exp(-helixDampingRate * step);
          for (let substep = 0; substep < stepCount; substep += 1) {
            helixVelocity += (targetOffset - helixOffset) * helixSpring * step;
            helixVelocity *= helixDamping;
            helixOffset += helixVelocity * step;
          }
          const helixLimit = Math.max(POWDER_HELIX_IDLE_RADIUS_PX, frameHeight - 1);
          helixOffset = Math.max(-helixLimit, Math.min(helixLimit, helixOffset));
          if (
            !allowLaunch &&
            Math.abs(targetOffset - helixOffset) < 0.4 &&
            Math.abs(helixVelocity) < 1
          ) {
            helixOffset = idleOffset;
            helixVelocity = 0;
          }
          helixOffsets[index] = helixOffset;
          helixVelocities[index] = helixVelocity;
          const helixMoving = allowLaunch
            ? signal > 0.008 || Math.abs(helixVelocity) > 0.04
            : (
              Math.abs(targetOffset - helixOffset) > 0.4 ||
              Math.abs(helixVelocity) > 1
            );
          if (helixMoving) {
            helixActive += 1;
            airborne += 1;
          }
          const absoluteHelixOffset = Math.abs(helixOffset);
          maximumPowderRisePx = Math.max(maximumPowderRisePx, absoluteHelixOffset);
          maximumPowderHelixOffsetPx = Math.max(
            maximumPowderHelixOffsetPx,
            absoluteHelixOffset
          );
          const visibleHelixHeight = Math.min(frameHeight, absoluteHelixOffset + 1);
          if (visibleHelixHeight > powderBandMaxHeights[first]) {
            powderBandMaxHeights[first] = visibleHelixHeight;
          }
          if (visibleHelixHeight > powderBandMaxHeights[second]) {
            powderBandMaxHeights[second] = visibleHelixHeight;
          }
          continue;
        }
        const grounded = height <= 0.01 && Math.abs(velocity) <= 0.01;
        if (
          !reduced &&
          grounded &&
          allowLaunch &&
          physicsTimestamp >= nextLaunchTimes[index]
        ) {
          const drive = Math.min(1, (localFlux * 3.4) + (localLevel * 0.38));
          if (drive >= launchThresholds[index]) {
            const localCeiling = Math.max(
              0,
              (localLevel * frameHeight) - restOffsets[index] - 1
            );
            const launchRatio = gravityClasses[index]
              ? Math.min(1, 0.78 + (localLevel * 0.16) + (localFlux * 0.8))
              : Math.min(1, 0.5 + (localLevel * 0.34) + (localFlux * 1.2));
            const targetHeight = Math.min(
              localCeiling,
              localCeiling * launchRatio * responses[index]
            );
            if (targetHeight >= 1) {
              velocity = Math.sqrt(2 * gravity * targetHeight);
              height = 0.02;
              nextLaunchTimes[index] =
                physicsTimestamp + 120 + (launchThresholds[index] * 260);
              launchThresholds[index] = 0.08 + (
                ((launchThresholds[index] * 1.618) + 0.173) % 0.84
              );
              powderKickCount += 1;
            }
          }
        }

        for (
          let substep = 0;
          substep < stepCount && (height > 0 || velocity > 0);
          substep += 1
        ) {
          velocity -= gravity * step;
          velocity *= drag;
          height += velocity * step;
          if (height <= 0) {
            const impactSpeed = Math.max(0, -velocity);
            height = 0;
            if (impactSpeed >= 85) {
              velocity = impactSpeed * restitutions[index];
              height = 0.02;
            } else {
              velocity = 0;
            }
          }
        }
        const maximumParticleHeight = Math.max(
          0,
          frameHeight - restOffsets[index] - 1
        );
        if (height > maximumParticleHeight) {
          height = maximumParticleHeight;
          if (velocity > 0) velocity = 0;
        }
        heights[index] = height;
        velocities[index] = velocity;
        if (height > 0 || Math.abs(velocity) > 0.01) airborne += 1;
        maximumPowderRisePx = Math.max(maximumPowderRisePx, height);

        const visibleHeight = Math.min(
          frameHeight,
          height + restOffsets[index] + 1
        );
        if (visibleHeight > powderBandMaxHeights[first]) powderBandMaxHeights[first] = visibleHeight;
        if (visibleHeight > powderBandMaxHeights[second]) powderBandMaxHeights[second] = visibleHeight;
      }

      powderAirborneCount = airborne;
      powderHelixActiveCount = helixActive;
      maximumPowderAirborneCount = Math.max(maximumPowderAirborneCount, airborne);
      maximumPowderHelixActiveCount = Math.max(maximumPowderHelixActiveCount, helixActive);
      for (let index = 0; index < values.length; index += 1) {
        previousPowderSpectrum[index] = Math.max(0, Math.min(1, Number(values[index]) || 0));
        powderContainmentRawEnvelope[index] = Math.max(
          Math.max(0, Math.min(1, Number(spectrumEnvelope[index]) || 0)),
          Math.max(0, Math.min(1, powderBandMaxHeights[index] / Math.max(1, frameHeight)))
        );
      }
      const smoothedContainment = smoothSpectrumSpatially(powderContainmentRawEnvelope);
      for (let index = 0; index < values.length; index += 1) {
        powderContainmentEnvelope[index] = Math.max(
          powderContainmentRawEnvelope[index],
          smoothedContainment[index]
        );
      }
      maximumPowderUpdateMs = Math.max(
        maximumPowderUpdateMs,
        Math.max(0, performance.now() - updateStartedAt)
      );
    }

    function drawPowder(size, centerY) {
      if (!ensurePowderSurface(size)) return;
      powderPixels.fill(0);
      const energy = Math.max(0, Math.min(1, reactiveEnergy));
      const brightness = 0.56 + (energy * 0.28);
      const xs = powderParticles.x;
      const opacities = powderParticles.opacity;
      const accents = powderParticles.accent;
      const sides = powderParticles.side;
      const restOffsets = powderParticles.restOffset;
      const heights = powderParticles.height;
      const helixClasses = powderParticles.helixClass;
      const helixOffsets = powderParticles.helixOffset;
      const helixVelocities = powderParticles.helixVelocity;
      const maximumPixelX = Math.max(0, powderSurfaceWidth - 1);
      for (let index = 0; index < powderParticles.count; index += 1) {
        const x = xs[index];
        const edgeFade = Math.min(1, x / 0.035, (1 - x) / 0.035);
        const helix = helixClasses[index];
        const moving = helix
          ? (
            Math.abs(helixVelocities[index]) > 0.04 ||
            Math.abs(helixOffsets[index]) > POWDER_HELIX_IDLE_RADIUS_PX + 0.4
          )
          : heights[index] > 0.05;
        const restingOpacity = moving ? 1 : 0.34;
        const alphaByte = Math.max(
          0,
          Math.min(
            255,
            Math.round(opacities[index] * brightness * edgeFade * restingOpacity)
          )
        );
        if (!alphaByte) continue;
        const pixelX = Math.round(x * maximumPixelX);
        const verticalOffset = helix
          ? helixOffsets[index]
          : (sides[index] ? 1 : -1) * (restOffsets[index] + heights[index]);
        const pixelY = Math.round(
          (centerY + verticalOffset) * size.ratio
        );
        if (pixelY < 0 || pixelY >= powderSurfaceHeight) continue;
        const offset = ((pixelY * powderSurfaceWidth) + pixelX) * 4;
        const accent = accents[index];
        const pointAlpha = accent ? Math.round(alphaByte * 0.72) : alphaByte;
        const currentAlpha = powderPixels[offset + 3];
        if (!currentAlpha || accent) {
          powderPixels[offset] = accent ? 229 : 255;
          powderPixels[offset + 1] = accent ? 44 : 255;
          powderPixels[offset + 2] = accent ? 49 : 255;
        }
        powderPixels[offset + 3] = Math.min(
          255,
          currentAlpha + Math.round(((255 - currentAlpha) * pointAlpha) / 255)
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
        visualizer_powder_kick_count: powderKickCount,
        visualizer_powder_airborne_count: powderAirborneCount,
        visualizer_powder_max_airborne_count: maximumPowderAirborneCount,
        visualizer_powder_max_rise_px: Math.round(maximumPowderRisePx),
        visualizer_powder_earth_particle_count: POWDER_EARTH_PARTICLE_COUNT,
        visualizer_powder_moon_particle_count: POWDER_MOON_PARTICLE_COUNT,
        visualizer_powder_upper_particle_count: POWDER_PARTICLE_COUNT / 2,
        visualizer_powder_lower_particle_count: POWDER_PARTICLE_COUNT / 2,
        visualizer_powder_helix_particle_count: POWDER_HELIX_PARTICLE_COUNT,
        visualizer_powder_helix_active_count: powderHelixActiveCount,
        visualizer_powder_helix_max_active_count: maximumPowderHelixActiveCount,
        visualizer_powder_helix_max_offset_px: Math.round(maximumPowderHelixOffsetPx),
        visualizer_powder_gravity_milli: Math.round(EARTH_GRAVITY_METERS_PER_SECOND2 * 1000),
        visualizer_powder_moon_gravity_milli: Math.round(MOON_GRAVITY_METERS_PER_SECOND2 * 1000),
        visualizer_powder_max_update_ms: Math.round(maximumPowderUpdateMs),
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
      updatePowderPhysics(
        immediateSpectrum,
        dynamicHeight,
        timestamp,
        reduced,
        !audio.paused && !audio.ended
      );
      const visibleEnvelope = powderContainmentEnvelope.length === spectrumEnvelope.length
        ? powderContainmentEnvelope
        : spectrumEnvelope;
      const envelopePeak = visibleEnvelope.reduce(function (peak, value) {
        return Math.max(peak, Number(value) || 0);
      }, 0);
      maximumAmplitudePx = Math.max(
        maximumAmplitudePx,
        Math.min(maximumHeight, envelopePeak * dynamicHeight)
      );
      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";

      drawingContext.beginPath();
      traceSpectrum(visibleEnvelope, size, centerY, dynamicHeight, -1, false);
      traceSpectrum(visibleEnvelope, size, centerY, dynamicHeight, 1, true, true);
      drawingContext.closePath();
      drawingContext.fillStyle = "rgba(255,255,255,0.055)";
      drawingContext.fill();

      drawPowder(size, centerY);

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
      traceSpectrum(visibleEnvelope, size, centerY, dynamicHeight, -1, false);
      traceSpectrum(visibleEnvelope, size, centerY, dynamicHeight, 1, false);
      drawingContext.stroke();
    }

    function stopAnimation() {
      if (!animationFrame) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function frame(timestamp) {
      animationFrame = 0;
      if (
        !active ||
        document.hidden ||
        prefersReducedMotion() ||
        ((audio.paused || audio.ended) && powderAirborneCount <= 0)
      ) {
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
        ((audio.paused || audio.ended) && powderAirborneCount <= 0) ||
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
        settlePowderParticles();
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
