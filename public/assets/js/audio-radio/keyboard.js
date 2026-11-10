// Raccourcis clavier (Espace, F7/F9, Échap…).
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createKeyboardShortcuts(R) {
  const { audioState, playNext, playPrevious } = R;
  let canStartInitialGlobalRandomPlayback,
    handleGlobalTransportToggle,
    hasPlaybackSession,
    toggleAlbumShuffleMode;

  function bindGlobalKeyboardShortcuts() {
    if (audioState.keyboardBound) return;
    document.addEventListener("keydown", function (event) {
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (event.target && event.target.isContentEditable);

      if (isTyping) return;

      const isDesktopKeyboard =
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
        window.matchMedia("(min-width: 900px)").matches;
      const hasQueue = Boolean(audioState.playlist && audioState.playlist.length > 1);
      const canTogglePlayback = Boolean(
        audioState.audio &&
        (canStartInitialGlobalRandomPlayback() ||
          hasPlaybackSession() ||
          (audioState.playlist && audioState.playlist.length) ||
          (document.body.classList.contains("album-screen") &&
            audioState.ui &&
            Array.isArray(audioState.ui.playlist) &&
            audioState.ui.playlist.length) ||
          (document.body.classList.contains("home-screen") && audioState.homeMode === "radio"))
      );

      if ((event.key === "F7" || event.key === "F9") && audioState.playlist.length) {
        event.preventDefault();
        playNext();
        return;
      }

      if (isDesktopKeyboard && event.key === " ") {
        if (!canTogglePlayback) return;
        event.preventDefault();
        handleGlobalTransportToggle();
        return;
      }

      if (isDesktopKeyboard && event.key === "ArrowRight") {
        if (!hasQueue) return;
        event.preventDefault();
        playNext();
        return;
      }

      if (isDesktopKeyboard && event.key === "ArrowLeft") {
        if (!hasQueue) return;
        event.preventDefault();
        playPrevious();
        return;
      }

      if (!document.body.classList.contains("album-screen")) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        playNext();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        playPrevious();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleAlbumShuffleMode();
      }
    });

    audioState.keyboardBound = true;
  }

  return {
    link() {
      ({
        canStartInitialGlobalRandomPlayback,
        handleGlobalTransportToggle,
        hasPlaybackSession,
        toggleAlbumShuffleMode
      } = R);
    },
    fns: { bindGlobalKeyboardShortcuts }
  };
}
