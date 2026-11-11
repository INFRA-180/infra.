// Mini-lecteur : affichage, place réservée en bas de page sur téléphone, synchronisation.
// Extrait de transport-ui.js (lot D, chantier JavaScript d'INFRA, 11/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createTransportUi() ; fonctions des autres modules : reliées par link().
export function createMiniPlayer(R) {
  const {
    RADIO_ICON,
    audioState,
    canStartInitialGlobalRandomPlayback,
    closeNowPlayingOverlay,
    ensurePlayablePlaylistContext,
    formatTrackDuration,
    getCurrentAlbumTitle,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistTrack,
    getCurrentTrackAlbumPage,
    hasPlaybackSession,
    normalizeAlbumTitle,
    normalizeTrackTitle,
    spaState,
    syncCurrentFavoriteButtons,
    syncNowPlayingOverlay,
    syncNowPlayingOverlayProgress,
    trackAudioRuntimeEvent
  } = R;
  let canStartCurrentPageCollectionFromIdle,
    ensureDesktopAudioVisualizer,
    isDesktopTransportViewport,
    syncDesktopTransportLayout,
    syncTransportPictureInPictureProgress,
    syncTransportPictureInPictureUi;

  // État propre à ce sujet (déplacé de l'en-tête de createTransportUi()).
  let mobilePlayerSpaceObserver = null;
  let mobilePlayerSpaceObservedRoot = null;
  let mobilePlayerSpaceRaf = 0;
  let mobilePlayerSpaceEnabled = false;
  let mobilePlayerSpaceHeight = 0;
  let mobilePlayerSpaceValue = -1;

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

    const currentTime =
      hasDuration && Number.isFinite(audio.currentTime) && audio.currentTime > 0
        ? formatTrackDuration(audio.currentTime)
        : "0:00";
    const duration = hasDuration ? formatTrackDuration(audio.duration) : "0:00";
    const percent = hasDuration ? Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) : 0;

    if (!audioState.miniPlayerSeeking) {
      if (transport.miniCurrent) transport.miniCurrent.textContent = currentTime;
      if (transport.miniDuration) transport.miniDuration.textContent = duration;
      if (transport.miniFill) transport.miniFill.style.width = `${percent}%`;
    }
    if (transport.miniProgress) transport.miniProgress.disabled = !hasDuration;
    syncTransportPictureInPictureProgress();
    syncNowPlayingOverlayProgress();
  }

  function commitMobilePlayerSpace() {
    const rootEl = document.documentElement;
    if (!rootEl) return;
    const nextSpace = mobilePlayerSpaceEnabled ? Math.max(0, Math.ceil(mobilePlayerSpaceHeight + 12)) : 0;
    if (nextSpace === mobilePlayerSpaceValue) return;
    mobilePlayerSpaceValue = nextSpace;
    rootEl.style.setProperty("--mobile-player-space", `${nextSpace}px`);
  }

  function scheduleMobilePlayerSpaceFallback(root) {
    if (mobilePlayerSpaceRaf || !root || !mobilePlayerSpaceEnabled) return;
    const run = function () {
      mobilePlayerSpaceRaf = 0;
      if (!mobilePlayerSpaceEnabled || root.hidden) return;
      mobilePlayerSpaceHeight = Math.max(0, Number(root.offsetHeight) || 0);
      commitMobilePlayerSpace();
    };
    if (typeof window.requestAnimationFrame === "function") {
      mobilePlayerSpaceRaf = window.requestAnimationFrame(run);
    } else {
      run();
    }
  }

  function observeMobilePlayerSpace(root) {
    if (!root || mobilePlayerSpaceObservedRoot === root) return;
    if (mobilePlayerSpaceObserver) mobilePlayerSpaceObserver.disconnect();
    mobilePlayerSpaceObservedRoot = root;
    if (typeof window.ResizeObserver !== "function") {
      mobilePlayerSpaceObserver = null;
      return;
    }
    mobilePlayerSpaceObserver = new window.ResizeObserver(function (entries) {
      const entry = entries.find(function (candidate) {
        return candidate && candidate.target === root;
      });
      if (!entry) return;
      const borderBox = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
      const height =
        Number(borderBox && borderBox.blockSize) ||
        Number(entry.contentRect && entry.contentRect.height) ||
        0;
      mobilePlayerSpaceHeight = Math.max(0, height);
      commitMobilePlayerSpace();
    });
    mobilePlayerSpaceObserver.observe(root);
  }

  function syncMobilePlayerSpace(isMobileLayout, shouldShow) {
    const transport = audioState.transport;
    const root = transport && transport.root;
    mobilePlayerSpaceEnabled = Boolean(isMobileLayout && shouldShow && root && !root.hidden);
    if (!root) {
      commitMobilePlayerSpace();
      return;
    }
    observeMobilePlayerSpace(root);
    commitMobilePlayerSpace();
    if (mobilePlayerSpaceEnabled && !mobilePlayerSpaceHeight && !mobilePlayerSpaceObserver) {
      scheduleMobilePlayerSpaceFallback(root);
    }
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
    const nextHidden = !shouldShow;
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
      route_kind: state.isHome ? "home" : state.isAlbum ? "album" : "other",
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
    const isMobileLayout =
      typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 980px)").matches : false;
    const shouldShow = Boolean(isHome || isAlbum || hasPlaybackSessionActive);
    const transportShouldShow = Boolean(
      shouldShow && !audioState.nowPlayingOpen && !audioState.transportPipOpen
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
    document.body.classList.toggle(
      "now-playing-open",
      Boolean(audioState.nowPlayingOpen && canOpenNowPlaying)
    );
    document.documentElement.classList.toggle(
      "now-playing-open",
      Boolean(audioState.nowPlayingOpen && canOpenNowPlaying)
    );

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

    const radioIdleReady =
      !isRadioMode ||
      hasPlaybackSessionActive ||
      canStartInitialRandom ||
      canStartCurrentPageCollectionFromIdle(audio) ||
      Boolean(Array.isArray(audioState.radioQueue) && audioState.radioQueue.length);
    const canToggle =
      Boolean(audio) &&
      radioIdleReady &&
      (hasPlaybackSessionActive ||
        hasPlaylist ||
        canStartInitialRandom ||
        canStartCurrentPageCollectionFromIdle(audio));
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
          : shuffleActive
            ? "Desactiver le shuffle album"
            : "Activer le shuffle album"
      );
    }

    const currentTrack = getCurrentPlaylistTrack();
    const trackTitle = normalizeTrackTitle(currentTrack && currentTrack.name ? currentTrack.name : "");
    const trackAlbum = normalizeAlbumTitle(
      currentTrack && currentTrack.album ? currentTrack.album : getCurrentAlbumTitle()
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
    link() {
      ({
        canStartCurrentPageCollectionFromIdle,
        ensureDesktopAudioVisualizer,
        isDesktopTransportViewport,
        syncDesktopTransportLayout,
        syncTransportPictureInPictureProgress,
        syncTransportPictureInPictureUi
      } = R);
    },
    fns: {
      syncTransportMiniUi,
      commitMobilePlayerSpace,
      scheduleMobilePlayerSpaceFallback,
      observeMobilePlayerSpace,
      syncMobilePlayerSpace,
      getMiniPlayerVisibilityReason,
      setMiniPlayerVisibility,
      syncTransportUi
    }
  };
}
