// Continuité d'album (suivant / précédent) et file de lecture.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { audioCoreApi, audioState, catalogState, fallbackCatalog, runtime } from "../scripts.js";
import { callAudioRadio, formatTrackDuration } from "./module-bridges.js";
import { loadTracksData, mergeTrackMetadata } from "./catalog-playback.js";
import { getCurrentAlbumTitle, getCurrentLogicalAudioSrc, getCurrentPlaylistTrack, getCurrentTrackAlbumPage, getCurrentTrackArtwork, normalizeAlbumTitle, normalizeTrackTitle, resolveManagedAudioSrc, srcMatches, toAbsoluteUrlOrEmpty, toRuntimeAbsoluteUrl } from "./audio-sources.js";
import { playNext, playPrevious, syncPlaylistContext, trackAudioRuntimeEvent } from "./playback.js";

function normalizeAlbumContinuityPage(pageLike) {
  const raw = String(pageLike || "").trim();
  if (!raw) return "";

  let href = "";
  try {
    href = new URL(raw, runtime.baseUrl).href;
  } catch (_err) {
    href = toAbsoluteUrlOrEmpty(raw);
  }
  if (!href) return "";

  try {
    const url = new URL(href);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/index\.html$/i, "/");
  } catch (_err) {
    return href.split("#")[0].split("?")[0].replace(/\/index\.html$/i, "/");
  }
}

function getAlbumContinuityTracksData() {
  const tracksData = audioState.tracksData;
  const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
  return albums.filter(function (album) {
    return album && Array.isArray(album.tracks) && album.tracks.some(function (track) {
      return track && track.src;
    });
  });
}

function getAlbumContinuityCatalogAlbums() {
  const catalog = catalogState.data && Array.isArray(catalogState.data.albums)
    ? catalogState.data
    : fallbackCatalog;
  return Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
}

function findTracksAlbumByCatalogEntry(catalogEntry, tracksAlbums) {
  if (!catalogEntry) return null;
  const catalogPage = normalizeAlbumContinuityPage(catalogEntry.page || "");
  const catalogTitle = normalizeAlbumTitle(catalogEntry.title || "");

  if (catalogPage) {
    const byPage = tracksAlbums.find(function (album) {
      return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === catalogPage;
    });
    if (byPage) return byPage;
  }

  if (catalogTitle) {
    return tracksAlbums.find(function (album) {
      return normalizeAlbumTitle(album && album.title ? album.title : "") === catalogTitle;
    }) || null;
  }

  return null;
}

function findTracksAlbumForContinuityTrack(track, tracksAlbums) {
  const enriched = mergeTrackMetadata(track || null);
  const page = normalizeAlbumContinuityPage(
    enriched && enriched.page ? enriched.page : (track && track.page ? track.page : "")
  );
  const albumTitle = normalizeAlbumTitle(
    enriched && enriched.album ? enriched.album : (track && track.album ? track.album : "")
  );

  if (page) {
    const byPage = tracksAlbums.find(function (album) {
      return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === page;
    });
    if (byPage) return byPage;
  }

  if (albumTitle) {
    const byTitle = tracksAlbums.find(function (album) {
      return normalizeAlbumTitle(album && album.title ? album.title : "") === albumTitle;
    });
    if (byTitle) return byTitle;
  }

  const src = (track && track.src) || getCurrentLogicalAudioSrc();
  if (!src) return null;
  return tracksAlbums.find(function (album) {
    const tracks = Array.isArray(album && album.tracks) ? album.tracks : [];
    return tracks.some(function (candidate) {
      return candidate && candidate.src && srcMatches(candidate.src, src);
    });
  }) || null;
}

function findNextAlbumForContinuity(currentAlbum, tracksAlbums) {
  if (!currentAlbum || tracksAlbums.length < 2) return null;

  const catalogAlbums = getAlbumContinuityCatalogAlbums();
  const currentPage = normalizeAlbumContinuityPage(currentAlbum.page || "");
  const currentTitle = normalizeAlbumTitle(currentAlbum.title || "");
  const catalogIndex = catalogAlbums.findIndex(function (entry) {
    const entryPage = normalizeAlbumContinuityPage(entry && entry.page ? entry.page : "");
    const entryTitle = normalizeAlbumTitle(entry && entry.title ? entry.title : "");
    return (currentPage && entryPage === currentPage) || (currentTitle && entryTitle === currentTitle);
  });

  if (catalogIndex >= 0 && catalogAlbums.length > 1) {
    for (let candidateIndex = catalogIndex + 1; candidateIndex < catalogAlbums.length; candidateIndex += 1) {
      const candidateCatalog = catalogAlbums[candidateIndex];
      const candidateAlbum = findTracksAlbumByCatalogEntry(candidateCatalog, tracksAlbums);
      if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
      return {
        album: candidateAlbum,
        catalog: candidateCatalog || null,
        wrapped: false
      };
    }
  }

  const tracksIndex = tracksAlbums.indexOf(currentAlbum);
  if (tracksIndex < 0) return null;
  for (let candidateIndex = tracksIndex + 1; candidateIndex < tracksAlbums.length; candidateIndex += 1) {
    const candidateAlbum = tracksAlbums[candidateIndex];
    if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
    return {
      album: candidateAlbum,
      catalog: null,
      wrapped: false
    };
  }
  return null;
}

function findPreviousAlbumForContinuity(currentAlbum, tracksAlbums) {
  if (!currentAlbum || tracksAlbums.length < 2) return null;

  const catalogAlbums = getAlbumContinuityCatalogAlbums();
  const currentPage = normalizeAlbumContinuityPage(currentAlbum.page || "");
  const currentTitle = normalizeAlbumTitle(currentAlbum.title || "");
  const catalogIndex = catalogAlbums.findIndex(function (entry) {
    const entryPage = normalizeAlbumContinuityPage(entry && entry.page ? entry.page : "");
    const entryTitle = normalizeAlbumTitle(entry && entry.title ? entry.title : "");
    return (currentPage && entryPage === currentPage) || (currentTitle && entryTitle === currentTitle);
  });

  if (catalogIndex >= 0 && catalogAlbums.length > 1) {
    for (let candidateIndex = catalogIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
      const candidateCatalog = catalogAlbums[candidateIndex];
      const candidateAlbum = findTracksAlbumByCatalogEntry(candidateCatalog, tracksAlbums);
      if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
      return {
        album: candidateAlbum,
        catalog: candidateCatalog || null,
        wrapped: false
      };
    }
  }

  const tracksIndex = tracksAlbums.indexOf(currentAlbum);
  if (tracksIndex < 0) return null;
  for (let candidateIndex = tracksIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const candidateAlbum = tracksAlbums[candidateIndex];
    if (!candidateAlbum || candidateAlbum === currentAlbum) continue;
    return {
      album: candidateAlbum,
      catalog: null,
      wrapped: false
    };
  }
  return null;
}

function buildAlbumContinuityTrack(track, album, catalogEntry) {
  if (!track || !track.src || !album) return null;
  const src = resolveManagedAudioSrc(track.src, runtime.baseUrl.href);
  if (!src) return null;
  const seconds = Number(track.seconds);
  const duration = String(track.duration || "").trim() || formatTrackDuration(seconds);
  const albumTitle = normalizeAlbumTitle(album.title || (catalogEntry && catalogEntry.title) || "");
  const page = toRuntimeAbsoluteUrl(album.page || (catalogEntry && catalogEntry.page) || "");
  const artwork = album.cover
    ? toRuntimeAbsoluteUrl(album.cover)
    : (catalogEntry && catalogEntry.thumb ? toRuntimeAbsoluteUrl(catalogEntry.thumb) : "");

  return {
    src,
    name: normalizeTrackTitle(track.title || track.name || ""),
    album: albumTitle,
    page,
    artist: "INFRA.",
    artwork,
    duration,
    seconds
  };
}

function extendAlbumPlaylistToNextAlbum(options) {
  const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
  const currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
  const requestedFromIndex = options && Number.isInteger(options.fromIndex)
    ? options.fromIndex
    : currentIndex;
  const anchorIndex = Math.min(list.length - 1, requestedFromIndex);
  if (!list.length || currentIndex < 0 || anchorIndex < list.length - 1) return -1;
  if (audioState.homeMode === "radio" || audioState.shuffleOn) return -1;
  if (audioState.playlistKind !== "album") return -1;
  if (String(audioState.playlistToken || "").startsWith("manual-")) return -1;

  const tracksAlbums = getAlbumContinuityTracksData();
  if (!tracksAlbums.length) {
    if (options && options.reason === "next") {
      scheduleAlbumContinuityNavigationRetry("next", options.navigationOptions);
    } else {
      loadTracksData().catch(function () {
        // Keep the current playlist unchanged if metadata is unavailable.
      });
    }
    return -1;
  }

  const currentTrack = list[anchorIndex];
  const currentAlbum = findTracksAlbumForContinuityTrack(currentTrack, tracksAlbums);
  const nextAlbum = findNextAlbumForContinuity(currentAlbum, tracksAlbums);
  if (!nextAlbum || !nextAlbum.album) return -1;

  const nextTracks = nextAlbum.album.tracks
    .map(function (track) { return buildAlbumContinuityTrack(track, nextAlbum.album, nextAlbum.catalog); })
    .filter(Boolean);
  if (!nextTracks.length) return -1;

  const duplicateIndex = list.findIndex(function (existing, index) {
    if (index <= anchorIndex || !existing || !existing.src) return false;
    return nextTracks.some(function (track) {
      return track && track.src && srcMatches(existing.src, track.src);
    });
  });
  if (duplicateIndex > anchorIndex) return duplicateIndex;

  const firstNextIndex = list.length;
  audioState.playlist = list.concat(nextTracks);
  audioState.playlistKind = "album";
  syncPlaylistContext(audioState.playlist, { preserveRecent: true });
  trackAudioRuntimeEvent("album_continuity_extend", {
    from_index: currentIndex,
    to_index: firstNextIndex,
    from_album: normalizeAlbumTitle(currentAlbum && currentAlbum.title ? currentAlbum.title : ""),
    to_album: normalizeAlbumTitle(nextAlbum.album.title || ""),
    appended_count: nextTracks.length,
    wrapped: Boolean(nextAlbum.wrapped),
    reason: options && options.reason ? String(options.reason) : ""
  });
  return firstNextIndex;
}

function extendAlbumPlaylistToPreviousAlbum(options) {
  const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
  const currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
  const requestedFromIndex = options && Number.isInteger(options.fromIndex)
    ? options.fromIndex
    : currentIndex;
  if (!list.length || currentIndex < 0 || requestedFromIndex > 0) return -1;
  if (audioState.homeMode === "radio" || audioState.shuffleOn) return -1;
  if (audioState.playlistKind !== "album") return -1;
  if (String(audioState.playlistToken || "").startsWith("manual-")) return -1;

  const tracksAlbums = getAlbumContinuityTracksData();
  if (!tracksAlbums.length) {
    if (options && options.reason === "previous") {
      scheduleAlbumContinuityNavigationRetry("previous", options.navigationOptions);
    } else {
      loadTracksData().catch(function () {});
    }
    return -1;
  }

  const currentTrack = list[0];
  const currentAlbum = findTracksAlbumForContinuityTrack(currentTrack, tracksAlbums);
  const previousAlbum = findPreviousAlbumForContinuity(currentAlbum, tracksAlbums);
  if (!previousAlbum || !previousAlbum.album) return -1;
  const previousTracks = previousAlbum.album.tracks
    .map(function (track) { return buildAlbumContinuityTrack(track, previousAlbum.album, previousAlbum.catalog); })
    .filter(Boolean);
  if (!previousTracks.length) return -1;

  const lastPreviousTrack = previousTracks[previousTracks.length - 1];
  const duplicateIndex = list.findIndex(function (existing) {
    return existing && existing.src && lastPreviousTrack && srcMatches(existing.src, lastPreviousTrack.src);
  });
  if (duplicateIndex >= 0) return duplicateIndex;

  audioState.playlist = previousTracks.concat(list);
  audioState.currentIndex = currentIndex + previousTracks.length;
  audioState.playlistKind = "album";
  syncPlaylistContext(audioState.playlist, { preserveRecent: true });
  const previousIndex = previousTracks.length - 1;
  trackAudioRuntimeEvent("album_continuity_extend", {
    from_index: currentIndex,
    to_index: previousIndex,
    from_album: normalizeAlbumTitle(currentAlbum && currentAlbum.title ? currentAlbum.title : ""),
    to_album: normalizeAlbumTitle(previousAlbum.album.title || ""),
    prepended_count: previousTracks.length,
    wrapped: Boolean(previousAlbum.wrapped),
    direction: "previous",
    reason: options && options.reason ? String(options.reason) : ""
  });
  return previousIndex;
}

function scheduleAlbumContinuityNavigationRetry(direction, navigationOptions) {
  const opts = navigationOptions || {};
  if (opts.albumContinuityRetry) return;
  const currentTrack = getCurrentPlaylistTrack();
  const guardSrc = toAbsoluteUrlOrEmpty(
    getCurrentLogicalAudioSrc() || (currentTrack && currentTrack.src) || ""
  );
  const guardMatches = function (request) {
    if (!request) return false;
    const liveTrack = getCurrentPlaylistTrack();
    const liveSrc = toAbsoluteUrlOrEmpty(
      getCurrentLogicalAudioSrc() || (liveTrack && liveTrack.src) || ""
    );
    const sameSrc = request.src
      ? Boolean(liveSrc && srcMatches(liveSrc, request.src))
      : !liveSrc;
    return Number(audioState.startRequestToken || 0) === request.startRequestToken &&
      Number(audioState.modeTransitionToken || 0) === request.modeTransitionToken &&
      audioState.homeMode === request.homeMode &&
      Boolean(audioState.shuffleOn) === request.shuffleOn &&
      sameSrc;
  };
  const activeRequest = audioState.albumContinuityNavigationRequest;
  if (activeRequest && guardMatches(activeRequest)) {
    if (activeRequest.commands.length < 8) {
      activeRequest.commands.push({
        direction: direction === "previous" ? "previous" : "next",
        options: Object.assign({}, opts, { albumContinuityRetry: true })
      });
    }
    return;
  }
  if (activeRequest) audioState.albumContinuityNavigationRequest = null;
  const request = {
    startRequestToken: Number(audioState.startRequestToken || 0),
    modeTransitionToken: Number(audioState.modeTransitionToken || 0),
    src: guardSrc,
    homeMode: audioState.homeMode,
    shuffleOn: Boolean(audioState.shuffleOn),
    commands: [{
      direction: direction === "previous" ? "previous" : "next",
      options: Object.assign({}, opts, { albumContinuityRetry: true })
    }]
  };
  audioState.albumContinuityNavigationRequest = request;
  loadTracksData().then(function () {
    if (audioState.albumContinuityNavigationRequest !== request) return;
    audioState.albumContinuityNavigationRequest = null;
    if (!guardMatches(request)) return;
    request.commands.splice(0, request.commands.length).forEach(function (command) {
      if (command.direction === "previous") playPrevious(command.options);
      else playNext(command.options);
    });
  }).catch(function () {
    if (audioState.albumContinuityNavigationRequest === request) {
      audioState.albumContinuityNavigationRequest = null;
    }
  });
}

function buildPreservedTrack(track, fallbackSrc) {
  const src = toAbsoluteUrlOrEmpty(track && track.src ? track.src : fallbackSrc || "");
  if (!src) return null;
  return {
    src,
    name: normalizeTrackTitle(track && track.name ? track.name : ""),
    album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
    page: getCurrentTrackAlbumPage(track || null),
    artist: track && track.artist ? track.artist : "INFRA.",
    artwork: getCurrentTrackArtwork(track || null)
  };
}

function buildAlbumPlaylistFromRadioCache() {
  return callAudioRadio("buildAlbumPlaylistFromRadioCache", arguments);
}

function sanitizeQueueTrack() {
  return callAudioRadio("sanitizeQueueTrack", arguments);
}

function savePlaybackQueueContext() {
  return callAudioRadio("savePlaybackQueueContext", arguments);
}

function queueMatchesCurrentPage() {
  return callAudioRadio("queueMatchesCurrentPage", arguments);
}

function restorePlaybackQueueContext() {
  return callAudioRadio("restorePlaybackQueueContext", arguments);
}

function expandSingleTrackAlbumFromRadioCache() {
  return callAudioRadio("expandSingleTrackAlbumFromRadioCache", arguments);
}

function seekCurrentAudioToRatio(ratio) {
  return audioCoreApi.seekCurrentAudioToRatio(ratio);
}

export { normalizeAlbumContinuityPage, getAlbumContinuityTracksData, getAlbumContinuityCatalogAlbums, findTracksAlbumByCatalogEntry, findTracksAlbumForContinuityTrack, findNextAlbumForContinuity, findPreviousAlbumForContinuity, buildAlbumContinuityTrack, extendAlbumPlaylistToNextAlbum, extendAlbumPlaylistToPreviousAlbum, scheduleAlbumContinuityNavigationRetry, buildPreservedTrack, buildAlbumPlaylistFromRadioCache, sanitizeQueueTrack, savePlaybackQueueContext, queueMatchesCurrentPage, restorePlaybackQueueContext, expandSingleTrackAlbumFromRadioCache, seekCurrentAudioToRatio };
