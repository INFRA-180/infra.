// Commandes externes (écran verrouillé, casque, CarPlay) et interruptions du système (appel, Siri).
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createExternalCommands(R) {
  const {
    SYSTEM_INTERRUPTION_GUARD_MS,
    SYSTEM_INTERRUPTION_NEAR_END_SECONDS,
    audioState,
    bindMediaSessionActions,
    buildAudioMonitorPayload,
    canAllowSystemInterruptionResume,
    getAudioRuntimeProbeState,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    scheduleAlbumCoverCacheWarmup,
    srcMatches,
    syncMediaSessionMetadata,
    trackAudioRuntimeEvent
  } = R;

  function createExternalMediaCommand(action, surface, audio) {
    audioState.mediaCommandSequence = Number(audioState.mediaCommandSequence || 0) + 1;
    return {
      id: `cmd-${String(action || "media")}-${Date.now().toString(36)}-${audioState.mediaCommandSequence}`,
      sequence: audioState.mediaCommandSequence,
      action: String(action || "play"),
      at: Date.now(),
      surface: String(surface || "media_session"),
      beforePaused: Boolean(audio && audio.paused),
      beforeCurrentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    };
  }

  function getRemoteSurfaceHint(surface) {
    if (String(surface || "") !== "media_session") return String(surface || "ui");
    if (document.visibilityState === "hidden") return "remote_hidden";
    if (document.visibilityState === "visible") return "remote_visible";
    return "remote_unknown";
  }

  function emitExternalMediaCommand(command, details) {
    if (!command || !command.id) return;
    const audio = audioState.audio;
    trackAudioRuntimeEvent(
      "media_command",
      Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || ""
        ),
        {
          command_token: command.id,
          command_sequence: command.sequence || 0,
          action: command.action || "play",
          origin: command.surface === "media_session" ? "media_session" : "transport",
          surface: command.surface || "media_session",
          surface_hint: getRemoteSurfaceHint(command.surface),
          before_paused: Boolean(command.beforePaused),
          before_current_time: Number(command.beforeCurrentTime) || 0,
          after_paused: Boolean(audio && audio.paused),
          after_current_time: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          from_index: Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1,
          to_index: Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1,
          command_latency_ms: Math.max(0, Date.now() - command.at)
        },
        details || {}
      )
    );
  }

  function emitAudioInterruption(guard, details) {
    if (!guard || !guard.token) return;
    const audio = audioState.audio;
    trackAudioRuntimeEvent(
      "audio_interruption",
      Object.assign(
        buildAudioMonitorPayload(
          getCurrentPlaylistTrack(),
          audioState.currentIndex,
          audioState.activeLogicalSrc || (audio && (audio.currentSrc || audio.src)) || ""
        ),
        {
          interruption_token: guard.token,
          interruption_kind: "system_midtrack",
          origin: "system",
          surface_hint: getRemoteSurfaceHint("media_session"),
          before_current_time: Number(guard.currentTime) || 0,
          before_paused: false,
          after_current_time: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          after_paused: Boolean(audio && audio.paused)
        },
        details || {}
      )
    );
  }

  function resyncMediaSessionControls() {
    bindMediaSessionActions({ force: true, quiet: true });
    syncMediaSessionMetadata({ forcePosition: true });
  }

  function resumeAlbumCoverWarmupWhenIdle(reason) {
    if (!audioState.albumCoverWarmupResumePending || audioState.albumCoverCacheWarmupDone) return;
    audioState.albumCoverWarmupResumePending = false;
    scheduleAlbumCoverCacheWarmup(reason || "audio_idle_resume");
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
    const nearEnd =
      audio &&
      (audio.ended || (Number.isFinite(remaining) && remaining <= SYSTEM_INTERRUPTION_NEAR_END_SECONDS));
    if (nearEnd) return "ended";
    if (reason === "ui" || reason === "media_session") return "explicit";
    if (reason === "source_reset" || reason === "source_switch" || reason === "external_resume_recovery")
      return "internal";
    if (reason === "system_suspected" && document.visibilityState === "hidden") return "system_midtrack";
    if (reason === "system_suspected") return "system_suspected";
    return reason;
  }

  function clearSystemInterruptionGuard() {
    audioState.systemInterruptionGuard = null;
    audioState.audioSessionInterruptedAt = 0;
    audioState.audioSessionResumeAllowedUntil = 0;
  }

  function cancelSystemInterruptionResume(reason) {
    const guard = audioState.systemInterruptionGuard;
    if (guard && guard.token) {
      emitAudioInterruption(guard, {
        phase: "resume_cancelled",
        outcome: "explicit_pause",
        reason: String(reason || "explicit_pause")
      });
    }
    clearSystemInterruptionGuard();
  }

  function rememberSystemInterruption(audio, pauseContext) {
    const audioSession = navigator && navigator.audioSession ? navigator.audioSession : null;
    const audioSessionInterrupted = Boolean(
      audioSession && String(audioSession.state || "") === "interrupted"
    );
    if (pauseContext !== "system_midtrack" && !audioSessionInterrupted) return;
    if (audioSessionInterrupted) {
      audioState.audioSessionInterruptedAt = Date.now();
      audioState.audioSessionResumeAllowedUntil = 0;
    }
    audioState.audioInterruptionSequence = Number(audioState.audioInterruptionSequence || 0) + 1;
    audioState.systemInterruptionGuard = {
      token: `interruption-${Date.now().toString(36)}-${audioState.audioInterruptionSequence}`,
      at: Date.now(),
      src: getCurrentAudioResumeKey(audio),
      currentTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    };
    emitAudioInterruption(audioState.systemInterruptionGuard, {
      phase: "paused",
      outcome: "detected"
    });
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

  function consumeAuthorizedSystemInterruptionResume(audio) {
    const guard = audioState.systemInterruptionGuard;
    const audioSession = navigator && navigator.audioSession ? navigator.audioSession : null;
    const now = Date.now();
    const sampledInterruptionFallback = Boolean(
      audioSession &&
      String(audioSession.state || "") === "active" &&
      Number.isFinite(audioState.audioSessionInterruptedAt) &&
      audioState.audioSessionInterruptedAt > 0 &&
      guard &&
      Number.isFinite(guard.at) &&
      now - guard.at <= SYSTEM_INTERRUPTION_GUARD_MS
    );
    const currentSrc = getCurrentAudioResumeKey(audio);
    const savedPosition = Number(guard && guard.currentTime);
    let currentPosition = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    let positionRestored = false;
    const sampledActiveSourceMatch = Boolean(
      guard &&
      String((audioSession && audioSession.state) || "") === "active" &&
      guard.src &&
      currentSrc &&
      srcMatches(guard.src, currentSrc)
    );
    if (
      sampledActiveSourceMatch &&
      Number.isFinite(savedPosition) &&
      savedPosition > 2 &&
      currentPosition <= 0.75
    ) {
      try {
        audio.currentTime = savedPosition;
        currentPosition = audio.currentTime;
        positionRestored = Math.abs(currentPosition - savedPosition) < 2;
      } catch (_err) {
        positionRestored = false;
      }
    }
    const positionDeltaMs =
      Number.isFinite(savedPosition) && Number.isFinite(currentPosition)
        ? Math.round(Math.abs(currentPosition - savedPosition) * 1000)
        : null;
    const allowed = canAllowSystemInterruptionResume({
      guard,
      now,
      allowedUntil: audioState.audioSessionResumeAllowedUntil || (sampledInterruptionFallback ? now + 1 : 0),
      audioSessionState: audioSession && audioSession.state,
      currentSrc,
      currentTime: currentPosition,
      allowPositionReset: positionRestored,
      srcMatches
    });
    if (!allowed) {
      if (guard && guard.token) {
        emitAudioInterruption(guard, {
          phase: "resume_refused",
          outcome: "guard_rejected",
          resume_gate_reason:
            String((audioSession && audioSession.state) || "") !== "active"
              ? "audio_session_not_active"
              : !currentSrc || !guard.src || !srcMatches(guard.src, currentSrc)
                ? "source_changed"
                : "position_delta",
          position_delta_ms: positionDeltaMs,
          native_play_observed: true
        });
      }
      return false;
    }
    audioState.audioSessionResumeAllowedUntil = 0;
    emitAudioInterruption(guard, {
      phase: "resumed",
      outcome: "system_resume_allowed",
      audio_session_state: "active",
      resume_gate_reason: sampledInterruptionFallback ? "sampled_active" : "statechange_active",
      position_delta_ms: positionDeltaMs,
      native_play_observed: true
    });
    clearSystemInterruptionGuard();
    return true;
  }

  function scheduleSystemInterruptionResumeAfterActive(trigger) {
    const guard = audioState.systemInterruptionGuard;
    const audio = audioState.audio;
    const audioSession = navigator && navigator.audioSession ? navigator.audioSession : null;
    const now = Date.now();
    if (!guard || !guard.token || !audio || String((audioSession && audioSession.state) || "") !== "active")
      return false;
    if (!Number.isFinite(guard.at) || now - guard.at > SYSTEM_INTERRUPTION_GUARD_MS) return false;
    if (guard.resumeScheduled || guard.resumeAttempted) return false;
    const currentSrc = getCurrentAudioResumeKey(audio);
    if (!guard.src || !currentSrc || !srcMatches(guard.src, currentSrc)) {
      emitAudioInterruption(guard, {
        phase: "resume_refused",
        outcome: "guard_rejected",
        resume_gate_reason: "source_changed",
        native_play_observed: false
      });
      clearSystemInterruptionGuard();
      return false;
    }
    audioState.audioSessionResumeAllowedUntil = Math.max(
      Number(audioState.audioSessionResumeAllowedUntil) || 0,
      now + 8000
    );
    guard.resumeScheduled = true;
    guard.activeObservedAt = now;
    window.setTimeout(function () {
      if (audioState.systemInterruptionGuard !== guard || guard.resumeAttempted) return;
      guard.resumeScheduled = false;
      if (!audio.paused) return;
      const sampledState = String((audioSession && audioSession.state) || "");
      const sampledSrc = getCurrentAudioResumeKey(audio);
      if (sampledState !== "active" || !sampledSrc || !srcMatches(guard.src, sampledSrc)) return;
      const savedPosition = Number(guard.currentTime);
      let currentPosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      if (Number.isFinite(savedPosition) && savedPosition > 2 && currentPosition <= 0.75) {
        try {
          audio.currentTime = savedPosition;
          currentPosition = audio.currentTime;
        } catch (_err) {
          // The position gate below rejects the resume if iOS refuses the seek.
        }
      }
      const positionDeltaMs = Number.isFinite(savedPosition)
        ? Math.round(Math.abs(currentPosition - savedPosition) * 1000)
        : null;
      if (
        !canAllowSystemInterruptionResume({
          guard,
          now: Date.now(),
          allowedUntil: audioState.audioSessionResumeAllowedUntil,
          audioSessionState: sampledState,
          currentSrc: sampledSrc,
          currentTime: currentPosition,
          srcMatches
        })
      ) {
        emitAudioInterruption(guard, {
          phase: "resume_refused",
          outcome: "guard_rejected",
          resume_gate_reason: "position_delta",
          position_delta_ms: positionDeltaMs,
          native_play_observed: false
        });
        return;
      }
      guard.resumeAttempted = true;
      emitAudioInterruption(guard, {
        phase: "resume_attempt",
        outcome: "guarded_play",
        resume_gate_reason: String(trigger || "sampled_active"),
        position_delta_ms: positionDeltaMs,
        native_play_observed: false
      });
      let playPromise;
      try {
        playPromise = audio.play();
      } catch (_err) {
        playPromise = Promise.reject(_err);
      }
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {
          if (audioState.systemInterruptionGuard !== guard) return;
          emitAudioInterruption(guard, {
            phase: "resume_refused",
            outcome: "play_rejected",
            resume_gate_reason: "play_promise_rejected",
            position_delta_ms: positionDeltaMs,
            native_play_observed: false
          });
        });
      }
    }, 500);
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
    command.recoveryInFlight = true;
    emitExternalMediaCommand(command, {
      decision: "resume",
      outcome: "no_progress",
      recovery_attempted: true,
      probe_1500_ms: Math.max(0, Math.round(((audio.currentTime || 0) - startTime) * 1000))
    });
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

    Promise.resolve()
      .then(function () {
        return audio.play();
      })
      .then(function () {
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
          activeCommand.recoveryInFlight = false;
          activeCommand.finalOutcome = recovered ? "recovered" : "recovery_failed";
          emitExternalMediaCommand(activeCommand, {
            decision: "resume",
            outcome: recovered ? "recovered" : "recovery_failed",
            recovery_attempted: true,
            recovery_reason: recovered ? "guarded_replay" : "no_progress",
            advanced_ms: Math.round(advanced * 1000),
            probe_stage: "recovery_900"
          });
          audioState.externalResumeRecoveryInFlight = false;
        }, 900);
        audioState.externalResumeProbeTimers.push(timer);
      })
      .catch(function (err) {
        if (!audioState.externalPlaybackCommand || audioState.externalPlaybackCommand.id !== commandId)
          return;
        trackAudioRuntimeEvent(
          "external_resume_recovery_failed",
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
              recovery_ms: Date.now() - recoveryStartedAt,
              paused: Boolean(audio.paused),
              error_name: err && err.name ? err.name : "Error",
              error_message: err && err.message ? err.message : "external_resume_recovery_rejected"
            }
          )
        );
        const activeCommand = audioState.externalPlaybackCommand;
        if (activeCommand) {
          activeCommand.recoveryInFlight = false;
          activeCommand.finalOutcome = "recovery_failed";
        }
        emitExternalMediaCommand(activeCommand, {
          decision: "resume",
          outcome: "recovery_failed",
          recovery_attempted: true,
          recovery_reason: err && err.name ? err.name : "play_rejected",
          probe_stage: "recovery_rejected"
        });
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
        trackAudioRuntimeEvent(
          "resume_probe",
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
              delay_ms: delayMs,
              advanced_ms: Math.round(advanced * 1000),
              confirmed: Boolean(!audio.paused && advanced >= (delayMs >= 3000 ? 1 : 0.2)),
              paused: Boolean(audio.paused)
            }
          )
        );
        const probeField =
          delayMs === 600 ? "probe_600_ms" : delayMs === 1500 ? "probe_1500_ms" : "probe_3000_ms";
        const confirmed = Boolean(!audio.paused && advanced >= (delayMs >= 3000 ? 1 : 0.2));
        if (confirmed && !command.finalOutcome) command.finalOutcome = "success";
        const commandUpdate = {
          decision: "resume",
          outcome:
            command.finalOutcome ||
            (command.recoveryInFlight
              ? "no_progress"
              : delayMs === 3000
                ? confirmed
                  ? "success"
                  : "no_progress"
                : "dispatched"),
          probe_stage: `probe_${delayMs}`,
          confirmed,
          advanced_ms: Math.round(advanced * 1000)
        };
        commandUpdate[probeField] = Math.round(advanced * 1000);
        emitExternalMediaCommand(command, commandUpdate);
        if (delayMs === 1500 && !audio.paused && advanced < 0.35) {
          recoverStuckExternalResume(audio, commandId, surface, startTime);
        }
      }, delayMs);
      audioState.externalResumeProbeTimers.push(timer);
    });
  }

  return {
    link() {},
    fns: {
      createExternalMediaCommand,
      getRemoteSurfaceHint,
      emitExternalMediaCommand,
      emitAudioInterruption,
      resyncMediaSessionControls,
      resumeAlbumCoverWarmupWhenIdle,
      markAudioPauseIntent,
      consumeAudioPauseIntent,
      clearExternalResumeProbeTimers,
      cancelExternalResumeCommand,
      getAudioRemainingSeconds,
      getCurrentAudioResumeKey,
      classifyAudioPause,
      clearSystemInterruptionGuard,
      cancelSystemInterruptionResume,
      rememberSystemInterruption,
      hasFreshExternalPlaybackCommand,
      shouldBlockHiddenSystemAutoResume,
      consumeAuthorizedSystemInterruptionResume,
      scheduleSystemInterruptionResumeAfterActive,
      recoverStuckExternalResume,
      scheduleExternalResumeProbes
    }
  };
}
