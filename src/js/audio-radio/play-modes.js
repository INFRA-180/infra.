// File radio, changement de mode (album, radio, aléatoire).
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createPlayModes(R) {
  const {
    audioState,
    buildPreservedTrack,
    getCurrentLogicalAudioSrc,
    getCurrentPlaylistTrack,
    getRandomIndex,
    normalizeAudioSourceUrl,
    playNext,
    playPrevious,
    srcMatches,
    startTrack,
    syncAudioUi,
    syncMediaSessionMetadata,
    syncPlaylistContext
  } = R;
  let buildAlbumPlaylistFromRadioCache,
    buildRadioQueue,
    constrainPlaybackToCurrentAlbum,
    ensureRadioPlaylistLoaded,
    findPlaylistIndexByCurrentSrc,
    getTrackSource,
    maybePrefetchNextTrack,
    persistHomePlayMode,
    savePlaybackQueueContext,
    scopeAlbumPlaylistToCurrentTrack;

  function clearRadioQueue() {
    audioState.radioQueue = [];
    audioState.radioQueueCursor = -1;
  }

  function syncRadioQueueToPlaylist(options) {
    const opts = options || {};
    audioState.radioQueue = Array.isArray(audioState.radioQueue)
      ? audioState.radioQueue.filter(function (track) {
          return track && track.src;
        })
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

    if (audioState.radioQueueCursor > 100) {
      const trimCount = audioState.radioQueueCursor - 80;
      audioState.radioQueue = audioState.radioQueue.slice(trimCount);
      audioState.radioQueueCursor -= trimCount;
      audioState.currentIndex = audioState.radioQueueCursor;
      if (Array.isArray(audioState.recentPlayed)) {
        audioState.recentPlayed = audioState.recentPlayed
          .map(function (index) {
            return index - trimCount;
          })
          .filter(function (index) {
            return index >= 0;
          });
      }
    }

    const min = Math.max(0, Number(minRemaining) || audioState.radioQueueMinRemaining);
    const remaining = audioState.radioQueue.length - audioState.radioQueueCursor - 1;
    if (audioState.radioQueue.length && remaining >= min) {
      if (audioState.playlist !== audioState.radioQueue || audioState.playlistKind !== "radio") {
        syncRadioQueueToPlaylist({ preserveRecent: true });
      }
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
    const preservedTrack = buildPreservedTrack(
      track,
      track && track.src ? track.src : getCurrentLogicalAudioSrc()
    );
    if (!preservedTrack) return -1;

    if (!Array.isArray(audioState.radioQueue) || !audioState.radioQueue.length) {
      ensureRadioQueue(audioState.radioQueueMinRemaining);
    }

    let cursor =
      Number.isInteger(audioState.radioQueueCursor) && audioState.radioQueueCursor >= 0
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

    const replayDirection = direction === "previous" ? "previous" : "next";
    const replayOptions = Object.assign({}, opts, { radioNavigationRetry: true });
    const transitionToken = Number(audioState.modeTransitionToken || 0);
    const liveGuardSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
    const guardMatches = function (request) {
      if (!request) return false;
      const liveSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
      const sameSrc = request.src ? Boolean(liveSrc && srcMatches(request.src, liveSrc)) : !liveSrc;
      return Number(audioState.startRequestToken || 0) === request.startRequestToken && sameSrc;
    };
    const activeRequest = audioState.radioNavigationRequest;
    if (activeRequest && activeRequest.transitionToken === transitionToken) {
      if (guardMatches(activeRequest)) {
        if (activeRequest.commands.length < 8) {
          activeRequest.commands.push({ direction: replayDirection, options: replayOptions });
        }
        return false;
      }
      // A track selection made while Radio metadata was loading invalidates
      // the older batch; the current tap starts a fresh guarded request.
      audioState.radioNavigationRequest = null;
    }
    if (opts.radioNavigationRetry) return false;

    const request = {
      transitionToken,
      startRequestToken: Number(audioState.startRequestToken || 0),
      src: liveGuardSrc,
      commands: [{ direction: replayDirection, options: replayOptions }],
      promise: null
    };
    audioState.radioNavigationRequest = request;
    request.promise = ensureRadioPlaylistLoaded()
      .then(function (radioList) {
        if (audioState.radioNavigationRequest !== request) return;
        if (
          audioState.homeMode !== "radio" ||
          Number(audioState.modeTransitionToken || 0) !== transitionToken
        )
          return;
        if (!guardMatches(request)) return;
        if (!Array.isArray(radioList) || !radioList.length) return;
        if (!ensureRadioQueue(audioState.radioQueueMinRemaining)) return;
        const commands = request.commands.splice(0, request.commands.length);
        commands.forEach(function (command) {
          if (audioState.radioNavigationRequest !== request || audioState.homeMode !== "radio") return;
          if (command.direction === "previous") playPrevious(command.options);
          else playNext(command.options);
        });
      })
      .catch(function () {
        // Keep current playback if the global radio playlist cannot load.
      })
      .finally(function () {
        if (audioState.radioNavigationRequest === request) {
          audioState.radioNavigationRequest = null;
          audioState.radioNavigationPromise = null;
        }
      });
    audioState.radioNavigationPromise = request.promise;

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

    const transitionToken = Number(audioState.modeTransitionToken || 0) + 1;
    audioState.modeTransitionToken = transitionToken;
    audioState.radioNavigationRequest = null;
    audioState.radioNavigationPromise = null;
    audioState.homeMode = nextMode;
    persistHomePlayMode(nextMode);
    syncMediaSessionMetadata({ forcePosition: true });

    if (nextMode === "radio") {
      if (audioState.playlist.length && prevMode !== "radio") {
        const scopedSnapshot = scopeAlbumPlaylistToCurrentTrack(
          audioState.playlist,
          preservedTrack || currentTrack,
          audioState.currentIndex
        );
        audioState.albumPlaylistSnapshot = scopedSnapshot.playlist;
        audioState.albumIndexSnapshot = scopedSnapshot.currentIndex;
      }
      ensureRadioPlaylistLoaded()
        .then(function (radioList) {
          if (audioState.homeMode !== "radio" || audioState.modeTransitionToken !== transitionToken) return;
          if (!radioList.length) {
            syncMediaSessionMetadata({ forcePosition: true });
            syncAudioUi();
            return;
          }

          // The user may have selected another album track while the catalogue
          // promise was pending. Re-anchor Radio to the live source instead of
          // restoring the source captured when the mode button was pressed.
          const liveCurrentTrack = getCurrentPlaylistTrack();
          const liveCurrentSrc = getCurrentLogicalAudioSrc();
          const livePreservedTrack = buildPreservedTrack(liveCurrentTrack, liveCurrentSrc);
          const currentMatch = liveCurrentSrc
            ? radioList.findIndex((track) => track && srcMatches(track.src, liveCurrentSrc))
            : -1;
          clearRadioQueue();
          if (currentMatch >= 0) {
            injectCurrentTrackIntoRadioQueue(radioList[currentMatch]);
          } else if (livePreservedTrack) {
            injectCurrentTrackIntoRadioQueue(livePreservedTrack);
          } else if (ensureRadioQueue(audioState.radioQueueMinRemaining)) {
            if (audioState.radioQueueCursor < 0 && audioState.radioQueue.length) {
              audioState.radioQueueCursor = 0;
              syncRadioQueueToPlaylist({ preserveRecent: true });
            }
          }
          savePlaybackQueueContext();
          syncMediaSessionMetadata({ forcePosition: true });
          syncAudioUi();
          maybePrefetchNextTrack("mode_change");
        })
        .catch(function () {
          if (audioState.homeMode !== "radio" || audioState.modeTransitionToken !== transitionToken) return;
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
        if (!opts.deferPrefetch) maybePrefetchNextTrack("mode_change");
        return;
      }
      audioState.playlistKind = "album";
      const radioAlbumPlaylist =
        prevMode === "radio" ? buildAlbumPlaylistFromRadioCache(currentTrack || preservedTrack) : [];
      if (radioAlbumPlaylist.length) {
        audioState.playlist = radioAlbumPlaylist.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch =
          currentTrack && currentTrack.src
            ? audioState.playlist.findIndex((track) => srcMatches(track.src, currentTrack.src))
            : findPlaylistIndexByCurrentSrc(audioState.playlist);
        audioState.currentIndex = currentMatch >= 0 ? currentMatch : 0;
        audioState.albumPlaylistSnapshot = audioState.playlist.slice();
        audioState.albumIndexSnapshot = audioState.currentIndex;
        reseedShuffleHistoryForCurrentTrack({ renewSeed: false });
        savePlaybackQueueContext();
        syncMediaSessionMetadata({ forcePosition: true });
        syncAudioUi();
        if (!opts.deferPrefetch) maybePrefetchNextTrack("mode_change");
        return;
      }
      const albumAnchor = preservedTrack || currentTrack;
      const snapshotScope = scopeAlbumPlaylistToCurrentTrack(
        audioState.albumPlaylistSnapshot,
        albumAnchor,
        audioState.albumIndexSnapshot
      );
      const uiScope = scopeAlbumPlaylistToCurrentTrack(
        audioState.ui && audioState.ui.playlist,
        albumAnchor,
        audioState.currentIndex
      );
      const snapshot = snapshotScope.playlist;
      const uiPlaylist = uiScope.playlist;

      if (snapshot.length) {
        audioState.playlist = snapshot.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch =
          albumAnchor && albumAnchor.src
            ? audioState.playlist.findIndex((track) => srcMatches(track.src, albumAnchor.src))
            : snapshotScope.currentIndex;
        if (currentMatch >= 0) {
          audioState.currentIndex = currentMatch;
        } else {
          audioState.currentIndex = Math.min(
            Math.max(0, Number(snapshotScope.currentIndex) || 0),
            audioState.playlist.length - 1
          );
        }
      } else if (uiPlaylist.length) {
        audioState.playlist = uiPlaylist.slice();
        syncPlaylistContext(audioState.playlist);
        const currentMatch =
          albumAnchor && albumAnchor.src
            ? audioState.playlist.findIndex((track) => srcMatches(track.src, albumAnchor.src))
            : uiScope.currentIndex;
        if (currentMatch >= 0) {
          audioState.currentIndex = currentMatch;
        } else {
          audioState.currentIndex = Math.min(
            Math.max(0, Number(uiScope.currentIndex) || 0),
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
      reseedShuffleHistoryForCurrentTrack({ renewSeed: false });
    }

    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
    if (nextMode !== "radio" && !opts.deferPrefetch) maybePrefetchNextTrack("mode_change");
  }

  function activateRadioModeFromTransport() {
    return setHomePlayMode("radio", { force: true });
  }

  function toggleRadioModeFromTransport() {
    if (audioState.homeMode === "radio") {
      setHomePlayMode("album", { force: true });
      return;
    }
    activateRadioModeFromTransport();
  }

  function getVisiblePlaylistShuffleCollection() {
    if (
      typeof document === "undefined" ||
      !document.body ||
      !document.body.classList.contains("playlist-screen")
    ) {
      return null;
    }
    const ui = audioState.ui;
    if (!ui || ui.playlistKind !== "playlist" || !Array.isArray(ui.playlist)) return [];
    if (ui.pageHref && typeof window !== "undefined" && window.location) {
      try {
        const uiUrl = new URL(ui.pageHref, window.location.href);
        const routeUrl = new URL(window.location.href);
        if (uiUrl.pathname !== routeUrl.pathname) return [];
      } catch (_err) {
        return [];
      }
    }
    return ui.playlist.filter(function (track) {
      return track && track.src;
    });
  }

  function toggleVisiblePlaylistShuffle(visiblePlaylist) {
    const wasRadio = audioState.homeMode === "radio";
    const nextShuffleOn = wasRadio ? true : !audioState.shuffleOn;
    const activeSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());

    if (wasRadio) {
      setHomePlayMode("album", { force: true, deferPrefetch: true });
    }

    audioState.homeMode = "album";
    persistHomePlayMode("album");
    audioState.playlist = visiblePlaylist.slice();
    audioState.playlistKind = "playlist";
    audioState.shuffleOn = nextShuffleOn;
    audioState.upcomingTrackPlan = null;
    syncPlaylistContext(audioState.playlist);

    const activeIndex = activeSrc
      ? audioState.playlist.findIndex(function (track) {
          return srcMatches(track.src, activeSrc);
        })
      : -1;
    let startIndex = -1;
    if (activeIndex >= 0) {
      audioState.currentIndex = activeIndex;
    } else {
      const preferredIndex = nextShuffleOn ? getRandomIndex(-1) : 0;
      startIndex =
        Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < audioState.playlist.length
          ? preferredIndex
          : nextShuffleOn
            ? Math.floor(Math.random() * audioState.playlist.length)
            : 0;
      audioState.currentIndex = startIndex;
    }

    const startTrackSrc =
      startIndex >= 0 && audioState.playlist[startIndex] ? audioState.playlist[startIndex].src : "";
    reseedShuffleHistoryForCurrentTrack({
      renewSeed: true,
      currentSrc: startTrackSrc || activeSrc
    });
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();

    if (startIndex >= 0) {
      startTrack(startIndex, {
        seamless: true,
        immediatePlay: true,
        userGesture: true,
        fromTransportControl: true,
        surface: "playlist_shuffle"
      });
    } else {
      maybePrefetchNextTrack("shuffle_mode_change");
    }
    return true;
  }

  function toggleAlbumShuffleMode() {
    const visiblePlaylist = getVisiblePlaylistShuffleCollection();
    if (visiblePlaylist !== null) {
      if (visiblePlaylist.length) toggleVisiblePlaylistShuffle(visiblePlaylist);
      return;
    }

    if (audioState.homeMode === "radio") {
      audioState.shuffleOn = true;
      audioState.upcomingTrackPlan = null;
      setHomePlayMode("album", { force: true, deferPrefetch: true });
      constrainPlaybackToCurrentAlbum();
    } else {
      if (audioState.playlistKind !== "playlist") constrainPlaybackToCurrentAlbum();
      audioState.shuffleOn = !audioState.shuffleOn;
      audioState.upcomingTrackPlan = null;
    }
    reseedShuffleHistoryForCurrentTrack({ renewSeed: true });
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
    // Reconcile retains the useful part of the rolling window and cancels only
    // targets made improbable by the new order.
    maybePrefetchNextTrack("shuffle_mode_change");
  }

  function reseedShuffleHistoryForCurrentTrack(options) {
    const opts = options || {};
    if (!audioState.shuffleOn) {
      audioState.shuffleSessionSeed = "";
      audioState.shuffleHistory = [];
      audioState.shuffleHistoryCursor = -1;
      audioState.upcomingTrackPlan = null;
      return;
    }
    if (opts.renewSeed || !audioState.shuffleSessionSeed) {
      audioState.shuffleSessionSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    const currentTrack = getCurrentPlaylistTrack();
    const preferredSrc = normalizeAudioSourceUrl(opts.currentSrc || "");
    const currentSrc = normalizeAudioSourceUrl(
      preferredSrc || getCurrentLogicalAudioSrc() || (currentTrack && currentTrack.src) || ""
    );
    audioState.shuffleHistory = currentSrc ? [currentSrc] : [];
    audioState.shuffleHistoryCursor = audioState.shuffleHistory.length - 1;
    audioState.upcomingTrackPlan = null;
  }

  return {
    link() {
      ({
        buildAlbumPlaylistFromRadioCache,
        buildRadioQueue,
        constrainPlaybackToCurrentAlbum,
        ensureRadioPlaylistLoaded,
        findPlaylistIndexByCurrentSrc,
        getTrackSource,
        maybePrefetchNextTrack,
        persistHomePlayMode,
        savePlaybackQueueContext,
        scopeAlbumPlaylistToCurrentTrack
      } = R);
    },
    fns: {
      clearRadioQueue,
      syncRadioQueueToPlaylist,
      ensureRadioQueue,
      injectCurrentTrackIntoRadioQueue,
      ensureRadioPlaylistForNavigation,
      setHomePlayMode,
      activateRadioModeFromTransport,
      toggleRadioModeFromTransport,
      getVisiblePlaylistShuffleCollection,
      toggleVisiblePlaylistShuffle,
      toggleAlbumShuffleMode,
      reseedShuffleHistoryForCurrentTrack
    }
  };
}
