// Radio : mode de lecture, liste aléatoire du catalogue, préparation du premier titre.
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createRadio(R) {
  const {
    PREFETCH_NEXT_MAX_ENTRIES,
    audioState,
    buildPreservedTrack,
    formatTrackDuration,
    getAudioAssetPathKey,
    getCurrentLogicalAudioSrc,
    getCurrentPlayableAudioSrc,
    loadTracksData,
    normalizeAlbumTitle,
    normalizeAudioSourceUrl,
    normalizeTrackTitle,
    prefetchApi,
    resolveManagedAudioSrc,
    runtime,
    srcMatches,
    startTrack,
    syncAudioUi,
    syncMediaSessionMetadata,
    syncPlaylistContext,
    toAbsoluteUrlOrEmpty,
    toRuntimeAbsoluteUrl,
    trackAudioRuntimeEvent
  } = R;
  let clearRadioQueue, ensureGlobalAudio, savePlaybackQueueContext;

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

  async function ensureRadioPlaylistLoaded() {
    if (audioState.radioPlaylist.length) return audioState.radioPlaylist.slice();
    if (audioState.radioLoadingPromise) return audioState.radioLoadingPromise;

    audioState.radioLoadingPromise = (async function () {
      const tracksData = await loadTracksData();
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
    const queuedSrcs = new Set(
      (Array.isArray(audioState.radioQueue) ? audioState.radioQueue : [])
        .slice(Math.max(0, Number.isInteger(audioState.radioQueueCursor) ? audioState.radioQueueCursor : 0))
        .map(getTrackSource)
        .filter(Boolean)
    );
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
      if (queuedSrcs.has(src)) return false;
      return !recentSrcs.has(src);
    });
    const fallback = cleanList.filter(function (track) {
      const src = getTrackSource(track);
      return !queuedSrcs.has(src) && !(avoid && srcMatches(src, avoid));
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
      ? list.filter(function (track) {
          return track && track.src;
        })
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

  function activatePreparedInitialRadioPlayback() {
    if (!audioState.initialRandomReady || !audioState.initialRandomPlaylist.length) return false;
    const queue = consumePreparedInitialGlobalRandomPlaylist();
    if (!queue || !queue.length) return false;
    ensureGlobalAudio();
    audioState.homeMode = "radio";
    audioState.playlistKind = "radio";
    audioState.shuffleOn = false;
    audioState.radioQueue = queue.slice();
    audioState.radioQueueCursor = 0;
    audioState.playlist = audioState.radioQueue;
    audioState.currentIndex = 0;
    persistHomePlayMode("radio");
    syncPlaylistContext(audioState.playlist, { preserveRecent: true });
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    startTrack(0, {
      seamless: true,
      initialRandom: true,
      immediatePlay: true,
      userGesture: true,
      coldStart: true,
      surface: "mini_cold"
    });
    return true;
  }

  function prepareInitialRadioFromMemory(reason) {
    if (audioState.initialRandomReady && audioState.initialRandomPlaylist.length) return true;
    const tracksData = audioState.tracksData;
    if (!tracksData || !Array.isArray(tracksData.albums) || !tracksData.albums.length) return false;
    if (hasPlaybackSession()) return false;
    const radioPlaylist = buildGlobalCatalogPlaylist(tracksData);
    if (!radioPlaylist.length) return false;
    const queue = buildRadioQueue(radioPlaylist, audioState.radioQueueBatchSize, "");
    if (!queue.length) return false;
    audioState.radioPlaylist = radioPlaylist.slice();
    audioState.radioQueue = [];
    audioState.radioQueueCursor = -1;
    audioState.initialRandomPlaylist = queue.slice();
    audioState.initialRandomFirstSrc = normalizeAudioSourceUrl(queue[0] && queue[0].src ? queue[0].src : "");
    audioState.initialRandomReady = true;
    trackAudioRuntimeEvent("radio_metadata_ready", {
      track: "radio-cold-start",
      album: "radio",
      reason: reason || "cold_tap_memory",
      tracks_count: radioPlaylist.length,
      queue_count: queue.length,
      audio_fetch: false,
      synchronous: true
    });
    return true;
  }

  function startGlobalRandomPlayback() {
    if (audioState.globalRandomStartInFlight) return false;
    trackAudioRuntimeEvent("initial_random_tap", {
      track: "radio-cold-start",
      album: "radio",
      prepared: Boolean(audioState.initialRandomReady && audioState.initialRandomPlaylist.length),
      prefetch_src: audioState.initialRandomFirstSrc || "",
      prefetch_done: Boolean(
        audioState.nextPrefetchDoneSrc &&
        srcMatches(audioState.nextPrefetchDoneSrc, audioState.initialRandomFirstSrc || "")
      )
    });
    audioState.globalRandomStartInFlight = true;
    try {
      prepareInitialRadioFromMemory("cold_tap_memory");
      const started = activatePreparedInitialRadioPlayback();
      if (!started) prepareInitialGlobalRandomPlayback("cold_tap_not_ready");
      return started;
    } finally {
      audioState.globalRandomStartInFlight = false;
      syncAudioUi();
    }
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
    return Boolean(!audioState.globalRandomStartInFlight && !hasPlaybackSession());
  }

  function promoteCachedPreparedInitialTrack(token, reason) {
    if (!prefetchApi || typeof prefetchApi.findFirstValidCachedSegment !== "function") return;
    const catalogSnapshot = Array.isArray(audioState.radioPlaylist)
      ? shuffledCopy(audioState.radioPlaylist)
      : [];
    const sources = catalogSnapshot
      .map(function (track) {
        return normalizeAudioSourceUrl(track && track.src ? track.src : "");
      })
      .filter(Boolean);
    if (!sources.length) return;

    const lookup =
      typeof prefetchApi.findValidCachedSegments === "function"
        ? prefetchApi.findValidCachedSegments(sources, PREFETCH_NEXT_MAX_ENTRIES)
        : Promise.resolve(prefetchApi.findFirstValidCachedSegment(sources)).then(function (result) {
            return result ? [result] : [];
          });

    Promise.resolve(lookup)
      .then(function (results) {
        if (
          !Array.isArray(results) ||
          !results.length ||
          token !== audioState.initialRandomPrepareToken ||
          !audioState.initialRandomReady ||
          !shouldPrepareInitialGlobalRandomPlayback()
        ) {
          return;
        }
        const queueLength = audioState.initialRandomPlaylist.length;
        const catalogBySrc = new Map();
        catalogSnapshot.forEach(function (track) {
          const src = normalizeAudioSourceUrl(track && track.src ? track.src : "");
          if (src && !catalogBySrc.has(src)) catalogBySrc.set(src, track);
        });
        const cachedTracks = [];
        const cachedSources = [];
        const cachedSourceSet = new Set();
        let restoredBytes = 0;
        results.forEach(function (result) {
          if (!result || !result.valid) return;
          const src = normalizeAudioSourceUrl(result.src || "");
          if (!src || cachedSourceSet.has(src)) return;
          const track =
            catalogBySrc.get(src) ||
            catalogSnapshot.find(function (candidate) {
              return srcMatches(
                normalizeAudioSourceUrl(candidate && candidate.src ? candidate.src : ""),
                src
              );
            });
          if (!track) return;
          cachedSourceSet.add(src);
          cachedSources.push(src);
          cachedTracks.push(track);
          restoredBytes += Number(result.bytes) || 0;
        });
        if (!cachedTracks.length) return;
        const remainingTracks = audioState.initialRandomPlaylist.filter(function (track) {
          const src = normalizeAudioSourceUrl(track && track.src ? track.src : "");
          return !cachedSourceSet.has(src);
        });
        audioState.initialRandomPlaylist = cachedTracks.concat(remainingTracks).slice(0, queueLength);
        audioState.initialRandomFirstSrc = cachedSources[0];
        trackAudioRuntimeEvent("radio_cached_first_ready", {
          track: "radio-cold-start",
          album: "radio",
          reason: reason || "home_init",
          queue_index: 0,
          restored_count: cachedTracks.length,
          bytes: restoredBytes,
          audio_fetch: false
        });
        syncAudioUi();
      })
      .catch(function () {});
  }

  function prepareInitialGlobalRandomPlayback(reason) {
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
        const radioPlaylist = buildGlobalCatalogPlaylist(tracksData);
        if (!radioPlaylist.length) return null;
        audioState.radioPlaylist = radioPlaylist.slice();
        audioState.radioQueue = [];
        audioState.radioQueueCursor = -1;
        const queue = buildRadioQueue(radioPlaylist, audioState.radioQueueBatchSize, "");
        if (!queue.length) return null;
        audioState.initialRandomPlaylist = queue.slice();
        audioState.initialRandomFirstSrc = normalizeAudioSourceUrl(
          queue[0] && queue[0].src ? queue[0].src : ""
        );
        audioState.initialRandomReady = true;
        promoteCachedPreparedInitialTrack(token, reason);
        trackAudioRuntimeEvent("radio_metadata_ready", {
          track: "radio-cold-start",
          album: "radio",
          reason: reason || "home_init",
          tracks_count: radioPlaylist.length,
          queue_count: queue.length,
          audio_fetch: false
        });
        syncAudioUi();
        return queue.slice();
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
    const run = function () {
      prepareInitialGlobalRandomPlayback(reason || "home_idle");
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }
    window.setTimeout(run, 250);
  }

  function hasPlaybackSession() {
    const audio = audioState.audio;
    const hasTrack = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasPlaylist = audioState.playlist && audioState.playlist.length > 0;
    return Boolean(
      hasTrack ||
      audioState.activeLogicalSrc ||
      (hasPlaylist &&
        Number.isInteger(audioState.currentIndex) &&
        audioState.currentIndex >= 0 &&
        audioState.currentIndex < audioState.playlist.length)
    );
  }

  function canStartInitialGlobalRandomPlayback() {
    const audio = audioState.audio;
    const hasPreparedMetadata = Boolean(
      audioState.initialRandomReady && audioState.initialRandomPlaylist.length > 0
    );
    const hasInMemoryMetadata = Boolean(
      audioState.tracksData &&
      Array.isArray(audioState.tracksData.albums) &&
      audioState.tracksData.albums.length
    );
    return Boolean(
      !audioState.globalRandomStartInFlight &&
      (hasPreparedMetadata || hasInMemoryMetadata) &&
      !hasPlaybackSession() &&
      !(audio && getCurrentPlayableAudioSrc(audio))
    );
  }

  function startSelectedTrackInRadioFromCold(track, options) {
    const opts = options || {};
    const audio = audioState.audio || ensureGlobalAudio();
    const logicalSrc = getCurrentLogicalAudioSrc() || audioState.activeLogicalSrc || "";
    if (
      !track ||
      !track.src ||
      !audio ||
      logicalSrc ||
      getCurrentPlayableAudioSrc(audio) ||
      audioState.trackStartInFlight
    ) {
      return false;
    }
    prepareInitialRadioFromMemory("selected_track_cold");
    const prepared = consumePreparedInitialGlobalRandomPlaylist() || [];
    const selected = buildPreservedTrack(track, track.src);
    if (!selected) return false;
    const queue = [selected].concat(
      prepared.filter(function (entry) {
        return entry && !srcMatches(entry.src, selected.src);
      })
    );
    audioState.homeMode = "radio";
    audioState.playlistKind = "radio";
    audioState.shuffleOn = false;
    audioState.radioQueue = queue;
    audioState.radioQueueCursor = 0;
    audioState.playlist = audioState.radioQueue;
    audioState.currentIndex = 0;
    persistHomePlayMode("radio");
    syncPlaylistContext(audioState.playlist, { preserveRecent: true });
    savePlaybackQueueContext();
    syncMediaSessionMetadata({ forcePosition: true });
    startTrack(0, {
      seamless: true,
      immediatePlay: true,
      userGesture: true,
      coldStart: true,
      surface: String(opts.surface || "track_cold_radio")
    });
    if (queue.length === 1) {
      ensureRadioPlaylistLoaded()
        .then(function (catalog) {
          if (
            audioState.homeMode !== "radio" ||
            audioState.playlistKind !== "radio" ||
            !audioState.radioQueue.length ||
            !srcMatches(audioState.radioQueue[0].src, selected.src)
          ) {
            return;
          }
          const tail = buildRadioQueue(
            catalog,
            Math.max(0, audioState.radioQueueBatchSize - 1),
            selected.src
          );
          if (!tail.length) return;
          audioState.radioQueue = [audioState.radioQueue[0]].concat(tail);
          audioState.radioQueueCursor = 0;
          audioState.playlist = audioState.radioQueue;
          audioState.currentIndex = 0;
          syncPlaylistContext(audioState.playlist, { preserveRecent: true });
          savePlaybackQueueContext();
          syncAudioUi();
        })
        .catch(function () {});
    }
    return true;
  }

  return {
    link() {
      ({ clearRadioQueue, ensureGlobalAudio, savePlaybackQueueContext } = R);
    },
    fns: {
      readHomePlayMode,
      persistHomePlayMode,
      findPlaylistIndexByCurrentSrc,
      ensureRadioPlaylistLoaded,
      getTrackSource,
      getRecentPlayedSrcSet,
      shuffledCopy,
      buildRadioQueue,
      buildGlobalCatalogPlaylist,
      buildGlobalRandomPlaylistWithTelemetry,
      setGlobalCatalogPlaylist,
      activatePreparedInitialRadioPlayback,
      prepareInitialRadioFromMemory,
      startGlobalRandomPlayback,
      resetPreparedInitialGlobalRandomPlayback,
      consumePreparedInitialGlobalRandomPlaylist,
      shouldPrepareInitialGlobalRandomPlayback,
      promoteCachedPreparedInitialTrack,
      prepareInitialGlobalRandomPlayback,
      scheduleInitialGlobalRandomPreparation,
      hasPlaybackSession,
      canStartInitialGlobalRandomPlayback,
      startSelectedTrackInRadioFromCold
    }
  };
}
