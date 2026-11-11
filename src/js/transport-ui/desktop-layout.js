// Lecteur sur ordinateur : visualiseur, pochette, taille et position enregistrées, déplacement.
// Extrait de transport-ui.js (lot D, chantier JavaScript d'INFRA, 11/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createTransportUi() ; fonctions des autres modules : reliées par link().
export function createDesktopLayout(R) {
  const {
    DESKTOP_TRANSPORT_COVER_MIN_HEIGHT,
    DESKTOP_TRANSPORT_COVER_MIN_WIDTH,
    DESKTOP_TRANSPORT_DRAG_THRESHOLD,
    DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY,
    DESKTOP_TRANSPORT_MARGIN,
    DESKTOP_TRANSPORT_MIN_HEIGHT,
    DESKTOP_TRANSPORT_MIN_WIDTH,
    DESKTOP_TRANSPORT_STORAGE_KEY,
    audioState,
    audioVisualizerApi,
    getCurrentAlbumTitle,
    getCurrentPlaylistTrack,
    getMediaSessionFallbackArtwork,
    hasPlaybackSession,
    normalizeAlbumTitle,
    resolveCoverUrl,
    setCoverWhenReady,
    trackAudioRuntimeEvent
  } = R;
  let getTransportPictureInPictureDetachEdge,
    isDesktopTransportViewport,
    isDocumentPictureInPictureSupported,
    requestTransportPictureInPicture,
    setTransportPictureInPictureDetachHint;

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
    const availableWidth = Math.max(1, viewportWidth - DESKTOP_TRANSPORT_MARGIN * 2);
    const availableHeight = Math.max(1, viewportHeight - DESKTOP_TRANSPORT_MARGIN * 2);
    const minWidth = Math.min(DESKTOP_TRANSPORT_MIN_WIDTH, availableWidth);
    const minHeight = Math.min(DESKTOP_TRANSPORT_MIN_HEIGHT, availableHeight);
    const width = Math.min(availableWidth, Math.max(minWidth, Number(layout && layout.width) || minWidth));
    const height = Math.min(
      availableHeight,
      Math.max(minHeight, Number(layout && layout.height) || minHeight)
    );
    const maxX = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportWidth - DESKTOP_TRANSPORT_MARGIN - width);
    const maxY = Math.max(DESKTOP_TRANSPORT_MARGIN, viewportHeight - DESKTOP_TRANSPORT_MARGIN - height);
    return {
      x: Math.min(
        maxX,
        Math.max(DESKTOP_TRANSPORT_MARGIN, Number(layout && layout.x) || DESKTOP_TRANSPORT_MARGIN)
      ),
      y: Math.min(
        maxY,
        Math.max(DESKTOP_TRANSPORT_MARGIN, Number(layout && layout.y) || DESKTOP_TRANSPORT_MARGIN)
      ),
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
      x: Math.min(
        maxX,
        Math.max(DESKTOP_TRANSPORT_MARGIN, Number(position && position.x) || DESKTOP_TRANSPORT_MARGIN)
      ),
      y: Math.min(
        maxY,
        Math.max(DESKTOP_TRANSPORT_MARGIN, Number(position && position.y) || DESKTOP_TRANSPORT_MARGIN)
      )
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
    root.classList.remove(
      "has-custom-layout",
      "has-playback-session",
      "is-expanded",
      "is-desktop-dragging",
      "is-desktop-resizing"
    );
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
      state.layout && Number.isFinite(state.layout.width) && Number.isFinite(state.layout.height)
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
    const interactiveSelector =
      "button, a, input, textarea, select, [role='button'], [contenteditable='true'], [data-transport-mini-progress], [data-transport-resize]";

    function suppressNextTransportClick() {
      state.suppressClick = true;
      window.setTimeout(function () {
        state.suppressClick = false;
      }, 120);
    }

    function finishRootGesture(event, cancelled, allowDetach) {
      const gesture = state.gesture;
      if (!gesture || gesture.kind !== "drag") return;
      if (event && event.pointerId !== gesture.pointerId) return;
      const shouldDetach = Boolean(gesture.moved && gesture.detachArmed && !cancelled && allowDetach);
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
        try {
          root.setPointerCapture(event.pointerId);
        } catch (_err) {}
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
    window.addEventListener("pointerup", function (event) {
      finishRootGesture(event, false, true);
    });
    window.addEventListener("pointercancel", function (event) {
      finishRootGesture(event, true, false);
    });
    root.addEventListener("lostpointercapture", function (event) {
      finishRootGesture(event, false, false);
    });
    document.addEventListener(
      "click",
      function (event) {
        if (!state.suppressClick) return;
        state.suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );

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
        try {
          handle.setPointerCapture(event.pointerId);
        } catch (_err) {}
      });
      function handleResizeMove(event) {
        const gesture = state.gesture;
        if (
          !gesture ||
          gesture.kind !== "resize" ||
          gesture.handle !== handle ||
          gesture.pointerId !== event.pointerId
        )
          return;
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
          width = Math.min(
            gesture.rect.right - DESKTOP_TRANSPORT_MARGIN,
            Math.max(DESKTOP_TRANSPORT_MIN_WIDTH, gesture.rect.width - deltaX)
          );
          x = gesture.rect.right - width;
        } else if (edge.includes("e")) {
          width = Math.min(
            viewportWidth - DESKTOP_TRANSPORT_MARGIN - gesture.rect.left,
            Math.max(DESKTOP_TRANSPORT_MIN_WIDTH, gesture.rect.width + deltaX)
          );
        }
        if (edge.includes("n")) {
          height = Math.min(
            gesture.rect.bottom - DESKTOP_TRANSPORT_MARGIN,
            Math.max(DESKTOP_TRANSPORT_MIN_HEIGHT, gesture.rect.height - deltaY)
          );
          y = gesture.rect.bottom - height;
        } else if (edge.includes("s")) {
          height = Math.min(
            viewportHeight - DESKTOP_TRANSPORT_MARGIN - gesture.rect.top,
            Math.max(DESKTOP_TRANSPORT_MIN_HEIGHT, gesture.rect.height + deltaY)
          );
        }
        applyDesktopTransportLayout(root, { x, y, width, height }, false);
        event.preventDefault();
      }
      window.addEventListener("pointermove", handleResizeMove, { passive: false });
      window.addEventListener("pointerup", function (event) {
        finishResize(event, false);
      });
      window.addEventListener("pointercancel", function (event) {
        finishResize(event, true);
      });
      handle.addEventListener("lostpointercapture", function (event) {
        finishResize(event, false);
      });
    });
  }

  return {
    link() {
      ({
        getTransportPictureInPictureDetachEdge,
        isDesktopTransportViewport,
        isDocumentPictureInPictureSupported,
        requestTransportPictureInPicture,
        setTransportPictureInPictureDetachHint
      } = R);
    },
    fns: {
      ensureDesktopAudioVisualizer,
      getDesktopTransportState,
      clearSavedDesktopTransportLayout,
      readDesktopTransportLayout,
      writeDesktopTransportLayout,
      setTransportCoverVisible,
      ensureTransportCoverFrame,
      clampDesktopTransportLayout,
      clampDesktopTransportPosition,
      syncDesktopTransportCover,
      applyDesktopTransportLayout,
      applyDesktopTransportPosition,
      clearDesktopTransportInlineStyles,
      setTransportInteractionActive,
      syncDesktopTransportLayout,
      isDesktopTransportPointer,
      bindDesktopTransportUi
    }
  };
}
