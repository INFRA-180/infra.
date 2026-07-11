(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  function getNavigator() {
    return globalObject.navigator || {};
  }

  function getMediaSession() {
    const nav = getNavigator();
    return nav && nav.mediaSession ? nav.mediaSession : null;
  }

  function isAvailable() {
    return Boolean(getMediaSession());
  }

  function hasMetadataSupport() {
    return Boolean(getMediaSession() && typeof globalObject.MediaMetadata === "function");
  }

  function isIOSStandalone() {
    const nav = getNavigator();
    const ua = String(nav.userAgent || "");
    const platform = String(nav.platform || "");
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      (platform === "MacIntel" && Number(nav.maxTouchPoints || 0) > 1);
    const standaloneDisplay = typeof globalObject.matchMedia === "function"
      ? globalObject.matchMedia("(display-mode: standalone)").matches
      : false;
    const legacyStandalone = nav.standalone === true;
    return Boolean(isIOS && (legacyStandalone || standaloneDisplay));
  }

  function setActionHandler(action, handler) {
    const mediaSession = getMediaSession();
    if (!mediaSession || typeof mediaSession.setActionHandler !== "function") return false;
    try {
      mediaSession.setActionHandler(action, handler);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function setMetadata(metadataArgs) {
    const mediaSession = getMediaSession();
    if (!mediaSession || typeof globalObject.MediaMetadata !== "function") return false;
    try {
      mediaSession.metadata = new globalObject.MediaMetadata(metadataArgs || {});
      return true;
    } catch (_err) {
      return false;
    }
  }

  function setPlaybackState(state) {
    const mediaSession = getMediaSession();
    if (!mediaSession) return false;
    try {
      mediaSession.playbackState = state;
      return true;
    } catch (_err) {
      return false;
    }
  }

  function setPositionState(positionState) {
    const mediaSession = getMediaSession();
    if (!mediaSession || typeof mediaSession.setPositionState !== "function") return false;
    try {
      mediaSession.setPositionState(positionState || {});
      return true;
    } catch (_err) {
      return false;
    }
  }

  globalObject.InfraMediaSession = Object.freeze({
    isAvailable,
    hasMetadataSupport,
    isIOSStandalone,
    setActionHandler,
    setMetadata,
    setPlaybackState,
    setPositionState
  });
})();
