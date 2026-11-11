// Préchargement des titres suivants (N+1 à N+5) et vérification du silence.
// Extrait de audio-radio.js (lot C, chantier JavaScript d'INFRA, 10/11/2026) : corps des fonctions inchangés.
// Réglages et accès au lecteur : reçus de createAudioRadio() ; fonctions des autres modules : reliées par link().
export function createPrefetch(R) {
  const {
    PREFETCH_BUFFER_ABORT_SECONDS,
    PREFETCH_BUFFER_STABLE_SECONDS,
    PREFETCH_MAX_ATTEMPTS,
    PREFETCH_NEXT_CONCURRENCY,
    PREFETCH_NEXT_ENABLED,
    PREFETCH_NEXT_MAX_BYTES,
    PREFETCH_NEXT_MAX_ENTRIES,
    PREFETCH_NEXT_QUEUE_DEPTH,
    PREFETCH_NEXT_SEGMENT_BYTES,
    PREFETCH_REQUEST_TIMEOUT_MS,
    PREFETCH_RETRY_BASE_MS,
    PREFETCH_RETRY_MAX_MS,
    audioState,
    buildAudioMonitorPayload,
    getAudioRuntimeProbeState,
    getCurrentLogicalAudioSrc,
    getCurrentPlayableAudioSrc,
    getCurrentPlaylistIndexSafe,
    getQueuePreviewIndices,
    isCloudflareAudioUrl,
    normalizeAudioSourceUrl,
    prefetchApi,
    srcMatches,
    trackAudioRuntimeEvent
  } = R;

  function getPrefetchCacheRequest(src) {
    if (prefetchApi && typeof prefetchApi.createRequest === "function") {
      return prefetchApi.createRequest(src);
    }
    try {
      return new Request(src, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default"
      });
    } catch (_err) {
      return src;
    }
  }

  function ensureNextPrefetchCollections() {
    if (!(audioState.nextPrefetchReadySrcs instanceof Set)) audioState.nextPrefetchReadySrcs = new Set();
    if (!(audioState.nextPrefetchAttemptCounts instanceof Map))
      audioState.nextPrefetchAttemptCounts = new Map();
    if (!(audioState.nextPrefetchInFlightSrcs instanceof Set))
      audioState.nextPrefetchInFlightSrcs = new Set();
    if (!(audioState.nextPrefetchControllers instanceof Map)) audioState.nextPrefetchControllers = new Map();
    if (!(audioState.nextPrefetchRetryTimers instanceof Map)) audioState.nextPrefetchRetryTimers = new Map();
    if (!Array.isArray(audioState.nextPrefetchPlan)) audioState.nextPrefetchPlan = [];
    if (typeof audioState.nextPrefetchCacheHydrationKey !== "string")
      audioState.nextPrefetchCacheHydrationKey = "";
    if (typeof audioState.nextPrefetchCacheHydratedKey !== "string")
      audioState.nextPrefetchCacheHydratedKey = "";
    if (typeof audioState.nextPrefetchCacheN1HydratedKey !== "string")
      audioState.nextPrefetchCacheN1HydratedKey = "";
    if (
      !audioState.nextPrefetchCacheHydrationPromise ||
      typeof audioState.nextPrefetchCacheHydrationPromise.then !== "function"
    ) {
      audioState.nextPrefetchCacheHydrationPromise = null;
    }
  }

  function cancelPrefetchResponseBody(response) {
    if (!response || !response.body || typeof response.body.cancel !== "function") return;
    try {
      const cancellation = response.body.cancel();
      if (cancellation && typeof cancellation.catch === "function") {
        cancellation.catch(function () {});
      }
    } catch (_err) {
      // A rejected response is already unusable; cancellation is best-effort.
    }
  }

  function getPrefetchAttemptLimit(src) {
    const normalizedSrc = normalizeAudioSourceUrl(src || "");
    const first = Array.isArray(audioState.nextPrefetchPlan) ? audioState.nextPrefetchPlan[0] : null;
    return first && normalizedSrc && srcMatches(first.src, normalizedSrc)
      ? PREFETCH_MAX_ATTEMPTS + 1
      : PREFETCH_MAX_ATTEMPTS;
  }

  function isTransientPrefetchFailure(reason, error) {
    const normalizedReason = String(reason || "");
    const errorName = String(error && error.name ? error.name : "");
    if (normalizedReason === "timeout" || normalizedReason === "prefetch_cache_timeout") return true;
    if (/^prefetch_http_(?:408|425|429|5\d\d)$/.test(normalizedReason)) return true;
    return errorName === "TypeError" || errorName === "NetworkError";
  }

  function getPrefetchRetryDelay(attempt) {
    const exponent = Math.max(0, Math.min(4, Number(attempt || 1) - 1));
    return Math.min(PREFETCH_RETRY_MAX_MS, PREFETCH_RETRY_BASE_MS * Math.pow(2, exponent));
  }

  function getCurrentBufferedEndForPrefetch(audio) {
    if (!audio || !audio.buffered || !audio.buffered.length) return 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    try {
      for (let index = 0; index < audio.buffered.length; index += 1) {
        const start = audio.buffered.start(index);
        const end = audio.buffered.end(index);
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          currentTime >= start - 0.05 &&
          currentTime <= end + 0.05
        ) {
          return end;
        }
      }
      return 0;
    } catch (_err) {
      return 0;
    }
  }

  function getCurrentBufferAheadForPrefetch() {
    const audio = audioState.audio;
    if (!audio) return 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    return Math.max(0, getCurrentBufferedEndForPrefetch(audio) - currentTime);
  }

  function shouldPrefetchNextTrackNow() {
    const audio = audioState.audio;
    if (!audio || audio.paused || audioState.activeAudioRecovery || !getCurrentPlayableAudioSrc(audio)) {
      return false;
    }
    const bufferedEnd = getCurrentBufferedEndForPrefetch(audio);
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (duration > 0 && bufferedEnd >= duration - 0.25) return true;
    return getCurrentBufferAheadForPrefetch() >= PREFETCH_BUFFER_STABLE_SECONDS;
  }

  function getPrefetchKeepSources() {
    const currentSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
    return [currentSrc]
      .concat(
        (audioState.nextPrefetchPlan || []).map(function (target) {
          return target.src;
        })
      )
      .filter(Boolean);
  }

  function isPrefetchPlanSnapshotCurrent(generation, planKey) {
    return (
      Number(audioState.nextPrefetchGeneration || 0) === generation &&
      String(audioState.nextPrefetchPlanKey || "") === String(planKey || "")
    );
  }

  function isPrefetchTargetUsefulForSnapshot(src, generation, planKey) {
    if (!isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
    const normalizedSrc = normalizeAudioSourceUrl(src || "");
    const currentSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
    if (!normalizedSrc || (currentSrc && srcMatches(normalizedSrc, currentSrc))) return false;
    return (audioState.nextPrefetchPlan || []).some(function (entry) {
      return entry && srcMatches(entry.src, normalizedSrc);
    });
  }

  function hydrateNextTrackPrefetchPlanFromCache(targets) {
    if (!prefetchApi || typeof prefetchApi.inspectCachedSegment !== "function") return false;
    const planTargets = Array.isArray(targets) ? targets.slice() : [];
    if (!planTargets.length) return false;
    const generation = Number(audioState.nextPrefetchGeneration || 0);
    const planKey = String(audioState.nextPrefetchPlanKey || "");
    if (!planKey) return false;
    const hydrationKey = `${generation}|${planKey}`;
    if (audioState.nextPrefetchCacheHydratedKey === hydrationKey) return false;
    if (audioState.nextPrefetchCacheHydrationKey === hydrationKey) {
      return audioState.nextPrefetchCacheN1HydratedKey !== hydrationKey;
    }

    audioState.nextPrefetchCacheHydrationKey = hydrationKey;
    const restoredSources = [];
    let restoredBytes = 0;

    function inspectTarget(target) {
      return Promise.resolve()
        .then(function () {
          return prefetchApi.inspectCachedSegment(target.src);
        })
        .catch(function () {
          return null;
        });
    }

    function restoreTarget(result, target) {
      if (!isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
      const currentSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
      const usefulSources = new Set(
        (audioState.nextPrefetchPlan || [])
          .map(function (target) {
            return normalizeAudioSourceUrl(target && target.src ? target.src : "");
          })
          .filter(Boolean)
      );
      const src = normalizeAudioSourceUrl(target && target.src ? target.src : "");
      if (src && (!result || !result.valid || result.probeReady === false)) {
        audioState.nextPrefetchReadySrcs.delete(src);
        if (audioState.nextPrefetchDoneSrc && srcMatches(audioState.nextPrefetchDoneSrc, src)) {
          audioState.nextPrefetchDoneSrc = "";
        }
        if (audioState.nextPrefetchServedSrc && srcMatches(audioState.nextPrefetchServedSrc, src)) {
          audioState.nextPrefetchServedSrc = "";
        }
      }
      if (
        !result ||
        !result.valid ||
        result.probeReady === false ||
        !src ||
        !usefulSources.has(src) ||
        (currentSrc && srcMatches(src, currentSrc))
      ) {
        return false;
      }
      audioState.nextPrefetchReadySrcs.add(src);
      audioState.nextPrefetchAttemptCounts.delete(src);
      if (!restoredSources.includes(src)) {
        restoredSources.push(src);
        restoredBytes += Number.isFinite(Number(result.bytes)) ? Number(result.bytes) : 0;
      }
      return true;
    }

    const firstTarget = planTargets[0];
    const hydrationPromise = inspectTarget(firstTarget)
      .then(function (result) {
        if (!isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
        restoreTarget(result, firstTarget);
        audioState.nextPrefetchCacheN1HydratedKey = hydrationKey;
        // N+1 is now known. Let the scheduler start it immediately on a cache
        // miss instead of waiting for the four less probable cache inspections.
        maybePrefetchNextTrack("cache_n_plus_1_rehydrated");
        return true;
      })
      .then(function (activePlan) {
        if (!activePlan) return false;
        return Promise.all(planTargets.slice(1).map(inspectTarget)).then(function (results) {
          if (!isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
          results.forEach(function (result, index) {
            restoreTarget(result, planTargets[index + 1]);
          });
          return true;
        });
      })
      .then(function (activePlan) {
        if (!activePlan || !isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
        audioState.nextPrefetchCacheHydratedKey = hydrationKey;
        if (restoredSources.length) {
          audioState.nextPrefetchDoneSrc = restoredSources[0];
          trackAudioRuntimeEvent("prefetch_cache_rehydrated", {
            track: "prefetch-window",
            album: audioState.homeMode === "radio" ? "radio" : "album",
            generation,
            depth: planTargets.length,
            restored_count: restoredSources.length,
            bytes: restoredBytes,
            sources: restoredSources
          });
        }
        return true;
      })
      .catch(function () {
        if (!isPrefetchPlanSnapshotCurrent(generation, planKey)) return false;
        audioState.nextPrefetchCacheN1HydratedKey = hydrationKey;
        audioState.nextPrefetchCacheHydratedKey = hydrationKey;
        return true;
      })
      .then(function (activePlan) {
        if (audioState.nextPrefetchCacheHydrationKey === hydrationKey) {
          audioState.nextPrefetchCacheHydrationKey = "";
          audioState.nextPrefetchCacheHydrationPromise = null;
        }
        if (activePlan) maybePrefetchNextTrack("cache_rehydrated");
        return activePlan;
      });
    audioState.nextPrefetchCacheHydrationPromise = hydrationPromise;
    return true;
  }

  function abortPrefetchTarget(src, reason) {
    ensureNextPrefetchCollections();
    const normalized = normalizeAudioSourceUrl(src || "");
    if (!normalized) return;
    const retryTimer = audioState.nextPrefetchRetryTimers.get(normalized);
    if (retryTimer) window.clearTimeout(retryTimer);
    audioState.nextPrefetchRetryTimers.delete(normalized);
    const record = audioState.nextPrefetchControllers.get(normalized);
    if (record && record.timeout) window.clearTimeout(record.timeout);
    if (record && record.controller) {
      record.cancelReason = reason || "obsolete";
      try {
        record.controller.abort();
      } catch (_err) {}
    }
    audioState.nextPrefetchControllers.delete(normalized);
    audioState.nextPrefetchInFlightSrcs.delete(normalized);
    audioState.nextPrefetchInFlight = audioState.nextPrefetchInFlightSrcs.size > 0;
  }

  function freePrefetchLaneForPriority(target, reason) {
    ensureNextPrefetchCollections();
    if (!target || audioState.nextPrefetchInFlightSrcs.size < PREFETCH_NEXT_CONCURRENCY) return false;
    const targetRank = Number.isFinite(Number(target.rank)) ? Number(target.rank) : 1;
    let weakest = null;
    audioState.nextPrefetchControllers.forEach(function (record, src) {
      const rank = Number.isFinite(Number(record && record.rank))
        ? Number(record.rank)
        : Number.MAX_SAFE_INTEGER;
      if (rank <= targetRank) return;
      if (!weakest || rank > weakest.rank) weakest = { src, record, rank };
    });
    if (!weakest) return false;
    abortPrefetchTarget(weakest.src, reason || "priority_reordered");
    // Priority preemption is not a failed download. Let the lower-ranked
    // source re-enter the window after the new N+1 is safe.
    audioState.nextPrefetchAttemptCounts.delete(weakest.src);
    trackAudioRuntimeEvent("prefetch_preempt", {
      track: "prefetch-window",
      album: audioState.homeMode === "radio" ? "radio" : "album",
      reason: reason || "priority_reordered",
      generation: audioState.nextPrefetchGeneration,
      promoted_rank: targetRank,
      cancelled_rank: weakest.rank,
      cancelled_src: weakest.src
    });
    return true;
  }

  function inspectCacheBeforePrefetchRetry(src, failureReason) {
    const normalizedSrc = normalizeAudioSourceUrl(src || "");
    if (
      failureReason !== "prefetch_cache_timeout" ||
      !normalizedSrc ||
      !prefetchApi ||
      typeof prefetchApi.inspectCachedSegment !== "function"
    ) {
      return Promise.resolve(false);
    }
    const mutationIdle =
      typeof prefetchApi.waitForMutationIdle === "function"
        ? prefetchApi.waitForMutationIdle()
        : Promise.resolve(true);
    return Promise.resolve(mutationIdle)
      .then(function () {
        return prefetchApi.inspectCachedSegment(normalizedSrc);
      })
      .then(function (result) {
        const generation = Number(audioState.nextPrefetchGeneration || 0);
        const planKey = String(audioState.nextPrefetchPlanKey || "");
        if (!isPrefetchTargetUsefulForSnapshot(normalizedSrc, generation, planKey)) return false;
        if (!result || !result.valid || result.probeReady === false) return false;
        audioState.nextPrefetchReadySrcs.add(normalizedSrc);
        audioState.nextPrefetchAttemptCounts.delete(normalizedSrc);
        audioState.nextPrefetchDoneSrc = normalizedSrc;
        audioState.nextPrefetchFailedSrc = "";
        audioState.nextPrefetchFailureReason = "";
        trackAudioRuntimeEvent("prefetch_cache_timeout_recovered", {
          track: "prefetch-window",
          album: audioState.homeMode === "radio" ? "radio" : "album",
          generation,
          bytes: Number.isFinite(Number(result.bytes)) ? Number(result.bytes) : null,
          src: normalizedSrc
        });
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function reconcileNextTrackPrefetchPlan(reason) {
    ensureNextPrefetchCollections();
    const currentSrc = normalizeAudioSourceUrl(getCurrentLogicalAudioSrc());
    const indices = getQueuePreviewIndices(PREFETCH_NEXT_QUEUE_DEPTH);
    const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
    const seen = new Set();
    const targets = [];
    indices.forEach(function (index) {
      const track = list[index];
      const src = normalizeAudioSourceUrl(track && track.src ? track.src : "");
      if (!src || seen.has(src) || !isCloudflareAudioUrl(src) || (currentSrc && srcMatches(src, currentSrc)))
        return;
      seen.add(src);
      targets.push({ index, track, src, rank: targets.length + 1 });
    });
    const planKey = `${currentSrc}|${targets
      .map(function (target) {
        return target.src;
      })
      .join("|")}`;
    if (planKey === audioState.nextPrefetchPlanKey) {
      audioState.nextPrefetchPlan = targets;
      return targets;
    }

    audioState.nextPrefetchGeneration = Number(audioState.nextPrefetchGeneration || 0) + 1;
    audioState.nextPrefetchPlanKey = planKey;
    audioState.nextPrefetchPlan = targets;
    // A Service Worker hit describes a consumed response, not readiness for a
    // later generation. Current readiness comes only from a validated write or
    // from this generation's cache hydration.
    audioState.nextPrefetchServedSrc = "";
    audioState.nextPrefetchWindowReadyKey = "";
    audioState.nextPrefetchCacheHydrationKey = "";
    audioState.nextPrefetchCacheHydratedKey = "";
    audioState.nextPrefetchCacheN1HydratedKey = "";
    audioState.nextPrefetchCacheHydrationPromise = null;
    const usefulTargets = new Map(
      targets.map(function (target) {
        return [target.src, target];
      })
    );
    const useful = new Set(usefulTargets.keys());
    audioState.nextPrefetchControllers.forEach(function (record, src) {
      if (!useful.has(src) || (currentSrc && srcMatches(src, currentSrc))) {
        abortPrefetchTarget(
          src,
          currentSrc && srcMatches(src, currentSrc) ? "became_current" : "window_rebased"
        );
        return;
      }
      // A fast skip rebases the rolling window while N+2...N+5 may still be
      // downloading. Keep those useful requests and bind their completion to
      // the new authoritative generation instead of throwing their bytes away.
      const reboundTarget = usefulTargets.get(src);
      record.generation = audioState.nextPrefetchGeneration;
      record.planKey = planKey;
      record.index = reboundTarget ? reboundTarget.index : record.index;
      record.rank = reboundTarget ? reboundTarget.rank : record.rank;
    });
    audioState.nextPrefetchRetryTimers.forEach(function (_timer, src) {
      if (!useful.has(src)) abortPrefetchTarget(src, "window_rebased");
    });
    audioState.nextPrefetchAttemptCounts.forEach(function (_count, src) {
      if (!useful.has(src)) audioState.nextPrefetchAttemptCounts.delete(src);
    });
    audioState.nextPrefetchReadySrcs.forEach(function (src) {
      if (!useful.has(src) || (currentSrc && srcMatches(src, currentSrc))) {
        audioState.nextPrefetchReadySrcs.delete(src);
      }
    });

    const first = targets[0] || null;
    audioState.nextPrefetchSrc = first ? first.src : "";
    audioState.nextPrefetchIndex = first ? first.index : -1;
    audioState.nextPrefetchFromIndex = getCurrentPlaylistIndexSafe();
    audioState.nextPrefetchSuspendedReason = "";
    trackAudioRuntimeEvent("prefetch_plan", {
      track: "prefetch-window",
      album: audioState.homeMode === "radio" ? "radio" : "album",
      reason: reason || "reconcile",
      generation: audioState.nextPrefetchGeneration,
      from_index: audioState.nextPrefetchFromIndex,
      depth: targets.length,
      sources: targets.map(function (target) {
        return target.src;
      })
    });
    return targets;
  }

  function resetNextTrackPrefetchState() {
    ensureNextPrefetchCollections();
    audioState.nextPrefetchSrc = "";
    audioState.nextPrefetchIndex = -1;
    audioState.nextPrefetchFromIndex = -1;
    audioState.nextPrefetchDoneSrc = "";
    audioState.nextPrefetchServedSrc = "";
    audioState.nextPrefetchAttemptedSrc = "";
    audioState.nextPrefetchFailedSrc = "";
    audioState.nextPrefetchFailureReason = "";
    audioState.nextPrefetchPlan = [];
    audioState.nextPrefetchPlanKey = "";
    audioState.nextPrefetchWindowReadyKey = "";
    audioState.nextPrefetchCacheHydrationKey = "";
    audioState.nextPrefetchCacheHydratedKey = "";
    audioState.nextPrefetchCacheN1HydratedKey = "";
    audioState.nextPrefetchCacheHydrationPromise = null;
    audioState.nextPrefetchAttemptCounts.clear();
  }

  function clearNextTrackPrefetch(reason) {
    ensureNextPrefetchCollections();
    audioState.nextPrefetchToken += 1;
    Array.from(audioState.nextPrefetchControllers.keys()).forEach(function (src) {
      abortPrefetchTarget(src, reason || "reset");
    });
    Array.from(audioState.nextPrefetchRetryTimers.keys()).forEach(function (src) {
      abortPrefetchTarget(src, reason || "reset");
    });
    resetNextTrackPrefetchState();
    audioState.upcomingTrackPlan = null;
    audioState.nextPrefetchGeneration = Number(audioState.nextPrefetchGeneration || 0) + 1;
    if (prefetchApi && typeof prefetchApi.pruneCache === "function") {
      prefetchApi
        .pruneCache({
          keepSources: getPrefetchKeepSources(),
          maxEntries: PREFETCH_NEXT_MAX_ENTRIES
        })
        .catch(function () {});
    }
  }

  function suspendNextTrackPrefetch(reason) {
    ensureNextPrefetchCollections();
    const bufferAhead = getCurrentBufferAheadForPrefetch();
    const inflight = Array.from(audioState.nextPrefetchControllers.entries()).sort(function (left, right) {
      const leftRank = Number.isFinite(Number(left[1] && left[1].rank))
        ? Number(left[1].rank)
        : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(Number(right[1] && right[1].rank))
        ? Number(right[1].rank)
        : Number.MAX_SAFE_INTEGER;
      return rightRank - leftRank;
    });
    // Critical playback always owns the mobile connection. Prepared transport
    // changes preserve useful work by not entering this function at all.
    const cancelled = inflight;
    cancelled.forEach(function (entry) {
      const src = entry[0];
      abortPrefetchTarget(src, reason || "buffer_priority");
      audioState.nextPrefetchAttemptCounts.delete(src);
    });
    audioState.nextPrefetchSuspendedReason = reason || "buffer_priority";
    if (cancelled.length) {
      trackAudioRuntimeEvent("prefetch_suspended", {
        track: "prefetch-window",
        album: audioState.homeMode === "radio" ? "radio" : "album",
        reason: audioState.nextPrefetchSuspendedReason,
        buffer_ahead: bufferAhead,
        cancelled_count: cancelled.length
      });
    }
  }

  function peekNextIndexForPrefetch() {
    const targets = reconcileNextTrackPrefetchPlan("peek");
    return targets.length ? targets[0].index : -1;
  }

  function rememberNextTrackPrefetch(index, src) {
    audioState.nextPrefetchIndex = index;
    audioState.nextPrefetchFromIndex = getCurrentPlaylistIndexSafe();
    audioState.nextPrefetchSrc = normalizeAudioSourceUrl(src || "");
  }

  function getAutoPrefetchedNextIndex() {
    if (!PREFETCH_NEXT_ENABLED) return -1;
    ensureNextPrefetchCollections();
    const targets = reconcileNextTrackPrefetchPlan("readiness");
    const first = targets[0];
    if (!first) return -1;
    return audioState.nextPrefetchReadySrcs.has(first.src) ? first.index : -1;
  }

  function startNextTrackPrefetch(index, track, src, reason) {
    const prefetchSupported = Boolean(
      prefetchApi &&
      typeof prefetchApi.isSupported === "function" &&
      prefetchApi.isSupported() &&
      typeof prefetchApi.putSingle === "function"
    );
    if (!PREFETCH_NEXT_ENABLED || !prefetchSupported) return false;
    ensureNextPrefetchCollections();
    const normalizedSrc = normalizeAudioSourceUrl(src || "");
    if (!normalizedSrc || !isCloudflareAudioUrl(normalizedSrc)) return false;
    if (audioState.nextPrefetchReadySrcs.has(normalizedSrc)) return false;
    if (audioState.nextPrefetchInFlightSrcs.has(normalizedSrc)) return false;
    if (audioState.nextPrefetchRetryTimers.has(normalizedSrc)) return false;
    if (audioState.nextPrefetchInFlightSrcs.size >= PREFETCH_NEXT_CONCURRENCY) return false;
    const attempts = Number(audioState.nextPrefetchAttemptCounts.get(normalizedSrc) || 0);
    if (attempts >= getPrefetchAttemptLimit(normalizedSrc)) return false;

    const generation = Number(audioState.nextPrefetchGeneration || 0);
    const planKey = String(audioState.nextPrefetchPlanKey || "");
    const attempt = attempts + 1;
    const startedAt = Date.now();
    const fromIndexAtStart = getCurrentPlaylistIndexSafe();
    const target = (audioState.nextPrefetchPlan || []).find(function (entry) {
      return srcMatches(entry.src, normalizedSrc);
    });
    const abortController = typeof AbortController === "function" ? new AbortController() : null;
    const record = {
      controller: abortController,
      timeout: 0,
      timeoutFired: false,
      cancelReason: "",
      generation,
      planKey,
      attempt,
      index,
      rank: target ? target.rank : null
    };
    record.failureReason = "";
    record.retryableFailure = false;
    let responseMs = null;
    let storeTimings = null;
    audioState.nextPrefetchAttemptCounts.set(normalizedSrc, attempt);
    audioState.nextPrefetchControllers.set(normalizedSrc, record);
    audioState.nextPrefetchInFlightSrcs.add(normalizedSrc);
    audioState.nextPrefetchInFlight = true;
    audioState.nextPrefetchAbortController = abortController;
    rememberNextTrackPrefetch(index, normalizedSrc);
    audioState.nextPrefetchAttemptedSrc = normalizedSrc;
    audioState.nextPrefetchFailedSrc = "";
    audioState.nextPrefetchFailureReason = "";
    trackAudioRuntimeEvent(
      "prefetch_start",
      Object.assign(buildAudioMonitorPayload(track, index, normalizedSrc), {
        next_index: index,
        from_index: fromIndexAtStart,
        reason: reason || "buffer_stable",
        generation,
        rank: target ? target.rank : null,
        attempt,
        segment_bytes: PREFETCH_NEXT_SEGMENT_BYTES,
        inflight_count: audioState.nextPrefetchInFlightSrcs.size
      })
    );

    const baseRequest = getPrefetchCacheRequest(normalizedSrc);
    let fetchRequest = baseRequest;
    let fetchOptions;
    if (abortController) {
      try {
        fetchRequest = new Request(baseRequest, { signal: abortController.signal });
      } catch (_err) {
        fetchOptions = { signal: abortController.signal };
      }
      record.timeout = window.setTimeout(function () {
        record.timeoutFired = true;
        record.cancelReason = "timeout";
        try {
          abortController.abort();
        } catch (_err) {}
      }, PREFETCH_REQUEST_TIMEOUT_MS);
    }

    fetch(fetchRequest, fetchOptions)
      .then(function (response) {
        responseMs = Date.now() - startedAt;
        const stillUseful = isPrefetchTargetUsefulForSnapshot(
          normalizedSrc,
          record.generation,
          record.planKey
        );
        if (!stillUseful) {
          cancelPrefetchResponseBody(response);
          throw new Error("prefetch_obsolete");
        }
        if (!response || response.status !== 206) {
          cancelPrefetchResponseBody(response);
          throw new Error(`prefetch_http_${response ? response.status : "none"}`);
        }
        const bytes = prefetchApi.getContentLength(response);
        if (!Number.isFinite(bytes) || bytes <= 0) {
          cancelPrefetchResponseBody(response);
          throw new Error("prefetch_missing_content_length");
        }
        if (bytes > PREFETCH_NEXT_SEGMENT_BYTES || bytes > PREFETCH_NEXT_MAX_BYTES) {
          cancelPrefetchResponseBody(response);
          throw new Error("prefetch_segment_too_large");
        }
        return prefetchApi
          .putSingle(normalizedSrc, response, {
            keepSources: getPrefetchKeepSources(),
            getKeepSources: getPrefetchKeepSources,
            maxEntries: PREFETCH_NEXT_MAX_ENTRIES,
            timeoutMs: PREFETCH_REQUEST_TIMEOUT_MS,
            shouldStore: function () {
              return (
                !record.cancelReason &&
                isPrefetchTargetUsefulForSnapshot(normalizedSrc, record.generation, record.planKey)
              );
            },
            onBodyReady: function (timings) {
              storeTimings = Object.assign({}, storeTimings || {}, timings || {});
              if (record.timeout) {
                window.clearTimeout(record.timeout);
                record.timeout = 0;
              }
            },
            onTimings: function (timings) {
              storeTimings =
                timings && typeof timings === "object"
                  ? Object.assign({}, storeTimings || {}, timings)
                  : storeTimings;
            }
          })
          .then(function () {
            return bytes;
          });
      })
      .then(function (bytes) {
        const stillUseful = isPrefetchTargetUsefulForSnapshot(
          normalizedSrc,
          record.generation,
          record.planKey
        );
        if (!bytes || !stillUseful) return;
        audioState.nextPrefetchReadySrcs.add(normalizedSrc);
        audioState.nextPrefetchDoneSrc = normalizedSrc;
        audioState.nextPrefetchFailedSrc = "";
        audioState.nextPrefetchFailureReason = "";
        trackAudioRuntimeEvent(
          "prefetch_done",
          Object.assign(buildAudioMonitorPayload(track, index, normalizedSrc), {
            next_index: record.index,
            from_index: fromIndexAtStart,
            bytes,
            ms: Date.now() - startedAt,
            response_ms: responseMs,
            body_ms: storeTimings ? storeTimings.body_ms : null,
            queue_ms: storeTimings ? storeTimings.queue_ms : null,
            cache_ms: storeTimings ? storeTimings.cache_ms : null,
            generation: record.generation,
            rank: record.rank,
            attempt,
            ready_count: audioState.nextPrefetchReadySrcs.size
          })
        );
      })
      .catch(function (err) {
        const errorReason = record.timeoutFired
          ? "timeout"
          : record.cancelReason || (err && err.message ? err.message : "prefetch_failed");
        const cancelled =
          Boolean(record.cancelReason && record.cancelReason !== "timeout") ||
          errorReason === "prefetch_obsolete";
        record.failureReason = errorReason;
        record.retryableFailure = !cancelled && isTransientPrefetchFailure(errorReason, err);
        if (!cancelled && !record.retryableFailure) {
          audioState.nextPrefetchAttemptCounts.set(normalizedSrc, getPrefetchAttemptLimit(normalizedSrc));
        }
        audioState.nextPrefetchFailedSrc = cancelled ? "" : normalizedSrc;
        audioState.nextPrefetchFailureReason = cancelled ? "" : errorReason;
        trackAudioRuntimeEvent(
          cancelled ? "prefetch_cancel" : "prefetch_error",
          Object.assign(buildAudioMonitorPayload(track, index, normalizedSrc), {
            next_index: record.index,
            from_index: fromIndexAtStart,
            reason: errorReason,
            ms: Date.now() - startedAt,
            response_ms: responseMs,
            body_ms: storeTimings ? storeTimings.body_ms : null,
            queue_ms: storeTimings ? storeTimings.queue_ms : null,
            cache_ms: storeTimings ? storeTimings.cache_ms : null,
            generation: record.generation,
            rank: record.rank,
            attempt
          })
        );
      })
      .finally(function () {
        if (record.timeout) window.clearTimeout(record.timeout);
        if (audioState.nextPrefetchControllers.get(normalizedSrc) === record) {
          audioState.nextPrefetchControllers.delete(normalizedSrc);
          audioState.nextPrefetchInFlightSrcs.delete(normalizedSrc);
        }
        audioState.nextPrefetchInFlight = audioState.nextPrefetchInFlightSrcs.size > 0;
        if (audioState.nextPrefetchAbortController === abortController)
          audioState.nextPrefetchAbortController = null;
        const stillUseful = isPrefetchTargetUsefulForSnapshot(
          normalizedSrc,
          record.generation,
          record.planKey
        );
        const attemptLimit = getPrefetchAttemptLimit(normalizedSrc);
        const retryable =
          !audioState.nextPrefetchReadySrcs.has(normalizedSrc) &&
          (!record.cancelReason || record.cancelReason === "timeout") &&
          record.retryableFailure &&
          stillUseful &&
          attempt < attemptLimit;
        if (retryable) {
          const retryTimer = window.setTimeout(function () {
            audioState.nextPrefetchRetryTimers.delete(normalizedSrc);
            const generation = Number(audioState.nextPrefetchGeneration || 0);
            const planKey = String(audioState.nextPrefetchPlanKey || "");
            if (!isPrefetchTargetUsefulForSnapshot(normalizedSrc, generation, planKey)) return;
            inspectCacheBeforePrefetchRetry(normalizedSrc, record.failureReason).then(
              function (cacheRecovered) {
                if (cacheRecovered) {
                  maybePrefetchNextTrack("cache_timeout_recovered");
                  return;
                }
                maybePrefetchNextTrack("retry");
              }
            );
          }, getPrefetchRetryDelay(attempt));
          audioState.nextPrefetchRetryTimers.set(normalizedSrc, retryTimer);
        } else {
          window.setTimeout(function () {
            maybePrefetchNextTrack("queue_continue");
          }, 0);
        }
      });
    return true;
  }

  function maybePrefetchNextTrack(reason, options) {
    if (!PREFETCH_NEXT_ENABLED) return;
    ensureNextPrefetchCollections();
    const opts = options || {};
    if (reason === "track_change" && !opts.consumedPrepared) {
      suspendNextTrackPrefetch("track_change_unprepared");
    }
    const targets = reconcileNextTrackPrefetchPlan(reason || "update");
    if (!targets.length) return;
    if (reason === "track_change") {
      // Reconcile cancels only the source that became current and targets that
      // left the rolling window. One still-useful speculative request may keep
      // progressing beside the native media request instead of resetting the
      // complete N+1...N+5 cycle after every fast transport tap.
      return;
    }
    if (hydrateNextTrackPrefetchPlanFromCache(targets)) return;
    const hydrationKey = `${Number(audioState.nextPrefetchGeneration || 0)}|${String(audioState.nextPrefetchPlanKey || "")}`;
    const tailCacheInspectionPending =
      audioState.nextPrefetchCacheHydrationKey === hydrationKey &&
      audioState.nextPrefetchCacheN1HydratedKey === hydrationKey;
    if (!shouldPrefetchNextTrackNow()) {
      if (getCurrentBufferAheadForPrefetch() < PREFETCH_BUFFER_ABORT_SECONDS) {
        suspendNextTrackPrefetch(reason || "buffer_priority");
      }
      return;
    }
    audioState.nextPrefetchSuspendedReason = "";

    const first = targets[0];
    const firstReady = audioState.nextPrefetchReadySrcs.has(first.src);
    if (!firstReady) {
      const firstAttempts = Number(audioState.nextPrefetchAttemptCounts.get(first.src) || 0);
      const firstInFlight = audioState.nextPrefetchInFlightSrcs.has(first.src);
      const firstRetryPending = audioState.nextPrefetchRetryTimers.has(first.src);
      const firstAttemptLimit = getPrefetchAttemptLimit(first.src);
      if (!firstInFlight && !firstRetryPending && firstAttempts < firstAttemptLimit) {
        freePrefetchLaneForPriority(first, "n_plus_1_reordered");
        startNextTrackPrefetch(first.index, first.track, first.src, reason || "n_plus_1");
      }
      // Protect the most probable target: the second mobile lane is opened
      // only once N+1 is actually available, never while N+1 is pending.
      if (firstInFlight || firstRetryPending || firstAttempts < firstAttemptLimit) return;
    }

    // Cache inspection of N+2...N+5 stays in the background, but no duplicate
    // network request is allowed until each of those cache entries is known.
    if (tailCacheInspectionPending) return;

    // Once N+1 is safe, both mobile lanes can fill the remaining rolling
    // window in the exact same order used by the transport controls.
    for (let offset = 1; offset < targets.length; offset += 1) {
      if (audioState.nextPrefetchInFlightSrcs.size >= PREFETCH_NEXT_CONCURRENCY) break;
      const target = targets[offset];
      if (audioState.nextPrefetchReadySrcs.has(target.src)) continue;
      if (audioState.nextPrefetchInFlightSrcs.has(target.src)) continue;
      if (audioState.nextPrefetchRetryTimers.has(target.src)) continue;
      if (
        Number(audioState.nextPrefetchAttemptCounts.get(target.src) || 0) >=
        getPrefetchAttemptLimit(target.src)
      )
        continue;
      startNextTrackPrefetch(target.index, target.track, target.src, reason || "window_fill");
    }

    const readyKey = `${audioState.nextPrefetchGeneration}|${targets
      .map(function (target) {
        return target.src;
      })
      .join("|")}`;
    if (
      audioState.nextPrefetchWindowReadyKey !== readyKey &&
      targets.every(function (target) {
        return audioState.nextPrefetchReadySrcs.has(target.src);
      })
    ) {
      audioState.nextPrefetchWindowReadyKey = readyKey;
      trackAudioRuntimeEvent("prefetch_window_ready", {
        track: "prefetch-window",
        album: audioState.homeMode === "radio" ? "radio" : "album",
        generation: audioState.nextPrefetchGeneration,
        depth: targets.length,
        bytes: targets.length * PREFETCH_NEXT_SEGMENT_BYTES
      });
    }
  }

  function scheduleSilentCheck(track, index, src, requestToken) {
    window.setTimeout(function () {
      if (requestToken !== audioState.startRequestToken) return;
      const audio = audioState.audio;
      trackAudioRuntimeEvent(
        "silent_check",
        Object.assign(buildAudioMonitorPayload(track, index, src), getAudioRuntimeProbeState(), {
          request_token: requestToken,
          paused: audio ? Boolean(audio.paused) : null,
          muted: audio ? Boolean(audio.muted) : null,
          volume: audio && Number.isFinite(audio.volume) ? audio.volume : null,
          sync: true,
          trigger: "auto"
        })
      );
    }, 3000);
  }

  return {
    link() {},
    fns: {
      getPrefetchCacheRequest,
      ensureNextPrefetchCollections,
      cancelPrefetchResponseBody,
      getPrefetchAttemptLimit,
      isTransientPrefetchFailure,
      getPrefetchRetryDelay,
      getCurrentBufferedEndForPrefetch,
      getCurrentBufferAheadForPrefetch,
      shouldPrefetchNextTrackNow,
      getPrefetchKeepSources,
      isPrefetchPlanSnapshotCurrent,
      isPrefetchTargetUsefulForSnapshot,
      hydrateNextTrackPrefetchPlanFromCache,
      abortPrefetchTarget,
      freePrefetchLaneForPriority,
      inspectCacheBeforePrefetchRetry,
      reconcileNextTrackPrefetchPlan,
      resetNextTrackPrefetchState,
      clearNextTrackPrefetch,
      suspendNextTrackPrefetch,
      peekNextIndexForPrefetch,
      rememberNextTrackPrefetch,
      getAutoPrefetchedNextIndex,
      startNextTrackPrefetch,
      maybePrefetchNextTrack,
      scheduleSilentCheck
    }
  };
}
