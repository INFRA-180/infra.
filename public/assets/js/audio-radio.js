import { createExternalCommands } from "./audio-radio/external-commands.js";
import { createRadio } from "./audio-radio/radio.js";
import { createKeyboardShortcuts } from "./audio-radio/keyboard.js";
import { createPlayModes } from "./audio-radio/play-modes.js";
import { createQueueContext } from "./audio-radio/queue-context.js";
import { createPageCollection } from "./audio-radio/page-collection.js";
import { createAudioElement } from "./audio-radio/audio-element.js";
import { createPrefetch } from "./audio-radio/prefetch.js";

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

  function canAllowSystemInterruptionResume(options) {
    const args = options || {};
    const guard = args.guard || null;
    const now = Number.isFinite(Number(args.now)) ? Number(args.now) : Date.now();
    const allowedUntil = Number(args.allowedUntil || 0);
    if (!guard || !guard.token || !Number.isFinite(allowedUntil) || allowedUntil < now) return false;
    if (args.explicitPause === true) return false;
    if (String(args.audioSessionState || "") !== "active") return false;
    const guardSrc = String(guard.src || "");
    const currentSrc = String(args.currentSrc || "");
    if (!guardSrc || !currentSrc) return false;
    const matches =
      typeof args.srcMatches === "function" ? args.srcMatches(guardSrc, currentSrc) : guardSrc === currentSrc;
    if (!matches) return false;
    const savedPosition = Number(guard.currentTime);
    const currentPosition = Number(args.currentTime);
    if (Number.isFinite(savedPosition) && Number.isFinite(currentPosition)) {
      const resetToZero = args.allowPositionReset === true && savedPosition > 2 && currentPosition <= 0.75;
      if (!resetToZero && Math.abs(currentPosition - savedPosition) >= 2) return false;
    }
    return true;
  }

  function createAudioRadio(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL(".", window.location.href) };
    const PREFETCH_NEXT_ENABLED = Boolean(ctx.PREFETCH_NEXT_ENABLED);
    const prefetchApi = ctx.prefetchApi || null;
    const PREFETCH_NEXT_MAX_BYTES = Number.isFinite(Number(ctx.PREFETCH_NEXT_MAX_BYTES))
      ? Number(ctx.PREFETCH_NEXT_MAX_BYTES)
      : 2 * 1024 * 1024;
    const PREFETCH_NEXT_SEGMENT_BYTES = Number.isFinite(Number(ctx.PREFETCH_NEXT_SEGMENT_BYTES))
      ? Number(ctx.PREFETCH_NEXT_SEGMENT_BYTES)
      : 2 * 1024 * 1024;
    const PREFETCH_NEXT_QUEUE_DEPTH = Number.isFinite(Number(ctx.PREFETCH_NEXT_QUEUE_DEPTH))
      ? Math.max(1, Number(ctx.PREFETCH_NEXT_QUEUE_DEPTH))
      : 5;
    const PREFETCH_NEXT_CONCURRENCY = Number.isFinite(Number(ctx.PREFETCH_NEXT_CONCURRENCY))
      ? Math.max(1, Number(ctx.PREFETCH_NEXT_CONCURRENCY))
      : 2;
    const PREFETCH_NEXT_MAX_ENTRIES = Number.isFinite(Number(ctx.PREFETCH_NEXT_MAX_ENTRIES))
      ? Math.max(PREFETCH_NEXT_QUEUE_DEPTH, Number(ctx.PREFETCH_NEXT_MAX_ENTRIES))
      : 6;
    const PREFETCH_BUFFER_STABLE_SECONDS = Number.isFinite(Number(ctx.PREFETCH_BUFFER_STABLE_SECONDS))
      ? Number(ctx.PREFETCH_BUFFER_STABLE_SECONDS)
      : 8;
    const PREFETCH_BUFFER_ABORT_SECONDS = Number.isFinite(Number(ctx.PREFETCH_BUFFER_ABORT_SECONDS))
      ? Number(ctx.PREFETCH_BUFFER_ABORT_SECONDS)
      : 4;
    const PREFETCH_REQUEST_TIMEOUT_MS = Number.isFinite(Number(ctx.PREFETCH_REQUEST_TIMEOUT_MS))
      ? Number(ctx.PREFETCH_REQUEST_TIMEOUT_MS)
      : 8000;
    const PREFETCH_MAX_ATTEMPTS = Number.isFinite(Number(ctx.PREFETCH_MAX_ATTEMPTS))
      ? Math.max(1, Number(ctx.PREFETCH_MAX_ATTEMPTS))
      : 2;
    const PREFETCH_RETRY_BASE_MS = Number.isFinite(Number(ctx.PREFETCH_RETRY_BASE_MS))
      ? Math.max(1, Number(ctx.PREFETCH_RETRY_BASE_MS))
      : 300;
    const PREFETCH_RETRY_MAX_MS = Number.isFinite(Number(ctx.PREFETCH_RETRY_MAX_MS))
      ? Math.max(PREFETCH_RETRY_BASE_MS, Number(ctx.PREFETCH_RETRY_MAX_MS))
      : 1500;
    const SYSTEM_INTERRUPTION_GUARD_MS = 2 * 60 * 1000;
    const SYSTEM_INTERRUPTION_NEAR_END_SECONDS = 2.5;
    const loadTracksData = method(ctx, "loadTracksData", function () {
      return Promise.resolve({ albums: [] });
    });
    const toRuntimeAbsoluteUrl = method(ctx, "toRuntimeAbsoluteUrl", function (value) {
      return String(value || "");
    });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) {
      return String(value || "").trim();
    });
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) {
      return String(value || "").trim();
    });
    const resolveManagedAudioSrc = method(ctx, "resolveManagedAudioSrc", function (value) {
      return String(value || "");
    });
    const getAudioAssetPathKey = method(ctx, "getAudioAssetPathKey", function (value) {
      return String(value || "");
    });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () {
      return "";
    });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent", function () {});
    const srcMatches = method(ctx, "srcMatches", function (left, right) {
      return String(left || "") === String(right || "");
    });
    const getCurrentLogicalAudioSrc = method(ctx, "getCurrentLogicalAudioSrc", function () {
      return "";
    });
    const toAbsoluteUrlOrEmpty = method(ctx, "toAbsoluteUrlOrEmpty", function (value) {
      return String(value || "");
    });
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () {
      return "";
    });
    const normalizeAudioSourceUrl = method(ctx, "normalizeAudioSourceUrl", function (value) {
      return String(value || "");
    });
    const isCloudflareAudioUrl = method(ctx, "isCloudflareAudioUrl", function () {
      return false;
    });
    const syncAudioUi = method(ctx, "syncAudioUi", function () {});
    const syncMediaSessionMetadata = method(ctx, "syncMediaSessionMetadata", function () {});
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () {
      return null;
    });
    const syncPlaylistContext = method(ctx, "syncPlaylistContext", function () {});
    const buildPreservedTrack = method(ctx, "buildPreservedTrack", function () {
      return null;
    });
    const playPrevious = method(ctx, "playPrevious", function () {});
    const playNext = method(ctx, "playNext", function () {});
    const startTrack = method(ctx, "startTrack", function () {});
    const startRadioPlaybackFromIdle = method(ctx, "startRadioPlaybackFromIdle", function () {});
    const getCurrentPlaylistIndexSafe = method(ctx, "getCurrentPlaylistIndexSafe", function () {
      return -1;
    });
    const getRandomIndex = method(ctx, "getRandomIndex", function () {
      return -1;
    });
    const togglePlayPause = method(ctx, "togglePlayPause", function () {});
    const getCurrentTrackArtwork = method(ctx, "getCurrentTrackArtwork", function () {
      return "";
    });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () {
      return "";
    });
    const getCurrentTrackAlbumPage = method(ctx, "getCurrentTrackAlbumPage", function () {
      return "";
    });
    const toAbsoluteUrl = method(ctx, "toAbsoluteUrl", function (value) {
      return String(value || "");
    });
    const ensureCurrentIndexFromAudio = method(ctx, "ensureCurrentIndexFromAudio", function () {
      return -1;
    });
    const revokeActiveBlobUrl = method(ctx, "revokeActiveBlobUrl", function () {});
    const clearFadeTimer = method(ctx, "clearFadeTimer", function () {});
    const clearWaitingRecovery = method(ctx, "clearWaitingRecovery", function () {});
    const readNowPlayingVolumeVisible = method(ctx, "readNowPlayingVolumeVisible", function () {
      return false;
    });
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () {
      return document.body;
    });
    const configurePlaybackAudioSession = method(ctx, "configurePlaybackAudioSession", function () {
      return false;
    });
    const bindMediaSessionActions = method(ctx, "bindMediaSessionActions", function () {});
    const ensureGlobalTransportUi = method(ctx, "ensureGlobalTransportUi", function () {});
    const syncTransportUi = method(ctx, "syncTransportUi", function () {});
    const clearTrackFailureForCurrent = method(ctx, "clearTrackFailureForCurrent", function () {});
    const clearTrackStatus = method(ctx, "clearTrackStatus", function () {});
    const getTrackByIndex = method(ctx, "getTrackByIndex", function () {
      return null;
    });
    const startAudioTelemetryHeartbeat = method(ctx, "startAudioTelemetryHeartbeat", function () {});
    const stopAudioTelemetryHeartbeat = method(ctx, "stopAudioTelemetryHeartbeat", function () {});
    const markAudioTelemetryInactive = method(ctx, "markAudioTelemetryInactive", function () {});
    const buildAudioMonitorPayload = method(ctx, "buildAudioMonitorPayload", function () {
      return {};
    });
    const getAudioBufferedEnd = method(ctx, "getAudioBufferedEnd", function () {
      return 0;
    });
    const syncCurrentTrackDurationFromAudio = method(
      ctx,
      "syncCurrentTrackDurationFromAudio",
      function () {}
    );
    const logAudioAuditEvent = method(ctx, "logAudioAuditEvent", function () {});
    const setTrackStatus = method(ctx, "setTrackStatus", function () {});
    const scheduleWaitingRecovery = method(ctx, "scheduleWaitingRecovery", function () {});
    const scheduleAlbumCoverCacheWarmup = method(ctx, "scheduleAlbumCoverCacheWarmup", function () {});
    const getAudioRuntimeProbeState = method(ctx, "getAudioRuntimeProbeState", function () {
      return {};
    });
    const confirmAudioRecovery = method(ctx, "confirmAudioRecovery", function () {});
    const sendAudioMonitoringLog = method(ctx, "sendAudioMonitoringLog", function () {});
    const recoverFromTrackFailure = method(ctx, "recoverFromTrackFailure", function () {});
    const updateProgressUi = method(ctx, "updateProgressUi", function () {});
    const isBlobObjectUrl = method(ctx, "isBlobObjectUrl", function () {
      return false;
    });
    const getQueuePreviewIndices = method(ctx, "getQueuePreviewIndices", function () {
      return [];
    });

    // Lot C (10/11/2026) : les fonctions sont rangées par sujet dans audio-radio/.
    // Chaque module reçoit les réglages ci-dessus, puis tous sont reliés entre eux avant tout appel.
    const R = {
      context,
      ctx,
      audioState,
      runtime,
      PREFETCH_NEXT_ENABLED,
      prefetchApi,
      PREFETCH_NEXT_MAX_BYTES,
      PREFETCH_NEXT_SEGMENT_BYTES,
      PREFETCH_NEXT_QUEUE_DEPTH,
      PREFETCH_NEXT_CONCURRENCY,
      PREFETCH_NEXT_MAX_ENTRIES,
      PREFETCH_BUFFER_STABLE_SECONDS,
      PREFETCH_BUFFER_ABORT_SECONDS,
      PREFETCH_REQUEST_TIMEOUT_MS,
      PREFETCH_MAX_ATTEMPTS,
      PREFETCH_RETRY_BASE_MS,
      PREFETCH_RETRY_MAX_MS,
      SYSTEM_INTERRUPTION_GUARD_MS,
      SYSTEM_INTERRUPTION_NEAR_END_SECONDS,
      loadTracksData,
      toRuntimeAbsoluteUrl,
      normalizeAlbumTitle,
      normalizeTrackTitle,
      resolveManagedAudioSrc,
      getAudioAssetPathKey,
      formatTrackDuration,
      trackAudioRuntimeEvent,
      srcMatches,
      getCurrentLogicalAudioSrc,
      toAbsoluteUrlOrEmpty,
      getCurrentPlayableAudioSrc,
      normalizeAudioSourceUrl,
      isCloudflareAudioUrl,
      syncAudioUi,
      syncMediaSessionMetadata,
      getCurrentPlaylistTrack,
      syncPlaylistContext,
      buildPreservedTrack,
      playPrevious,
      playNext,
      startTrack,
      startRadioPlaybackFromIdle,
      getCurrentPlaylistIndexSafe,
      getRandomIndex,
      togglePlayPause,
      getCurrentTrackArtwork,
      getCurrentAlbumTitle,
      getCurrentTrackAlbumPage,
      toAbsoluteUrl,
      ensureCurrentIndexFromAudio,
      revokeActiveBlobUrl,
      clearFadeTimer,
      clearWaitingRecovery,
      readNowPlayingVolumeVisible,
      getSpaPersistRoot,
      configurePlaybackAudioSession,
      bindMediaSessionActions,
      ensureGlobalTransportUi,
      syncTransportUi,
      clearTrackFailureForCurrent,
      clearTrackStatus,
      getTrackByIndex,
      startAudioTelemetryHeartbeat,
      stopAudioTelemetryHeartbeat,
      markAudioTelemetryInactive,
      buildAudioMonitorPayload,
      getAudioBufferedEnd,
      syncCurrentTrackDurationFromAudio,
      logAudioAuditEvent,
      setTrackStatus,
      scheduleWaitingRecovery,
      scheduleAlbumCoverCacheWarmup,
      getAudioRuntimeProbeState,
      confirmAudioRecovery,
      sendAudioMonitoringLog,
      recoverFromTrackFailure,
      updateProgressUi,
      isBlobObjectUrl,
      getQueuePreviewIndices,
      canAllowSystemInterruptionResume
    };
    const parts = [
      createExternalCommands(R),
      createRadio(R),
      createKeyboardShortcuts(R),
      createPlayModes(R),
      createQueueContext(R),
      createPageCollection(R),
      createAudioElement(R),
      createPrefetch(R)
    ];
    for (const part of parts) Object.assign(R, part.fns);
    for (const part of parts) part.link();

    return {
      readHomePlayMode: R.readHomePlayMode,
      persistHomePlayMode: R.persistHomePlayMode,
      findPlaylistIndexByCurrentSrc: R.findPlaylistIndexByCurrentSrc,
      ensureRadioPlaylistLoaded: R.ensureRadioPlaylistLoaded,
      getTrackSource: R.getTrackSource,
      getRecentPlayedSrcSet: R.getRecentPlayedSrcSet,
      shuffledCopy: R.shuffledCopy,
      buildRadioQueue: R.buildRadioQueue,
      buildGlobalCatalogPlaylist: R.buildGlobalCatalogPlaylist,
      buildGlobalRandomPlaylistWithTelemetry: R.buildGlobalRandomPlaylistWithTelemetry,
      setGlobalCatalogPlaylist: R.setGlobalCatalogPlaylist,
      startGlobalRandomPlayback: R.startGlobalRandomPlayback,
      resetPreparedInitialGlobalRandomPlayback: R.resetPreparedInitialGlobalRandomPlayback,
      consumePreparedInitialGlobalRandomPlaylist: R.consumePreparedInitialGlobalRandomPlaylist,
      shouldPrepareInitialGlobalRandomPlayback: R.shouldPrepareInitialGlobalRandomPlayback,
      prepareInitialGlobalRandomPlayback: R.prepareInitialGlobalRandomPlayback,
      scheduleInitialGlobalRandomPreparation: R.scheduleInitialGlobalRandomPreparation,
      hasPlaybackSession: R.hasPlaybackSession,
      canStartInitialGlobalRandomPlayback: R.canStartInitialGlobalRandomPlayback,
      bindGlobalKeyboardShortcuts: R.bindGlobalKeyboardShortcuts,
      clearRadioQueue: R.clearRadioQueue,
      syncRadioQueueToPlaylist: R.syncRadioQueueToPlaylist,
      ensureRadioQueue: R.ensureRadioQueue,
      injectCurrentTrackIntoRadioQueue: R.injectCurrentTrackIntoRadioQueue,
      startSelectedTrackInRadioFromCold: R.startSelectedTrackInRadioFromCold,
      ensureRadioPlaylistForNavigation: R.ensureRadioPlaylistForNavigation,
      setHomePlayMode: R.setHomePlayMode,
      activateRadioModeFromTransport: R.activateRadioModeFromTransport,
      toggleRadioModeFromTransport: R.toggleRadioModeFromTransport,
      toggleAlbumShuffleMode: R.toggleAlbumShuffleMode,
      clearStoredPlaybackState: R.clearStoredPlaybackState,
      buildAlbumPlaylistFromRadioCache: R.buildAlbumPlaylistFromRadioCache,
      sanitizeQueueTrack: R.sanitizeQueueTrack,
      savePlaybackQueueContext: R.savePlaybackQueueContext,
      queueMatchesCurrentPage: R.queueMatchesCurrentPage,
      restorePlaybackQueueContext: R.restorePlaybackQueueContext,
      expandSingleTrackAlbumFromRadioCache: R.expandSingleTrackAlbumFromRadioCache,
      peekRadioNextIndexForPrefetch: R.peekRadioNextIndexForPrefetch,
      getPrefetchCacheRequest: R.getPrefetchCacheRequest,
      resetNextTrackPrefetchState: R.resetNextTrackPrefetchState,
      clearNextTrackPrefetch: R.clearNextTrackPrefetch,
      getCurrentBufferedEndForPrefetch: R.getCurrentBufferedEndForPrefetch,
      shouldPrefetchNextTrackNow: R.shouldPrefetchNextTrackNow,
      peekNextIndexForPrefetch: R.peekNextIndexForPrefetch,
      rememberNextTrackPrefetch: R.rememberNextTrackPrefetch,
      getAutoPrefetchedNextIndex: R.getAutoPrefetchedNextIndex,
      startNextTrackPrefetch: R.startNextTrackPrefetch,
      maybePrefetchNextTrack: R.maybePrefetchNextTrack,
      scheduleSilentCheck: R.scheduleSilentCheck,
      saveResumeState: R.saveResumeState,
      restoreResumeState: R.restoreResumeState,
      ensurePlayablePlaylistContext: R.ensurePlayablePlaylistContext,
      markAudioPauseIntent: R.markAudioPauseIntent,
      cancelSystemInterruptionResume: R.cancelSystemInterruptionResume,
      scheduleSystemInterruptionResumeAfterActive: R.scheduleSystemInterruptionResumeAfterActive,
      cancelExternalResumeCommand: R.cancelExternalResumeCommand,
      playFromExternalControl: R.playFromExternalControl,
      startCurrentPageCollectionFromIdle: R.startCurrentPageCollectionFromIdle,
      toggleCurrentPageCollection: R.toggleCurrentPageCollection,
      playCurrentPageCollectionShuffled: R.playCurrentPageCollectionShuffled,
      isCurrentPagePlaylistActive: R.isCurrentPagePlaylistActive,
      handleGlobalTransportToggle: R.handleGlobalTransportToggle,
      ensureGlobalAudio: R.ensureGlobalAudio,
      stopAudioRaf: R.stopAudioRaf,
      startAudioRaf: R.startAudioRaf
    };
  }

  function createNoopAudioRadio() {
    return {
      readHomePlayMode: function () {
        return "album";
      },
      persistHomePlayMode: function () {},
      findPlaylistIndexByCurrentSrc: function () {},
      ensureRadioPlaylistLoaded: function () {
        return Promise.resolve([]);
      },
      getTrackSource: function () {},
      getRecentPlayedSrcSet: function () {},
      shuffledCopy: function (list) {
        return Array.isArray(list) ? list.slice() : [];
      },
      buildRadioQueue: function () {
        return [];
      },
      buildGlobalCatalogPlaylist: function () {
        return [];
      },
      buildGlobalRandomPlaylistWithTelemetry: function () {
        return [];
      },
      setGlobalCatalogPlaylist: function () {
        return false;
      },
      startGlobalRandomPlayback: function () {},
      resetPreparedInitialGlobalRandomPlayback: function () {},
      consumePreparedInitialGlobalRandomPlaylist: function () {},
      shouldPrepareInitialGlobalRandomPlayback: function () {},
      prepareInitialGlobalRandomPlayback: function () {
        return Promise.resolve(null);
      },
      scheduleInitialGlobalRandomPreparation: function () {},
      hasPlaybackSession: function () {
        return false;
      },
      canStartInitialGlobalRandomPlayback: function () {
        return false;
      },
      bindGlobalKeyboardShortcuts: function () {},
      clearRadioQueue: function () {},
      syncRadioQueueToPlaylist: function () {},
      ensureRadioQueue: function () {
        return false;
      },
      injectCurrentTrackIntoRadioQueue: function () {
        return -1;
      },
      startSelectedTrackInRadioFromCold: function () {
        return false;
      },
      ensureRadioPlaylistForNavigation: function () {
        return true;
      },
      setHomePlayMode: function () {},
      activateRadioModeFromTransport: function () {},
      toggleRadioModeFromTransport: function () {},
      toggleAlbumShuffleMode: function () {},
      clearStoredPlaybackState: function () {},
      buildAlbumPlaylistFromRadioCache: function () {
        return [];
      },
      sanitizeQueueTrack: function () {
        return null;
      },
      savePlaybackQueueContext: function () {},
      queueMatchesCurrentPage: function () {},
      restorePlaybackQueueContext: function () {
        return false;
      },
      expandSingleTrackAlbumFromRadioCache: function () {
        return false;
      },
      peekRadioNextIndexForPrefetch: function () {
        return -1;
      },
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
      cancelSystemInterruptionResume: function () {},
      scheduleSystemInterruptionResumeAfterActive: function () {
        return false;
      },
      cancelExternalResumeCommand: function () {},
      playFromExternalControl: function () {},
      startCurrentPageCollectionFromIdle: function () {
        return false;
      },
      toggleCurrentPageCollection: function () {
        return false;
      },
      playCurrentPageCollectionShuffled: function () {},
      isCurrentPagePlaylistActive: function () {
        return false;
      },
      handleGlobalTransportToggle: function () {},
      ensureGlobalAudio: function () {
        return null;
      },
      stopAudioRaf: function () {},
      startAudioRaf: function () {}
    };
  }

  window.InfraAudioRadio = {
    createAudioRadio,
    createNoopAudioRadio,
    canAllowSystemInterruptionResume
  };
})();
