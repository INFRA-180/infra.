// Lecteur flottant (image dans l'image, ordinateur) : fenêtre, styles, commandes, détachement.
// Extrait de transport-ui.js (lot D, chantier JavaScript d'INFRA, 11/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createTransportUi() ; fonctions des autres modules : reliées par link().
export function createPictureInPicture(R) {
  const {
    DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
    DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
    DOCUMENT_PIP_DETACH_EDGE_THRESHOLD,
    DOCUMENT_PIP_MAX_HEIGHT,
    DOCUMENT_PIP_MAX_WIDTH,
    DOCUMENT_PIP_MIN_HEIGHT,
    DOCUMENT_PIP_MIN_WIDTH,
    HEART_ICON_OUTLINE,
    RADIO_ICON,
    SHUFFLE_ICON,
    audioState,
    canStartInitialGlobalRandomPlayback,
    formatTrackDuration,
    getCurrentAlbumTitle,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    getMediaSessionFallbackArtwork,
    getRuntimeAssetUrl,
    getSpaPersistRoot,
    handleGlobalTransportToggle,
    hasPlaybackSession,
    normalizeAlbumTitle,
    normalizeTrackTitle,
    playNext,
    playPrevious,
    resolveCoverUrl,
    seekCurrentAudioToRatio,
    setCoverWhenReady,
    syncCurrentFavoriteButtons,
    toggleAlbumShuffleMode,
    toggleCurrentFavorite,
    toggleRadioModeFromTransport,
    updateProgressUi
  } = R;
  let canStartCurrentPageCollectionFromIdle,
    getDesktopTransportState,
    isDesktopTransportViewport,
    syncTransportUi;

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
    return Boolean(audioState.transportPipOpen && pipState.window && pipState.window.closed !== true);
  }

  function copyTransportPictureInPictureStyles(pipDocument) {
    if (!pipDocument || !pipDocument.head) return;
    const minimalStyle = pipDocument.createElement("style");
    minimalStyle.textContent = [
      "html,body{width:100%;height:100%;margin:0;overflow:hidden;}",
      "body{display:grid;place-items:stretch;background:var(--bg-start,#f4f4f4);}"
    ].join("");
    pipDocument.head.appendChild(minimalStyle);

    const sourceLink = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).find(
      function (candidate) {
        const rawHref = String(candidate.getAttribute("href") || candidate.href || "");
        return rawHref.indexOf("assets/css/styles.css") !== -1;
      }
    );
    let query = "";
    if (sourceLink) {
      try {
        query = new URL(sourceLink.href, document.baseURI).search;
      } catch (_error) {
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
      "--accent",
      "--ink",
      "--ink-soft",
      "--line",
      "--bg-glow-1",
      "--bg-glow-2",
      "--bg-start",
      "--bg-mid",
      "--bg-end",
      "--overlay-bg",
      "--panel-bg",
      "--panel-border",
      "--code-bg",
      "--pill-bg",
      "--pill-ink"
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
      '    <button class="global-transport-favorite" type="button" data-transport-favorite hidden aria-label="Ajouter aux favoris" aria-pressed="false">' +
        HEART_ICON_OUTLINE +
        "</button>",
      '    <div class="global-transport-now-mini" data-transport-mini>',
      '      <span class="global-transport-mini-time" data-transport-mini-current>0:00</span>',
      '      <button class="global-transport-mini-progress" type="button" data-transport-mini-progress aria-label="Avancer dans le morceau">',
      '        <span class="global-transport-mini-fill" data-transport-mini-fill></span>',
      "      </button>",
      '      <span class="global-transport-mini-time" data-transport-mini-duration>0:00</span>',
      "    </div>",
      "  </div>",
      '  <div class="global-transport-controls">',
      '    <button class="global-transport-btn global-transport-mode" type="button" data-transport-mode aria-label="Activer la radio aleatoire">' +
        RADIO_ICON +
        "</button>",
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
      '    <button class="global-transport-btn" type="button" data-transport-shuffle aria-label="Shuffle">' +
        SHUFFLE_ICON +
        "</button>",
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
      width: Math.max(
        1,
        Number(pipWindow && pipWindow.innerWidth) ||
          Number(pipDocument && pipDocument.documentElement && pipDocument.documentElement.clientWidth) ||
          1
      ),
      height: Math.max(
        1,
        Number(pipWindow && pipWindow.innerHeight) ||
          Number(pipDocument && pipDocument.documentElement && pipDocument.documentElement.clientHeight) ||
          1
      )
    };
  }

  function syncTransportPictureInPictureProgress() {
    const refs = getTransportPictureInPictureState().refs;
    if (!refs) return;
    const audio = audioState.audio;
    const hasSource = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasDuration = Boolean(
      hasSource && !audioState.sourceMetadataPending && Number.isFinite(audio.duration) && audio.duration > 0
    );
    const currentTime =
      hasDuration && Number.isFinite(audio.currentTime) && audio.currentTime > 0
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
    const canToggle = Boolean(
      audio && (hasPlaybackSessionActive || hasPlaylist || canStartInitialRandom || canStartCurrentCollection)
    );
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
    const narrow = Boolean(expanded && (viewport.width < 520 || viewport.height < 240));
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
      refs.modeBtn.setAttribute(
        "aria-label",
        isRadioMode ? "Desactiver la radio aleatoire" : "Activer la radio aleatoire"
      );
    }
    if (refs.shuffleBtn) {
      refs.shuffleBtn.disabled = !canSkip;
      refs.shuffleBtn.classList.toggle("is-on", shuffleActive);
      refs.shuffleBtn.setAttribute("aria-pressed", shuffleActive ? "true" : "false");
      refs.shuffleBtn.setAttribute(
        "aria-label",
        isRadioMode
          ? "Activer le shuffle album et desactiver la radio"
          : shuffleActive
            ? "Desactiver le shuffle album"
            : "Activer le shuffle album"
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
    if (
      audioState.transport &&
      pipState.refs &&
      audioState.transport.pipFavorite === pipState.refs.favoriteBtn
    ) {
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
    if (refs.modeBtn)
      refs.modeBtn.addEventListener("click", function () {
        toggleRadioModeFromTransport();
        syncSoon();
      });
    if (refs.prevBtn)
      refs.prevBtn.addEventListener("click", function () {
        playPrevious({ seamless: true, fromTransportControl: true, surface: "pip" });
        syncSoon();
      });
    if (refs.toggleBtn)
      refs.toggleBtn.addEventListener("click", function () {
        handleGlobalTransportToggle();
        syncSoon();
      });
    if (refs.nextBtn)
      refs.nextBtn.addEventListener("click", function () {
        playNext({ seamless: true, fromTransportControl: true, surface: "pip" });
        syncSoon();
      });
    if (refs.shuffleBtn)
      refs.shuffleBtn.addEventListener("click", function () {
        toggleAlbumShuffleMode();
        syncSoon();
      });
    if (refs.favoriteBtn)
      refs.favoriteBtn.addEventListener("click", function (event) {
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
        try {
          refs.miniProgress.setPointerCapture(event.pointerId);
        } catch (_err) {}
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
    pipWindow.addEventListener(
      "pagehide",
      function () {
        clearTransportPictureInPictureState(pipWindow);
      },
      { once: true }
    );
    audioState.transportPipOpen = true;
    audioState.transportPipOpening = false;
    syncTransportPictureInPictureUi();
    startTransportPictureInPictureRaf();
    syncTransportUi();
  }

  function requestTransportPictureInPicture(_options) {
    const api = getDocumentPictureInPictureApi();
    if (!api || !isDesktopTransportViewport() || !hasPlaybackSession()) return Promise.resolve(false);
    const pipState = getTransportPictureInPictureState();
    if (pipState.window && pipState.window.closed !== true) {
      try {
        pipState.window.focus();
      } catch (_err) {}
      return Promise.resolve(true);
    }
    if (pipState.openPromise) return pipState.openPromise;

    const transportRoot = audioState.transport && audioState.transport.root;
    const rect = transportRoot ? transportRoot.getBoundingClientRect() : null;
    const width = Math.round(
      Math.max(DOCUMENT_PIP_MIN_WIDTH, Math.min(DOCUMENT_PIP_MAX_WIDTH, Number(rect && rect.width) || 360))
    );
    const height = Math.round(
      Math.max(DOCUMENT_PIP_MIN_HEIGHT, Math.min(DOCUMENT_PIP_MAX_HEIGHT, Number(rect && rect.height) || 180))
    );
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
    ].sort(function (a, b) {
      return a.value - b.value;
    });
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
    hint.innerHTML =
      '<span class="transport-pip-detach-icon" aria-hidden="true">▣</span><span data-transport-pip-detach-label>Glisser au bord pour détacher</span>';
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

  return {
    link() {
      ({
        canStartCurrentPageCollectionFromIdle,
        getDesktopTransportState,
        isDesktopTransportViewport,
        syncTransportUi
      } = R);
    },
    fns: {
      getTransportPictureInPictureState,
      getDocumentPictureInPictureApi,
      isDocumentPictureInPictureSupported,
      isTransportPictureInPictureOpen,
      copyTransportPictureInPictureStyles,
      syncTransportPictureInPictureTheme,
      getTransportPictureInPictureMarkup,
      getTransportPictureInPictureRefs,
      getTransportPictureInPictureViewport,
      syncTransportPictureInPictureProgress,
      syncTransportPictureInPictureUi,
      stopTransportPictureInPictureRaf,
      startTransportPictureInPictureRaf,
      clearTransportPictureInPictureState,
      bindTransportPictureInPictureControls,
      initializeTransportPictureInPictureWindow,
      requestTransportPictureInPicture,
      closeTransportPictureInPicture,
      getTransportPictureInPictureDetachEdge,
      ensureTransportPictureInPictureDetachHint,
      setTransportPictureInPictureDetachHint
    }
  };
}
