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

  function createAlbumPlayerUi(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime || { baseUrl: window.location.href };
    const PLAYER_ICON_PLAY = ctx.PLAYER_ICON_PLAY || "";
    const PLAYER_ICON_STOP = ctx.PLAYER_ICON_STOP || "";
    const TRACK_CLICK_COOLDOWN_MS = Number.isFinite(Number(ctx.TRACK_CLICK_COOLDOWN_MS))
      ? Number(ctx.TRACK_CLICK_COOLDOWN_MS)
      : 180;
    const getAudioAssetPathKey = method(ctx, "getAudioAssetPathKey", function () {
      return "";
    });
    const fetchLiveCatalogDocument = method(ctx, "fetchLiveCatalogDocument", function () {
      return Promise.reject(new Error("missing live catalog loader"));
    });
    const isDurationsDocument = method(ctx, "isDurationsDocument", function () {
      return false;
    });
    const fetchLocalCatalogDocument = method(ctx, "fetchLocalCatalogDocument", function () {
      return Promise.resolve({});
    });
    const getTrackMetaByAssetPath = method(ctx, "getTrackMetaByAssetPath", function () {
      return null;
    });
    const getCurrentLogicalAudioSrc = method(ctx, "getCurrentLogicalAudioSrc", function () {
      return "";
    });
    const srcMatches = method(ctx, "srcMatches", function (left, right) {
      return String(left || "") === String(right || "");
    });
    const syncTransportUi = method(ctx, "syncTransportUi");
    const updateProgressUi = method(ctx, "updateProgressUi");
    const savePlaybackQueueContext = method(ctx, "savePlaybackQueueContext");
    const ensureGlobalAudio = method(ctx, "ensureGlobalAudio", function () {
      return null;
    });
    const ensureAlbumHeaderActions = method(ctx, "ensureAlbumHeaderActions", function () {
      return null;
    });
    const ensureAlbumFavoriteSelectionToolbar = method(ctx, "ensureAlbumFavoriteSelectionToolbar");
    const toAbsoluteUrl = method(ctx, "toAbsoluteUrl", function (value) {
      return String(value || "");
    });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () {
      return "";
    });
    const resolveTracksAlbumArtwork = method(ctx, "resolveTracksAlbumArtwork", function () {
      return "";
    });
    const getAlbumCoverFromDoc = method(ctx, "getAlbumCoverFromDoc", function () {
      return "";
    });
    const resolveManagedAudioSrc = method(ctx, "resolveManagedAudioSrc", function (value) {
      return String(value || "");
    });
    const normalizeFavoritePath = method(ctx, "normalizeFavoritePath", function (value) {
      return String(value || "");
    });
    const normalizeTrackTitle = method(ctx, "normalizeTrackTitle", function (value) {
      return String(value || "").trim();
    });
    const ensureAlbumFavoriteControls = method(ctx, "ensureAlbumFavoriteControls");
    const toggleAlbumFavoriteSelection = method(ctx, "toggleAlbumFavoriteSelection");
    const togglePlayPause = method(ctx, "togglePlayPause");
    const clearTrackFailure = method(ctx, "clearTrackFailure");
    const startTrack = method(ctx, "startTrack");
    const syncPlaylistContext = method(ctx, "syncPlaylistContext");
    const bindGlobalKeyboardShortcuts = method(ctx, "bindGlobalKeyboardShortcuts");
    const syncRadioQueueToPlaylist = method(ctx, "syncRadioQueueToPlaylist");
    const buildPreservedTrack = method(ctx, "buildPreservedTrack", function () {
      return null;
    });
    const injectCurrentTrackIntoRadioQueue = method(ctx, "injectCurrentTrackIntoRadioQueue", function () {
      return -1;
    });
    const startSelectedTrackInRadioFromCold = method(ctx, "startSelectedTrackInRadioFromCold", function () {
      return false;
    });
    const toggleCurrentPageCollection = method(ctx, "toggleCurrentPageCollection", function () {
      return false;
    });
    const playCurrentPageCollectionShuffled = method(ctx, "playCurrentPageCollectionShuffled");
    const isCurrentPagePlaylistActive = method(ctx, "isCurrentPagePlaylistActive", function () {
      return false;
    });

    function formatTrackDuration(secondsValue) {
      const seconds = Number(secondsValue);
      if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
      const total = Math.round(seconds);
      const minutes = Math.floor(total / 60);
      const secondsPart = total % 60;
      return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
    }

    function parseTrackDurationSeconds(displayValue) {
      const parts = String(displayValue || "")
        .trim()
        .split(":");
      if (parts.length !== 2) return 0;
      const minutes = Number.parseInt(parts[0], 10);
      const seconds = Number.parseInt(parts[1], 10);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
      return Math.max(0, minutes * 60 + seconds);
    }

    function updateAlbumTracksHeading(ui) {
      if (!ui || !ui.section) return;
      const heading = ui.section.querySelector("h2");
      if (!heading || !Array.isArray(ui.playlist)) return;
      const count = ui.playlist.length;
      if (!count) return;
      const totalSeconds = ui.playlist.reduce(function (sum, track) {
        const seconds = Number(track && track.seconds);
        if (Number.isFinite(seconds) && seconds > 0) return sum + seconds;
        return sum + parseTrackDurationSeconds(track && track.duration);
      }, 0);
      const label = count === 1 ? "1 titre" : `${count} titres`;
      const minutes = totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : 0;
      // Maquette V4 : « 24 min », « 5 h 14 » au-delà d'une heure.
      const duration =
        minutes >= 60
          ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
          : `${minutes} min`;
      heading.textContent = minutes ? `${label} · ${duration}` : label;
    }

    function rememberTrackDuration(srcLike, displayValue, baseUrl) {
      const cacheKey = getAudioAssetPathKey(srcLike || "", baseUrl || window.location.href);
      if (!cacheKey || !displayValue || displayValue === "--:--") return;
      if (audioState.trackDurationCache.has(cacheKey)) {
        audioState.trackDurationCache.delete(cacheKey);
      }
      audioState.trackDurationCache.set(cacheKey, displayValue);
      while (audioState.trackDurationCache.size > 420) {
        const oldest = audioState.trackDurationCache.keys().next();
        if (!oldest.done) {
          audioState.trackDurationCache.delete(oldest.value);
        } else {
          break;
        }
      }
    }

    function getCachedTrackDuration(srcLike, baseUrl) {
      const cacheKey = getAudioAssetPathKey(srcLike || "", baseUrl || window.location.href);
      return cacheKey ? audioState.trackDurationCache.get(cacheKey) || "" : "";
    }

    async function loadTrackDurationData() {
      if (audioState.trackDurationData) return audioState.trackDurationData;
      if (audioState.trackDurationLoadingPromise) return audioState.trackDurationLoadingPromise;

      audioState.trackDurationLoadingPromise = (async function () {
        let payload;
        try {
          payload = await fetchLiveCatalogDocument("track-durations.json", isDurationsDocument);
        } catch (_err) {
          payload = await fetchLocalCatalogDocument("track-durations.json");
        }
        const tracks = Array.isArray(payload && payload.tracks) ? payload.tracks : [];
        tracks.forEach(function (entry) {
          if (!entry || !entry.src) return;
          const displayValue = String(entry.duration || "").trim() || formatTrackDuration(entry.seconds);
          if (!displayValue || displayValue === "--:--") return;
          rememberTrackDuration(entry.src, displayValue, runtime.baseUrl);
        });
        audioState.trackDurationData = payload || {};
        return audioState.trackDurationData;
      })()
        .catch(function () {
          audioState.trackDurationData = {};
          return audioState.trackDurationData;
        })
        .finally(function () {
          audioState.trackDurationLoadingPromise = null;
        });

      return audioState.trackDurationLoadingPromise;
    }

    function applyCachedTrackDurations(tracks) {
      if (!Array.isArray(tracks) || !tracks.length) return;
      tracks.forEach(function (track) {
        if (!track || !track.durationEl || !track.src) return;
        const meta = getTrackMetaByAssetPath(track.src);
        const cachedDuration =
          getCachedTrackDuration(track.src) || (meta && meta.duration ? meta.duration : "");
        if (cachedDuration) {
          track.durationEl.textContent = cachedDuration;
        }
      });
      const ui = audioState.ui;
      if (ui && ui.tracks === tracks && Array.isArray(ui.playlist)) {
        ui.playlist.forEach(function (playlistTrack) {
          const meta = getTrackMetaByAssetPath(playlistTrack && playlistTrack.src ? playlistTrack.src : "");
          if (!meta) return;
          if (!playlistTrack.duration && meta.duration) playlistTrack.duration = meta.duration;
          if (!Number.isFinite(Number(playlistTrack.seconds)) && Number.isFinite(Number(meta.seconds))) {
            playlistTrack.seconds = Number(meta.seconds);
          }
        });
        updateAlbumTracksHeading(ui);
      }
    }

    function syncCurrentTrackDurationFromAudio(audio) {
      const currentAudio = audio || audioState.audio;
      if (!currentAudio || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;
      const src = getCurrentLogicalAudioSrc();
      if (!src) return;
      const displayValue = formatTrackDuration(currentAudio.duration);
      if (!displayValue || displayValue === "--:--") return;
      rememberTrackDuration(src, displayValue);

      const ui = audioState.ui;
      if (!ui || !Array.isArray(ui.tracks)) return;
      const track = ui.tracks.find((item) => item && item.durationEl && srcMatches(item.src, src));
      if (track && track.durationEl) {
        track.durationEl.textContent = displayValue;
      }
    }

    function hydrateTrackDurations(_tracks) {
      // audiofix117: durations come only from cached data; no hidden audio probes before a real click/tap.
      return;
    }

    function createEqualizerHtml(className) {
      const safeClass = className || "track-eq";
      return `<span class="${safeClass}" aria-hidden="true"><span></span><span></span><span></span><span></span></span>`;
    }

    function setRowPlaying(track, isPlaying, isStarting, isCurrent) {
      const active = Boolean(isPlaying || isStarting);
      const current = Boolean(isCurrent || active);
      track.button.innerHTML = current ? createEqualizerHtml("track-eq") : track.trackNumber || "";
      track.button.classList.toggle("is-playing", active);
      track.button.classList.toggle("is-current", current);
      track.button.classList.toggle("is-starting", Boolean(isStarting));
      track.button.setAttribute("aria-label", (active ? "Pause " : "Lire ") + track.trackName);
    }

    function syncAudioUi() {
      syncTransportUi();
      const ui = audioState.ui;
      const audio = audioState.audio;
      if (!ui) return;

      const currentSrc = getCurrentLogicalAudioSrc();
      const isPlaying = audio ? !audio.paused : false;
      const uiIndex = currentSrc ? ui.tracks.findIndex((track) => srcMatches(track.src, currentSrc)) : -1;

      ui.tracks.forEach((track, index) => {
        const isTargetStarting = index === uiIndex && audioState.trackStartInFlight;
        track.row.classList.toggle("is-current", index === uiIndex);
        setRowPlaying(track, index === uiIndex && isPlaying, isTargetStarting, index === uiIndex);
        if (index !== uiIndex) {
          track.fill.style.width = "0%";
        }
      });

      if (ui.albumPlayBtn) {
        const sameCollection = ui.playlistKind !== "playlist" || isCurrentPagePlaylistActive(ui.playlist);
        const albumPlaying = sameCollection && uiIndex >= 0 && (isPlaying || audioState.trackStartInFlight);
        ui.albumPlayBtn.innerHTML = albumPlaying ? PLAYER_ICON_STOP : PLAYER_ICON_PLAY;
        ui.albumPlayBtn.classList.toggle("is-on", albumPlaying);
        const collection = ui.playlistKind === "playlist" ? "la playlist" : "l’album";
        ui.albumPlayBtn.setAttribute(
          "aria-label",
          (albumPlaying ? "Mettre en pause " : "Lire ") + collection
        );
        ui.albumPlayBtn.setAttribute("aria-pressed", albumPlaying ? "true" : "false");
        ui.albumPlayBtn.title = ui.albumPlayBtn.getAttribute("aria-label");
      }

      updateProgressUi();
    }

    function ensurePlaylistFromUi(ui) {
      if (audioState.homeMode === "radio") {
        if (Array.isArray(audioState.radioQueue) && audioState.radioQueue.length) {
          syncRadioQueueToPlaylist({ preserveRecent: true });
        }
        return;
      }
      const uiKind = ui && ui.playlistKind === "playlist" ? "playlist" : "album";
      if (
        uiKind !== "playlist" &&
        (audioState.playlistKind === "global" || audioState.playlistKind === "favorites")
      )
        return;
      audioState.playlistKind = uiKind;
      audioState.playlist = ui.playlist.slice();
      syncPlaylistContext(audioState.playlist);
    }

    function prepareAlbumUiTrackForPlayback(ui, index) {
      if (!ui || !Array.isArray(ui.playlist) || !ui.playlist[index]) return index;
      if (audioState.homeMode !== "radio") {
        const selectedTrack = ui.playlist[index];
        const currentSrc = getCurrentLogicalAudioSrc();
        const changesShuffleAlbum = Boolean(
          audioState.shuffleOn &&
          (!currentSrc ||
            !ui.playlist.some(function (track) {
              return track && srcMatches(track.src, currentSrc);
            }))
        );
        audioState.playlistKind = ui && ui.playlistKind === "playlist" ? "playlist" : "album";
        ensurePlaylistFromUi(ui);
        if (changesShuffleAlbum) {
          const selectedSrc = String((selectedTrack && selectedTrack.src) || "");
          audioState.shuffleSessionSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
          audioState.shuffleHistory = selectedSrc ? [selectedSrc] : [];
          audioState.shuffleHistoryCursor = audioState.shuffleHistory.length - 1;
          audioState.upcomingTrackPlan = null;
          savePlaybackQueueContext();
        }
        return index;
      }

      const selectedTrack = ui.playlist[index];
      const preservedTrack = buildPreservedTrack(selectedTrack, selectedTrack.src);
      if (!preservedTrack) {
        ensurePlaylistFromUi(ui);
        return index;
      }

      const queueIndex = injectCurrentTrackIntoRadioQueue(preservedTrack);
      if (queueIndex >= 0) return queueIndex;

      audioState.playlist = [preservedTrack];
      audioState.currentIndex = 0;
      syncPlaylistContext(audioState.playlist);
      return 0;
    }

    function prepareCollectionHeader(section, actions) {
      const page = section.closest("main.page");
      const header = actions.closest("[data-album-header-row]");
      const artwork = page && page.querySelector(".album-layout .cover, .playlist-hero-art");
      const heading = page && page.querySelector(":scope > h1, .album-hero h1");
      const metadata = header && header.querySelector("h2");
      if (!artwork || !heading || !metadata || header.classList.contains("bib-collection-hero")) return;

      // Titre de playlist = le picto seul (« ☾ »), sans « INFRA » (INFRA, 09/11/2026) ;
      // le nom complet reste lu par VoiceOver (aria-label).
      if (heading.classList.contains("playlist-visible-title") && heading.hasAttribute("aria-label")) {
        heading.textContent = heading.getAttribute("aria-label").replace(/^INFRA\s+/, "");
      }
      // Maquette V4 validée par INFRA (08/11/2026) : « ‹ Bibliothèque », « INFRA. · 7 titres · 24 min »,
      // boutons à droite de cette ligne (Lire, Aléatoire, Télécharger s'il existe, Partager).
      const back = page.querySelector(":scope > .back");
      if (back && !back.hasAttribute("data-bib-back")) {
        back.setAttribute("data-bib-back", "");
        back.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg>Bibliothèque';
      }
      const isPlaylist =
        document.body.classList.contains("playlist-screen") || !!page.querySelector(".playlist-hero-art");
      // Le préfixe « INFRA. · » / « Playlist · » est posé en CSS : d'autres scripts réécrivent ce texte.
      metadata.setAttribute("data-bib-meta", isPlaylist ? "playlist" : "album");
      const info = document.createElement("div");
      info.className = "album-hero bib-collection-info";
      const metaRow = document.createElement("div");
      metaRow.className = "bib-meta-row";
      metaRow.append(metadata, actions);
      info.append(heading, metaRow);
      header.classList.add("bib-collection-hero");
      header.append(artwork, info);
    }

    // Les styles de la Bibliothèque sont dans styles.css depuis le lot 3 (INFRA, 09/11/2026).

    function collectionButton(className, label, icon) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = icon;
      return button;
    }

    function initMinimalPlayers() {
      const sections = Array.from(document.querySelectorAll(".tracks"));
      ensureGlobalAudio();

      if (!sections.length) {
        audioState.ui = null;
        return;
      }

      const section = sections[0];
      const rows = Array.from(section.querySelectorAll(".track-player"));
      if (!rows.length) {
        audioState.ui = null;
        return;
      }

      const actions = ensureAlbumHeaderActions(section);
      let albumPlayBtn = null;
      let shuffleBtn = null;
      if (actions) {
        prepareCollectionHeader(section, actions);
        actions
          .querySelectorAll("[data-album-play], [data-bib-shuffle], [data-bib-share]")
          .forEach(function (button) {
            button.remove();
          });
        albumPlayBtn = collectionButton("album-play-toggle", "Lire", PLAYER_ICON_PLAY);
        albumPlayBtn.setAttribute("data-album-play", "");
        shuffleBtn = collectionButton(
          "bib-collection-action",
          "Lecture aléatoire",
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h2c6 0 7 12 13 12h3m-4-4 4 4-4 4M3 18h2c2.6 0 4.2-2.4 5.6-5M14 8c1-1.3 2.1-2 4-2h3m-4-4 4 4-4 4"/></svg>'
        );
        shuffleBtn.setAttribute("data-bib-shuffle", "");
        const shareBtn = collectionButton(
          "bib-collection-action",
          "Partager",
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m-4 4 4-4 4 4M8 11H5v10h14V11h-3"/></svg>'
        );
        shareBtn.setAttribute("data-bib-share", "");
        actions.prepend(albumPlayBtn, shuffleBtn, shareBtn);
      }

      ensureAlbumFavoriteSelectionToolbar(section);

      const pageHref = toAbsoluteUrl(window.location.pathname);
      const albumTitle = getCurrentAlbumTitle();
      const playlistKind = document.body.classList.contains("playlist-screen") ? "playlist" : "album";
      const albumArtwork =
        resolveTracksAlbumArtwork({ page: pageHref, album: albumTitle }) ||
        getAlbumCoverFromDoc(document, window.location.href);

      const ui = {
        section,
        albumPlayBtn,
        shuffleBtn,
        albumTitle,
        albumArtwork,
        playlistKind,
        tracks: [],
        playlist: [],
        pageHref
      };
      let lastTrackClickTs = 0;

      function shouldIgnoreTrackClick() {
        const now =
          window.performance && typeof window.performance.now === "function"
            ? window.performance.now()
            : Date.now();
        if (lastTrackClickTs && now - lastTrackClickTs < TRACK_CLICK_COOLDOWN_MS) {
          return true;
        }
        lastTrackClickTs = now;
        return false;
      }

      rows.forEach(function (row) {
        const button = row.querySelector(".play-btn");
        const nameEl = row.querySelector(".track-name");
        const audioEl = row.querySelector("audio");

        if (!button || !nameEl) return;

        const rawSrc = audioEl
          ? audioEl.getAttribute("data-src") || audioEl.getAttribute("src") || audioEl.currentSrc || ""
          : "";
        const absSrc = rawSrc ? resolveManagedAudioSrc(rawSrc, window.location.href) : "";
        const favoritePath = normalizeFavoritePath(absSrc || rawSrc);
        if (rawSrc) row.setAttribute("data-audio-src", rawSrc);
        if (favoritePath) row.setAttribute("data-favorite-path", favoritePath);
        if (audioEl) {
          audioEl.crossOrigin = "anonymous";
          audioEl.preload = "none";
          audioEl.setAttribute("preload", "none");
          audioEl.removeAttribute("src");
          try {
            audioEl.pause();
          } catch (_err) {
            // Ignore.
          }
        }
        const rawName = String(nameEl.textContent || "").trim();
        const cleanedName = normalizeTrackTitle(rawName);
        // Maquette V4 : le titre s'écrit tel quel (« 78Pt ») ; on ne garde le nettoyage que s'il change autre chose que la casse.
        if (cleanedName && cleanedName !== rawName.toUpperCase()) nameEl.textContent = cleanedName;
        const meta = getTrackMetaByAssetPath(absSrc, window.location.href) || {};
        const rowAlbum = normalizeTrackTitle(row.dataset.trackAlbum || meta.album || ui.albumTitle);
        const rowPage = toAbsoluteUrl(row.dataset.trackPage || meta.page || ui.pageHref);
        const rowArtwork = toAbsoluteUrl(row.dataset.trackArtwork || meta.artwork || ui.albumArtwork);

        if (!absSrc) {
          button.textContent = "×";
          button.classList.add("is-disabled");
          button.disabled = true;
          return;
        }

        let progress = row.querySelector(".track-progress");
        let fill = row.querySelector(".track-progress-fill");

        if (!progress) {
          progress = document.createElement("div");
          progress.className = "track-progress";
          fill = document.createElement("span");
          fill.className = "track-progress-fill";
          progress.appendChild(fill);
          row.appendChild(progress);
        }

        if (!fill) {
          fill = document.createElement("span");
          fill.className = "track-progress-fill";
          progress.appendChild(fill);
        }

        let statusEl = row.querySelector(".track-audio-status");
        let statusText = statusEl ? statusEl.querySelector("[data-track-status-text]") : null;
        let retryBtn = statusEl ? statusEl.querySelector("[data-track-retry]") : null;

        if (!statusEl) {
          statusEl = document.createElement("div");
          statusEl.className = "track-audio-status";
          statusEl.hidden = true;
          statusText = document.createElement("span");
          statusText.setAttribute("data-track-status-text", "");
          retryBtn = document.createElement("button");
          retryBtn.className = "track-retry";
          retryBtn.type = "button";
          retryBtn.setAttribute("data-track-retry", "");
          retryBtn.textContent = "Réessayer";
          retryBtn.hidden = true;
          statusEl.appendChild(statusText);
          statusEl.appendChild(retryBtn);
          row.appendChild(statusEl);
        }

        const track = {
          row,
          button,
          progress,
          fill,
          durationEl: null,
          statusEl,
          statusText,
          retryBtn,
          trackName: cleanedName || nameEl.textContent.trim(),
          trackNumber: String(ui.tracks.length + 1).padStart(2, "0"),
          src: absSrc
        };

        let durationEl = row.querySelector(".track-duration");
        if (!durationEl) {
          durationEl = document.createElement("span");
          durationEl.className = "track-duration";
          durationEl.textContent = "--:--";
          row.appendChild(durationEl);
        }
        track.durationEl = durationEl;

        const index = ui.tracks.push(track) - 1;
        row.setAttribute("data-track-index", String(index));
        ui.playlist.push({
          src: absSrc,
          name: track.trackName,
          album: rowAlbum,
          page: rowPage,
          artist: "INFRA.",
          artwork: rowArtwork,
          duration: String(meta.duration || "").trim(),
          seconds: Number(meta.seconds)
        });
        setRowPlaying(track, false);
        fill.style.width = "0%";
        ensureAlbumFavoriteControls(row, track, meta);

        button.addEventListener("click", function (event) {
          if (section.classList.contains("album-favorite-selecting")) {
            toggleAlbumFavoriteSelection(row, event);
            return;
          }
          if (shouldIgnoreTrackClick()) return;
          audioState.ui = ui;

          const currentSrc = getCurrentLogicalAudioSrc();
          const isSame = currentSrc && srcMatches(currentSrc, track.src);

          if (isSame) {
            togglePlayPause();
            return;
          }

          if (startSelectedTrackInRadioFromCold(ui.playlist[index], { surface: "album_track_cold_radio" })) {
            return;
          }

          const playIndex = prepareAlbumUiTrackForPlayback(ui, index);
          startTrack(playIndex, {
            seamless: true,
            immediatePlay: true,
            userGesture: true,
            surface: "album_track"
          });
        });

        retryBtn.addEventListener("click", function (event) {
          event.stopPropagation();
          audioState.ui = ui;
          clearTrackFailure(track.src);
          const playIndex = prepareAlbumUiTrackForPlayback(ui, index);
          startTrack(playIndex, {
            seamless: true,
            immediatePlay: true,
            userGesture: true,
            forceReload: true,
            surface: "album_retry"
          });
        });

        row.addEventListener("click", function (event) {
          const target = event.target;
          if (!target || !(target instanceof Element)) return;
          if (
            target.closest(".play-btn") ||
            target.closest(".track-progress") ||
            target.closest("[data-track-favorite]") ||
            target.closest("[data-track-select]") ||
            target.closest("[data-album-favorite-toolbar]")
          ) {
            return;
          }
          if (section.classList.contains("album-favorite-selecting")) {
            toggleAlbumFavoriteSelection(row, event);
            return;
          }
          if (shouldIgnoreTrackClick()) return;

          audioState.ui = ui;

          const currentSrc = getCurrentLogicalAudioSrc();
          const isSame = currentSrc && srcMatches(currentSrc, track.src);
          if (isSame) {
            togglePlayPause();
            return;
          }
          if (startSelectedTrackInRadioFromCold(ui.playlist[index], { surface: "album_row_cold_radio" })) {
            return;
          }
          const playIndex = prepareAlbumUiTrackForPlayback(ui, index);
          startTrack(playIndex, {
            seamless: true,
            immediatePlay: true,
            userGesture: true,
            surface: "album_row"
          });
        });

        let seeking = false;

        function seekFromClientX(clientX, shouldPlay) {
          const bounds = progress.getBoundingClientRect();
          const ratio = (clientX - bounds.left) / bounds.width;
          const clamped = Math.max(0, Math.min(1, ratio));

          audioState.ui = ui;
          const playIndex = prepareAlbumUiTrackForPlayback(ui, index);

          const audio = audioState.audio;
          const currentSrc = getCurrentLogicalAudioSrc();
          const isSame = currentSrc && srcMatches(currentSrc, track.src);

          if (isSame) {
            if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
              audio.currentTime = clamped * audio.duration;
              updateProgressUi();
              if (shouldPlay && audio.paused) {
                audio.play().catch(function () {});
              }
            }
            return;
          }

          startTrack(playIndex, {
            seekRatio: clamped,
            resume: true,
            immediatePlay: Boolean(shouldPlay),
            userGesture: Boolean(shouldPlay),
            surface: "album_seek"
          });
          if (!shouldPlay) {
            // If user dragged without intent to play, keep paused once metadata is ready.
            audio.pause();
          }
        }

        progress.addEventListener("pointerdown", function (event) {
          seeking = true;
          if (typeof progress.setPointerCapture === "function") {
            try {
              progress.setPointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore capture errors.
            }
          }
          seekFromClientX(event.clientX, true);
        });

        progress.addEventListener("pointermove", function (event) {
          if (!seeking) return;
          seekFromClientX(event.clientX, true);
        });

        function stopSeeking(event) {
          if (!seeking) return;
          seeking = false;
          if (event && typeof progress.releasePointerCapture === "function") {
            try {
              progress.releasePointerCapture(event.pointerId);
            } catch (_err) {
              // Ignore.
            }
          }
        }

        progress.addEventListener("pointerup", stopSeeking);
        progress.addEventListener("pointercancel", stopSeeking);

        progress.addEventListener("click", function (event) {
          seekFromClientX(event.clientX, true);
        });
      });

      updateAlbumTracksHeading(ui);

      if (ui.albumPlayBtn) {
        ui.albumPlayBtn.addEventListener("click", function () {
          audioState.ui = ui;
          toggleCurrentPageCollection();
        });
      }

      if (ui.shuffleBtn) {
        ui.shuffleBtn.addEventListener("click", function () {
          audioState.ui = ui;
          playCurrentPageCollectionShuffled();
        });
      }

      audioState.ui = ui;
      const activeSrc = getCurrentLogicalAudioSrc();
      if (
        (document.body.classList.contains("album-screen") ||
          document.body.classList.contains("playlist-screen")) &&
        activeSrc &&
        ui.playlistKind === "album" &&
        audioState.homeMode !== "radio" &&
        audioState.playlistKind === ui.playlistKind
      ) {
        const matchIndex = ui.playlist.findIndex((track) => srcMatches(track.src, activeSrc));
        if (matchIndex >= 0) {
          audioState.playlist = ui.playlist.slice();
          syncPlaylistContext(audioState.playlist);
          audioState.currentIndex = matchIndex;
        }
      }
      applyCachedTrackDurations(ui.tracks);
      loadTrackDurationData()
        .then(function () {
          applyCachedTrackDurations(ui.tracks);
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(
              function () {
                hydrateTrackDurations(ui.tracks);
              },
              { timeout: 1400 }
            );
          } else {
            setTimeout(function () {
              hydrateTrackDurations(ui.tracks);
            }, 220);
          }
        })
        .catch(function () {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(
              function () {
                hydrateTrackDurations(ui.tracks);
              },
              { timeout: 1400 }
            );
          } else {
            setTimeout(function () {
              hydrateTrackDurations(ui.tracks);
            }, 220);
          }
        });

      bindGlobalKeyboardShortcuts();

      syncAudioUi();
    }

    function hydrateCurrentAlbumTrackRows(tracksData) {
      if (
        !document.body.classList.contains("album-screen") ||
        document.body.classList.contains("playlist-screen")
      )
        return;
      const routeHost = document.getElementById("infraSpaRouteHost");
      const routeRoot =
        document.querySelector(
          "#infraSpaRouteHost .spa-route-layer.album-screen[data-spa-route-state='current']"
        ) || (!routeHost ? document : null);
      if (!routeRoot) return;
      const section = routeRoot.querySelector(".tracks");
      if (!section) return;
      const currentFile = decodeURIComponent(
        String(window.location.pathname || "")
          .split("/")
          .pop() || ""
      );
      const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
      const album = albums.find(function (entry) {
        return (
          decodeURIComponent(
            String((entry && entry.page) || "")
              .split("/")
              .pop() || ""
          ) === currentFile
        );
      });
      if (!album || !Array.isArray(album.tracks) || !album.tracks.length) return;

      const heading = routeRoot.querySelector("main.page > h1, main > h1, .album-hero h1");
      if (heading && album.title && heading.textContent.trim() !== album.title) {
        heading.textContent = album.title;
        const titleSeparator = document.title.indexOf("|");
        document.title =
          titleSeparator >= 0 ? `${album.title} ${document.title.slice(titleSeparator)}` : album.title;
      }

      const currentRows = Array.from(section.querySelectorAll(":scope > .track-player"));
      const currentSignature = currentRows
        .map(function (row) {
          const name = row.querySelector(".track-name");
          const audio = row.querySelector("audio");
          return `${name ? name.textContent.trim() : ""}|${audio ? audio.getAttribute("data-src") || "" : ""}`;
        })
        .join("\n");
      const nextSignature = album.tracks
        .map(function (track) {
          return `${track.title}|${new URL(track.src, runtime.baseUrl).href}`;
        })
        .join("\n");
      const normalizedCurrent = currentRows
        .map(function (row) {
          const name = row.querySelector(".track-name");
          const audio = row.querySelector("audio");
          const rawSrc = audio ? audio.getAttribute("data-src") || "" : "";
          return `${name ? name.textContent.trim() : ""}|${rawSrc ? new URL(rawSrc, window.location.href).href : ""}`;
        })
        .join("\n");
      if (currentSignature === nextSignature || normalizedCurrent === nextSignature) return;

      currentRows.forEach(function (row) {
        row.remove();
      });
      const fragment = document.createDocumentFragment();
      album.tracks.forEach(function (track, index) {
        const row = document.createElement("div");
        row.className = "track-player";
        const button = document.createElement("button");
        button.className = "play-btn";
        button.type = "button";
        button.setAttribute("aria-label", `Lire ${track.title}`);
        button.textContent = String(index + 1).padStart(2, "0");
        const name = document.createElement("span");
        name.className = "track-name";
        name.textContent = track.title;
        const audio = document.createElement("audio");
        audio.preload = "none";
        audio.setAttribute("data-src", new URL(track.src, runtime.baseUrl).href);
        row.append(button, name, audio);
        fragment.appendChild(row);
      });
      section.appendChild(fragment);
    }

    return {
      formatTrackDuration: formatTrackDuration,
      parseTrackDurationSeconds: parseTrackDurationSeconds,
      updateAlbumTracksHeading: updateAlbumTracksHeading,
      rememberTrackDuration: rememberTrackDuration,
      getCachedTrackDuration: getCachedTrackDuration,
      loadTrackDurationData: loadTrackDurationData,
      applyCachedTrackDurations: applyCachedTrackDurations,
      syncCurrentTrackDurationFromAudio: syncCurrentTrackDurationFromAudio,
      hydrateTrackDurations: hydrateTrackDurations,
      createEqualizerHtml: createEqualizerHtml,
      setRowPlaying: setRowPlaying,
      syncAudioUi: syncAudioUi,
      ensurePlaylistFromUi: ensurePlaylistFromUi,
      prepareAlbumUiTrackForPlayback: prepareAlbumUiTrackForPlayback,
      initMinimalPlayers: initMinimalPlayers,
      hydrateCurrentAlbumTrackRows: hydrateCurrentAlbumTrackRows
    };
  }

  window.InfraAlbumPlayerUi = Object.assign(window.InfraAlbumPlayerUi || {}, {
    createAlbumPlayerUi: createAlbumPlayerUi
  });
})();
