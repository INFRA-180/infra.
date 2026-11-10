// Contexte de la file : enregistrer, restaurer, reprendre la lecture.
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createQueueContext(R) {
  const {
    audioState,
    buildPreservedTrack,
    ensureCurrentIndexFromAudio,
    getCurrentAlbumTitle,
    getCurrentLogicalAudioSrc,
    getCurrentPlaylistTrack,
    getCurrentTrackAlbumPage,
    getCurrentTrackArtwork,
    isBlobObjectUrl,
    normalizeAlbumTitle,
    normalizeAudioSourceUrl,
    normalizeTrackTitle,
    revokeActiveBlobUrl,
    srcMatches,
    syncMediaSessionMetadata,
    syncPlaylistContext,
    toAbsoluteUrl,
    toAbsoluteUrlOrEmpty
  } = R;
  let buildGlobalCatalogPlaylist,
    ensureRadioQueue,
    persistHomePlayMode,
    reseedShuffleHistoryForCurrentTrack,
    syncRadioQueueToPlaylist;

  function clearStoredPlaybackState() {
    audioState.lastSavedQueueSignature = "";
    try {
      sessionStorage.removeItem(audioState.queueStorageKey);
      sessionStorage.removeItem(audioState.resumeStorageKey);
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function buildAlbumPlaylistFromRadioCache(track) {
    if (!track || !track.src) return [];
    let radioList = Array.isArray(audioState.radioPlaylist) ? audioState.radioPlaylist : [];
    if (!radioList.length && audioState.tracksData && Array.isArray(audioState.tracksData.albums)) {
      radioList = buildGlobalCatalogPlaylist(audioState.tracksData);
      if (radioList.length) audioState.radioPlaylist = radioList.slice();
    }
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

    if (
      !candidates.some(function (entry) {
        return srcMatches(entry.src, trackSrc);
      })
    ) {
      candidates = [track].concat(candidates);
    }

    const normalized = [];
    candidates.forEach(function (entry) {
      const source = entry || track;
      const sourceSrc = toAbsoluteUrlOrEmpty(source.src || "");
      if (!sourceSrc) return;
      if (
        normalized.some(function (existing) {
          return srcMatches(existing.src, sourceSrc);
        })
      )
        return;
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

  function scopeAlbumPlaylistToCurrentTrack(playlist, anchorTrack, preferredIndex) {
    const list = Array.isArray(playlist)
      ? playlist.filter(function (track) {
          return track && track.src;
        })
      : [];
    if (!list.length && !(anchorTrack && anchorTrack.src)) {
      return { playlist: [], currentIndex: -1 };
    }

    const anchorSrc = toAbsoluteUrlOrEmpty(anchorTrack && anchorTrack.src ? anchorTrack.src : "");
    let anchorIndex = anchorSrc
      ? list.findIndex(function (track) {
          return srcMatches(track.src, anchorSrc);
        })
      : -1;
    if (
      !anchorSrc &&
      anchorIndex < 0 &&
      Number.isInteger(preferredIndex) &&
      preferredIndex >= 0 &&
      preferredIndex < list.length
    ) {
      anchorIndex = preferredIndex;
    }
    const anchor =
      anchorIndex >= 0 ? list[anchorIndex] : anchorTrack && anchorTrack.src ? anchorTrack : list[0];
    if (!anchor || !anchor.src) return { playlist: [], currentIndex: -1 };

    const anchorPage = toAbsoluteUrlOrEmpty(anchor.page || "");
    const anchorAlbum = normalizeAlbumTitle(anchor.album || "");
    let scoped = [];
    if (anchorPage) {
      scoped = list.filter(function (track) {
        return toAbsoluteUrlOrEmpty(track && track.page ? track.page : "") === anchorPage;
      });
    }
    if (!scoped.length && anchorAlbum) {
      scoped = list.filter(function (track) {
        return normalizeAlbumTitle(track && track.album ? track.album : "") === anchorAlbum;
      });
    }
    if (!scoped.length) scoped = [anchor];
    if (
      !scoped.some(function (track) {
        return srcMatches(track.src, anchor.src);
      })
    ) {
      scoped.unshift(anchor);
    }

    const seen = new Set();
    const normalized = scoped.filter(function (track) {
      const src = toAbsoluteUrlOrEmpty(track && track.src ? track.src : "");
      if (!src || seen.has(src)) return false;
      seen.add(src);
      return true;
    });
    const currentIndex = normalized.findIndex(function (track) {
      return srcMatches(track.src, anchor.src);
    });
    return {
      playlist: normalized,
      currentIndex: currentIndex >= 0 ? currentIndex : 0
    };
  }

  function constrainPlaybackToCurrentAlbum() {
    const currentTrack = getCurrentPlaylistTrack();
    const currentSrc = getCurrentLogicalAudioSrc();
    const preservedTrack = buildPreservedTrack(currentTrack, currentSrc);
    const anchor = preservedTrack || currentTrack;
    if (!anchor || !anchor.src) return false;

    const candidates = [
      buildAlbumPlaylistFromRadioCache(anchor),
      scopeAlbumPlaylistToCurrentTrack(audioState.playlist, anchor, audioState.currentIndex).playlist,
      scopeAlbumPlaylistToCurrentTrack(
        audioState.ui && audioState.ui.playlist,
        anchor,
        audioState.currentIndex
      ).playlist
    ].filter(function (playlist) {
      return Array.isArray(playlist) && playlist.length;
    });
    const albumPlaylist = candidates.reduce(function (best, candidate) {
      return candidate.length > best.length ? candidate : best;
    }, []);
    if (!albumPlaylist.length) return false;

    audioState.playlist = albumPlaylist.slice();
    audioState.playlistKind = "album";
    syncPlaylistContext(audioState.playlist);
    const currentIndex = audioState.playlist.findIndex(function (track) {
      return srcMatches(track.src, anchor.src);
    });
    audioState.currentIndex = currentIndex >= 0 ? currentIndex : 0;
    audioState.albumPlaylistSnapshot = audioState.playlist.slice();
    audioState.albumIndexSnapshot = audioState.currentIndex;
    return true;
  }

  function savePlaybackQueueContext() {
    try {
      let list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
      if (audioState.homeMode === "radio") {
        // Never persist an album queue under a Radio label while the real
        // global queue is still loading. Keep the last committed payload.
        if (!Array.isArray(audioState.radioQueue) || !audioState.radioQueue.length) return;
        list = audioState.radioQueue;
      }
      if (!list.length) {
        sessionStorage.removeItem(audioState.queueStorageKey);
        audioState.lastSavedQueueSignature = "";
        return;
      }

      const sanitizedAll = list.map(sanitizeQueueTrack).filter(Boolean);
      if (!sanitizedAll.length) {
        sessionStorage.removeItem(audioState.queueStorageKey);
        audioState.lastSavedQueueSignature = "";
        return;
      }

      const currentSrc = toAbsoluteUrlOrEmpty(getCurrentLogicalAudioSrc());
      let currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
      if (currentSrc) {
        const bySrc = sanitizedAll.findIndex((track) => srcMatches(track.src, currentSrc));
        if (bySrc >= 0) currentIndex = bySrc;
      }
      if (currentIndex < 0 || currentIndex >= sanitizedAll.length) {
        currentIndex = Math.min(Math.max(0, currentIndex), sanitizedAll.length - 1);
      }

      // Keep storage bounded without ever truncating away the active track.
      // A backward margin preserves meaningful Previous history while the
      // larger forward side retains the rolling Radio/album queue.
      const maxStoredTracks = 260;
      let windowStart = Math.max(0, currentIndex - 80);
      if (windowStart + maxStoredTracks > sanitizedAll.length) {
        windowStart = Math.max(0, sanitizedAll.length - maxStoredTracks);
      }
      const sanitizedPlaylist = sanitizedAll.slice(windowStart, windowStart + maxStoredTracks);
      currentIndex -= windowStart;

      const payload = {
        playlist: sanitizedPlaylist,
        currentIndex,
        homeMode: audioState.homeMode === "radio" ? "radio" : "album",
        playlistKind: ["global", "favorites", "playlist"].includes(audioState.playlistKind)
          ? audioState.playlistKind
          : audioState.homeMode === "radio"
            ? "radio"
            : "album",
        shuffleOn: Boolean(audioState.shuffleOn),
        shuffleSeed: audioState.shuffleOn ? String(audioState.shuffleSessionSeed || "") : "",
        currentSrc:
          currentSrc || (sanitizedPlaylist[currentIndex] && sanitizedPlaylist[currentIndex].src) || ""
      };
      const signature = JSON.stringify(payload);
      if (signature === audioState.lastSavedQueueSignature) return;
      sessionStorage.setItem(
        audioState.queueStorageKey,
        JSON.stringify(
          Object.assign(
            {
              savedAt: Date.now()
            },
            payload
          )
        )
      );
      audioState.lastSavedQueueSignature = signature;
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function queueMatchesCurrentPage(payload, _restoredMode) {
    const playlist = payload && Array.isArray(payload.playlist) ? payload.playlist : [];
    return Boolean(playlist.length);
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
    let restoredPlaylist = payload.playlist.map(sanitizeQueueTrack).filter(Boolean);
    if (!restoredPlaylist.length) return false;

    const restoredMode = payload.homeMode === "radio" ? "radio" : "album";
    if (!queueMatchesCurrentPage(payload, restoredMode)) {
      clearStoredPlaybackState();
      return false;
    }

    let restoredKind = ["global", "favorites", "playlist"].includes(payload.playlistKind)
      ? payload.playlistKind
      : restoredMode === "radio"
        ? "radio"
        : "album";
    const activeSrc = toAbsoluteUrlOrEmpty(getCurrentLogicalAudioSrc() || payload.currentSrc || "");
    let currentIndex = Number.isInteger(payload.currentIndex) ? payload.currentIndex : -1;
    if (restoredMode !== "radio" && restoredKind !== "playlist") {
      const scoped = scopeAlbumPlaylistToCurrentTrack(
        restoredPlaylist,
        activeSrc ? { src: activeSrc } : null,
        currentIndex
      );
      restoredPlaylist = scoped.playlist;
      currentIndex = scoped.currentIndex;
      // Radio is the only global queue. Historical global/favorites payloads
      // must not escape the current album after Radio has been turned off.
      restoredKind = "album";
    }
    if (!restoredPlaylist.length) return false;

    audioState.homeMode = restoredMode;
    persistHomePlayMode(restoredMode);
    audioState.shuffleOn = Boolean(payload.shuffleOn);
    audioState.shuffleSessionSeed = audioState.shuffleOn
      ? String(payload.shuffleSeed || "") ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      : "";

    audioState.playlist = restoredPlaylist.slice();
    audioState.playlistKind = restoredKind;
    syncPlaylistContext(audioState.playlist);

    if (activeSrc) {
      const bySrc = audioState.playlist.findIndex((track) => track && srcMatches(track.src, activeSrc));
      if (bySrc >= 0) currentIndex = bySrc;
    }
    if (currentIndex < 0 || currentIndex >= audioState.playlist.length) {
      currentIndex = 0;
    }
    audioState.currentIndex = currentIndex;

    if (audioState.homeMode !== "radio" && audioState.playlistKind === "album") {
      audioState.albumPlaylistSnapshot = audioState.playlist.slice();
      audioState.albumIndexSnapshot = audioState.currentIndex;
    } else if (audioState.homeMode === "radio") {
      audioState.radioQueue = audioState.playlist.slice();
      audioState.radioQueueCursor = audioState.currentIndex;
      audioState.playlist = audioState.radioQueue;
    }
    reseedShuffleHistoryForCurrentTrack({ renewSeed: false });
    savePlaybackQueueContext();
    return true;
  }

  function expandSingleTrackAlbumFromRadioCache() {
    if (audioState.homeMode === "radio" || audioState.playlistKind === "playlist") return false;
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
    let cursor =
      Number.isInteger(audioState.radioQueueCursor) && audioState.radioQueueCursor >= 0
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

      sessionStorage.setItem(
        audioState.resumeStorageKey,
        JSON.stringify({
          src,
          time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          playing: !audio.paused
        })
      );
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
    audioState.sourceMetadataPending = true;
    audio.crossOrigin = "anonymous";
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
      if (audioState.playlistKind !== "playlist") expandSingleTrackAlbumFromRadioCache();
      return;
    }

    if (restorePlaybackQueueContext()) {
      if (audioState.playlistKind !== "playlist") expandSingleTrackAlbumFromRadioCache();
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
    audioState.playlistKind = ui.playlistKind === "playlist" ? "playlist" : "album";
    syncPlaylistContext(audioState.playlist);
    ensureCurrentIndexFromAudio();
    if (audioState.playlistKind !== "playlist") expandSingleTrackAlbumFromRadioCache();
  }

  return {
    link() {
      ({
        buildGlobalCatalogPlaylist,
        ensureRadioQueue,
        persistHomePlayMode,
        reseedShuffleHistoryForCurrentTrack,
        syncRadioQueueToPlaylist
      } = R);
    },
    fns: {
      clearStoredPlaybackState,
      buildAlbumPlaylistFromRadioCache,
      sanitizeQueueTrack,
      scopeAlbumPlaylistToCurrentTrack,
      constrainPlaybackToCurrentAlbum,
      savePlaybackQueueContext,
      queueMatchesCurrentPage,
      restorePlaybackQueueContext,
      expandSingleTrackAlbumFromRadioCache,
      peekRadioNextIndexForPrefetch,
      saveResumeState,
      restoreResumeState,
      ensurePlayablePlaylistContext
    }
  };
}
