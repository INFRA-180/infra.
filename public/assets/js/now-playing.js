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

  function createNowPlaying(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const NOW_PLAYING_OVERLAY_ENABLED = ctx.NOW_PLAYING_OVERLAY_ENABLED !== false;
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const getThemePreset = method(ctx, "getThemePreset", function () { return {}; });
    const getPwaStatusColor = method(ctx, "getPwaStatusColor", function () { return "#111111"; });
    const isDarkColor = method(ctx, "isDarkColor", function () { return true; });
    const toAbsoluteUrlOrEmpty = method(ctx, "toAbsoluteUrlOrEmpty", function (value) { return String(value || ""); });
    const getCurrentThemeColor = method(ctx, "getCurrentThemeColor", function () { return "#111111"; });
    const setThemeColor = method(ctx, "setThemeColor");
    const syncPwaStatusColor = method(ctx, "syncPwaStatusColor");
    const syncTransportUi = method(ctx, "syncTransportUi");
    const scheduleDeferredServiceWorkerReload = method(ctx, "scheduleDeferredServiceWorkerReload");
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () { return ""; });
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () { return null; });
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) { return String(value || "").trim(); });
    const normalizeAlbumTitle = method(ctx, "normalizeAlbumTitle", function (value) { return String(value || "").trim(); });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const getCurrentTrackAlbumPage = method(ctx, "getCurrentTrackAlbumPage", function () { return ""; });
    const resolveCoverUrl = method(ctx, "resolveCoverUrl", function () { return ""; });
    const setCoverWhenReady = method(ctx, "setCoverWhenReady");
    const getMediaSessionFallbackArtwork = method(ctx, "getMediaSessionFallbackArtwork", function () { return ""; });
    const setCoverBackgroundStable = method(ctx, "setCoverBackgroundStable");
    const syncCurrentFavoriteButtons = method(ctx, "syncCurrentFavoriteButtons");
    const getCurrentPlaylistIndexSafe = method(ctx, "getCurrentPlaylistIndexSafe", function () { return -1; });
    const getQueuePreviewIndices = method(ctx, "getQueuePreviewIndices", function () { return []; });
    const mergeTrackMetadata = method(ctx, "mergeTrackMetadata", function (track) { return track || null; });
    const getTrackMetaByAssetPath = method(ctx, "getTrackMetaByAssetPath", function () { return null; });
    const getCachedTrackDuration = method(ctx, "getCachedTrackDuration", function () { return ""; });
    const getCurrentTrackArtwork = method(ctx, "getCurrentTrackArtwork", function () { return ""; });
    const normalizeArtworkUrl = method(ctx, "normalizeArtworkUrl", function (value) { return String(value || ""); });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () { return "0:00"; });

  function readNowPlayingVolumeVisible() {
    if (isIosDevice()) return false;
    try {
      return localStorage.getItem(audioState.nowPlayingVolumeStorageKey) !== "0";
    } catch (_err) {
      return true;
    }
  }

  function persistNowPlayingVolumeVisible(value) {
    try {
      localStorage.setItem(audioState.nowPlayingVolumeStorageKey, value ? "1" : "0");
    } catch (_err) {
      // Safari private browsing can block storage; keep the player working.
    }
  }

  function setNowPlayingVolumeVisible(value, options) {
    audioState.nowPlayingVolumeVisible = !isIosDevice() && Boolean(value);
    if (!options || !options.skipPersist) {
      persistNowPlayingVolumeVisible(audioState.nowPlayingVolumeVisible);
    }
    syncNowPlayingOverlay();
  }

  function toggleNowPlayingVolumeVisible() {
    setNowPlayingVolumeVisible(!audioState.nowPlayingVolumeVisible);
  }

  function getFallbackNowPlayingThemeColor() {
    const preset = getThemePreset();
    const base = getPwaStatusColor(preset);
    return isDarkColor(base) ? base : "#14141c";
  }

  function setNowPlayingSafeAreaColor(color) {
    const rawColor = String(color || "").trim();
    const safeColor = /^#[0-9a-f]{6}$/i.test(rawColor) && isDarkColor(rawColor)
      ? rawColor
      : "#14141c";
    const transport = audioState.transport;
    const overlay = transport && transport.overlay;
    if (overlay && overlay.style) {
      overlay.style.setProperty("--now-playing-safe-area-bg", safeColor);
    }
    setThemeColor(safeColor);
  }

  function clearNowPlayingSafeAreaColor() {
    const transport = audioState.transport;
    const overlay = transport && transport.overlay;
    if (overlay && overlay.style) {
      overlay.style.removeProperty("--now-playing-safe-area-bg");
    }
  }

  function extractImageThemeColor(src, token) {
    const url = toAbsoluteUrlOrEmpty(src || "");
    if (!url || typeof Image !== "function") return;

    const image = new Image();
    image.decoding = "async";
    image.onload = function () {
      if (token !== audioState.nowPlayingThemeToken || !audioState.nowPlayingOpen) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        const red = Math.max(0, Math.min(255, data[0] || 0));
        const green = Math.max(0, Math.min(255, data[1] || 0));
        const blue = Math.max(0, Math.min(255, data[2] || 0));
        const color = `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
        setNowPlayingSafeAreaColor(isDarkColor(color) ? color : "#14141c");
      } catch (_err) {
        setNowPlayingSafeAreaColor(getFallbackNowPlayingThemeColor());
      }
    };
    image.onerror = function () {
      if (token === audioState.nowPlayingThemeToken && audioState.nowPlayingOpen) {
        setNowPlayingSafeAreaColor(getFallbackNowPlayingThemeColor());
      }
    };
    image.src = url;
  }

  function applyNowPlayingThemeColor(artwork) {
    const artworkUrl = toAbsoluteUrlOrEmpty(artwork || "");
    if (audioState.nowPlayingThemeArtwork === artworkUrl && audioState.nowPlayingPreviousThemeColor) return;
    audioState.nowPlayingThemeArtwork = artworkUrl;
    if (!audioState.nowPlayingPreviousThemeColor) {
      audioState.nowPlayingPreviousThemeColor = getCurrentThemeColor();
    }
    const token = ++audioState.nowPlayingThemeToken;
    setNowPlayingSafeAreaColor(getFallbackNowPlayingThemeColor());
    extractImageThemeColor(artworkUrl, token);
  }

  function restoreNowPlayingThemeColor() {
    audioState.nowPlayingThemeToken += 1;
    audioState.nowPlayingThemeArtwork = "";
    clearNowPlayingSafeAreaColor();
    if (audioState.nowPlayingPreviousThemeColor) {
      setThemeColor(audioState.nowPlayingPreviousThemeColor);
      audioState.nowPlayingPreviousThemeColor = "";
    } else {
      syncPwaStatusColor();
    }
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getNowPlayingMiniRect() {
    const transport = audioState.transport;
    const source = transport && (transport.nowWrap || transport.root);
    if (!source || typeof source.getBoundingClientRect !== "function") return null;
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function cancelNowPlayingPanelAnimations(panel) {
    if (!panel || typeof panel.getAnimations !== "function") return;
    try {
      panel.getAnimations().forEach((animation) => animation.cancel());
    } catch (_err) {
      // Ignore animation cleanup failures.
    }
  }

  function animateNowPlayingPanel(direction, done) {
    const transport = audioState.transport;
    const panel = transport && transport.overlayPanel;
    if (!panel || typeof panel.animate !== "function") {
      if (typeof done === "function") done();
      return;
    }

    cancelNowPlayingPanelAnimations(panel);
    const panelRect = panel.getBoundingClientRect();
    const miniRect = getNowPlayingMiniRect() || audioState.nowPlayingMiniRect;
    const reduce = prefersReducedMotion();
    const fromFrame = { opacity: 0 };
    const toFrame = { opacity: 1 };

    if (!reduce && panelRect.width && panelRect.height && miniRect) {
      const panelCx = panelRect.left + panelRect.width / 2;
      const panelCy = panelRect.top + panelRect.height / 2;
      const miniCx = miniRect.left + miniRect.width / 2;
      const miniCy = miniRect.top + miniRect.height / 2;
      const scaleX = Math.max(0.18, Math.min(1, miniRect.width / panelRect.width));
      const scaleY = Math.max(0.08, Math.min(1, miniRect.height / panelRect.height));
      fromFrame.transform = `translate3d(${miniCx - panelCx}px, ${miniCy - panelCy}px, 0) scale(${scaleX}, ${scaleY})`;
      toFrame.transform = "translate3d(0, 0, 0) scale(1)";
      panel.style.transformOrigin = "center center";
    } else {
      fromFrame.transform = "translate3d(0, 10px, 0) scale(0.98)";
      toFrame.transform = "translate3d(0, 0, 0) scale(1)";
    }

    const keyframes = direction === "close" ? [toFrame, fromFrame] : [fromFrame, toFrame];
    const duration = reduce ? 160 : 360;
    const animation = panel.animate(keyframes, {
      duration,
      easing: reduce ? "ease-out" : "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "both"
    });
    let finalized = false;
    let fallbackTimer = 0;
    const finalize = function () {
      if (finalized) return;
      finalized = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      panel.style.transform = "";
      panel.style.opacity = "";
      panel.style.transformOrigin = "";
      if (typeof done === "function") done();
    };
    fallbackTimer = window.setTimeout(finalize, duration + 80);
    animation.onfinish = finalize;
    animation.oncancel = finalize;
  }

  function disableNowPlayingOverlayUi() {
    const wasOpen = Boolean(audioState.nowPlayingOpen);
    audioState.nowPlayingOpen = false;
    audioState.nowPlayingQueueOpen = false;
    audioState.nowPlayingClosing = false;
    audioState.nowPlayingMiniRect = null;
    restoreNowPlayingThemeColor();

    const transport = audioState.transport;
    if (transport && transport.overlay) {
      if (transport.overlayPanel) {
        cancelNowPlayingPanelAnimations(transport.overlayPanel);
        transport.overlayPanel.style.transform = "";
        transport.overlayPanel.style.opacity = "";
        transport.overlayPanel.style.transition = "";
        transport.overlayPanel.style.transformOrigin = "";
      }
      if (transport.overlayQueueSheet) {
        transport.overlayQueueSheet.hidden = true;
        transport.overlayQueueSheet.setAttribute("aria-hidden", "true");
      }
      if (transport.overlayQueue) {
        transport.overlayQueue.classList.remove("is-open");
      }
      if (transport.overlayQueueToggle) {
        transport.overlayQueueToggle.setAttribute("aria-expanded", "false");
      }
      transport.overlay.hidden = true;
    }

    const overlayEl = document.getElementById("infraNowPlayingOverlay");
    if (overlayEl) {
      overlayEl.hidden = true;
      overlayEl.setAttribute("aria-hidden", "true");
      overlayEl.style.display = "none";
      overlayEl.style.pointerEvents = "none";
    }

    document.body.classList.remove("now-playing-open");
    document.documentElement.classList.remove("now-playing-open");
    document.body.style.removeProperty("position");
    document.body.style.removeProperty("top");
    document.body.style.removeProperty("left");
    document.body.style.removeProperty("right");
    document.body.style.removeProperty("width");
    if (wasOpen && Number.isFinite(audioState.nowPlayingScrollY)) {
      window.scrollTo(0, audioState.nowPlayingScrollY);
    }
    syncTransportUi();
    scheduleDeferredServiceWorkerReload();
  }

  function openNowPlayingOverlay() {
    if (!NOW_PLAYING_OVERLAY_ENABLED) {
      disableNowPlayingOverlayUi();
      return;
    }
    const transport = audioState.transport;
    if (!transport || !transport.overlay) return;
    const canOpen = Boolean(
      getCurrentPlayableAudioSrc(audioState.audio) ||
      (audioState.playlist && audioState.playlist.length)
    );
    if (!canOpen) return;
    audioState.nowPlayingMiniRect = getNowPlayingMiniRect();
    audioState.nowPlayingScrollY = window.scrollY || window.pageYOffset || 0;
    audioState.nowPlayingOpen = true;
    audioState.nowPlayingClosing = false;
    transport.overlay.hidden = false;
    transport.overlay.removeAttribute("aria-hidden");
    transport.overlay.style.removeProperty("display");
    transport.overlay.style.removeProperty("pointer-events");
    if (transport.overlayPanel) {
      cancelNowPlayingPanelAnimations(transport.overlayPanel);
      transport.overlayPanel.scrollTop = 0;
      transport.overlayPanel.style.transform = "";
      transport.overlayPanel.style.opacity = "";
      transport.overlayPanel.style.transition = "";
      transport.overlayPanel.style.transformOrigin = "";
    }
    document.body.classList.add("now-playing-open");
    document.documentElement.classList.add("now-playing-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${audioState.nowPlayingScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    syncNowPlayingOverlay();
    requestAnimationFrame(function () {
      animateNowPlayingPanel("open");
    });
  }

  function closeNowPlayingOverlay() {
    if (!audioState.nowPlayingOpen || audioState.nowPlayingClosing) return;
    if (audioState.nowPlayingQueueOpen) {
      setNowPlayingQueueOpen(false);
    }
    audioState.nowPlayingClosing = true;
    animateNowPlayingPanel("close", function () {
      disableNowPlayingOverlayUi();
    });
  }

  function setNowPlayingQueueOpen(open) {
    const transport = audioState.transport;
    const shouldOpen = Boolean(open && transport && transport.overlayQueue && !transport.overlayQueue.hidden);
    audioState.nowPlayingQueueOpen = shouldOpen;
    if (!transport || !transport.overlayQueueSheet) return;
    if (transport.overlay) {
      transport.overlay.classList.toggle("is-queue-open", shouldOpen);
    }
    transport.overlayQueue.classList.toggle("is-open", shouldOpen);
    transport.overlayQueueSheet.hidden = !shouldOpen;
    transport.overlayQueueSheet.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    if (transport.overlayQueueToggle) {
      transport.overlayQueueToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    }
    if (shouldOpen) {
      syncNowPlayingQueue();
      requestAnimationFrame(function () {
        transport.overlayQueueSheet.classList.add("is-visible");
        if (transport.overlayQueueList) transport.overlayQueueList.scrollTop = 0;
      });
    } else {
      transport.overlayQueueSheet.classList.remove("is-visible");
    }
  }

  function syncNowPlayingOverlay() {
    if (!NOW_PLAYING_OVERLAY_ENABLED) {
      disableNowPlayingOverlayUi();
      return;
    }
    const transport = audioState.transport;
    if (!transport || !transport.overlay) return;

    const audio = audioState.audio;
    const track = getCurrentPlaylistTrack();
    const hasTrack = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const title = normalizeTrackTitle(track && track.name ? track.name : "") || (hasTrack ? "INFRA." : "Aucune lecture");
    const album = normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()) || "INFRA.";
    const albumHref = hasTrack ? getCurrentTrackAlbumPage(track) : "";
    const artwork = resolveCoverUrl(track, { width: 900 });
    const isRadioMode = audioState.homeMode === "radio";
    const canSkip = Boolean(audioState.playlist && audioState.playlist.length > 1);
    const shuffleActive = Boolean(audioState.shuffleOn && !isRadioMode);

    if (transport.overlayTitle) {
      transport.overlayTitle.textContent = title;
    }
    if (transport.overlayAlbum) {
      transport.overlayAlbum.textContent = album;
      transport.overlayAlbum.href = albumHref || "#";
      transport.overlayAlbum.classList.toggle("is-link", Boolean(albumHref));
      transport.overlayAlbum.setAttribute(
        "aria-label",
        albumHref ? "Ouvrir l'album du titre en lecture" : "Album en lecture"
      );
    }
    if (transport.overlayCover) {
      const coverToken = ++audioState.coverUpdateToken;
      setCoverWhenReady(transport.overlayCover, artwork, getMediaSessionFallbackArtwork(), coverToken);
      transport.overlayCover.alt = `Pochette ${album}`;
      if (transport.overlayBackdrop) {
        setCoverBackgroundStable(transport.overlayBackdrop, artwork, getMediaSessionFallbackArtwork(), coverToken);
      }
    }
    if (audioState.nowPlayingOpen && !audioState.nowPlayingClosing) {
      applyNowPlayingThemeColor(artwork);
    }
    syncCurrentFavoriteButtons();

    if (transport.overlayShuffle) {
      transport.overlayShuffle.disabled = !canSkip;
      transport.overlayShuffle.classList.toggle("is-on", shuffleActive);
      transport.overlayShuffle.classList.toggle("is-muted-active", Boolean(audioState.shuffleOn && isRadioMode));
      transport.overlayShuffle.setAttribute("aria-pressed", shuffleActive ? "true" : "false");
      transport.overlayShuffle.setAttribute(
        "aria-label",
        isRadioMode
          ? (audioState.shuffleOn ? "Shuffle memorise, ignore pendant la radio" : "Memoriser le shuffle album")
          : (shuffleActive ? "Desactiver le shuffle album" : "Activer le shuffle album")
      );
    }
    if (transport.overlayPrev) transport.overlayPrev.disabled = !canSkip;
    if (transport.overlayNext) transport.overlayNext.disabled = !canSkip;
    if (transport.overlayToggle) {
      const isPlaying = Boolean(audio && !audio.paused);
      transport.overlayToggle.classList.toggle("is-on", isPlaying);
      transport.overlayToggle.disabled = !Boolean(hasTrack || (audioState.playlist && audioState.playlist.length));
      transport.overlayToggle.setAttribute("aria-label", isPlaying ? "Pause" : "Lecture");
    }
    if (transport.overlayRadio) {
      transport.overlayRadio.disabled = false;
      transport.overlayRadio.classList.toggle("is-on", isRadioMode);
      transport.overlayRadio.setAttribute("aria-pressed", isRadioMode ? "true" : "false");
      transport.overlayRadio.setAttribute(
        "aria-label",
        isRadioMode
          ? "Desactiver la radio aleatoire"
          : "Activer la radio aleatoire"
      );
    }
    if (transport.overlayVolumeWrap) {
      transport.overlayVolumeWrap.hidden = isIosDevice() || !audioState.nowPlayingVolumeVisible;
    }
    if (transport.overlayVolumeToggle) {
      const volumeVisible = Boolean(!isIosDevice() && audioState.nowPlayingVolumeVisible);
      transport.overlayVolumeToggle.hidden = isIosDevice();
      transport.overlayVolumeToggle.classList.toggle("is-on", volumeVisible);
      transport.overlayVolumeToggle.setAttribute("aria-pressed", volumeVisible ? "true" : "false");
      transport.overlayVolumeToggle.setAttribute(
        "aria-label",
        volumeVisible ? "Masquer le volume" : "Afficher le volume"
      );
    }
    if (transport.overlayVolume && audio && !isIosDevice()) {
      const volume = Number.isFinite(audio.volume) ? audio.volume : 1;
      transport.overlayVolume.value = String(Math.max(0, Math.min(1, volume)));
    }

    syncNowPlayingQueue();
    syncNowPlayingOverlayProgress();
  }

  function syncNowPlayingQueue() {
    const transport = audioState.transport;
    if (!transport || !transport.overlayQueue || !transport.overlayQueueList) return;
    const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    const currentIndex = getCurrentPlaylistIndexSafe();
    const nextIndices = getQueuePreviewIndices(48);
    const indices = currentIndex >= 0 && currentIndex < list.length
      ? [currentIndex].concat(nextIndices.filter(function (index) { return index !== currentIndex; }))
      : nextIndices;
    const hasQueue = indices.length > 1;

    transport.overlayQueue.hidden = !hasQueue;
    transport.overlayQueueList.replaceChildren();
    if (transport.overlayQueueToggle) {
      transport.overlayQueueToggle.disabled = !hasQueue;
      transport.overlayQueueToggle.setAttribute("aria-expanded", audioState.nowPlayingQueueOpen && hasQueue ? "true" : "false");
    }
    if (transport.overlayQueueCount) {
      const count = Math.max(0, indices.length - 1);
      transport.overlayQueueCount.textContent = count > 0 ? String(count) : "";
      transport.overlayQueueCount.hidden = count <= 0;
    }

    if (!hasQueue || !list.length) {
      if (audioState.nowPlayingQueueOpen) setNowPlayingQueueOpen(false);
      return;
    }

    const fragment = document.createDocumentFragment();
    indices.forEach(function (index, position) {
      const sourceTrack = list[index];
      if (!sourceTrack) return;
      const track = mergeTrackMetadata(sourceTrack);
      const title = normalizeTrackTitle(track && track.name ? track.name : "") || `Titre ${index + 1}`;
      const album = normalizeAlbumTitle(track && track.album ? track.album : "");
      const meta = getTrackMetaByAssetPath(track && track.src ? track.src : "");
      const duration = String((track && track.duration) || getCachedTrackDuration(track && track.src ? track.src : "") || (meta && meta.duration) || "").trim() || "--:--";
      const artwork = normalizeArtworkUrl(
        (track && track.artwork) ||
        (meta && meta.artwork) ||
        getCurrentTrackArtwork(track) ||
        getMediaSessionFallbackArtwork()
      );
      const isCurrent = index === currentIndex;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "now-playing-up-next-item";
      item.classList.toggle("is-current", isCurrent);
      item.setAttribute("data-now-playing-queue-index", String(index));
      item.setAttribute("aria-label", isCurrent ? `En lecture ${title}` : `Lire ${title}`);
      if (isCurrent) item.setAttribute("aria-current", "true");
      if (!isCurrent) {
        item.draggable = true;
        item.setAttribute("data-now-playing-queue-draggable", "true");
        item.setAttribute("title", "Glisser pour réordonner À suivre");
      }

      const numberEl = document.createElement("span");
      numberEl.className = "now-playing-up-next-number";
      if (isCurrent) {
        numberEl.classList.add("now-playing-up-next-eq-wrap");
        numberEl.setAttribute("aria-hidden", "true");
        const eqEl = document.createElement("span");
        eqEl.className = "now-playing-up-next-eq";
        eqEl.setAttribute("aria-hidden", "true");
        for (let barIndex = 0; barIndex < 4; barIndex += 1) {
          eqEl.appendChild(document.createElement("span"));
        }
        numberEl.appendChild(eqEl);
      } else {
        numberEl.textContent = String(position).padStart(2, "0");
      }
      item.appendChild(numberEl);

      const thumbWrap = document.createElement("span");
      thumbWrap.className = "now-playing-up-next-thumb-wrap";

      const thumbEl = document.createElement("img");
      thumbEl.className = "now-playing-up-next-thumb";
      thumbEl.alt = "";
      thumbEl.decoding = "async";
      thumbEl.loading = position < 6 ? "eager" : "lazy";
      thumbEl.setAttribute("fetchpriority", position < 3 ? "high" : "low");
      thumbEl.src = artwork;
      thumbWrap.appendChild(thumbEl);
      item.appendChild(thumbWrap);

      const metaEl = document.createElement("span");
      metaEl.className = "now-playing-up-next-meta";

      const titleEl = document.createElement("span");
      titleEl.className = "now-playing-up-next-title";
      titleEl.textContent = title;
      metaEl.appendChild(titleEl);

      if (album) {
        const albumEl = document.createElement("span");
        albumEl.className = "now-playing-up-next-album";
        albumEl.textContent = album;
        metaEl.appendChild(albumEl);
      }
      item.appendChild(metaEl);

      const durationEl = document.createElement("span");
      durationEl.className = "now-playing-up-next-duration";
      durationEl.textContent = duration;
      item.appendChild(durationEl);

      fragment.appendChild(item);
    });

    transport.overlayQueueList.appendChild(fragment);
  }

  function syncNowPlayingOverlayProgress() {
    if (!NOW_PLAYING_OVERLAY_ENABLED) return;
    const transport = audioState.transport;
    if (!transport || !transport.overlay) return;

    const audio = audioState.audio;
    const hasSource = Boolean(audio && getCurrentPlayableAudioSrc(audio));
    const hasDuration = Boolean(
      !audioState.sourceMetadataPending &&
      audio &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    );
    const formatPlaybackTime = function (seconds) {
      return Number.isFinite(seconds) && seconds > 0 ? formatTrackDuration(seconds) : "0:00";
    };
    const currentValue = hasDuration ? formatPlaybackTime(audio.currentTime) : "0:00";
    const remainingValue = hasDuration
      ? `-${formatPlaybackTime(Math.max(0, audio.duration - audio.currentTime))}`
      : "-0:00";
    const percent = hasDuration ? Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) : 0;

    if (!audioState.nowPlayingSeeking) {
      if (transport.overlayCurrent) transport.overlayCurrent.textContent = currentValue;
      if (transport.overlayDuration) transport.overlayDuration.textContent = remainingValue;
      if (transport.overlayFill) transport.overlayFill.style.width = `${percent}%`;
    }
    if (transport.overlayProgress) transport.overlayProgress.disabled = !(hasSource && hasDuration);
  }

    return {
      readNowPlayingVolumeVisible: readNowPlayingVolumeVisible,
      persistNowPlayingVolumeVisible: persistNowPlayingVolumeVisible,
      setNowPlayingVolumeVisible: setNowPlayingVolumeVisible,
      toggleNowPlayingVolumeVisible: toggleNowPlayingVolumeVisible,
      getFallbackNowPlayingThemeColor: getFallbackNowPlayingThemeColor,
      extractImageThemeColor: extractImageThemeColor,
      applyNowPlayingThemeColor: applyNowPlayingThemeColor,
      restoreNowPlayingThemeColor: restoreNowPlayingThemeColor,
      prefersReducedMotion: prefersReducedMotion,
      getNowPlayingMiniRect: getNowPlayingMiniRect,
      cancelNowPlayingPanelAnimations: cancelNowPlayingPanelAnimations,
      animateNowPlayingPanel: animateNowPlayingPanel,
      disableNowPlayingOverlayUi: disableNowPlayingOverlayUi,
      openNowPlayingOverlay: openNowPlayingOverlay,
      closeNowPlayingOverlay: closeNowPlayingOverlay,
      setNowPlayingQueueOpen: setNowPlayingQueueOpen,
      syncNowPlayingOverlay: syncNowPlayingOverlay,
      syncNowPlayingQueue: syncNowPlayingQueue,
      syncNowPlayingOverlayProgress: syncNowPlayingOverlayProgress
    };
  }

  window.InfraNowPlaying = Object.assign(window.InfraNowPlaying || {}, {
    createNowPlaying: createNowPlaying
  });
})();
