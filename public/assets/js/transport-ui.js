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
    const DESKTOP_TRANSPORT_STORAGE_KEY = ctx.DESKTOP_TRANSPORT_STORAGE_KEY || "infra_desktop_transport_layout_v2";
    const DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY = ctx.DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY || "infra_desktop_transport_layout_v1";
    const DESKTOP_TRANSPORT_MIN_WIDTH = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MIN_WIDTH)) ? Number(ctx.DESKTOP_TRANSPORT_MIN_WIDTH) : 254;
    const DESKTOP_TRANSPORT_MIN_HEIGHT = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MIN_HEIGHT)) ? Number(ctx.DESKTOP_TRANSPORT_MIN_HEIGHT) : 116;
    const DESKTOP_TRANSPORT_MARGIN = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_MARGIN)) ? Number(ctx.DESKTOP_TRANSPORT_MARGIN) : 8;
    const DESKTOP_TRANSPORT_DRAG_THRESHOLD = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_DRAG_THRESHOLD)) ? Number(ctx.DESKTOP_TRANSPORT_DRAG_THRESHOLD) : 6;
    const DESKTOP_TRANSPORT_COVER_MIN_WIDTH = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_WIDTH)) ? Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_WIDTH) : 380;
    const DESKTOP_TRANSPORT_COVER_MIN_HEIGHT = Number.isFinite(Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_HEIGHT)) ? Number(ctx.DESKTOP_TRANSPORT_COVER_MIN_HEIGHT) : 150;
    const DOCUMENT_PIP_DETACH_EDGE_THRESHOLD = 18;
    const DOCUMENT_PIP_MIN_WIDTH = 320;
    const DOCUMENT_PIP_MIN_HEIGHT = 180;
    const DOCUMENT_PIP_MAX_WIDTH = 560;
    const DOCUMENT_PIP_MAX_HEIGHT = 420;
    const HEART_ICON_OUTLINE = ctx.HEART_ICON_OUTLINE || "";
    const RADIO_ICON = ctx.RADIO_ICON || "";
    const SHUFFLE_ICON = ctx.SHUFFLE_ICON || "";
    const resolveCoverUrl = method(ctx, "resolveCoverUrl", function () { return ""; });
    const setCoverWhenReady = method(ctx, "setCoverWhenReady");
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () { return null; });
    const getMediaSessionFallbackArtwork = method(ctx, "getMediaSessionFallbackArtwork", function () { return ""; });
    const bindGlobalKeyboardShortcuts = method(ctx, "bindGlobalKeyboardShortcuts");
    const getSpaPersistRoot = method(ctx, "getSpaPersistRoot", function () { return document.body; });
    const toggleRadioModeFromTransport = method(ctx, "toggleRadioModeFromTransport");
    const playPrevious = method(ctx, "playPrevious");
    const playNext = method(ctx, "playNext");
    const movePlaylistItem = method(ctx, "movePlaylistItem", function () { return false; });
    const handleGlobalTransportToggle = method(ctx, "handleGlobalTransportToggle");
    const toggleAlbumShuffleMode = method(ctx, "toggleAlbumShuffleMode");
    const toggleCurrentFavorite = method(ctx, "toggleCurrentFavorite");
    const openNowPlayingOverlay = method(ctx, "openNowPlayingOverlay");
    const closeNowPlayingOverlay = method(ctx, "closeNowPlayingOverlay");
    const disableNowPlayingOverlayUi = method(ctx, "disableNowPlayingOverlayUi");
    const togglePlayPause = method(ctx, "togglePlayPause");
    const setNowPlayingQueueOpen = method(ctx, "setNowPlayingQueueOpen");
    const startTrack = method(ctx, "startTrack");
    const toggleNowPlayingVolumeVisible = method(ctx, "toggleNowPlayingVolumeVisible");
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const seekCurrentAudioToRatio = method(ctx, "seekCurrentAudioToRatio");
    const updateProgressUi = method(ctx, "updateProgressUi");
    const syncNowPlayingOverlay = method(ctx, "syncNowPlayingOverlay");
    const syncNowPlayingOverlayProgress = method(ctx, "syncNowPlayingOverlayProgress");
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () { return ""; });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () { return "0:00"; });
    const ensurePlayablePlaylistContext = method(ctx, "ensurePlayablePlaylistContext");
    const hasPlaybackSession = method(ctx, "hasPlaybackSession", function () { return false; });
    const canStartInitialGlobalRandomPlayback = method(ctx, "canStartInitialGlobalRandomPlayback", function () { return false; });
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) { return String(value || "").trim(); });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) { return String(value || "").trim(); });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const getCurrentTrackAlbumPage = method(ctx, "getCurrentTrackAlbumPage", function () { return ""; });
    const syncCurrentFavoriteButtons = method(ctx, "syncCurrentFavoriteButtons");
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const getRuntimeAssetUrl = method(ctx, "getRuntimeAssetUrl", function (path) {
      try {
        return new URL(String(path || ""), document.baseURI).href;
      } catch (error) {
        return String(path || "");
      }
    });
    const audioVisualizerApi = window.InfraAudioVisualizer || null;

  function isDesktopTransportViewport() {
    return typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 981px)").matches;
  }

  function canStartCurrentPageCollectionFromIdle(audio) {
    return Boolean(
      document.body &&
      document.body.classList.contains("album-screen") &&
      audio &&
      audio.paused &&
      !getCurrentPlayableAudioSrc(audio) &&
      audioState.ui &&
      Array.isArray(audioState.ui.playlist) &&
      audioState.ui.playlist.length
    );
  }

  function getTransportPictureInPictureState() {
    const desktopState = getDesktopTransportState();
    if (!desktopState.pictureInPicture) {
      desktopState.pictureInPicture = {
        window: null,
        root: null,
        refs: null,
        raf: 0,
        openPromise: null
      };
    }
    return desktopState.pictureInPicture;
  }

  function getDocumentPictureInPictureApi() {
    const api = window.documentPictureInPicture;
    return api && typeof api.requestWindow === "function" ? api : null;
  }

  function isDocumentPictureInPictureSupported() {
    return Boolean(isDesktopTransportViewport() && getDocumentPictureInPictureApi());
  }

  function isTransportPictureInPictureOpen() {
    const pipState = getTransportPictureInPictureState();
    return Boolean(
      audioState.transportPipOpen &&
      pipState.window &&
      pipState.window.closed !== true
    );
  }

  function copyTransportPictureInPictureStyles(pipDocument) {
    if (!pipDocument || !pipDocument.head) return;
    const minimalStyle = pipDocument.createElement("style");
    minimalStyle.textContent = [
      "html,body{width:100%;height:100%;margin:0;overflow:hidden;}",
      "body{display:grid;place-items:stretch;background:var(--bg-start,#f4f4f4);}"
    ].join("");
    pipDocument.head.appendChild(minimalStyle);

    const sourceLink = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).find(function (candidate) {
      const rawHref = String(candidate.getAttribute("href") || candidate.href || "");
      return rawHref.indexOf("assets/css/styles.css") !== -1;
    });
    let query = "";
    if (sourceLink) {
      try {
        query = new URL(sourceLink.href, document.baseURI).search;
      } catch (error) {
        query = "";
      }
    }
    const link = pipDocument.createElement("link");
    link.rel = "stylesheet";
    link.href = getRuntimeAssetUrl("assets/css/styles.css" + query);
    pipDocument.head.appendChild(link);
  }

  function syncTransportPictureInPictureTheme(pipDocument) {
    if (!pipDocument || !pipDocument.documentElement || typeof window.getComputedStyle !== "function") return;
    const source = window.getComputedStyle(document.documentElement);
    const variables = [
      "--accent", "--ink", "--ink-soft", "--line", "--bg-glow-1", "--bg-glow-2",
      "--bg-start", "--bg-mid", "--bg-end", "--overlay-bg", "--panel-bg",
      "--panel-border", "--code-bg", "--pill-bg", "--pill-ink"
    ];
    variables.forEach(function (name) {
      const value = String(source.getPropertyValue(name) || "").trim();
      if (value) pipDocument.documentElement.style.setProperty(name, value);
    });
    const theme = String(document.documentElement.getAttribute("data-theme") || "").trim();
    if (theme) {
      pipDocument.documentElement.setAttribute("data-theme", theme);
      if (pipDocument.body) pipDocument.body.setAttribute("data-theme", theme);
    }
  }

  function getTransportPictureInPictureMarkup() {
    return [
      '<div class="global-transport transport-pip-player" data-transport-pip-root>',
      '  <div class="global-transport-cover-frame" data-transport-cover-frame hidden>',
      '    <img class="global-transport-cover" data-transport-cover alt="" hidden decoding="async">',
      "  </div>",
      '  <div class="global-transport-now" data-transport-now aria-live="polite">',
      '    <div class="global-transport-now-line global-transport-now-meta" data-transport-now-meta>',
      '      <span class="global-transport-now-title" data-transport-now-title></span>',
      '      <span class="global-transport-now-album" data-transport-now-album></span>',
      "    </div>",
      '    <button class="global-transport-favorite" type="button" data-transport-favorite hidden aria-label="Ajouter aux favoris" aria-pressed="false">' + HEART_ICON_OUTLINE + "</button>",
      '    <div class="global-transport-now-mini" data-transport-mini>',
      '      <span class="global-transport-mini-time" data-transport-mini-current>0:00</span>',
      '      <button class="global-transport-mini-progress" type="button" data-transport-mini-progress aria-label="Avancer dans le morceau">',
      '        <span class="global-transport-mini-fill" data-transport-mini-fill></span>',
      "      </button>",
      '      <span class="global-transport-mini-time" data-transport-mini-duration>0:00</span>',
      "    </div>",
      "  </div>",
      '  <div class="global-transport-controls">',
      '    <button class="global-transport-btn global-transport-mode" type="button" data-transport-mode aria-label="Activer la radio aleatoire">' + RADIO_ICON + "</button>",
      '    <div class="global-transport-main">',
      '      <button class="global-transport-btn" type="button" data-transport-prev aria-label="Piste precedente">',
      '        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h3v12H6zM10 12l10-6v12z"/></svg>',
      "      </button>",
      '      <button class="global-transport-btn" type="button" data-transport-toggle aria-label="Lecture">',
      '        <svg class="transport-icon transport-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
      '        <svg class="transport-icon transport-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
      "      </button>",
      '      <button class="global-transport-btn" type="button" data-transport-next aria-label="Piste suivante">',
      '        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 12L4 6v12zM18 6h3v12h-3z"/></svg>',
      "      </button>",
      "    </div>",
      '    <button class="global-transport-btn" type="button" data-transport-shuffle aria-label="Shuffle">' + SHUFFLE_ICON + "</button>",
      "  </div>",
      "</div>"
    ].join("");
  }

  function getTransportPictureInPictureRefs(pipWindow) {
    const pipDocument = pipWindow && pipWindow.document;
    const root = pipDocument ? pipDocument.querySelector("[data-transport-pip-root]") : null;
    if (!root) return null;
    return {
      window: pipWindow,
      document: pipDocument,
      root,
      coverFrame: root.querySelector("[data-transport-cover-frame]"),
      cover: root.querySelector("[data-transport-cover]"),
      nowWrap: root.querySelector("[data-transport-now]"),
      nowTitle: root.querySelector("[data-transport-now-title]"),
      nowAlbum: root.querySelector("[data-transport-now-album]"),
      favoriteBtn: root.querySelector("[data-transport-favorite]"),
      miniCurrent: root.querySelector("[data-transport-mini-current]"),
      miniDuration: root.querySelector("[data-transport-mini-duration]"),
      miniProgress: root.querySelector("[data-transport-mini-progress]"),
      miniFill: root.querySelector("[data-transport-mini-fill]"),
      modeBtn: root.querySelector("[data-transport-mode]"),
      prevBtn: root.querySelector("[data-transport-prev]"),
      toggleBtn: root.querySelector("[data-transport-toggle]"),
      nextBtn: root.querySelector("[data-transport-next]"),
      shuffleBtn: root.querySelector("[data-transport-shuffle]")
    };
  }

  function getTransportPictureInPictureViewport(refs) {
    const pipWindow = refs && refs.window;
    const pipDocument = refs && refs.document;
    return {
      width: Math.max(1, Number(pipWindow && pipWindow.innerWidth) || Number(pipDocument && pipDocument.documentElement && pipDocument.documentElement.clientWidth) || 1),
      height: Math.max(1, Number(pipWindow && pipWindow.innerHeight) || Number(pipDocument && pipDocument.documentElement && pipDocument.documentElement.clientHeight) || 1)
    };
  }

  function syncTransportPictureInPictureProgress() {
    const refs = getTransportPictureInPictureState().refs;
    if (!refs) return;
    const audio = audioState.audio;
    const hasSource = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasDuration = Boolean(
      hasSource &&
      !audioState.sourceMetadataPending &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    );
    const currentTime = hasDuration && Number.isFinite(audio.currentTime) && audio.currentTime > 0
      ? formatTrackDuration(audio.currentTime)
      : "0:00";
    const duration = hasDuration ? formatTrackDuration(audio.duration) : "0:00";
    const percent = hasDuration ? Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) : 0;
    if (refs.miniCurrent) refs.miniCurrent.textContent = currentTime;
    if (refs.miniDuration) refs.miniDuration.textContent = duration;
    if (refs.miniFill) refs.miniFill.style.width = `${percent}%`;
    if (refs.miniProgress) refs.miniProgress.disabled = !hasDuration;
  }

  function syncTransportPictureInPictureUi() {
    const pipState = getTransportPictureInPictureState();
    const refs = pipState.refs;
    if (!refs || !refs.window || refs.window.closed === true) return;
    const audio = audioState.audio;
    const hasPlaybackSessionActive = hasPlaybackSession();
    const hasPlaylist = Boolean(audioState.playlist && audioState.playlist.length);
    const canStartInitialRandom = canStartInitialGlobalRandomPlayback();
    const canStartCurrentCollection = canStartCurrentPageCollectionFromIdle(audio);
    const canToggle = Boolean(audio && (
      hasPlaybackSessionActive ||
      hasPlaylist ||
      canStartInitialRandom ||
      canStartCurrentCollection
    ));
    const canSkip = Boolean(audioState.playlist && audioState.playlist.length > 1);
    const isRadioMode = audioState.homeMode === "radio";
    const shuffleActive = Boolean(audioState.shuffleOn && !isRadioMode);
    const currentTrack = getCurrentPlaylistTrack();
    const trackTitle = normalizeTrackTitle(currentTrack && currentTrack.name ? currentTrack.name : "");
    const trackAlbum = normalizeAlbumTitle(
      currentTrack && currentTrack.album ? currentTrack.album : getCurrentAlbumTitle()
    );
    const viewport = getTransportPictureInPictureViewport(refs);
    const expanded = Boolean(
      currentTrack &&
      viewport.width >= DESKTOP_TRANSPORT_COVER_MIN_WIDTH &&
      viewport.height >= DESKTOP_TRANSPORT_COVER_MIN_HEIGHT
    );
    const compact = !expanded;
    const narrow = Boolean(
      expanded &&
      (viewport.width < 520 || viewport.height < 240)
    );
    const wide = Boolean(expanded && !narrow);

    refs.root.classList.toggle("is-playing", Boolean(audio && !audio.paused));
    refs.root.classList.toggle("has-playback-session", hasPlaybackSessionActive);
    refs.root.classList.toggle("has-custom-layout", expanded);
    refs.root.classList.toggle("is-expanded", expanded);
    refs.root.classList.toggle("is-compact", compact);
    refs.root.classList.toggle("is-narrow", narrow);
    refs.root.classList.toggle("is-wide", wide);
    if (refs.nowWrap) refs.nowWrap.hidden = !trackTitle;
    if (refs.nowTitle) refs.nowTitle.textContent = trackTitle;
    if (refs.nowAlbum) {
      refs.nowAlbum.textContent = trackAlbum;
      refs.nowAlbum.hidden = !trackAlbum;
    }
    if (refs.toggleBtn) {
      refs.toggleBtn.disabled = !canToggle || Boolean(audioState.globalRandomStartInFlight);
      refs.toggleBtn.setAttribute("aria-label", audio && !audio.paused ? "Pause" : "Lecture");
    }
    if (refs.prevBtn) refs.prevBtn.disabled = !canSkip;
    if (refs.nextBtn) refs.nextBtn.disabled = !canSkip;
    if (refs.modeBtn) {
      refs.modeBtn.disabled = false;
      refs.modeBtn.classList.toggle("is-on", isRadioMode);
      refs.modeBtn.setAttribute("aria-pressed", isRadioMode ? "true" : "false");
      refs.modeBtn.setAttribute("aria-label", isRadioMode ? "Desactiver la radio aleatoire" : "Activer la radio aleatoire");
    }
    if (refs.shuffleBtn) {
      refs.shuffleBtn.disabled = !canSkip;
      refs.shuffleBtn.classList.toggle("is-on", shuffleActive);
      refs.shuffleBtn.setAttribute("aria-pressed", shuffleActive ? "true" : "false");
      refs.shuffleBtn.setAttribute(
        "aria-label",
        isRadioMode
          ? "Activer le shuffle album et desactiver la radio"
          : (shuffleActive ? "Desactiver le shuffle album" : "Activer le shuffle album")
      );
    }

    if (refs.coverFrame) refs.coverFrame.hidden = !expanded;
    if (refs.cover) {
      refs.cover.hidden = !expanded;
      if (expanded && currentTrack) {
        refs.cover.alt = `Pochette ${trackAlbum || "INFRA."}`;
        setCoverWhenReady(
          refs.cover,
          resolveCoverUrl(currentTrack, { width: 1200 }),
          getMediaSessionFallbackArtwork()
        );
      }
    }
    syncTransportPictureInPictureTheme(refs.document);
    syncTransportPictureInPictureProgress();
    if (audioState.transport) audioState.transport.pipFavorite = refs.favoriteBtn;
    syncCurrentFavoriteButtons();
  }

  function stopTransportPictureInPictureRaf(pipState) {
    const state = pipState || getTransportPictureInPictureState();
    if (!state.raf) return;
    try {
      if (state.window && typeof state.window.cancelAnimationFrame === "function") {
        state.window.cancelAnimationFrame(state.raf);
      }
    } catch (_err) {
      // The PiP browsing context may already be gone.
    }
    state.raf = 0;
  }

  function startTransportPictureInPictureRaf() {
    const pipState = getTransportPictureInPictureState();
    stopTransportPictureInPictureRaf(pipState);
    const pipWindow = pipState.window;
    if (!pipWindow || typeof pipWindow.requestAnimationFrame !== "function") return;
    let lastUpdate = 0;
    function tick(now) {
      if (!pipState.window || pipState.window.closed === true || !audioState.transportPipOpen) {
        pipState.raf = 0;
        return;
      }
      if (!lastUpdate || now - lastUpdate >= 90) {
        syncTransportPictureInPictureProgress();
        lastUpdate = now;
      }
      pipState.raf = pipWindow.requestAnimationFrame(tick);
    }
    pipState.raf = pipWindow.requestAnimationFrame(tick);
  }

  function clearTransportPictureInPictureState(expectedWindow) {
    const pipState = getTransportPictureInPictureState();
    if (expectedWindow && pipState.window && expectedWindow !== pipState.window) return;
    stopTransportPictureInPictureRaf(pipState);
    if (audioState.transport && pipState.refs && audioState.transport.pipFavorite === pipState.refs.favoriteBtn) {
      audioState.transport.pipFavorite = null;
    }
    pipState.window = null;
    pipState.root = null;
    pipState.refs = null;
    pipState.openPromise = null;
    audioState.transportPipOpen = false;
    audioState.transportPipOpening = false;
    syncTransportUi();
  }

  function bindTransportPictureInPictureControls(refs) {
    if (!refs) return;
    const syncSoon = function () {
      refs.window.setTimeout(syncTransportPictureInPictureUi, 0);
    };
    if (refs.modeBtn) refs.modeBtn.addEventListener("click", function () {
      toggleRadioModeFromTransport();
      syncSoon();
    });
    if (refs.prevBtn) refs.prevBtn.addEventListener("click", function () {
      playPrevious({ seamless: true, fromTransportControl: true, surface: "pip" });
      syncSoon();
    });
    if (refs.toggleBtn) refs.toggleBtn.addEventListener("click", function () {
      handleGlobalTransportToggle();
      syncSoon();
    });
    if (refs.nextBtn) refs.nextBtn.addEventListener("click", function () {
      playNext({ seamless: true, fromTransportControl: true, surface: "pip" });
      syncSoon();
    });
    if (refs.shuffleBtn) refs.shuffleBtn.addEventListener("click", function () {
      toggleAlbumShuffleMode();
      syncSoon();
    });
    if (refs.favoriteBtn) refs.favoriteBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleCurrentFavorite("pip", refs.favoriteBtn, event);
      syncSoon();
    });
    if (refs.miniProgress) {
      let seeking = false;
      let pointerId = null;
      function seekFromClientX(clientX) {
        const bounds = refs.miniProgress.getBoundingClientRect();
        if (!bounds.width || refs.miniProgress.disabled) return;
        seekCurrentAudioToRatio(Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)));
        updateProgressUi();
        syncTransportPictureInPictureProgress();
      }
      refs.miniProgress.addEventListener("pointerdown", function (event) {
        if (refs.miniProgress.disabled) return;
        event.preventDefault();
        seeking = true;
        pointerId = event.pointerId;
        try { refs.miniProgress.setPointerCapture(event.pointerId); } catch (_err) {}
        seekFromClientX(event.clientX);
      });
      refs.miniProgress.addEventListener("pointermove", function (event) {
        if (!seeking || (pointerId !== null && event.pointerId !== pointerId)) return;
        event.preventDefault();
        seekFromClientX(event.clientX);
      });
      function finishSeeking(event) {
        if (!seeking || (event && pointerId !== null && event.pointerId !== pointerId)) return;
        seeking = false;
        pointerId = null;
        if (event) {
          event.preventDefault();
          seekFromClientX(event.clientX);
        }
      }
      refs.miniProgress.addEventListener("pointerup", finishSeeking);
      refs.miniProgress.addEventListener("pointercancel", function () {
        seeking = false;
        pointerId = null;
        syncTransportPictureInPictureProgress();
      });
    }
  }

  function initializeTransportPictureInPictureWindow(pipWindow) {
    const pipDocument = pipWindow.document;
    pipDocument.title = "INFRA. Player";
    if (pipDocument.head) {
      const viewport = pipDocument.createElement("meta");
      viewport.name = "viewport";
      viewport.content = "width=device-width, initial-scale=1";
      pipDocument.head.appendChild(viewport);
    }
    copyTransportPictureInPictureStyles(pipDocument);
    pipDocument.body.className = "transport-pip-document";
    pipDocument.body.innerHTML = getTransportPictureInPictureMarkup();
    syncTransportPictureInPictureTheme(pipDocument);

    const refs = getTransportPictureInPictureRefs(pipWindow);
    if (!refs) throw new Error("transport_pip_root_missing");
    const pipState = getTransportPictureInPictureState();
    pipState.window = pipWindow;
    pipState.root = refs.root;
    pipState.refs = refs;
    bindTransportPictureInPictureControls(refs);
    pipWindow.addEventListener("resize", syncTransportPictureInPictureUi, { passive: true });
    pipWindow.addEventListener("pagehide", function () {
      clearTransportPictureInPictureState(pipWindow);
    }, { once: true });
    audioState.transportPipOpen = true;
    audioState.transportPipOpening = false;
    syncTransportPictureInPictureUi();
    startTransportPictureInPictureRaf();
    syncTransportUi();
  }

  function requestTransportPictureInPicture(options) {
    const api = getDocumentPictureInPictureApi();
    if (!api || !isDesktopTransportViewport() || !hasPlaybackSession()) return Promise.resolve(false);
    const pipState = getTransportPictureInPictureState();
    if (pipState.window && pipState.window.closed !== true) {
      try { pipState.window.focus(); } catch (_err) {}
      return Promise.resolve(true);
    }
    if (pipState.openPromise) return pipState.openPromise;

    const transportRoot = audioState.transport && audioState.transport.root;
    const rect = transportRoot ? transportRoot.getBoundingClientRect() : null;
    const width = Math.round(Math.max(DOCUMENT_PIP_MIN_WIDTH, Math.min(DOCUMENT_PIP_MAX_WIDTH, Number(rect && rect.width) || 360)));
    const height = Math.round(Math.max(DOCUMENT_PIP_MIN_HEIGHT, Math.min(DOCUMENT_PIP_MAX_HEIGHT, Number(rect && rect.height) || 180)));
    audioState.transportPipOpening = true;
    let request;
    try {
      // This call deliberately stays in the pointerup/click stack: Document PiP
      // requires transient user activation.
      request = api.requestWindow({
        width,
        height,
        disallowReturnToOpener: true
      });
    } catch (_err) {
      audioState.transportPipOpening = false;
      return Promise.resolve(false);
    }
    pipState.openPromise = Promise.resolve(request)
      .then(function (pipWindow) {
        initializeTransportPictureInPictureWindow(pipWindow);
        return true;
      })
      .catch(function () {
        clearTransportPictureInPictureState();
        return false;
      })
      .finally(function () {
        pipState.openPromise = null;
      });
    return pipState.openPromise;
  }

  function closeTransportPictureInPicture() {
    const pipState = getTransportPictureInPictureState();
    const pipWindow = pipState.window;
    if (!pipWindow) {
      clearTransportPictureInPictureState();
      return;
    }
    try {
      if (pipWindow.closed !== true) pipWindow.close();
    } catch (_err) {
      // The native window may already be closing.
    }
    clearTransportPictureInPictureState(pipWindow);
  }

  function getTransportPictureInPictureDetachEdge(clientX, clientY) {
    if (!isDocumentPictureInPictureSupported() || !hasPlaybackSession()) return "";
    const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const distances = [
      { edge: "left", value: Math.max(0, Number(clientX) || 0) },
      { edge: "right", value: Math.max(0, width - (Number(clientX) || 0)) },
      { edge: "top", value: Math.max(0, Number(clientY) || 0) },
      { edge: "bottom", value: Math.max(0, height - (Number(clientY) || 0)) }
    ].sort(function (a, b) { return a.value - b.value; });
    return distances[0].value <= DOCUMENT_PIP_DETACH_EDGE_THRESHOLD ? distances[0].edge : "";
  }

  function ensureTransportPictureInPictureDetachHint() {
    let hint = document.getElementById("infraTransportPipDetachHint");
    if (hint) return hint;
    hint = document.createElement("div");
    hint.id = "infraTransportPipDetachHint";
    hint.className = "transport-pip-detach-hint";
    hint.hidden = true;
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = '<span class="transport-pip-detach-icon" aria-hidden="true">▣</span><span data-transport-pip-detach-label>Glisser au bord pour détacher</span>';
    getSpaPersistRoot().appendChild(hint);
    return hint;
  }

  function setTransportPictureInPictureDetachHint(visible, edge) {
    const hint = ensureTransportPictureInPictureDetachHint();
    const armed = Boolean(visible && edge);
    hint.hidden = !visible;
    hint.classList.toggle("is-armed", armed);
    hint.setAttribute("data-edge", edge || "");
    const label = hint.querySelector("[data-transport-pip-detach-label]");
    if (label) label.textContent = armed ? "Relâcher pour détacher" : "Glisser au bord pour détacher";
  }

  function ensureDesktopAudioVisualizer(transport) {
    if (!transport || transport.visualizer || !audioState.audio || !isDesktopTransportViewport()) {
      return transport ? transport.visualizer : null;
    }
    if (!audioVisualizerApi || typeof audioVisualizerApi.create !== "function") return null;
    transport.visualizer = audioVisualizerApi.create({
      audio: audioState.audio,
      root: transport.overlayVisual,
      canvas: transport.overlayVisualCanvas,
      reportHealth: function (payload) {
        trackAudioRuntimeEvent("visualizer_health", payload);
      }
    });
    return transport.visualizer;
  }

  function getDesktopTransportState() {
    if (!audioState.desktopTransportState) {
      audioState.desktopTransportState = {
        loaded: false,
        layout: null,
        gesture: null,
        suppressClick: false,
        playbackActive: false
      };
    }
    return audioState.desktopTransportState;
  }

  function clearSavedDesktopTransportLayout() {
    try {
      if (!window.localStorage) return;
      window.localStorage.removeItem(DESKTOP_TRANSPORT_STORAGE_KEY);
      window.localStorage.removeItem(DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY);
    } catch (_err) {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  function readDesktopTransportLayout() {
    clearSavedDesktopTransportLayout();
    return null;
  }

  function writeDesktopTransportLayout() {
    clearSavedDesktopTransportLayout();
    return false;
  }

  function setTransportCoverVisible(root, cover, visible) {
    const frame = root ? root.querySelector("[data-transport-cover-frame]") : null;
    if (frame) frame.hidden = !visible;
    if (cover) cover.hidden = !visible;
  }

  function ensureTransportCoverFrame(root) {
    if (!root) return;
    if (root.querySelector("[data-transport-cover-frame]")) return;
    const cover = root.querySelector("[data-transport-cover]");
    if (!cover || !cover.parentNode) return;
    const frame = document.createElement("div");
    frame.className = "global-transport-cover-frame";
    frame.setAttribute("data-transport-cover-frame", "");
    frame.hidden = true;
    cover.parentNode.insertBefore(frame, cover);
    frame.appendChild(cover);
  }

  function clampDesktopTransportLayout(layout) {
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const availableWidth = Math.max(1, viewportWidth - (DESKTOP_TRANSPORT_MARGIN * 2));
    const availableHeight = Math.max(1, viewportHeight - (DESKTOP_TRANSPORT_MARGIN * 2));
    const minWidth = Math.min(DESKTOP_TRANSPORT_MIN_WIDTH, availableWidth);
    const minHeight = Math.min(DESKTOP_TRANSPORT_MIN_HEIGHT, availableHeight);
    const width = Math.min(availableWidth, Math.max(minWidth, Number(layout && layout.width) || minWidth));
    const height = Math.min(availableHeight, Math.max(minHeight, Number(layout && layout.height) || minHeight));
    const maxX = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportWidth - DESKTOP_TRANSPORT_MARGIN - width);
    const maxY = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportHeight - DESKTOP_TRANSPORT_MARGIN - height);
    return {
      x: Math.min(maxX, Math.max(DESKTOP_TRANSPORT_MARGIN, Number(layout && layout.x) || DESKTOP_TRANSPORT_MARGIN)),
      y: Math.min(maxY, Math.max(DESKTOP_TRANSPORT_MARGIN, Number(layout && layout.y) || DESKTOP_TRANSPORT_MARGIN)),
      width,
      height
    };
  }

  function clampDesktopTransportPosition(position, width, height) {
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const maxX = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportWidth - DESKTOP_TRANSPORT_MARGIN - width);
    const maxY = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportHeight - DESKTOP_TRANSPORT_MARGIN - height);
    return {
      x: Math.min(maxX, Math.max(DESKTOP_TRANSPORT_MARGIN, Number(position && position.x) || DESKTOP_TRANSPORT_MARGIN)),
      y: Math.min(maxY, Math.max(DESKTOP_TRANSPORT_MARGIN, Number(position && position.y) || DESKTOP_TRANSPORT_MARGIN))
    };
  }

  function syncDesktopTransportCover(root) {
    if (!root) return;
    ensureTransportCoverFrame(root);
    const cover = root.querySelector("[data-transport-cover]");
    if (!cover) return;
    const rect = root.getBoundingClientRect();
    const largeEnough = Boolean(
      isDesktopTransportViewport() &&
      getDesktopTransportState().playbackActive &&
      root.classList.contains("has-custom-layout") &&
      rect.width >= DESKTOP_TRANSPORT_COVER_MIN_WIDTH &&
      rect.height >= DESKTOP_TRANSPORT_COVER_MIN_HEIGHT
    );
    const track = largeEnough ? getCurrentPlaylistTrack() : null;
    const expanded = Boolean(largeEnough && track);
    root.classList.toggle("is-expanded", expanded);
    if (!track) {
      setTransportCoverVisible(root, cover, false);
      return;
    }
    const artwork = resolveCoverUrl(track, { width: 1200 });
    setTransportCoverVisible(root, cover, true);
    cover.alt = `Pochette ${normalizeAlbumTitle(track.album || getCurrentAlbumTitle()) || "INFRA."}`;
    setCoverWhenReady(cover, artwork, getMediaSessionFallbackArtwork());
  }

  function applyDesktopTransportLayout(root, layout, persist) {
    if (!root || !layout) return;
    const state = getDesktopTransportState();
    const clamped = clampDesktopTransportLayout(layout);
    state.layout = clamped;
    root.classList.add("has-custom-layout");
    root.style.left = `${clamped.x}px`;
    root.style.top = `${clamped.y}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.style.width = `${clamped.width}px`;
    root.style.height = `${clamped.height}px`;
    syncDesktopTransportCover(root);
    if (persist) writeDesktopTransportLayout(clamped, true);
  }

  function applyDesktopTransportPosition(root, position, persist) {
    if (!root || !position) return;
    const state = getDesktopTransportState();
    root.style.removeProperty("width");
    root.style.removeProperty("height");
    root.classList.remove("has-custom-layout", "is-expanded");
    const rect = root.getBoundingClientRect();
    const clamped = clampDesktopTransportPosition(position, rect.width, rect.height);
    state.layout = Object.assign({}, state.layout || {}, clamped);
    root.style.left = `${clamped.x}px`;
    root.style.top = `${clamped.y}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    syncDesktopTransportCover(root);
    if (persist) writeDesktopTransportLayout(state.layout, false);
  }

  function clearDesktopTransportInlineStyles(root) {
    if (!root) return;
    ["left", "top", "right", "bottom", "width", "height"].forEach(function (property) {
      root.style.removeProperty(property);
    });
    setTransportInteractionActive(false);
    root.classList.remove("has-custom-layout", "has-playback-session", "is-expanded", "is-desktop-dragging", "is-desktop-resizing");
    const cover = root.querySelector("[data-transport-cover]");
    if (cover) setTransportCoverVisible(root, cover, false);
  }

  function setTransportInteractionActive(active) {
    if (typeof document === "undefined" || !document.body) return;
    document.body.classList.toggle("is-transport-interacting", Boolean(active));
  }

  function syncDesktopTransportLayout(root, playbackActive) {
    if (!root) return;
    if (!isDesktopTransportViewport()) {
      clearDesktopTransportInlineStyles(root);
      return;
    }
    const state = getDesktopTransportState();
    state.playbackActive = Boolean(playbackActive);
    root.classList.toggle("has-playback-session", state.playbackActive);
    if (!state.loaded) {
      state.loaded = true;
      state.layout = readDesktopTransportLayout();
    }
    const hasSavedActiveSize = Boolean(
      state.layout &&
      Number.isFinite(state.layout.width) &&
      Number.isFinite(state.layout.height)
    );
    if (state.playbackActive && hasSavedActiveSize) {
      applyDesktopTransportLayout(root, state.layout, false);
    } else if (state.layout) {
      applyDesktopTransportPosition(root, state.layout, false);
    } else {
      root.style.removeProperty("width");
      root.style.removeProperty("height");
      root.classList.remove("has-custom-layout", "is-expanded");
      syncDesktopTransportCover(root);
    }
  }

  function isDesktopTransportPointer(event) {
    return Boolean(
      event &&
      event.isPrimary !== false &&
      event.button === 0 &&
      (!event.pointerType || event.pointerType === "mouse")
    );
  }

  function bindDesktopTransportUi(root) {
    if (!root || root.dataset.desktopBound === "1") return;
    root.dataset.desktopBound = "1";
    const state = getDesktopTransportState();
    const interactiveSelector = "button, a, input, textarea, select, [role='button'], [contenteditable='true'], [data-transport-mini-progress], [data-transport-resize]";

    function suppressNextTransportClick() {
      state.suppressClick = true;
      window.setTimeout(function () { state.suppressClick = false; }, 120);
    }

    function finishRootGesture(event, cancelled, allowDetach) {
      const gesture = state.gesture;
      if (!gesture || gesture.kind !== "drag") return;
      if (event && event.pointerId !== gesture.pointerId) return;
      const shouldDetach = Boolean(
        gesture.moved &&
        gesture.detachArmed &&
        !cancelled &&
        allowDetach
      );
      state.gesture = null;
      root.classList.remove("is-desktop-dragging", "is-pip-detach-armed");
      setTransportPictureInPictureDetachHint(false, "");
      setTransportInteractionActive(false);
      if (shouldDetach) {
        suppressNextTransportClick();
        requestTransportPictureInPicture({ trigger: "drag", edge: gesture.detachEdge || "" });
      } else if (gesture.moved && !cancelled && state.layout) {
        suppressNextTransportClick();
        writeDesktopTransportLayout(state.layout, gesture.customSize);
      }
      try {
        if (root.hasPointerCapture(gesture.pointerId)) root.releasePointerCapture(gesture.pointerId);
      } catch (_err) {
        // Pointer capture may already be released by the browser.
      }
    }

    root.addEventListener("pointerdown", function (event) {
      if (!isDesktopTransportViewport() || !isDesktopTransportPointer(event) || root.hidden) return;
      const target = event.target;
      if (!target || !(target instanceof Element) || target.closest(interactiveSelector)) return;
      const rect = root.getBoundingClientRect();
      state.gesture = {
        kind: "drag",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        rect,
        moved: false,
        detachArmed: false,
        detachEdge: "",
        customSize: root.classList.contains("has-custom-layout")
      };
      setTransportInteractionActive(true);
    });

    function handleRootPointerMove(event) {
      const gesture = state.gesture;
      if (!gesture || gesture.kind !== "drag" || gesture.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(deltaX, deltaY) < DESKTOP_TRANSPORT_DRAG_THRESHOLD) return;
      if (!gesture.moved) {
        gesture.moved = true;
        root.classList.add("is-desktop-dragging");
        try { root.setPointerCapture(event.pointerId); } catch (_err) {}
      }
      gesture.detachEdge = getTransportPictureInPictureDetachEdge(event.clientX, event.clientY);
      gesture.detachArmed = Boolean(gesture.detachEdge);
      root.classList.toggle("is-pip-detach-armed", gesture.detachArmed);
      if (isDocumentPictureInPictureSupported() && hasPlaybackSession()) {
        setTransportPictureInPictureDetachHint(true, gesture.detachEdge);
      }
      const nextLayout = {
        x: gesture.rect.left + deltaX,
        y: gesture.rect.top + deltaY,
        width: gesture.rect.width,
        height: gesture.rect.height
      };
      if (gesture.customSize) applyDesktopTransportLayout(root, nextLayout, false);
      else applyDesktopTransportPosition(root, nextLayout, false);
      event.preventDefault();
    }
    window.addEventListener("pointermove", handleRootPointerMove, { passive: false });
    window.addEventListener("pointerup", function (event) { finishRootGesture(event, false, true); });
    window.addEventListener("pointercancel", function (event) { finishRootGesture(event, true, false); });
    root.addEventListener("lostpointercapture", function (event) { finishRootGesture(event, false, false); });
    document.addEventListener("click", function (event) {
      if (!state.suppressClick) return;
      state.suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    root.querySelectorAll("[data-transport-resize]").forEach(function (handle) {
      function finishResize(event, cancelled) {
        const gesture = state.gesture;
        if (!gesture || gesture.kind !== "resize" || gesture.handle !== handle) return;
        if (event && event.pointerId !== gesture.pointerId) return;
        state.gesture = null;
        root.classList.remove("is-desktop-resizing");
        setTransportInteractionActive(false);
        if (!cancelled && state.layout) {
          suppressNextTransportClick();
          writeDesktopTransportLayout(state.layout, true);
        }
        try {
          if (handle.hasPointerCapture(gesture.pointerId)) handle.releasePointerCapture(gesture.pointerId);
        } catch (_err) {
          // Pointer capture may already be released by the browser.
        }
      }

      handle.addEventListener("pointerdown", function (event) {
        if (!isDesktopTransportViewport() || !isDesktopTransportPointer(event) || root.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        state.gesture = {
          kind: "resize",
          handle,
          edge: String(handle.getAttribute("data-transport-resize") || ""),
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          rect: root.getBoundingClientRect()
        };
        root.classList.add("is-desktop-resizing");
        setTransportInteractionActive(true);
        try { handle.setPointerCapture(event.pointerId); } catch (_err) {}
      });
      function handleResizeMove(event) {
        const gesture = state.gesture;
        if (!gesture || gesture.kind !== "resize" || gesture.handle !== handle || gesture.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - gesture.startX;
        const deltaY = event.clientY - gesture.startY;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const edge = gesture.edge;
        let width = gesture.rect.width;
        let height = gesture.rect.height;
        let x = gesture.rect.left;
        let y = gesture.rect.top;
        if (edge.includes("w")) {
          width = Math.min(gesture.rect.right - DESKTOP_TRANSPORT_MARGIN, Math.max(DESKTOP_TRANSPORT_MIN_WIDTH, gesture.rect.width - deltaX));
          x = gesture.rect.right - width;
        } else if (edge.includes("e")) {
          width = Math.min(viewportWidth - DESKTOP_TRANSPORT_MARGIN - gesture.rect.left, Math.max(DESKTOP_TRANSPORT_MIN_WIDTH, gesture.rect.width + deltaX));
        }
        if (edge.includes("n")) {
          height = Math.min(gesture.rect.bottom - DESKTOP_TRANSPORT_MARGIN, Math.max(DESKTOP_TRANSPORT_MIN_HEIGHT, gesture.rect.height - deltaY));
          y = gesture.rect.bottom - height;
        } else if (edge.includes("s")) {
          height = Math.min(viewportHeight - DESKTOP_TRANSPORT_MARGIN - gesture.rect.top, Math.max(DESKTOP_TRANSPORT_MIN_HEIGHT, gesture.rect.height + deltaY));
        }
        applyDesktopTransportLayout(root, { x, y, width, height }, false);
        event.preventDefault();
      }
      window.addEventListener("pointermove", handleResizeMove, { passive: false });
      window.addEventListener("pointerup", function (event) { finishResize(event, false); });
      window.addEventListener("pointercancel", function (event) { finishResize(event, true); });
      handle.addEventListener("lostpointercapture", function (event) { finishResize(event, false); });
    });
  }

  function ensureGlobalTransportUi() {
    bindGlobalKeyboardShortcuts();
    const persistRoot = getSpaPersistRoot();
    let root = document.getElementById("infraGlobalTransport");
    if (!root) {
      root = document.createElement("div");
      root.id = "infraGlobalTransport";
      root.className = "global-transport";
      root.hidden = true;
      root.innerHTML = [
        "<div class=\"global-transport-cover-frame\" data-transport-cover-frame hidden>",
        "  <img class=\"global-transport-cover\" data-transport-cover alt=\"\" hidden decoding=\"async\">",
        "</div>",
        "<div class=\"global-transport-now\" data-transport-now hidden aria-live=\"polite\">",
        "  <div class=\"global-transport-now-line global-transport-now-meta\" data-transport-now-meta>",
        "    <span class=\"global-transport-now-title\" data-transport-now-title></span>",
        "    <a class=\"global-transport-now-album\" data-transport-now-album href=\"#\" aria-label=\"Ouvrir l'album en cours\"></a>",
        "  </div>",
        "  <button class=\"global-transport-favorite\" type=\"button\" data-transport-favorite hidden aria-label=\"Ajouter aux favoris\" aria-pressed=\"false\">" + HEART_ICON_OUTLINE + "</button>",
        "  <div class=\"global-transport-now-mini\" data-transport-mini hidden>",
        "    <span class=\"global-transport-mini-time\" data-transport-mini-current>0:00</span>",
        "    <button class=\"global-transport-mini-progress\" type=\"button\" data-transport-mini-progress aria-label=\"Avancer dans le morceau\">",
        "      <span class=\"global-transport-mini-fill\" data-transport-mini-fill></span>",
        "    </button>",
        "    <span class=\"global-transport-mini-time\" data-transport-mini-duration>0:00</span>",
        "  </div>",
        "</div>",
        "<div class=\"global-transport-controls\">",
        "  <button class=\"global-transport-btn global-transport-mode\" type=\"button\" data-transport-mode aria-label=\"Activer la radio aleatoire\">" + RADIO_ICON + "</button>",
        "  <div class=\"global-transport-main\">",
        "    <button class=\"global-transport-btn\" type=\"button\" data-transport-prev aria-label=\"Piste precedente\">",
        "      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6 6h3v12H6zM10 12l10-6v12z\"/></svg>",
        "    </button>",
        "    <button class=\"global-transport-btn\" type=\"button\" data-transport-toggle aria-label=\"Lecture\">",
        "      <svg class=\"transport-icon transport-icon-play\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M8 5v14l11-7z\"/></svg>",
        "      <svg class=\"transport-icon transport-icon-pause\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6 5h4v14H6zM14 5h4v14h-4z\"/></svg>",
        "    </button>",
        "    <button class=\"global-transport-btn\" type=\"button\" data-transport-next aria-label=\"Piste suivante\">",
        "      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M14 12L4 6v12zM18 6h3v12h-3z\"/></svg>",
        "    </button>",
        "  </div>",
        "  <button class=\"global-transport-btn\" type=\"button\" data-transport-shuffle aria-label=\"Shuffle\">",
        "    " + SHUFFLE_ICON,
        "  </button>",
        "</div>",
        "<span class=\"global-transport-resize global-transport-resize-nw\" data-transport-resize=\"nw\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-ne\" data-transport-resize=\"ne\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-sw\" data-transport-resize=\"sw\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-se\" data-transport-resize=\"se\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-n\" data-transport-resize=\"n\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-e\" data-transport-resize=\"e\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-s\" data-transport-resize=\"s\" aria-hidden=\"true\"></span>",
        "<span class=\"global-transport-resize global-transport-resize-w\" data-transport-resize=\"w\" aria-hidden=\"true\"></span>"
      ].join("");
    }
    ensureTransportCoverFrame(root);

    if (!root.querySelector("[data-transport-favorite]")) {
      const favoriteBtn = document.createElement("button");
      favoriteBtn.className = "global-transport-favorite";
      favoriteBtn.type = "button";
      favoriteBtn.hidden = true;
      favoriteBtn.setAttribute("data-transport-favorite", "");
      favoriteBtn.setAttribute("aria-label", "Ajouter aux favoris");
      favoriteBtn.setAttribute("aria-pressed", "false");
      favoriteBtn.innerHTML = HEART_ICON_OUTLINE;
      const mini = root.querySelector("[data-transport-mini]");
      const now = root.querySelector("[data-transport-now]");
      if (now && mini) {
        now.insertBefore(favoriteBtn, mini);
      }
    }

    persistRoot.appendChild(root);
    let overlay = document.getElementById("infraNowPlayingOverlay");
    const overlayNeedsRefresh =
      !overlay ||
      !overlay.querySelector("[data-now-playing-swipe-zone]") ||
      !overlay.querySelector("[data-now-playing-shuffle]") ||
      !overlay.querySelector("[data-now-playing-radio]") ||
      !overlay.querySelector("[data-now-playing-queue]") ||
      !overlay.querySelector("[data-now-playing-queue-toggle]") ||
      !overlay.querySelector("[data-now-playing-queue-sheet]") ||
      !overlay.querySelector("[data-now-playing-close]") ||
      !overlay.querySelector("[data-now-playing-favorite]") ||
      !overlay.querySelector("[data-now-playing-visual]") ||
      !root.querySelector("[data-transport-favorite]") ||
      !overlay.querySelector("[data-now-playing-volume-toggle]") ||
      !overlay.querySelector("[data-now-playing-volume]");
    if (overlayNeedsRefresh) {
      if (overlay) overlay.remove();
      overlay = document.createElement("div");
      overlay.id = "infraNowPlayingOverlay";
      overlay.className = "now-playing-overlay";
      overlay.hidden = true;
      overlay.innerHTML = [
        "<div class=\"now-playing-backdrop\" data-now-playing-backdrop aria-hidden=\"true\"></div>",
        "<div class=\"now-playing-panel\" data-now-playing-panel>",
        "  <button class=\"now-playing-close\" type=\"button\" data-now-playing-close aria-label=\"Fermer le lecteur\">",
        "    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 6l12 12M18 6L6 18\" /></svg>",
        "  </button>",
        "  <div class=\"now-playing-swipe-zone\" data-now-playing-swipe-zone>",
        "    <div class=\"now-playing-grab\" aria-hidden=\"true\"></div>",
        "  </div>",
        "  <div class=\"now-playing-cover-wrap\">",
        `    <img class="now-playing-cover" data-now-playing-cover src="${getMediaSessionFallbackArtwork()}" alt="Pochette" loading="eager" decoding="async" fetchpriority="high" />`,
        "  </div>",
        "  <div class=\"now-playing-meta\">",
        "    <div class=\"now-playing-meta-text\">",
        "      <div class=\"now-playing-title\" data-now-playing-title></div>",
        "      <a class=\"now-playing-album now-playing-album-link\" data-now-playing-album href=\"#\" aria-label=\"Ouvrir l'album en lecture\"></a>",
        "    </div>",
        "    <button class=\"now-playing-favorite\" type=\"button\" data-now-playing-favorite aria-label=\"Ajouter aux favoris\" aria-pressed=\"false\">",
        "      " + HEART_ICON_OUTLINE,
        "    </button>",
        "  </div>",
        "  <div class=\"now-playing-visual\" data-now-playing-visual aria-hidden=\"true\">",
        "    <canvas class=\"now-playing-visual-canvas\" data-now-playing-visual-canvas></canvas>",
        "  </div>",
        "  <div class=\"now-playing-progress-wrap\">",
        "    <button class=\"now-playing-progress\" type=\"button\" data-now-playing-progress aria-label=\"Avancer dans le morceau\">",
        "      <span class=\"now-playing-progress-fill\" data-now-playing-fill></span>",
        "    </button>",
        "    <div class=\"now-playing-times\">",
        "      <span class=\"now-playing-time\" data-now-playing-current>0:00</span>",
        "      <span class=\"now-playing-time\" data-now-playing-duration>-0:00</span>",
        "    </div>",
        "  </div>",
        "  <div class=\"now-playing-controls\">",
        "    <div class=\"now-playing-main-controls\">",
        "      <button class=\"now-playing-btn now-playing-btn-aux now-playing-mode-btn\" type=\"button\" data-now-playing-shuffle aria-label=\"Activer le shuffle\">",
        "        " + SHUFFLE_ICON.replace("class=\"shuffle-icon\"", "class=\"shuffle-icon now-playing-shuffle-icon\""),
        "      </button>",
        "      <button class=\"now-playing-btn now-playing-action-btn\" type=\"button\" data-now-playing-prev aria-label=\"Piste precedente\">",
        "        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6 6h3v12H6zM10 12l10-6v12z\"/></svg>",
        "      </button>",
        "      <button class=\"now-playing-btn now-playing-btn-main\" type=\"button\" data-now-playing-toggle aria-label=\"Lecture\">",
        "        <svg class=\"now-playing-icon now-playing-icon-play\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M8 5v14l11-7z\"/></svg>",
        "        <svg class=\"now-playing-icon now-playing-icon-pause\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M6 5h4v14H6zM14 5h4v14h-4z\"/></svg>",
        "      </button>",
        "      <button class=\"now-playing-btn now-playing-action-btn\" type=\"button\" data-now-playing-next aria-label=\"Piste suivante\">",
        "        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M14 12L4 6v12zM18 6h3v12h-3z\"/></svg>",
        "      </button>",
        "      <button class=\"now-playing-btn now-playing-btn-aux now-playing-mode-btn\" type=\"button\" data-now-playing-radio aria-label=\"Activer la radio aleatoire\">",
        "        " + RADIO_ICON.replace("class=\"radio-icon\"", "class=\"radio-icon now-playing-radio-icon\""),
        "      </button>",
        "    </div>",
        "  </div>",
        "  <section class=\"now-playing-up-next\" data-now-playing-queue aria-label=\"Titres suivants\">",
        "    <button class=\"now-playing-up-next-toggle\" type=\"button\" data-now-playing-queue-toggle aria-expanded=\"false\">",
        "      <span>À suivre</span>",
        "      <span class=\"now-playing-up-next-count\" data-now-playing-queue-count hidden></span>",
        "    </button>",
        "  </section>",
        "  <button class=\"now-playing-volume-toggle now-playing-btn now-playing-btn-aux\" type=\"button\" data-now-playing-volume-toggle aria-label=\"Afficher le volume\">",
        "    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M4 9v6h4l5 4V5L8 9H4zm11.5 1.1v3.8l2-1.9-2-1.9zM17 7.5l-1.4 1.4L18.7 12l-3.1 3.1L17 16.5l4.5-4.5L17 7.5z\"/></svg>",
        "  </button>",
        "  <div class=\"now-playing-volume\" data-now-playing-volume-wrap>",
        "    <span class=\"now-playing-volume-label\">Volume</span>",
        "    <input class=\"now-playing-volume-range\" data-now-playing-volume type=\"range\" min=\"0\" max=\"1\" step=\"0.01\" value=\"1\" aria-label=\"Volume\">",
        "  </div>",
        "</div>",
        "<div class=\"now-playing-queue-sheet\" data-now-playing-queue-sheet hidden aria-hidden=\"true\">",
        "  <div class=\"now-playing-queue-dim\" data-now-playing-queue-close aria-hidden=\"true\"></div>",
        "  <div class=\"now-playing-queue-panel\" data-now-playing-queue-panel role=\"dialog\" aria-label=\"À suivre\">",
        "    <button class=\"now-playing-queue-handle\" type=\"button\" data-now-playing-queue-close aria-label=\"Fermer À suivre\"><span aria-hidden=\"true\"></span></button>",
        "    <div class=\"now-playing-queue-header\">",
        "      <div>",
        "        <div class=\"now-playing-up-next-heading\">À suivre</div>",
        "        <div class=\"now-playing-queue-subtitle\">File de lecture</div>",
        "      </div>",
        "      <button class=\"now-playing-queue-close\" type=\"button\" data-now-playing-queue-close aria-label=\"Fermer À suivre\">Fermer</button>",
        "    </div>",
        "    <div class=\"now-playing-up-next-list\" data-now-playing-queue-list></div>",
        "  </div>",
        "</div>"
      ].join("");
    }
    persistRoot.appendChild(overlay);

    const alreadyBound = root.dataset.bound === "1" && !overlayNeedsRefresh;
    const rootControlsAlreadyBound = root.dataset.controlsBound === "1";
    const modeBtn = root.querySelector("[data-transport-mode]");
    const prevBtn = root.querySelector("[data-transport-prev]");
    const toggleBtn = root.querySelector("[data-transport-toggle]");
    const nextBtn = root.querySelector("[data-transport-next]");
    const shuffleBtn = root.querySelector("[data-transport-shuffle]");
    const nowWrap = root.querySelector("[data-transport-now]");
    const nowTitle = root.querySelector("[data-transport-now-title]");
    const nowAlbum = root.querySelector("[data-transport-now-album]");
    const favoriteBtn = root.querySelector("[data-transport-favorite]");
    const nowMini = root.querySelector("[data-transport-mini]");
    const miniCurrent = root.querySelector("[data-transport-mini-current]");
    const miniDuration = root.querySelector("[data-transport-mini-duration]");
    const miniProgress = root.querySelector("[data-transport-mini-progress]");
    const miniFill = root.querySelector("[data-transport-mini-fill]");
    const transportCover = root.querySelector("[data-transport-cover]");
    const overlayPanel = overlay.querySelector("[data-now-playing-panel]");
    const overlayBackdrop = overlay.querySelector("[data-now-playing-backdrop]");
    const overlayCover = overlay.querySelector("[data-now-playing-cover]");
    const overlayTitle = overlay.querySelector("[data-now-playing-title]");
    const overlayAlbum = overlay.querySelector("[data-now-playing-album]");
    const overlayFavorite = overlay.querySelector("[data-now-playing-favorite]");
    const overlayVisual = overlay.querySelector("[data-now-playing-visual]");
    const overlayVisualCanvas = overlay.querySelector("[data-now-playing-visual-canvas]");
    const overlayCurrent = overlay.querySelector("[data-now-playing-current]");
    const overlayDuration = overlay.querySelector("[data-now-playing-duration]");
    const overlayProgress = overlay.querySelector("[data-now-playing-progress]");
    const overlayFill = overlay.querySelector("[data-now-playing-fill]");
    const overlayShuffle = overlay.querySelector("[data-now-playing-shuffle]");
    const overlayPrev = overlay.querySelector("[data-now-playing-prev]");
    const overlayToggle = overlay.querySelector("[data-now-playing-toggle]");
    const overlayNext = overlay.querySelector("[data-now-playing-next]");
    const overlayRadio = overlay.querySelector("[data-now-playing-radio]");
    const overlayClose = overlay.querySelector("[data-now-playing-close]");
    const overlayQueue = overlay.querySelector("[data-now-playing-queue]");
    const overlayQueueToggle = overlay.querySelector("[data-now-playing-queue-toggle]");
    const overlayQueueCount = overlay.querySelector("[data-now-playing-queue-count]");
    const overlayQueueSheet = overlay.querySelector("[data-now-playing-queue-sheet]");
    const overlayQueuePanel = overlay.querySelector("[data-now-playing-queue-panel]");
    const overlayQueueCloseButtons = overlay.querySelectorAll("[data-now-playing-queue-close]");
    const overlayQueueList = overlay.querySelector("[data-now-playing-queue-list]");
    const overlayVolumeToggle = overlay.querySelector("[data-now-playing-volume-toggle]");
    const overlayVolumeWrap = overlay.querySelector("[data-now-playing-volume-wrap]");
    const overlayVolume = overlay.querySelector("[data-now-playing-volume]");

    bindDesktopTransportUi(root);

    if (!alreadyBound) {
      if (!rootControlsAlreadyBound) {
        if (modeBtn) {
          modeBtn.addEventListener("click", function () {
            toggleRadioModeFromTransport();
          });
        }
        if (prevBtn) {
          prevBtn.addEventListener("click", function () {
            playPrevious({ seamless: true, fromTransportControl: true, surface: "mini" });
          });
        }
        if (nextBtn) {
          nextBtn.addEventListener("click", function () {
            playNext({ seamless: true, fromTransportControl: true, surface: "mini" });
          });
        }
        if (toggleBtn) toggleBtn.addEventListener("click", handleGlobalTransportToggle);
        if (shuffleBtn) {
          shuffleBtn.addEventListener("click", function () {
            toggleAlbumShuffleMode();
          });
        }
        if (favoriteBtn) {
          favoriteBtn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            toggleCurrentFavorite("mini", favoriteBtn, event);
          });
        }
        if (nowWrap) {
          nowWrap.addEventListener("click", function (event) {
            const target = event.target;
            if (target && target instanceof Element) {
              if (
                target.closest("[data-transport-now-album]") ||
                target.closest("[data-transport-mini-progress]") ||
                target.closest("[data-transport-favorite]")
              ) return;
            }
            const visualizer = ensureDesktopAudioVisualizer(audioState.transport);
            if (visualizer && typeof visualizer.activate === "function") {
              visualizer.activate();
            }
            openNowPlayingOverlay();
          });
        }
        if (nowAlbum) {
          nowAlbum.addEventListener("click", function (event) {
            const href = String(nowAlbum.getAttribute("href") || "").trim();
            if (!href || href === "#") {
              event.preventDefault();
              return;
            }
            event.stopPropagation();
          });
        }
      }
      if (overlayAlbum) {
        overlayAlbum.addEventListener("click", function (event) {
          if (!overlayAlbum.classList.contains("is-link")) {
            event.preventDefault();
            return;
          }
          closeNowPlayingOverlay();
        });
      }
      if (overlayFavorite) {
        overlayFavorite.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          toggleCurrentFavorite("overlay", overlayFavorite, event);
        });
      }
      if (overlay) {
        overlay.addEventListener("click", function () {
          closeNowPlayingOverlay();
        });
      }
      if (overlayBackdrop) {
        overlayBackdrop.addEventListener("click", function () {
          closeNowPlayingOverlay();
        });
      }
      if (overlayPanel) {
        overlayPanel.addEventListener("click", function (event) {
          event.stopPropagation();
        });
      }
      if (overlayClose) {
        overlayClose.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          closeNowPlayingOverlay();
        });
      }

      if (overlay && overlayPanel) {
        let swipeActive = false;
        let swipePointerId = null;
        let swipeStartY = 0;
        let swipeStartX = 0;
        let swipeLastY = 0;
        let swipeLastTs = 0;
        let swipeVelocity = 0;
        let swipeAxis = "";
        let swipeStartTs = 0;
        let swipeInput = "";
        const SWIPE_CLOSE_RATIO = 0.14;
        const SWIPE_CLOSE_MIN_DELTA = 42;
        const SWIPE_CLOSE_VELOCITY = 0.28;

        function isDesktopOverlayLayout() {
          return typeof window.matchMedia !== "function" ||
            window.matchMedia("(min-width: 641px)").matches;
        }

        function resetSwipeVisual() {
          overlayPanel.style.transform = "";
          overlayPanel.style.opacity = "";
          overlayPanel.style.transition = "";
          overlayPanel.style.willChange = "";
        }

        function isInteractiveTarget(target) {
          if (!target || !(target instanceof Element)) return false;
          return Boolean(target.closest("button, a, input, textarea, select, [role='button'], [data-now-playing-progress], [data-now-playing-volume], [data-now-playing-queue], [data-now-playing-queue-sheet]"));
        }

        function shouldStartSwipe(target) {
          if (!audioState.nowPlayingOpen) return false;
          if (audioState.nowPlayingClosing) return false;
          if (!target || !(target instanceof Element)) return false;
          if (target.closest("[data-now-playing-queue], [data-now-playing-queue-sheet]")) return false;
          if (isDesktopOverlayLayout()) {
            if (isInteractiveTarget(target)) return false;
            return Boolean(target.closest("[data-now-playing-panel]") || target.closest(".now-playing-overlay"));
          }
          if (target.closest("[data-now-playing-swipe-zone]")) return true;
          if (target.closest(".now-playing-cover-wrap")) return true;
          if (target.closest(".now-playing-title, .now-playing-album")) return true;
          if (isInteractiveTarget(target)) return false;
          if (overlayPanel.scrollTop > 2) return false;
          return Boolean(target.closest("[data-now-playing-panel]") || target.closest(".now-playing-overlay"));
        }

        function beginSwipe(target, clientX, clientY, pointerId, inputType) {
          if (swipeActive) return;
          if (!shouldStartSwipe(target)) return false;
          swipePointerId = pointerId;
          swipeInput = inputType || "pointer";
          swipeStartX = clientX;
          swipeStartY = clientY;
          swipeLastY = swipeStartY;
          swipeLastTs = Date.now();
          swipeVelocity = 0;
          swipeAxis = "";
          swipeStartTs = swipeLastTs;
          swipeActive = true;
          overlayPanel.style.transition = "none";
          overlayPanel.style.willChange = "transform, opacity";
          return true;
        }

        function moveSwipe(clientX, clientY) {
          const now = Date.now();
          const deltaX = clientX - swipeStartX;
          const previousY = swipeLastY;
          swipeLastY = clientY;
          const delta = swipeLastY - swipeStartY;
          const elapsedMove = Math.max(1, now - swipeLastTs);
          swipeVelocity = (swipeLastY - previousY) / elapsedMove;
          swipeLastTs = now;
          if (!swipeAxis && (Math.abs(deltaX) > 10 || Math.abs(delta) > 10)) {
            swipeAxis = Math.abs(delta) > Math.abs(deltaX) ? "y" : "x";
          }
          if (swipeAxis === "x") {
            swipeActive = false;
            swipePointerId = null;
            swipeInput = "";
            resetSwipeVisual();
            return false;
          }
          if (delta <= 0) {
            resetSwipeVisual();
            return false;
          }
          const panelHeight = Math.max(1, overlayPanel.getBoundingClientRect().height);
          const clamped = Math.min(delta, panelHeight * 0.72);
          const progress = Math.max(0, Math.min(1, clamped / panelHeight));
          const scale = 1 - (progress * 0.035);
          overlayPanel.style.transform = `translateY(${clamped}px) scale(${scale})`;
          overlayPanel.style.opacity = String(Math.max(0.48, 1 - (progress * 1.15)));
          return true;
        }

        function cancelSwipe() {
          swipeActive = false;
          swipePointerId = null;
          swipeStartTs = 0;
          swipeAxis = "";
          swipeInput = "";
          resetSwipeVisual();
        }

        overlay.addEventListener("pointerdown", function (event) {
          if (!beginSwipe(event.target, event.clientX, event.clientY, event.pointerId, "pointer")) return;
          event.preventDefault();
          if (typeof overlay.setPointerCapture === "function") {
            try {
              overlay.setPointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore capture errors.
            }
          }
        });

        overlay.addEventListener("pointermove", function (event) {
          if (swipeInput !== "pointer") return;
          if (!swipeActive || event.pointerId !== swipePointerId) return;
          if (moveSwipe(event.clientX, event.clientY)) event.preventDefault();
        });

        function endSwipe(event) {
          if (!swipeActive || (event && swipeInput === "pointer" && event.pointerId !== swipePointerId)) return;
          const elapsed = Math.max(1, Date.now() - swipeStartTs);
          const delta = swipeLastY - swipeStartY;
          const averageVelocity = delta / elapsed;
          const panelHeight = Math.max(1, overlayPanel.getBoundingClientRect().height);
          const shouldClose = delta > panelHeight * SWIPE_CLOSE_RATIO ||
            (delta > SWIPE_CLOSE_MIN_DELTA && (
              swipeVelocity > SWIPE_CLOSE_VELOCITY ||
              averageVelocity > SWIPE_CLOSE_VELOCITY
            ));
          swipeActive = false;
          swipePointerId = null;
          swipeStartTs = 0;
          swipeAxis = "";
          const inputType = swipeInput;
          swipeInput = "";
          if (event && inputType === "pointer" && typeof overlay.releasePointerCapture === "function") {
            try {
              overlay.releasePointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore release errors.
            }
          }

          if (shouldClose) {
            audioState.nowPlayingClosing = true;
            overlayPanel.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out";
            overlayPanel.style.transform = "translateY(110%) scale(0.97)";
            overlayPanel.style.opacity = "0";
            setTimeout(function () {
              disableNowPlayingOverlayUi();
            }, 220);
            return;
          }

          overlayPanel.style.transition = "transform 260ms cubic-bezier(0.2, 0.85, 0.18, 1), opacity 220ms ease-out";
          overlayPanel.style.transform = "translateY(0)";
          overlayPanel.style.opacity = "1";
          setTimeout(function () {
            resetSwipeVisual();
          }, 270);
        }

        overlay.addEventListener("pointerup", function (event) {
          if (swipeInput !== "pointer") return;
          endSwipe(event);
        });
        overlay.addEventListener("pointercancel", function (event) {
          if (swipeInput !== "pointer") return;
          if (event && swipePointerId !== null && event.pointerId !== swipePointerId) return;
          cancelSwipe();
        });

        overlay.addEventListener("touchstart", function (event) {
          if (!event.changedTouches || !event.changedTouches.length) return;
          const touch = event.changedTouches[0];
          if (!beginSwipe(event.target, touch.clientX, touch.clientY, null, "touch")) return;
          event.preventDefault();
        }, { passive: false });

        overlay.addEventListener("touchmove", function (event) {
          if (swipeInput !== "touch" || !swipeActive) return;
          if (!event.changedTouches || !event.changedTouches.length) return;
          const touch = event.changedTouches[0];
          if (moveSwipe(touch.clientX, touch.clientY)) event.preventDefault();
        }, { passive: false });

        overlay.addEventListener("touchend", function (event) {
          if (swipeInput !== "touch") return;
          if (event && typeof event.preventDefault === "function") event.preventDefault();
          endSwipe(null);
        }, { passive: false });

        overlay.addEventListener("touchcancel", function () {
          if (swipeInput !== "touch") return;
          cancelSwipe();
        }, { passive: false });
      }
      if (overlayShuffle) {
        overlayShuffle.addEventListener("click", function () {
          toggleAlbumShuffleMode();
        });
      }
      if (overlayPrev) {
        overlayPrev.addEventListener("click", function () {
          playPrevious({ seamless: true, fromTransportControl: true, surface: "fullscreen" });
        });
      }
      if (overlayNext) {
        overlayNext.addEventListener("click", function () {
          playNext({ seamless: true, fromTransportControl: true, surface: "fullscreen" });
        });
      }
      if (overlayToggle) overlayToggle.addEventListener("click", togglePlayPause);
      if (overlayRadio) overlayRadio.addEventListener("click", toggleRadioModeFromTransport);
      if (overlayQueueToggle) {
        overlayQueueToggle.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          setNowPlayingQueueOpen(!audioState.nowPlayingQueueOpen);
        });
      }
      if (overlayQueueCloseButtons && overlayQueueCloseButtons.length) {
        overlayQueueCloseButtons.forEach(function (button) {
          button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            setNowPlayingQueueOpen(false);
          });
        });
      }
      if (overlayQueuePanel) {
        let queueSwipeActive = false;
        let queueSwipePointerId = null;
        let queueSwipeStartY = 0;
        let queueSwipeStartX = 0;
        let queueSwipeLastY = 0;
        let queueSwipeAxis = "";

        function resetQueueSwipeVisual() {
          overlayQueuePanel.style.transform = "";
          overlayQueuePanel.style.opacity = "";
          overlayQueuePanel.style.transition = "";
          overlayQueuePanel.style.willChange = "";
        }

        overlayQueuePanel.addEventListener("pointerdown", function (event) {
          const target = event.target;
          if (!audioState.nowPlayingQueueOpen || queueSwipeActive) return;
          if (!target || !(target instanceof Element)) return;
          if (target.closest(".now-playing-queue-close")) return;
          if (!target.closest(".now-playing-queue-handle") && !target.closest(".now-playing-queue-header")) return;
          queueSwipeActive = true;
          queueSwipePointerId = event.pointerId;
          queueSwipeStartX = event.clientX;
          queueSwipeStartY = event.clientY;
          queueSwipeLastY = event.clientY;
          queueSwipeAxis = "";
          overlayQueuePanel.style.transition = "none";
          overlayQueuePanel.style.willChange = "transform, opacity";
          if (typeof overlayQueuePanel.setPointerCapture === "function") {
            try {
              overlayQueuePanel.setPointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore capture errors.
            }
          }
        });
        overlayQueuePanel.addEventListener("pointermove", function (event) {
          if (!queueSwipeActive || event.pointerId !== queueSwipePointerId) return;
          const deltaX = event.clientX - queueSwipeStartX;
          const deltaY = event.clientY - queueSwipeStartY;
          queueSwipeLastY = event.clientY;
          if (!queueSwipeAxis && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            queueSwipeAxis = Math.abs(deltaY) > Math.abs(deltaX) ? "y" : "x";
          }
          if (queueSwipeAxis === "x") {
            queueSwipeActive = false;
            queueSwipePointerId = null;
            resetQueueSwipeVisual();
            return;
          }
          if (deltaY <= 0) {
            resetQueueSwipeVisual();
            return;
          }
          const clamped = Math.min(deltaY, overlayQueuePanel.getBoundingClientRect().height * 0.72);
          const progress = Math.max(0, Math.min(1, clamped / Math.max(1, overlayQueuePanel.getBoundingClientRect().height)));
          overlayQueuePanel.style.transform = `translateY(${clamped}px)`;
          overlayQueuePanel.style.opacity = String(Math.max(0.45, 1 - progress));
          event.preventDefault();
        });
        function endQueueSwipe(event) {
          if (!queueSwipeActive || (event && event.pointerId !== queueSwipePointerId)) return;
          const deltaY = queueSwipeLastY - queueSwipeStartY;
          const shouldClose = deltaY > Math.max(64, overlayQueuePanel.getBoundingClientRect().height * 0.18);
          queueSwipeActive = false;
          queueSwipePointerId = null;
          queueSwipeAxis = "";
          if (event && typeof overlayQueuePanel.releasePointerCapture === "function") {
            try {
              overlayQueuePanel.releasePointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore release errors.
            }
          }
          if (shouldClose) {
            overlayQueuePanel.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out";
            overlayQueuePanel.style.transform = "translateY(110%)";
            overlayQueuePanel.style.opacity = "0";
            setTimeout(function () {
              resetQueueSwipeVisual();
              setNowPlayingQueueOpen(false);
            }, 210);
            return;
          }
          overlayQueuePanel.style.transition = "transform 240ms cubic-bezier(0.2, 0.85, 0.18, 1), opacity 180ms ease-out";
          overlayQueuePanel.style.transform = "translateY(0)";
          overlayQueuePanel.style.opacity = "1";
          setTimeout(resetQueueSwipeVisual, 250);
        }
        overlayQueuePanel.addEventListener("pointerup", endQueueSwipe);
        overlayQueuePanel.addEventListener("pointercancel", function (event) {
          if (event && queueSwipePointerId !== null && event.pointerId !== queueSwipePointerId) return;
          queueSwipeActive = false;
          queueSwipePointerId = null;
          resetQueueSwipeVisual();
        });
      }
      if (overlayQueueList) {
        const QUEUE_PRESS_HOLD_MS = 420;
        const QUEUE_PRESS_MOVE_TOLERANCE_PX = 12;
        const QUEUE_AUTO_SCROLL_EDGE_PX = 58;
        const QUEUE_AUTO_SCROLL_MAX_PX = 18;
        let queueDragIndex = null;
        let queueMouseTelemetry = null;
        let queueDragSuppressClickUntil = 0;
        let queuePressGesture = null;
        let queueAutoScrollFrame = 0;

        function queueTelemetryToken(input) {
          return `queue-${String(input || "input")}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        }

        function queueReducedMotion() {
          return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }

        const QUEUE_FLIP_DURATION_MS = 170;
        const QUEUE_FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

        function getQueueRows() {
          return Array.from(overlayQueueList.querySelectorAll("[data-now-playing-queue-index]"));
        }

        function getQueueRowKey(row) {
          return String(row && row.getAttribute("data-now-playing-queue-key") || "");
        }

        function captureQueueRowRects() {
          const rects = new Map();
          getQueueRows().forEach(function (row) {
            const key = getQueueRowKey(row);
            if (key) rects.set(key, row.getBoundingClientRect());
          });
          return rects;
        }

        function stopQueuePreviewAnimations(gesture) {
          if (!gesture) return;
          gesture.flipGeneration = Number(gesture.flipGeneration || 0) + 1;
          const animations = gesture.previewAnimations instanceof Map
            ? gesture.previewAnimations
            : new Map();
          animations.forEach(function (animation) {
            try { animation.cancel(); } catch (_err) {}
          });
          gesture.previewAnimations = new Map();
          getQueueRows().forEach(function (row) {
            row.style.removeProperty("transform");
            row.style.removeProperty("will-change");
          });
        }

        function animateQueuePreview(gesture, drop) {
          if (!gesture || !gesture.activated || !drop || !drop.item) return;
          if (queueReducedMotion()) {
            stopQueuePreviewAnimations(gesture);
            gesture.shiftedRowCount = 0;
            return;
          }
          const rows = getQueueRows();
          const sourcePosition = rows.findIndex(function (row) {
            return Number(row.getAttribute("data-now-playing-queue-index")) === gesture.index;
          });
          const targetPosition = rows.indexOf(drop.item);
          if (sourcePosition < 0 || targetPosition < 0) return;
          let finalPosition = targetPosition + (drop.after ? 1 : 0);
          if (finalPosition > sourcePosition) finalPosition -= 1;
          finalPosition = Math.max(0, Math.min(rows.length - 1, finalPosition));

          const sourceRect = rows[sourcePosition].getBoundingClientRect();
          const shiftDistance = Math.max(1, sourceRect.height);
          const desired = new Map();
          if (finalPosition > sourcePosition) {
            for (let position = sourcePosition + 1; position <= finalPosition; position += 1) {
              if (!rows[position].classList.contains("is-current")) desired.set(rows[position], -shiftDistance);
            }
          } else if (finalPosition < sourcePosition) {
            for (let position = finalPosition; position < sourcePosition; position += 1) {
              if (!rows[position].classList.contains("is-current")) desired.set(rows[position], shiftDistance);
            }
          }

          const previousAnimations = gesture.previewAnimations instanceof Map
            ? gesture.previewAnimations
            : new Map();
          const nextAnimations = new Map();
          const animationPromises = [];
          rows.forEach(function (row) {
            if (row === rows[sourcePosition]) return;
            const fromTransform = window.getComputedStyle(row).transform;
            const previous = previousAnimations.get(row);
            if (previous) {
              try { previous.cancel(); } catch (_err) {}
            }
            const shift = desired.get(row) || 0;
            const toTransform = shift ? `translateY(${Math.round(shift)}px)` : "none";
            row.style.transform = toTransform;
            if (fromTransform === toTransform || typeof row.animate !== "function") return;
            row.style.willChange = "transform";
            const animation = row.animate(
              [{ transform: fromTransform }, { transform: toTransform }],
              { duration: QUEUE_FLIP_DURATION_MS, easing: QUEUE_FLIP_EASING, fill: "both" }
            );
            nextAnimations.set(row, animation);
            animationPromises.push(Promise.resolve(animation.finished).catch(function () {}));
          });
          gesture.previewAnimations = nextAnimations;
          gesture.shiftedRowCount = desired.size;
          if (!animationPromises.length) return;
          gesture.flipGeneration = Number(gesture.flipGeneration || 0) + 1;
          const generation = gesture.flipGeneration;
          gesture.flipStarted = true;
          gesture.flipFinished = false;
          gesture.flipAnimationCount = Number(gesture.flipAnimationCount || 0) + animationPromises.length;
          emitQueueReorder(gesture, { result: "preview", handler_state: "active" });
          Promise.all(animationPromises).then(function () {
            if (gesture.finished || gesture.flipGeneration !== generation) return;
            gesture.flipFinished = true;
            emitQueueReorder(gesture, { result: "preview", handler_state: "active" });
          });
        }

        function animateQueueFinalFlip(gesture, beforeRects) {
          if (!gesture || !(beforeRects instanceof Map) || queueReducedMotion()) return;
          window.requestAnimationFrame(function () {
            const animations = [];
            getQueueRows().forEach(function (row) {
              if (row.classList.contains("is-current") || typeof row.animate !== "function") return;
              const before = beforeRects.get(getQueueRowKey(row));
              if (!before) return;
              const after = row.getBoundingClientRect();
              const deltaX = before.left - after.left;
              const deltaY = before.top - after.top;
              if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;
              const animation = row.animate(
                [
                  { transform: `translate(${Math.round(deltaX)}px, ${Math.round(deltaY)}px)` },
                  { transform: "none" }
                ],
                { duration: QUEUE_FLIP_DURATION_MS, easing: QUEUE_FLIP_EASING }
              );
              animations.push(Promise.resolve(animation.finished).catch(function () {}));
            });
            if (!animations.length) return;
            gesture.flipStarted = true;
            gesture.flipFinished = false;
            gesture.flipAnimationCount = Number(gesture.flipAnimationCount || 0) + animations.length;
            emitQueueReorder(gesture, { result: "committed", handler_state: "final_flip" });
            Promise.all(animations).then(function () {
              gesture.flipFinished = true;
              emitQueueReorder(gesture, { result: "committed", handler_state: "finished" });
            });
          });
        }

        function emitQueueReorder(gesture, details) {
          if (!gesture || !gesture.telemetryToken) return;
          const detailRecord = details || {};
          if (!gesture.telemetryStarted && detailRecord.result !== "activated") return;
          gesture.telemetryStarted = true;
          const targetIndex = Number.isInteger(gesture.targetIndex) ? gesture.targetIndex : gesture.index;
          trackAudioRuntimeEvent("queue_reorder", Object.assign({
            track: "queue",
            album: "session",
            queue_token: gesture.telemetryToken,
            input_type: gesture.input === "pointer" ? "pen" : String(gesture.input || "touch"),
            source_index: gesture.index,
            target_index: targetIndex,
            gesture_duration_ms: Math.max(0, Date.now() - Number(gesture.startedAt || Date.now())),
            ghost_created: Boolean(gesture.ghost),
            lift_animated: Boolean(gesture.activated && !queueReducedMotion()),
            lift_finished: Boolean(gesture.liftFinished),
            shifted_row_count: Math.max(0, Number(gesture.shiftedRowCount) || 0),
            flip_started: Boolean(gesture.flipStarted),
            flip_finished: Boolean(gesture.flipFinished),
            flip_animation_count: Math.max(0, Number(gesture.flipAnimationCount) || 0),
            reduced_motion: queueReducedMotion()
          }, detailRecord));
        }

        function clearQueueDropIndicators() {
          overlayQueueList.querySelectorAll(".is-drop-before, .is-drop-after").forEach(function (node) {
            node.classList.remove("is-drop-before", "is-drop-after");
          });
        }

        function clearQueueDragState(options) {
          if (options && options.suppressClick) {
            queueDragSuppressClickUntil = Date.now() + 350;
          }
          queueDragIndex = null;
          overlayQueueList.classList.remove("is-pointer-reordering");
          overlayQueueList.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach(function (node) {
            node.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
            node.removeAttribute("aria-grabbed");
            node.style.removeProperty("transform");
            node.style.removeProperty("will-change");
          });
        }

        function getQueueDragItem(target) {
          if (!target || !(target instanceof Element)) return null;
          return target.closest("[data-now-playing-queue-index]");
        }

        function getQueueReorderIndex(item) {
          if (!item || !overlayQueueList.contains(item) || item.classList.contains("is-current")) return null;
          const index = Number(item.getAttribute("data-now-playing-queue-index"));
          if (!Number.isInteger(index) || index < 0 || index >= audioState.playlist.length) return null;
          return index;
        }

        function resolveQueueDropAt(clientX, clientY) {
          const rows = Array.from(overlayQueueList.querySelectorAll("[data-now-playing-queue-index]"));
          if (!rows.length) return null;
          const listRect = overlayQueueList.getBoundingClientRect();
          if (
            Number.isFinite(clientX) &&
            (clientX < listRect.left - 72 || clientX > listRect.right + 72)
          ) {
            return null;
          }

          for (const item of rows) {
            const index = Number(item.getAttribute("data-now-playing-queue-index"));
            if (!Number.isInteger(index)) continue;
            const rect = item.getBoundingClientRect();
            if (clientY > rect.bottom) continue;
            return {
              index,
              after: item.classList.contains("is-current") || clientY > rect.top + rect.height / 2,
              item
            };
          }

          const item = rows[rows.length - 1];
          const index = Number(item.getAttribute("data-now-playing-queue-index"));
          return Number.isInteger(index) ? { index, after: true, item } : null;
        }

        function resolveQueueDrop(event) {
          return resolveQueueDropAt(event.clientX, event.clientY);
        }

        function previewQueueDrop(clientX, clientY) {
          const drop = resolveQueueDropAt(clientX, clientY);
          clearQueueDropIndicators();
          if (drop && drop.item) {
            drop.item.classList.add(drop.after ? "is-drop-after" : "is-drop-before");
          }
          if (queuePressGesture && drop && (
            queuePressGesture.targetIndex !== drop.index ||
            queuePressGesture.targetAfter !== Boolean(drop.after)
          )) {
            queuePressGesture.targetIndex = drop.index;
            queuePressGesture.targetAfter = Boolean(drop.after);
            animateQueuePreview(queuePressGesture, drop);
            emitQueueReorder(queuePressGesture, {
              result: "preview",
              handler_state: "active"
            });
          }
          if (queueMouseTelemetry && drop && (
            queueMouseTelemetry.targetIndex !== drop.index ||
            queueMouseTelemetry.targetAfter !== Boolean(drop.after)
          )) {
            queueMouseTelemetry.targetIndex = drop.index;
            queueMouseTelemetry.targetAfter = Boolean(drop.after);
            animateQueuePreview(queueMouseTelemetry, drop);
            emitQueueReorder(queueMouseTelemetry, {
              result: "preview",
              handler_state: "active"
            });
          }
          return drop;
        }

        function cancelQueueAutoScroll() {
          if (queueAutoScrollFrame) window.cancelAnimationFrame(queueAutoScrollFrame);
          queueAutoScrollFrame = 0;
          if (queuePressGesture) queuePressGesture.scrollVelocity = 0;
        }

        function runQueueAutoScroll() {
          queueAutoScrollFrame = 0;
          const gesture = queuePressGesture;
          if (!gesture || !gesture.activated || !gesture.scrollVelocity) return;
          const previousScrollTop = overlayQueueList.scrollTop;
          overlayQueueList.scrollTop += gesture.scrollVelocity;
          if (overlayQueueList.scrollTop !== previousScrollTop) {
            previewQueueDrop(gesture.lastX, gesture.lastY);
            queueAutoScrollFrame = window.requestAnimationFrame(runQueueAutoScroll);
          } else {
            gesture.scrollVelocity = 0;
          }
        }

        function updateQueueAutoScroll(clientY) {
          const gesture = queuePressGesture;
          if (!gesture || !gesture.activated) return;
          const rect = overlayQueueList.getBoundingClientRect();
          let velocity = 0;
          if (clientY < rect.top + QUEUE_AUTO_SCROLL_EDGE_PX) {
            const ratio = Math.max(0, Math.min(1, (rect.top + QUEUE_AUTO_SCROLL_EDGE_PX - clientY) / QUEUE_AUTO_SCROLL_EDGE_PX));
            velocity = -Math.max(3, QUEUE_AUTO_SCROLL_MAX_PX * ratio);
          } else if (clientY > rect.bottom - QUEUE_AUTO_SCROLL_EDGE_PX) {
            const ratio = Math.max(0, Math.min(1, (clientY - (rect.bottom - QUEUE_AUTO_SCROLL_EDGE_PX)) / QUEUE_AUTO_SCROLL_EDGE_PX));
            velocity = Math.max(3, QUEUE_AUTO_SCROLL_MAX_PX * ratio);
          }
          gesture.scrollVelocity = velocity;
          if (velocity && !queueAutoScrollFrame) {
            queueAutoScrollFrame = window.requestAnimationFrame(runQueueAutoScroll);
          } else if (!velocity) {
            cancelQueueAutoScroll();
          }
        }

        function updateQueueDragGhost(gesture, clientX, clientY) {
          if (!gesture || !gesture.ghost) return;
          gesture.ghost.style.left = `${Math.round(clientX - gesture.offsetX)}px`;
          gesture.ghost.style.top = `${Math.round(clientY - gesture.offsetY)}px`;
        }

        function activateQueuePress(gesture) {
          if (
            queuePressGesture !== gesture ||
            !gesture.item.isConnected ||
            !audioState.nowPlayingQueueOpen ||
            getQueueReorderIndex(gesture.item) !== gesture.index
          ) {
            finishQueuePress(false);
            return;
          }

          gesture.activated = true;
          queueDragIndex = gesture.index;
          gesture.item.classList.add("is-dragging");
          gesture.item.setAttribute("aria-grabbed", "true");
          overlayQueueList.classList.add("is-pointer-reordering");

          const rect = gesture.item.getBoundingClientRect();
          const ghost = gesture.item.cloneNode(true);
          ghost.classList.remove("is-dragging", "is-drop-before", "is-drop-after", "is-current");
          ghost.classList.add("now-playing-queue-drag-ghost");
          ghost.removeAttribute("id");
          ghost.removeAttribute("title");
          ghost.removeAttribute("aria-current");
          ghost.removeAttribute("aria-grabbed");
          ghost.removeAttribute("data-now-playing-queue-index");
          ghost.removeAttribute("data-now-playing-queue-draggable");
          ghost.setAttribute("aria-hidden", "true");
          ghost.tabIndex = -1;
          ghost.draggable = false;
          ghost.style.width = `${Math.round(rect.width)}px`;
          ghost.style.height = `${Math.round(rect.height)}px`;
          gesture.offsetX = Math.max(0, Math.min(rect.width, gesture.startX - rect.left));
          gesture.offsetY = Math.max(0, Math.min(rect.height, gesture.startY - rect.top));
          gesture.ghost = ghost;
          document.body.appendChild(ghost);
          if (queueReducedMotion()) {
            gesture.liftFinished = true;
          } else if (typeof ghost.getAnimations === "function") {
            const liftAnimations = ghost.getAnimations();
            if (liftAnimations.length) {
              Promise.all(liftAnimations.map(function (animation) {
                return Promise.resolve(animation.finished).catch(function () {});
              })).then(function () {
                if (gesture.finished) return;
                gesture.liftFinished = true;
                emitQueueReorder(gesture, {
                  result: "lift_finished",
                  handler_state: "active"
                });
              });
            }
          }
          emitQueueReorder(gesture, {
            result: "activated",
            handler_state: "active",
            ghost_created: true,
            ghost_created_ms: Math.max(0, Date.now() - gesture.startedAt),
            lift_started_ms: Math.max(0, Date.now() - gesture.startedAt),
            lift_animated: !queueReducedMotion()
          });
          updateQueueDragGhost(gesture, gesture.lastX, gesture.lastY);
          previewQueueDrop(gesture.lastX, gesture.lastY);

          if (gesture.input === "pointer" && typeof gesture.item.setPointerCapture === "function") {
            try { gesture.item.setPointerCapture(gesture.pointerId); } catch (_err) {}
          }
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try { navigator.vibrate(10); } catch (_err) {}
          }
        }

        function beginQueuePress(item, index, clientX, clientY, details) {
          if (queuePressGesture || Number.isInteger(queueDragIndex)) return false;
          const opts = details || {};
          const gesture = {
            item,
            index,
            input: opts.input || "touch",
            identifier: opts.identifier,
            pointerId: opts.pointerId,
            startX: clientX,
            startY: clientY,
            lastX: clientX,
            lastY: clientY,
            offsetX: 0,
            offsetY: 0,
            activated: false,
            ghost: null,
            liftFinished: false,
            shiftedRowCount: 0,
            flipStarted: false,
            flipFinished: false,
            flipAnimationCount: 0,
            previewAnimations: new Map(),
            scrollVelocity: 0,
            timer: 0
          };
          gesture.telemetryToken = queueTelemetryToken(gesture.input);
          gesture.startedAt = Date.now();
          gesture.targetIndex = index;
          gesture.telemetryStarted = false;
          queuePressGesture = gesture;
          gesture.timer = window.setTimeout(function () {
            activateQueuePress(gesture);
          }, QUEUE_PRESS_HOLD_MS);
          return true;
        }

        function moveQueuePress(clientX, clientY) {
          const gesture = queuePressGesture;
          if (!gesture) return false;
          gesture.lastX = clientX;
          gesture.lastY = clientY;
          if (!gesture.activated) {
            if (Math.hypot(clientX - gesture.startX, clientY - gesture.startY) > QUEUE_PRESS_MOVE_TOLERANCE_PX) {
              finishQueuePress(false);
            }
            return false;
          }
          updateQueueDragGhost(gesture, clientX, clientY);
          previewQueueDrop(clientX, clientY);
          updateQueueAutoScroll(clientY);
          return true;
        }

        function finishQueuePress(commit) {
          const gesture = queuePressGesture;
          if (!gesture) return false;
          const activated = gesture.activated;
          const fromIndex = gesture.index;
          const drop = activated && commit ? resolveQueueDropAt(gesture.lastX, gesture.lastY) : null;
          window.clearTimeout(gesture.timer);
          cancelQueueAutoScroll();
          gesture.finished = true;
          stopQueuePreviewAnimations(gesture);
          const beforeRects = drop ? captureQueueRowRects() : null;
          if (gesture.ghost && gesture.ghost.parentNode) gesture.ghost.parentNode.removeChild(gesture.ghost);
          gesture.item.classList.remove("is-dragging");
          gesture.item.removeAttribute("aria-grabbed");
          if (
            gesture.input === "pointer" &&
            typeof gesture.item.hasPointerCapture === "function" &&
            gesture.item.hasPointerCapture(gesture.pointerId)
          ) {
            try { gesture.item.releasePointerCapture(gesture.pointerId); } catch (_err) {}
          }
          queuePressGesture = null;
          clearQueueDragState({ suppressClick: activated });
          let moved = false;
          if (drop) moved = movePlaylistItem(fromIndex, drop.index, { after: drop.after }) !== false;
          if (drop && moved) animateQueueFinalFlip(gesture, beforeRects);
          emitQueueReorder(gesture, {
            target_index: drop ? drop.index : fromIndex,
            result: drop && moved ? "committed" : "cancelled",
            cancel_reason: drop && moved ? "" : (activated ? "invalid_drop" : "hold_cancelled"),
            handler_state: "finished",
            navigation_completed: Boolean(drop && moved)
          });
          return activated;
        }

        function findTouch(touchList, identifier) {
          if (!touchList) return null;
          for (let index = 0; index < touchList.length; index += 1) {
            if (touchList[index].identifier === identifier) return touchList[index];
          }
          return null;
        }

        overlayQueueList.addEventListener("dragstart", function (event) {
          const item = getQueueDragItem(event.target);
          const index = getQueueReorderIndex(item);
          if (queuePressGesture || !Number.isInteger(index)) {
            event.preventDefault();
            return;
          }
          queueDragIndex = index;
          queueMouseTelemetry = {
            index,
            targetIndex: index,
            input: "mouse",
            telemetryToken: queueTelemetryToken("mouse"),
            startedAt: Date.now(),
            activated: true,
            ghost: null,
            liftFinished: false,
            shiftedRowCount: 0,
            flipStarted: false,
            flipFinished: false,
            flipAnimationCount: 0,
            previewAnimations: new Map(),
            committed: false,
            telemetryStarted: false
          };
          emitQueueReorder(queueMouseTelemetry, {
            result: "activated",
            handler_state: "active",
            ghost_created: false,
            lift_animated: false
          });
          item.classList.add("is-dragging");
          item.setAttribute("aria-grabbed", "true");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
          }
        });

        overlayQueueList.addEventListener("dragover", function (event) {
          if (!Number.isInteger(queueDragIndex)) return;
          const drop = resolveQueueDrop(event);
          if (!drop) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          previewQueueDrop(event.clientX, event.clientY);
        });

        overlayQueueList.addEventListener("drop", function (event) {
          if (!Number.isInteger(queueDragIndex)) return;
          const drop = resolveQueueDrop(event);
          if (!drop) {
            if (queueMouseTelemetry) queueMouseTelemetry.finished = true;
            emitQueueReorder(queueMouseTelemetry, {
              result: "cancelled",
              cancel_reason: "invalid_drop",
              handler_state: "finished"
            });
            stopQueuePreviewAnimations(queueMouseTelemetry);
            queueMouseTelemetry = null;
            clearQueueDragState();
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (queueMouseTelemetry) queueMouseTelemetry.finished = true;
          stopQueuePreviewAnimations(queueMouseTelemetry);
          const beforeRects = captureQueueRowRects();
          const moved = movePlaylistItem(queueDragIndex, drop.index, { after: drop.after }) !== false;
          if (queueMouseTelemetry) {
            queueMouseTelemetry.targetIndex = drop.index;
            queueMouseTelemetry.committed = moved;
            emitQueueReorder(queueMouseTelemetry, {
              result: moved ? "committed" : "cancelled",
              cancel_reason: moved ? "" : "move_rejected",
              handler_state: "finished"
            });
          }
          if (moved) animateQueueFinalFlip(queueMouseTelemetry, beforeRects);
          queueMouseTelemetry = null;
          clearQueueDragState({ suppressClick: true });
        });

        overlayQueueList.addEventListener("dragend", function () {
          if (queueMouseTelemetry) queueMouseTelemetry.finished = true;
          if (queueMouseTelemetry && !queueMouseTelemetry.committed) {
            emitQueueReorder(queueMouseTelemetry, {
              result: "cancelled",
              cancel_reason: "drag_end",
              handler_state: "finished"
            });
          }
          stopQueuePreviewAnimations(queueMouseTelemetry);
          queueMouseTelemetry = null;
          clearQueueDragState({ suppressClick: true });
        });

        overlayQueueList.addEventListener("touchstart", function (event) {
          if (!event.touches || event.touches.length !== 1 || !event.changedTouches || !event.changedTouches.length) return;
          const item = getQueueDragItem(event.target);
          const index = getQueueReorderIndex(item);
          if (!Number.isInteger(index)) return;
          const touch = event.changedTouches[0];
          beginQueuePress(item, index, touch.clientX, touch.clientY, {
            input: "touch",
            identifier: touch.identifier
          });
        }, { passive: true });

        overlayQueueList.addEventListener("touchmove", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "touch") return;
          const touch = findTouch(event.touches, gesture.identifier);
          if (!touch) return;
          if (moveQueuePress(touch.clientX, touch.clientY)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, { passive: false });

        overlayQueueList.addEventListener("touchend", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "touch") return;
          const touch = findTouch(event.changedTouches, gesture.identifier);
          if (!touch) return;
          gesture.lastX = touch.clientX;
          gesture.lastY = touch.clientY;
          const activated = gesture.activated;
          if (activated) {
            event.preventDefault();
            event.stopPropagation();
          }
          finishQueuePress(activated);
        }, { passive: false });

        overlayQueueList.addEventListener("touchcancel", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "touch") return;
          if (!findTouch(event.changedTouches, gesture.identifier)) return;
          const activated = gesture.activated;
          if (activated) event.preventDefault();
          finishQueuePress(false);
        }, { passive: false });

        overlayQueueList.addEventListener("pointerdown", function (event) {
          if (!event.isPrimary || event.pointerType !== "pen") return;
          const item = getQueueDragItem(event.target);
          const index = getQueueReorderIndex(item);
          if (!Number.isInteger(index)) return;
          beginQueuePress(item, index, event.clientX, event.clientY, {
            input: "pointer",
            pointerId: event.pointerId
          });
        });

        overlayQueueList.addEventListener("pointermove", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "pointer" || event.pointerId !== gesture.pointerId) return;
          if (moveQueuePress(event.clientX, event.clientY)) {
            event.preventDefault();
            event.stopPropagation();
          }
        });

        overlayQueueList.addEventListener("pointerup", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "pointer" || event.pointerId !== gesture.pointerId) return;
          gesture.lastX = event.clientX;
          gesture.lastY = event.clientY;
          const activated = gesture.activated;
          if (activated) {
            event.preventDefault();
            event.stopPropagation();
          }
          finishQueuePress(activated);
        });

        overlayQueueList.addEventListener("pointercancel", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || gesture.input !== "pointer" || event.pointerId !== gesture.pointerId) return;
          finishQueuePress(false);
        });

        overlayQueueList.addEventListener("contextmenu", function (event) {
          const gesture = queuePressGesture;
          if (!gesture || !gesture.item.contains(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
        });

        overlayQueueList.addEventListener("click", function (event) {
          if (Number.isInteger(queueDragIndex) || Date.now() < queueDragSuppressClickUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          const target = event.target;
          if (!target || !(target instanceof Element)) return;
          const item = target.closest("[data-now-playing-queue-index]");
          if (!item) return;
          event.preventDefault();
          event.stopPropagation();
          const index = Number(item.getAttribute("data-now-playing-queue-index"));
          if (!Number.isInteger(index) || index < 0 || index >= audioState.playlist.length) return;
          if (index === audioState.currentIndex) return;
          startTrack(index, {
            seamless: true,
            immediatePlay: true,
            userGesture: true,
            surface: "fullscreen_queue"
          });
        });
      }
      if (overlayVolumeToggle) overlayVolumeToggle.addEventListener("click", toggleNowPlayingVolumeVisible);
      if (overlayProgress) {
        let overlaySeeking = false;
        let overlaySeekPointerId = null;
        let overlaySeekRatio = 0;

        function getOverlayProgressRatio(clientX) {
          const bounds = overlayProgress.getBoundingClientRect();
          if (!bounds.width) return null;
          const ratio = (clientX - bounds.left) / bounds.width;
          return Math.max(0, Math.min(1, ratio));
        }

        function previewOverlaySeek(ratio) {
          const audio = audioState.audio;
          if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
          overlaySeekRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
          const previewTime = overlaySeekRatio * audio.duration;
          if (overlayFill) overlayFill.style.width = `${overlaySeekRatio * 100}%`;
          if (overlayCurrent) overlayCurrent.textContent = formatTrackDuration(previewTime);
          if (overlayDuration) overlayDuration.textContent = `-${formatTrackDuration(Math.max(0, audio.duration - previewTime))}`;
        }

        overlayProgress.addEventListener("pointerdown", function (event) {
          const ratio = getOverlayProgressRatio(event.clientX);
          if (ratio === null || overlayProgress.disabled) return;
          event.preventDefault();
          event.stopPropagation();
          overlaySeeking = true;
          overlaySeekPointerId = event.pointerId;
          audioState.nowPlayingSeeking = true;
          previewOverlaySeek(ratio);
          if (typeof overlayProgress.setPointerCapture === "function") {
            try {
              overlayProgress.setPointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore capture errors.
            }
          }
        });
        function moveOverlaySeeking(event) {
          if (!overlaySeeking) return;
          if (overlaySeekPointerId !== null && event.pointerId !== overlaySeekPointerId) return;
          const ratio = getOverlayProgressRatio(event.clientX);
          if (ratio === null) return;
          event.preventDefault();
          event.stopPropagation();
          previewOverlaySeek(ratio);
        }
        function stopOverlaySeeking(event) {
          if (!overlaySeeking) return;
          if (event && overlaySeekPointerId !== null && event.pointerId !== overlaySeekPointerId) return;
          event.preventDefault();
          event.stopPropagation();
          overlaySeeking = false;
          overlaySeekPointerId = null;
          audioState.nowPlayingSeeking = false;
          if (event && typeof overlayProgress.releasePointerCapture === "function") {
            try {
              overlayProgress.releasePointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore release errors.
            }
          }
          seekCurrentAudioToRatio(overlaySeekRatio);
          updateProgressUi();
        }
        function cancelOverlaySeeking(event) {
          if (!overlaySeeking) return;
          if (event && overlaySeekPointerId !== null && event.pointerId !== overlaySeekPointerId) return;
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          overlaySeeking = false;
          overlaySeekPointerId = null;
          audioState.nowPlayingSeeking = false;
          updateProgressUi();
        }
        overlayProgress.addEventListener("pointermove", moveOverlaySeeking);
        overlayProgress.addEventListener("pointerup", stopOverlaySeeking);
        overlayProgress.addEventListener("pointercancel", cancelOverlaySeeking);
        window.addEventListener("pointermove", moveOverlaySeeking, { passive: false });
        window.addEventListener("pointerup", stopOverlaySeeking, { passive: false });
        window.addEventListener("pointercancel", cancelOverlaySeeking, { passive: false });
      }
      if (overlayVolume) {
        overlayVolume.addEventListener("input", function () {
          const audio = audioState.audio;
          if (!audio || isIosDevice()) return;
          const nextVolume = Math.max(0, Math.min(1, Number(overlayVolume.value)));
          try {
            audio.volume = nextVolume;
          } catch (_err) {
            // iOS Safari may ignore media volume changes.
          }
          syncNowPlayingOverlay();
        });
      }
      if (miniProgress && !rootControlsAlreadyBound) {
        function seekFromMiniProgress(clientX) {
          const audio = audioState.audio;
          if (!audio) return;
          if (!audio.duration || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const bounds = miniProgress.getBoundingClientRect();
          if (!bounds.width) return;
          const ratio = (clientX - bounds.left) / bounds.width;
          const clamped = Math.max(0, Math.min(1, ratio));
          audio.currentTime = clamped * audio.duration;
          updateProgressUi();
        }

        let miniSeeking = false;
        let miniSeekPointerId = null;
        miniProgress.addEventListener("pointerdown", function (event) {
          if (miniProgress.disabled) return;
          event.preventDefault();
          event.stopPropagation();
          miniSeeking = true;
          miniSeekPointerId = event.pointerId;
          if (typeof miniProgress.setPointerCapture === "function") {
            try {
              miniProgress.setPointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore capture errors.
            }
          }
          seekFromMiniProgress(event.clientX);
        });
        function moveMiniSeeking(event) {
          if (!miniSeeking) return;
          if (miniSeekPointerId !== null && event.pointerId !== miniSeekPointerId) return;
          event.preventDefault();
          event.stopPropagation();
          seekFromMiniProgress(event.clientX);
        }
        function stopMiniSeeking(event) {
          if (!miniSeeking) return;
          if (event && miniSeekPointerId !== null && event.pointerId !== miniSeekPointerId) return;
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          miniSeeking = false;
          miniSeekPointerId = null;
          if (event && typeof miniProgress.releasePointerCapture === "function") {
            try {
              miniProgress.releasePointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore release errors.
            }
          }
        }
        miniProgress.addEventListener("pointermove", moveMiniSeeking);
        miniProgress.addEventListener("pointerup", stopMiniSeeking);
        miniProgress.addEventListener("pointercancel", stopMiniSeeking);
        window.addEventListener("pointermove", moveMiniSeeking, { passive: false });
        window.addEventListener("pointerup", stopMiniSeeking, { passive: false });
        window.addEventListener("pointercancel", stopMiniSeeking, { passive: false });
        miniProgress.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          seekFromMiniProgress(event.clientX);
        });
      }
      root.dataset.controlsBound = "1";
      if (!audioState.transportResizeBound) {
        const syncOnViewportChange = function () {
          syncTransportUi();
        };
        window.addEventListener("resize", syncOnViewportChange, { passive: true });
        window.addEventListener("orientationchange", syncOnViewportChange);
        audioState.transportResizeBound = true;
      }
      if (!audioState.overlayEscapeBound) {
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && audioState.nowPlayingOpen) {
            if (audioState.nowPlayingQueueOpen) {
              setNowPlayingQueueOpen(false);
              return;
            }
            closeNowPlayingOverlay();
          }
        });
        audioState.overlayEscapeBound = true;
      }
      root.dataset.bound = "1";
    }

    audioState.transport = {
      root,
      modeBtn,
      prevBtn,
      toggleBtn,
      nextBtn,
      shuffleBtn,
      nowWrap,
      nowTitle,
      nowAlbum,
      favoriteBtn,
      nowMini,
      miniCurrent,
      miniDuration,
      miniProgress,
      miniFill,
      transportCover,
      overlay,
      overlayPanel,
      overlayBackdrop,
      overlayCover,
      overlayTitle,
      overlayAlbum,
      overlayFavorite,
      overlayVisual,
      overlayVisualCanvas,
      overlayCurrent,
      overlayDuration,
      overlayProgress,
      overlayFill,
      overlayShuffle,
      overlayPrev,
      overlayToggle,
      overlayNext,
      overlayRadio,
      overlayQueue,
      overlayQueueToggle,
      overlayQueueCount,
      overlayQueueSheet,
      overlayQueuePanel,
      overlayQueueList,
      overlayVolumeToggle,
      overlayVolumeWrap,
      overlayVolume,
      pipFavorite: null,
      visualizer: null
    };
    ensureDesktopAudioVisualizer(audioState.transport);
    syncTransportUi();
    syncNowPlayingOverlay();
    return audioState.transport;
  }

  function syncTransportMiniUi() {
    const transport = audioState.transport;
    if (!transport || !transport.nowMini) return;

    const audio = audioState.audio;
    const hasSource = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasDuration = Boolean(
      !audioState.sourceMetadataPending &&
      audio &&
      audio.duration &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    );

    transport.nowMini.hidden = !hasSource;
    if (!hasSource) {
      if (transport.miniCurrent) transport.miniCurrent.textContent = "0:00";
      if (transport.miniDuration) transport.miniDuration.textContent = "0:00";
      if (transport.miniFill) transport.miniFill.style.width = "0%";
      if (transport.miniProgress) transport.miniProgress.disabled = true;
      syncTransportPictureInPictureProgress();
      syncNowPlayingOverlayProgress();
      return;
    }

    const currentTime = hasDuration && Number.isFinite(audio.currentTime) && audio.currentTime > 0
      ? formatTrackDuration(audio.currentTime)
      : "0:00";
    const duration = hasDuration ? formatTrackDuration(audio.duration) : "0:00";
    const percent = hasDuration ? Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) : 0;

    if (transport.miniCurrent) transport.miniCurrent.textContent = currentTime;
    if (transport.miniDuration) transport.miniDuration.textContent = duration;
    if (transport.miniFill) transport.miniFill.style.width = `${percent}%`;
    if (transport.miniProgress) transport.miniProgress.disabled = !hasDuration;
    syncTransportPictureInPictureProgress();
    syncNowPlayingOverlayProgress();
  }

  function syncMobilePlayerSpace(isMobileLayout, shouldShow) {
    const rootEl = document.documentElement;
    if (!rootEl) return;

    if (!isMobileLayout || !shouldShow) {
      rootEl.style.setProperty("--mobile-player-space", "0px");
      return;
    }

    const transport = audioState.transport;
    if (!transport || !transport.root || transport.root.hidden) {
      rootEl.style.setProperty("--mobile-player-space", "0px");
      return;
    }

    const rect = transport.root.getBoundingClientRect();
    const computed = window.getComputedStyle(transport.root);
    const bottom = parseFloat(computed.bottom || "0") || 0;
    const space = Math.max(0, Math.ceil(rect.height + bottom + 12));
    rootEl.style.setProperty("--mobile-player-space", `${space}px`);
  }

  function getMiniPlayerVisibilityReason(details) {
    const state = details || {};
    if (spaState.prepaintSyncActive) return "spa_prepaint";
    if (audioState.transportPipOpen || audioState.transportPipOpening) return "picture_in_picture";
    if (audioState.nowPlayingOpen) return "fullscreen";
    if (!state.isHome && !state.isAlbum) return "route_scope";
    if (!state.hasPlaybackSessionActive) return "session_missing";
    return "route_scope";
  }

  function setMiniPlayerVisibility(root, shouldShow, details) {
    if (!root) return;
    const wasHidden = Boolean(root.hidden);
    const nextHidden = !Boolean(shouldShow);
    root.hidden = nextHidden;
    if (wasHidden === nextHidden) return;

    const state = details || {};
    const hasSource = Boolean(audioState.audio && getCurrentPlayableAudioSrc(audioState.audio));
    const unexpected = Boolean(
      nextHidden &&
      !audioState.nowPlayingOpen &&
      !audioState.transportPipOpen &&
      (state.isHome || state.isAlbum) &&
      (state.hasPlaybackSessionActive || hasSource)
    );
    trackAudioRuntimeEvent("mini_player_visibility", {
      state: nextHidden ? "hidden" : "visible",
      reason: getMiniPlayerVisibilityReason(state),
      mode: String(audioState.homeMode || ""),
      route_kind: state.isHome ? "home" : (state.isAlbum ? "album" : "other"),
      visible: !nextHidden,
      unexpected,
      navigation_active: Boolean(spaState.navigationActive),
      fullscreen_open: Boolean(audioState.nowPlayingOpen),
      has_playback_session: Boolean(state.hasPlaybackSessionActive),
      has_source: hasSource,
      is_home: Boolean(state.isHome),
      is_album: Boolean(state.isAlbum)
    });
  }

  function syncTransportUi() {
    const transport = audioState.transport;
    if (!transport || !transport.root) return;

    ensurePlayablePlaylistContext();

    const audio = audioState.audio;
    const hasPlaylist = audioState.playlist && audioState.playlist.length > 0;
    const hasPlaybackSessionActive = hasPlaybackSession();
    const canStartInitialRandom = canStartInitialGlobalRandomPlayback();
    const isRadioMode = audioState.homeMode === "radio";
    const isHome = document.body.classList.contains("home-screen");
    const isAlbum = document.body.classList.contains("album-screen");
    const isMobileLayout = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 980px)").matches
      : false;
    const shouldShow = Boolean(isHome || isAlbum || hasPlaybackSessionActive);
    const transportShouldShow = Boolean(
      shouldShow &&
      !audioState.nowPlayingOpen &&
      !audioState.transportPipOpen
    );
    const mobileDockVisible = Boolean(isMobileLayout && transportShouldShow);
    const canOpenNowPlaying = Boolean(hasPlaybackSessionActive);

    setMiniPlayerVisibility(transport.root, transportShouldShow, {
      isHome,
      isAlbum,
      hasPlaybackSessionActive
    });
    transport.root.classList.toggle("is-playing", Boolean(audio && !audio.paused));
    if (transport.overlayPanel) {
      transport.overlayPanel.classList.toggle("is-playing", Boolean(audio && !audio.paused));
    }
    syncDesktopTransportLayout(transport.root, hasPlaybackSessionActive);
    document.body.classList.toggle("has-mobile-player", mobileDockVisible);
    if (!canOpenNowPlaying && audioState.nowPlayingOpen) {
      closeNowPlayingOverlay();
    }
    if (transport.overlay) {
      transport.overlay.hidden = !audioState.nowPlayingOpen;
    }
    const visualizer = ensureDesktopAudioVisualizer(transport);
    if (visualizer && typeof visualizer.sync === "function") {
      visualizer.sync({
        active: Boolean(audioState.nowPlayingOpen && canOpenNowPlaying && isDesktopTransportViewport())
      });
    }
    document.body.classList.toggle("now-playing-open", Boolean(audioState.nowPlayingOpen && canOpenNowPlaying));
    document.documentElement.classList.toggle("now-playing-open", Boolean(audioState.nowPlayingOpen && canOpenNowPlaying));

    if (transport.modeBtn) {
      transport.modeBtn.hidden = false;
      transport.modeBtn.disabled = false;
      if (!transport.modeBtn.querySelector(".radio-icon")) {
        transport.modeBtn.innerHTML = RADIO_ICON;
      }
      transport.modeBtn.classList.toggle("is-on", isRadioMode);
      transport.modeBtn.setAttribute("aria-pressed", isRadioMode ? "true" : "false");
      transport.modeBtn.setAttribute(
        "aria-label",
        isRadioMode ? "Desactiver la radio aleatoire" : "Activer la radio aleatoire"
      );
    }

    const radioIdleReady = !isRadioMode ||
      hasPlaybackSessionActive ||
      canStartInitialRandom ||
      canStartCurrentPageCollectionFromIdle(audio) ||
      Boolean(Array.isArray(audioState.radioQueue) && audioState.radioQueue.length);
    const canToggle = Boolean(audio) &&
      radioIdleReady &&
      (
        hasPlaybackSessionActive ||
        hasPlaylist ||
        canStartInitialRandom ||
        canStartCurrentPageCollectionFromIdle(audio)
      );
    if (transport.toggleBtn) {
      transport.toggleBtn.disabled = !canToggle || Boolean(audioState.globalRandomStartInFlight);
      transport.toggleBtn.setAttribute("aria-label", audio && !audio.paused ? "Pause" : "Lecture");
    }

    const canSkip = Boolean(audioState.playlist && audioState.playlist.length > 1);
    if (transport.prevBtn) transport.prevBtn.disabled = !canSkip;
    if (transport.nextBtn) transport.nextBtn.disabled = !canSkip;
    if (transport.shuffleBtn) {
      const shuffleActive = Boolean(audioState.shuffleOn && !isRadioMode);
      transport.shuffleBtn.disabled = !canSkip;
      transport.shuffleBtn.classList.toggle("is-on", shuffleActive);
      transport.shuffleBtn.classList.remove("is-muted-active");
      transport.shuffleBtn.setAttribute("aria-pressed", shuffleActive ? "true" : "false");
      transport.shuffleBtn.setAttribute(
        "aria-label",
        isRadioMode
          ? "Activer le shuffle album et desactiver la radio"
          : (shuffleActive ? "Desactiver le shuffle album" : "Activer le shuffle album")
      );
    }

    const currentTrack = getCurrentPlaylistTrack();
    const trackTitle = normalizeTrackTitle(currentTrack && currentTrack.name ? currentTrack.name : "");
    const trackAlbum = normalizeAlbumTitle(
      currentTrack && currentTrack.album
        ? currentTrack.album
        : getCurrentAlbumTitle()
    );
    const trackAlbumHref = currentTrack ? getCurrentTrackAlbumPage(currentTrack) : "";

    if (transport.nowWrap) {
      const showNowPlaying = Boolean(trackTitle && (isHome || hasPlaybackSessionActive));
      transport.nowWrap.hidden = !showNowPlaying;
      if (transport.nowTitle) {
        transport.nowTitle.textContent = showNowPlaying ? trackTitle : "";
        transport.nowTitle.setAttribute("aria-label", "Titre en lecture");
      }
      if (transport.nowAlbum) {
        const showAlbum = Boolean(showNowPlaying && trackAlbum);
        const hasAlbumLink = Boolean(showAlbum && trackAlbumHref);
        transport.nowAlbum.textContent = showAlbum ? trackAlbum : "";
        transport.nowAlbum.hidden = !showAlbum;
        transport.nowAlbum.href = hasAlbumLink ? trackAlbumHref : "#";
        transport.nowAlbum.classList.toggle("is-link", hasAlbumLink);
        transport.nowAlbum.setAttribute(
          "aria-label",
          hasAlbumLink ? `Ouvrir l'album ${trackAlbum}` : "Album en lecture"
        );
      }
    }
    syncTransportMiniUi();
    syncMobilePlayerSpace(isMobileLayout, transportShouldShow);
    syncCurrentFavoriteButtons();
    syncTransportPictureInPictureUi();
    syncNowPlayingOverlay();
  }

    return {
      isDesktopTransportViewport: isDesktopTransportViewport,
      getDesktopTransportState: getDesktopTransportState,
      readDesktopTransportLayout: readDesktopTransportLayout,
      writeDesktopTransportLayout: writeDesktopTransportLayout,
      clampDesktopTransportLayout: clampDesktopTransportLayout,
      clampDesktopTransportPosition: clampDesktopTransportPosition,
      syncDesktopTransportCover: syncDesktopTransportCover,
      applyDesktopTransportLayout: applyDesktopTransportLayout,
      applyDesktopTransportPosition: applyDesktopTransportPosition,
      clearDesktopTransportInlineStyles: clearDesktopTransportInlineStyles,
      syncDesktopTransportLayout: syncDesktopTransportLayout,
      isDesktopTransportPointer: isDesktopTransportPointer,
      bindDesktopTransportUi: bindDesktopTransportUi,
      isDocumentPictureInPictureSupported: isDocumentPictureInPictureSupported,
      isTransportPictureInPictureOpen: isTransportPictureInPictureOpen,
      requestTransportPictureInPicture: requestTransportPictureInPicture,
      closeTransportPictureInPicture: closeTransportPictureInPicture,
      syncTransportPictureInPictureUi: syncTransportPictureInPictureUi,
      ensureGlobalTransportUi: ensureGlobalTransportUi,
      syncTransportMiniUi: syncTransportMiniUi,
      syncMobilePlayerSpace: syncMobilePlayerSpace,
      syncTransportUi: syncTransportUi
    };
  }

  window.InfraTransportUi = Object.assign(window.InfraTransportUi || {}, {
    createTransportUi: createTransportUi
  });
})();
