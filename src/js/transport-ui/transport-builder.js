// Construction de la barre de lecture et du grand lecteur, et leurs événements.
// Extrait de transport-ui.js (lot D, chantier JavaScript d'INFRA, 11/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createTransportUi() ; fonctions des autres modules : reliées par link().
export function createTransportBuilder(R) {
  const {
    HEART_ICON_OUTLINE,
    RADIO_ICON,
    SHUFFLE_ICON,
    audioState,
    bindGlobalKeyboardShortcuts,
    closeNowPlayingOverlay,
    formatTrackDuration,
    getMediaSessionFallbackArtwork,
    getSpaPersistRoot,
    handleGlobalTransportToggle,
    isIosDevice,
    movePlaylistItem,
    openNowPlayingOverlay,
    playNext,
    playPrevious,
    seekCurrentAudioToRatio,
    setNowPlayingQueueOpen,
    startTrack,
    syncNowPlayingOverlay,
    toggleAlbumShuffleMode,
    toggleCurrentFavorite,
    toggleNowPlayingVolumeVisible,
    togglePlayPause,
    toggleRadioModeFromTransport,
    trackAudioRuntimeEvent,
    updateProgressUi
  } = R;
  let bindDesktopTransportUi,
    bindMiniProgressSeek,
    ensureDesktopAudioVisualizer,
    ensureTransportCoverFrame,
    syncTransportUi;

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
        '<div class="global-transport-cover-frame" data-transport-cover-frame hidden>',
        '  <img class="global-transport-cover" data-transport-cover alt="" hidden decoding="async">',
        "</div>",
        '<div class="global-transport-now" data-transport-now hidden aria-live="polite">',
        '  <div class="global-transport-now-line global-transport-now-meta" data-transport-now-meta>',
        '    <span class="global-transport-now-title" data-transport-now-title></span>',
        '    <a class="global-transport-now-album" data-transport-now-album href="#" aria-label="Ouvrir l\'album en cours"></a>',
        "  </div>",
        '  <button class="global-transport-favorite" type="button" data-transport-favorite hidden aria-label="Ajouter aux favoris" aria-pressed="false">' +
          HEART_ICON_OUTLINE +
          "</button>",
        '  <div class="global-transport-now-mini" data-transport-mini hidden>',
        '    <span class="global-transport-mini-time" data-transport-mini-current>0:00</span>',
        '    <button class="global-transport-mini-progress" type="button" data-transport-mini-progress aria-label="Avancer dans le morceau">',
        '      <span class="global-transport-mini-fill" data-transport-mini-fill></span>',
        "    </button>",
        '    <span class="global-transport-mini-time" data-transport-mini-duration>0:00</span>',
        "  </div>",
        "</div>",
        '<div class="global-transport-controls">',
        '  <button class="global-transport-btn global-transport-mode" type="button" data-transport-mode aria-label="Activer la radio aleatoire">' +
          RADIO_ICON +
          "</button>",
        '  <div class="global-transport-main">',
        '    <button class="global-transport-btn" type="button" data-transport-prev aria-label="Piste precedente">',
        '      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h3v12H6zM10 12l10-6v12z"/></svg>',
        "    </button>",
        '    <button class="global-transport-btn" type="button" data-transport-toggle aria-label="Lecture">',
        '      <svg class="transport-icon transport-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
        '      <svg class="transport-icon transport-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
        "    </button>",
        '    <button class="global-transport-btn" type="button" data-transport-next aria-label="Piste suivante">',
        '      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 12L4 6v12zM18 6h3v12h-3z"/></svg>',
        "    </button>",
        "  </div>",
        '  <button class="global-transport-btn" type="button" data-transport-shuffle aria-label="Shuffle">',
        "    " + SHUFFLE_ICON,
        "  </button>",
        "</div>",
        '<span class="global-transport-resize global-transport-resize-nw" data-transport-resize="nw" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-ne" data-transport-resize="ne" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-sw" data-transport-resize="sw" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-se" data-transport-resize="se" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-n" data-transport-resize="n" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-e" data-transport-resize="e" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-s" data-transport-resize="s" aria-hidden="true"></span>',
        '<span class="global-transport-resize global-transport-resize-w" data-transport-resize="w" aria-hidden="true"></span>'
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
      !overlay.querySelector("[data-now-playing-volume]") ||
      !overlay.querySelector("[data-now-playing-side]");
    if (overlayNeedsRefresh) {
      if (overlay) overlay.remove();
      overlay = document.createElement("div");
      overlay.id = "infraNowPlayingOverlay";
      overlay.className = "now-playing-overlay";
      overlay.hidden = true;
      overlay.innerHTML = [
        '<div class="now-playing-backdrop" data-now-playing-backdrop aria-hidden="true"></div>',
        '<div class="now-playing-panel" data-now-playing-panel>',
        '  <button class="now-playing-close" type="button" data-now-playing-close aria-label="Fermer le lecteur">',
        '    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>',
        "  </button>",
        '  <div class="now-playing-swipe-zone" data-now-playing-swipe-zone>',
        '    <div class="now-playing-grab" aria-hidden="true"></div>',
        "  </div>",
        '  <div class="now-playing-cover-wrap">',
        `    <img class="now-playing-cover" data-now-playing-cover src="${getMediaSessionFallbackArtwork()}" alt="Pochette" loading="eager" decoding="async" fetchpriority="high" />`,
        "  </div>",
        // Maquette V19 (INFRA, 12/11/2026) : titre, barre et commandes d'un seul tenant, centrés sur la pochette
        // (ordinateur) ; sur téléphone ce bloc est neutre (display: contents).
        '  <div class="now-playing-side" data-now-playing-side>',
        '  <div class="now-playing-meta">',
        '    <div class="now-playing-meta-text">',
        '      <div class="now-playing-title" data-now-playing-title></div>',
        '      <a class="now-playing-album now-playing-album-link" data-now-playing-album href="#" aria-label="Ouvrir l\'album en lecture"></a>',
        "    </div>",
        '    <button class="now-playing-favorite" type="button" data-now-playing-favorite aria-label="Ajouter aux favoris" aria-pressed="false">',
        "      " + HEART_ICON_OUTLINE,
        "    </button>",
        "  </div>",
        '  <div class="now-playing-visual" data-now-playing-visual aria-hidden="true">',
        '    <canvas class="now-playing-visual-canvas" data-now-playing-visual-canvas></canvas>',
        "  </div>",
        '  <div class="now-playing-progress-wrap">',
        '    <button class="now-playing-progress" type="button" data-now-playing-progress aria-label="Avancer dans le morceau">',
        '      <span class="now-playing-progress-fill" data-now-playing-fill></span>',
        "    </button>",
        '    <div class="now-playing-times">',
        '      <span class="now-playing-time" data-now-playing-current>0:00</span>',
        '      <span class="now-playing-time" data-now-playing-duration>-0:00</span>',
        "    </div>",
        "  </div>",
        '  <div class="now-playing-controls">',
        '    <div class="now-playing-main-controls">',
        '      <button class="now-playing-btn now-playing-btn-aux now-playing-mode-btn" type="button" data-now-playing-shuffle aria-label="Activer le shuffle">',
        "        " +
          SHUFFLE_ICON.replace('class="shuffle-icon"', 'class="shuffle-icon now-playing-shuffle-icon"'),
        "      </button>",
        '      <button class="now-playing-btn now-playing-action-btn" type="button" data-now-playing-prev aria-label="Piste precedente">',
        '        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 6h3v12H6zM10 12l10-6v12z"/></svg>',
        "      </button>",
        '      <button class="now-playing-btn now-playing-btn-main" type="button" data-now-playing-toggle aria-label="Lecture">',
        '        <svg class="now-playing-icon now-playing-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
        '        <svg class="now-playing-icon now-playing-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
        "      </button>",
        '      <button class="now-playing-btn now-playing-action-btn" type="button" data-now-playing-next aria-label="Piste suivante">',
        '        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 12L4 6v12zM18 6h3v12h-3z"/></svg>',
        "      </button>",
        '      <button class="now-playing-btn now-playing-btn-aux now-playing-mode-btn" type="button" data-now-playing-radio aria-label="Activer la radio aleatoire">',
        "        " + RADIO_ICON.replace('class="radio-icon"', 'class="radio-icon now-playing-radio-icon"'),
        "      </button>",
        "    </div>",
        "  </div>",
        "  </div>",
        '  <section class="now-playing-up-next" data-now-playing-queue aria-label="Titres suivants">',
        '    <button class="now-playing-up-next-toggle" type="button" data-now-playing-queue-toggle aria-expanded="false">',
        "      <span>À suivre</span>",
        '      <span class="now-playing-up-next-count" data-now-playing-queue-count hidden></span>',
        "    </button>",
        "  </section>",
        '  <button class="now-playing-volume-toggle now-playing-btn now-playing-btn-aux" type="button" data-now-playing-volume-toggle aria-label="Afficher le volume">',
        '    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm11.5 1.1v3.8l2-1.9-2-1.9zM17 7.5l-1.4 1.4L18.7 12l-3.1 3.1L17 16.5l4.5-4.5L17 7.5z"/></svg>',
        "  </button>",
        '  <div class="now-playing-volume" data-now-playing-volume-wrap>',
        '    <span class="now-playing-volume-label">Volume</span>',
        '    <input class="now-playing-volume-range" data-now-playing-volume type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">',
        "  </div>",
        "</div>",
        '<div class="now-playing-queue-sheet" data-now-playing-queue-sheet hidden aria-hidden="true">',
        '  <div class="now-playing-queue-dim" data-now-playing-queue-close aria-hidden="true"></div>',
        '  <div class="now-playing-queue-panel" data-now-playing-queue-panel role="dialog" aria-label="À suivre">',
        '    <button class="now-playing-queue-handle" type="button" data-now-playing-queue-close aria-label="Fermer À suivre"><span aria-hidden="true"></span></button>',
        '    <div class="now-playing-queue-header">',
        "      <div>",
        '        <div class="now-playing-up-next-heading">À suivre</div>',
        '        <div class="now-playing-queue-subtitle">File de lecture</div>',
        "      </div>",
        '      <button class="now-playing-queue-close" type="button" data-now-playing-queue-close aria-label="Fermer À suivre">Fermer</button>',
        "    </div>",
        '    <div class="now-playing-up-next-list" data-now-playing-queue-list></div>',
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
              )
                return;
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
          return typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 641px)").matches;
        }

        function resetSwipeVisual() {
          overlayPanel.style.transform = "";
          overlayPanel.style.opacity = "";
          overlayPanel.style.transition = "";
          overlayPanel.style.willChange = "";
        }

        function isInteractiveTarget(target) {
          if (!target || !(target instanceof Element)) return false;
          return Boolean(
            target.closest(
              "button, a, input, textarea, select, [role='button'], [data-now-playing-progress], [data-now-playing-volume], [data-now-playing-queue], [data-now-playing-queue-sheet]"
            )
          );
        }

        function shouldStartSwipe(target) {
          if (!audioState.nowPlayingOpen) return false;
          if (audioState.nowPlayingClosing) return false;
          if (!target || !(target instanceof Element)) return false;
          if (target.closest("[data-now-playing-queue], [data-now-playing-queue-sheet]")) return false;
          if (isDesktopOverlayLayout()) {
            if (isInteractiveTarget(target)) return false;
            return Boolean(
              target.closest("[data-now-playing-panel]") || target.closest(".now-playing-overlay")
            );
          }
          if (target.closest("[data-now-playing-swipe-zone]")) return true;
          if (target.closest(".now-playing-cover-wrap")) return true;
          if (target.closest(".now-playing-title, .now-playing-album")) return true;
          if (isInteractiveTarget(target)) return false;
          if (overlayPanel.scrollTop > 2) return false;
          return Boolean(
            target.closest("[data-now-playing-panel]") || target.closest(".now-playing-overlay")
          );
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
          const scale = 1 - progress * 0.035;
          overlayPanel.style.transform = `translateY(${clamped}px) scale(${scale})`;
          overlayPanel.style.opacity = String(Math.max(0.48, 1 - progress * 1.15));
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
          if (!swipeActive || (event && swipeInput === "pointer" && event.pointerId !== swipePointerId))
            return;
          const elapsed = Math.max(1, Date.now() - swipeStartTs);
          const delta = swipeLastY - swipeStartY;
          const averageVelocity = delta / elapsed;
          const panelHeight = Math.max(1, overlayPanel.getBoundingClientRect().height);
          const shouldClose =
            delta > panelHeight * SWIPE_CLOSE_RATIO ||
            (delta > SWIPE_CLOSE_MIN_DELTA &&
              (swipeVelocity > SWIPE_CLOSE_VELOCITY || averageVelocity > SWIPE_CLOSE_VELOCITY));
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
            // Lâché : le lecteur part de là où le doigt l'a laissé et se réduit dans la barre
            // (même fermeture que le bouton, INFRA 09/11/2026).
            overlayPanel.style.transition = "";
            closeNowPlayingOverlay();
            return;
          }

          overlayPanel.style.transition =
            "transform 260ms cubic-bezier(0.2, 0.85, 0.18, 1), opacity 220ms ease-out";
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

        overlay.addEventListener(
          "touchstart",
          function (event) {
            if (!event.changedTouches || !event.changedTouches.length) return;
            const touch = event.changedTouches[0];
            if (!beginSwipe(event.target, touch.clientX, touch.clientY, null, "touch")) return;
            event.preventDefault();
          },
          { passive: false }
        );

        overlay.addEventListener(
          "touchmove",
          function (event) {
            if (swipeInput !== "touch" || !swipeActive) return;
            if (!event.changedTouches || !event.changedTouches.length) return;
            const touch = event.changedTouches[0];
            if (moveSwipe(touch.clientX, touch.clientY)) event.preventDefault();
          },
          { passive: false }
        );

        overlay.addEventListener(
          "touchend",
          function (event) {
            if (swipeInput !== "touch") return;
            if (event && typeof event.preventDefault === "function") event.preventDefault();
            endSwipe(null);
          },
          { passive: false }
        );

        overlay.addEventListener(
          "touchcancel",
          function () {
            if (swipeInput !== "touch") return;
            cancelSwipe();
          },
          { passive: false }
        );
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
          // Ordinateur (maquette V19) : « À suivre » est sous le lecteur ; le bouton y descend, un 2e clic remonte.
          if (overlay.classList.contains("is-queue-inline") && overlayPanel && overlayQueueSheet) {
            const target = Math.max(0, overlayQueueSheet.offsetTop - 66);
            const there = overlayPanel.scrollTop >= target - 4;
            const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            overlayPanel.scrollTo({ top: there ? 0 : target, behavior: reduce ? "auto" : "smooth" });
            return;
          }
          setNowPlayingQueueOpen(!audioState.nowPlayingQueueOpen);
        });
        if (overlayPanel) {
          overlayPanel.addEventListener(
            "scroll",
            function () {
              if (!overlay.classList.contains("is-queue-inline")) return;
              const target = overlayQueueSheet ? Math.max(0, overlayQueueSheet.offsetTop - 66) : Infinity;
              overlay.classList.toggle("is-scrolled", overlayPanel.scrollTop > 2);
              overlay.style.setProperty("--np-bar-shift", Math.min(45, overlayPanel.scrollTop) + "px");
              overlay.style.setProperty("--np-scroll", overlayPanel.scrollTop + "px");
              const atQueue = overlayPanel.scrollTop >= target - 4;
              overlay.classList.toggle("is-at-queue", atQueue);
              overlayQueueToggle.setAttribute("aria-pressed", atQueue ? "true" : "false");
            },
            { passive: true }
          );
        }
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
          if (!target.closest(".now-playing-queue-handle") && !target.closest(".now-playing-queue-header"))
            return;
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
          const progress = Math.max(
            0,
            Math.min(1, clamped / Math.max(1, overlayQueuePanel.getBoundingClientRect().height))
          );
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
            overlayQueuePanel.style.transition =
              "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out";
            overlayQueuePanel.style.transform = "translateY(110%)";
            overlayQueuePanel.style.opacity = "0";
            setTimeout(function () {
              resetQueueSwipeVisual();
              setNowPlayingQueueOpen(false);
            }, 210);
            return;
          }
          overlayQueuePanel.style.transition =
            "transform 240ms cubic-bezier(0.2, 0.85, 0.18, 1), opacity 180ms ease-out";
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
        let queueFinalizingGesture = null;

        function queueTelemetryToken(input) {
          return `queue-${String(input || "input")}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        }

        function queueReducedMotion() {
          return (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          );
        }

        const QUEUE_FLIP_DURATION_MS = 170;
        const QUEUE_FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

        function getQueueRows() {
          return Array.from(overlayQueueList.querySelectorAll("[data-now-playing-queue-index]"));
        }

        function getQueueRowKey(row) {
          return String((row && row.getAttribute("data-now-playing-queue-key")) || "");
        }

        function captureQueueBaseGeometry(gesture) {
          if (!gesture) return;
          gesture.baseScrollTop = Math.max(0, Number(overlayQueueList.scrollTop) || 0);
          gesture.baseGeometry = getQueueRows().map(function (row) {
            return {
              row,
              key: getQueueRowKey(row),
              index: Number(row.getAttribute("data-now-playing-queue-index")),
              current: row.classList.contains("is-current"),
              rect: row.getBoundingClientRect()
            };
          });
          gesture.layoutHitTest = true;
        }

        function captureQueuePreviewRects(gesture) {
          const rects = new Map();
          if (!gesture) return rects;
          getQueueRows().forEach(function (row) {
            const key = getQueueRowKey(row);
            if (!key) return;
            const rect = row.getBoundingClientRect();
            rects.set(key, {
              left: rect.left,
              top: rect.top
            });
          });
          return rects;
        }

        function queuePreviewDropKey(drop) {
          if (!drop) return "";
          return `${Number(drop.index)}:${drop.after ? "after" : "before"}`;
        }

        function stopQueuePreviewAnimations(gesture) {
          if (!gesture) return;
          gesture.flipGeneration = Number(gesture.flipGeneration || 0) + 1;
          gesture.previewTransitionInFlight = false;
          gesture.pendingPreviewDrop = null;
          gesture.previewAnimations = new Map();
          gesture.previewShifts = new Map();
          getQueueRows().forEach(function (row) {
            row.style.removeProperty("transform");
            row.style.removeProperty("transition");
            row.style.removeProperty("will-change");
          });
        }

        function animateQueuePreview(gesture, drop) {
          if (!gesture || !gesture.activated || !drop || !drop.item) return;
          const dropKey = queuePreviewDropKey(drop);
          if (gesture.previewTransitionInFlight) {
            gesture.pendingPreviewDrop = {
              index: drop.index,
              after: Boolean(drop.after),
              item: drop.item,
              midpoint: drop.midpoint
            };
            return;
          }
          if (dropKey && dropKey === gesture.lastAppliedPreviewKey) return;
          if (queueReducedMotion()) {
            stopQueuePreviewAnimations(gesture);
            gesture.shiftedRowCount = 0;
            gesture.lastAppliedPreviewKey = dropKey;
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

          const sourceEntry = Array.isArray(gesture.baseGeometry)
            ? gesture.baseGeometry.find(function (entry) {
                return entry.row === rows[sourcePosition];
              })
            : null;
          const sourceRect =
            sourceEntry && sourceEntry.rect ? sourceEntry.rect : rows[sourcePosition].getBoundingClientRect();
          const shiftDistance = Math.max(1, sourceRect.height);
          const desired = new Map();
          if (finalPosition > sourcePosition) {
            for (let position = sourcePosition + 1; position <= finalPosition; position += 1) {
              if (!rows[position].classList.contains("is-current"))
                desired.set(rows[position], -shiftDistance);
            }
          } else if (finalPosition < sourcePosition) {
            for (let position = finalPosition; position < sourcePosition; position += 1) {
              if (!rows[position].classList.contains("is-current"))
                desired.set(rows[position], shiftDistance);
            }
          }

          gesture.previewTargetChangeCount = Number(gesture.previewTargetChangeCount || 0) + 1;
          gesture.lastAppliedPreviewKey = dropKey;
          gesture.previewTransitionInFlight = true;
          gesture.maxConcurrentAnimationCount = Math.max(
            Number(gesture.maxConcurrentAnimationCount || 0),
            desired.size
          );
          gesture.previewShifts = new Map();
          rows.forEach(function (row) {
            if (row === rows[sourcePosition]) return;
            const shift = desired.get(row) || 0;
            const toTransform = shift ? `translateY(${Math.round(shift)}px)` : "none";
            row.style.transition = `transform ${QUEUE_FLIP_DURATION_MS}ms ${QUEUE_FLIP_EASING}`;
            row.style.willChange = shift ? "transform" : "auto";
            row.style.transform = toTransform;
            const key = getQueueRowKey(row);
            if (key) gesture.previewShifts.set(key, shift);
          });
          gesture.shiftedRowCount = desired.size;
          gesture.flipGeneration = Number(gesture.flipGeneration || 0) + 1;
          const generation = gesture.flipGeneration;
          gesture.flipStarted = desired.size > 0;
          gesture.flipFinished = desired.size === 0;
          gesture.flipAnimationCount = Number(gesture.flipAnimationCount || 0) + desired.size;
          emitQueueReorder(gesture, { result: "preview", handler_state: "active" });
          function finishPreviewTransition() {
            if (gesture.finished || gesture.flipGeneration !== generation) return;
            gesture.previewTransitionInFlight = false;
            gesture.flipFinished = true;
            emitQueueReorder(gesture, { result: "preview", handler_state: "active" });
            const pending = gesture.pendingPreviewDrop;
            gesture.pendingPreviewDrop = null;
            if (pending && queuePreviewDropKey(pending) !== gesture.lastAppliedPreviewKey) {
              animateQueuePreview(gesture, pending);
            }
          }
          window.requestAnimationFrame(function () {
            if (gesture.finished || gesture.flipGeneration !== generation) return;
            const animations = rows.flatMap(function (row) {
              if (typeof row.getAnimations !== "function") return [];
              return row.getAnimations().filter(function (animation) {
                return (
                  !animation.effect ||
                  !animation.effect.getKeyframes ||
                  animation.effect.getKeyframes().some(function (frame) {
                    return frame.transform !== undefined;
                  })
                );
              });
            });
            if (!animations.length) {
              finishPreviewTransition();
              return;
            }
            gesture.maxConcurrentAnimationCount = Math.max(
              Number(gesture.maxConcurrentAnimationCount || 0),
              animations.length
            );
            Promise.all(
              animations.map(function (animation) {
                return Promise.resolve(animation.finished).catch(function () {});
              })
            ).then(function () {
              finishPreviewTransition();
            });
          });
        }

        function animateQueueFinalFlip(gesture, beforeRects) {
          if (!gesture || !(beforeRects instanceof Map) || queueReducedMotion()) {
            if (gesture) gesture.flipFinished = true;
            return Promise.resolve();
          }
          return new Promise(function (resolve) {
            window.requestAnimationFrame(function () {
              const animations = [];
              getQueueRows().forEach(function (row) {
                if (
                  row.classList.contains("is-current") ||
                  row.classList.contains("is-dragging") ||
                  typeof row.animate !== "function"
                )
                  return;
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
                  { duration: QUEUE_FLIP_DURATION_MS, easing: QUEUE_FLIP_EASING, fill: "none" }
                );
                animations.push(
                  Promise.resolve(animation.finished)
                    .catch(function () {})
                    .then(function () {
                      try {
                        animation.cancel();
                      } catch (_err) {}
                    })
                );
              });
              if (!animations.length) {
                gesture.flipFinished = true;
                emitQueueReorder(gesture, { result: "committed", handler_state: "finished" });
                resolve();
                return;
              }
              gesture.flipStarted = true;
              gesture.flipFinished = false;
              gesture.flipAnimationCount = Number(gesture.flipAnimationCount || 0) + animations.length;
              emitQueueReorder(gesture, { result: "committed", handler_state: "final_flip" });
              Promise.all(animations).then(function () {
                gesture.flipFinished = true;
                emitQueueReorder(gesture, { result: "committed", handler_state: "finished" });
                resolve();
              });
            });
          });
        }

        function emitQueueReorder(gesture, details) {
          if (!gesture || !gesture.telemetryToken) return;
          const detailRecord = details || {};
          if (!gesture.telemetryStarted && detailRecord.result !== "activated") return;
          gesture.telemetryStarted = true;
          const targetIndex = Number.isInteger(gesture.targetIndex) ? gesture.targetIndex : gesture.index;
          trackAudioRuntimeEvent(
            "queue_reorder",
            Object.assign(
              {
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
                preview_target_change_count: Math.max(0, Number(gesture.previewTargetChangeCount) || 0),
                preview_animation_restart_count: Math.max(
                  0,
                  Number(gesture.previewAnimationRestartCount) || 0
                ),
                max_concurrent_animation_count: Math.max(0, Number(gesture.maxConcurrentAnimationCount) || 0),
                layout_hit_test: gesture.layoutHitTest === true,
                source_hidden_while_ghost: gesture.sourceHiddenWhileGhost === true,
                reduced_motion: queueReducedMotion()
              },
              detailRecord
            )
          );
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
          overlayQueueList
            .querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after")
            .forEach(function (node) {
              node.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
              node.removeAttribute("aria-grabbed");
              node.style.removeProperty("transform");
              node.style.removeProperty("transition");
              node.style.removeProperty("will-change");
            });
        }

        function hideCommittedQueueSource(gesture) {
          if (!gesture) return;
          const committedIndex =
            gesture.movingTrack && Array.isArray(audioState.playlist)
              ? audioState.playlist.indexOf(gesture.movingTrack)
              : -1;
          const committedSource = getQueueRows().find(function (row) {
            return (
              (committedIndex >= 0 &&
                Number(row.getAttribute("data-now-playing-queue-index")) === committedIndex) ||
              (gesture.sourceKey && getQueueRowKey(row) === gesture.sourceKey)
            );
          });
          if (!committedSource || committedSource.classList.contains("is-current")) return;
          committedSource.classList.add("is-dragging");
          committedSource.setAttribute("aria-grabbed", "true");
          gesture.committedSource = committedSource;
          gesture.sourceHiddenWhileGhost = true;
        }

        function finishQueueReorderVisuals(gesture, options) {
          if (!gesture) return;
          if (gesture.ghost && gesture.ghost.parentNode) gesture.ghost.parentNode.removeChild(gesture.ghost);
          [gesture.item, gesture.committedSource].forEach(function (row) {
            if (!row) return;
            row.classList.remove("is-dragging");
            row.removeAttribute("aria-grabbed");
            row.style.removeProperty("transform");
            row.style.removeProperty("transition");
            row.style.removeProperty("will-change");
          });
          if (queueFinalizingGesture === gesture) queueFinalizingGesture = null;
          clearQueueDragState(options);
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

        function resolveQueueDropAt(clientX, clientY, gesture) {
          const activeGesture = gesture || queuePressGesture || queueMouseTelemetry;
          const geometry =
            activeGesture && Array.isArray(activeGesture.baseGeometry)
              ? activeGesture.baseGeometry
              : getQueueRows().map(function (row) {
                  return {
                    row,
                    index: Number(row.getAttribute("data-now-playing-queue-index")),
                    current: row.classList.contains("is-current"),
                    rect: row.getBoundingClientRect()
                  };
                });
          if (!geometry.length) return null;
          const listRect = overlayQueueList.getBoundingClientRect();
          if (Number.isFinite(clientX) && (clientX < listRect.left - 72 || clientX > listRect.right + 72)) {
            return null;
          }

          const scrollDelta = activeGesture
            ? (Number(overlayQueueList.scrollTop) || 0) - Number(activeGesture.baseScrollTop || 0)
            : 0;
          let resolved = null;
          for (const entry of geometry) {
            const item = entry.row;
            const index = Number(entry.index);
            if (!Number.isInteger(index)) continue;
            const rect = entry.rect;
            const top = rect.top - scrollDelta;
            const bottom = rect.bottom - scrollDelta;
            if (clientY > bottom) continue;
            const midpoint = top + rect.height / 2;
            resolved = {
              index,
              after: entry.current || clientY > midpoint,
              item,
              midpoint
            };
            break;
          }
          if (!resolved) {
            const entry = geometry[geometry.length - 1];
            resolved = Number.isInteger(entry.index)
              ? {
                  index: entry.index,
                  after: true,
                  item: entry.row,
                  midpoint: entry.rect.bottom - scrollDelta
                }
              : null;
          }
          if (
            resolved &&
            activeGesture &&
            activeGesture.lastResolvedDrop &&
            (activeGesture.lastResolvedDrop.index !== resolved.index ||
              activeGesture.lastResolvedDrop.after !== resolved.after) &&
            Math.abs(clientY - resolved.midpoint) < 10
          ) {
            return activeGesture.lastResolvedDrop;
          }
          if (resolved && activeGesture) {
            activeGesture.lastResolvedDrop = {
              index: resolved.index,
              after: resolved.after,
              item: resolved.item,
              midpoint: resolved.midpoint
            };
          }
          return resolved;
        }

        function resolveQueueDrop(event) {
          return resolveQueueDropAt(event.clientX, event.clientY, queuePressGesture || queueMouseTelemetry);
        }

        function previewQueueDrop(clientX, clientY) {
          const drop = resolveQueueDropAt(clientX, clientY, queuePressGesture || queueMouseTelemetry);
          clearQueueDropIndicators();
          if (drop && drop.item) {
            drop.item.classList.add(drop.after ? "is-drop-after" : "is-drop-before");
          }
          if (
            queuePressGesture &&
            drop &&
            (queuePressGesture.targetIndex !== drop.index ||
              queuePressGesture.targetAfter !== Boolean(drop.after))
          ) {
            queuePressGesture.targetIndex = drop.index;
            queuePressGesture.targetAfter = Boolean(drop.after);
            animateQueuePreview(queuePressGesture, drop);
            emitQueueReorder(queuePressGesture, {
              result: "preview",
              handler_state: "active"
            });
          }
          if (
            queueMouseTelemetry &&
            drop &&
            (queueMouseTelemetry.targetIndex !== drop.index ||
              queueMouseTelemetry.targetAfter !== Boolean(drop.after))
          ) {
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
            const ratio = Math.max(
              0,
              Math.min(1, (rect.top + QUEUE_AUTO_SCROLL_EDGE_PX - clientY) / QUEUE_AUTO_SCROLL_EDGE_PX)
            );
            velocity = -Math.max(3, QUEUE_AUTO_SCROLL_MAX_PX * ratio);
          } else if (clientY > rect.bottom - QUEUE_AUTO_SCROLL_EDGE_PX) {
            const ratio = Math.max(
              0,
              Math.min(1, (clientY - (rect.bottom - QUEUE_AUTO_SCROLL_EDGE_PX)) / QUEUE_AUTO_SCROLL_EDGE_PX)
            );
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
          gesture.sourceKey = getQueueRowKey(gesture.item);
          gesture.sourceHiddenWhileGhost = true;
          captureQueueBaseGeometry(gesture);
          document.body.appendChild(ghost);
          if (queueReducedMotion()) {
            gesture.liftFinished = true;
          } else if (typeof ghost.getAnimations === "function") {
            const liftAnimations = ghost.getAnimations();
            if (liftAnimations.length) {
              Promise.all(
                liftAnimations.map(function (animation) {
                  return Promise.resolve(animation.finished).catch(function () {});
                })
              ).then(function () {
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
            try {
              gesture.item.setPointerCapture(gesture.pointerId);
            } catch (_err) {}
          }
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(10);
            } catch (_err) {}
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
            previewShifts: new Map(),
            previewTargetChangeCount: 0,
            previewAnimationRestartCount: 0,
            previewTransitionInFlight: false,
            pendingPreviewDrop: null,
            lastAppliedPreviewKey: "",
            maxConcurrentAnimationCount: 0,
            baseGeometry: [],
            baseScrollTop: 0,
            layoutHitTest: false,
            sourceHiddenWhileGhost: false,
            movingTrack: Array.isArray(audioState.playlist) ? audioState.playlist[index] : null,
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
            if (
              Math.hypot(clientX - gesture.startX, clientY - gesture.startY) > QUEUE_PRESS_MOVE_TOLERANCE_PX
            ) {
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
          const drop = activated && commit ? resolveQueueDropAt(gesture.lastX, gesture.lastY, gesture) : null;
          window.clearTimeout(gesture.timer);
          cancelQueueAutoScroll();
          gesture.finished = true;
          const beforeRects = drop ? captureQueuePreviewRects(gesture) : null;
          stopQueuePreviewAnimations(gesture);
          if (
            gesture.input === "pointer" &&
            typeof gesture.item.hasPointerCapture === "function" &&
            gesture.item.hasPointerCapture(gesture.pointerId)
          ) {
            try {
              gesture.item.releasePointerCapture(gesture.pointerId);
            } catch (_err) {}
          }
          queuePressGesture = null;
          clearQueueDropIndicators();
          let moved = false;
          if (drop) moved = movePlaylistItem(fromIndex, drop.index, { after: drop.after }) !== false;
          gesture.targetIndex = drop ? drop.index : fromIndex;
          if (drop && moved) {
            queueFinalizingGesture = gesture;
            hideCommittedQueueSource(gesture);
            animateQueueFinalFlip(gesture, beforeRects).then(function () {
              finishQueueReorderVisuals(gesture, { suppressClick: true });
            });
          } else {
            finishQueueReorderVisuals(gesture, { suppressClick: activated });
          }
          emitQueueReorder(gesture, {
            target_index: drop ? drop.index : fromIndex,
            result: drop && moved ? "committed" : "cancelled",
            cancel_reason: drop && moved ? "" : activated ? "invalid_drop" : "hold_cancelled",
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
            previewShifts: new Map(),
            previewTargetChangeCount: 0,
            previewAnimationRestartCount: 0,
            previewTransitionInFlight: false,
            pendingPreviewDrop: null,
            lastAppliedPreviewKey: "",
            maxConcurrentAnimationCount: 0,
            baseGeometry: [],
            baseScrollTop: 0,
            layoutHitTest: false,
            sourceHiddenWhileGhost: false,
            sourceKey: getQueueRowKey(item),
            movingTrack: Array.isArray(audioState.playlist) ? audioState.playlist[index] : null,
            committed: false,
            telemetryStarted: false
          };
          captureQueueBaseGeometry(queueMouseTelemetry);
          emitQueueReorder(queueMouseTelemetry, {
            result: "activated",
            handler_state: "active",
            ghost_created: false,
            lift_animated: false
          });
          item.classList.add("is-dragging");
          item.setAttribute("aria-grabbed", "true");
          queueMouseTelemetry.sourceHiddenWhileGhost = true;
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
          const gesture = queueMouseTelemetry;
          const beforeRects = captureQueuePreviewRects(queueMouseTelemetry);
          stopQueuePreviewAnimations(queueMouseTelemetry);
          const moved = movePlaylistItem(queueDragIndex, drop.index, { after: drop.after }) !== false;
          if (gesture) {
            gesture.targetIndex = drop.index;
            gesture.committed = moved;
            if (moved) {
              queueFinalizingGesture = gesture;
              hideCommittedQueueSource(gesture);
            }
            emitQueueReorder(gesture, {
              result: moved ? "committed" : "cancelled",
              cancel_reason: moved ? "" : "move_rejected",
              handler_state: "finished"
            });
          }
          queueMouseTelemetry = null;
          if (moved && gesture) {
            animateQueueFinalFlip(gesture, beforeRects).then(function () {
              finishQueueReorderVisuals(gesture, { suppressClick: true });
            });
          } else {
            finishQueueReorderVisuals(gesture, { suppressClick: true });
          }
        });

        overlayQueueList.addEventListener("dragend", function () {
          if (queueFinalizingGesture && queueFinalizingGesture.input === "mouse") return;
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

        overlayQueueList.addEventListener(
          "touchstart",
          function (event) {
            if (
              !event.touches ||
              event.touches.length !== 1 ||
              !event.changedTouches ||
              !event.changedTouches.length
            )
              return;
            const item = getQueueDragItem(event.target);
            const index = getQueueReorderIndex(item);
            if (!Number.isInteger(index)) return;
            const touch = event.changedTouches[0];
            beginQueuePress(item, index, touch.clientX, touch.clientY, {
              input: "touch",
              identifier: touch.identifier
            });
          },
          { passive: true }
        );

        overlayQueueList.addEventListener(
          "touchmove",
          function (event) {
            const gesture = queuePressGesture;
            if (!gesture || gesture.input !== "touch") return;
            const touch = findTouch(event.touches, gesture.identifier);
            if (!touch) return;
            if (moveQueuePress(touch.clientX, touch.clientY)) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
          { passive: false }
        );

        overlayQueueList.addEventListener(
          "touchend",
          function (event) {
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
          },
          { passive: false }
        );

        overlayQueueList.addEventListener(
          "touchcancel",
          function (event) {
            const gesture = queuePressGesture;
            if (!gesture || gesture.input !== "touch") return;
            if (!findTouch(event.changedTouches, gesture.identifier)) return;
            const activated = gesture.activated;
            if (activated) event.preventDefault();
            finishQueuePress(false);
          },
          { passive: false }
        );

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
          if (overlayDuration)
            overlayDuration.textContent = `-${formatTrackDuration(Math.max(0, audio.duration - previewTime))}`;
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
        bindMiniProgressSeek(miniProgress, miniFill, miniCurrent, miniDuration);
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

  return {
    link() {
      ({
        bindDesktopTransportUi,
        bindMiniProgressSeek,
        ensureDesktopAudioVisualizer,
        ensureTransportCoverFrame,
        syncTransportUi
      } = R);
    },
    fns: { ensureGlobalTransportUi }
  };
}
