(function () {
  "use strict";

  function method(ctx, name, fallback) {
    const safeFallback = typeof fallback === "function" ? fallback : function () {};
    return function () {
      const fn = ctx && typeof ctx[name] === "function" ? ctx[name] : null;
      if (fn) return fn.apply(ctx, arguments);
      return safeFallback.apply(null, arguments);
    };
  }

  function createAudioRadio(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL(".", window.location.href) };
    const PREFETCH_NEXT_ENABLED = Boolean(ctx.PREFETCH_NEXT_ENABLED);
    const prefetchApi = ctx.prefetchApi || null;
    const PREFETCH_NEXT_CACHE_NAME = ctx.PREFETCH_NEXT_CACHE_NAME || "infra-next-track";
    const PREFETCH_NEXT_MAX_BYTES = Number.isFinite(Number(ctx.PREFETCH_NEXT_MAX_BYTES)) ? Number(ctx.PREFETCH_NEXT_MAX_BYTES) : 12 * 1024 * 1024;
    const PREFETCH_NEXT_THRESHOLD_SECONDS = Number.isFinite(Number(ctx.PREFETCH_NEXT_THRESHOLD_SECONDS)) ? Number(ctx.PREFETCH_NEXT_THRESHOLD_SECONDS) : 24;
    const SYSTEM_INTERRUPTION_GUARD_MS = 2 * 60 * 1000;
    const SYSTEM_INTERRUPTION_NEAR_END_SECONDS = 2.5;
    const loadTracksData = method(ctx, "loadTracksData", function () { return Promise.resolve({ albums: [] }); });
    const toRuntimeAbsoluteUrl = method(ctx, "toRuntimeAbsoluteUrl", function (value) { return String(value || ""); });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) { return String(value || "").trim(); });
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) { return String(value || "").trim(); });
    const resolveManagedAudioSrc = method(ctx, "resolveManagedAudioSrc", function (value) { return String(value || ""); });
    const getAudioAssetPathKey = method(ctx, "getAudioAssetPathKey", function (value) { return String(value || ""); });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () { return ""; });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent", function () {});
    const srcMatches = method(ctx, "srcMatches", function (left, right) { return String(left || "") === String(right || ""); });
    const getCurrentLogicalAudioSrc = method(ctx, "getCurrentLogicalAudioSrc", function () { return ""; });
    const toAbsoluteUrlOrEmpty = method(ctx, "toAbsoluteUrlOrEmpty", function (value) { return String(value || ""); });
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () { return ""; });
    const normalizeAudioSourceUrl = method(ctx, "normalizeAudioSourceUrl", function (value) { return String(value || ""); });
    const isCloudflareAudioUrl = method(ctx, "isCloudflareAudioUrl", function () { return false; });
    const syncAudioUi = method(ctx, "syncAudioUi", function () {});
    const syncMediaSessionMetadata = method(ctx, "syncMediaSessionMetadata", function () {});
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () { return null; });
    const syncPlaylistContext = method(ctx, "syncPlaylistContext", function () {});
    const buildPreservedTrack = method(ctx, "buildPreservedTrack", function () { return null; });
    const playPrevious = method(ctx, "playPrevious", function () {});
    const playNext = method(ctx, "playNext", function () {});
    const startTrack = method(ctx, "startTrack", function () {});
    const startRadioPlaybackFromIdle = method(ctx, "startRadioPlaybackFromIdle", function () {});
    const getCurrentPlaylistIndexSafe = method(ctx, "getCurrentPlaylistIndexSafe", function () { return -1; });
    const getRandomIndex = method(ctx, "getRandomIndex", function () { return -1; });
    const togglePlayPause = method(ctx, "togglePlayPause", function () {});
    const getCurrentTrackArtwork = method(ctx, "getCurrentTrackArtwork", function () { return ""; });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const getCurrentTrackAlbumPage = method(ctx, "getCurrentTrackAlbumPage", function () { return ""; });
    const toAbsoluteUrl = method(ctx, "toAbsoluteUrl", function (value) { return String(value || ""); });
    const ensureCurrentIndexFromAudio = method(ctx, "ensureCurrentIndexFromAudio", function () { return -1; });
    const revokeActiveBlobUrl = method(ctx, "revokeActiveBlobUrl", function () {});
    const clearFadeTimer = method(ctx, "clearFadeTimer", function () {});
    const clearWaitingRecovery = method(ctx, "clearWaitingRecovery", function () {});
    const readNowPlayingVolumeVisible = method(ctx, "readNowPlayingVolumeVisible", function () { return false; });
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () { return document.body; });
    const bindMediaSessionActions = method(ctx, "bindMediaSessionActions", function () {});
    const ensureGlobalTransportUi = method(ctx, "ensureGlobalTransportUi", function () {});
    const syncTransportUi = method(ctx, "syncTransportUi", function () {});
    const clearTrackFailureForCurrent = method(ctx, "clearTrackFailureForCurrent", function () {});
    const clearTrackStatus = method(ctx, "clearTrackStatus", function () {});
    const getTrackByIndex = method(ctx, "getTrackByIndex", function () { return null; });
    const startAudioTelemetryHeartbeat = method(ctx, "startAudioTelemetryHeartbeat", function () {});
    const stopAudioTelemetryHeartbeat = method(ctx, "stopAudioTelemetryHeartbeat", function () {});
    const markAudioTelemetryInactive = method(ctx, "markAudioTelemetryInactive", function () {});
    const buildAudioMonitorPayload = method(ctx, "buildAudioMonitorPayload", function () { return {}; });
    const getAudioBufferedEnd = method(ctx, "getAudioBufferedEnd", function () { return 0; });
    const scheduleDeferredServiceWorkerReload = method(ctx, "scheduleDeferredServiceWorkerReload", function () {});
    const syncCurrentTrackDurationFromAudio = method(ctx, "syncCurrentTrackDurationFromAudio", function () {});
    const logAudioAuditEvent = method(ctx, "logAudioAuditEvent", function () {});
    const setTrackStatus = method(ctx, "setTrackStatus", function () {});
    const scheduleWaitingRecovery = method(ctx, "scheduleWaitingRecovery", function () {});
    const getAudioRuntimeProbeState = method(ctx, "getAudioRuntimeProbeState", function () { return {}; });
    const confirmAudioRecovery = method(ctx, "confirmAudioRecovery", function () {});
    const sendAudioMonitoringLog = method(ctx, "sendAudioMonitoringLog", function () {});
    const recoverFromTrackFailure = method(ctx, "recoverFromTrackFailure", function () {});
    const updateProgressUi = method(ctx, "updateProgressUi", function () {});
    const isBlobObjectUrl = method(ctx, "isBlobObjectUrl", function () { return false; });
    const extendAlbumPlaylistToNextAlbum = method(ctx, "extendAlbumPlaylistToNextAlbum", function () { return -1; });

  function resyncMediaSessionControls() {
    bindMediaSessionActions({ force: true, quiet: true });
    syncMediaSessionMetadata({ forcePosition: true });
  }

  function markAudioPauseIntent(reason, surface) {
    audioState.audioPauseIntent = {
      reason: String(reason || "internal"),
      surface: String(surface || ""),
      at: Date.now()
    };
  }

  function consumeAudioPauseIntent() {
    const intent = audioState.audioPauseIntent;
    audioState.audioPauseIntent = null;
    if (!intent || !Number.isFinite(intent.at) || Date.now() - intent.at > 1500) {
      return { reason: "system_suspected", surface: "", age_ms: null };
    }
    return {
      reason: intent.reason || "internal",
      surface: intent.surface || "",
      age_ms: Math.max(0, Date.now() - intent.at)
    };
  }

  function clearExternalResumeProbeTimers() {
    const timers = Array.isArray(audioState.externalResumeProbeTimers)
      ? audioState.externalResumeProbeTimers
      : [];
    timers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    audioState.externalResumeProbeTimers = [];
  }

  function cancelExternalResumeCommand() {
    clearExternalResumeProbeTimers();
    audioState.externalPlaybackCommand = null;
    audioState.externalResumeRecoveryInFlight = false;
  }

  function getAudioRemainingSeconds(audio) {
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(audio.currentTime)) return null;
    return Math.max(0, audio.duration - audio.currentTime);
  }

  function getCurrentAudioResumeKey(audio) {
    return String(audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || "");
  }

  function classifyAudioPause(audio, pauseIntent) {
    const reason = pauseIntent && pauseIntent.reason ? pauseIntent.reason : "system_suspected";
    const remaining = getAudioRemainingSeconds(audio);
    const nearEnd = audio && (
      audio.ended ||
      (Number.isFinite(remaining) && remaining <= SYSTEM_INTERRUPTION_NEAR_END_SECONDS)
    );
    if (nearEnd) return "ended";
    if (reason === "ui" || reason === "media_session") return "explicit";
    if (reason === "source_reset" || reason === "source_switch" || reason === "external_resume_recovery") return "internal";
    if (reason === "system_suspected" && document.visibilityState === "hidden") return "system_midtrack";
    if (reason === "system_suspected") return "system_suspected";
    return reason;
  }

  function clearSystemInterruptionGuard() {
    audioState.systemInterruptionGuard = null;
  }

  function rememberSystemInterruption(audio, pauseContext) {
    if (pauseContext !== "system_midtrack") return;
    audioState.systemInterruptionGuard = {
      at: Date.now(),
      src: getCurrentAudioResumeKey(audio),
      currentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    };
    audioState.resumeOnVisible = false;
  }

  function hasFreshExternalPlaybackCommand() {
    const command = audioState.externalPlaybackCommand;
    return Boolean(command && Number.isFinite(command.at) && Date.now() - command.at < 5000);
  }

  function shouldBlockHiddenSystemAutoResume(audio) {
    const guard = audioState.systemInterruptionGuard;
    if (!guard || !Number.isFinite(guard.at)) return false;
    if (Date.now() - guard.at > SYSTEM_INTERRUPTION_GUARD_MS) {
      clearSystemInterruptionGuard();
      return false;
    }
    if (!audio || audio.paused || document.visibilityState !== "hidden") return false;
    if (audioState.trackStartInFlight || hasFreshExternalPlaybackCommand()) return false;
    const currentSrc = getCurrentAudioResumeKey(audio);
    if (guard.src && currentSrc && !srcMatches(guard.src, currentSrc)) {
      clearSystemInterruptionGuard();
      return false;
    }
    return true;
  }

  function recoverStuckExternalResume(audio, commandId, surface, startTime) {
    const command = audioState.externalPlaybackCommand;
    if (
      !audio ||
      !command ||
      command.id !== commandId ||
      audio.paused ||
      audioState.externalResumeRecoveryInFlight
    ) {
      return;
    }

    audioState.externalResumeRecoveryInFlight = true;
    const recoveryStartedAt = Date.now();
    const recoveryStartTime = Number.isFinite(audio.currentTime) ? audio.currentTime : startTime;
    const payload = Object.assign(
      buildAudioMonitorPayload(
        getCurrentPlaylistTrack(),
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src
      ),
      getAudioRuntimeProbeState(),
      {
        command_id: commandId,
        surface: surface || "",
        advanced_ms: Math.max(0, Math.round((recoveryStartTime - startTime) * 1000))
      }
    );
    trackAudioRuntimeEvent("external_resume_stuck", payload);
    trackAudioRuntimeEvent("external_resume_recovery_start", payload);

    markAudioPauseIntent("external_resume_recovery", surface || "media_session");
    try {
      audio.pause();
    } catch (_err) {
      // Continue with the single guarded play attempt.
    }

    Promise.resolve().then(function () {
      return audio.play();
    }).then(function () {
      const timer = window.setTimeout(function () {
        const activeCommand = audioState.externalPlaybackCommand;
        if (!activeCommand || activeCommand.id !== commandId) return;
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : recoveryStartTime;
        const advanced = Math.max(0, currentTime - recoveryStartTime);
        const recovered = Boolean(!audio.paused && advanced >= 0.2);
        trackAudioRuntimeEvent(
          recovered ? "external_resume_recovery_resolved" : "external_resume_recovery_failed",
          Object.assign(
            buildAudioMonitorPayload(
              getCurrentPlaylistTrack(),
              audioState.currentIndex,
              audioState.activeLogicalSrc || audio.currentSrc || audio.src
            ),
            getAudioRuntimeProbeState(),
            {
              command_id: commandId,
              surface: surface || "",
              advanced_ms: Math.round(advanced * 1000),
              recovery_ms: Date.now() - recoveryStartedAt,
              paused: Boolean(audio.paused)
            }
          )
        );
        audioState.externalResumeRecoveryInFlight = false;
      }, 900);
      audioState.externalResumeProbeTimers.push(timer);
    }).catch(function (err) {
      if (!audioState.externalPlaybackCommand || audioState.externalPlaybackCommand.id !== commandId) return;
      trackAudioRuntimeEvent("external_resume_recovery_failed", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          command_id: commandId,
          surface: surface || "",
          recovery_ms: Date.now() - recoveryStartedAt,
          paused: Boolean(audio.paused),
          error_name: err && err.name ? err.name : "Error",
          error_message: err && err.message ? err.message : "external_resume_recovery_rejected"
        }
      ));
      audioState.externalResumeRecoveryInFlight = false;
    });
  }

  function scheduleExternalResumeProbes(audio, commandId, surface, startTime) {
    [600, 1500, 3000].forEach(function (delayMs) {
      const timer = window.setTimeout(function () {
        const command = audioState.externalPlaybackCommand;
        if (!command || command.id !== commandId) return;
        if (!audio || !getCurrentPlayableAudioSrc(audio)) return;
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const advanced = Math.max(0, currentTime - startTime);
        trackAudioRuntimeEvent("resume_probe", Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState(),
          {
            command_id: commandId,
            surface: surface || "",
            delay_ms: delayMs,
            advanced_ms: Math.round(advanced * 1000),
            confirmed: Boolean(!audio.paused && advanced >= (delayMs >= 3000 ? 1 : 0.2)),
            paused: Boolean(audio.paused)
          }
        ));
        if (delayMs === 1500 && !audio.paused && advanced < 0.35) {
          recoverStuckExternalResume(audio, commandId, surface, startTime);
        }
      }, delayMs);
      audioState.externalResumeProbeTimers.push(timer);
    });
  }

  function readHomePlayMode() {
    return "album";
  }



  function persistHomePlayMode(mode) {
    const safeMode = mode === "radio" ? "radio" : "album";
    try {
      localStorage.setItem(audioState.homeModeStorageKey, safeMode);
    } catch (_err) {
      // Ignore storage errors.
    }
  }







  function findPlaylistIndexByCurrentSrc(list) {
    const currentSrc = getCurrentLogicalAudioSrc();
    if (!currentSrc || !Array.isArray(list) || !list.length) return -1;
    return list.findIndex((track) => srcMatches(track.src, currentSrc));
  }



  function buildRadioPlaylist(tracksData) {
      const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
      const playlist = [];
      const seen = new Set();
      albums.forEach((album) => {
        const albumTracks = Array.isArray(album && album.tracks) ? album.tracks : [];
        const page = album && album.page ? toRuntimeAbsoluteUrl(album.page) : "";
        const artwork = album && album.cover ? toRuntimeAbsoluteUrl(album.cover) : "";
        const title = normalizeAlbumTitle(album && album.title ? album.title : "");
        albumTracks.forEach((track) => {
          if (!track || !track.src) return;
          const src = resolveManagedAudioSrc(track.src, runtime.baseUrl.href);
          if (!src || seen.has(src)) return;
          seen.add(src);
          playlist.push(track);
          playlist[playlist.length - 1] = {
            src,
            name: normalizeTrackTitle(track.title || track.name || "") || `Track ${playlist.length}`,
            album: title,
            page,
            artist: "INFRA.",
            artwork
          };
        });
      });

      return playlist;
  }



  function primeRadioPlaylistFromLoadedTracks() {
    if (audioState.radioPlaylist.length) return audioState.radioPlaylist.slice();
    if (!audioState.tracksData || !Array.isArray(audioState.tracksData.albums)) return [];
    audioState.radioPlaylist = buildRadioPlaylist(audioState.tracksData);
    return audioState.radioPlaylist.slice();
  }



  async function ensureRadioPlaylistLoaded() {
    const primed = primeRadioPlaylistFromLoadedTracks();
    if (primed.length) return primed;
    if (audioState.radioLoadingPromise) return audioState.radioLoadingPromise;

    audioState.radioLoadingPromise = (async function () {
      const tracksData = await loadTracksData();
      const playlist = buildRadioPlaylist(tracksData);

      audioState.radioPlaylist = playlist;
      return playlist.slice();
    })().finally(function () {
      audioState.radioLoadingPromise = null;
    });

    return audioState.radioLoadingPromise;
  }



  function getTrackSource(track) {
    return toAbsoluteUrlOrEmpty(track && track.src ? track.src : "");
  }



  function getRecentPlayedSrcSet() {
    const recentSrcs = new Set();
    const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    audioState.recentPlayed.forEach(function (index) {
      if (!Number.isInteger(index) || index < 0 || index >= list.length) return;
      const src = getTrackSource(list[index]);
      if (src) recentSrcs.add(src);
    });
    return recentSrcs;
  }



  function shuffledCopy(list) {
    const copy = Array.isArray(list) ? list.slice() : [];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temp;
    }
    return copy;
  }



  function buildRadioQueue(sourceList, count, avoidSrc) {
    const targetCount = Math.max(0, Number(count) || 0);
    if (!Array.isArray(sourceList) || !sourceList.length || !targetCount) return [];

    const avoid = toAbsoluteUrlOrEmpty(avoidSrc || "");
    const recentSrcs = getRecentPlayedSrcSet();
    const seen = new Set();
    const cleanList = [];

    sourceList.forEach(function (track) {
      const src = getTrackSource(track);
      if (!src || seen.has(src)) return;
      seen.add(src);
      cleanList.push(track);
    });

    const primary = cleanList.filter(function (track) {
      const src = getTrackSource(track);
      if (avoid && srcMatches(src, avoid)) return false;
      return !recentSrcs.has(src);
    });
    const fallback = cleanList.filter(function (track) {
      const src = getTrackSource(track);
      return !(avoid && srcMatches(src, avoid));
    });
    const pool = primary.length ? primary : fallback;

    return shuffledCopy(pool).slice(0, Math.min(targetCount, pool.length));
  }



  function buildGlobalCatalogPlaylist(tracksData) {
    const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
    const seen = new Set();
    const playlist = [];

    albums.forEach(function (album) {
      const tracks = Array.isArray(album && album.tracks) ? album.tracks : [];
      const albumTitle = normalizeAlbumTitle(album && album.title ? album.title : "");
      const albumPage = album && album.page ? toRuntimeAbsoluteUrl(album.page) : "";
      const albumArtwork = album && album.cover ? toRuntimeAbsoluteUrl(album.cover) : "";

      tracks.forEach(function (track) {
        if (!track || !track.src) return;
        const src = resolveManagedAudioSrc(track.src, runtime.baseUrl.href);
        const key = getAudioAssetPathKey(src, runtime.baseUrl);
        if (!src || !key || seen.has(key)) return;
        seen.add(key);
        playlist.push({
          src,
          name: normalizeTrackTitle(track.title || track.name || ""),
          album: albumTitle,
          page: albumPage,
          artist: "INFRA.",
          artwork: albumArtwork,
          duration: String(track.duration || "").trim() || formatTrackDuration(track.seconds),
          seconds: Number(track.seconds)
        });
      });
    });

    return playlist;
  }



  function buildGlobalRandomPlaylistWithTelemetry(tracksData, reason) {
    const startedAt = Date.now();
    trackAudioRuntimeEvent("global_playlist_build_start", {
      track: "global-random",
      album: "global",
      reason: reason || "unknown"
    });
    const playlist = shuffledCopy(buildGlobalCatalogPlaylist(tracksData));
    trackAudioRuntimeEvent("global_playlist_build_done", {
      track: "global-random",
      album: "global",
      reason: reason || "unknown",
      tracks_count: playlist.length,
      ms: Date.now() - startedAt
    });
    return playlist;
  }



  function setGlobalCatalogPlaylist(list) {
    const clean = Array.isArray(list)
      ? list.filter(function (track) { return track && track.src; })
      : [];
    if (!clean.length) return false;
    audioState.homeMode = "album";
    audioState.playlistKind = "global";
    audioState.shuffleOn = false;
    clearRadioQueue();
    persistHomePlayMode("album");
    audioState.playlist = clean.slice();
    audioState.currentIndex = 0;
    audioState.albumPlaylistSnapshot = [];
    audioState.albumIndexSnapshot = -1;
    syncPlaylistContext(audioState.playlist);
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
    return true;
  }




  function startGlobalRandomPlayback() {
    if (audioState.globalRandomStartInFlight) return;
    trackAudioRuntimeEvent("initial_random_tap", {
      track: "global-random",
      album: "global",
      prepared: Boolean(audioState.initialRandomReady && audioState.initialRandomPlaylist.length),
      prefetch_src: audioState.initialRandomFirstSrc || "",
      prefetch_done: Boolean(audioState.nextPrefetchDoneSrc && srcMatches(audioState.nextPrefetchDoneSrc, audioState.initialRandomFirstSrc || ""))
    });
    audioState.globalRandomStartInFlight = true;
    syncAudioUi();
    ensureGlobalAudio();
    const preparedPlaylist = consumePreparedInitialGlobalRandomPlaylist();
    if (!preparedPlaylist && audioState.tracksData && Array.isArray(audioState.tracksData.albums)) {
      const playlist = buildGlobalRandomPlaylistWithTelemetry(audioState.tracksData, "tap_memory");
      if (setGlobalCatalogPlaylist(playlist)) {
        resetPreparedInitialGlobalRandomPlayback();
        startTrack(0, { seamless: true, initialRandom: true });
        audioState.globalRandomStartInFlight = false;
        syncAudioUi();
        return;
      }
    }
    const buildOnTap = function () {
      return loadTracksData().then(function (tracksData) {
        return buildGlobalRandomPlaylistWithTelemetry(tracksData, "tap");
      });
    };
    const playlistReady = preparedPlaylist
      ? Promise.resolve(preparedPlaylist)
      : (audioState.initialRandomPreparePromise
        ? audioState.initialRandomPreparePromise.then(function (playlist) {
          return playlist && playlist.length ? playlist : buildOnTap();
        })
        : buildOnTap());

    playlistReady
      .then(function (playlist) {
        if (!setGlobalCatalogPlaylist(playlist)) return;
        startTrack(0, { seamless: true, initialRandom: true });
      })
      .catch(function () {
        syncAudioUi();
      })
      .finally(function () {
        audioState.globalRandomStartInFlight = false;
        syncAudioUi();
      });
  }



  function resetPreparedInitialGlobalRandomPlayback(options) {
    const opts = options || {};
    audioState.initialRandomPlaylist = [];
    audioState.initialRandomFirstSrc = "";
    audioState.initialRandomReady = false;
    audioState.initialRandomPreparing = false;
    audioState.initialRandomPreparePromise = null;
    if (!opts.keepToken) audioState.initialRandomPrepareToken += 1;
  }



  function consumePreparedInitialGlobalRandomPlaylist() {
    if (!audioState.initialRandomReady || !audioState.initialRandomPlaylist.length) return null;
    const playlist = audioState.initialRandomPlaylist.slice();
    resetPreparedInitialGlobalRandomPlayback({ keepToken: true });
    return playlist;
  }



  function shouldPrepareInitialGlobalRandomPlayback() {
    return Boolean(
      PREFETCH_NEXT_ENABLED &&
      document.body.classList.contains("home-screen") &&
      audioState.homeMode !== "radio" &&
      !audioState.globalRandomStartInFlight &&
      !hasPlaybackSession()
    );
  }



  function prepareInitialGlobalRandomPlayback(reason) {
    if (!PREFETCH_NEXT_ENABLED) return Promise.resolve(null);
    if (audioState.initialRandomReady && audioState.initialRandomPlaylist.length) {
      return Promise.resolve(audioState.initialRandomPlaylist.slice());
    }
    if (audioState.initialRandomPreparePromise) return audioState.initialRandomPreparePromise;
    if (!shouldPrepareInitialGlobalRandomPlayback()) return Promise.resolve(null);

    const token = ++audioState.initialRandomPrepareToken;
    audioState.initialRandomPreparing = true;
    audioState.initialRandomPreparePromise = loadTracksData()
      .then(function (tracksData) {
        if (token !== audioState.initialRandomPrepareToken) return null;
        if (!shouldPrepareInitialGlobalRandomPlayback()) return null;
        const playlist = buildGlobalRandomPlaylistWithTelemetry(tracksData, reason || "idle");
        if (!playlist.length) return null;
        audioState.initialRandomPlaylist = playlist.slice();
        audioState.initialRandomFirstSrc = normalizeAudioSourceUrl(playlist[0] && playlist[0].src ? playlist[0].src : "");
        audioState.initialRandomReady = true;

        if (
          reason !== "home_boot" &&
          audioState.initialRandomFirstSrc &&
          isCloudflareAudioUrl(audioState.initialRandomFirstSrc)
        ) {
          startNextTrackPrefetch(0, playlist[0], audioState.initialRandomFirstSrc, reason || "initial_idle");
        }
        syncAudioUi();
        return playlist.slice();
      })
      .catch(function () {
        resetPreparedInitialGlobalRandomPlayback();
        return null;
      })
      .finally(function () {
        if (token === audioState.initialRandomPrepareToken) {
          audioState.initialRandomPreparing = false;
          audioState.initialRandomPreparePromise = null;
        }
      });

    return audioState.initialRandomPreparePromise;
  }



  function scheduleInitialGlobalRandomPreparation(reason) {
    if (!PREFETCH_NEXT_ENABLED) return;
    const run = function () {
      prepareInitialGlobalRandomPlayback("home_boot");
    };
    window.setTimeout(run, 0);
  }



  function hasPlaybackSession() {
    const audio = audioState.audio;
    const hasTrack = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasPlaylist = audioState.playlist && audioState.playlist.length > 0;
    return Boolean(
      hasTrack ||
      audioState.activeLogicalSrc ||
      (
        hasPlaylist &&
        Number.isInteger(audioState.currentIndex) &&
        audioState.currentIndex >= 0 &&
        audioState.currentIndex < audioState.playlist.length
      )
    );
  }



  function canStartInitialGlobalRandomPlayback() {
    const audio = audioState.audio;
    return Boolean(
      document.body.classList.contains("home-screen") &&
      audioState.homeMode !== "radio" &&
      !audioState.globalRandomStartInFlight &&
      !hasPlaybackSession() &&
      !(audio && getCurrentPlayableAudioSrc(audio))
    );
  }



  function bindGlobalKeyboardShortcuts() {
    if (audioState.keyboardBound) return;
    document.addEventListener("keydown", function (event) {
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (event.target && event.target.isContentEditable);

      if (isTyping) return;

      const isDesktopKeyboard =
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
        window.matchMedia("(min-width: 900px)").matches;
      const hasQueue = Boolean(audioState.playlist && audioState.playlist.length > 1);
      const canTogglePlayback = Boolean(
        audioState.audio &&
        (
          canStartInitialGlobalRandomPlayback() ||
          hasPlaybackSession() ||
          (audioState.playlist && audioState.playlist.length) ||
          (document.body.classList.contains("home-screen") && audioState.homeMode === "radio")
        )
      );

      if ((event.key === "F7" || event.key === "F9") && audioState.playlist.length) {
        event.preventDefault();
        playNext();
        return;
      }

      if (isDesktopKeyboard && event.key === " ") {
        if (!canTogglePlayback) return;
        event.preventDefault();
        togglePlayPause();
        return;
      }

      if (isDesktopKeyboard && event.key === "ArrowRight") {
        if (!hasQueue) return;
        event.preventDefault();
        playNext();
        return;
      }

      if (isDesktopKeyboard && event.key === "ArrowLeft") {
        if (!hasQueue) return;
        event.preventDefault();
        playPrevious();
        return;
      }

      if (!document.body.classList.contains("album-screen")) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        playNext();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        playPrevious();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleAlbumShuffleMode();
      }
    });

    audioState.keyboardBound = true;
  }



  function clearRadioQueue() {
    audioState.radioQueue = [];
    audioState.radioQueueCursor = -1;
  }



  function syncRadioQueueToPlaylist(options) {
    const opts = options || {};
    audioState.radioQueue = Array.isArray(audioState.radioQueue)
      ? audioState.radioQueue.filter(function (track) { return track && track.src; })
      : [];
    audioState.playlistKind = "radio";
    audioState.playlist = audioState.radioQueue;

    if (!audioState.radioQueue.length) {
      audioState.radioQueueCursor = -1;
      audioState.currentIndex = -1;
    } else {
      if (!Number.isInteger(audioState.radioQueueCursor)) audioState.radioQueueCursor = -1;
      if (audioState.radioQueueCursor >= audioState.radioQueue.length) {
        audioState.radioQueueCursor = audioState.radioQueue.length - 1;
      }
      if (audioState.radioQueueCursor >= 0) {
        audioState.currentIndex = audioState.radioQueueCursor;
      }
    }

    syncPlaylistContext(audioState.playlist, { preserveRecent: Boolean(opts.preserveRecent) });
  }



  function ensureRadioQueue(minRemaining) {
    const sourceList = Array.isArray(audioState.radioPlaylist) ? audioState.radioPlaylist : [];
    if (!sourceList.length) return false;

    if (!Array.isArray(audioState.radioQueue)) audioState.radioQueue = [];
    if (!Number.isInteger(audioState.radioQueueCursor)) audioState.radioQueueCursor = -1;
    if (audioState.radioQueueCursor < -1) audioState.radioQueueCursor = -1;

    const min = Math.max(0, Number(minRemaining) || audioState.radioQueueMinRemaining);
    const remaining = audioState.radioQueue.length - audioState.radioQueueCursor - 1;
    if (audioState.radioQueue.length && remaining >= min) {
      syncRadioQueueToPlaylist({ preserveRecent: true });
      return true;
    }

    const currentTrack = audioState.radioQueue[audioState.radioQueueCursor] || getCurrentPlaylistTrack();
    const avoidSrc = getCurrentLogicalAudioSrc() || getTrackSource(currentTrack);
    const count = audioState.radioQueue.length
      ? Math.max(audioState.radioQueueExtendBy, min - Math.max(0, remaining))
      : audioState.radioQueueBatchSize;
    const extension = buildRadioQueue(sourceList, count, avoidSrc);

    if (!extension.length && !audioState.radioQueue.length) return false;
    if (extension.length) {
      audioState.radioQueue = audioState.radioQueue.concat(extension);
    }
    syncRadioQueueToPlaylist({ preserveRecent: audioState.radioQueue.length > extension.length });
    return true;
  }



  function injectCurrentTrackIntoRadioQueue(track) {
    const preservedTrack = buildPreservedTrack(track, track && track.src ? track.src : getCurrentLogicalAudioSrc());
    if (!preservedTrack) return -1;

    if (!Array.isArray(audioState.radioQueue) || !audioState.radioQueue.length) {
      ensureRadioQueue(audioState.radioQueueMinRemaining);
    }

    let cursor = Number.isInteger(audioState.radioQueueCursor) && audioState.radioQueueCursor >= 0
      ? audioState.radioQueueCursor
      : 0;
    let queue = Array.isArray(audioState.radioQueue) ? audioState.radioQueue.slice() : [];
    queue = queue.filter(function (entry, index) {
      return index === cursor || !srcMatches(entry && entry.src, preservedTrack.src);
    });

    if (cursor > queue.length) cursor = queue.length;
    if (queue.length && cursor < queue.length) {
      queue.splice(cursor, 1, preservedTrack);
    } else {
      queue.splice(cursor, 0, preservedTrack);
    }

    audioState.radioQueue = queue;
    audioState.radioQueueCursor = cursor;
    syncRadioQueueToPlaylist({ preserveRecent: true });
    ensureRadioQueue(audioState.radioQueueMinRemaining);
    return audioState.radioQueueCursor;
  }



  function ensureRadioPlaylistForNavigation(direction, options) {
    if (audioState.homeMode !== "radio") return true;

    const opts = options || {};
    const loaded = Array.isArray(audioState.radioPlaylist) && audioState.radioPlaylist.length > 0;
    console.info(
      "[INFRA] ensureRadioPlaylistForNavigation",
      direction === "previous" ? "previous" : "next",
      `radio loaded=${loaded ? "true" : "false"}`,
      `playlistSize=${loaded ? audioState.radioPlaylist.length : 0}`
    );
    if (Array.isArray(audioState.radioPlaylist) && audioState.radioPlaylist.length) {
      return ensureRadioQueue(audioState.radioQueueMinRemaining);
    }

    if (opts.radioNavigationRetry) return false;
    if (audioState.radioNavigationPromise) return false;

    const replayDirection = direction === "previous" ? "previous" : "next";
    const replayOptions = Object.assign({}, opts, { radioNavigationRetry: true });

    audioState.radioNavigationPromise = ensureRadioPlaylistLoaded()
      .then(function (radioList) {
        if (audioState.homeMode !== "radio") return;
        if (!Array.isArray(radioList) || !radioList.length) return;
        if (!ensureRadioQueue(audioState.radioQueueMinRemaining)) return;
        if (replayDirection === "previous") {
          playPrevious(replayOptions);
        } else {
          playNext(replayOptions);
        }
      })
      .catch(function () {
        // Keep current playback if the global radio playlist cannot load.
      })
      .finally(function () {
        audioState.radioNavigationPromise = null;
      });

    return false;
  }



  function setHomePlayMode(mode, options) {
    const nextMode = mode === "radio" ? "radio" : "album";
    const opts = options || {};
    const prevMode = audioState.homeMode || "album";
    const currentTrack = getCurrentPlaylistTrack();
    const currentAudioSrc = getCurrentLogicalAudioSrc();
    const preservedTrack = buildPreservedTrack(currentTrack, currentAudioSrc);

    if (nextMode === prevMode && !opts.force) {
      syncAudioUi();
      return;
    }

    audioState.homeMode = nextMode;
    persistHomePlayMode(nextMode);
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });

    if (nextMode === "radio") {
      if (audioState.playlist.length && prevMode !== "radio") {
        audioState.albumPlaylistSnapshot = audioState.playlist.slice();
        audioState.albumIndexSnapshot = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
      }
      ensureRadioPlaylistLoaded()
        .then(function (radioList) {
          if (audioState.homeMode !== "radio") return;
          if (!radioList.length) {
            savePlaybackQueueContext();
            syncMediaSessionMetadata({ forcePosition: true });
            syncAudioUi();
            return;
          }

          const currentMatch = currentAudioSrc
            ? radioList.findIndex((track) => track && srcMatches(track.src, currentAudioSrc))
            : -1;
          clearRadioQueue();
          if (currentMatch >= 0) {
            injectCurrentTrackIntoRadioQueue(radioList[currentMatch]);
          } else if (preservedTrack) {
            injectCurrentTrackIntoRadioQueue(preservedTrack);
          } else if (ensureRadioQueue(audioState.radioQueueMinRemaining)) {
            if (audioState.radioQueueCursor < 0 && audioState.radioQueue.length) {
              audioState.radioQueueCursor = 0;
              syncRadioQueueToPlaylist({ preserveRecent: true });
            }
          }
          savePlaybackQueueContext();
          syncMediaSessionMetadata({ forcePosition: true });
          syncAudioUi();
        })
        .catch(function () {
          savePlaybackQueueContext();
          syncMediaSessionMetadata({ forcePosition: true });
          syncAudioUi();
        });
    } else {
      clearRadioQueue();
      if (audioState.playlistKind === "global" && prevMode !== "radio") {
        audioState.homeMode = "album";
        persistHomePlayMode("album");
        savePlaybackQueueContext();
        syncMediaSessionMetadata({ forcePosition: true });
        syncAudioUi();
        return;
      }
      audioState.playlistKind = "album";
      const radioAlbumPlaylist = prevMode === "radio"
        ? buildAlbumPlaylistFromRadioCache(currentTrack || preservedTrack)
        : [];
      if (radioAlbumPlaylist.length) {
        audioState.playlist = radioAlbumPlaylist.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch = currentTrack && currentTrack.src
          ? audioState.playlist.findIndex((track) => srcMatches(track.src, currentTrack.src))
          : findPlaylistIndexByCurrentSrc(audioState.playlist);
        audioState.currentIndex = currentMatch >= 0 ? currentMatch : 0;
        audioState.albumPlaylistSnapshot = audioState.playlist.slice();
        audioState.albumIndexSnapshot = audioState.currentIndex;
        savePlaybackQueueContext();
        syncMediaSessionMetadata({ forcePosition: true });
        syncAudioUi();
        return;
      }
      const snapshot = Array.isArray(audioState.albumPlaylistSnapshot)
        ? audioState.albumPlaylistSnapshot.filter((track) => track && track.src)
        : [];
      const uiPlaylist = audioState.ui && Array.isArray(audioState.ui.playlist)
        ? audioState.ui.playlist.filter((track) => track && track.src)
        : [];

      if (snapshot.length) {
        audioState.playlist = snapshot.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch = currentTrack && currentTrack.src
          ? audioState.playlist.findIndex((track) => srcMatches(track.src, currentTrack.src))
          : -1;
        if (currentMatch >= 0) {
          audioState.currentIndex = currentMatch;
        } else if (preservedTrack) {
          audioState.playlist = [preservedTrack].concat(
            audioState.playlist.filter(function (track) {
              return track && track.src && !srcMatches(track.src, preservedTrack.src);
            })
          );
          audioState.currentIndex = 0;
          syncPlaylistContext(audioState.playlist);
        } else if (
          Number.isInteger(audioState.albumIndexSnapshot) &&
          audioState.albumIndexSnapshot >= 0 &&
          audioState.albumIndexSnapshot < audioState.playlist.length
        ) {
          audioState.currentIndex = audioState.albumIndexSnapshot;
        } else {
          audioState.currentIndex = Math.min(
            Math.max(0, Number(audioState.currentIndex) || 0),
            audioState.playlist.length - 1
          );
        }
      } else if (uiPlaylist.length) {
        audioState.playlist = uiPlaylist.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch = currentTrack && currentTrack.src
          ? audioState.playlist.findIndex((track) => srcMatches(track.src, currentTrack.src))
          : -1;
        if (currentMatch >= 0) {
          audioState.currentIndex = currentMatch;
        } else if (preservedTrack) {
          audioState.playlist = [preservedTrack].concat(
            audioState.playlist.filter(function (track) {
              return track && track.src && !srcMatches(track.src, preservedTrack.src);
            })
          );
          audioState.currentIndex = 0;
          syncPlaylistContext(audioState.playlist);
        } else {
          audioState.currentIndex = Math.min(
            Math.max(0, Number(audioState.currentIndex) || 0),
            audioState.playlist.length - 1
          );
        }
      } else if (preservedTrack) {
        audioState.playlist = [preservedTrack];
        audioState.currentIndex = 0;
        syncPlaylistContext(audioState.playlist);
      } else {
        audioState.playlist = [];
        audioState.currentIndex = -1;
        syncPlaylistContext(audioState.playlist);
      }
      savePlaybackQueueContext();
      syncMediaSessionMetadata({ forcePosition: true });
      syncAudioUi();
    }

    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
  }



  function activateRadioModeFromTransport() {
    const audio = audioState.audio;
    const currentSrc = getCurrentLogicalAudioSrc();
    const hasCurrentTrack = Boolean(currentSrc);
    const wasPlaying = Boolean(audio && !audio.paused);
    const currentTrack = getCurrentPlaylistTrack();
    const preservedTrack = buildPreservedTrack(currentTrack, currentSrc);

    setHomePlayMode("radio", { force: true });
    ensureRadioPlaylistLoaded()
      .then(function (radioList) {
        if (!Array.isArray(radioList) || !radioList.length) {
          syncAudioUi();
          return;
        }

        const matchIndex = hasCurrentTrack
          ? radioList.findIndex((track) => track && srcMatches(track.src, currentSrc))
          : -1;
        if (matchIndex >= 0) {
          injectCurrentTrackIntoRadioQueue(radioList[matchIndex]);
          // Keep current song uninterrupted.
          syncAudioUi();
          return;
        }

        if (hasCurrentTrack) {
          if (preservedTrack) {
            injectCurrentTrackIntoRadioQueue(preservedTrack);
          }
          // Preserve current playback even if track is outside radio catalog.
          syncAudioUi();
          return;
        }

        clearRadioQueue();
        if (!ensureRadioQueue(audioState.radioQueueMinRemaining) || !audioState.radioQueue.length) {
          syncAudioUi();
          return;
        }
        audioState.radioQueueCursor = 0;
        syncRadioQueueToPlaylist({ preserveRecent: true });
        if (wasPlaying) {
          startTrack(0, { seamless: true });
          return;
        }
        audioState.currentIndex = 0;
        syncAudioUi();
      })
      .catch(function () {
        syncAudioUi();
      });
  }



  function toggleRadioModeFromTransport() {
    if (audioState.homeMode === "radio") {
      setHomePlayMode("album", { force: true });
      return;
    }
    activateRadioModeFromTransport();
  }



  function toggleAlbumShuffleMode() {
    audioState.shuffleOn = !audioState.shuffleOn;
    clearNextTrackPrefetch("shuffle_mode_change");
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
  }



  function clearStoredPlaybackState() {
    try {
      sessionStorage.removeItem(audioState.queueStorageKey);
      sessionStorage.removeItem(audioState.resumeStorageKey);
    } catch (_err) {
      // Ignore storage errors.
    }
  }



  function cleanupIdleAudioContext(options) {
    const opts = options || {};
    const audio = audioState.audio;
    if (audio && !audio.paused && getCurrentPlayableAudioSrc(audio)) return false;

    if (audio) {
      try {
        audio.pause();
      } catch (_err) {
        // Ignore pause failures during idle cleanup.
      }
      try {
        audio.removeAttribute("src");
        audio.load();
      } catch (_err) {
        // Ignore reset failures during idle cleanup.
      }
    }

    revokeActiveBlobUrl();
    clearFadeTimer();
    clearWaitingRecovery();
    audioState.activeLogicalSrc = "";
    audioState.pendingSeekRatio = null;
    audioState.pendingStartTime = null;
    audioState.trackStartInFlight = false;
    audioState.startRequestToken += 1;
    if (!opts.preserveMode || audioState.homeMode !== "radio") {
      audioState.homeMode = "album";
    }
    audioState.shuffleOn = false;
    audioState.playlistKind = "album";
    audioState.playlist = [];
    audioState.currentIndex = -1;
    clearRadioQueue();
    audioState.albumPlaylistSnapshot = [];
    audioState.albumIndexSnapshot = -1;
    syncPlaylistContext(audioState.playlist);
    clearStoredPlaybackState();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
    return true;
  }



  function resetHomePlaybackModeIfIdle(options) {
    return cleanupIdleAudioContext(Object.assign({ preserveMode: true }, options || {}));
  }



  function cleanupForeignAlbumAudioWhenIdle(ui) {
    const audio = audioState.audio;
    if (!audio || !ui || !Array.isArray(ui.playlist)) return;

    function runCleanup() {
      if (!audio.paused) return false;
      const currentSrc = getCurrentLogicalAudioSrc() || getCurrentPlayableAudioSrc(audio);
      if (!currentSrc) return false;
      const belongsToAlbumPage = ui.playlist.some((track) => srcMatches(track.src, currentSrc));
      if (belongsToAlbumPage) return false;
      cleanupIdleAudioContext({ preserveMode: true });
      return true;
    }

    if (runCleanup()) return;

    function onPause() {
      audio.removeEventListener("pause", onPause);
      runCleanup();
    }

    audio.addEventListener("pause", onPause);
    setTimeout(function () {
      audio.removeEventListener("pause", onPause);
      runCleanup();
    }, 650);
  }



  function buildAlbumPlaylistFromRadioCache(track) {
    if (!track || !track.src) return [];
    const radioList = Array.isArray(audioState.radioPlaylist) ? audioState.radioPlaylist : [];
    if (!radioList.length) return [];

    const trackSrc = toAbsoluteUrlOrEmpty(track.src || "");
    if (!trackSrc) return [];
    const trackPage = toAbsoluteUrlOrEmpty(track.page || "");
    const trackAlbum = normalizeAlbumTitle(track.album || "");

    let candidates = [];
    if (trackPage) {
      candidates = radioList.filter(function (entry) {
        if (!entry || !entry.src) return false;
        return toAbsoluteUrlOrEmpty(entry.page || "") === trackPage;
      });
    }

    if (!candidates.length && trackAlbum) {
      candidates = radioList.filter(function (entry) {
        if (!entry || !entry.src) return false;
        return normalizeAlbumTitle(entry.album || "") === trackAlbum;
      });
    }

    if (!candidates.length) return [];

    if (!candidates.some(function (entry) { return srcMatches(entry.src, trackSrc); })) {
      candidates = [track].concat(candidates);
    }

    const normalized = [];
    candidates.forEach(function (entry) {
      const source = entry || track;
      const sourceSrc = toAbsoluteUrlOrEmpty(source.src || "");
      if (!sourceSrc) return;
      if (normalized.some(function (existing) { return srcMatches(existing.src, sourceSrc); })) return;
      normalized.push({
        src: sourceSrc,
        name: normalizeTrackTitle(source.name || ""),
        album: normalizeAlbumTitle(source.album || track.album || getCurrentAlbumTitle()),
        page: getCurrentTrackAlbumPage(source),
        artist: source.artist || track.artist || "INFRA.",
        artwork: getCurrentTrackArtwork(source)
      });
    });

    return normalized;
  }



  function sanitizeQueueTrack(track) {
    const src = toAbsoluteUrlOrEmpty(track && track.src ? track.src : "");
    if (!src) return null;
    return {
      src,
      name: normalizeTrackTitle(track && track.name ? track.name : ""),
      album: normalizeAlbumTitle(track && track.album ? track.album : ""),
      page: track && track.page ? toAbsoluteUrl(track.page) : "",
      artist: track && track.artist ? String(track.artist).trim() : "INFRA.",
      artwork: getCurrentTrackArtwork(track || null)
    };
  }



  function savePlaybackQueueContext() {
    try {
      let list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
      if (audioState.homeMode === "radio") {
        const currentTrack = getCurrentPlaylistTrack();
        const preservedTrack = buildPreservedTrack(
          currentTrack,
          getCurrentLogicalAudioSrc() || (currentTrack && currentTrack.src) || ""
        );
        list = preservedTrack ? [preservedTrack] : [];
      }
      if (!list.length) {
        sessionStorage.removeItem(audioState.queueStorageKey);
        return;
      }

      const sanitizedPlaylist = list
        .map(sanitizeQueueTrack)
        .filter(Boolean)
        .slice(0, 260);
      if (!sanitizedPlaylist.length) {
        sessionStorage.removeItem(audioState.queueStorageKey);
        return;
      }

      const currentSrc = toAbsoluteUrlOrEmpty(getCurrentLogicalAudioSrc());
      let currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
      if (currentSrc) {
        const bySrc = sanitizedPlaylist.findIndex((track) => srcMatches(track.src, currentSrc));
        if (bySrc >= 0) currentIndex = bySrc;
      }
      if (currentIndex < 0 || currentIndex >= sanitizedPlaylist.length) {
        currentIndex = Math.min(Math.max(0, currentIndex), sanitizedPlaylist.length - 1);
      }

      sessionStorage.setItem(audioState.queueStorageKey, JSON.stringify({
        playlist: sanitizedPlaylist,
        currentIndex,
        homeMode: audioState.homeMode === "radio" ? "radio" : "album",
        playlistKind: audioState.playlistKind === "global" || audioState.playlistKind === "favorites"
          ? audioState.playlistKind
          : (audioState.homeMode === "radio" ? "radio" : "album"),
        shuffleOn: Boolean(audioState.shuffleOn),
        currentSrc: currentSrc || (sanitizedPlaylist[currentIndex] && sanitizedPlaylist[currentIndex].src) || "",
        savedAt: Date.now()
      }));
    } catch (_err) {
      // Ignore storage errors.
    }
  }



  function queueMatchesCurrentPage(payload, restoredMode) {
    if (restoredMode === "radio") return true;
    const playlist = payload && Array.isArray(payload.playlist) ? payload.playlist : [];
    if (!playlist.length) return false;
    if (payload && (payload.playlistKind === "global" || payload.playlistKind === "favorites")) return true;

    if (document.body.classList.contains("album-screen")) {
      const currentPage = toAbsoluteUrlOrEmpty(window.location.pathname);
      return playlist.some(function (track) {
        return track && track.page && toAbsoluteUrlOrEmpty(track.page) === currentPage;
      });
    }

    return Boolean(getCurrentLogicalAudioSrc());
  }



  function restorePlaybackQueueContext() {
    let payload = null;
    try {
      const raw = sessionStorage.getItem(audioState.queueStorageKey);
      if (!raw) return false;
      payload = JSON.parse(raw);
    } catch (_err) {
      return false;
    }

    if (!payload || !Array.isArray(payload.playlist) || !payload.playlist.length) return false;
    const restoredPlaylist = payload.playlist.map(sanitizeQueueTrack).filter(Boolean);
    if (!restoredPlaylist.length) return false;

    const restoredMode = payload.homeMode === "radio" ? "radio" : "album";
    if (!queueMatchesCurrentPage(payload, restoredMode)) {
      clearStoredPlaybackState();
      return false;
    }

    audioState.homeMode = restoredMode;
    persistHomePlayMode(restoredMode);
    audioState.shuffleOn = Boolean(payload.shuffleOn);

    audioState.playlist = restoredPlaylist.slice();
    audioState.playlistKind = payload.playlistKind === "global" || payload.playlistKind === "favorites"
      ? payload.playlistKind
      : (restoredMode === "radio" ? "radio" : "album");
    syncPlaylistContext(audioState.playlist);

    const activeSrc = toAbsoluteUrlOrEmpty(getCurrentLogicalAudioSrc() || payload.currentSrc || "");
    let currentIndex = Number.isInteger(payload.currentIndex) ? payload.currentIndex : -1;
    if (activeSrc) {
      const bySrc = audioState.playlist.findIndex((track) => track && srcMatches(track.src, activeSrc));
      if (bySrc >= 0) currentIndex = bySrc;
    }
    if (currentIndex < 0 || currentIndex >= audioState.playlist.length) {
      currentIndex = 0;
    }
    audioState.currentIndex = currentIndex;

    if (audioState.homeMode !== "radio" && audioState.playlistKind !== "global" && audioState.playlistKind !== "favorites") {
      audioState.albumPlaylistSnapshot = audioState.playlist.slice();
      audioState.albumIndexSnapshot = audioState.currentIndex;
    } else {
      clearRadioQueue();
    }
    savePlaybackQueueContext();
    return true;
  }



  function expandSingleTrackAlbumFromRadioCache() {
    if (audioState.homeMode === "radio") return false;
    const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    if (list.length !== 1) return false;

    const currentTrack = list[0];
    const rebuilt = buildAlbumPlaylistFromRadioCache(currentTrack);
    if (!Array.isArray(rebuilt) || rebuilt.length <= 1) return false;

    audioState.playlist = rebuilt.slice();
    syncPlaylistContext(audioState.playlist);
    const matchedIndex = audioState.playlist.findIndex((track) => srcMatches(track.src, currentTrack.src));
    audioState.currentIndex = matchedIndex >= 0 ? matchedIndex : 0;
    audioState.albumPlaylistSnapshot = audioState.playlist.slice();
    audioState.albumIndexSnapshot = audioState.currentIndex;
    return true;
  }



  function peekRadioNextIndexForPrefetch(currentIndex) {
    if (!ensureRadioQueue(audioState.radioQueueMinRemaining)) return -1;
    let cursor = Number.isInteger(audioState.radioQueueCursor) && audioState.radioQueueCursor >= 0
      ? audioState.radioQueueCursor
      : currentIndex;
    const currentSrc = getCurrentLogicalAudioSrc();
    if (currentSrc) {
      const bySrc = audioState.radioQueue.findIndex(function (track) {
        return track && srcMatches(track.src, currentSrc);
      });
      if (bySrc >= 0) cursor = bySrc;
    }
    if (audioState.radioQueue.length - cursor - 1 < audioState.radioQueueMinRemaining) {
      ensureRadioQueue(audioState.radioQueueMinRemaining);
    }
    syncRadioQueueToPlaylist({ preserveRecent: true });
    return cursor < audioState.radioQueue.length - 1 ? cursor + 1 : -1;
  }



  function saveResumeState() {
    const audio = audioState.audio;
    if (!audio) return;

    try {
      const src = getCurrentLogicalAudioSrc();
      if (!src) {
        sessionStorage.removeItem(audioState.resumeStorageKey);
        return;
      }

      sessionStorage.setItem(audioState.resumeStorageKey, JSON.stringify({
        src,
        time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        playing: !audio.paused
      }));
    } catch (_err) {
      // Ignore storage errors.
    }
  }



  function restoreResumeState() {
    if (audioState.restored) return;
    audioState.restored = true;

    const audio = audioState.audio;
    if (!audio) return;

    let payload = null;
    try {
      const raw = sessionStorage.getItem(audioState.resumeStorageKey);
      if (!raw) return;
      payload = JSON.parse(raw);
    } catch (_err) {
      return;
    }

    if (!payload || !payload.src || isBlobObjectUrl(payload.src)) return;

    const restoredSrc = normalizeAudioSourceUrl(payload.src);
    if (!restoredSrc || isBlobObjectUrl(restoredSrc)) return;
    revokeActiveBlobUrl();
    audioState.activeLogicalSrc = restoredSrc;
    audio.src = restoredSrc;
    audioState.pendingStartTime = Number.isFinite(payload.time) ? payload.time : 0;
    restorePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    savePlaybackQueueContext();

    if (payload.playing) {
      audio.play().catch(function () {
        // Autoplay may be blocked; keep paused.
      });
    }
  }





  function ensurePlayablePlaylistContext() {
    if (Array.isArray(audioState.playlist) && audioState.playlist.length) {
      expandSingleTrackAlbumFromRadioCache();
      return;
    }

    if (restorePlaybackQueueContext()) {
      expandSingleTrackAlbumFromRadioCache();
      ensureCurrentIndexFromAudio();
      return;
    }

    if (audioState.homeMode === "radio") {
      if (Array.isArray(audioState.radioPlaylist) && audioState.radioPlaylist.length) {
        ensureRadioQueue(audioState.radioQueueMinRemaining);
        ensureCurrentIndexFromAudio();
      }
      return;
    }

    const currentSrc = getCurrentLogicalAudioSrc();
    if (currentSrc) {
      const preserved = buildPreservedTrack(null, currentSrc);
      const rebuiltFromRadio = buildAlbumPlaylistFromRadioCache(preserved);
      if (rebuiltFromRadio.length) {
        audioState.playlist = rebuiltFromRadio.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch = audioState.playlist.findIndex((track) => srcMatches(track.src, currentSrc));
        audioState.currentIndex = currentMatch >= 0 ? currentMatch : 0;
        audioState.albumPlaylistSnapshot = audioState.playlist.slice();
        audioState.albumIndexSnapshot = audioState.currentIndex;
        return;
      }
    }

    const ui = audioState.ui;
    if (!ui || !Array.isArray(ui.playlist) || !ui.playlist.length) return;
    audioState.playlist = ui.playlist.slice();
    syncPlaylistContext(audioState.playlist);
    ensureCurrentIndexFromAudio();
    expandSingleTrackAlbumFromRadioCache();
  }



  function playFromExternalControl(surface) {
    const audio = audioState.audio || ensureGlobalAudio();
    if (!audio) return;
    const commandNow = Date.now();
    const previousCommand = audioState.externalPlaybackCommand;
    if (previousCommand && commandNow - previousCommand.at < 400) {
      trackAudioRuntimeEvent("external_play_duplicate", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          command_id: previousCommand.id,
          surface: surface || "",
          duplicate_after_ms: Math.max(0, commandNow - previousCommand.at),
          paused: Boolean(audio.paused)
        }
      ));
      return;
    }
    if (!audio.paused) return;
    cancelExternalResumeCommand();
    clearSystemInterruptionGuard();
    audioState.externalPlaybackCommandSeq = Number(audioState.externalPlaybackCommandSeq || 0) + 1;
    const commandId = `external-${Date.now().toString(36)}-${audioState.externalPlaybackCommandSeq}`;
    audioState.externalPlaybackCommand = {
      id: commandId,
      at: commandNow,
      surface: surface || ""
    };

    if (!getCurrentPlayableAudioSrc(audio)) {
      trackAudioRuntimeEvent("media_session_play", {
        command_id: commandId,
        surface: surface || "",
        mode: "cold_start"
      });
      if (audioState.homeMode === "radio") {
        trackAudioRuntimeEvent("external_play_start", {
          surface: surface || "",
          mode: "radio"
        });
        startRadioPlaybackFromIdle();
        return;
      }

      if (canStartInitialGlobalRandomPlayback()) {
        trackAudioRuntimeEvent("external_play_start", {
          surface: surface || "",
          mode: "initial_random"
        });
        startGlobalRandomPlayback();
        return;
      }

      if (audioState.playlist.length) {
        const startIndex = audioState.currentIndex >= 0
          ? audioState.currentIndex
          : (audioState.shuffleOn ? getRandomIndex(-1) : 0);
        trackAudioRuntimeEvent("external_play_start", {
          surface: surface || "",
          mode: "playlist",
          index: startIndex
        });
        startTrack(startIndex >= 0 ? startIndex : 0, { resume: true });
      }
      return;
    }

    trackAudioRuntimeEvent("external_play_resume", {
      command_id: commandId,
      surface: surface || "",
      current_time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    });
    trackAudioRuntimeEvent("media_session_play", Object.assign(
      buildAudioMonitorPayload(
        getCurrentPlaylistTrack(),
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src
      ),
      getAudioRuntimeProbeState(),
      {
        command_id: commandId,
        surface: surface || "",
        mode: "resume"
      }
    ));
    const startTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    scheduleExternalResumeProbes(audio, commandId, surface, startTime);
    audio.play().then(function () {
      trackAudioRuntimeEvent("resume_probe", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          command_id: commandId,
          surface: surface || "",
          delay_ms: 0,
          stage: "play_promise",
          confirmed: Boolean(!audio.paused),
          paused: Boolean(audio.paused)
        }
      ));
    }).catch(function (err) {
      trackAudioRuntimeEvent("resume_probe", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          command_id: commandId,
          surface: surface || "",
          delay_ms: 0,
          stage: "play_rejected",
          confirmed: false,
          paused: Boolean(audio.paused),
          error_name: err && err.name ? err.name : "Error",
          error_message: err && err.message ? err.message : "external_play_rejected"
        }
      ));
    });
  }



  function handleGlobalTransportToggle() {
    const audio = audioState.audio || ensureGlobalAudio();
    if (
      audio &&
      audio.paused &&
      !getCurrentPlayableAudioSrc(audio) &&
      document.body.classList.contains("home-screen") &&
      !audioState.globalRandomStartInFlight
    ) {
      setHomePlayMode("radio", { force: true });
      audioState.coldStartInFlight = true;
      trackAudioRuntimeEvent("cold_start_radio", {
        surface: "home",
        trigger: "transport",
        home_mode: "radio",
        queue_primed: Boolean(Array.isArray(audioState.radioPlaylist) && audioState.radioPlaylist.length)
      });
      startRadioPlaybackFromIdle();
      return;
    }
    togglePlayPause();
  }














  function ensureGlobalAudio() {
    if (!audioState.homeModeInitialized) {
      audioState.homeMode = readHomePlayMode();
      audioState.nowPlayingVolumeVisible = readNowPlayingVolumeVisible();
      audioState.homeModeInitialized = true;
    }

    const root = getSpaPersistRoot();

    if (audioState.audio) {
      audioState.audio.crossOrigin = "";
      audioState.audio.removeAttribute("crossorigin");
      audioState.audio.preload = "none";
      root.appendChild(audioState.audio);
      bindMediaSessionActions();
      ensureGlobalTransportUi();
      restoreResumeState();
      syncMediaSessionMetadata({ forcePosition: true });
      syncTransportUi();
      return audioState.audio;
    }

    let audio = document.getElementById("infraGlobalAudio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "infraGlobalAudio";
      audio.preload = "none";
      audio.playsInline = true;
      audio.crossOrigin = "";
      audio.removeAttribute("crossorigin");
      audio.setAttribute("playsinline", "");
      root.appendChild(audio);
    } else {
      audio.crossOrigin = "";
      audio.removeAttribute("crossorigin");
      audio.preload = "none";
      root.appendChild(audio);
    }

    audioState.audio = audio;
    bindMediaSessionActions();

    audio.addEventListener("play", function () {
      if (shouldBlockHiddenSystemAutoResume(audio)) {
        const guard = audioState.systemInterruptionGuard || {};
        trackAudioRuntimeEvent("system_auto_resume_blocked", Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState(),
          {
            guard_age_ms: Number.isFinite(guard.at) ? Math.max(0, Date.now() - guard.at) : null,
            guard_current_time: Number.isFinite(guard.currentTime) ? guard.currentTime : null,
            visibility_state: document.visibilityState || ""
          }
        ));
        markAudioPauseIntent("system_auto_resume_blocked", "interruption_guard");
        try {
          audio.pause();
        } catch (_err) {
          // Ignore pause failures while blocking an unsafe hidden resume.
        }
        return;
      }
      if (document.visibilityState === "visible" || hasFreshExternalPlaybackCommand()) {
        clearSystemInterruptionGuard();
      }
      clearWaitingRecovery();
      audioState.resumeOnVisible = false;
      trackAudioRuntimeEvent("audio_play", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          request_token: audioState.playRequestToken,
          confirmed: false,
          note: "play event only; success requires playing"
        }
      ));
    });

    audio.addEventListener("pause", function () {
      const pauseIntent = consumeAudioPauseIntent();
      const pauseContext = classifyAudioPause(audio, pauseIntent);
      if (pauseIntent.reason !== "external_resume_recovery") {
        cancelExternalResumeCommand();
      }
      if (pauseContext === "system_midtrack") {
        rememberSystemInterruption(audio, pauseContext);
      } else if (pauseContext !== "system_suspected") {
        clearSystemInterruptionGuard();
      }
      audioState.mediaSessionAudioPlaying = false;
      clearWaitingRecovery();
      audioState.resumeOnVisible = false;
      syncAudioUi();
      resyncMediaSessionControls();
      stopAudioRaf();
      stopAudioTelemetryHeartbeat();
      clearFadeTimer();
      saveResumeState();
      scheduleDeferredServiceWorkerReload();
      markAudioTelemetryInactive();
      trackAudioRuntimeEvent("audio_pause", Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src
        ),
        getAudioRuntimeProbeState(),
        {
          pause_reason: pauseIntent.reason,
          pause_context: pauseContext,
          surface: pauseIntent.surface,
          intent_age_ms: pauseIntent.age_ms,
          remaining_seconds: getAudioRemainingSeconds(audio),
          ended: Boolean(audio.ended)
        }
      ));
    });

    audio.addEventListener("loadstart", function () {
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent("first_byte", Object.assign(
        buildAudioMonitorPayload(track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          note: "loadstart navigateur, pas mesure réseau exacte",
          buffered_end: getAudioBufferedEnd(),
          ready_state: audio.readyState,
          network_state: audio.networkState
        }
      ));
    });

    audio.addEventListener("ended", function () {
      audioState.mediaSessionAudioPlaying = false;
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent("ended", Object.assign(
        buildAudioMonitorPayload(track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          listened_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0,
          duration_ms: Number.isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
          buffered_end: getAudioBufferedEnd(),
          ready_state: audio.readyState,
          network_state: audio.networkState
        }
      ));
      trackAudioRuntimeEvent("play_complete", Object.assign(
        buildAudioMonitorPayload(track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          listened_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0,
          duration_ms: Number.isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0
        }
      ));
      clearWaitingRecovery();
      stopAudioTelemetryHeartbeat();
      saveResumeState();
      syncMediaSessionMetadata({ forcePosition: true });
      playNext({ seamless: true, auto: true });
      scheduleDeferredServiceWorkerReload();
    });

    audio.addEventListener("loadedmetadata", function () {
      if (Number.isFinite(audioState.pendingStartTime) && audioState.pendingStartTime !== null) {
        try {
          audio.currentTime = audioState.pendingStartTime;
        } catch (_err) {
          // Ignore failures for early seeks.
        }
        audioState.pendingStartTime = null;
      } else if (Number.isFinite(audioState.pendingSeekRatio) && audioState.pendingSeekRatio !== null) {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          try {
            audio.currentTime = audio.duration * audioState.pendingSeekRatio;
          } catch (_err) {
            // Ignore failures for early seeks.
          }
        }
        audioState.pendingSeekRatio = null;
      }
      syncCurrentTrackDurationFromAudio(audio);
      clearWaitingRecovery();
      clearTrackFailureForCurrent();
      syncMediaSessionMetadata({ forcePosition: true });
      syncAudioUi();
    });

    audio.addEventListener("durationchange", function () {
      syncCurrentTrackDurationFromAudio(audio);
      syncMediaSessionMetadata({ forcePosition: true });
      syncAudioUi();
    });

    audio.addEventListener("volumechange", function () {
      syncAudioUi();
    });

    audio.addEventListener("timeupdate", function () {
      syncMediaSessionMetadata();
      audioState.lastAudioCurrentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      confirmAudioRecovery(audio);
      maybePrefetchNextTrack("timeupdate");
      const now = Date.now();
      if (!audioState.lastResumeSaveTs || now - audioState.lastResumeSaveTs >= 5000) {
        audioState.lastResumeSaveTs = now;
        saveResumeState();
      }
    });

    audio.addEventListener("seeking", function () {
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent("seek", Object.assign(
        buildAudioMonitorPayload(track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          from_ms: Number.isFinite(audioState.lastAudioCurrentTime)
            ? Math.floor(audioState.lastAudioCurrentTime * 1000)
            : 0,
          to_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0
        }
      ));
    });

    audio.addEventListener("progress", function () {
      maybePrefetchNextTrack("progress");
      const currentSrc = audioState.activeLogicalSrc || audio.currentSrc || audio.src || "";
      if (!currentSrc || audioState.loggedCacheHitSrc === currentSrc) return;
      if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !audio.buffered || !audio.buffered.length) return;
      let bufferedEnd = 0;
      try {
        bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      } catch (_err) {
        return;
      }
      if (Number.isFinite(bufferedEnd) && bufferedEnd >= audio.duration * 0.95) {
        audioState.loggedCacheHitSrc = currentSrc;
        trackAudioRuntimeEvent("cache_hit", Object.assign(
          buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, currentSrc),
          { duration_ms: Math.floor(audio.duration * 1000) }
        ));
      }
    });

    audio.addEventListener("waiting", function () {
      trackAudioRuntimeEvent("waiting", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        getAudioRuntimeProbeState(),
        {
          request_token: audioState.playRequestToken,
          startup_waiting: Boolean(audioState.trackStartInFlight || audioState.playbackConfirmedToken !== audioState.playRequestToken)
        }
      ));
      setTrackStatus(getTrackByIndex(audioState.currentIndex), "Chargement du fichier audio...");
      scheduleWaitingRecovery();
    });
    audio.addEventListener("stalled", function () {
      trackAudioRuntimeEvent("stalled", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        getAudioRuntimeProbeState(),
        {
          request_token: audioState.playRequestToken,
          startup_waiting: Boolean(audioState.trackStartInFlight || audioState.playbackConfirmedToken !== audioState.playRequestToken)
        }
      ));
      setTrackStatus(getTrackByIndex(audioState.currentIndex), "Chargement du fichier audio...");
      scheduleWaitingRecovery();
    });
    audio.addEventListener("suspend", function () {
      trackAudioRuntimeEvent("suspend", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        getAudioRuntimeProbeState()
      ));
    });
    audio.addEventListener("canplay", function () {
      const track = getCurrentPlaylistTrack();
      const delay = audioState.playRequestTs ? Date.now() - audioState.playRequestTs : null;
      logAudioAuditEvent("canplay", track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src, {
        request_token: audioState.playRequestToken,
        delay_ms: Number.isFinite(delay) ? delay : undefined,
        ready_state: audio.readyState,
        network_state: audio.networkState,
        click_perf_ms: audioState.audioClickPerfTs
      });
      trackAudioRuntimeEvent("playable", Object.assign(
        buildAudioMonitorPayload(track, audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          delay_ms: Number.isFinite(delay) ? delay : undefined,
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        }
      ));
      clearWaitingRecovery();
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
    });
    audio.addEventListener("canplaythrough", function () {
      clearWaitingRecovery();
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
    });
    audio.addEventListener("playing", function () {
      audioState.mediaSessionAudioPlaying = true;
      audioState.playbackConfirmedToken = audioState.playRequestToken;
      audioState.coldStartInFlight = false;
      logAudioAuditEvent("playing", getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src, {
        request_token: audioState.playRequestToken,
        buffered_end: getAudioBufferedEnd(),
        ready_state: audio.readyState,
        network_state: audio.networkState,
        click_perf_ms: audioState.audioClickPerfTs
      });
      startAudioTelemetryHeartbeat();
      if (audioState.lastMonitorPlayToken !== audioState.playRequestToken) {
        audioState.lastMonitorPlayToken = audioState.playRequestToken;
        sendAudioMonitoringLog(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src, {
          error: false
        });
      }
      clearWaitingRecovery();
      maybePrefetchNextTrack("playing");
      clearTrackFailureForCurrent();
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
      audioState.trackStartInFlight = false;
      syncAudioUi();
      startAudioRaf();
      syncMediaSessionMetadata({ forcePosition: true });
    });
    audio.addEventListener("error", function () {
      audioState.mediaSessionAudioPlaying = false;
      const mediaErr = audio.error;
      if (mediaErr && mediaErr.code === 1) {
        // MEDIA_ERR_ABORTED can happen during normal source switches.
        return;
      }
      trackAudioRuntimeEvent("error", Object.assign(
        buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src),
        {
          error_code: mediaErr && Number.isFinite(mediaErr.code) ? mediaErr.code : 0,
          error_message: mediaErr && mediaErr.message ? mediaErr.message : "unknown",
          ready_state: audio.readyState,
          network_state: audio.networkState
        }
      ));
      sendAudioMonitoringLog(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio.currentSrc || audio.src, {
        error: true,
        error_code: mediaErr && Number.isFinite(mediaErr.code) ? mediaErr.code : 0,
        error_message: mediaErr && mediaErr.message ? mediaErr.message : "unknown"
      });
      stopAudioTelemetryHeartbeat();
      const fallbackIndex = ensureCurrentIndexFromAudio();
      const index = Number.isInteger(audioState.currentIndex) && audioState.currentIndex >= 0
        ? audioState.currentIndex
        : fallbackIndex;
      const currentSrc = getCurrentLogicalAudioSrc();
      if (index >= 0) {
        setTrackStatus(getTrackByIndex(index), "Chargement du fichier audio...");
        recoverFromTrackFailure(index, currentSrc);
        return;
      }
      scheduleWaitingRecovery();
    });

    if (!audioState.resumeBound) {
      window.addEventListener("pagehide", function () {
        saveResumeState();
        revokeActiveBlobUrl();
      });
      window.addEventListener("pageshow", function () {
        resyncMediaSessionControls();
      });
      window.addEventListener("focus", function () {
        resyncMediaSessionControls();
      });
      document.addEventListener("visibilitychange", function () {
        const currentAudio = audioState.audio;
        if (document.visibilityState === "hidden") {
          if (currentAudio && !currentAudio.paused && getCurrentPlayableAudioSrc(currentAudio)) {
            audioState.resumeOnVisible = true;
          }
          saveResumeState();
          return;
        }
        if (document.visibilityState === "visible") {
          if (audioState.resumeOnVisible && currentAudio && getCurrentPlayableAudioSrc(currentAudio)) {
            currentAudio.play().catch(function () {
              // Ignore autoplay resume errors.
            });
          }
          resyncMediaSessionControls();
          scheduleDeferredServiceWorkerReload();
        }
      });
      audioState.resumeBound = true;
    }

    ensureGlobalTransportUi();
    restoreResumeState();
    syncMediaSessionMetadata({ forcePosition: true });
    syncTransportUi();

    return audio;
  }




  function stopAudioRaf() {
    if (audioState.raf) {
      cancelAnimationFrame(audioState.raf);
      audioState.raf = null;
    }
  }



  function startAudioRaf() {
    stopAudioRaf();
    const audio = audioState.audio;
    if (!audio) return;
    if (audio.paused) return;

    let lastUpdate = 0;

    function tick(now) {
      if (!lastUpdate || now - lastUpdate >= 90) {
        updateProgressUi();
        lastUpdate = now;
      }
      if (!audio.paused) {
        audioState.raf = requestAnimationFrame(tick);
      } else {
        stopAudioRaf();
      }
    }

    audioState.raf = requestAnimationFrame(tick);
  }



  function getPrefetchCacheRequest(src) {
    if (prefetchApi && typeof prefetchApi.createRequest === "function") {
      return prefetchApi.createRequest(src);
    }
    try {
      return new Request(src, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default"
      });
    } catch (_err) {
      return src;
    }
  }



  function resetNextTrackPrefetchState() {
    audioState.nextPrefetchSrc = "";
    audioState.nextPrefetchIndex = -1;
    audioState.nextPrefetchFromIndex = -1;
    audioState.nextPrefetchDoneSrc = "";
    audioState.nextPrefetchServedSrc = "";
    audioState.nextPrefetchAttemptedSrc = "";
    audioState.nextPrefetchFailedSrc = "";
    audioState.nextPrefetchFailureReason = "";
  }



  function clearNextTrackPrefetch(reason) {
    audioState.nextPrefetchToken += 1;
    audioState.nextPrefetchInFlight = false;
    if (audioState.nextPrefetchAbortController) {
      try {
        audioState.nextPrefetchAbortController.abort();
      } catch (_err) {
        // Ignore abort failures; the request token still invalidates the result.
      }
      audioState.nextPrefetchAbortController = null;
    }
    resetNextTrackPrefetchState();
    if (prefetchApi && typeof prefetchApi.clearCache === "function") {
      prefetchApi.clearCache().catch(function () {
        trackAudioRuntimeEvent("prefetch_error", {
          track: "prefetch",
          album: "prefetch",
          reason: reason || "clear_failed"
        });
      });
      return;
    }
    if (!("caches" in window)) return;
    caches.open(PREFETCH_NEXT_CACHE_NAME).then(function (cache) {
      return cache.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return cache.delete(key); }));
      });
    }).catch(function () {
      trackAudioRuntimeEvent("prefetch_error", {
        track: "prefetch",
        album: "prefetch",
        reason: reason || "clear_failed"
      });
    });
  }



  function getCurrentBufferedEndForPrefetch(audio) {
    if (!audio || !audio.buffered || !audio.buffered.length) return 0;
    try {
      const end = audio.buffered.end(audio.buffered.length - 1);
      return Number.isFinite(end) ? end : 0;
    } catch (_err) {
      return 0;
    }
  }



  function shouldPrefetchNextTrackNow(reason) {
    const audio = audioState.audio;
    if (!audio || audio.paused || !getCurrentPlayableAudioSrc(audio)) return false;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const bufferedEnd = getCurrentBufferedEndForPrefetch(audio);
    if (duration <= 0) return false;
    if (reason === "playing" && audioState.homeMode === "radio") return true;
    if (bufferedEnd >= duration * 0.98) return true;
    if (duration - currentTime <= PREFETCH_NEXT_THRESHOLD_SECONDS) return true;
    return reason === "playing" && duration <= PREFETCH_NEXT_THRESHOLD_SECONDS;
  }



  function peekNextIndexForPrefetch() {
    const list = audioState.playlist;
    if (!Array.isArray(list) || !list.length) return -1;
    const currentIndex = getCurrentPlaylistIndexSafe();
    if (currentIndex < 0 || currentIndex >= list.length) return -1;
    if (audioState.homeMode === "radio") return peekRadioNextIndexForPrefetch(currentIndex);
    if (audioState.shuffleOn) return getRandomIndex(currentIndex);
    if (currentIndex < list.length - 1) return currentIndex + 1;
    const extendedIndex = extendAlbumPlaylistToNextAlbum({
      reason: "prefetch",
      fromIndex: currentIndex
    });
    return Number.isInteger(extendedIndex) && extendedIndex >= 0 ? extendedIndex : -1;
  }



  function rememberNextTrackPrefetch(index, src) {
    audioState.nextPrefetchIndex = index;
    audioState.nextPrefetchFromIndex = getCurrentPlaylistIndexSafe();
    audioState.nextPrefetchSrc = src;
  }



  function getAutoPrefetchedNextIndex() {
    if (!PREFETCH_NEXT_ENABLED) return -1;
    const currentIndex = getCurrentPlaylistIndexSafe();
    if (
      audioState.nextPrefetchDoneSrc &&
      audioState.nextPrefetchFromIndex === currentIndex &&
      Number.isInteger(audioState.nextPrefetchIndex) &&
      audioState.nextPrefetchIndex >= 0 &&
      audioState.nextPrefetchIndex < audioState.playlist.length
    ) {
      const track = audioState.playlist[audioState.nextPrefetchIndex];
      const src = normalizeAudioSourceUrl(track && track.src ? track.src : "");
      if (src && srcMatches(src, audioState.nextPrefetchDoneSrc)) return audioState.nextPrefetchIndex;
    }
    return -1;
  }



  function startNextTrackPrefetch(index, track, src, reason) {
    const prefetchSupported = prefetchApi && typeof prefetchApi.isSupported === "function"
      ? prefetchApi.isSupported()
      : ("caches" in window && typeof fetch === "function");
    if (!PREFETCH_NEXT_ENABLED || !prefetchSupported) return;
    const token = ++audioState.nextPrefetchToken;
    const startedAt = Date.now();
    const fromIndexAtStart = getCurrentPlaylistIndexSafe();
    const abortController = typeof AbortController === "function"
      ? new AbortController()
      : null;
    audioState.nextPrefetchAbortController = abortController;
    audioState.nextPrefetchInFlight = true;
    rememberNextTrackPrefetch(index, src);
    audioState.nextPrefetchAttemptedSrc = src;
    audioState.nextPrefetchFailedSrc = "";
    audioState.nextPrefetchFailureReason = "";
    trackAudioRuntimeEvent("prefetch_start", Object.assign(
      buildAudioMonitorPayload(track, index, src),
      {
        next_index: index,
        from_index: audioState.nextPrefetchFromIndex,
        reason: reason || "threshold"
      }
    ));

    const baseRequest = getPrefetchCacheRequest(src);
    let fetchRequest = baseRequest;
    let fetchOptions;
    if (abortController) {
      try {
        fetchRequest = new Request(baseRequest, { signal: abortController.signal });
      } catch (_err) {
        fetchOptions = { signal: abortController.signal };
      }
    }

    fetch(fetchRequest, fetchOptions).then(function (response) {
      if (token !== audioState.nextPrefetchToken) return null;
      if (!response || !response.ok) {
        throw new Error(`prefetch_http_${response ? response.status : "none"}`);
      }
      const bytes = prefetchApi && typeof prefetchApi.getContentLength === "function"
        ? prefetchApi.getContentLength(response)
        : Number(response.headers.get("Content-Length") || response.headers.get("content-length") || 0);
      if (!Number.isFinite(bytes) || bytes <= 0) throw new Error("prefetch_missing_content_length");
      if (bytes > PREFETCH_NEXT_MAX_BYTES) {
        if (response.body && typeof response.body.cancel === "function") {
          response.body.cancel().catch(function () {});
        }
        throw new Error("prefetch_too_large");
      }
      if (prefetchApi && typeof prefetchApi.putSingle === "function") {
        return prefetchApi.putSingle(src, response).then(function () {
          return bytes;
        });
      }
      return caches.open(PREFETCH_NEXT_CACHE_NAME).then(function (cache) {
        return cache.keys().then(function (keys) {
          return Promise.all(keys.map(function (key) { return cache.delete(key); })).then(function () {
            return cache.put(getPrefetchCacheRequest(src), response.clone()).then(function () {
              return bytes;
            });
          });
        });
      });
    }).then(function (bytes) {
      if (token !== audioState.nextPrefetchToken || !bytes) return;
      audioState.nextPrefetchDoneSrc = src;
      trackAudioRuntimeEvent("prefetch_done", Object.assign(
        buildAudioMonitorPayload(track, index, src),
        {
          next_index: index,
          from_index: audioState.nextPrefetchFromIndex,
          bytes,
          ms: Date.now() - startedAt
        }
      ));
    }).catch(function (err) {
      if (token !== audioState.nextPrefetchToken) return;
      audioState.nextPrefetchDoneSrc = "";
      audioState.nextPrefetchFailedSrc = src;
      audioState.nextPrefetchFailureReason = err && err.message ? err.message : "prefetch_failed";
      trackAudioRuntimeEvent("prefetch_error", Object.assign(
        buildAudioMonitorPayload(track, index, src),
        {
          next_index: index,
          from_index: audioState.nextPrefetchFromIndex,
          reason: err && err.message ? err.message : "prefetch_failed",
          ms: Date.now() - startedAt
        }
      ));
    }).finally(function () {
      if (token === audioState.nextPrefetchToken) {
        audioState.nextPrefetchInFlight = false;
        if (audioState.nextPrefetchAbortController === abortController) {
          audioState.nextPrefetchAbortController = null;
        }
        if (audioState.homeMode === "radio" && getCurrentPlaylistIndexSafe() !== fromIndexAtStart) {
          window.setTimeout(function () {
            maybePrefetchNextTrack("playing");
          }, 0);
        }
      }
    });
  }



  function maybePrefetchNextTrack(reason) {
    if (!PREFETCH_NEXT_ENABLED) return;
    if (audioState.nextPrefetchInFlight) return;
    if (!shouldPrefetchNextTrackNow(reason)) return;
    const currentIndex = getCurrentPlaylistIndexSafe();
    let nextIndex = -1;
    if (
      audioState.nextPrefetchFromIndex === currentIndex &&
      Number.isInteger(audioState.nextPrefetchIndex) &&
      audioState.nextPrefetchIndex >= 0 &&
      audioState.nextPrefetchIndex < audioState.playlist.length
    ) {
      const selectedTrack = audioState.playlist[audioState.nextPrefetchIndex];
      const selectedSrc = normalizeAudioSourceUrl(selectedTrack && selectedTrack.src ? selectedTrack.src : "");
      if (selectedSrc && srcMatches(selectedSrc, audioState.nextPrefetchSrc)) {
        nextIndex = audioState.nextPrefetchIndex;
      }
    }
    if (nextIndex < 0) {
      nextIndex = peekNextIndexForPrefetch();
      if (nextIndex >= 0 && nextIndex < audioState.playlist.length) {
        const selectedTrack = audioState.playlist[nextIndex];
        const selectedSrc = normalizeAudioSourceUrl(selectedTrack && selectedTrack.src ? selectedTrack.src : "");
        audioState.nextPrefetchDoneSrc = "";
        audioState.nextPrefetchServedSrc = "";
        audioState.nextPrefetchAttemptedSrc = "";
        audioState.nextPrefetchFailedSrc = "";
        audioState.nextPrefetchFailureReason = "";
        rememberNextTrackPrefetch(nextIndex, selectedSrc);
      }
    }
    if (nextIndex < 0 || nextIndex >= audioState.playlist.length) return;
    const nextTrack = audioState.playlist[nextIndex];
    const nextSrc = normalizeAudioSourceUrl(nextTrack && nextTrack.src ? nextTrack.src : "");
    if (!nextSrc || !isCloudflareAudioUrl(nextSrc)) return;
    if (
      audioState.nextPrefetchDoneSrc &&
      audioState.nextPrefetchFromIndex === currentIndex &&
      srcMatches(audioState.nextPrefetchDoneSrc, nextSrc)
    ) {
      return;
    }
    if (
      audioState.nextPrefetchAttemptedSrc &&
      audioState.nextPrefetchFromIndex === currentIndex &&
      srcMatches(audioState.nextPrefetchAttemptedSrc, nextSrc)
    ) {
      return;
    }
    startNextTrackPrefetch(nextIndex, nextTrack, nextSrc, reason);
  }



  function scheduleSilentCheck(track, index, src, requestToken) {
    window.setTimeout(function () {
      if (requestToken !== audioState.startRequestToken) return;
      const audio = audioState.audio;
      trackAudioRuntimeEvent("silent_check", Object.assign(
        buildAudioMonitorPayload(track, index, src),
        getAudioRuntimeProbeState(),
        {
          request_token: requestToken,
          paused: audio ? Boolean(audio.paused) : null,
          muted: audio ? Boolean(audio.muted) : null,
          volume: audio && Number.isFinite(audio.volume) ? audio.volume : null,
          sync: true,
          trigger: "auto"
        }
      ));
    }, 3000);
  }



    return {
      readHomePlayMode,
      persistHomePlayMode,
      findPlaylistIndexByCurrentSrc,
      primeRadioPlaylistFromLoadedTracks,
      ensureRadioPlaylistLoaded,
      getTrackSource,
      getRecentPlayedSrcSet,
      shuffledCopy,
      buildRadioQueue,
      buildGlobalCatalogPlaylist,
      buildGlobalRandomPlaylistWithTelemetry,
      setGlobalCatalogPlaylist,
      startGlobalRandomPlayback,
      resetPreparedInitialGlobalRandomPlayback,
      consumePreparedInitialGlobalRandomPlaylist,
      shouldPrepareInitialGlobalRandomPlayback,
      prepareInitialGlobalRandomPlayback,
      scheduleInitialGlobalRandomPreparation,
      hasPlaybackSession,
      canStartInitialGlobalRandomPlayback,
      bindGlobalKeyboardShortcuts,
      clearRadioQueue,
      syncRadioQueueToPlaylist,
      ensureRadioQueue,
      injectCurrentTrackIntoRadioQueue,
      ensureRadioPlaylistForNavigation,
      setHomePlayMode,
      activateRadioModeFromTransport,
      toggleRadioModeFromTransport,
      toggleAlbumShuffleMode,
      clearStoredPlaybackState,
      cleanupIdleAudioContext,
      resetHomePlaybackModeIfIdle,
      cleanupForeignAlbumAudioWhenIdle,
      buildAlbumPlaylistFromRadioCache,
      sanitizeQueueTrack,
      savePlaybackQueueContext,
      queueMatchesCurrentPage,
      restorePlaybackQueueContext,
      expandSingleTrackAlbumFromRadioCache,
      peekRadioNextIndexForPrefetch,
      getPrefetchCacheRequest,
      resetNextTrackPrefetchState,
      clearNextTrackPrefetch,
      getCurrentBufferedEndForPrefetch,
      shouldPrefetchNextTrackNow,
      peekNextIndexForPrefetch,
      rememberNextTrackPrefetch,
      getAutoPrefetchedNextIndex,
      startNextTrackPrefetch,
      maybePrefetchNextTrack,
      scheduleSilentCheck,
      saveResumeState,
      restoreResumeState,
      ensurePlayablePlaylistContext,
      markAudioPauseIntent,
      cancelExternalResumeCommand,
      playFromExternalControl,
      handleGlobalTransportToggle,
      ensureGlobalAudio,
      stopAudioRaf,
      startAudioRaf
    };
  }

  function createNoopAudioRadio() {
    return {
      readHomePlayMode: function () { return "album"; },
      persistHomePlayMode: function () {},
      findPlaylistIndexByCurrentSrc: function () {},
      primeRadioPlaylistFromLoadedTracks: function () { return []; },
      ensureRadioPlaylistLoaded: function () { return Promise.resolve([]); },
      getTrackSource: function () {},
      getRecentPlayedSrcSet: function () {},
      shuffledCopy: function (list) { return Array.isArray(list) ? list.slice() : []; },
      buildRadioQueue: function () { return []; },
      buildGlobalCatalogPlaylist: function () { return []; },
      buildGlobalRandomPlaylistWithTelemetry: function () { return []; },
      setGlobalCatalogPlaylist: function () { return false; },
      startGlobalRandomPlayback: function () {},
      resetPreparedInitialGlobalRandomPlayback: function () {},
      consumePreparedInitialGlobalRandomPlaylist: function () {},
      shouldPrepareInitialGlobalRandomPlayback: function () {},
      prepareInitialGlobalRandomPlayback: function () { return Promise.resolve(null); },
      scheduleInitialGlobalRandomPreparation: function () {},
      hasPlaybackSession: function () { return false; },
      canStartInitialGlobalRandomPlayback: function () { return false; },
      bindGlobalKeyboardShortcuts: function () {},
      clearRadioQueue: function () {},
      syncRadioQueueToPlaylist: function () {},
      ensureRadioQueue: function () { return false; },
      injectCurrentTrackIntoRadioQueue: function () { return -1; },
      ensureRadioPlaylistForNavigation: function () { return true; },
      setHomePlayMode: function () {},
      activateRadioModeFromTransport: function () {},
      toggleRadioModeFromTransport: function () {},
      toggleAlbumShuffleMode: function () {},
      clearStoredPlaybackState: function () {},
      cleanupIdleAudioContext: function () { return false; },
      resetHomePlaybackModeIfIdle: function () { return false; },
      cleanupForeignAlbumAudioWhenIdle: function () {},
      buildAlbumPlaylistFromRadioCache: function () { return []; },
      sanitizeQueueTrack: function () { return null; },
      savePlaybackQueueContext: function () {},
      queueMatchesCurrentPage: function () {},
      restorePlaybackQueueContext: function () { return false; },
      expandSingleTrackAlbumFromRadioCache: function () { return false; },
      peekRadioNextIndexForPrefetch: function () { return -1; },
      getPrefetchCacheRequest: function () {},
      resetNextTrackPrefetchState: function () {},
      clearNextTrackPrefetch: function () {},
      getCurrentBufferedEndForPrefetch: function () {},
      shouldPrefetchNextTrackNow: function () {},
      peekNextIndexForPrefetch: function () {},
      rememberNextTrackPrefetch: function () {},
      getAutoPrefetchedNextIndex: function () {},
      startNextTrackPrefetch: function () {},
      maybePrefetchNextTrack: function () {},
      scheduleSilentCheck: function () {},
      saveResumeState: function () {},
      restoreResumeState: function () {},
      ensurePlayablePlaylistContext: function () {},
      markAudioPauseIntent: function () {},
      cancelExternalResumeCommand: function () {},
      playFromExternalControl: function () {},
      handleGlobalTransportToggle: function () {},
      ensureGlobalAudio: function () { return null; },
      stopAudioRaf: function () {},
      startAudioRaf: function () {}
    };
  }

  window.InfraAudioRadio = {
    createAudioRadio,
    createNoopAudioRadio
  };
})();
