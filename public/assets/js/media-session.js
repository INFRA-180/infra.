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

  function createMediaSessionRuntime(context) {
    const ctx = context || {};
    const state = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: new URL("./", window.location.href) };
    const covers = ctx.covers || globalObject.InfraCovers || {};
    const fn = function (name, fallback) {
      return typeof ctx[name] === "function" ? ctx[name] : (fallback || function () {});
    };
    const normalizeUrlAgainstBase = fn("normalizeUrlAgainstBase", function (value) { return String(value || ""); });
    const mergeTrackMetadata = fn("mergeTrackMetadata", function (value) { return value; });
    const resolveTracksAlbumArtwork = fn("resolveTracksAlbumArtwork", function () { return ""; });
    const resolveCatalogAlbumArtwork = fn("resolveCatalogAlbumArtwork", function () { return ""; });
    const normalizeTrackTitle = fn("normalizeTrackTitle", function (value) { return String(value || ""); });
    const normalizeAlbumTitle = fn("normalizeAlbumTitle", function (value) { return String(value || ""); });
    const getCurrentAlbumTitle = fn("getCurrentAlbumTitle", function () { return ""; });
    const getCurrentPlaylistTrack = fn("getCurrentPlaylistTrack", function () { return null; });
    const playFromExternalControl = fn("playFromExternalControl");
    const cancelExternalResumeCommand = fn("cancelExternalResumeCommand");
    const markAudioPauseIntent = fn("markAudioPauseIntent");
    const playPrevious = fn("playPrevious");
    const playNext = fn("playNext");
    const track = fn("trackAudioRuntimeEvent");
    const monitorPayload = fn("buildAudioMonitorPayload", function () { return {}; });
    const probeState = fn("getAudioRuntimeProbeState", function () { return {}; });
    const srcMatches = fn("srcMatches", function (left, right) { return String(left || "") === String(right || ""); });
    const getCurrentLogicalAudioSrc = fn("getCurrentLogicalAudioSrc", function () { return ""; });

    function parseSrcsetCandidates(value) {
      return String(value || "").split(",").map(function (entry) {
        const parts = String(entry || "").trim().split(/\s+/).filter(Boolean);
        const width = /w$/i.test(parts[1] || "") ? Number.parseInt(parts[1], 10) : NaN;
        return { src: parts[0] || "", width: Number.isFinite(width) ? width : null };
      }).filter(function (entry) { return entry.src; });
    }
    function choosePreferredSrcsetSource(value, width) {
      const target = Math.max(320, Number(width) || 900);
      return parseSrcsetCandidates(value).sort(function (a, b) {
        return Math.abs((a.width || target) - target) - Math.abs((b.width || target) - target);
      })[0]?.src || "";
    }
    function getSourceFromSrcset(value) { return choosePreferredSrcsetSource(value, 900); }
    function getAlbumCoverFromDoc(doc, baseUrl) {
      const image = doc && doc.querySelector ? doc.querySelector(".album-layout .cover, .cover") : null;
      return image ? normalizeUrlAgainstBase(getSourceFromSrcset(image.getAttribute("srcset") || "") || image.getAttribute("src") || image.currentSrc || "", baseUrl || doc.URL || window.location.href) : "";
    }
    function fallbackArtwork() { return new URL("assets/pwa/icon-512-logo-white.png", runtime.baseUrl).href; }
    function coverOptions(options) { return Object.assign({ baseUrl: runtime.baseUrl.href, currentHref: window.location.href, currentOrigin: window.location.origin, fallbackArtwork: fallbackArtwork() }, options || {}); }
    function normalizeArtworkUrl(value) { return typeof covers.normalizeArtworkUrl === "function" ? covers.normalizeArtworkUrl(value, coverOptions()) : fallbackArtwork(); }
    function normalizeCoverUrl(value, options) { return typeof covers.normalizeCoverUrl === "function" ? covers.normalizeCoverUrl(value, coverOptions(options)) : normalizeArtworkUrl(value); }
    function resolveCoverUrl(track, options) {
      if (typeof track === "string") return normalizeCoverUrl(track, options);
      const item = mergeTrackMetadata(track || null);
      const candidates = [item && item.artwork, resolveTracksAlbumArtwork(item), resolveCatalogAlbumArtwork(item), getAlbumCoverFromDoc(document, window.location.href)];
      return normalizeCoverUrl(candidates.find(Boolean) || fallbackArtwork(), options);
    }
    function buildMediaSessionArtwork(track) {
      const source = resolveCoverUrl(track, { width: 900 });
      const candidates = [source];
      if (typeof covers.buildResponsiveCoverCandidate === "function") candidates.push(covers.buildResponsiveCoverCandidate(source, 900, coverOptions()), covers.buildResponsiveCoverCandidate(source, 480, coverOptions()));
      const seen = new Set();
      return candidates.filter(Boolean).map(normalizeArtworkUrl).filter(function (sourceUrl) { if (seen.has(sourceUrl)) return false; seen.add(sourceUrl); return true; }).map(function (sourceUrl) { return { src: sourceUrl, sizes: typeof covers.inferArtworkSizeHint === "function" ? covers.inferArtworkSizeHint(sourceUrl) : "512x512", type: typeof covers.getArtworkType === "function" ? covers.getArtworkType(sourceUrl) : "image/png" }; });
    }
    function initAudioSessionTelemetry() {
      if (state.audioSessionTelemetryBound || !navigator.audioSession || typeof navigator.audioSession.addEventListener !== "function") return;
      state.audioSessionTelemetryBound = true;
      const report = function (trigger) { track("audio_session_state", { trigger, audio_session_state: String(navigator.audioSession.state || "unknown"), audio_session_type: String(navigator.audioSession.type || "auto") }); };
      navigator.audioSession.addEventListener("statechange", function () { report("statechange"); }); report("init");
    }
    function bindMediaSessionActions(options) {
      if (state.mediaSessionBound && !(options && options.force)) return;
      if (!isAvailable()) return;
      setActionHandler("play", function () { playFromExternalControl("media_session"); });
      setActionHandler("pause", function () { const audio = state.audio; if (!audio) return; cancelExternalResumeCommand(); markAudioPauseIntent("media_session", "media_session"); audio.pause(); });
      setActionHandler("previoustrack", function () { playPrevious({ seamless: true, fromMediaSession: true }); });
      setActionHandler("nexttrack", function () { playNext({ seamless: true, fromMediaSession: true }); });
      const seek = function (value, action) { const audio = state.audio; if (!audio || !Number.isFinite(value)) return; const duration = Number.isFinite(audio.duration) ? audio.duration : Infinity; const previous = audio.currentTime || 0; const next = Math.max(0, Math.min(duration, value)); try { audio.currentTime = next; syncMediaSessionMetadata({ forcePosition: true }); track("seek", Object.assign(monitorPayload(getCurrentPlaylistTrack(), state.currentIndex, state.activeLogicalSrc || audio.currentSrc || audio.src), probeState(), { source: "media_session", action, from_ms: Math.floor(previous * 1000), to_ms: Math.floor(next * 1000) })); } catch (_err) {} };
      setActionHandler("seekto", function (event) { if (event && Number.isFinite(event.seekTime)) seek(event.seekTime, "seekto"); });
      if (!isIOSStandalone()) { setActionHandler("seekbackward", function (event) { seek((state.audio?.currentTime || 0) - (event?.seekOffset || 10), "seekbackward"); }); setActionHandler("seekforward", function (event) { seek((state.audio?.currentTime || 0) + (event?.seekOffset || 10), "seekforward"); }); }
      state.mediaSessionBound = true;
    }
    function syncMediaSessionMetadata(options) {
      if (!hasMetadataSupport()) return;
      const audio = state.audio; const trackData = getCurrentPlaylistTrack();
      const title = normalizeTrackTitle(trackData?.name) || "INFRA."; const album = normalizeAlbumTitle(trackData?.album || getCurrentAlbumTitle()) || "INFRA."; const artist = String(trackData?.artist || "INFRA.").trim() || "INFRA.";
      const artwork = buildMediaSessionArtwork(trackData); const key = [title, album, artist].concat(artwork.map(function (entry) { return entry.src; })).join("|");
      const playing = Boolean(audio && state.mediaSessionAudioPlaying && !audio.paused); setPlaybackState(playing ? "playing" : "paused");
      if (key !== state.lastMediaSessionKey) { state.lastMediaSessionKey = key; setMetadata({ title, artist, album, artwork }); }
      if (!audio || (!(options && options.forcePosition) && state.mediaSessionPositionTs && Date.now() - state.mediaSessionPositionTs < 900)) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) { setPositionState({ duration: audio.duration, position: Math.max(0, Math.min(audio.duration, audio.currentTime || 0)), playbackRate: playing && Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1 }); state.mediaSessionPositionTs = Date.now(); }
    }
    function scheduleMediaSessionResync(token) { if (state.mediaSessionResyncTimer) clearTimeout(state.mediaSessionResyncTimer); state.mediaSessionResyncTimer = setTimeout(function () { state.mediaSessionResyncTimer = null; if (token === state.startRequestToken) syncMediaSessionMetadata({ forcePosition: true }); }, 300); }
    function clearWaitingRecovery() {
      if (state.waitingRecoveryTimer) clearTimeout(state.waitingRecoveryTimer);
      state.waitingRecoveryTimer = null;
      state.prefetchPausedUntil = 0;
    }
    function scheduleWaitingRecovery(context) {
      clearWaitingRecovery();
      state.prefetchPausedUntil = Date.now() + (isIOSStandalone() ? 2600 : 1600);
      const recovery = context || {};
      if (!recovery.hadProgress) return;
      state.waitingRecoveryTimer = setTimeout(function () {
        state.waitingRecoveryTimer = null;
        const audio = state.audio;
        if (recovery.requestToken !== state.startRequestToken) return;
        if (Number.isInteger(recovery.index) && recovery.index !== state.currentIndex) return;
        if (recovery.src && !srcMatches(recovery.src, getCurrentLogicalAudioSrc())) return;
        if (recovery.src && audio && audio.currentSrc && !srcMatches(recovery.src, audio.currentSrc)) return;
        if (!audio || audio.paused || state.trackStartInFlight || audio.readyState >= 3) return;
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        if (currentTime > Number(recovery.currentTime || 0) + 0.15) return;
        const resume = function () {
          if (recovery.requestToken !== state.startRequestToken) return;
          if (recovery.src && !srcMatches(recovery.src, getCurrentLogicalAudioSrc())) return;
          try { audio.currentTime = currentTime; } catch (_err) {}
          audio.play().catch(function () {});
        };
        audio.addEventListener("canplay", resume, { once: true });
        try {
          audio.load();
        } catch (_err) {
          audio.removeEventListener("canplay", resume);
        }
      }, 1200);
    }
    return { parseSrcsetCandidates, choosePreferredSrcsetSource, getSourceFromSrcset, getAlbumCoverFromDoc, getMediaSessionFallbackArtwork: fallbackArtwork, normalizeArtworkUrl, normalizeCoverUrl, resolveCoverUrl, buildMediaSessionArtwork, isIOSStandaloneMediaSession: isIOSStandalone, initAudioSessionTelemetry, bindMediaSessionActions, syncMediaSessionMetadata, scheduleMediaSessionResync, clearWaitingRecovery, scheduleWaitingRecovery };
  }

  globalObject.InfraMediaSession = Object.freeze({
    isAvailable,
    hasMetadataSupport,
    isIOSStandalone,
    setActionHandler,
    setMetadata,
    setPlaybackState,
    setPositionState,
    createMediaSessionRuntime
  });
})();
