// Barre de progression du mini-lecteur (glisser pour avancer) et petits tests d'affichage.
// Extrait de transport-ui.js (lot D, chantier JavaScript d'INFRA, 11/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createTransportUi() ; fonctions des autres modules : reliées par link().
export function createMiniProgress(R) {
  const {
    audioState,
    formatTrackDuration,
    getCurrentPlayableAudioSrc,
    seekCurrentAudioToRatio,
    trackAudioRuntimeEvent,
    updateProgressUi
  } = R;

  function bindMiniProgressSeek(miniProgress, miniFill, miniCurrent, miniDuration) {
    if (!miniProgress || (miniProgress.dataset && miniProgress.dataset.seekBound === "1")) return;

    let miniSeeking = false;
    let miniSeekPointerId = null;
    let miniSeekRatio = 0;
    let miniSeekFromMs = 0;
    let miniSeekInputType = "pointer";

    function getMiniProgressRatio(clientX) {
      const bounds = miniProgress.getBoundingClientRect();
      if (!bounds.width || miniProgress.disabled) return null;
      const ratio = (clientX - bounds.left) / bounds.width;
      return Math.max(0, Math.min(1, ratio));
    }

    function previewMiniSeek(ratio) {
      const audio = audioState.audio;
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return false;
      miniSeekRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
      const previewTime = miniSeekRatio * audio.duration;
      if (miniFill) miniFill.style.width = `${miniSeekRatio * 100}%`;
      if (miniCurrent) miniCurrent.textContent = formatTrackDuration(previewTime);
      if (miniDuration) miniDuration.textContent = formatTrackDuration(audio.duration);
      return true;
    }

    function releaseMiniPointerCapture(pointerId) {
      if (pointerId === null || typeof miniProgress.releasePointerCapture !== "function") return;
      try {
        miniProgress.releasePointerCapture(pointerId);
      } catch (_err) {
        // Ignore release errors after Android cancels a captured gesture.
      }
    }

    miniProgress.addEventListener("pointerdown", function (event) {
      const ratio = getMiniProgressRatio(event.clientX);
      if (ratio === null || !previewMiniSeek(ratio)) return;
      event.preventDefault();
      event.stopPropagation();
      miniSeeking = true;
      miniSeekPointerId = event.pointerId;
      miniSeekFromMs = Math.max(0, Math.floor((Number(audioState.audio.currentTime) || 0) * 1000));
      miniSeekInputType = String(event.pointerType || "pointer");
      audioState.miniPlayerSeeking = true;
      if (typeof miniProgress.setPointerCapture === "function") {
        try {
          miniProgress.setPointerCapture(event.pointerId);
        } catch (_err) {
          // The window-level listeners still finish the gesture.
        }
      }
    });

    function moveMiniSeeking(event) {
      if (!miniSeeking) return;
      if (miniSeekPointerId !== null && event.pointerId !== miniSeekPointerId) return;
      const ratio = getMiniProgressRatio(event.clientX);
      if (ratio === null) return;
      event.preventDefault();
      event.stopPropagation();
      previewMiniSeek(ratio);
    }

    function finishMiniSeeking(event) {
      if (!miniSeeking) return;
      if (event && miniSeekPointerId !== null && event.pointerId !== miniSeekPointerId) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        const ratio = getMiniProgressRatio(event.clientX);
        if (ratio !== null) previewMiniSeek(ratio);
      }
      const pointerId = miniSeekPointerId;
      miniSeeking = false;
      miniSeekPointerId = null;
      audioState.miniPlayerSeeking = false;
      releaseMiniPointerCapture(pointerId);
      seekCurrentAudioToRatio(miniSeekRatio);
      const duration = Number(audioState.audio && audioState.audio.duration);
      trackAudioRuntimeEvent("seek_gesture", {
        surface: "mini",
        phase: "commit",
        result: "committed",
        input_type: miniSeekInputType,
        from_ms: miniSeekFromMs,
        to_ms: Number.isFinite(duration) ? Math.max(0, Math.floor(miniSeekRatio * duration * 1000)) : 0
      });
      updateProgressUi();
    }

    function cancelMiniSeeking(event) {
      if (!miniSeeking) return;
      if (event && miniSeekPointerId !== null && event.pointerId !== miniSeekPointerId) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const pointerId = miniSeekPointerId;
      miniSeeking = false;
      miniSeekPointerId = null;
      audioState.miniPlayerSeeking = false;
      releaseMiniPointerCapture(pointerId);
      const duration = Number(audioState.audio && audioState.audio.duration);
      trackAudioRuntimeEvent("seek_gesture", {
        surface: "mini",
        phase: "cancel",
        result: "cancelled",
        input_type: miniSeekInputType,
        from_ms: miniSeekFromMs,
        to_ms: Number.isFinite(duration) ? Math.max(0, Math.floor(miniSeekRatio * duration * 1000)) : 0
      });
      updateProgressUi();
    }

    miniProgress.addEventListener("pointermove", moveMiniSeeking);
    miniProgress.addEventListener("pointerup", finishMiniSeeking);
    miniProgress.addEventListener("pointercancel", cancelMiniSeeking);
    miniProgress.addEventListener("lostpointercapture", cancelMiniSeeking);
    window.addEventListener("pointermove", moveMiniSeeking, { passive: false });
    window.addEventListener("pointerup", finishMiniSeeking, { passive: false });
    window.addEventListener("pointercancel", cancelMiniSeeking, { passive: false });
    if (miniProgress.dataset) miniProgress.dataset.seekBound = "1";
  }

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

  return {
    link() {},
    fns: { bindMiniProgressSeek, isDesktopTransportViewport, canStartCurrentPageCollectionFromIdle }
  };
}
