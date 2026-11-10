// Préparation et cache des pochettes.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import {
  ALBUM_COVER_IMAGE_CACHE_LIMIT,
  ALBUM_COVER_PREPARE_LIMIT,
  COVERS_CACHE_NAME,
  COVER_SESSION_PREPARE_CONCURRENCY,
  COVER_SESSION_PREPARE_ENABLED,
  audioState,
  spaState
} from "../scripts.js";
import { getAudioTelemetryNow } from "./config.js";
import { getImagePreferredSrc } from "./module-bridges.js";
import { loadTracksData } from "./catalog-playback.js";
import { isMobilePwaCoverNavigation } from "./theme-admin-pwa.js";
import {
  getCurrentAlbumTitle,
  normalizeAlbumTitle,
  preloadImage,
  toAbsoluteUrlOrEmpty,
  toRuntimeAbsoluteUrl
} from "./audio-sources.js";
import { choosePreferredSrcsetSource, normalizeCoverUrl } from "./media-artwork.js";
import { getAlbumNameFromUrlLike, trackAudioRuntimeEvent } from "./playback.js";
import { isAlbumOpenUrl } from "./page-init.js";

function shouldInitAudioFeatures() {
  if (document.querySelector(".track-player")) return true;

  const persistRoot = document.getElementById("infraSpaPersist");
  if (persistRoot && (persistRoot.querySelector("audio") || persistRoot.querySelector(".global-transport"))) {
    return true;
  }

  try {
    const raw = sessionStorage.getItem(audioState.resumeStorageKey);
    if (raw) return true;
  } catch (_err) {
    // Ignore storage errors.
  }

  return false;
}

function getResourceTimingHint(urlLike, startedAt) {
  if (typeof performance === "undefined" || typeof performance.getEntriesByName !== "function") {
    return {};
  }
  const url = toAbsoluteUrlOrEmpty(urlLike || "");
  if (!url) return {};
  const entries = performance.getEntriesByName(url, "resource");
  if (!entries || !entries.length) return {};
  const minStart = Number(startedAt);
  const candidates = entries.filter(function (entry) {
    return !Number.isFinite(minStart) || Number(entry.startTime || 0) >= minStart - 100;
  });
  const entry = candidates.length ? candidates[candidates.length - 1] : entries[entries.length - 1];
  const transferSize = Number(entry.transferSize);
  const encodedBodySize = Number(entry.encodedBodySize);
  const decodedBodySize = Number(entry.decodedBodySize);
  let cacheHint = "unknown";
  if (Number.isFinite(transferSize)) {
    cacheHint = transferSize === 0 && (encodedBodySize > 0 || decodedBodySize > 0) ? "cache" : "network";
  }
  return {
    cache_hint: cacheHint,
    transfer_size: Number.isFinite(transferSize) ? transferSize : null,
    encoded_body_size: Number.isFinite(encodedBodySize) ? encodedBodySize : null,
    decoded_body_size: Number.isFinite(decodedBodySize) ? decodedBodySize : null
  };
}

function logCoverRuntimeEvent(type, payload, opts) {
  const eventType = String(type || "");
  const data = Object.assign({}, payload || {});
  if (eventType === "cover_request") {
    const now = getAudioTelemetryNow();
    const dedupeMs = Math.max(0, Number(opts && opts.dedupeMs) || 1200);
    const key = [
      eventType,
      data.source || "",
      data.album || "",
      data.track_path || "",
      data.cover_url || ""
    ].join("|");
    const last = Number(audioState.coverTelemetryRecent.get(key) || 0);
    if (last && now - last < dedupeMs) return false;
    audioState.coverTelemetryRecent.set(key, now);
    if (audioState.coverTelemetryRecent.size > 80) {
      const cutoff = now - 10000;
      audioState.coverTelemetryRecent.forEach(function (value, recentKey) {
        if (value < cutoff) audioState.coverTelemetryRecent.delete(recentKey);
      });
    }
  }
  trackAudioRuntimeEvent(eventType, data);
  return true;
}

function getAlbumCoverWarmupUrls(tracksData) {
  const albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
  const urls = [];
  const seen = new Set();
  albums.forEach(function (album) {
    const raw = album && album.cover ? String(album.cover).trim() : "";
    const canonical = normalizeCoverUrl(toRuntimeAbsoluteUrl(raw), { width: 1200 });
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    urls.push({
      url: canonical,
      album: normalizeAlbumTitle(album.title || album.slug || ""),
      width: 1200
    });
  });
  // Keep the entire catalogue eligible so late entries are never excluded
  // from the persistent decoded-cover cache.
  return urls;
}

function getVisibleHomeCoverUrls() {
  const urls = [];
  const seen = new Set();
  const preferredWidth = 1200;
  Array.from(document.querySelectorAll("img.album-cover")).forEach(function (img) {
    if (typeof img.getBoundingClientRect === "function") {
      const rect = img.getBoundingClientRect();
      const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
      const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
      if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth)
        return;
    }
    const url = getImagePreferredSrc(img, window.location.href, { preferredWidth });
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  });
  return urls;
}

function primeLinkedAlbumCoverForPwa(link, targetUrl) {
  if (!isMobilePwaCoverNavigation()) return "";
  if (!link || !targetUrl || !isAlbumOpenUrl(targetUrl)) return "";

  const img =
    typeof link.querySelector === "function" ? link.querySelector("img.album-cover, img.cover") : null;
  if (!img) return "";

  const srcset = img.getAttribute("srcset") || "";
  const preferred =
    choosePreferredSrcsetSource(srcset, 1200) ||
    img.currentSrc ||
    String(img.getAttribute("src") || "").trim();
  const url = preferred ? normalizeCoverUrl(preferred, { width: 1200 }) : "";
  if (!url) return "";

  if (audioState.albumCoverReadyUrls.has(url) || audioState.albumCoverPrimeUrls.has(url)) return url;

  audioState.albumCoverPrimeUrls.add(url);
  preloadImage(url, { highPriority: true })
    .then(function (result) {
      if (result && result.ok) {
        audioState.albumCoverReadyUrls.add(url);
      }
    })
    .catch(function () {})
    .finally(function () {
      // Only block duplicate requests while the current decode is running.
      // A transient mobile/network failure must remain retryable on the next tap.
      audioState.albumCoverPrimeUrls.delete(url);
    });
  return url;
}

function releasePwaCoverHold(reason) {
  const hold = spaState.pwaCoverHold;
  if (!hold || !hold.node) {
    spaState.pwaCoverHold = null;
    return;
  }

  const reasonText = String(reason || "done");
  const forceRelease = /^(replace|timeout|stale_|.*_aborted|fallback|fetch_error)$/i.test(reasonText);
  const now = getAudioTelemetryNow();
  const minVisibleUntil = Number(hold.minVisibleUntil) || 0;
  if (!forceRelease && minVisibleUntil > now) {
    if (!hold.releaseTimer) {
      hold.releaseTimer = window.setTimeout(
        function () {
          if (spaState.pwaCoverHold === hold) {
            hold.releaseTimer = 0;
            releasePwaCoverHold(reasonText);
          }
        },
        Math.max(0, Math.round(minVisibleUntil - now))
      );
    }
    return;
  }

  spaState.pwaCoverHold = null;
  if (hold.timer) {
    window.clearTimeout(hold.timer);
  }
  if (hold.releaseTimer) {
    window.clearTimeout(hold.releaseTimer);
  }
  const node = hold.node;
  node.dataset.reason = reasonText;
  node.style.opacity = "0";
  node.style.transition = "opacity 70ms ease-out";
  window.setTimeout(function () {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }, 90);
}

function orderAlbumCoverWarmupUrls(covers) {
  const visible = getVisibleHomeCoverUrls();
  if (!visible.length) return covers;
  const rank = new Map();
  visible.forEach(function (url, index) {
    rank.set(url, index);
  });
  return covers.slice().sort(function (a, b) {
    const aRank = rank.has(a.url) ? rank.get(a.url) : 999 + covers.indexOf(a);
    const bRank = rank.has(b.url) ? rank.get(b.url) : 999 + covers.indexOf(b);
    return aRank - bRank;
  });
}

function limitAlbumCoverWarmupUrls(covers) {
  if (!Array.isArray(covers) || !covers.length) return [];
  return covers.slice(0, Math.min(ALBUM_COVER_PREPARE_LIMIT, covers.length));
}

function shouldPauseAlbumCoverWarmup() {
  const audio = audioState.audio;
  const recentPlayRequest =
    Number(audioState.playRequestTs || 0) > 0 && Date.now() - Number(audioState.playRequestTs || 0) < 3000;
  const audioBusy = Boolean(
    audioState.trackStartInFlight ||
    audioState.sourceMetadataPending ||
    audioState.mediaSessionAudioPlaying ||
    audioState.activeAudioRecovery ||
    audioState.stallRecovery ||
    recentPlayRequest ||
    (audio && !audio.paused)
  );
  const pwaNavigationBusy = Boolean(spaState.navigationActive && isMobilePwaCoverNavigation());
  return Boolean(audioBusy || pwaNavigationBusy);
}

function decodeCoverForSession(url, signal) {
  return new Promise(function (resolve) {
    if (!url || (signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
      resolve(false);
      return;
    }
    if (audioState.albumCoverImageCache && audioState.albumCoverImageCache.has(url)) {
      const cachedImage = audioState.albumCoverImageCache.get(url);
      audioState.albumCoverImageCache.delete(url);
      audioState.albumCoverImageCache.set(url, cachedImage);
      audioState.albumCoverReadyUrls.add(url);
      resolve(true);
      return;
    }
    const image = new Image();
    let settled = false;
    image.decoding = "async";

    function done(value) {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      if (signal && typeof signal.removeEventListener === "function") {
        signal.removeEventListener("abort", abortDecode);
      }
      resolve(Boolean(value));
    }

    function abortDecode() {
      try {
        image.removeAttribute("src");
      } catch (_err) {
        // The detached image may already have completed.
      }
      done(false);
    }

    function remember() {
      if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
        done(false);
        return;
      }
      rememberAlbumCoverImage(url, image);
      done(true);
    }
    image.onload = function () {
      if (typeof image.decode === "function") {
        image.decode().then(remember, remember);
        return;
      }
      remember();
    };
    image.onerror = function () {
      done(false);
    };
    if (signal && typeof signal.addEventListener === "function") {
      signal.addEventListener("abort", abortDecode, { once: true });
    }
    image.src = url;
  });
}

function prepareAlbumCoverEntry(cache, entry, reason, signal) {
  if (!entry || !entry.url) return Promise.resolve(false);
  if (audioState.albumCoverReadyUrls.has(entry.url)) return Promise.resolve(true);
  if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) return Promise.resolve(false);
  const startedAt = getAudioTelemetryNow();
  const request = new Request(entry.url, {
    method: "GET",
    credentials: "same-origin",
    cache: "default"
  });

  return cache
    .match(request)
    .then(function (cached) {
      if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
        return { aborted: true, cacheHint: cached ? "cache" : "unknown" };
      }
      if (cached) return { response: cached, cacheHint: "cache" };
      logCoverRuntimeEvent(
        "cover_request",
        {
          album: entry.album,
          source: "session_prepare",
          cover_url: entry.url,
          reason: reason || "session"
        },
        { dedupeMs: 30000 }
      );
      return fetch(request, signal ? { signal } : {}).then(function (response) {
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(function () {});
          return { response, cacheHint: "network" };
        }
        throw new Error("cover_prepare_http");
      });
    })
    .then(function (result) {
      if (!result || result.aborted || (signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
        return false;
      }
      return decodeCoverForSession(entry.url, signal).then(function (decoded) {
        if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) return false;
        if (decoded) audioState.albumCoverReadyUrls.add(entry.url);
        trackAudioRuntimeEvent(
          "cover_prepare_item",
          Object.assign(
            {
              album: entry.album,
              cover_url: entry.url,
              width: entry.width || 0,
              cache_hint: result && result.cacheHint ? result.cacheHint : "unknown",
              decoded: Boolean(decoded),
              ready: audioState.albumCoverReadyUrls.has(entry.url),
              memory: Boolean(
                audioState.albumCoverImageCache && audioState.albumCoverImageCache.has(entry.url)
              ),
              duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
              reason: reason || "session"
            },
            getResourceTimingHint(entry.url, startedAt)
          )
        );
        return Boolean(decoded);
      });
    })
    .catch(function (err) {
      if ((signal && signal.aborted) || (err && err.name === "AbortError")) return false;
      trackAudioRuntimeEvent("cover_prepare_error", {
        album: entry.album,
        cover_url: entry.url,
        width: entry.width || 0,
        reason: reason || "session",
        error_name: err && err.name ? err.name : "Error",
        error_message: err && err.message ? err.message : "cover_prepare_failed"
      });
      return false;
    });
}

function rememberAlbumCoverImage(url, image) {
  if (!url) return;
  if (audioState.albumCoverReadyUrls && typeof audioState.albumCoverReadyUrls.add === "function") {
    audioState.albumCoverReadyUrls.add(url);
  }
  if (!image || !audioState.albumCoverImageCache || typeof audioState.albumCoverImageCache.set !== "function")
    return;
  if (audioState.albumCoverImageCache.has(url)) {
    audioState.albumCoverImageCache.delete(url);
  }
  audioState.albumCoverImageCache.set(url, image);
  while (audioState.albumCoverImageCache.size > ALBUM_COVER_IMAGE_CACHE_LIMIT) {
    const oldest = audioState.albumCoverImageCache.keys().next();
    if (oldest.done) break;
    audioState.albumCoverImageCache.delete(oldest.value);
  }
}

function prepareAlbumCoversForSession(reason) {
  if (!COVER_SESSION_PREPARE_ENABLED) return warmAlbumCoverCache(reason);
  if (audioState.albumCoverCacheWarmupDone) return Promise.resolve();
  if (audioState.albumCoverPreparePromise) return audioState.albumCoverPreparePromise;
  if (typeof caches === "undefined" || !caches.open) return Promise.resolve();
  if (shouldPauseAlbumCoverWarmup()) {
    audioState.albumCoverCacheWarmupScheduled = false;
    audioState.albumCoverWarmupResumePending = true;
    return Promise.resolve();
  }

  audioState.albumCoverCacheWarmupScheduled = true;
  const startedAt = getAudioTelemetryNow();
  const abortController = typeof AbortController === "function" ? new AbortController() : null;
  const signal = abortController ? abortController.signal : null;
  const warmupAudio = audioState.audio;
  let pausedForActivity = false;
  const pauseForAudio = function () {
    pausedForActivity = true;
    if (abortController && !abortController.signal.aborted) abortController.abort();
  };
  if (warmupAudio && typeof warmupAudio.addEventListener === "function") {
    warmupAudio.addEventListener("loadstart", pauseForAudio);
    warmupAudio.addEventListener("play", pauseForAudio);
    warmupAudio.addEventListener("playing", pauseForAudio);
  }
  audioState.albumCoverPreparePromise = loadTracksData()
    .then(function (tracksData) {
      if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
        pausedForActivity = true;
        return;
      }
      const covers = limitAlbumCoverWarmupUrls(
        orderAlbumCoverWarmupUrls(getAlbumCoverWarmupUrls(tracksData))
      );
      if (!covers.length) {
        audioState.albumCoverCacheWarmupDone = true;
        return;
      }
      trackAudioRuntimeEvent("cover_prepare_start", {
        count: covers.length,
        reason: reason || "session"
      });
      return caches.open(COVERS_CACHE_NAME).then(function (cache) {
        let cursor = 0;
        let decodedCount = 0;
        const workerCount = Math.min(COVER_SESSION_PREPARE_CONCURRENCY, covers.length);
        const workers = Array.from({ length: workerCount }, function () {
          return Promise.resolve().then(function runNext() {
            if ((signal && signal.aborted) || shouldPauseAlbumCoverWarmup()) {
              pausedForActivity = true;
              if (abortController && !abortController.signal.aborted) abortController.abort();
              return;
            }
            const entry = covers[cursor];
            cursor += 1;
            if (!entry) return;
            return prepareAlbumCoverEntry(cache, entry, reason, signal).then(function (decoded) {
              if (decoded) decodedCount += 1;
              return runNext();
            });
          });
        });
        return Promise.all(workers).then(function () {
          audioState.albumCoverCacheWarmupDone = audioState.albumCoverReadyUrls.size >= covers.length;
          trackAudioRuntimeEvent("cover_prepare_done", {
            count: covers.length,
            decoded_count: decodedCount,
            ready_count: audioState.albumCoverReadyUrls.size,
            memory_count: audioState.albumCoverImageCache ? audioState.albumCoverImageCache.size : 0,
            complete: Boolean(audioState.albumCoverCacheWarmupDone),
            duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
            reason: reason || "session"
          });
        });
      });
    })
    .catch(function (err) {
      trackAudioRuntimeEvent("cover_prepare_error", {
        reason: reason || "session",
        error_name: err && err.name ? err.name : "Error",
        error_message: err && err.message ? err.message : "cover_prepare_failed"
      });
    })
    .finally(function () {
      if (warmupAudio && typeof warmupAudio.removeEventListener === "function") {
        warmupAudio.removeEventListener("loadstart", pauseForAudio);
        warmupAudio.removeEventListener("play", pauseForAudio);
        warmupAudio.removeEventListener("playing", pauseForAudio);
      }
      audioState.albumCoverCacheWarmupScheduled = false;
      audioState.albumCoverPreparePromise = null;
      if ((pausedForActivity || shouldPauseAlbumCoverWarmup()) && !audioState.albumCoverCacheWarmupDone) {
        audioState.albumCoverWarmupResumePending = true;
      }
    });

  return audioState.albumCoverPreparePromise;
}

function warmAlbumCoverCache(reason) {
  if (COVER_SESSION_PREPARE_ENABLED) return prepareAlbumCoversForSession(reason || "warmup");
  if (audioState.albumCoverCacheWarmupDone) return Promise.resolve();
  if (typeof caches === "undefined" || !caches.open) return Promise.resolve();
  if (shouldPauseAlbumCoverWarmup()) {
    audioState.albumCoverCacheWarmupScheduled = false;
    audioState.albumCoverWarmupResumePending = true;
    return Promise.resolve();
  }
  return loadTracksData()
    .then(function (tracksData) {
      const covers = limitAlbumCoverWarmupUrls(
        orderAlbumCoverWarmupUrls(getAlbumCoverWarmupUrls(tracksData))
      );
      if (!covers.length) {
        audioState.albumCoverCacheWarmupDone = true;
        return;
      }
      return caches.open(COVERS_CACHE_NAME).then(function (cache) {
        let chain = Promise.resolve();
        covers.forEach(function (entry, index) {
          chain = chain.then(function () {
            if (shouldPauseAlbumCoverWarmup()) {
              audioState.albumCoverCacheWarmupScheduled = false;
              audioState.albumCoverWarmupResumePending = true;
              throw new Error("cover_warmup_paused_for_activity");
            }
            return new Promise(function (resolve) {
              setTimeout(resolve, index === 0 ? 0 : 45);
            }).then(function () {
              const request = new Request(entry.url, {
                method: "GET",
                credentials: "same-origin",
                cache: "default"
              });
              const startedAt = getAudioTelemetryNow();
              return cache
                .match(request)
                .then(function (cached) {
                  if (cached) {
                    logCoverRuntimeEvent("cover_loaded", {
                      album: entry.album,
                      source: "idle_prefetch",
                      cover_url: entry.url,
                      cache_hint: "cache",
                      duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
                      reason: reason || "idle"
                    });
                    return;
                  }
                  logCoverRuntimeEvent(
                    "cover_request",
                    {
                      album: entry.album,
                      source: "idle_prefetch",
                      cover_url: entry.url,
                      reason: reason || "idle"
                    },
                    { dedupeMs: 30000 }
                  );
                  return fetch(request).then(function (response) {
                    if (response && response.ok) {
                      cache.put(request, response.clone()).catch(function () {});
                      logCoverRuntimeEvent(
                        "cover_loaded",
                        Object.assign(
                          {
                            album: entry.album,
                            source: "idle_prefetch",
                            cover_url: entry.url,
                            duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - startedAt)),
                            reason: reason || "idle"
                          },
                          getResourceTimingHint(entry.url, startedAt)
                        )
                      );
                    }
                  });
                })
                .catch(function () {
                  trackAudioRuntimeEvent("cover_error", {
                    album: entry.album,
                    source: "idle_prefetch",
                    cover_url: entry.url,
                    reason: reason || "idle"
                  });
                });
            });
          });
        });
        return chain.then(function () {
          audioState.albumCoverCacheWarmupDone = true;
        });
      });
    })
    .catch(function () {});
}

function scheduleAlbumCoverCacheWarmup(reason) {
  if (audioState.albumCoverCacheWarmupScheduled || audioState.albumCoverCacheWarmupDone) return;
  audioState.albumCoverWarmupResumePending = false;
  audioState.albumCoverCacheWarmupScheduled = true;
  const run = function () {
    warmAlbumCoverCache(reason || "idle");
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2200 });
    return;
  }
  window.setTimeout(run, 700);
}

function optimizeAlbumCoverImage() {
  if (!document.body.classList.contains("album-screen")) return;
  const cover = document.querySelector(".album-layout .cover");
  if (!cover) return;

  const rawSrc = String(cover.getAttribute("src") || "").trim();
  if (!rawSrc) return;
  const canonical = normalizeCoverUrl(rawSrc, { width: 1200 });
  if (!canonical) return;
  const coverStartedAt = getAudioTelemetryNow();
  logCoverRuntimeEvent("cover_request", {
    album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(window.location.href),
    source: "DOM",
    cover_url: rawSrc
  });

  function logCoverDone(type) {
    trackAudioRuntimeEvent(
      type,
      Object.assign(
        {
          album: getCurrentAlbumTitle() || getAlbumNameFromUrlLike(window.location.href),
          source: "DOM",
          cover_url: cover.currentSrc || cover.src || rawSrc,
          duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt))
        },
        getResourceTimingHint(cover.currentSrc || cover.src || rawSrc, coverStartedAt)
      )
    );
  }

  if (!cover.dataset.audiofix113CoverTelemetry) {
    cover.dataset.audiofix113CoverTelemetry = "1";
    cover.addEventListener(
      "load",
      function () {
        logCoverDone("cover_loaded");
      },
      { once: true }
    );
    cover.addEventListener(
      "error",
      function () {
        logCoverDone("cover_error");
      },
      { once: true }
    );
  }

  cover.setAttribute("src", canonical);
  cover.removeAttribute("srcset");
  cover.removeAttribute("sizes");
  // The album hero is inserted dynamically by the SPA and must be presented
  // with the surrounding title/tracks instead of on a later WebKit paint.
  cover.setAttribute("decoding", "sync");
  cover.setAttribute("fetchpriority", "high");
  cover.setAttribute("loading", "eager");
}

export {
  shouldInitAudioFeatures,
  getResourceTimingHint,
  logCoverRuntimeEvent,
  getAlbumCoverWarmupUrls,
  getVisibleHomeCoverUrls,
  primeLinkedAlbumCoverForPwa,
  releasePwaCoverHold,
  orderAlbumCoverWarmupUrls,
  limitAlbumCoverWarmupUrls,
  shouldPauseAlbumCoverWarmup,
  decodeCoverForSession,
  prepareAlbumCoverEntry,
  rememberAlbumCoverImage,
  prepareAlbumCoversForSession,
  warmAlbumCoverCache,
  scheduleAlbumCoverCacheWarmup,
  optimizeAlbumCoverImage
};
