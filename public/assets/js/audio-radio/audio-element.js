// Élément audio unique : création, événements, boucle d'animation.
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createAudioElement(R) {
  const {
    audioState,
    bindMediaSessionActions,
    buildAudioMonitorPayload,
    clearFadeTimer,
    clearTrackFailureForCurrent,
    clearTrackStatus,
    clearWaitingRecovery,
    configurePlaybackAudioSession,
    confirmAudioRecovery,
    ensureCurrentIndexFromAudio,
    ensureGlobalTransportUi,
    getAudioBufferedEnd,
    getAudioRuntimeProbeState,
    getCurrentLogicalAudioSrc,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    getSpaPersistRoot,
    getTrackByIndex,
    logAudioAuditEvent,
    markAudioTelemetryInactive,
    playNext,
    readNowPlayingVolumeVisible,
    recoverFromTrackFailure,
    revokeActiveBlobUrl,
    scheduleWaitingRecovery,
    sendAudioMonitoringLog,
    setTrackStatus,
    srcMatches,
    startAudioTelemetryHeartbeat,
    stopAudioTelemetryHeartbeat,
    syncAudioUi,
    syncCurrentTrackDurationFromAudio,
    syncMediaSessionMetadata,
    syncTransportUi,
    trackAudioRuntimeEvent,
    updateProgressUi
  } = R;
  let cancelExternalResumeCommand,
    classifyAudioPause,
    clearSystemInterruptionGuard,
    consumeAudioPauseIntent,
    consumeAuthorizedSystemInterruptionResume,
    emitAudioInterruption,
    emitExternalMediaCommand,
    getAudioRemainingSeconds,
    getCurrentAudioResumeKey,
    hasFreshExternalPlaybackCommand,
    markAudioPauseIntent,
    maybePrefetchNextTrack,
    readHomePlayMode,
    rememberSystemInterruption,
    restoreResumeState,
    resumeAlbumCoverWarmupWhenIdle,
    resyncMediaSessionControls,
    saveResumeState,
    shouldBlockHiddenSystemAutoResume,
    suspendNextTrackPrefetch;

  function ensureGlobalAudio() {
    // Declaring the document as long-form playback lets supporting WebKit
    // versions arbitrate the PWA like a media player once audio becomes audible.
    // This does not start playback or claim focus while the player is idle.
    configurePlaybackAudioSession();

    if (!audioState.homeModeInitialized) {
      audioState.homeMode = readHomePlayMode();
      audioState.nowPlayingVolumeVisible = readNowPlayingVolumeVisible();
      audioState.homeModeInitialized = true;
    }

    const root = getSpaPersistRoot();

    if (audioState.audio) {
      audioState.audio.crossOrigin = "anonymous";
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
      audio.crossOrigin = "anonymous";
      audio.setAttribute("playsinline", "");
      root.appendChild(audio);
    } else {
      audio.crossOrigin = "anonymous";
      audio.preload = "none";
      root.appendChild(audio);
    }

    audioState.audio = audio;
    bindMediaSessionActions();

    audio.addEventListener("play", function () {
      const authorizedSystemResume = consumeAuthorizedSystemInterruptionResume(audio);
      if (!authorizedSystemResume && shouldBlockHiddenSystemAutoResume(audio)) {
        const guard = audioState.systemInterruptionGuard || {};
        trackAudioRuntimeEvent(
          "system_auto_resume_blocked",
          Object.assign(
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
          )
        );
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
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
      audioState.resumeOnVisible = false;
      syncAudioUi();
      syncMediaSessionMetadata({ forcePosition: true });
      startAudioRaf();
      startAudioTelemetryHeartbeat();
      const activeExternalCommand = audioState.externalPlaybackCommand;
      if (activeExternalCommand) {
        emitExternalMediaCommand(activeExternalCommand, {
          decision: "resume",
          outcome: activeExternalCommand.coldStart ? "success" : "dispatched",
          probe_stage: "audio_play_event",
          confirmed: true
        });
        if (activeExternalCommand.interruptionToken) {
          const interruptionSource = String(activeExternalCommand.interruptionSrc || "");
          const currentSource = getCurrentAudioResumeKey(audio);
          const interruptionPosition = Number(activeExternalCommand.interruptionCurrentTime);
          const currentPosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
          const sameTrack = Boolean(
            interruptionSource && currentSource && srcMatches(interruptionSource, currentSource)
          );
          emitAudioInterruption(
            {
              token: activeExternalCommand.interruptionToken,
              currentTime: Number.isFinite(interruptionPosition)
                ? interruptionPosition
                : activeExternalCommand.beforeCurrentTime
            },
            {
              phase: "resumed",
              outcome: "success",
              command_token: activeExternalCommand.id,
              native_play_observed: true,
              resume_gate_reason: "audio_play_event",
              same_track: sameTrack,
              position_delta_ms: Number.isFinite(interruptionPosition)
                ? Math.max(0, Math.round(Math.abs(currentPosition - interruptionPosition) * 1000))
                : null
            }
          );
        }
      }
      trackAudioRuntimeEvent(
        "audio_play",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState()
        )
      );
    });

    audio.addEventListener("pause", function () {
      if (audioState.trackFailureRecovery && audioState.trackFailureRecovery.timer) {
        window.clearTimeout(audioState.trackFailureRecovery.timer);
      }
      audioState.trackFailureRecovery = null;
      const pauseIntent = consumeAudioPauseIntent();
      const pauseContext = classifyAudioPause(audio, pauseIntent);
      if (pauseContext === "explicit" && audioState.trackStartInFlight) {
        audioState.trackStartInFlight = false;
        audioState.playAbortRetryToken = 0;
        audioState.startRequestToken = Number(audioState.startRequestToken || 0) + 1;
      }
      if (pauseIntent.reason !== "external_resume_recovery") {
        cancelExternalResumeCommand();
      }
      if (pauseContext === "system_midtrack") {
        rememberSystemInterruption(audio, pauseContext);
      } else if (pauseContext !== "system_suspected") {
        clearSystemInterruptionGuard();
      }
      audioState.mediaSessionAudioPlaying = false;
      clearWaitingRecovery({
        preserveStallRecovery: Boolean(
          audioState.stallRecovery &&
          pauseIntent.reason === "source_reset" &&
          pauseIntent.surface === "stall_recovery"
        )
      });
      audioState.resumeOnVisible = false;
      syncAudioUi();
      resyncMediaSessionControls();
      stopAudioRaf();
      stopAudioTelemetryHeartbeat();
      clearFadeTimer();
      saveResumeState();
      markAudioTelemetryInactive();
      if (pauseContext !== "internal" && !audioState.activeAudioRecovery && !audioState.stallRecovery) {
        resumeAlbumCoverWarmupWhenIdle("audio_pause");
      }
      trackAudioRuntimeEvent(
        "audio_pause",
        Object.assign(
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
        )
      );
    });

    audio.addEventListener("loadstart", function () {
      syncAudioUi();
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent(
        "first_byte",
        Object.assign(
          buildAudioMonitorPayload(
            track,
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            note: "loadstart navigateur, pas mesure réseau exacte",
            buffered_end: getAudioBufferedEnd(),
            ready_state: audio.readyState,
            network_state: audio.networkState
          }
        )
      );
    });

    audio.addEventListener("ended", function () {
      audioState.mediaSessionAudioPlaying = false;
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent(
        "ended",
        Object.assign(
          buildAudioMonitorPayload(
            track,
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            listened_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0,
            duration_ms: Number.isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
            buffered_end: getAudioBufferedEnd(),
            ready_state: audio.readyState,
            network_state: audio.networkState
          }
        )
      );
      trackAudioRuntimeEvent(
        "play_complete",
        Object.assign(
          buildAudioMonitorPayload(
            track,
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            listened_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0,
            duration_ms: Number.isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0
          }
        )
      );
      clearWaitingRecovery();
      stopAudioTelemetryHeartbeat();
      resumeAlbumCoverWarmupWhenIdle("audio_ended");
      saveResumeState();
      syncMediaSessionMetadata({ forcePosition: true });
      playNext({ seamless: true, auto: true });
    });

    audio.addEventListener("loadedmetadata", function () {
      audioState.sourceMetadataPending = false;
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
      clearWaitingRecovery({ preserveStallRecovery: Boolean(audioState.stallRecovery) });
      syncMediaSessionMetadata({ forcePosition: true });
      syncAudioUi();
    });

    audio.addEventListener("durationchange", function () {
      audioState.sourceMetadataPending = false;
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
      if (document.visibilityState === "hidden" && !audio.paused) {
        trackAudioRuntimeEvent("background_progress", {
          current_time: audioState.lastAudioCurrentTime,
          paused: false
        });
      }
      confirmAudioRecovery(audio);
      maybePrefetchNextTrack("timeupdate");
      const now = Date.now();
      if (!audioState.lastResumeSaveTs || now - audioState.lastResumeSaveTs >= 5000) {
        audioState.lastResumeSaveTs = now;
        saveResumeState();
      }
    });

    audio.addEventListener("seeking", function () {
      suspendNextTrackPrefetch("seeking");
      const track = getCurrentPlaylistTrack();
      trackAudioRuntimeEvent(
        "seek",
        Object.assign(
          buildAudioMonitorPayload(
            track,
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            from_ms: Number.isFinite(audioState.lastAudioCurrentTime)
              ? Math.floor(audioState.lastAudioCurrentTime * 1000)
              : 0,
            to_ms: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime * 1000) : 0
          }
        )
      );
    });

    audio.addEventListener("progress", function () {
      maybePrefetchNextTrack("progress");
      const currentSrc = audioState.activeLogicalSrc || audio.currentSrc || audio.src || "";
      if (!currentSrc || audioState.loggedCacheHitSrc === currentSrc) return;
      if (
        !Number.isFinite(audio.duration) ||
        audio.duration <= 0 ||
        !audio.buffered ||
        !audio.buffered.length
      )
        return;
      let bufferedEnd = 0;
      try {
        bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      } catch (_err) {
        return;
      }
      if (Number.isFinite(bufferedEnd) && bufferedEnd >= audio.duration * 0.95) {
        audioState.loggedCacheHitSrc = currentSrc;
        trackAudioRuntimeEvent(
          "cache_hit",
          Object.assign(
            buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, currentSrc),
            { duration_ms: Math.floor(audio.duration * 1000) }
          )
        );
      }
    });

    audio.addEventListener("waiting", function () {
      suspendNextTrackPrefetch("waiting");
      trackAudioRuntimeEvent(
        "waiting",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState()
        )
      );
      setTrackStatus(getTrackByIndex(audioState.currentIndex), "Chargement du fichier audio...");
      scheduleWaitingRecovery();
    });
    audio.addEventListener("stalled", function () {
      suspendNextTrackPrefetch("stalled");
      trackAudioRuntimeEvent(
        "stalled",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState()
        )
      );
      setTrackStatus(getTrackByIndex(audioState.currentIndex), "Chargement du fichier audio...");
      scheduleWaitingRecovery();
    });
    audio.addEventListener("suspend", function () {
      trackAudioRuntimeEvent(
        "suspend",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState()
        )
      );
    });
    audio.addEventListener("canplay", function () {
      const track = getCurrentPlaylistTrack();
      const delay = audioState.playRequestTs ? Date.now() - audioState.playRequestTs : null;
      logAudioAuditEvent(
        "canplay",
        track,
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src,
        {
          request_token: audioState.playRequestToken,
          delay_ms: Number.isFinite(delay) ? delay : undefined,
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        }
      );
      trackAudioRuntimeEvent(
        "playable",
        Object.assign(
          buildAudioMonitorPayload(
            track,
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            delay_ms: Number.isFinite(delay) ? delay : undefined,
            ready_state: audio.readyState,
            network_state: audio.networkState,
            click_perf_ms: audioState.audioClickPerfTs
          }
        )
      );
      clearWaitingRecovery({ preserveStallRecovery: Boolean(audioState.stallRecovery) });
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
      maybePrefetchNextTrack("canplay");
    });
    audio.addEventListener("canplaythrough", function () {
      clearWaitingRecovery({ preserveStallRecovery: Boolean(audioState.stallRecovery) });
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
    });
    audio.addEventListener("playing", function () {
      audioState.mediaSessionAudioPlaying = true;
      logAudioAuditEvent(
        "playing",
        getCurrentPlaylistTrack(),
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src,
        {
          request_token: audioState.playRequestToken,
          buffered_end: getAudioBufferedEnd(),
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        }
      );
      startAudioTelemetryHeartbeat();
      if (audioState.lastMonitorPlayToken !== audioState.playRequestToken) {
        audioState.lastMonitorPlayToken = audioState.playRequestToken;
        sendAudioMonitoringLog(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || audio.currentSrc || audio.src,
          {
            error: false
          }
        );
      }
      clearWaitingRecovery();
      audioState.trackStartInFlight = false;
      maybePrefetchNextTrack("playing");
      clearTrackFailureForCurrent();
      clearTrackStatus(getTrackByIndex(audioState.currentIndex));
      syncMediaSessionMetadata({ forcePosition: true });
    });
    audio.addEventListener("error", function () {
      audioState.mediaSessionAudioPlaying = false;
      const mediaErr = audio.error;
      if (mediaErr && mediaErr.code === 1) {
        // MEDIA_ERR_ABORTED can happen during normal source switches.
        return;
      }
      const mediaErrorCode = mediaErr && Number.isFinite(mediaErr.code) ? mediaErr.code : 0;
      const mediaErrorNames = {
        1: "MEDIA_ERR_ABORTED",
        2: "MEDIA_ERR_NETWORK",
        3: "MEDIA_ERR_DECODE",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED"
      };
      const mediaErrorName = mediaErrorNames[mediaErrorCode] || "MEDIA_ERR_UNKNOWN";
      const mediaErrorMessage = mediaErr && mediaErr.message ? mediaErr.message : mediaErrorName;
      suspendNextTrackPrefetch("media_error");
      trackAudioRuntimeEvent(
        "error",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          {
            error_code: mediaErrorCode,
            error_name: mediaErrorName,
            error_message: mediaErrorMessage,
            ready_state: audio.readyState,
            network_state: audio.networkState
          }
        )
      );
      sendAudioMonitoringLog(
        getCurrentPlaylistTrack(),
        audioState.currentIndex,
        audioState.activeLogicalSrc || audio.currentSrc || audio.src,
        {
          error: true,
          error_code: mediaErrorCode,
          error_name: mediaErrorName,
          error_message: mediaErrorMessage
        }
      );
      stopAudioTelemetryHeartbeat();
      clearWaitingRecovery();
      const fallbackIndex = ensureCurrentIndexFromAudio();
      const index =
        Number.isInteger(audioState.currentIndex) && audioState.currentIndex >= 0
          ? audioState.currentIndex
          : fallbackIndex;
      const currentSrc = getCurrentLogicalAudioSrc();
      if (index >= 0) {
        if (audioState.playAbortRetryToken === audioState.startRequestToken) return;
        audioState.playAbortRetryToken = 0;
        setTrackStatus(getTrackByIndex(index), "Chargement du fichier audio...");
        recoverFromTrackFailure(index, currentSrc, audioState.startRequestToken);
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
          // Reassert the exact iOS remote-control contract before WebKit hands
          // the active session to the lock screen / Notification Center.
          resyncMediaSessionControls();
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

  return {
    link() {
      ({
        cancelExternalResumeCommand,
        classifyAudioPause,
        clearSystemInterruptionGuard,
        consumeAudioPauseIntent,
        consumeAuthorizedSystemInterruptionResume,
        emitAudioInterruption,
        emitExternalMediaCommand,
        getAudioRemainingSeconds,
        getCurrentAudioResumeKey,
        hasFreshExternalPlaybackCommand,
        markAudioPauseIntent,
        maybePrefetchNextTrack,
        readHomePlayMode,
        rememberSystemInterruption,
        restoreResumeState,
        resumeAlbumCoverWarmupWhenIdle,
        resyncMediaSessionControls,
        saveResumeState,
        shouldBlockHiddenSystemAutoResume,
        suspendNextTrackPrefetch
      } = R);
    },
    fns: { ensureGlobalAudio, stopAudioRaf, startAudioRaf }
  };
}
