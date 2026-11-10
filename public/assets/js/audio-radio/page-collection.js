// Lecture depuis une commande externe et depuis l'album ou la playlist de la page.
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createPageCollection(R) {
  const {
    audioState,
    buildAudioMonitorPayload,
    getAudioRuntimeProbeState,
    getCurrentLogicalAudioSrc,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    getRandomIndex,
    normalizeAlbumTitle,
    normalizeTrackTitle,
    resolveManagedAudioSrc,
    srcMatches,
    startRadioPlaybackFromIdle,
    startTrack,
    syncMediaSessionMetadata,
    syncPlaylistContext,
    togglePlayPause,
    trackAudioRuntimeEvent
  } = R;
  let canStartInitialGlobalRandomPlayback,
    cancelExternalResumeCommand,
    clearRadioQueue,
    clearSystemInterruptionGuard,
    createExternalMediaCommand,
    emitExternalMediaCommand,
    ensureGlobalAudio,
    getCurrentAudioResumeKey,
    persistHomePlayMode,
    prepareInitialGlobalRandomPlayback,
    reseedShuffleHistoryForCurrentTrack,
    resetPreparedInitialGlobalRandomPlayback,
    savePlaybackQueueContext,
    scheduleExternalResumeProbes,
    startGlobalRandomPlayback,
    startSelectedTrackInRadioFromCold;

  function playFromExternalControl(surface) {
    const audio = audioState.audio || ensureGlobalAudio();
    if (!audio) return;
    const commandNow = Date.now();
    const previousCommand = audioState.externalPlaybackCommand;
    if (previousCommand && commandNow - previousCommand.at < 400) {
      const duplicateCommand = createExternalMediaCommand("play", surface, audio);
      trackAudioRuntimeEvent(
        "external_play_duplicate",
        Object.assign(
          buildAudioMonitorPayload(
            getCurrentPlaylistTrack(),
            audioState.currentIndex,
            audioState.activeLogicalSrc || audio.currentSrc || audio.src
          ),
          getAudioRuntimeProbeState(),
          {
            command_id: duplicateCommand.id,
            surface: surface || "",
            duplicate_after_ms: Math.max(0, commandNow - previousCommand.at),
            paused: Boolean(audio.paused)
          }
        )
      );
      emitExternalMediaCommand(duplicateCommand, {
        decision: "resume",
        outcome: "dedup",
        reason: "command_window"
      });
      return;
    }
    if (!audio.paused) {
      const noopCommand = createExternalMediaCommand("play", surface, audio);
      emitExternalMediaCommand(noopCommand, {
        decision: "resume",
        outcome: "noop",
        reason: "already_playing"
      });
      return;
    }
    cancelExternalResumeCommand();
    const interruptionGuard = audioState.systemInterruptionGuard;
    const command = createExternalMediaCommand("play", surface, audio);
    if (interruptionGuard && interruptionGuard.token) {
      command.interruptionToken = interruptionGuard.token;
      command.interruptionSrc = interruptionGuard.src || getCurrentAudioResumeKey(audio);
      command.interruptionCurrentTime = Number(interruptionGuard.currentTime) || 0;
    }
    clearSystemInterruptionGuard();
    const commandId = command.id;
    audioState.externalPlaybackCommand = command;

    if (!getCurrentPlayableAudioSrc(audio)) {
      command.coldStart = true;
      trackAudioRuntimeEvent("media_session_play", {
        command_id: commandId,
        surface: surface || "",
        mode: "cold_start"
      });
      emitExternalMediaCommand(command, {
        decision: "resume",
        outcome: "dispatched",
        reason: "cold_start"
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
        const startIndex =
          audioState.currentIndex >= 0
            ? audioState.currentIndex
            : audioState.shuffleOn
              ? getRandomIndex(-1)
              : 0;
        trackAudioRuntimeEvent("external_play_start", {
          surface: surface || "",
          mode: "playlist",
          index: startIndex
        });
        startTrack(startIndex >= 0 ? startIndex : 0, {
          resume: true,
          fromMediaSession: surface === "media_session",
          fromTransportControl: surface !== "media_session",
          surface: surface || "media_session",
          commandToken: commandId,
          commandSequence: command.sequence,
          commandStartedAt: command.at,
          mediaAction: "play",
          mediaDecision: "resume"
        });
      }
      return;
    }

    trackAudioRuntimeEvent("external_play_resume", {
      command_id: commandId,
      surface: surface || "",
      current_time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    });
    trackAudioRuntimeEvent(
      "media_session_play",
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
          mode: "resume"
        }
      )
    );
    emitExternalMediaCommand(command, {
      decision: "resume",
      outcome: "dispatched",
      probe_stage: "command_received"
    });
    const startTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    scheduleExternalResumeProbes(audio, commandId, surface, startTime);
    audio
      .play()
      .then(function () {
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
              delay_ms: 0,
              stage: "play_promise",
              confirmed: Boolean(!audio.paused),
              paused: Boolean(audio.paused)
            }
          )
        );
        emitExternalMediaCommand(command, {
          decision: "resume",
          outcome: "dispatched",
          probe_stage: "play_promise",
          confirmed: Boolean(!audio.paused)
        });
      })
      .catch(function (err) {
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
              delay_ms: 0,
              stage: "play_rejected",
              confirmed: false,
              paused: Boolean(audio.paused),
              error_name: err && err.name ? err.name : "Error",
              error_message: err && err.message ? err.message : "external_play_rejected"
            }
          )
        );
        command.finalOutcome = "rejected";
        emitExternalMediaCommand(command, {
          decision: "resume",
          outcome: "rejected",
          probe_stage: "play_rejected",
          reason: err && err.name ? err.name : "Error",
          confirmed: false
        });
      });
  }

  function getCurrentPageCollectionContext() {
    const isCollectionPage = Boolean(document.body && document.body.classList.contains("album-screen"));
    const ui = audioState.ui;
    const collection =
      ui && Array.isArray(ui.playlist)
        ? ui.playlist.filter(function (track) {
            return track && track.src;
          })
        : [];
    if (!isCollectionPage || !ui || !collection.length) return null;
    return {
      ui,
      collection,
      collectionKind: ui.playlistKind === "playlist" ? "playlist" : "album"
    };
  }

  function getCurrentPageColdTrackFromDom() {
    if (!document.body || !document.body.classList.contains("album-screen")) return null;
    const routeHost = document.getElementById("infraSpaRouteHost");
    const routeRoot =
      document.querySelector(
        "#infraSpaRouteHost .spa-route-layer.album-screen[data-spa-route-state='current']"
      ) || (!routeHost ? document : null);
    if (!routeRoot || typeof routeRoot.querySelector !== "function") return null;

    const row = routeRoot.querySelector(".tracks .track-player");
    const audioElement = row && row.querySelector("audio");
    const rawSrc = audioElement
      ? String(audioElement.getAttribute("data-src") || audioElement.getAttribute("src") || "").trim()
      : "";
    const src = rawSrc ? resolveManagedAudioSrc(rawSrc, window.location.href) : "";
    if (!src) return null;

    const name = row.querySelector(".track-name");
    const heading = routeRoot.querySelector("main.page > h1, main > h1, .album-hero h1");
    const cover = routeRoot.querySelector(".album-layout .cover, .album-hero .cover");
    const rawArtwork = cover ? String(cover.currentSrc || cover.getAttribute("src") || "").trim() : "";
    let artwork = "";
    try {
      artwork = rawArtwork ? new URL(rawArtwork, window.location.href).href : "";
    } catch (_err) {
      artwork = rawArtwork;
    }

    return {
      src,
      name: normalizeTrackTitle(name ? name.textContent : ""),
      album: normalizeAlbumTitle(heading ? heading.textContent : ""),
      page: window.location.href,
      artist: "INFRA.",
      artwork
    };
  }

  function adoptCurrentPageCollection(context, startIndex) {
    if (!context || !Array.isArray(context.collection) || !context.collection.length) return -1;
    const nextPlaylist = context.collection.map(function (track) {
      return Object.assign({}, track);
    });
    const nextIndex = Math.max(0, Math.min(Number(startIndex) || 0, nextPlaylist.length - 1));

    audioState.modeTransitionToken = Number(audioState.modeTransitionToken || 0) + 1;
    audioState.radioNavigationRequest = null;
    audioState.radioNavigationPromise = null;
    resetPreparedInitialGlobalRandomPlayback();
    clearRadioQueue();
    audioState.homeMode = "album";
    persistHomePlayMode("album");
    audioState.shuffleOn = false;
    audioState.shuffleSessionSeed = "";
    audioState.shuffleHistory = [];
    audioState.shuffleHistoryCursor = -1;
    audioState.upcomingTrackPlan = null;
    audioState.playlistKind = context.collectionKind;
    audioState.playlist = nextPlaylist;
    audioState.currentIndex = nextIndex;
    audioState.albumPlaylistSnapshot = context.collectionKind === "album" ? nextPlaylist.slice() : [];
    audioState.albumIndexSnapshot = context.collectionKind === "album" ? nextIndex : -1;
    syncPlaylistContext(audioState.playlist);
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    return nextIndex;
  }

  function startCurrentPageCollectionFromIdle(audioElement) {
    const audio = audioElement || audioState.audio;
    const context = getCurrentPageCollectionContext();

    if (
      !context ||
      !audio ||
      !audio.paused ||
      audioState.trackStartInFlight ||
      getCurrentPlayableAudioSrc(audio) ||
      getCurrentLogicalAudioSrc()
    ) {
      return false;
    }

    const startIndex = adoptCurrentPageCollection(context, 0);
    if (startIndex < 0) return false;
    trackAudioRuntimeEvent("collection_cold_start", {
      collection_kind: context.collectionKind,
      tracks_count: context.collection.length,
      start_index: startIndex,
      source: "global_transport"
    });
    startTrack(startIndex, {
      seamless: true,
      immediatePlay: true,
      userGesture: true,
      coldStart: true,
      surface: context.collectionKind === "playlist" ? "playlist_cold" : "album_cold"
    });
    return true;
  }

  function playCurrentPageCollectionShuffled() {
    const context = getCurrentPageCollectionContext();
    if (!context) return;
    const index = adoptCurrentPageCollection(context, Math.floor(Math.random() * context.collection.length));
    if (index < 0) return;
    audioState.shuffleOn = true;
    reseedShuffleHistoryForCurrentTrack({ renewSeed: true, currentSrc: context.collection[index].src });
    savePlaybackQueueContext();
    startTrack(index, {
      seamless: true,
      immediatePlay: true,
      userGesture: true,
      surface: context.collectionKind === "playlist" ? "playlist_shuffle" : "album_shuffle"
    });
  }

  function isCurrentPagePlaylistActive(collection) {
    return (
      audioState.playlistKind === "playlist" &&
      Array.isArray(audioState.playlist) &&
      audioState.playlist.length === collection.length &&
      collection.every(function (track, index) {
        return srcMatches(track.src, audioState.playlist[index]?.src);
      })
    );
  }

  function toggleCurrentPageCollection() {
    const audio = audioState.audio || ensureGlobalAudio();
    const context = getCurrentPageCollectionContext();
    if (!audio || !context) return false;

    const currentSrc = getCurrentLogicalAudioSrc() || getCurrentPlayableAudioSrc(audio);
    if (
      context.collectionKind === "album" &&
      !currentSrc &&
      audio.paused &&
      !audioState.trackStartInFlight &&
      context.collection[0] &&
      startSelectedTrackInRadioFromCold(context.collection[0], {
        surface: "album_button_cold_radio"
      })
    ) {
      return true;
    }
    const isPlaylist = context.collectionKind === "playlist";
    const isActivePlaylist = isPlaylist && isCurrentPagePlaylistActive(context.collection);
    const currentIndex =
      currentSrc && (!isPlaylist || isActivePlaylist)
        ? context.collection.findIndex(function (track) {
            return track && srcMatches(track.src, currentSrc);
          })
        : -1;
    const startIndex =
      isActivePlaylist && currentIndex >= 0
        ? currentIndex
        : adoptCurrentPageCollection(context, currentIndex >= 0 ? currentIndex : 0);
    if (startIndex < 0) return false;

    if (currentIndex >= 0) {
      trackAudioRuntimeEvent("collection_button_toggle", {
        collection_kind: context.collectionKind,
        tracks_count: context.collection.length,
        start_index: startIndex,
        decision: audio.paused ? "resume_current" : "pause_current"
      });
      togglePlayPause();
      return true;
    }

    trackAudioRuntimeEvent("collection_button_toggle", {
      collection_kind: context.collectionKind,
      tracks_count: context.collection.length,
      start_index: startIndex,
      decision: "start_first"
    });
    startTrack(startIndex, {
      seamless: true,
      immediatePlay: true,
      userGesture: true,
      surface: context.collectionKind === "playlist" ? "playlist_button" : "album_button"
    });
    return true;
  }

  function handleGlobalTransportToggle() {
    const audio = audioState.audio || ensureGlobalAudio();
    const logicalSrc = getCurrentLogicalAudioSrc() || audioState.activeLogicalSrc || "";
    if (
      audio &&
      audio.paused &&
      !getCurrentPlayableAudioSrc(audio) &&
      !logicalSrc &&
      !audioState.globalRandomStartInFlight
    ) {
      if (canStartInitialGlobalRandomPlayback() && startGlobalRandomPlayback()) return;
      const coldCollection = getCurrentPageCollectionContext();
      if (
        coldCollection &&
        coldCollection.collection[0] &&
        startSelectedTrackInRadioFromCold(coldCollection.collection[0], {
          surface: "global_cold_radio"
        })
      ) {
        return;
      }
      const domColdTrack = getCurrentPageColdTrackFromDom();
      if (
        domColdTrack &&
        startSelectedTrackInRadioFromCold(domColdTrack, {
          surface: "global_dom_cold_radio"
        })
      ) {
        return;
      }
      prepareInitialGlobalRandomPlayback("cold_tap_not_ready");
      return;
    }
    if (startCurrentPageCollectionFromIdle(audio)) return;
    togglePlayPause();
  }

  return {
    link() {
      ({
        canStartInitialGlobalRandomPlayback,
        cancelExternalResumeCommand,
        clearRadioQueue,
        clearSystemInterruptionGuard,
        createExternalMediaCommand,
        emitExternalMediaCommand,
        ensureGlobalAudio,
        getCurrentAudioResumeKey,
        persistHomePlayMode,
        prepareInitialGlobalRandomPlayback,
        reseedShuffleHistoryForCurrentTrack,
        resetPreparedInitialGlobalRandomPlayback,
        savePlaybackQueueContext,
        scheduleExternalResumeProbes,
        startGlobalRandomPlayback,
        startSelectedTrackInRadioFromCold
      } = R);
    },
    fns: {
      playFromExternalControl,
      getCurrentPageCollectionContext,
      getCurrentPageColdTrackFromDom,
      adoptCurrentPageCollection,
      startCurrentPageCollectionFromIdle,
      playCurrentPageCollectionShuffled,
      isCurrentPagePlaylistActive,
      toggleCurrentPageCollection,
      handleGlobalTransportToggle
    }
  };
}
