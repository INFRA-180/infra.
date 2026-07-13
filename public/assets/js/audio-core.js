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

  function createAudioCore(context) {
    const ctx = context || {};
    const audioState = ctx.audioState || {};
    const PREFETCH_NEXT_ENABLED = Boolean(ctx.PREFETCH_NEXT_ENABLED);

    const savePlaybackQueueContext = method(ctx, "savePlaybackQueueContext");
    const getCurrentLogicalAudioSrc = method(ctx, "getCurrentLogicalAudioSrc", function () { return ""; });
    const srcMatches = method(ctx, "srcMatches", function () { return false; });
    const extractFilenameFromSrc = method(ctx, "extractFilenameFromSrc", function () { return ""; });
    const hashString = method(ctx, "hashString", function () { return 0; });
    const ensureRadioQueue = method(ctx, "ensureRadioQueue", function () { return false; });
    const normalizeAudioSourceUrl = method(ctx, "normalizeAudioSourceUrl", function (value) { return String(value || ""); });
    const revokeActiveBlobUrl = method(ctx, "revokeActiveBlobUrl");
    const loadMediaElementForPlayback = method(ctx, "loadMediaElementForPlayback");
    const toAbsoluteUrlOrEmpty = method(ctx, "toAbsoluteUrlOrEmpty", function (value) { return String(value || ""); });
    const getCurrentPlayableAudioSrc = method(ctx, "getCurrentPlayableAudioSrc", function () { return ""; });
    const registerTrackFailure = method(ctx, "registerTrackFailure", function () { return 0; });
    const getTrackByIndex = method(ctx, "getTrackByIndex", function () { return null; });
    const setTrackStatus = method(ctx, "setTrackStatus");
    const clearFadeTimer = method(ctx, "clearFadeTimer");
    const syncAudioUi = method(ctx, "syncAudioUi");
    const clearWaitingRecovery = method(ctx, "clearWaitingRecovery");
    const clearOtherTrackStatuses = method(ctx, "clearOtherTrackStatuses");
    const clearTrackStatus = method(ctx, "clearTrackStatus");
    const getAudioTelemetryNow = method(ctx, "getAudioTelemetryNow", function () { return Date.now(); });
    const getAudioAssetPath = method(ctx, "getAudioAssetPath", function () { return ""; });
    const trackAudioRuntimeEvent = method(ctx, "trackAudioRuntimeEvent");
    const buildAudioMonitorPayload = method(ctx, "buildAudioMonitorPayload", function () { return {}; });
    const logAudioAuditEvent = method(ctx, "logAudioAuditEvent");
    const getAudioSource = method(ctx, "getAudioSource", function () { return ""; });
    const clearNextTrackPrefetch = method(ctx, "clearNextTrackPrefetch");
    const resetPreparedInitialGlobalRandomPlayback = method(ctx, "resetPreparedInitialGlobalRandomPlayback");
    const clearTrackFailure = method(ctx, "clearTrackFailure");
    const fadeInAudio = method(ctx, "fadeInAudio");
    const forceAudioFullVolume = method(ctx, "forceAudioFullVolume");
    const bindMediaSessionActions = method(ctx, "bindMediaSessionActions");
    const syncMediaSessionMetadata = method(ctx, "syncMediaSessionMetadata");
    const scheduleMediaSessionResync = method(ctx, "scheduleMediaSessionResync");
    const startAudioRaf = method(ctx, "startAudioRaf");
    const fadeOutAudio = method(ctx, "fadeOutAudio", function () { return Promise.resolve(); });
    const isIosDevice = method(ctx, "isIosDevice", function () { return false; });
    const scheduleSilentCheck = method(ctx, "scheduleSilentCheck");
    const getAutoPrefetchedNextIndex = method(ctx, "getAutoPrefetchedNextIndex", function () { return -1; });
    const ensureRadioPlaylistForNavigation = method(ctx, "ensureRadioPlaylistForNavigation", function () { return true; });
    const ensurePlayablePlaylistContext = method(ctx, "ensurePlayablePlaylistContext");
    const canStartInitialGlobalRandomPlayback = method(ctx, "canStartInitialGlobalRandomPlayback", function () { return false; });
    const startGlobalRandomPlayback = method(ctx, "startGlobalRandomPlayback");
    const ensureRadioPlaylistLoaded = method(ctx, "ensureRadioPlaylistLoaded", function () { return Promise.resolve([]); });
    const syncRadioQueueToPlaylist = method(ctx, "syncRadioQueueToPlaylist");
    const updateProgressUi = method(ctx, "updateProgressUi");
    const saveResumeState = method(ctx, "saveResumeState");
    const markAudioPauseIntent = method(ctx, "markAudioPauseIntent");
    const extendAlbumPlaylistToNextAlbum = method(ctx, "extendAlbumPlaylistToNextAlbum", function () { return -1; });
    const beginAudioRecovery = method(ctx, "beginAudioRecovery");
    const failAudioRecovery = method(ctx, "failAudioRecovery");

    const IOS_NAVIGATION_DEFER_MS = 180;
    const IOS_NAVIGATION_DEFER_MAX_MS = 1600;

    function clearPendingTransportNavigationTimer() {
      if (audioState.pendingTransportNavigationTimer) {
        window.clearTimeout(audioState.pendingTransportNavigationTimer);
        audioState.pendingTransportNavigationTimer = null;
      }
    }

    function hasUnstablePlaybackStart() {
      return Boolean(audioState.trackStartInFlight || audioState.activeAudioRecovery);
    }

    function cloneNavigationOptions(options) {
      const source = options || {};
      const cloned = {
        fromMediaSession: Boolean(source.fromMediaSession),
        fromTransportControl: Boolean(source.fromTransportControl),
        surface: source.surface || ""
      };
      if (Object.prototype.hasOwnProperty.call(source, "seamless")) {
        cloned.seamless = Boolean(source.seamless);
      }
      return cloned;
    }

    function schedulePendingTransportNavigation(reason) {
      const pending = audioState.pendingTransportNavigation;
      if (!pending) return;
      clearPendingTransportNavigationTimer();
      audioState.pendingTransportNavigationTimer = window.setTimeout(function () {
        flushPendingTransportNavigation(reason || "timer");
      }, IOS_NAVIGATION_DEFER_MS);
    }

    function flushPendingTransportNavigation(reason) {
      const pending = audioState.pendingTransportNavigation;
      if (!pending) return;
      const ageMs = Date.now() - pending.queuedAt;
      if (hasUnstablePlaybackStart() && ageMs < IOS_NAVIGATION_DEFER_MAX_MS) {
        pending.attempts += 1;
        schedulePendingTransportNavigation("still_unstable");
        return;
      }

      clearPendingTransportNavigationTimer();
      audioState.pendingTransportNavigation = null;
      const currentTrack = getTrackByIndex(audioState.currentIndex);
      trackAudioRuntimeEvent("transport_navigation_replayed", Object.assign(
        buildAudioMonitorPayload(currentTrack, audioState.currentIndex, currentTrack && currentTrack.src ? currentTrack.src : ""),
        {
          direction: pending.direction,
          age_ms: Math.max(0, Math.round(ageMs)),
          attempts: pending.attempts,
          reason: reason || "ready",
          from_transport_control: pending.options.fromTransportControl,
          from_media_session: pending.options.fromMediaSession,
          surface: pending.options.surface || ""
        }
      ));
      const replayOptions = Object.assign({}, pending.options, { replayed: true });
      if (pending.direction < 0) {
        playPrevious(replayOptions);
      } else {
        playNext(replayOptions);
      }
    }

    function queueIosTransportNavigation(direction, options, targetIndex, targetTrack, prefetched) {
      const opts = options || {};
      if (!isIosDevice() || opts.auto || opts.replayed) return false;
      if (!opts.fromTransportControl && !opts.fromMediaSession) return false;
      if (!hasUnstablePlaybackStart()) return false;

      const clonedOptions = cloneNavigationOptions(opts);
      audioState.pendingTransportNavigation = {
        direction,
        options: clonedOptions,
        queuedAt: Date.now(),
        attempts: 0
      };
      trackAudioRuntimeEvent("transport_navigation_deferred", Object.assign(
        buildAudioMonitorPayload(targetTrack, targetIndex, targetTrack && targetTrack.src ? targetTrack.src : ""),
        {
          direction,
          target_index: targetIndex,
          prefetched: Boolean(prefetched),
          reason: audioState.activeAudioRecovery ? "recovery" : "track_start",
          from_transport_control: clonedOptions.fromTransportControl,
          from_media_session: clonedOptions.fromMediaSession,
          surface: clonedOptions.surface || ""
        }
      ));
      schedulePendingTransportNavigation("queued");
      return true;
    }

    function seekCurrentAudioToRatio(ratio) {
      const audio = audioState.audio;
      if (!audio) return;
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

      const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
      audio.currentTime = clamped * audio.duration;
      updateProgressUi();
      saveResumeState();
      syncMediaSessionMetadata({ forcePosition: true });
    }

    function computePlaylistToken(list) {
      if (!Array.isArray(list) || !list.length) return "";
      return list.map((track) => String((track && track.src) || "").trim()).join("|");
    }

    function syncPlaylistContext(list, options) {
      const opts = options || {};
      const nextToken = computePlaylistToken(list);
      if (nextToken !== audioState.playlistToken) {
        audioState.playlistToken = nextToken;
        if (!opts.preserveRecent) audioState.recentPlayed = [];
      }
      savePlaybackQueueContext();
    }

    function rememberPlayedIndex(index) {
      if (!Number.isInteger(index) || index < 0) return;
      const list = audioState.recentPlayed;
      const existingAt = list.indexOf(index);
      if (existingAt >= 0) list.splice(existingAt, 1);
      list.push(index);

      const dynamicLimit = Math.max(2, Math.min(audioState.playlist.length - 1, audioState.recentPlayedLimit));
      while (list.length > dynamicLimit) {
        list.shift();
      }
    }

    function ensureCurrentIndexFromAudio() {
      const audio = audioState.audio;
      if (!audio || !audioState.playlist.length) return -1;
      const src = getCurrentLogicalAudioSrc();
      if (!src) return -1;
      const matchIndex = audioState.playlist.findIndex((track) => srcMatches(track.src, src));
      if (matchIndex >= 0) {
        audioState.currentIndex = matchIndex;
        return matchIndex;
      }

      const srcFile = extractFilenameFromSrc(src);
      if (srcFile) {
        const byFile = audioState.playlist.findIndex((track) => extractFilenameFromSrc(track && track.src) === srcFile);
        if (byFile >= 0) {
          audioState.currentIndex = byFile;
          return byFile;
        }
      }

      return -1;
    }

    function getCurrentPlaylistIndexSafe() {
      const list = audioState.playlist;
      if (!Array.isArray(list) || !list.length) return -1;
      if (
        Number.isInteger(audioState.currentIndex) &&
        audioState.currentIndex >= 0 &&
        audioState.currentIndex < list.length
      ) {
        return audioState.currentIndex;
      }
      const fromAudio = ensureCurrentIndexFromAudio();
      if (fromAudio >= 0) return fromAudio;
      return 0;
    }

    function getQueuePreviewIndices(limit) {
      let list = audioState.playlist;
      if (!Array.isArray(list) || !list.length) return [];
      const currentIndex = getCurrentPlaylistIndexSafe();
      if (
        currentIndex >= 0 &&
        currentIndex >= list.length - 1 &&
        audioState.homeMode !== "radio" &&
        !audioState.shuffleOn
      ) {
        const extendedIndex = extendAlbumPlaylistToNextAlbum({
          reason: "queue_preview",
          fromIndex: currentIndex
        });
        if (Number.isInteger(extendedIndex) && extendedIndex >= 0) {
          list = audioState.playlist;
        }
      }
      if (!Array.isArray(list) || list.length < 2) return [];
      const max = Math.max(1, Math.min(Number(limit) || 8, list.length - 1));
      if (currentIndex < 0 || currentIndex >= list.length) {
        return list.map((_track, index) => index).slice(0, max);
      }

      if (audioState.homeMode === "radio" && Array.isArray(audioState.radioQueue) && audioState.radioQueue.length) {
        ensureRadioQueue(Math.max(audioState.radioQueueMinRemaining, max));
        const cursor = Number.isInteger(audioState.radioQueueCursor) && audioState.radioQueueCursor >= 0
          ? audioState.radioQueueCursor
          : currentIndex;
        const ordered = [];
        for (let step = 1; cursor + step < audioState.radioQueue.length && ordered.length < max; step += 1) {
          ordered.push(cursor + step);
        }
        return ordered;
      }

      const randomMode = audioState.shuffleOn;
      if (!randomMode) {
        const ordered = [];
        for (let index = currentIndex + 1; index < list.length && ordered.length < max; index += 1) {
          ordered.push(index);
        }
        return ordered;
      }

      const seedTrack = list[currentIndex];
      const seed = hashString(
        `${seedTrack && seedTrack.src ? seedTrack.src : currentIndex}|${audioState.playlistToken}|${audioState.homeMode}`
      );
      return list
        .map((track, index) => ({
          index,
          weight: hashString(`${seed}:${track && track.src ? track.src : index}:${index}`)
        }))
        .filter((entry) => entry.index !== currentIndex)
        .sort((left, right) => left.weight - right.weight)
        .slice(0, max)
        .map((entry) => entry.index);
    }

    function resetAudioElementForSource(audio, srcLike) {
      const src = normalizeAudioSourceUrl(srcLike || "");
      if (!audio || !src) return false;
      revokeActiveBlobUrl();
      try {
        markAudioPauseIntent("source_reset", "recovery");
        audio.pause();
      } catch (_err) {
        // Ignore.
      }
      if (!srcMatches(audio.currentSrc || audio.src || "", src)) {
        try {
          audio.removeAttribute("src");
          audio.load();
        } catch (_err) {
          // Ignore reset failures.
        }
      }
      try {
        audioState.activeLogicalSrc = src;
        audio.src = src;
        loadMediaElementForPlayback(audio);
        return true;
      } catch (_err) {
        return false;
      }
    }

    function waitForAudioReadiness(audio, requestToken, timeoutMs) {
      return new Promise(function (resolve) {
        if (!audio) {
          resolve(false);
          return;
        }
        if (audio.readyState >= 2) {
          resolve(true);
          return;
        }

        let settled = false;
        const timeout = setTimeout(function () {
          done(false);
        }, Math.max(80, Number(timeoutMs) || 180));

        function done(ready) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          audio.removeEventListener("loadedmetadata", onReady);
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onError);
          resolve(Boolean(ready && requestToken === audioState.startRequestToken));
        }

        function onReady() {
          done(true);
        }

        function onError() {
          done(false);
        }

        audio.addEventListener("loadedmetadata", onReady);
        audio.addEventListener("canplay", onReady);
        audio.addEventListener("canplaythrough", onReady);
        audio.addEventListener("error", onError);
      });
    }

    function waitForAbortPlaybackSettle(audio, requestToken, timeoutMs) {
      return new Promise(function (resolve) {
        if (!audio) {
          resolve({ state: "missing_audio" });
          return;
        }

        if (!audio.paused && audio.readyState >= 2) {
          resolve({ state: "playing", readyState: audio.readyState, networkState: audio.networkState });
          return;
        }

        let settled = false;
        const timeout = setTimeout(function () {
          if (!audio.paused && audio.readyState >= 2) {
            done("playing");
            return;
          }
          if (audio.readyState >= 2) {
            done("canplay");
            return;
          }
          done("timeout");
        }, Math.max(800, Number(timeoutMs) || 6500));

        function done(state) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          audio.removeEventListener("playing", onPlaying);
          audio.removeEventListener("timeupdate", onTimeUpdate);
          audio.removeEventListener("canplay", onCanPlay);
          audio.removeEventListener("canplaythrough", onCanPlay);
          audio.removeEventListener("error", onError);
          resolve({
            state,
            readyState: audio.readyState,
            networkState: audio.networkState,
            paused: Boolean(audio.paused)
          });
        }

        function onPlaying() {
          done("playing");
        }

        function onTimeUpdate() {
          if (!audio.paused && audio.readyState >= 2) done("playing");
        }

        function onCanPlay() {
          if (!audio.paused) {
            done("playing");
            return;
          }
          done("canplay");
        }

        function onError() {
          done("error");
        }

        audio.addEventListener("playing", onPlaying);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("canplay", onCanPlay);
        audio.addEventListener("canplaythrough", onCanPlay);
        audio.addEventListener("error", onError);
      });
    }

    function recoverFromTrackFailure(index, srcLike, requestToken) {
      if (Number.isInteger(requestToken) && requestToken !== audioState.startRequestToken) return;
      if (!Number.isInteger(index) || index < 0) return;
      const audio = audioState.audio;
      if (!audio) return;
      const src = toAbsoluteUrlOrEmpty(srcLike || "") || getCurrentLogicalAudioSrc() || getCurrentPlayableAudioSrc(audio);
      const failures = registerTrackFailure(src);
      const track = getTrackByIndex(index);
      const maxRetries = 1;
      if (failures > maxRetries) {
        failAudioRecovery({
          request_token: requestToken,
          reason: "retry_limit",
          strategy: "reset_source"
        });
        setTrackStatus(track, "Chargement du fichier audio, réessaie dans quelques secondes.", { retry: true });
        clearFadeTimer();
        syncAudioUi();
        return;
      }

      setTrackStatus(track, "Chargement du fichier audio...");
      beginAudioRecovery({
        request_token: requestToken,
        reason: "playback_failure",
        strategy: "reset_source"
      });
      setTimeout(function () {
        if (Number.isInteger(requestToken) && requestToken !== audioState.startRequestToken) return;
        if (audioState.currentIndex !== index) return;
        if (!audio.paused) return;
        resetAudioElementForSource(audio, src);
        audio.play().catch(function () {
          if (Number.isInteger(requestToken) && requestToken !== audioState.startRequestToken) return;
          failAudioRecovery({
            request_token: requestToken,
            reason: "reset_play_rejected",
            strategy: "reset_source"
          });
          setTrackStatus(track, "Chargement du fichier audio, réessaie dans quelques secondes.", { retry: true });
        });
      }, 360);
    }

    function startTrack(index, options) {
      const audio = audioState.audio;
      if (!audio) return;
      if (index < 0 || index >= audioState.playlist.length) return;

      const opts = options || {};
      const target = audioState.playlist[index];
      const shouldSeamless = Boolean(opts.seamless);
      const nextSrc = normalizeAudioSourceUrl(target.src);
      const currentLogicalSrc = getCurrentLogicalAudioSrc();
      const sameTrack = srcMatches(currentLogicalSrc, nextSrc || target.src);
      const rowTrack = getTrackByIndex(index);
      const isAutoAdvance = Boolean(opts.auto);
      const isFromMediaSession = Boolean(opts.fromMediaSession);
      const isFromTransportControl = Boolean(opts.fromTransportControl);
      const preparedNextIndex = getAutoPrefetchedNextIndex();
      const hasPreparedTransportTarget = isFromTransportControl && preparedNextIndex === index;
      const isFastSkip = isAutoAdvance || isFromMediaSession || hasPreparedTransportTarget;
      const isPreparedInitialRandom = Boolean(opts.initialRandom);

      if (!isFastSkip && !isPreparedInitialRandom && PREFETCH_NEXT_ENABLED) {
        clearNextTrackPrefetch("manual_start");
        resetPreparedInitialGlobalRandomPlayback();
      }

      audioState.currentIndex = index;
      if (audioState.homeMode === "radio" && audioState.playlist === audioState.radioQueue) {
        audioState.radioQueueCursor = index;
      }
      if (audioState.homeMode !== "radio" && audioState.playlistKind !== "global" && audioState.playlistKind !== "favorites") {
        audioState.playlistKind = "album";
      }
      if (nextSrc) audioState.activeLogicalSrc = nextSrc;
      rememberPlayedIndex(index);
      audioState.pendingSeekRatio = Number.isFinite(opts.seekRatio) ? opts.seekRatio : null;
      audioState.pendingStartTime = Number.isFinite(opts.startTime) ? opts.startTime : null;
      clearWaitingRecovery();
      clearOtherTrackStatuses(rowTrack);
      clearTrackStatus(rowTrack);
      const requestToken = ++audioState.startRequestToken;
      audioState.lastTrackChangeTs = Date.now();
      audioState.audioClickPerfTs = getAudioTelemetryNow();
      audioState.playRequestTs = audioState.lastTrackChangeTs;
      audioState.playRequestToken = requestToken;
      audioState.loggedCacheHitSrc = "";
      audioState.currentTrackPath = getAudioAssetPath(nextSrc || target.src, window.location.href);
      trackAudioRuntimeEvent("startTrack_enter", Object.assign(
        buildAudioMonitorPayload(target, index, nextSrc || target.src),
        {
          request_token: requestToken,
          trigger: opts.auto ? "auto" : isFromMediaSession ? "media_session" : isFromTransportControl ? "transport" : opts.resume ? "resume" : isPreparedInitialRandom ? "initial_random" : "user",
          from_media_session: isFromMediaSession,
          from_transport_control: isFromTransportControl,
          surface: opts.surface || "",
          initial_random: isPreparedInitialRandom,
          same_track: sameTrack
        }
      ));
      logAudioAuditEvent("click_track", target, index, nextSrc || target.src, {
        request_token: requestToken,
        same_track: sameTrack,
        trigger: opts.auto ? "auto" : isFromMediaSession ? "media_session" : isFromTransportControl ? "transport" : opts.resume ? "resume" : "user",
        click_perf_ms: audioState.audioClickPerfTs
      });
      logAudioAuditEvent("source_resolved", target, index, nextSrc || target.src, {
        request_token: requestToken,
        branch: getAudioSource(nextSrc) === "r2dev" ? "r2" : "other",
        click_perf_ms: audioState.audioClickPerfTs
      });
      trackAudioRuntimeEvent("play_request", Object.assign(
        buildAudioMonitorPayload(target, index, nextSrc || target.src),
        {
          request_token: requestToken,
          same_track: sameTrack,
          click_perf_ms: audioState.audioClickPerfTs
        }
      ));
      audioState.trackStartInFlight = true;
      const shouldFastSourceSwitch = isFastSkip;
      const shouldFadeSwitch = !shouldFastSourceSwitch && !sameTrack && !audio.paused && Boolean(getCurrentPlayableAudioSrc(audio));

      if (sameTrack && !opts.resume) {
        try {
          audio.currentTime = 0;
        } catch (_err) {
          // Ignore.
        }
      }
      if (sameTrack) {
        clearFadeTimer();
        try {
          audio.volume = 1;
        } catch (_err) {
          // iOS Safari may ignore media volume changes.
        }
      }

      savePlaybackQueueContext();
      syncMediaSessionMetadata({ forcePosition: true });

      // Keep controls/snippets in sync while play() promise resolves.
      syncAudioUi();

      setTrackStatus(rowTrack, "Chargement du fichier audio...");

      function assignDirectSource() {
        if (!nextSrc) return false;
        try {
          audioState.activeLogicalSrc = nextSrc;
          audioState.mediaSessionAudioPlaying = false;
          if (!sameTrack) {
            audio.src = nextSrc;
          }
          logAudioAuditEvent("source_assigned", target, index, nextSrc, {
            request_token: requestToken,
            same_track: sameTrack,
            reused_current_source: sameTrack,
            ready_state: audio.readyState,
            network_state: audio.networkState,
            click_perf_ms: audioState.audioClickPerfTs
          });
          return true;
        } catch (_err) {
          return false;
        }
      }

      function handlePlayResolved(playMeta) {
        if (requestToken !== audioState.startRequestToken) return;
        logAudioAuditEvent("play_resolved", target, index, nextSrc || target.src, {
          request_token: requestToken,
          retry: Boolean(playMeta && playMeta.retry),
          sync: Boolean(playMeta && playMeta.sync),
          settled_after_abort: Boolean(playMeta && playMeta.settled),
          from_media_session: isFromMediaSession,
          from_transport_control: isFromTransportControl,
          surface: opts.surface || "",
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        });
        audioState.trackStartInFlight = false;
        clearTrackFailure(target.src);
        clearTrackStatus(rowTrack);
        if (!sameTrack && !(isFastSkip || shouldSeamless)) {
          fadeInAudio(audio, 100);
        } else if (sameTrack && !shouldSeamless) {
          fadeInAudio(audio, 120);
        } else {
          forceAudioFullVolume(audio);
        }
        bindMediaSessionActions({ force: true });
        syncMediaSessionMetadata({ forcePosition: true });
        scheduleMediaSessionResync(requestToken);
        syncAudioUi();
        startAudioRaf();
        schedulePendingTransportNavigation("play_resolved");
      }

      function handlePlayRejected(playErr, playMeta) {
        if (requestToken !== audioState.startRequestToken) return;
        const isRetry = Boolean(playMeta && playMeta.retry);
        logAudioAuditEvent("play_rejected", target, index, nextSrc || target.src, {
          request_token: requestToken,
          retry: isRetry,
          sync: Boolean(playMeta && playMeta.sync),
          from_media_session: isFromMediaSession,
          from_transport_control: isFromTransportControl,
          surface: opts.surface || "",
          reason: playErr && playErr.name ? playErr.name : "unknown",
          message: playErr && playErr.message ? playErr.message : "",
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        });
        if (playErr && playErr.name === "AbortError" && !isRetry && isIosDevice()) {
          const abortSettleTimeout = isFastSkip ? 1050 : 1250;
          beginAudioRecovery({
            request_token: requestToken,
            reason: "AbortError",
            strategy: "abort_short_wait_reset_retry"
          });
          logAudioAuditEvent("abort_settle_start", target, index, nextSrc || target.src, {
            request_token: requestToken,
            timeout_ms: abortSettleTimeout,
            strategy: "abort_short_wait_reset_retry",
            ready_state: audio.readyState,
            network_state: audio.networkState,
            click_perf_ms: audioState.audioClickPerfTs
          });
          waitForAbortPlaybackSettle(audio, requestToken, abortSettleTimeout).then(function (result) {
            if (requestToken !== audioState.startRequestToken) return;
            const state = result && result.state ? result.state : "unknown";
            logAudioAuditEvent("abort_settle_end", target, index, nextSrc || target.src, {
              request_token: requestToken,
              state,
              timeout_ms: abortSettleTimeout,
              ready_state: result && Number.isFinite(result.readyState) ? result.readyState : audio.readyState,
              network_state: result && Number.isFinite(result.networkState) ? result.networkState : audio.networkState,
              paused: result ? Boolean(result.paused) : Boolean(audio.paused),
              click_perf_ms: audioState.audioClickPerfTs
            });
            if (state === "playing") {
              handlePlayResolved({ sync: isFastSkip, settled: true });
              return;
            }
            if (state === "canplay") {
              attemptPlay({ retry: true, sync: isFastSkip, abortSettle: true });
              return;
            }
            const resetForRetry = resetAudioElementForSource(audio, nextSrc || target.src);
            logAudioAuditEvent("source_assigned", target, index, nextSrc || target.src, {
              request_token: requestToken,
              same_track: sameTrack,
              recovery: true,
              reset_for_abort: true,
              abort_settle_state: state,
              reset_ok: Boolean(resetForRetry),
              ready_state: audio.readyState,
              network_state: audio.networkState,
              click_perf_ms: audioState.audioClickPerfTs
            });
            if (!resetForRetry) {
              audioState.trackStartInFlight = false;
              schedulePendingTransportNavigation("abort_reset_failed");
              recoverFromTrackFailure(index, target.src, requestToken);
              return;
            }
            waitForAudioReadiness(audio, requestToken, 900).then(function (ready) {
              if (requestToken !== audioState.startRequestToken) return;
              logAudioAuditEvent("ready_wait_end", target, index, nextSrc || target.src, {
                request_token: requestToken,
                retry: true,
                reason: "AbortError",
                abort_settle_state: state,
                ready: Boolean(ready),
                ready_state: audio.readyState,
                network_state: audio.networkState,
                click_perf_ms: audioState.audioClickPerfTs
              });
              attemptPlay({ retry: true, sync: isFastSkip, abortSettle: true });
            });
          });
          return;
        }
        if (playErr && playErr.name === "AbortError" && !isRetry) {
          beginAudioRecovery({
            request_token: requestToken,
            reason: "AbortError",
            strategy: "reset_source_wait_retry"
          });
          const resetForRetry = resetAudioElementForSource(audio, nextSrc || target.src);
          logAudioAuditEvent("source_assigned", target, index, nextSrc || target.src, {
            request_token: requestToken,
            same_track: sameTrack,
            recovery: true,
            reset_for_abort: true,
            reset_ok: Boolean(resetForRetry),
            ready_state: audio.readyState,
            network_state: audio.networkState,
            click_perf_ms: audioState.audioClickPerfTs
          });
          if (!resetForRetry) {
            audioState.trackStartInFlight = false;
            schedulePendingTransportNavigation("abort_reset_failed");
            recoverFromTrackFailure(index, target.src, requestToken);
            return;
          }
          waitForAudioReadiness(audio, requestToken, 1000).then(function (ready) {
            if (requestToken !== audioState.startRequestToken) return;
            logAudioAuditEvent("ready_wait_end", target, index, nextSrc || target.src, {
              request_token: requestToken,
              retry: true,
              reason: "AbortError",
              ready: Boolean(ready),
              ready_state: audio.readyState,
              network_state: audio.networkState,
              click_perf_ms: audioState.audioClickPerfTs
            });
            attemptPlay({ retry: true, sync: isFastSkip });
          });
          return;
        }
        audioState.trackStartInFlight = false;
        clearWaitingRecovery();
        clearFadeTimer();
        setTrackStatus(rowTrack, "Chargement du fichier audio...");
        syncAudioUi();
        schedulePendingTransportNavigation("play_rejected");
        recoverFromTrackFailure(index, target.src, requestToken);
      }

      function attemptPlay(playMeta) {
        if (requestToken !== audioState.startRequestToken) return;
        const meta = playMeta || {};
        logAudioAuditEvent("play_call", target, index, nextSrc || target.src, {
          request_token: requestToken,
          retry: Boolean(meta.retry),
          sync: Boolean(meta.sync),
          abort_settle_retry: Boolean(meta.abortSettle),
          from_media_session: isFromMediaSession,
          from_transport_control: isFromTransportControl,
          surface: opts.surface || "",
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        });
        if (isAutoAdvance) scheduleSilentCheck(target, index, nextSrc || target.src, requestToken);
        audio.play()
          .then(function () { handlePlayResolved(meta); })
          .catch(function (playErr) { handlePlayRejected(playErr, meta); });
      }

      function beginPlayback() {
        if (requestToken !== audioState.startRequestToken) return;
        if (isFastSkip) {
          attemptPlay({ sync: true });
          return;
        }
        const readinessTimeout = isIosDevice() ? 110 : 220;
        logAudioAuditEvent("ready_wait_start", target, index, nextSrc || target.src, {
          request_token: requestToken,
          timeout_ms: readinessTimeout,
          ready_state: audio.readyState,
          network_state: audio.networkState,
          click_perf_ms: audioState.audioClickPerfTs
        });
        waitForAudioReadiness(audio, requestToken, readinessTimeout).then(function (ready) {
          if (requestToken !== audioState.startRequestToken) return;
          logAudioAuditEvent("ready_wait_end", target, index, nextSrc || target.src, {
            request_token: requestToken,
            ready: Boolean(ready),
            ready_state: audio.readyState,
            network_state: audio.networkState,
            click_perf_ms: audioState.audioClickPerfTs
          });
          attemptPlay({ sync: false });
        });
      }

      if (sameTrack) {
        beginPlayback();
        return;
      }

      function switchSourceAfterFade() {
        if (requestToken !== audioState.startRequestToken) return;

        if (!shouldFastSourceSwitch) {
          try {
            markAudioPauseIntent("source_switch", opts.surface || "track_change");
            audio.pause();
          } catch (_err) {
            // Ignore pause failures during source switches.
          }
        }

        revokeActiveBlobUrl();
        if (requestToken !== audioState.startRequestToken) return;

        const assigned = assignDirectSource();
        if (!assigned) {
          audioState.trackStartInFlight = false;
          recoverFromTrackFailure(index, target.src, requestToken);
          return;
        }
        if (!shouldFastSourceSwitch) syncAudioUi();
        beginPlayback();
      }

      if (shouldFadeSwitch) {
        fadeOutAudio(audio, 100, requestToken).then(function () {
          if (requestToken !== audioState.startRequestToken) return;
          switchSourceAfterFade();
        });
      } else {
        clearFadeTimer();
        try {
          audio.volume = 1;
        } catch (_err) {
          // iOS Safari may ignore media volume changes.
        }
        switchSourceAfterFade();
      }
    }

    function getRandomIndex(exceptIndex) {
      const list = audioState.playlist;
      if (!list.length) return -1;
      if (list.length === 1) return 0;
      const normalizedExcept = Number.isInteger(exceptIndex) ? exceptIndex : -1;
      let candidates = list.map((_track, index) => index).filter((index) => index !== normalizedExcept);
      if (candidates.length > 1 && audioState.recentPlayed.length) {
        const recentSet = new Set(audioState.recentPlayed.filter((index) => index !== normalizedExcept));
        const reduced = candidates.filter((index) => !recentSet.has(index));
        if (reduced.length) candidates = reduced;
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function resolveRadioQueueIndex(direction) {
      if (!ensureRadioQueue(audioState.radioQueueMinRemaining)) return -1;
      if (!audioState.radioQueue.length) return -1;

      if (!Number.isInteger(audioState.radioQueueCursor) || audioState.radioQueueCursor < 0) {
        const currentSrc = getCurrentLogicalAudioSrc();
        const bySrc = currentSrc
          ? audioState.radioQueue.findIndex((track) => track && srcMatches(track.src, currentSrc))
          : -1;
        audioState.radioQueueCursor = bySrc >= 0 ? bySrc : (direction > 0 ? -1 : 0);
      }

      if (direction > 0) {
        if (audioState.radioQueue.length - audioState.radioQueueCursor - 1 < audioState.radioQueueMinRemaining) {
          ensureRadioQueue(audioState.radioQueueMinRemaining);
        }
        if (audioState.radioQueueCursor < audioState.radioQueue.length - 1) {
          audioState.radioQueueCursor += 1;
        }
      } else if (direction < 0 && audioState.radioQueueCursor > 0) {
        audioState.radioQueueCursor -= 1;
      }

      syncRadioQueueToPlaylist({ preserveRecent: true });
      return audioState.radioQueueCursor;
    }

    function resolveIndex(direction) {
      const list = audioState.playlist;
      if (!list.length) return -1;

      if (audioState.homeMode === "radio") {
        return resolveRadioQueueIndex(direction);
      }

      if (audioState.shuffleOn) {
        return getRandomIndex(audioState.currentIndex);
      }

      if (audioState.currentIndex < 0) return 0;

      if (direction > 0) {
        if (audioState.currentIndex < list.length - 1) return audioState.currentIndex + 1;
        const extendedIndex = extendAlbumPlaylistToNextAlbum({
          reason: "next",
          fromIndex: audioState.currentIndex
        });
        return Number.isInteger(extendedIndex) && extendedIndex >= 0 ? extendedIndex : -1;
      }
      return audioState.currentIndex > 0 ? audioState.currentIndex - 1 : -1;
    }

    function playNext(options) {
      const opts = options || {};
      const useSeamless = Object.prototype.hasOwnProperty.call(opts, "seamless")
        ? Boolean(opts.seamless)
        : true;
      console.info(
        "[INFRA] nav next",
        `homeMode=${audioState.homeMode}`,
        `playlist=${audioState.playlistKind || (audioState.homeMode === "radio" ? "radio" : "album")}`,
        `current=${audioState.currentIndex}`
      );
      if (!ensureRadioPlaylistForNavigation("next", opts)) return;
      ensurePlayablePlaylistContext();
      if (!audioState.playlist.length) return;
      if (opts.auto) {
        const now = Date.now();
        if (audioState.lastAutoAdvanceTs && now - audioState.lastAutoAdvanceTs < 200) return;
        audioState.lastAutoAdvanceTs = now;
      }
      if (audioState.currentIndex < 0 || audioState.currentIndex >= audioState.playlist.length) {
        if (ensureCurrentIndexFromAudio() < 0) {
          audioState.currentIndex = 0;
        }
      }
      const fromMediaSession = Boolean(opts.fromMediaSession);
      const fromTransportControl = Boolean(opts.fromTransportControl);
      const fastSkip = Boolean(opts.auto || fromMediaSession || fromTransportControl);
      const prefetchedNextIndex = fastSkip ? getAutoPrefetchedNextIndex() : -1;
      const nextIndex = prefetchedNextIndex >= 0 ? prefetchedNextIndex : resolveIndex(1);
      if (nextIndex >= 0) {
        const nextTrack = audioState.playlist[nextIndex];
        if (queueIosTransportNavigation(1, opts, nextIndex, nextTrack, prefetchedNextIndex >= 0)) return;
        if (opts.auto) {
          trackAudioRuntimeEvent("auto_advance_attempt", Object.assign(
            buildAudioMonitorPayload(nextTrack, nextIndex, nextTrack && nextTrack.src ? nextTrack.src : ""),
            {
              from_index: audioState.currentIndex,
              to_index: nextIndex,
              prefetched: prefetchedNextIndex >= 0,
              previous_track_path: audioState.currentTrackPath || getAudioAssetPath(audioState.activeLogicalSrc || "", window.location.href),
              trigger: "auto"
            }
          ));
        } else if (fromMediaSession) {
          trackAudioRuntimeEvent("media_session_nexttrack", Object.assign(
            buildAudioMonitorPayload(nextTrack, nextIndex, nextTrack && nextTrack.src ? nextTrack.src : ""),
            {
              from_index: audioState.currentIndex,
              to_index: nextIndex,
              prefetched: prefetchedNextIndex >= 0,
              previous_track_path: audioState.currentTrackPath || getAudioAssetPath(audioState.activeLogicalSrc || "", window.location.href),
              trigger: "media_session"
            }
          ));
        } else if (fromTransportControl) {
          trackAudioRuntimeEvent("transport_nexttrack", Object.assign(
            buildAudioMonitorPayload(nextTrack, nextIndex, nextTrack && nextTrack.src ? nextTrack.src : ""),
            {
              from_index: audioState.currentIndex,
              to_index: nextIndex,
              prefetched: prefetchedNextIndex >= 0,
              previous_track_path: audioState.currentTrackPath || getAudioAssetPath(audioState.activeLogicalSrc || "", window.location.href),
              trigger: "transport",
              from_transport_control: true,
              surface: opts.surface || ""
            }
          ));
        }
        startTrack(nextIndex, {
          seamless: useSeamless,
          auto: Boolean(opts.auto),
          fromMediaSession,
          fromTransportControl,
          surface: opts.surface || ""
        });
      } else {
        syncAudioUi();
      }
    }

    function playPrevious(options) {
      const opts = options || {};
      const useSeamless = Object.prototype.hasOwnProperty.call(opts, "seamless")
        ? Boolean(opts.seamless)
        : true;
      console.info(
        "[INFRA] nav previous",
        `homeMode=${audioState.homeMode}`,
        `playlist=${audioState.playlistKind || (audioState.homeMode === "radio" ? "radio" : "album")}`,
        `current=${audioState.currentIndex}`
      );
      if (!ensureRadioPlaylistForNavigation("previous", opts)) return;
      ensurePlayablePlaylistContext();
      if (!audioState.playlist.length) return;
      if (audioState.currentIndex < 0 || audioState.currentIndex >= audioState.playlist.length) {
        if (ensureCurrentIndexFromAudio() < 0) {
          audioState.currentIndex = 0;
        }
      }
      if (audioState.homeMode === "radio") {
        if (!Number.isInteger(audioState.radioQueueCursor) || audioState.radioQueueCursor < 0) {
          audioState.radioQueueCursor = audioState.currentIndex >= 0 ? audioState.currentIndex : 0;
        }
        if (audioState.radioQueueCursor <= 0) return;
      }
      const prevIndex = resolveIndex(-1);
      if (prevIndex >= 0) {
        const prevTrack = audioState.playlist[prevIndex];
        if (queueIosTransportNavigation(-1, opts, prevIndex, prevTrack, false)) return;
        if (opts.fromMediaSession) {
          trackAudioRuntimeEvent("media_session_previoustrack", Object.assign(
            buildAudioMonitorPayload(prevTrack, prevIndex, prevTrack && prevTrack.src ? prevTrack.src : ""),
            {
              from_index: audioState.currentIndex,
              to_index: prevIndex,
              prefetched: false,
              previous_track_path: audioState.currentTrackPath || getAudioAssetPath(audioState.activeLogicalSrc || "", window.location.href),
              trigger: "media_session"
            }
          ));
        } else if (opts.fromTransportControl) {
          trackAudioRuntimeEvent("transport_previoustrack", Object.assign(
            buildAudioMonitorPayload(prevTrack, prevIndex, prevTrack && prevTrack.src ? prevTrack.src : ""),
            {
              from_index: audioState.currentIndex,
              to_index: prevIndex,
              prefetched: false,
              previous_track_path: audioState.currentTrackPath || getAudioAssetPath(audioState.activeLogicalSrc || "", window.location.href),
              trigger: "transport",
              from_transport_control: true,
              surface: opts.surface || ""
            }
          ));
        }
        startTrack(prevIndex, {
          seamless: useSeamless,
          fromMediaSession: Boolean(opts.fromMediaSession),
          fromTransportControl: Boolean(opts.fromTransportControl),
          surface: opts.surface || ""
        });
      }
    }

    function movePlaylistItem(fromIndex, toIndex, options) {
      const list = audioState.playlist;
      if (!Array.isArray(list) || list.length < 2) return false;
      const from = Number(fromIndex);
      const target = Number(toIndex);
      if (!Number.isInteger(from) || !Number.isInteger(target)) return false;
      if (from < 0 || from >= list.length) return false;

      const opts = options || {};
      const currentIndex = getCurrentPlaylistIndexSafe();
      if (currentIndex >= 0 && from <= currentIndex) return false;

      const currentTrack = currentIndex >= 0 && currentIndex < list.length ? list[currentIndex] : null;
      const movingTrack = list[from];
      if (!movingTrack) return false;

      let insertBefore = opts.after ? target + 1 : target;
      insertBefore = Math.max(0, Math.min(list.length, insertBefore));
      if (currentIndex >= 0 && insertBefore <= currentIndex) {
        insertBefore = currentIndex + 1;
      }

      list.splice(from, 1);
      if (from < insertBefore) insertBefore -= 1;
      insertBefore = Math.max(0, Math.min(list.length, insertBefore));
      if (currentIndex >= 0) insertBefore = Math.max(currentIndex + 1, insertBefore);
      if (from === insertBefore) {
        list.splice(from, 0, movingTrack);
        return false;
      }

      list.splice(insertBefore, 0, movingTrack);
      if (currentTrack) {
        const nextCurrentIndex = list.indexOf(currentTrack);
        if (nextCurrentIndex >= 0) audioState.currentIndex = nextCurrentIndex;
      }
      if (audioState.homeMode === "radio" && audioState.playlist === audioState.radioQueue) {
        audioState.radioQueueCursor = audioState.currentIndex;
      } else if (audioState.shuffleOn) {
        audioState.shuffleOn = false;
      }

      audioState.playlistToken = `manual-${Date.now()}-${from}-${insertBefore}`;
      savePlaybackQueueContext();
      trackAudioRuntimeEvent("queue_reorder", {
        from_index: from,
        to_index: insertBefore,
        current_index: audioState.currentIndex,
        playlist_kind: audioState.playlistKind || "",
        home_mode: audioState.homeMode || "",
        shuffle_on: Boolean(audioState.shuffleOn)
      });
      syncAudioUi();
      return true;
    }

    function startRadioPlaybackFromIdle() {
      ensureRadioPlaylistLoaded()
        .then(function (radioList) {
          if (!Array.isArray(radioList) || !radioList.length) return;
          if (audioState.homeMode !== "radio") return;
          if (!ensureRadioQueue(audioState.radioQueueMinRemaining) || !audioState.radioQueue.length) return;
          audioState.radioQueueCursor = 0;
          syncRadioQueueToPlaylist({ preserveRecent: true });
          startTrack(0, { seamless: true });
        })
        .catch(function () {
          // Ignore radio loading failures.
        });
    }

    function togglePlayPause() {
      const audio = audioState.audio;
      if (!audio) return;

      if (audio.paused) {
        if (!getCurrentPlayableAudioSrc(audio)) {
          if (audioState.homeMode === "radio") {
            startRadioPlaybackFromIdle();
            return;
          }

          if (canStartInitialGlobalRandomPlayback()) {
            startGlobalRandomPlayback();
            return;
          }

          if (audioState.playlist.length) {
            const startIndex = audioState.shuffleOn ? getRandomIndex(-1) : 0;
            startTrack(startIndex >= 0 ? startIndex : 0);
            return;
          }
          return;
        }
        audio.play().catch(function () {
          // Ignore.
        });
        return;
      }

      markAudioPauseIntent("ui", "toggle");
      audio.pause();
    }


    return {
      seekCurrentAudioToRatio,
      syncPlaylistContext,
      ensureCurrentIndexFromAudio,
      getCurrentPlaylistIndexSafe,
      getQueuePreviewIndices,
      resetAudioElementForSource,
      recoverFromTrackFailure,
      getRandomIndex,
      startTrack,
      playNext,
      playPrevious,
      movePlaylistItem,
      startRadioPlaybackFromIdle,
      togglePlayPause
    };
  }

  window.InfraAudioCore = {
    createAudioCore
  };
})();
