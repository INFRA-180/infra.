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

  function createFavoritesUi(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const runtime = ctx.runtime && ctx.runtime.baseUrl
      ? ctx.runtime
      : { baseUrl: new URL(".", window.location.href), query: "" };
    const FAVORITES_RESET_DB_MARKER = ctx.FAVORITES_RESET_DB_MARKER || "__infra_favorites_reset_audiofix212__";
    const HEART_ICON_FILLED = ctx.HEART_ICON_FILLED || "";
    const HEART_ICON_OUTLINE = ctx.HEART_ICON_OUTLINE || "";
    const DOWNLOAD_ICON = ctx.DOWNLOAD_ICON || "";
    const SELECT_MODE_ICON = ctx.SELECT_MODE_ICON || "";
    const DONE_MODE_ICON = ctx.DONE_MODE_ICON || "";
    const infraDownloadsApi = ctx.infraDownloadsApi || null;
    const getAudioAssetPathKey = method(ctx, "getAudioAssetPathKey", function () { return ""; });
    const getAudioTelemetryNow = method(ctx, "getAudioTelemetryNow", function () { return Date.now(); });
    const getCurrentAlbumTitle = method(ctx, "getCurrentAlbumTitle", function () { return ""; });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const loadTracksData = method(ctx, "loadTracksData", function () { return Promise.resolve({}); });
    const getCurrentPlaylistTrack = method(ctx, "getCurrentPlaylistTrack", function () { return null; });
    const getCurrentLogicalAudioSrc = method(ctx, "getCurrentLogicalAudioSrc", function () { return ""; });
    const mergeTrackMetadata = method(ctx, "mergeTrackMetadata", function (track) { return track || {}; });
    const getTrackMetaByAssetPath = method(ctx, "getTrackMetaByAssetPath", function () { return null; });
    const resolveManagedAudioSrc = method(ctx, "resolveManagedAudioSrc", function (value) { return String(value || ""); });
    const clearRadioQueue = method(ctx, "clearRadioQueue");
    const persistHomePlayMode = method(ctx, "persistHomePlayMode");
    const syncPlaylistContext = method(ctx, "syncPlaylistContext");
    const syncMediaSessionMetadata = method(ctx, "syncMediaSessionMetadata");
    const syncAudioUi = method(ctx, "syncAudioUi");
    const getRandomIndex = method(ctx, "getRandomIndex", function () { return 0; });
    const startTrack = method(ctx, "startTrack");
    const resolveCoverUrl = method(ctx, "resolveCoverUrl", function () { return ""; });
    const srcMatches = method(ctx, "srcMatches", function (left, right) { return String(left || "") === String(right || ""); });
    const getMediaSessionFallbackArtwork = method(ctx, "getMediaSessionFallbackArtwork", function () { return ""; });
    const formatTrackDuration = method(ctx, "formatTrackDuration", function () { return "--:--"; });
    const parseDurationText = method(ctx, "parseDurationText", function () { return 0; });
    let favoritesStorage = null;

  function createUnavailableFavoritesStorage() {
    return Object.freeze({
      openDb: function () { return Promise.resolve(null); },
      withStore: function () { return Promise.resolve(null); },
      readLocalEntries: function () { return []; },
      writeLocalEntries: function () { return false; },
      persistOrder: function () { return Promise.resolve(false); },
      deleteEntry: function () { return Promise.resolve(false); },
      readResetVersion: function () { return false; },
      writeResetVersion: function () { return false; },
      replaceStoreWithResetMarker: function () { return Promise.resolve(false); }
    });
  }

  function getFavoritesStorage() {
    if (favoritesStorage) return favoritesStorage;
    if (window.InfraFavorites && typeof window.InfraFavorites.createStorage === "function") {
      favoritesStorage = window.InfraFavorites.createStorage({
        state: audioState,
        normalizeEntries: assignFavoriteSortIndexes
      });
    } else {
      audioState.favoritesDbSupported = false;
      favoritesStorage = createUnavailableFavoritesStorage();
    }
    return favoritesStorage;
  }

  function openFavoritesDb() {
    return getFavoritesStorage().openDb();
  }

  function withFavoritesStore(mode, callback) {
    return getFavoritesStorage().withStore(mode, callback);
  }

  function canonicalFavoritePath(trackOrSrc, baseUrl) {
    let value = "";
    if (trackOrSrc && typeof trackOrSrc === "object") {
      value =
        trackOrSrc.favoritePath ||
        trackOrSrc.path ||
        trackOrSrc.track_path ||
        trackOrSrc.src ||
        trackOrSrc.currentSrc ||
        "";
    } else {
      value = trackOrSrc || "";
    }
    const raw = String(value || "").trim();
    if (!raw) return "";

    const bases = [
      baseUrl || "",
      runtime && runtime.baseUrl ? runtime.baseUrl.href : "",
      window.location.href
    ].filter(Boolean);
    for (let index = 0; index < bases.length; index += 1) {
      const key = getAudioAssetPathKey(raw, bases[index]);
      if (key) return key.replace(
        /^assets\/music\/streams\/v\d{8}(?:-[^/]+)?\//i,
        "assets/music/streams/"
      );
    }

    let fallback = raw.split("#")[0].split("?")[0].replace(/\\/g, "/");
    try {
      fallback = decodeURIComponent(fallback);
    } catch (_err) {
      // Keep raw fallback.
    }
    const match = fallback.match(/(?:^|\/)(assets\/(?:music\/streams|audio)\/.+\.(?:mp3|m4a|aac|wav|flac|ogg))$/i);
    return match
      ? match[1].normalize("NFC").replace(
        /^assets\/music\/streams\/v\d{8}(?:-[^/]+)?\//i,
        "assets/music/streams/"
      )
      : "";
  }

  function normalizeFavoritePath(srcLike, baseUrl) {
    return canonicalFavoritePath(srcLike || "", baseUrl || window.location.href);
  }

  function getTelemetryElementSelector(element) {
    if (!element || !element.tagName) return "";
    const parts = [element.tagName.toLowerCase()];
    if (element.id) parts.push(`#${element.id}`);
    if (element.classList && element.classList.length) {
      parts.push(`.${Array.from(element.classList).slice(0, 3).join(".")}`);
    }
    ["data-track-select", "data-track-favorite", "data-transport-favorite", "data-now-playing-favorite", "data-home-favorites"].some(function (attr) {
      if (element.hasAttribute && element.hasAttribute(attr)) {
        parts.push(`[${attr}]`);
        return true;
      }
      return false;
    });
    return parts.join("");
  }

  function getTapTelemetry(event) {
    if (!event) return {};
    let topElement = null;
    try {
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        topElement = document.elementFromPoint(event.clientX, event.clientY);
      }
    } catch (_err) {
      topElement = null;
    }
    const path = typeof event.composedPath === "function"
      ? event.composedPath().slice(0, 5).map(getTelemetryElementSelector).filter(Boolean).join(" > ")
      : "";
    return {
      selector: getTelemetryElementSelector(event.currentTarget),
      target: getTelemetryElementSelector(event.target),
      top_element: getTelemetryElementSelector(topElement),
      composed_path: path
    };
  }

  function trackFavoriteDebug(eventName, payload) {
    trackAudioRuntimeEvent(eventName, Object.assign({
      track: payload && payload.path ? payload.path : "favorite",
      album: payload && payload.album ? payload.album : (getCurrentAlbumTitle() || document.title || ""),
      surface: payload && payload.surface ? payload.surface : "unknown",
      path: payload && payload.path ? payload.path : "",
      activeBefore: payload && Object.prototype.hasOwnProperty.call(payload, "activeBefore") ? payload.activeBefore : null,
      activeAfter: payload && Object.prototype.hasOwnProperty.call(payload, "activeAfter") ? payload.activeAfter : null,
      idb: payload && payload.idb ? payload.idb : "",
      local: payload && payload.local ? payload.local : "",
      memory: payload && payload.memory ? payload.memory : ""
    }, payload || {}));
  }

  function trackFavoritePathResolved(surface, path) {
    const cleanPath = normalizeFavoritePath(path || "");
    trackFavoriteDebug(cleanPath ? "fav:path_resolved" : "fav:path_missing", {
      surface: surface || "unknown",
      path: cleanPath,
      matched: isFavoritePath(cleanPath),
      memory: cleanPath ? (isFavoritePath(cleanPath) ? "matched" : "miss") : "missing"
    });
    return cleanPath;
  }

  function sortFavoriteEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .filter(function (entry) { return entry && entry.path; })
      .map(function (entry) {
        return {
          path: normalizeFavoritePath(entry.path),
          added_at: Number(entry.added_at) || 0,
          sort_index: Number.isFinite(Number(entry.sort_index)) ? Number(entry.sort_index) : null
        };
      })
      .filter(function (entry) { return entry.path; })
      .sort(function (a, b) {
        const aSort = Number.isFinite(Number(a.sort_index)) ? Number(a.sort_index) : null;
        const bSort = Number.isFinite(Number(b.sort_index)) ? Number(b.sort_index) : null;
        if (aSort !== null && bSort !== null && aSort !== bSort) return aSort - bSort;
        if (aSort !== null && bSort === null) return -1;
        if (aSort === null && bSort !== null) return 1;
        return (Number(b.added_at) || 0) - (Number(a.added_at) || 0);
      });
  }

  function assignFavoriteSortIndexes(entries) {
    return sortFavoriteEntries(entries).map(function (entry, index) {
      return Object.assign({}, entry, {
        sort_index: Number.isFinite(Number(entry.sort_index)) ? Number(entry.sort_index) : (index + 1) * 1000
      });
    });
  }

  function readLocalFavoriteEntries() {
    return getFavoritesStorage().readLocalEntries();
  }

  function writeLocalFavoriteEntries(entries) {
    return getFavoritesStorage().writeLocalEntries(entries);
  }

  function persistFavoriteOrder(entries) {
    return getFavoritesStorage().persistOrder(entries);
  }

  function syncFavoriteEntryState(entries) {
    const sortedEntries = sortFavoriteEntries(entries);
    const needsMigration = sortedEntries.some(function (entry) {
      return !Number.isFinite(Number(entry.sort_index));
    });
    const seenPaths = new Set();
    const cleanEntries = assignFavoriteSortIndexes(sortedEntries.filter(function (entry) {
      if (!entry.path || seenPaths.has(entry.path)) return false;
      seenPaths.add(entry.path);
      return true;
    }));
    audioState.favoriteEntries = cleanEntries;
    audioState.favoritePaths = new Set(cleanEntries.map(function (entry) { return entry.path; }));
    audioState.favoritesLoaded = true;
    writeLocalFavoriteEntries(cleanEntries);
    syncFavoriteButtons();
    if (needsMigration && audioState.favoritesDbSupported && audioState.favoritesResetApplied) {
      persistFavoriteOrder(cleanEntries).catch(function () {});
    }
    return cleanEntries.slice();
  }

  function loadFavoriteEntries() {
    if (audioState.favoritesLoaded) return Promise.resolve(audioState.favoriteEntries.slice());
    if (audioState.favoritesLoadingPromise) return audioState.favoritesLoadingPromise;

    const localEntries = readLocalFavoriteEntries();
    audioState.favoritesLoadingPromise = withFavoritesStore("readonly", function (store, resolve) {
      let request;
      try {
        request = store.getAll();
      } catch (_err) {
        resolve([]);
        return;
      }
      request.onsuccess = function () {
        resolve(Array.isArray(request.result) ? request.result : []);
      };
      request.onerror = function () {
        resolve(null);
      };
    }).then(function (entries) {
      const indexedEntries = Array.isArray(entries) ? entries : [];
      const hasDbResetMarker = indexedEntries.some(function (entry) {
        return entry && entry.path === FAVORITES_RESET_DB_MARKER;
      });
      const indexedFavorites = indexedEntries.filter(function (entry) {
        return entry && entry.path !== FAVORITES_RESET_DB_MARKER;
      });
      const hasLocalResetMarker = readFavoritesResetVersion();
      audioState.favoritesResetApplied = Boolean(
        hasDbResetMarker || (hasLocalResetMarker && indexedEntries.length === 0)
      );
      const chosenEntries = hasDbResetMarker
        ? indexedFavorites
        : (hasLocalResetMarker ? localEntries : (indexedFavorites.length ? indexedFavorites : localEntries));
      if (indexedFavorites.length || hasDbResetMarker) writeLocalFavoriteEntries(indexedFavorites);
      return syncFavoriteEntryState(chosenEntries || []);
    }).catch(function () {
      audioState.favoritesDbSupported = false;
      return syncFavoriteEntryState(localEntries || []);
    }).finally(function () {
      audioState.favoritesLoadingPromise = null;
    });

    return audioState.favoritesLoadingPromise;
  }

  function readFavoritesResetVersion() {
    return getFavoritesStorage().readResetVersion();
  }

  function writeFavoritesResetVersion() {
    return getFavoritesStorage().writeResetVersion();
  }

  function replaceFavoritesStoreWithResetMarker() {
    return getFavoritesStorage().replaceStoreWithResetMarker();
  }

  function ensureFavoritesReset(entries) {
    if (audioState.favoritesResetApplied) return Promise.resolve(sortFavoriteEntries(entries || []));
    if (audioState.favoritesResetPromise) return audioState.favoritesResetPromise;

    audioState.favoritesResetPromise = Promise.resolve().then(function () {
      const localOk = writeLocalFavoriteEntries([]);
      syncFavoriteEntryState([]);
      return replaceFavoritesStoreWithResetMarker().then(function (dbOk) {
        const resetStored = Boolean(dbOk || !audioState.favoritesDbSupported);
        if (resetStored && localOk) writeFavoritesResetVersion();
        audioState.favoritesResetApplied = resetStored;
        return [];
      }).catch(function () {
        audioState.favoritesDbSupported = false;
        if (localOk) writeFavoritesResetVersion();
        audioState.favoritesResetApplied = Boolean(localOk);
        return [];
      });
    }).finally(function () {
      audioState.favoritesResetPromise = null;
    });

    return audioState.favoritesResetPromise;
  }

  function loadFavoritesWithReset() {
    return Promise.all([loadTracksData(), loadFavoriteEntries()]).then(function (results) {
      return ensureFavoritesReset(results[1] || []);
    });
  }

  function getCurrentFavoritePath() {
    const track = getCurrentPlaylistTrack();
    return normalizeFavoritePath(
      getCurrentLogicalAudioSrc() ||
      audioState.activeLogicalSrc ||
      (track && track.src) ||
      ""
    );
  }

  function isFavoritePath(path) {
    return Boolean(path && audioState.favoritePaths && audioState.favoritePaths.has(path));
  }

  function getHeartIcon(isOn) {
    return isOn ? HEART_ICON_FILLED : HEART_ICON_OUTLINE;
  }

  function setFavoriteButtonState(button, isOn) {
    if (!button) return;
    button.innerHTML = getHeartIcon(Boolean(isOn));
    button.classList.toggle("is-on", Boolean(isOn));
    button.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  function setFavoriteButtonPath(button, pathLike) {
    if (!button) return "";
    const path = normalizeFavoritePath(pathLike || "");
    if (path) button.setAttribute("data-favorite-path", path);
    else button.removeAttribute("data-favorite-path");
    return path;
  }

  function getFavoriteButtonPath(button, fallbackPath) {
    return normalizeFavoritePath(
      (button && button.getAttribute("data-favorite-path")) ||
      fallbackPath ||
      ""
    );
  }

  function deleteFavoriteEntry(path) {
    return getFavoritesStorage().deleteEntry(path);
  }

  function syncCurrentFavoriteButtons() {
    const currentPath = getCurrentFavoritePath();
    const isCurrentFavorite = isFavoritePath(currentPath);
    const transport = audioState.transport;
    if (transport && transport.overlayFavorite) {
      setFavoriteButtonPath(transport.overlayFavorite, currentPath);
      transport.overlayFavorite.hidden = !currentPath;
      transport.overlayFavorite.disabled = !currentPath;
      setFavoriteButtonState(transport.overlayFavorite, isCurrentFavorite);
      transport.overlayFavorite.setAttribute(
        "aria-label",
        isCurrentFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
      );
    }
    if (transport && transport.favoriteBtn) {
      setFavoriteButtonPath(transport.favoriteBtn, currentPath);
      transport.favoriteBtn.hidden = !currentPath;
      transport.favoriteBtn.disabled = !currentPath;
      setFavoriteButtonState(transport.favoriteBtn, isCurrentFavorite);
      transport.favoriteBtn.setAttribute(
        "aria-label",
        isCurrentFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
      );
    }

    const homeFavoriteButton = document.querySelector("[data-home-favorites]");
    if (homeFavoriteButton) {
      const count = audioState.favoriteEntries.length;
      homeFavoriteButton.hidden = count <= 0;
      homeFavoriteButton.disabled = count <= 0;
      setFavoriteButtonState(homeFavoriteButton, count > 0);
      homeFavoriteButton.setAttribute("aria-label", `Ouvrir les favoris (${count})`);
    }
  }

  function syncFavoriteButtons() {
    syncCurrentFavoriteButtons();
    syncAlbumFavoriteButtons();
  }

  function syncFavoriteSurface(surface, row) {
    const name = String(surface || "").trim();
    if (row) syncAlbumFavoriteRow(row);
    if (name === "album_select" || name === "album_hover") {
      syncCurrentFavoriteButtons();
      return;
    }
    if (name === "mini" || name === "overlay" || name === "current") {
      syncCurrentFavoriteButtons();
      return;
    }
    syncFavoriteButtons();
  }

  function pulseFavoriteButton(button) {
    if (!button) return;
    button.classList.remove("is-pulsing");
    void button.offsetWidth;
    button.classList.add("is-pulsing");
    window.setTimeout(function () {
      button.classList.remove("is-pulsing");
    }, 180);
  }

  function getNextFavoriteSortIndex() {
    const minSort = audioState.favoriteEntries.reduce(function (min, entry) {
      const value = Number(entry.sort_index);
      return Number.isFinite(value) ? Math.min(min, value) : min;
    }, 1000);
    return minSort - 1000;
  }

  function getFavoriteSnapshot() {
    return {
      entries: audioState.favoriteEntries.slice(),
      paths: new Set(audioState.favoritePaths)
    };
  }

  function restoreFavoriteSnapshot(snapshot) {
    if (!snapshot) return;
    audioState.favoriteEntries = snapshot.entries.slice();
    audioState.favoritePaths = new Set(snapshot.paths);
    syncFavoriteButtons();
  }

  function createFavoritePersistResult(localOk, idbOk, idbAttempted) {
    const localStatus = localOk ? "ok" : "fail";
    const idbStatus = idbAttempted ? (idbOk ? "ok" : "fail") : "skipped";
    return {
      ok: Boolean(localOk || idbOk),
      local: localStatus,
      idb: idbStatus,
      write_local: localStatus,
      write_idb: idbStatus
    };
  }

  function isFavoritePersistOk(result) {
    if (result && typeof result === "object") return Boolean(result.ok);
    return Boolean(result);
  }

  function applyFavoriteMemoryState(path, shouldFavorite, trackMeta) {
    const meta = mergeTrackMetadata(trackMeta || getTrackMetaByAssetPath(path, runtime.baseUrl.href) || {});
    const wasFavorite = isFavoritePath(path);
    if (shouldFavorite && wasFavorite) return false;
    if (!shouldFavorite && !wasFavorite) return false;

    if (!shouldFavorite) {
      audioState.favoritePaths.delete(path);
      audioState.favoriteEntries = audioState.favoriteEntries.filter(function (entry) {
        return entry.path !== path;
      });
      trackAudioRuntimeEvent("favorite_remove", {
        track: path,
        album: meta.album || "",
        track_path: path
      });
      return true;
    }

    const entry = { path, added_at: Date.now(), sort_index: getNextFavoriteSortIndex() };
    audioState.favoriteEntries = assignFavoriteSortIndexes([entry].concat(audioState.favoriteEntries));
    audioState.favoritePaths.add(path);
    trackAudioRuntimeEvent("favorite_add", {
      track: path,
      album: meta.album || "",
      track_path: path
    });
    return true;
  }

  function persistFavoriteMemoryState(path, shouldFavorite) {
    const localOk = writeLocalFavoriteEntries(audioState.favoriteEntries);
    if (!audioState.favoritesDbSupported) {
      return Promise.resolve(createFavoritePersistResult(localOk, false, false));
    }
    const dbWrite = shouldFavorite
      ? persistFavoriteOrder(audioState.favoriteEntries)
      : deleteFavoriteEntry(path);
    return dbWrite
      .then(function (dbOk) {
        return createFavoritePersistResult(localOk, Boolean(dbOk), true);
      })
      .catch(function () {
        audioState.favoritesDbSupported = false;
        return createFavoritePersistResult(localOk, false, true);
      });
  }

  function setFavoritePath(pathLike, shouldFavorite, trackMeta) {
    const path = normalizeFavoritePath(pathLike || "");
    if (!path) {
      trackFavoriteDebug("fav:path_missing", {
        surface: "setFavoritePath",
        path: "",
        memory: "set_missing_path"
      });
      return Promise.resolve(false);
    }
    const snapshot = getFavoriteSnapshot();
    const activeBefore = isFavoritePath(path);
    const changed = applyFavoriteMemoryState(path, shouldFavorite, trackMeta);
    if (!changed) return Promise.resolve(true);
    syncFavoriteButtons();
    return persistFavoriteMemoryState(path, shouldFavorite)
      .then(function (result) {
        trackFavoriteDebug("fav:write", {
          surface: "setFavoritePath",
          path,
          activeBefore,
          activeAfter: isFavoritePath(path),
          idb: result && (result.idb || result.write_idb) || "",
          local: result && (result.local || result.write_local) || "",
          memory: isFavoritePath(path) ? "on" : "off"
        });
        if (!isFavoritePersistOk(result)) restoreFavoriteSnapshot(snapshot);
        else refreshFavoritesViewIfOpen();
        return result;
      })
      .catch(function () {
        restoreFavoriteSnapshot(snapshot);
        return createFavoritePersistResult(false, false, true);
      });
  }

  function toggleFavoritePath(pathLike, trackMeta) {
    const path = normalizeFavoritePath(pathLike || "");
    if (!path) return Promise.resolve(false);
    return toggleFavoriteAndSync(path, "generic", trackMeta);
  }

  function toggleFavoriteAndSync(pathLike, surface, trackMeta) {
    const path = trackFavoritePathResolved(surface || "generic", pathLike);
    if (!path) {
      trackFavoriteDebug("fav:path_missing", {
        surface: surface || "generic",
        path: "",
        memory: "toggle_missing_path"
      });
      return Promise.resolve(false);
    }
    if (audioState.favoritePendingPaths.has(path)) return Promise.resolve(false);

    const shouldFavorite = !isFavoritePath(path);
    const activeBefore = !shouldFavorite;
    const snapshot = getFavoriteSnapshot();
    audioState.favoritePendingPaths.add(path);

    const changed = applyFavoriteMemoryState(path, shouldFavorite, trackMeta);
    syncFavoriteButtons();
    if (!changed) {
      audioState.favoritePendingPaths.delete(path);
      return Promise.resolve({
        ok: true,
        local: "skipped",
        idb: "skipped",
        write_local: "skipped",
        write_idb: "skipped",
        unchanged: true
      });
    }

    return persistFavoriteMemoryState(path, shouldFavorite)
      .then(function (result) {
        trackFavoriteDebug("fav:write", {
          surface: surface || "generic",
          path,
          activeBefore,
          activeAfter: isFavoritePath(path),
          idb: result && (result.idb || result.write_idb) || "",
          local: result && (result.local || result.write_local) || "",
          memory: isFavoritePath(path) ? "on" : "off"
        });
        if (!isFavoritePersistOk(result)) {
          restoreFavoriteSnapshot(snapshot);
          return result;
        }
        refreshFavoritesViewIfOpen();
        trackFavoritePathResolved(surface || "generic", path);
        return result;
      })
      .catch(function () {
        restoreFavoriteSnapshot(snapshot);
        return createFavoritePersistResult(false, false, true);
      })
      .finally(function () {
        window.setTimeout(function () {
          audioState.favoritePendingPaths.delete(path);
        }, 220);
      });
  }

  function getAlbumRowFavoritePath(row) {
    if (!row) return "";
    const storedPath = row.getAttribute("data-favorite-path") || "";
    if (storedPath) return normalizeFavoritePath(storedPath);
    const storedAudioSrc = row.getAttribute("data-audio-src") || "";
    if (storedAudioSrc) {
      const rowPath = normalizeFavoritePath(storedAudioSrc);
      if (rowPath) {
        row.setAttribute("data-favorite-path", rowPath);
        return rowPath;
      }
    }
    const audioEl = row.querySelector("audio");
    const path = normalizeFavoritePath(audioEl && (
      audioEl.dataset.src ||
      audioEl.getAttribute("data-src") ||
      audioEl.getAttribute("src") ||
      audioEl.currentSrc ||
      ""
    ));
    if (path) row.setAttribute("data-favorite-path", path);
    if (path) return path;
    const index = Number(row.getAttribute("data-track-index"));
    const uiTrack = Number.isFinite(index) && audioState.ui && Array.isArray(audioState.ui.tracks)
      ? audioState.ui.tracks[index]
      : null;
    const uiPath = normalizeFavoritePath(uiTrack && uiTrack.src ? uiTrack.src : "");
    if (uiPath) {
      row.setAttribute("data-favorite-path", uiPath);
      return uiPath;
    }
    return "";
  }

  function getAlbumRowFavoriteMeta(row) {
    const path = getAlbumRowFavoritePath(row);
    const meta = getTrackMetaByAssetPath(path, runtime.baseUrl.href) || {};
    const titleEl = row && row.querySelector(".track-name");
    return mergeTrackMetadata(Object.assign({}, meta, {
      name: meta.name || meta.title || (titleEl ? titleEl.textContent.trim() : ""),
      title: meta.title || meta.name || (titleEl ? titleEl.textContent.trim() : "")
    }));
  }

  function syncAlbumFavoriteRow(row) {
    if (!row) return;
    const path = getAlbumRowFavoritePath(row);
    const favoriteButton = row.querySelector("[data-track-favorite]");
    if (favoriteButton) {
      const isOn = isFavoritePath(path);
      setFavoriteButtonPath(favoriteButton, path);
      setFavoriteButtonState(favoriteButton, isOn);
      favoriteButton.hidden = !path;
      favoriteButton.disabled = !path;
      favoriteButton.setAttribute("aria-label", isOn ? "Retirer des favoris" : "Ajouter aux favoris");
    }

    const selectButton = row.querySelector("[data-track-select]");
    if (selectButton) {
      const section = row.closest(".tracks");
      const isSelecting = Boolean(section && section.classList.contains("album-favorite-selecting"));
      const isOn = isFavoritePath(path);
      setFavoriteButtonPath(selectButton, path);
      setFavoriteButtonState(selectButton, isOn);
      selectButton.setAttribute("aria-label", isOn ? "Retirer des favoris" : "Ajouter aux favoris");
      if (isSelecting) {
        selectButton.hidden = false;
        selectButton.disabled = false;
      } else {
        selectButton.hidden = true;
        selectButton.disabled = !path;
      }
    }
  }

  function syncAlbumFavoriteButtons() {
    document.querySelectorAll(".track-player").forEach(syncAlbumFavoriteRow);

    document.querySelectorAll("[data-album-favorite-toolbar]").forEach(function (toolbar) {
      const section = toolbar.closest(".tracks");
      const isSelecting = Boolean(section && section.classList.contains("album-favorite-selecting"));
      const toggle = toolbar.querySelector("[data-track-selection-toggle]");
      if (toggle) {
        toggle.innerHTML = isSelecting ? DONE_MODE_ICON : SELECT_MODE_ICON;
        toggle.classList.toggle("is-on", isSelecting);
        toggle.setAttribute("aria-label", isSelecting ? "Terminer la selection" : "Selectionner des titres");
        toggle.setAttribute("title", isSelecting ? "Terminer" : "Selectionner");
      }
      toolbar.classList.toggle("is-selecting", isSelecting);
    });
  }

  function setAlbumFavoriteSelectionMode(section, shouldSelect) {
    if (!section) return;
    section.classList.toggle("album-favorite-selecting", Boolean(shouldSelect));
    syncAlbumFavoriteButtons();
  }

  function logFavoriteSelectTap(row, path, wasFavorite, result, sourceButton) {
    const button = sourceButton || (row && row.querySelector("[data-track-select]"));
    const isOnApplied = Boolean(button && button.classList.contains("is-on"));
    const normalized = result && typeof result === "object" ? result : {};
    trackAudioRuntimeEvent("fav_select_tap", {
      track: path || "album_select",
      album: getCurrentAlbumTitle() || document.title || "",
      track_path: path || "",
      path: path || "",
      matched_cache: Boolean(wasFavorite),
      write_idb: normalized.write_idb || normalized.idb || "fail",
      write_local: normalized.write_local || normalized.local || "fail",
      is_on_applied: isOnApplied,
      hidden_attr: button ? Boolean(button.hidden) : null,
      disabled_attr: button ? Boolean(button.disabled) : null,
      surface: "album_select"
    });
  }

  function toggleAlbumFavoriteSelection(row, event) {
    const sourceButton = event && event.currentTarget && event.currentTarget.closest
      ? event.currentTarget.closest("[data-track-select]")
      : row && row.querySelector("[data-track-select]");
    const path = getFavoriteButtonPath(sourceButton, getAlbumRowFavoritePath(row));
    if (!path) {
      logFavoriteSelectTap(row, "", false, createFavoritePersistResult(false, false, true), sourceButton);
      trackFavoriteDebug("fav:path_missing", Object.assign({
        surface: "album_select",
        path: "",
        memory: "button_path_missing"
      }, getTapTelemetry(event)));
      return;
    }
    const wasFavorite = isFavoritePath(path);
    trackFavoriteDebug("fav:path_resolved", Object.assign({
      surface: "album_select",
      path,
      activeBefore: wasFavorite,
      memory: "tap"
    }, getTapTelemetry(event)));
    toggleFavoriteAndSync(path, "album_select", getAlbumRowFavoriteMeta(row))
      .then(function (result) {
        syncAlbumFavoriteRow(row);
        logFavoriteSelectTap(row, path, wasFavorite, result, sourceButton);
        if (isFavoritePersistOk(result) && !wasFavorite) pulseFavoriteButton(sourceButton);
      })
      .catch(function () {
        syncAlbumFavoriteRow(row);
        logFavoriteSelectTap(row, path, wasFavorite, createFavoritePersistResult(false, false, true), sourceButton);
      });
  }

  function ensureAlbumHeaderActions(section) {
    if (!section) return null;
    const heading = section.querySelector("h2");
    if (!heading) return null;
    let row = section.querySelector("[data-album-header-row]");
    if (!row) {
      row = document.createElement("div");
      row.className = "album-header-row";
      row.setAttribute("data-album-header-row", "");
      heading.insertAdjacentElement("beforebegin", row);
      row.appendChild(heading);
    } else if (heading.parentNode !== row) {
      row.insertBefore(heading, row.firstChild);
    }
    let actions = row.querySelector("[data-album-header-actions]");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "album-header-actions";
      actions.setAttribute("data-album-header-actions", "");
      row.appendChild(actions);
    }
    return actions;
  }

  function ensureAlbumFavoriteSelectionToolbar(section, afterElement) {
    if (!section || section.querySelector("[data-album-favorite-toolbar]")) return;
    const toolbar = document.createElement("div");
    toolbar.className = "album-selection-toolbar";
    toolbar.setAttribute("data-album-favorite-toolbar", "");
    toolbar.innerHTML = "<button class=\"album-selection-toggle\" type=\"button\" data-track-selection-toggle aria-label=\"Selectionner des titres\" title=\"Selectionner\">" + SELECT_MODE_ICON + "</button>";
    const actions = ensureAlbumHeaderActions(section);
    if (actions) {
      actions.appendChild(toolbar);
    } else {
      const target = afterElement && afterElement.parentNode === section ? afterElement : section.querySelector("h2");
      if (target) target.insertAdjacentElement("afterend", toolbar);
      else section.insertBefore(toolbar, section.firstChild);
    }

    const toggle = toolbar.querySelector("[data-track-selection-toggle]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        setAlbumFavoriteSelectionMode(section, !section.classList.contains("album-favorite-selecting"));
      });
    }
  }

  function ensureAlbumFavoriteControls(row, track, meta) {
    if (!row) return;
    const audioEl = row.querySelector("audio");
    const rowAudioSrc = row.getAttribute("data-audio-src") ||
      (audioEl && (audioEl.dataset.src || audioEl.getAttribute("data-src") || audioEl.getAttribute("src") || audioEl.currentSrc || "")) ||
      "";
    const path = normalizeFavoritePath(
      row.getAttribute("data-favorite-path") ||
      (track && track.src ? track.src : "") ||
      rowAudioSrc
    );
    if (rowAudioSrc) row.setAttribute("data-audio-src", rowAudioSrc);
    if (path) row.setAttribute("data-favorite-path", path);
    if (!path) {
      trackFavoriteDebug("fav:path_missing", {
        surface: "album_render",
        path: "",
        memory: "render_missing_path"
      });
    }

    let favoriteBtn = row.querySelector("[data-track-favorite]");
    if (!favoriteBtn) {
      favoriteBtn = document.createElement("button");
      favoriteBtn.className = "track-favorite-btn";
      favoriteBtn.type = "button";
      favoriteBtn.setAttribute("data-track-favorite", "");
      row.appendChild(favoriteBtn);
      favoriteBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        const currentPath = getFavoriteButtonPath(favoriteBtn, getAlbumRowFavoritePath(row));
        const wasFavorite = isFavoritePath(currentPath);
        trackFavoriteDebug(currentPath ? "fav:path_resolved" : "fav:path_missing", Object.assign({
          surface: "album_hover",
          path: currentPath,
          activeBefore: wasFavorite,
          memory: currentPath ? "tap" : "missing"
        }, getTapTelemetry(event)));
        toggleFavoriteAndSync(currentPath, "album_hover", getAlbumRowFavoriteMeta(row))
          .then(function (result) {
            if (isFavoritePersistOk(result) && !wasFavorite) pulseFavoriteButton(favoriteBtn);
          })
          .catch(function () {
            syncFavoriteSurface("album_hover", row);
          });
      });
    }

    let selectBtn = row.querySelector("[data-track-select]");
    if (!selectBtn) {
      selectBtn = document.createElement("button");
      selectBtn.className = "track-select-heart";
      selectBtn.type = "button";
      selectBtn.setAttribute("data-track-select", "");
      row.appendChild(selectBtn);
      selectBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleAlbumFavoriteSelection(row, event);
      });
    }

    setFavoriteButtonPath(favoriteBtn, path);
    setFavoriteButtonPath(selectBtn, path);
    setFavoriteButtonState(favoriteBtn, isFavoritePath(path));
    setFavoriteButtonState(selectBtn, isFavoritePath(path));
    syncAlbumFavoriteRow(row);
  }

  function toggleCurrentFavorite(surface, sourceButton, event) {
    const transport = audioState.transport;
    const path = getFavoriteButtonPath(sourceButton, getCurrentFavoritePath());
    if (!path) {
      trackFavoriteDebug("fav:path_missing", Object.assign({
        surface: surface || "overlay",
        path: "",
        memory: "current_path_missing"
      }, getTapTelemetry(event)));
      return;
    }
    const favoriteSurface = surface || "overlay";
    const currentTrack = mergeTrackMetadata(getCurrentPlaylistTrack() || {});
    const wasFavorite = isFavoritePath(path);
    trackFavoriteDebug("fav:path_resolved", Object.assign({
      surface: favoriteSurface,
      path,
      activeBefore: wasFavorite,
      memory: "tap"
    }, getTapTelemetry(event)));
    toggleFavoriteAndSync(path, favoriteSurface, currentTrack)
      .then(function (result) {
        syncFavoriteSurface(favoriteSurface);
        if (isFavoritePersistOk(result) && !wasFavorite) {
          pulseFavoriteButton(transport && transport.overlayFavorite);
          pulseFavoriteButton(transport && transport.favoriteBtn);
        }
        if (isFavoritePersistOk(result)) trackFavoritePathResolved(favoriteSurface, path);
      })
      .catch(function () {
        syncFavoriteSurface(favoriteSurface);
      });
  }

  function buildFavoritesPlaylist(entries) {
    const favorites = sortFavoriteEntries(entries);
    const playlist = [];
    const seen = new Set();
    favorites.forEach(function (entry) {
      const path = normalizeFavoritePath(entry && entry.path ? entry.path : "");
      if (!path || seen.has(path)) return;
      const meta = getTrackMetaByAssetPath(path, runtime.baseUrl.href);
      if (!meta || !meta.src) return;
      seen.add(path);
      playlist.push(Object.assign({}, meta, {
        src: meta.src || resolveManagedAudioSrc(path, runtime.baseUrl.href),
        favorite_added_at: Number(entry.added_at) || 0,
        favorite_sort_index: Number(entry.sort_index) || 0
      }));
    });
    return playlist;
  }

  function setFavoritesPlaylist(list) {
    const clean = Array.isArray(list)
      ? list.filter(function (track) { return track && track.src; })
      : [];
    if (!clean.length) return false;
    audioState.homeMode = "album";
    audioState.playlistKind = "favorites";
    clearRadioQueue();
    persistHomePlayMode("album");
    audioState.playlist = clean.slice();
    audioState.currentIndex = -1;
    audioState.albumPlaylistSnapshot = [];
    audioState.albumIndexSnapshot = -1;
    syncPlaylistContext(audioState.playlist);
    syncMediaSessionMetadata({ forcePosition: true });
    syncAudioUi();
    return true;
  }

  function startFavoritesPlaybackAt(startIndex) {
    if (audioState.favoritesStartInFlight) return;
    audioState.favoritesStartInFlight = true;
    syncCurrentFavoriteButtons();
    loadFavoritesWithReset()
      .then(function (entries) {
        const playlist = buildFavoritesPlaylist(entries);
        if (!playlist.length || !setFavoritesPlaylist(playlist)) return;
        let index = Number.isFinite(Number(startIndex)) ? Number(startIndex) : 0;
        if (audioState.shuffleOn) index = getRandomIndex(-1);
        if (index < 0 || index >= playlist.length) index = 0;
        trackAudioRuntimeEvent("favorites_play", {
          track: "favorites",
          album: "favorites",
          count: playlist.length,
          shuffle: Boolean(audioState.shuffleOn),
          start_index: index
        });
        startTrack(index, { seamless: true });
      })
      .catch(function () {
        audioState.favoritesDbSupported = false;
      })
      .finally(function () {
        audioState.favoritesStartInFlight = false;
        syncCurrentFavoriteButtons();
      });
  }

  function startFavoritesPlayback() {
    startFavoritesPlaybackAt(0);
  }

  function initHomeFavoritesButton() {
    if (audioState.homeFavoritesDelegatedBound) return;
    audioState.homeFavoritesDelegatedBound = true;
    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!target || !(target instanceof Element)) return;
      const button = target.closest("[data-home-favorites]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      trackAudioRuntimeEvent("home_fav_tap", {
        track: "favorites",
        album: "favorites",
        count: audioState.favoriteEntries.length,
        hidden_attr: Boolean(button.hidden),
        disabled_attr: Boolean(button.disabled),
        route: String(window.location.hash || "")
      });
      openFavoritesPage();
    });
  }

  function enhanceAlbumDownloadButtons() {
    if (infraDownloadsApi && typeof infraDownloadsApi.enhanceAlbumDownloadButtons === "function") {
      infraDownloadsApi.enhanceAlbumDownloadButtons({
        icon: DOWNLOAD_ICON,
        ensureAlbumHeaderActions: ensureAlbumHeaderActions
      });
    }
  }

  function scheduleFavoritesPreload(reason) {
    if (audioState.favoritesPreloadScheduled || audioState.favoritesPreloadDone) return;
    audioState.favoritesPreloadScheduled = true;
    const run = function () {
      loadFavoritesWithReset()
        .then(function () {
          audioState.favoritesPreloadDone = true;
        })
        .catch(function () {
          audioState.favoritesDbSupported = false;
          syncCurrentFavoriteButtons();
        })
        .finally(function () {
          audioState.favoritesPreloadScheduled = false;
        });
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1600 });
      return;
    }
    window.setTimeout(run, reason === "home_init" ? 350 : 700);
  }

  function isFavoritesRoute() {
    return String(window.location.hash || "") === "#favoris";
  }

  function getFavoritesViewRoot() {
    return document.querySelector("[data-favorites-view]");
  }

  function closeFavoritesPage() {
    audioState.favoritesSelectionMode = false;
    audioState.favoritesSelectedPaths.clear();
    const url = new URL(window.location.href);
    url.hash = "";
    history.pushState(null, "", url.pathname + url.search);
    syncFavoritesRoute();
  }

  function openFavoritesPage() {
    if (!document.body.classList.contains("home-screen")) {
      trackAudioRuntimeEvent("home_fav_tap", {
        track: "favorites",
        album: "favorites",
        count: audioState.favoriteEntries.length,
        route: "redirect",
        target: "index.html#favoris"
      });
      window.location.href = new URL("index.html#favoris", runtime.baseUrl.href).href;
      return;
    }
    beginFavoritesRenderTelemetry("tap");
    if (isFavoritesRoute()) {
      renderFavoritesPage();
      return;
    }
    window.location.hash = "favoris";
  }

  function refreshFavoritesViewIfOpen() {
    if (document.body.classList.contains("favorites-view-open")) {
      renderFavoritesPage();
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function formatTotalDuration(secondsValue) {
    const seconds = Number(secondsValue);
    if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes} min`;
  }

  function createFavoriteRowCover(track) {
    const url = resolveCoverUrl(track || null, { width: 900 });
    if (!url || srcMatches(url, getMediaSessionFallbackArtwork())) return "";
    return `<img class="infra-track-cover" src="${escapeAttribute(url)}" alt="" loading="lazy" decoding="async">`;
  }

  function getFavoriteRowTitle(track) {
    return String((track && (track.title || track.name)) || "").trim() || "Sans titre";
  }

  function getFavoriteRowAlbum(track) {
    return String((track && (track.albumTitle || track.album || track.albumSlug)) || "").trim().toUpperCase();
  }

  function buildFavoritesViewRows(entries) {
    const playlist = buildFavoritesPlaylist(entries);
    return playlist.map(function (track, index) {
      const title = getFavoriteRowTitle(track);
      const album = getFavoriteRowAlbum(track);
      const duration = String(track.duration || "").trim() || formatTrackDuration(track.seconds);
      const path = normalizeFavoritePath(track.src || "");
      return [
        `<div class="infra-track-row favorites-track-row" role="button" tabindex="0" data-favorite-index="${index}" data-favorite-path="${escapeAttribute(path)}">`,
        `  <span class="infra-track-cover-slot" aria-hidden="true">${createFavoriteRowCover(track)}</span>`,
        "  <span class=\"infra-track-meta\">",
        `    <span class="infra-track-title">${escapeHtml(title)}</span>`,
        `    <span class="infra-track-album">${escapeHtml(album)}</span>`,
        "  </span>",
        `  <span class="infra-track-duration">${escapeHtml(duration || "--:--")}</span>`,
        "  <button class=\"favorites-drag-handle\" type=\"button\" data-favorite-drag aria-label=\"Reordonner ce favori\">≡</button>",
        `  <button class="favorites-select-btn" type="button" data-favorite-select data-favorite-path="${escapeAttribute(path)}" aria-label="Selectionner ${escapeAttribute(title)}" aria-pressed="false">${getFavoritesSelectIcon(false)}</button>`,
        "</div>"
      ].join("");
    }).join("");
  }

  function getOrCreateFavoritesView() {
    const main = document.querySelector(".one-page-layout");
    if (!main) return null;
    let view = getFavoritesViewRoot();
    if (!view) {
      view = document.createElement("section");
      view.className = "favorites-view";
      view.setAttribute("data-favorites-view", "");
      view.setAttribute("aria-label", "Favoris");
      main.appendChild(view);
    }
    return view;
  }

  function getFavoritesRenderStartTs() {
    if (Number.isFinite(audioState.favoritesRenderStartTs) && audioState.favoritesRenderStartTs > 0) {
      return audioState.favoritesRenderStartTs;
    }
    return beginFavoritesRenderTelemetry("route");
  }

  function beginFavoritesRenderTelemetry(reason) {
    const startedAt = getAudioTelemetryNow();
    audioState.favoritesRenderStartTs = startedAt;
    trackAudioRuntimeEvent("favorites_open", {
      track: "favorites",
      album: "favorites",
      count: audioState.favoriteEntries.length,
      reason: reason || "unknown"
    });
    trackAudioRuntimeEvent("favorites_render_start", {
      track: "favorites",
      album: "favorites",
      count: audioState.favoriteEntries.length,
      reason: reason || "unknown",
      preloaded: Boolean(audioState.favoritesLoaded && audioState.tracksData)
    });
    return startedAt;
  }

  function getFavoritesRenderDuration(startedAt) {
    const started = Number(startedAt);
    if (!Number.isFinite(started) || started <= 0) return null;
    return Math.max(0, Math.round(getAudioTelemetryNow() - started));
  }

  function getFavoritesBackIcon() {
    return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentColor\" d=\"M12 3.2 3.5 10.4V21h6.1v-6.2h4.8V21h6.1V10.4L12 3.2Zm6.5 15.8h-2.1v-6.2H7.6V19H5.5v-7.7L12 5.8l6.5 5.5V19Z\"/></svg>";
  }

  function getFavoritesSelectIcon(isSelected) {
    return isSelected
      ? "<svg class=\"favorites-select-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"8.4\" fill=\"currentColor\"/><path fill=\"none\" stroke=\"#fff\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.1\" d=\"m8.3 12.2 2.35 2.35 5.05-5.1\"/></svg>"
      : "<svg class=\"favorites-select-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"8.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m8.8 12.2 2.15 2.15 4.7-4.7\"/></svg>";
  }

  function getFavoritesSelectedCount() {
    return audioState.favoritesSelectedPaths instanceof Set ? audioState.favoritesSelectedPaths.size : 0;
  }

  function setFavoritesSelectionMode(view, enabled) {
    audioState.favoritesSelectionMode = Boolean(enabled);
    if (!audioState.favoritesSelectionMode) audioState.favoritesSelectedPaths.clear();
    syncFavoritesSelectionUi(view || getFavoritesViewRoot());
  }

  function syncFavoritesSelectionUi(view) {
    if (!view) return;
    const selecting = Boolean(audioState.favoritesSelectionMode);
    const selectedCount = getFavoritesSelectedCount();
    view.classList.toggle("favorites-selecting", selecting);
    view.querySelectorAll("[data-favorite-index]").forEach(function (row) {
      const path = normalizeFavoritePath(row.getAttribute("data-favorite-path") || "");
      const isSelected = Boolean(path && audioState.favoritesSelectedPaths.has(path));
      row.classList.toggle("is-selected", isSelected);
      const button = row.querySelector("[data-favorite-select]");
      if (button) {
        button.classList.toggle("is-on", isSelected);
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        button.innerHTML = getFavoritesSelectIcon(isSelected);
      }
    });
    const toggle = view.querySelector("[data-favorites-select-toggle]");
    if (toggle) {
      toggle.textContent = selecting ? "Termine" : "Selectionner";
      toggle.setAttribute("aria-pressed", selecting ? "true" : "false");
    }
    const remove = view.querySelector("[data-favorites-remove-selected]");
    if (remove) {
      remove.hidden = !selecting;
      remove.disabled = selectedCount <= 0;
      remove.textContent = selectedCount > 0
        ? `Retirer des favoris (${selectedCount})`
        : "Retirer des favoris";
    }
  }

  function toggleFavoritesSelectionPath(pathLike, view) {
    const path = normalizeFavoritePath(pathLike || "");
    if (!path) return;
    if (audioState.favoritesSelectedPaths.has(path)) audioState.favoritesSelectedPaths.delete(path);
    else audioState.favoritesSelectedPaths.add(path);
    syncFavoritesSelectionUi(view || getFavoritesViewRoot());
  }

  function removeSelectedFavorites(view) {
    const paths = Array.from(audioState.favoritesSelectedPaths || []).filter(Boolean);
    if (!paths.length) return;
    audioState.favoritesSelectedPaths.clear();
    audioState.favoritesSelectionMode = false;
    paths.forEach(function (path) {
      const row = view && Array.from(view.querySelectorAll("[data-favorite-path]")).find(function (candidate) {
        return normalizeFavoritePath(candidate.getAttribute("data-favorite-path") || "") === path;
      });
      if (row) row.remove();
    });
    Promise.all(paths.map(function (path) {
      return isFavoritePath(path)
        ? toggleFavoriteAndSync(path, "favorites_page_selection")
        : Promise.resolve(false);
    })).finally(function () {
      renderFavoritesPage();
    });
  }

  function renderFavoritesShell(view, startedAt, showSkeleton) {
    if (!view) return;
    if (!view.querySelector("[data-favorites-content]")) {
      const skeleton = showSkeleton === false
        ? ""
        : [
          "  <div class=\"favorites-skeleton\" aria-live=\"polite\">",
          "    <span></span><span></span><span></span>",
          "  </div>"
        ].join("");
      view.innerHTML = [
        "<div class=\"favorites-view-header\">",
        "  <button class=\"favorites-back\" type=\"button\" data-favorites-back aria-label=\"Retour a l'accueil\">" + getFavoritesBackIcon() + "</button>",
        "  <h2 data-favorites-title>Favoris</h2>",
        "  <div class=\"favorites-view-actions\">",
        "    <button class=\"favorites-select-toggle\" type=\"button\" data-favorites-select-toggle aria-pressed=\"false\">Selectionner</button>",
        "    <button class=\"favorites-remove-selected\" type=\"button\" data-favorites-remove-selected hidden disabled>Retirer des favoris</button>",
        "  </div>",
        "</div>",
        "<div data-favorites-content>",
        skeleton,
        "</div>"
      ].join("");
    } else {
      const title = view.querySelector("[data-favorites-title]");
      if (title && !title.textContent.trim()) title.textContent = "Favoris";
    }
    document.body.classList.add("favorites-view-open");
    bindFavoritesView(view);
    syncFavoritesSelectionUi(view);
    trackAudioRuntimeEvent("favorites_visible", {
      track: "favorites",
      album: "favorites",
      duration_ms: getFavoritesRenderDuration(startedAt),
      shell: true
    });
  }

  function renderFavoritesPage() {
    if (!document.body.classList.contains("home-screen")) return;
    if (audioState.favoritesViewRendering) return;
    audioState.favoritesViewRendering = true;
    const startedAt = getFavoritesRenderStartTs();
    const wasPreloaded = Boolean(audioState.favoritesLoaded && audioState.tracksData);
    const view = getOrCreateFavoritesView();
    if (!view) {
      trackAudioRuntimeEvent("favorites_render_fail", {
        track: "favorites",
        album: "favorites",
        reason: "missing_view",
        duration_ms: getFavoritesRenderDuration(startedAt)
      });
      audioState.favoritesViewRendering = false;
      return;
    }
    renderFavoritesShell(view, startedAt, !wasPreloaded);
    loadFavoritesWithReset()
      .then(function (favoriteEntries) {
        const entries = sortFavoriteEntries(favoriteEntries || []);
        const totalSeconds = buildFavoritesPlaylist(entries).reduce(function (sum, track) {
          const seconds = Number(track && track.seconds);
          return sum + (Number.isFinite(seconds) ? seconds : parseDurationText(track && track.duration));
        }, 0);
        const count = entries.length;
        const title = view.querySelector("[data-favorites-title]");
        const content = view.querySelector("[data-favorites-content]");
        if (!count) {
          audioState.favoritesSelectionMode = false;
          audioState.favoritesSelectedPaths.clear();
        }
        if (title) {
          title.innerHTML = count
            ? `Favoris · ${count} titre${count > 1 ? "s" : ""} · ${escapeHtml(formatTotalDuration(totalSeconds))}`
            : "Favoris";
        }
        if (content) {
          content.innerHTML = count
            ? `<div class="infra-track-list favorites-track-list" data-favorites-list>${buildFavoritesViewRows(entries)}</div>`
            : "<p class=\"favorites-empty\">Aucun favori pour l'instant.</p>";
        }

        document.body.classList.add("favorites-view-open");
        bindFavoritesView(view);
        syncFavoritesSelectionUi(view);
        trackAudioRuntimeEvent("favorites_render_done", {
          track: "favorites",
          album: "favorites",
          count,
          duration_ms: getFavoritesRenderDuration(startedAt),
          preloaded: wasPreloaded,
          list_ready: true
        });
      })
      .catch(function (err) {
        audioState.favoritesDbSupported = false;
        trackAudioRuntimeEvent("favorites_render_fail", {
          track: "favorites",
          album: "favorites",
          reason: err && err.name ? String(err.name) : "render_error",
          duration_ms: getFavoritesRenderDuration(startedAt)
        });
        syncCurrentFavoriteButtons();
      })
      .finally(function () {
        audioState.favoritesViewRendering = false;
        audioState.favoritesRenderStartTs = 0;
      });
  }

  function bindFavoritesView(view) {
    const back = view.querySelector("[data-favorites-back]");
    if (back && back.dataset.bound !== "1") {
      back.dataset.bound = "1";
      back.addEventListener("click", function () {
        closeFavoritesPage();
      });
    }
    const selectToggle = view.querySelector("[data-favorites-select-toggle]");
    if (selectToggle && selectToggle.dataset.bound !== "1") {
      selectToggle.dataset.bound = "1";
      selectToggle.addEventListener("click", function () {
        setFavoritesSelectionMode(view, !audioState.favoritesSelectionMode);
      });
    }
    const removeSelected = view.querySelector("[data-favorites-remove-selected]");
    if (removeSelected && removeSelected.dataset.bound !== "1") {
      removeSelected.dataset.bound = "1";
      removeSelected.addEventListener("click", function () {
        removeSelectedFavorites(view);
      });
    }
    view.querySelectorAll("[data-favorite-index]").forEach(function (row) {
      if (row.dataset.bound === "1") return;
      row.dataset.bound = "1";
      row.addEventListener("click", function (event) {
        if (event.target && event.target.closest("[data-favorite-drag], [data-favorite-select]")) return;
        if (audioState.favoritesSelectionMode) {
          event.preventDefault();
          toggleFavoritesSelectionPath(row.getAttribute("data-favorite-path") || "", view);
          return;
        }
        startFavoritesPlaybackAt(Number(row.dataset.favoriteIndex) || 0);
      });
      row.addEventListener("keydown", function (event) {
        if (event.target && event.target.closest("[data-favorite-drag], [data-favorite-select]")) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (audioState.favoritesSelectionMode) {
          toggleFavoritesSelectionPath(row.getAttribute("data-favorite-path") || "", view);
          return;
        }
        startFavoritesPlaybackAt(Number(row.dataset.favoriteIndex) || 0);
      });
    });
    view.querySelectorAll("[data-favorite-select]").forEach(function (button) {
      if (button.dataset.bound === "1") return;
      button.dataset.bound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        const row = button.closest("[data-favorite-index]");
        const path = normalizeFavoritePath(button.getAttribute("data-favorite-path") || (row && row.getAttribute("data-favorite-path")) || "");
        toggleFavoritesSelectionPath(path, view);
      });
    });
    view.querySelectorAll("[data-favorite-drag]").forEach(function (handle) {
      if (handle.dataset.bound === "1") return;
      handle.dataset.bound = "1";
      handle.addEventListener("pointerdown", function (event) {
        const row = handle.closest("[data-favorite-index]");
        if (!row) return;
        audioState.favoritesDragState = {
          startIndex: Number(row.dataset.favoriteIndex) || 0,
          pointerId: event.pointerId,
          row
        };
        handle.setPointerCapture(event.pointerId);
        row.classList.add("is-dragging");
        event.preventDefault();
      });
      handle.addEventListener("pointermove", function (event) {
        const state = audioState.favoritesDragState;
        if (!state || state.pointerId !== event.pointerId || !state.row) return;
        const list = view.querySelector("[data-favorites-list]");
        if (!list) return;
        const beforeRects = new Map();
        list.querySelectorAll(".favorites-track-row").forEach(function (row) {
          beforeRects.set(row, row.getBoundingClientRect());
        });
        const rows = Array.from(list.querySelectorAll(".favorites-track-row:not(.is-dragging)"));
        const beforeRow = rows.find(function (candidate) {
          const rect = candidate.getBoundingClientRect();
          return event.clientY < rect.top + rect.height / 2;
        });
        if (beforeRow) list.insertBefore(state.row, beforeRow);
        else list.appendChild(state.row);
        list.querySelectorAll(".favorites-track-row:not(.is-dragging)").forEach(function (row) {
          const before = beforeRects.get(row);
          if (!before) return;
          const after = row.getBoundingClientRect();
          const delta = before.top - after.top;
          if (!delta) return;
          row.style.transform = `translateY(${delta}px)`;
          row.style.transition = "transform 0s";
          requestAnimationFrame(function () {
            row.style.transition = "";
            row.style.transform = "";
          });
        });
        event.preventDefault();
      });
      handle.addEventListener("pointerup", function (event) {
        const state = audioState.favoritesDragState;
        audioState.favoritesDragState = null;
        const sourceRow = state && state.row ? state.row : view.querySelector(".favorites-track-row.is-dragging");
        if (sourceRow) sourceRow.classList.remove("is-dragging");
        if (!state) return;
        const list = view.querySelector("[data-favorites-list]");
        const rows = list ? Array.from(list.querySelectorAll(".favorites-track-row")) : [];
        const endIndex = sourceRow ? rows.indexOf(sourceRow) : state.startIndex;
        reorderFavorites(state.startIndex, endIndex);
      });
      handle.addEventListener("pointercancel", function () {
        audioState.favoritesDragState = null;
        view.querySelectorAll(".favorites-track-row.is-dragging").forEach(function (row) {
          row.classList.remove("is-dragging");
        });
      });
    });
  }

  function reorderFavorites(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const entries = sortFavoriteEntries(audioState.favoriteEntries);
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= entries.length || toIndex >= entries.length) return;
    const moved = entries.splice(fromIndex, 1)[0];
    entries.splice(toIndex, 0, moved);
    const ordered = entries.map(function (entry, index) {
      return Object.assign({}, entry, { sort_index: (index + 1) * 1000 });
    });
    syncFavoriteEntryState(ordered);
    persistFavoriteOrder(ordered).catch(function () {
      audioState.favoritesDbSupported = false;
      syncCurrentFavoriteButtons();
    });
    trackAudioRuntimeEvent("favorites_reorder", {
      track: "favorites",
      album: "favorites",
      count: ordered.length
    });
    renderFavoritesPage();
  }

  function syncFavoritesRoute() {
    if (!document.body.classList.contains("home-screen")) return;
    if (isFavoritesRoute()) {
      renderFavoritesPage();
      return;
    }
    document.body.classList.remove("favorites-view-open");
    audioState.favoritesSelectionMode = false;
    audioState.favoritesSelectedPaths.clear();
    const view = getFavoritesViewRoot();
    if (view) view.remove();
  }

  function initFavoritesRoute() {
    if (audioState.favoritesRouteBound) return;
    audioState.favoritesRouteBound = true;
    window.addEventListener("hashchange", syncFavoritesRoute);
  }

    return {
      createUnavailableFavoritesStorage: createUnavailableFavoritesStorage,
      getFavoritesStorage: getFavoritesStorage,
      openFavoritesDb: openFavoritesDb,
      withFavoritesStore: withFavoritesStore,
      canonicalFavoritePath: canonicalFavoritePath,
      normalizeFavoritePath: normalizeFavoritePath,
      getTelemetryElementSelector: getTelemetryElementSelector,
      getTapTelemetry: getTapTelemetry,
      trackFavoriteDebug: trackFavoriteDebug,
      trackFavoritePathResolved: trackFavoritePathResolved,
      sortFavoriteEntries: sortFavoriteEntries,
      assignFavoriteSortIndexes: assignFavoriteSortIndexes,
      readLocalFavoriteEntries: readLocalFavoriteEntries,
      writeLocalFavoriteEntries: writeLocalFavoriteEntries,
      persistFavoriteOrder: persistFavoriteOrder,
      syncFavoriteEntryState: syncFavoriteEntryState,
      loadFavoriteEntries: loadFavoriteEntries,
      readFavoritesResetVersion: readFavoritesResetVersion,
      writeFavoritesResetVersion: writeFavoritesResetVersion,
      replaceFavoritesStoreWithResetMarker: replaceFavoritesStoreWithResetMarker,
      ensureFavoritesReset: ensureFavoritesReset,
      loadFavoritesWithReset: loadFavoritesWithReset,
      getCurrentFavoritePath: getCurrentFavoritePath,
      isFavoritePath: isFavoritePath,
      getHeartIcon: getHeartIcon,
      setFavoriteButtonState: setFavoriteButtonState,
      setFavoriteButtonPath: setFavoriteButtonPath,
      getFavoriteButtonPath: getFavoriteButtonPath,
      deleteFavoriteEntry: deleteFavoriteEntry,
      syncCurrentFavoriteButtons: syncCurrentFavoriteButtons,
      syncFavoriteButtons: syncFavoriteButtons,
      syncFavoriteSurface: syncFavoriteSurface,
      pulseFavoriteButton: pulseFavoriteButton,
      getNextFavoriteSortIndex: getNextFavoriteSortIndex,
      getFavoriteSnapshot: getFavoriteSnapshot,
      restoreFavoriteSnapshot: restoreFavoriteSnapshot,
      createFavoritePersistResult: createFavoritePersistResult,
      isFavoritePersistOk: isFavoritePersistOk,
      applyFavoriteMemoryState: applyFavoriteMemoryState,
      persistFavoriteMemoryState: persistFavoriteMemoryState,
      setFavoritePath: setFavoritePath,
      toggleFavoritePath: toggleFavoritePath,
      toggleFavoriteAndSync: toggleFavoriteAndSync,
      getAlbumRowFavoritePath: getAlbumRowFavoritePath,
      getAlbumRowFavoriteMeta: getAlbumRowFavoriteMeta,
      syncAlbumFavoriteRow: syncAlbumFavoriteRow,
      syncAlbumFavoriteButtons: syncAlbumFavoriteButtons,
      setAlbumFavoriteSelectionMode: setAlbumFavoriteSelectionMode,
      logFavoriteSelectTap: logFavoriteSelectTap,
      toggleAlbumFavoriteSelection: toggleAlbumFavoriteSelection,
      ensureAlbumHeaderActions: ensureAlbumHeaderActions,
      ensureAlbumFavoriteSelectionToolbar: ensureAlbumFavoriteSelectionToolbar,
      ensureAlbumFavoriteControls: ensureAlbumFavoriteControls,
      toggleCurrentFavorite: toggleCurrentFavorite,
      buildFavoritesPlaylist: buildFavoritesPlaylist,
      setFavoritesPlaylist: setFavoritesPlaylist,
      startFavoritesPlaybackAt: startFavoritesPlaybackAt,
      startFavoritesPlayback: startFavoritesPlayback,
      initHomeFavoritesButton: initHomeFavoritesButton,
      enhanceAlbumDownloadButtons: enhanceAlbumDownloadButtons,
      scheduleFavoritesPreload: scheduleFavoritesPreload,
      isFavoritesRoute: isFavoritesRoute,
      getFavoritesViewRoot: getFavoritesViewRoot,
      closeFavoritesPage: closeFavoritesPage,
      openFavoritesPage: openFavoritesPage,
      refreshFavoritesViewIfOpen: refreshFavoritesViewIfOpen,
      escapeHtml: escapeHtml,
      escapeAttribute: escapeAttribute,
      formatTotalDuration: formatTotalDuration,
      createFavoriteRowCover: createFavoriteRowCover,
      getFavoriteRowTitle: getFavoriteRowTitle,
      getFavoriteRowAlbum: getFavoriteRowAlbum,
      buildFavoritesViewRows: buildFavoritesViewRows,
      getOrCreateFavoritesView: getOrCreateFavoritesView,
      getFavoritesRenderStartTs: getFavoritesRenderStartTs,
      beginFavoritesRenderTelemetry: beginFavoritesRenderTelemetry,
      getFavoritesRenderDuration: getFavoritesRenderDuration,
      getFavoritesBackIcon: getFavoritesBackIcon,
      getFavoritesSelectIcon: getFavoritesSelectIcon,
      getFavoritesSelectedCount: getFavoritesSelectedCount,
      setFavoritesSelectionMode: setFavoritesSelectionMode,
      syncFavoritesSelectionUi: syncFavoritesSelectionUi,
      toggleFavoritesSelectionPath: toggleFavoritesSelectionPath,
      removeSelectedFavorites: removeSelectedFavorites,
      renderFavoritesShell: renderFavoritesShell,
      renderFavoritesPage: renderFavoritesPage,
      bindFavoritesView: bindFavoritesView,
      reorderFavorites: reorderFavorites,
      syncFavoritesRoute: syncFavoritesRoute,
      initFavoritesRoute: initFavoritesRoute
    };
  }

  window.InfraFavoritesUi = Object.assign(window.InfraFavoritesUi || {}, {
    createFavoritesUi: createFavoritesUi
  });
})();
