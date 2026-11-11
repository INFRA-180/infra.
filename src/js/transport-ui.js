import { createMiniProgress } from "./transport-ui/mini-progress.js";
import { createPictureInPicture } from "./transport-ui/picture-in-picture.js";
import { createDesktopLayout } from "./transport-ui/desktop-layout.js";
import { createTransportBuilder } from "./transport-ui/transport-builder.js";
import { createMiniPlayer } from "./transport-ui/mini-player.js";

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

  function createTransportUi(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const spaState = ctx.spaState || {};
    const DESKTOP_TRANSPORT_STORAGE_KEY =
      ctx.DESKTOP_TRANSPORT_STORAGE_KEY || "infra_desktop_transport_layout_v2";
    const DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY =
      ctx.DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY || "infra_desktop_transport_layout_v1";
    const DESKTOP_TRANSPORT_MIN_WIDTH = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MIN_WIDTH))
      ? Number(ctx.DESKTOP_TRANSPORT_MIN_WIDTH)
      : 254;
    const DESKTOP_TRANSPORT_MIN_HEIGHT = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MIN_HEIGHT))
      ? Number(ctx.DESKTOP_TRANSPORT_MIN_HEIGHT)
      : 116;
    const DESKTOP_TRANSPORT_MARGIN = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MARGIN))
      ? Number(ctx.DESKTOP_TRANSPORT_MARGIN)
      : 8;
    const DESKTOP_TRANSPORT_DRAG_THRESHOLD = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_DRAG_THRESHOLD))
      ? Number(ctx.DESKTOP_TRANSPORT_DRAG_THRESHOLD)
      : 6;
    const DESKTOP_TRANSPORT_COVER_MIN_WIDTH = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_WIDTH))
      ? Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_WIDTH)
      : 380;
    const DESKTOP_TRANSPORT_COVER_MIN_HEIGHT = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_HEIGHT))
      ? Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_HEIGHT)
      : 150;
    const DOCUMENT_PIP_DETACH_EDGE_THRESHOLD = 18;
    const DOCUMENT_PIP_MIN_WIDTH = 320;
    const DOCUMENT_PIP_MIN_HEIGHT = 180;
    const DOCUMENT_PIP_MAX_WIDTH = 560;
    const DOCUMENT_PIP_MAX_HEIGHT = 420;
    const HEART_ICON_OUTLINE = ctx.HEART_ICON_OUTLINE || "";
    const RADIO_ICON = ctx.RADIO_ICON || "";
    const SHUFFLE_ICON = ctx.SHUFFLE_ICON || "";
    const resolveCoverUrl = method(ctx, "resolveCoverUrl", function () {
      return "";
    });
    const setCoverWhenReady = method(ctx, "setCoverWhenReady");
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () {
      return null;
    });
    const getMediaSessionFallbackArtwork = method(ctx, "getMediaSessionFallbackArtwork", function () {
      return "";
    });
    const bindGlobalKeyboardShortcuts = method(ctx, "bindGlobalKeyboardShortcuts");
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () {
      return document.body;
    });
    const toggleRadioModeFromTransport = method(ctx, "toggleRadioModeFromTransport");
    const playPrevious = method(ctx, "playPrevious");
    const playNext = method(ctx, "playNext");
    const movePlaylistItem = method(ctx, "movePlaylistItem", function () {
      return false;
    });
    const handleGlobalTransportToggle = method(ctx, "handleGlobalTransportToggle");
    const toggleAlbumShuffleMode = method(ctx, "toggleAlbumShuffleMode");
    const toggleCurrentFavorite = method(ctx, "toggleCurrentFavorite");
    const openNowPlayingOverlay = method(ctx, "openNowPlayingOverlay");
    const closeNowPlayingOverlay = method(ctx, "closeNowPlayingOverlay");
    const togglePlayPause = method(ctx, "togglePlayPause");
    const setNowPlayingQueueOpen = method(ctx, "setNowPlayingQueueOpen");
    const startTrack = method(ctx, "startTrack");
    const toggleNowPlayingVolumeVisible = method(ctx, "toggleNowPlayingVolumeVisible");
    const isIosDevice = method(ctx, "isIosDevice", function () {
      return false;
    });
    const seekCurrentAudioToRatio = method(ctx, "seekCurrentAudioToRatio");
    const updateProgressUi = method(ctx, "updateProgressUi");
    const syncNowPlayingOverlay = method(ctx, "syncNowPlayingOverlay");
    const syncNowPlayingOverlayProgress = method(ctx, "syncNowPlayingOverlayProgress");
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () {
      return "";
    });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () {
      return "0:00";
    });
    const ensurePlayablePlaylistContext = method(ctx, "ensurePlayablePlaylistContext");
    const hasPlaybackSession = method(ctx, "hasPlaybackSession", function () {
      return false;
    });
    const canStartInitialGlobalRandomPlayback = method(
      ctx,
      "canStartInitialGlobalRandomPlayback",
      function () {
        return false;
      }
    );
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) {
      return String(value || "").trim();
    });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) {
      return String(value || "").trim();
    });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () {
      return "";
    });
    const getCurrentTrackAlbumPage = method(ctx, "getCurrentTrackAlbumPage", function () {
      return "";
    });
    const syncCurrentFavoriteButtons = method(ctx, "syncCurrentFavoriteButtons");
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const getRuntimeAssetUrl = method(ctx, "getRuntimeAssetUrl", function (path) {
      try {
        return new URL(String(path || ""), document.baseURI).href;
      } catch (_error) {
        return String(path || "");
      }
    });
    const audioVisualizerApi = window.InfraAudioVisualizer || null;

    // lot D (11/11/2026) : les fonctions sont rangées par sujet dans transport-ui/.
    // Chaque module reçoit les réglages ci-dessus, puis tous sont reliés entre eux avant tout appel.
    const R = {
      context,
      ctx,
      audioState,
      spaState,
      DESKTOP_TRANSPORT_STORAGE_KEY,
      DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY,
      DESKTOP_TRANSPORT_MIN_WIDTH,
      DESKTOP_TRANSPORT_MIN_HEIGHT,
      DESKTOP_TRANSPORT_MARGIN,
      DESKTOP_TRANSPORT_DRAG_THRESHOLD,
      DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
      DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
      DOCUMENT_PIP_DETACH_EDGE_THRESHOLD,
      DOCUMENT_PIP_MIN_WIDTH,
      DOCUMENT_PIP_MIN_HEIGHT,
      DOCUMENT_PIP_MAX_WIDTH,
      DOCUMENT_PIP_MAX_HEIGHT,
      HEART_ICON_OUTLINE,
      RADIO_ICON,
      SHUFFLE_ICON,
      resolveCoverUrl,
      setCoverWhenReady,
      getCurrentPlaylistTrack,
      getMediaSessionFallbackArtwork,
      bindGlobalKeyboardShortcuts,
      getSpaPersistRoot,
      toggleRadioModeFromTransport,
      playPrevious,
      playNext,
      movePlaylistItem,
      handleGlobalTransportToggle,
      toggleAlbumShuffleMode,
      toggleCurrentFavorite,
      openNowPlayingOverlay,
      closeNowPlayingOverlay,
      togglePlayPause,
      setNowPlayingQueueOpen,
      startTrack,
      toggleNowPlayingVolumeVisible,
      isIosDevice,
      seekCurrentAudioToRatio,
      updateProgressUi,
      syncNowPlayingOverlay,
      syncNowPlayingOverlayProgress,
      getCurrentPlayableAudioSrc,
      formatTrackDuration,
      ensurePlayablePlaylistContext,
      hasPlaybackSession,
      canStartInitialGlobalRandomPlayback,
      normalizeTrackTitle,
      normalizeAlbumTitle,
      getCurrentAlbumTitle,
      getCurrentTrackAlbumPage,
      syncCurrentFavoriteButtons,
      trackAudioRuntimeEvent,
      getRuntimeAssetUrl,
      audioVisualizerApi
    };
    const parts = [
      createMiniProgress(R),
      createPictureInPicture(R),
      createDesktopLayout(R),
      createTransportBuilder(R),
      createMiniPlayer(R)
    ];
    for (const part of parts) Object.assign(R, part.fns);
    for (const part of parts) part.link();

    return {
      isDesktopTransportViewport: R.isDesktopTransportViewport,
      getDesktopTransportState: R.getDesktopTransportState,
      readDesktopTransportLayout: R.readDesktopTransportLayout,
      writeDesktopTransportLayout: R.writeDesktopTransportLayout,
      clampDesktopTransportLayout: R.clampDesktopTransportLayout,
      clampDesktopTransportPosition: R.clampDesktopTransportPosition,
      syncDesktopTransportCover: R.syncDesktopTransportCover,
      applyDesktopTransportLayout: R.applyDesktopTransportLayout,
      applyDesktopTransportPosition: R.applyDesktopTransportPosition,
      clearDesktopTransportInlineStyles: R.clearDesktopTransportInlineStyles,
      syncDesktopTransportLayout: R.syncDesktopTransportLayout,
      isDesktopTransportPointer: R.isDesktopTransportPointer,
      bindDesktopTransportUi: R.bindDesktopTransportUi,
      isDocumentPictureInPictureSupported: R.isDocumentPictureInPictureSupported,
      isTransportPictureInPictureOpen: R.isTransportPictureInPictureOpen,
      requestTransportPictureInPicture: R.requestTransportPictureInPicture,
      closeTransportPictureInPicture: R.closeTransportPictureInPicture,
      syncTransportPictureInPictureUi: R.syncTransportPictureInPictureUi,
      bindMiniProgressSeek: R.bindMiniProgressSeek,
      ensureGlobalTransportUi: R.ensureGlobalTransportUi,
      syncTransportMiniUi: R.syncTransportMiniUi,
      syncMobilePlayerSpace: R.syncMobilePlayerSpace,
      syncTransportUi: R.syncTransportUi
    };
  }

  window.InfraTransportUi = Object.assign(window.InfraTransportUi || {}, {
    createTransportUi: createTransportUi
  });
})();
