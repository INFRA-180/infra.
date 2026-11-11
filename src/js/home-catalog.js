(function () {
  "use strict";

  const CLIP_SCRIPT_URL =
    typeof document !== "undefined" && document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : "";

  // BEGIN GENERATED HOME THUMBNAILS (tools/generate-bibliotheque-thumbnails.js)
  const HOME_ALBUM_COVER_SIZES =
    "(max-width: 639px) calc(50vw - 23px), (max-width: 959px) calc(33.33vw - 24px), (max-width: 1080px) calc(20vw - 24px), 192px";
  const HOME_MOSAIC_COVER_SIZES = "(max-width: 639px) 25vw, 130px";
  const HOME_THUMBNAILS = new Set([
    "abricot",
    "adc-13-6e983f31",
    "anunnaki",
    "anunnaki-instru-6a799ef0",
    "asase-yaa",
    "aspasie",
    "ballades",
    "black-stallion",
    "cerises",
    "cyberpunk",
    "d-2-0141-9947b3d6",
    "etoiles",
    "fond-diffus-e28f5aa2",
    "gaia",
    "h-1-008",
    "he-4-0026",
    "impression",
    "kali",
    "ldc13",
    "mami-wata",
    "moremi-ajasoro",
    "nahda",
    "naviguer",
    "osiris",
    "pbb",
    "peches",
    "rue-de-paris",
    "salam",
    "sanguin",
    "trou-noir",
    "v-23pi56",
    "voyager"
  ]);
  // END GENERATED HOME THUMBNAILS

  function call(ctx, name) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;
    return ctx[name].apply(ctx, Array.prototype.slice.call(arguments, 2));
  }

  function createHomeCatalog(context) {
    const ctx = context || {};
    const fallbackCatalog = ctx.fallbackCatalog || { apps: [], albums: [], clips: [] };
    const catalogState = ctx.catalogState || {
      data: null,
      albumGridObserver: null,
      albumCoverObserver: null,
      albumGridScrollHandler: null
    };
    const clipState = ctx.clipState || {
      clips: [],
      activeId: "",
      currentSrc: ""
    };
    const albumGridInitialBatch = Math.max(1, Number(ctx.albumGridInitialBatch) || 8);
    const albumGridNextBatch = Math.max(1, Number(ctx.albumGridNextBatch) || 6);
    const openAlbumCard =
      typeof ctx.openAlbumCard === "function"
        ? ctx.openAlbumCard
        : function () {
            return false;
          };
    const trackAudioRuntimeEvent =
      typeof ctx.trackAudioRuntimeEvent === "function" ? ctx.trackAudioRuntimeEvent : function () {};
    const isAudioBusyForIdleWork =
      typeof ctx.isAudioBusyForIdleWork === "function"
        ? ctx.isAudioBusyForIdleWork
        : function () {
            return false;
          };
    const ALBUM_SWIPE_AXIS_LOCK_PX = 10;
    const ALBUM_SWIPE_OPEN_PX = 58;
    const ALBUM_SWIPE_MAX_VISUAL_PX = 88;
    const ALBUM_SWIPE_DOMINANCE = 1.2;
    let albumSwipeGesture = null;
    let suppressedAlbumSwipeClick = null;

    function resolveRuntimeAssetUrl(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const resolved = call(ctx, "toRuntimeAbsoluteUrl", raw);
      if (typeof resolved === "string" && resolved) return resolved;
      try {
        return new URL(raw, document.baseURI).href;
      } catch (_err) {
        return raw;
      }
    }

    function resolveRuntimeSrcset(value) {
      return String(value || "")
        .split(",")
        .map(function (candidate) {
          const parts = candidate.trim().split(/\s+/);
          const source = resolveRuntimeAssetUrl(parts.shift());
          return source ? [source].concat(parts).join(" ") : "";
        })
        .filter(Boolean)
        .join(", ");
    }

    function setHomeCoverCandidates(image, source, deferred) {
      const match = source.match(/\/assets\/music\/responsive\/([a-z0-9-]+)-cover-1200\.webp(?:[?#].*)?$/);
      const stem = match && match[1];
      const small =
        HOME_THUMBNAILS.has(stem) && source.startsWith(resolveRuntimeAssetUrl("assets/music/responsive/"))
          ? resolveRuntimeAssetUrl(`assets/thumbnails/music/${stem}-400.webp`)
          : "";
      const srcset = small ? `${small} 400w, ${source} 1200w` : "";
      const sizes = image.classList.contains("playlist-cover-tile")
        ? HOME_MOSAIC_COVER_SIZES
        : HOME_ALBUM_COVER_SIZES;

      if (deferred) {
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        if (srcset) {
          image.dataset.coverSrcset = srcset;
          image.dataset.coverSizes = sizes;
          return;
        }
      } else if (srcset) {
        if (image.getAttribute("sizes") !== sizes) image.setAttribute("sizes", sizes);
        if (resolveRuntimeSrcset(image.getAttribute("srcset")) !== srcset)
          image.setAttribute("srcset", srcset);
      } else {
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
      }
      delete image.dataset.coverSrcset;
      delete image.dataset.coverSizes;
    }

    function displayAlbumCardTitle(title) {
      const formatted = call(ctx, "displayAlbumCardTitle", title);
      if (typeof formatted === "string") return formatted;
      const cleaned = String(title || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleaned) return "";
      if (/[\u0370-\u03ff]/u.test(cleaned) || /\b[A-Z][a-z]\b/.test(cleaned)) return cleaned;
      return cleaned.toLocaleUpperCase();
    }

    function findSwipeAlbumCard(target) {
      if (!document.body.classList.contains("home-screen")) return null;
      if (!target || typeof target.closest !== "function") return null;
      return target.closest(
        'body.home-screen [data-catalog-grid="albums"] a.album-card[href]:not(.playlist-card)'
      );
    }

    function setAlbumSwipeVisual(card, deltaX, ready) {
      if (!card) return;
      card.classList.add("is-album-swipe-tracking");
      card.classList.toggle("is-album-swipe-ready", Boolean(ready));
      if (card.style && typeof card.style.setProperty === "function") {
        const visualX = Math.max(
          -ALBUM_SWIPE_MAX_VISUAL_PX,
          Math.min(ALBUM_SWIPE_MAX_VISUAL_PX, Number(deltaX) || 0)
        );
        card.style.setProperty("--album-swipe-x", `${visualX}px`);
      }
    }

    function clearAlbumSwipeVisual(card) {
      if (!card) return;
      card.classList.remove("is-album-swipe-tracking", "is-album-swipe-ready");
      if (card.style && typeof card.style.removeProperty === "function") {
        card.style.removeProperty("--album-swipe-x");
      }
    }

    function albumSwipeToken() {
      return `swipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function albumCardMetadata(card) {
      const grid = card && card.closest ? card.closest('[data-catalog-grid="albums"]') : null;
      const cards = grid ? Array.from(grid.querySelectorAll("a.album-card[href]:not(.playlist-card)")) : [];
      const rank = Math.max(0, cards.indexOf(card) + 1);
      const label = String(
        (card &&
          ((typeof card.getAttribute === "function" && card.getAttribute("aria-label")) ||
            card.textContent)) ||
          "album"
      )
        .replace(/^Ouvrir l'album\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        album: label || "album",
        card_rank: rank,
        lower_half: Boolean(cards.length && rank > Math.ceil(cards.length / 2))
      };
    }

    function emitAlbumSwipe(gesture, details) {
      if (!gesture || !gesture.token) return;
      const detailRecord = details || {};
      if (!gesture.telemetryStarted && detailRecord.result !== "tracking") return;
      gesture.telemetryStarted = true;
      const deltaX = Number(gesture.lastX) - Number(gesture.startX);
      const deltaY = Number(gesture.lastY) - Number(gesture.startY);
      trackAudioRuntimeEvent(
        "album_swipe",
        Object.assign(
          {
            track: "gesture",
            gesture_token: gesture.token,
            input_type: gesture.inputType || "touch",
            direction: deltaX < 0 ? "left" : deltaX > 0 ? "right" : "none",
            axis: gesture.axis === "x" ? "horizontal" : gesture.axis === "y" ? "vertical" : "pending",
            dx: Math.round(deltaX || 0),
            dy: Math.round(deltaY || 0),
            abs_dx: Math.round(Math.abs(deltaX || 0)),
            abs_dy: Math.round(Math.abs(deltaY || 0)),
            threshold_px: ALBUM_SWIPE_OPEN_PX,
            gesture_duration_ms: Math.max(0, Date.now() - Number(gesture.startedAt || Date.now())),
            handler_ready: true,
            surface: "home_album_grid"
          },
          albumCardMetadata(gesture.card),
          detailRecord
        )
      );
    }

    function cancelAlbumSwipe(reason) {
      if (!albumSwipeGesture) return;
      emitAlbumSwipe(albumSwipeGesture, {
        result: "cancelled",
        cancel_reason: String(reason || "cancelled"),
        navigation_started: false,
        navigation_completed: false
      });
      clearAlbumSwipeVisual(albumSwipeGesture.card);
      albumSwipeGesture = null;
    }

    function consumeEarlyAlbumSwipeProbe() {
      const probe = window.__infraEarlyAlbumSwipeProbe;
      if (!probe || typeof probe !== "object") return;
      if (typeof probe.handoff === "function") probe.handoff();
      else if (typeof probe.stop === "function") probe.stop();
      const records = Array.isArray(probe.records) ? probe.records.slice(0, 6) : [];
      records.forEach(function (record) {
        trackAudioRuntimeEvent(
          "album_swipe",
          Object.assign(
            {
              track: "gesture",
              album: String(record.album || "album"),
              gesture_token: String(record.gesture_token || albumSwipeToken()),
              input_type: String(record.input_type || "touch"),
              direction: String(record.direction || "none"),
              axis: String(record.axis || "pending"),
              dx: Math.round(Number(record.dx) || 0),
              dy: Math.round(Number(record.dy) || 0),
              abs_dx: Math.round(Math.abs(Number(record.dx) || 0)),
              abs_dy: Math.round(Math.abs(Number(record.dy) || 0)),
              threshold_px: ALBUM_SWIPE_OPEN_PX,
              card_rank: Math.max(0, Math.round(Number(record.card_rank) || 0)),
              lower_half: Boolean(record.lower_half),
              gesture_duration_ms: Math.max(0, Math.round(Number(record.gesture_duration_ms) || 0)),
              early_buffer_delay_ms: Math.max(0, Date.now() - Number(record.finished_at_ms || Date.now())),
              handler_ready: false,
              handler_state: "not_ready",
              navigation_started: false,
              navigation_completed: false,
              surface: "home_album_grid",
              result: "cancelled",
              cancel_reason: "handler_not_ready"
            },
            record
          )
        );
      });
      probe.records = [];
    }

    function initAlbumSwipeNavigation() {
      if (catalogState.albumSwipeBound) return;
      catalogState.albumSwipeBound = true;
      consumeEarlyAlbumSwipeProbe();
      // Maquette V8 (INFRA, 11/11/2026) : glisser ← → sur l'accueil change d'onglet (bibliotheque.js) ;
      // glisser une pochette n'ouvre plus l'album (toucher l'ouvre toujours). Code gardé : rétabli avec
      // albumCoverSwipeOpens: true dans le contexte.
      if (ctx.albumCoverSwipeOpens !== true) return;

      document.addEventListener(
        "pointerdown",
        function (event) {
          if (event.isPrimary === false) return;
          if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
          if (event.button !== undefined && event.button !== 0) return;
          const card = findSwipeAlbumCard(event.target);
          if (!card) return;

          cancelAlbumSwipe("superseded");
          albumSwipeGesture = {
            card,
            token: albumSwipeToken(),
            inputType: event.pointerType,
            startedAt: Date.now(),
            pointerId: event.pointerId,
            startX: Number(event.clientX) || 0,
            startY: Number(event.clientY) || 0,
            lastX: Number(event.clientX) || 0,
            lastY: Number(event.clientY) || 0,
            axis: "",
            telemetryStarted: false
          };
        },
        { capture: true, passive: true }
      );

      document.addEventListener(
        "pointermove",
        function (event) {
          const gesture = albumSwipeGesture;
          if (!gesture || event.pointerId !== gesture.pointerId) return;
          gesture.lastX = Number(event.clientX) || 0;
          gesture.lastY = Number(event.clientY) || 0;
          const deltaX = gesture.lastX - gesture.startX;
          const deltaY = gesture.lastY - gesture.startY;
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);

          if (!gesture.axis && (absX > ALBUM_SWIPE_AXIS_LOCK_PX || absY > ALBUM_SWIPE_AXIS_LOCK_PX)) {
            gesture.axis = absX > absY * ALBUM_SWIPE_DOMINANCE ? "x" : "y";
            emitAlbumSwipe(gesture, {
              result: "tracking",
              handler_state: "ready",
              navigation_started: false,
              navigation_completed: false
            });
          }
          if (gesture.axis === "y") {
            cancelAlbumSwipe("vertical_scroll");
            return;
          }
          if (gesture.axis !== "x") return;

          if (event.cancelable) event.preventDefault();
          setAlbumSwipeVisual(gesture.card, deltaX, absX >= ALBUM_SWIPE_OPEN_PX);
        },
        { capture: true, passive: false }
      );

      function finishAlbumSwipe(event, cancelled) {
        const gesture = albumSwipeGesture;
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const endX = Number(event.clientX);
        const endY = Number(event.clientY);
        const deltaX = (Number.isFinite(endX) ? endX : gesture.lastX) - gesture.startX;
        const deltaY = (Number.isFinite(endY) ? endY : gesture.lastY) - gesture.startY;
        const shouldOpen =
          !cancelled &&
          gesture.axis === "x" &&
          Math.abs(deltaX) >= ALBUM_SWIPE_OPEN_PX &&
          Math.abs(deltaX) > Math.abs(deltaY) * ALBUM_SWIPE_DOMINANCE;
        const card = gesture.card;
        clearAlbumSwipeVisual(card);
        albumSwipeGesture = null;
        if (!shouldOpen) {
          emitAlbumSwipe(gesture, {
            result: "cancelled",
            cancel_reason: cancelled ? "pointer_cancel" : "threshold_not_met",
            navigation_started: false,
            navigation_completed: false
          });
          return;
        }

        if (event.cancelable) event.preventDefault();
        emitAlbumSwipe(gesture, {
          result: "navigation_started",
          navigation_started: true,
          navigation_completed: false,
          navigation_method: "spa"
        });
        const opened =
          openAlbumCard(card, {
            trigger: deltaX < 0 ? "swipe_left" : "swipe_right",
            gestureToken: gesture.token
          }) !== false;
        if (opened) {
          suppressedAlbumSwipeClick = {
            card,
            until: Date.now() + 900
          };
        } else {
          emitAlbumSwipe(gesture, {
            result: "cancelled",
            cancel_reason: "navigation_rejected",
            navigation_started: false,
            navigation_completed: false
          });
        }
      }

      document.addEventListener(
        "pointerup",
        function (event) {
          finishAlbumSwipe(event, false);
        },
        { capture: true, passive: false }
      );
      document.addEventListener(
        "pointercancel",
        function (event) {
          finishAlbumSwipe(event, true);
        },
        { capture: true, passive: true }
      );
      document.addEventListener(
        "click",
        function (event) {
          const suppressed = suppressedAlbumSwipeClick;
          if (!suppressed) return;
          if (Date.now() > suppressed.until) {
            suppressedAlbumSwipeClick = null;
            return;
          }
          const target = event.target;
          if (target !== suppressed.card && !(suppressed.card.contains && suppressed.card.contains(target)))
            return;
          event.preventDefault();
          event.stopImmediatePropagation();
          suppressedAlbumSwipeClick = null;
        },
        true
      );
    }

    function sanitizeCatalog(payload) {
      const sanitized = call(ctx, "sanitizeCatalog", payload);
      if (sanitized && typeof sanitized === "object") return sanitized;

      const safe = payload && typeof payload === "object" ? payload : fallbackCatalog;
      return {
        apps: Array.isArray(safe.apps) ? safe.apps : [],
        albums: Array.isArray(safe.albums) ? safe.albums : [],
        clips: Array.isArray(safe.clips) ? safe.clips : []
      };
    }

    function loadCatalogData() {
      const result = call(ctx, "loadCatalogData");
      if (result && typeof result.then === "function") return result;
      if (result) return Promise.resolve(result);
      return Promise.resolve(sanitizeCatalog(fallbackCatalog));
    }

    function buildCatalogCard(item, type, index) {
      const li = document.createElement("li");
      const card = document.createElement("a");
      const isApp = type === "app";
      const displayTitle = isApp ? item.title : displayAlbumCardTitle(item.title);
      card.className = `media-card ${isApp ? "app-card" : "album-card"}`;
      card.href = item.page;
      card.setAttribute("aria-label", `${isApp ? "Ouvrir la page" : "Ouvrir l'album"} ${displayTitle}`);

      const image = document.createElement("img");
      image.className = isApp ? "app-icon app-cover" : "album-thumb album-cover";
      image.width = item.width;
      image.height = item.height;
      image.style.aspectRatio = `${item.width} / ${item.height}`;
      image.alt = item.thumbAlt || item.title;
      image.decoding = "async";
      const eagerCount = isApp ? 0 : 2;
      const shouldEager = index < eagerCount;
      const thumb = resolveRuntimeAssetUrl(item.thumb);
      if (!isApp) setHomeCoverCandidates(image, thumb, !shouldEager);
      if (shouldEager) image.src = thumb;
      else if (isApp) image.dataset.appCoverSrc = thumb;
      else image.dataset.coverSrc = thumb;
      image.loading = shouldEager ? "eager" : "lazy";
      image.setAttribute("fetchpriority", index === 0 && !isApp ? "high" : shouldEager ? "auto" : "low");
      if (isApp && item.thumbSrcset) image.dataset.appCoverSrcset = resolveRuntimeSrcset(item.thumbSrcset);
      if (isApp && item.thumbSizes) image.dataset.appCoverSizes = item.thumbSizes;

      const label = document.createElement("span");
      if (item.editKey) label.setAttribute("data-edit-key", item.editKey);
      label.textContent = displayTitle;

      card.appendChild(image);
      card.appendChild(label);
      li.appendChild(card);
      return li;
    }

    function renderCatalogGrid(grid, items, type) {
      if (!grid) return;
      if (type === "album" && document.body.classList.contains("home-screen")) {
        renderProgressiveAlbumGrid(grid, items);
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach((item, index) => {
        fragment.appendChild(buildCatalogCard(item, type, index));
      });
      grid.replaceChildren(fragment);
      grid.dataset.catalogReady = "1";
      if (type === "app") bindDeferredAppCovers(grid);
    }

    function resetProgressiveAlbumGrid() {
      if (catalogState.albumGridObserver) {
        catalogState.albumGridObserver.disconnect();
        catalogState.albumGridObserver = null;
      }
      if (catalogState.albumGridScrollHandler) {
        window.removeEventListener("scroll", catalogState.albumGridScrollHandler);
        window.removeEventListener("resize", catalogState.albumGridScrollHandler);
        catalogState.albumGridScrollHandler = null;
      }
    }

    function revealDeferredImage(image) {
      if (!image) return;
      delete image.dataset.coverLoading;
      image.dataset.coverReady = "1";
    }

    function loadDeferredImage(image, sourceAttribute, srcsetAttribute, sizesAttribute) {
      const source = resolveRuntimeAssetUrl(image && image.dataset && image.dataset[sourceAttribute]);
      if (!source) return;
      const current = resolveRuntimeAssetUrl(image.currentSrc || image.getAttribute("src") || "");
      if (current && current === source && image.complete && image.naturalWidth > 0) {
        delete image.dataset[sourceAttribute];
        revealDeferredImage(image);
        return;
      }
      if (!(image.complete && image.naturalWidth > 0)) image.dataset.coverLoading = "1";
      if (sizesAttribute) {
        const sizes = String(image.dataset[sizesAttribute] || "").trim();
        if (sizes) image.setAttribute("sizes", sizes);
        delete image.dataset[sizesAttribute];
      }
      if (srcsetAttribute) {
        const srcset = resolveRuntimeSrcset(image.dataset[srcsetAttribute]);
        if (srcset) image.setAttribute("srcset", srcset);
        delete image.dataset[srcsetAttribute];
      }
      if (sourceAttribute === "appCoverSrc") image.loading = "eager";
      image.setAttribute("src", source);
      delete image.dataset[sourceAttribute];

      const reveal = function () {
        revealDeferredImage(image);
      };
      if (typeof image.decode === "function") {
        image
          .decode()
          .then(reveal)
          .catch(function () {
            if (image.complete) {
              reveal();
              return;
            }
            image.addEventListener("load", reveal, { once: true });
            image.addEventListener("error", reveal, { once: true });
          });
        return;
      }
      if (image.complete) reveal();
      else {
        image.addEventListener("load", reveal, { once: true });
        image.addEventListener("error", reveal, { once: true });
      }
    }

    function loadDeferredAlbumCover(image) {
      if (image.classList.contains("album-cover") || image.classList.contains("playlist-cover-tile")) {
        setHomeCoverCandidates(
          image,
          resolveRuntimeAssetUrl(image.dataset.coverSrc),
          !image.getAttribute("src")
        );
      }
      loadDeferredImage(image, "coverSrc", "coverSrcset", "coverSizes");
    }

    // Vignettes préparées au repos (lot Nav-2, INFRA 11/11/2026) : après l'affichage de l'accueil,
    // les vignettes pas encore chargées le sont une à une, de haut en bas, quand le téléphone ne fait
    // rien (pas pendant un démarrage de titre ni un changement de page). En défilant, elles sont prêtes.
    function scheduleIdleHomeCoverPreparation() {
      if (catalogState.idleCoverPreparationScheduled) return;
      if (typeof window.setTimeout !== "function" || !document.body) return;
      catalogState.idleCoverPreparationScheduled = true;
      // Safari iPhone n'a pas requestIdleCallback : petite pause fixe entre deux vignettes.
      const idle = function (callback, timeout, fallbackDelay) {
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(callback, { timeout: timeout });
        } else {
          window.setTimeout(callback, Number.isFinite(fallbackDelay) ? fallbackDelay : 1200);
        }
      };
      const later = function () {
        window.setTimeout(function () {
          idle(step, 3000);
        }, 1500);
      };
      const step = function () {
        if (!document.body.classList.contains("home-screen") || isAudioBusyForIdleWork()) {
          later();
          return;
        }
        const route = document.querySelector(".spa-route-layer[data-spa-route-state='current']") || document;
        const image = route.querySelector(
          "img.album-cover[data-cover-src], img.playlist-cover-tile[data-cover-src]"
        );
        if (!image) {
          catalogState.idleCoverPreparationScheduled = false;
          return;
        }
        if (catalogState.albumCoverObserver) catalogState.albumCoverObserver.unobserve(image);
        image.loading = "eager";
        loadDeferredAlbumCover(image);
        let done = false;
        const next = function () {
          if (done) return;
          done = true;
          idle(step, 2000, 150);
        };
        if (image.complete) next();
        else {
          image.addEventListener("load", next, { once: true });
          image.addEventListener("error", next, { once: true });
          window.setTimeout(next, 4000);
        }
      };
      idle(step, 4000);
    }

    function observeDeferredAlbumCovers(root) {
      const scope = root || document;
      const images = Array.from(scope.querySelectorAll("img[data-cover-src]"));
      if (!images.length) return;
      const load = loadDeferredAlbumCover;
      scheduleIdleHomeCoverPreparation();
      if (!("IntersectionObserver" in window)) {
        images.forEach(load);
        return;
      }
      if (!catalogState.albumCoverObserver) {
        catalogState.albumCoverObserver = new IntersectionObserver(
          function (entries, observer) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              observer.unobserve(entry.target);
              load(entry.target);
            });
          },
          { rootMargin: "320px 0px" }
        );
      }
      images.forEach(function (image) {
        catalogState.albumCoverObserver.observe(image);
      });
    }

    function bindDeferredAppCovers(root) {
      const scope = root || document;
      const menu =
        scope.closest && scope.closest(".apps-menu")
          ? scope.closest(".apps-menu")
          : document.querySelector(".apps-menu");
      if (!menu) return;

      const loadApps = function () {
        if (!menu.open) return;
        Array.from(menu.querySelectorAll("img[data-app-cover-src]")).forEach(function (image) {
          loadDeferredImage(image, "appCoverSrc", "appCoverSrcset", "appCoverSizes");
        });
      };
      if (menu._infraAppCoverToggleHandler) {
        menu.removeEventListener("toggle", menu._infraAppCoverToggleHandler);
      }
      menu._infraAppCoverToggleHandler = loadApps;
      menu.addEventListener("toggle", loadApps);
      loadApps();
    }

    function renderProgressiveAlbumGrid(grid, items) {
      resetProgressiveAlbumGrid();

      const albums = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!albums.length) {
        grid.replaceChildren();
        grid.dataset.catalogReady = "1";
        return;
      }
      if (reconcileHomeAlbumGrid(grid, albums)) return;

      const sentinel = document.createElement("li");
      sentinel.className = "catalog-scroll-sentinel";
      sentinel.setAttribute("aria-hidden", "true");

      grid.replaceChildren(sentinel);
      grid.dataset.catalogReady = "1";

      let rendered = 0;
      let finished = false;

      function appendBatch(count) {
        if (finished) return;
        const nextLimit = Math.min(albums.length, rendered + count);
        const fragment = document.createDocumentFragment();
        for (let index = rendered; index < nextLimit; index += 1) {
          fragment.appendChild(buildCatalogCard(albums[index], "album", index));
        }
        grid.insertBefore(fragment, sentinel);
        observeDeferredAlbumCovers(document);
        rendered = nextLimit;
        finished = rendered >= albums.length;
        sentinel.hidden = finished;
        if (finished) resetProgressiveAlbumGrid();
      }

      appendBatch(albumGridInitialBatch);
      if (finished) return;

      const loadMore = function () {
        appendBatch(albumGridNextBatch);
      };

      const hasScrollableRoom = function () {
        const scrollHeight = Math.max(
          document.documentElement ? document.documentElement.scrollHeight : 0,
          document.body ? document.body.scrollHeight : 0
        );
        return scrollHeight > window.innerHeight + 120;
      };

      const ensureScrollableRoom = function () {
        if (finished || hasScrollableRoom()) return;
        loadMore();
        window.requestAnimationFrame(ensureScrollableRoom);
      };

      const shouldLoadMore = function () {
        if (finished) return false;
        const rect = sentinel.getBoundingClientRect();
        return rect.top <= window.innerHeight + 320;
      };

      catalogState.albumGridScrollHandler = function () {
        if (shouldLoadMore()) loadMore();
      };
      window.addEventListener("scroll", catalogState.albumGridScrollHandler, { passive: true });
      window.addEventListener("resize", catalogState.albumGridScrollHandler, { passive: true });

      if ("IntersectionObserver" in window) {
        catalogState.albumGridObserver = new IntersectionObserver(
          function (entries) {
            if (
              entries.some(function (entry) {
                return entry.isIntersecting;
              }) &&
              shouldLoadMore()
            ) {
              loadMore();
            }
          },
          { rootMargin: "320px 0px" }
        );
        catalogState.albumGridObserver.observe(sentinel);
      }

      setTimeout(ensureScrollableRoom, 80);
    }

    function getStaticHomeAlbumOrder(albums) {
      return Array.isArray(albums) ? albums.filter(Boolean) : [];
    }

    function getCardAttribute(node, name) {
      return String((node && node.getAttribute(name)) || "").trim();
    }

    function getAssetFileName(value) {
      const clean = String(value || "")
        .trim()
        .split("?")[0];
      if (!clean) return "";
      return clean.slice(clean.lastIndexOf("/") + 1);
    }

    function lockedCoverMatchesCatalog(image, expectedThumb) {
      if (!image || image.dataset.spaCoverLocked !== "1") return false;
      const fileName = getAssetFileName(image.getAttribute("src"));
      return Boolean(fileName && fileName === getAssetFileName(expectedThumb));
    }

    function updateHomeAlbumCard(listItem, item, index) {
      const card = listItem && listItem.querySelector("a.media-card.album-card");
      const image = card && card.querySelector("img.album-cover");
      const label = card && card.querySelector("span");
      if (!card || !image || !label || !item) return false;

      const displayTitle = displayAlbumCardTitle(item.title);
      const expectedThumb = resolveRuntimeAssetUrl(item.thumb);
      const currentThumb = String(image.getAttribute("src") || image.dataset.coverSrc || "").trim();
      const sameCover = Boolean(
        expectedThumb && getAssetFileName(currentThumb) === getAssetFileName(expectedThumb)
      );

      card.setAttribute("href", String(item.page || ""));
      card.setAttribute("aria-label", `Ouvrir l'album ${displayTitle}`);
      setHomeCoverCandidates(image, expectedThumb, sameCover ? !image.getAttribute("src") : index >= 2);
      if (!sameCover) {
        if (index < 2) {
          image.setAttribute("src", expectedThumb);
          delete image.dataset.coverSrc;
        } else {
          image.removeAttribute("src");
          image.dataset.coverSrc = expectedThumb;
        }
        delete image.dataset.spaCoverLocked;
      }
      image.setAttribute("width", String(item.width || 1200));
      image.setAttribute("height", String(item.height || 1200));
      image.style.aspectRatio = `${item.width || 1200} / ${item.height || 1200}`;
      image.setAttribute("alt", String(item.thumbAlt || item.title || ""));
      image.setAttribute("decoding", "async");
      image.setAttribute("loading", index < 2 ? "eager" : "lazy");
      image.setAttribute("fetchpriority", index === 0 ? "high" : index === 1 ? "auto" : "low");
      if (item.editKey) label.setAttribute("data-edit-key", item.editKey);
      else label.removeAttribute("data-edit-key");
      label.textContent = displayTitle;
      return true;
    }

    function reconcileHomeAlbumGrid(grid, albums) {
      if (!grid || !Array.isArray(albums) || !albums.length) return false;
      const existing = Array.from(grid.children).filter(function (node) {
        return node && !node.classList.contains("catalog-scroll-sentinel");
      });
      if (!existing.length) return false;

      resetProgressiveAlbumGrid();
      Array.from(grid.querySelectorAll(".catalog-scroll-sentinel")).forEach(function (node) {
        node.remove();
      });

      albums.forEach(function (item, index) {
        let listItem = existing[index] || null;
        if (!updateHomeAlbumCard(listItem, item, index)) {
          const replacement = buildCatalogCard(item, "album", index);
          if (listItem && listItem.parentNode === grid) {
            grid.replaceChild(replacement, listItem);
            existing[index] = replacement;
          } else {
            grid.appendChild(replacement);
            existing[index] = replacement;
          }
        }
      });
      existing.slice(albums.length).forEach(function (node) {
        if (node && node.parentNode === grid) node.remove();
      });
      grid.dataset.catalogReady = "1";
      observeDeferredAlbumCovers(document);
      return true;
    }

    function homeAlbumGridMatchesCatalog(grid, albums) {
      if (!grid || grid.dataset.staticCatalog !== "albums") return false;
      const expected = getStaticHomeAlbumOrder(albums);
      if (!expected.length) return false;

      const cards = Array.from(grid.children).filter(function (node) {
        return node && !node.classList.contains("catalog-scroll-sentinel");
      });
      if (cards.length !== expected.length) return false;

      return expected.every(function (item, index) {
        const card = cards[index] && cards[index].querySelector("a.media-card.album-card");
        const image = card && card.querySelector("img.album-cover");
        const label = card && card.querySelector("span");
        if (!card || !image || !label) return false;

        const displayTitle = displayAlbumCardTitle(item.title);
        const shouldEager = index < 2;
        const expectedPriority = index === 0 ? "high" : index === 1 ? "auto" : "low";
        const lockedCover = lockedCoverMatchesCatalog(image, item.thumb);

        if (getCardAttribute(card, "href") !== String(item.page || "").trim()) return false;
        const currentCover = getCardAttribute(image, "src") || getCardAttribute(image, "data-cover-src");
        if (!lockedCover && resolveRuntimeAssetUrl(currentCover) !== resolveRuntimeAssetUrl(item.thumb))
          return false;
        if (shouldEager && !getCardAttribute(image, "src")) return false;
        if (getCardAttribute(image, "alt") !== String(item.thumbAlt || item.title || "").trim()) return false;
        if (getCardAttribute(image, "width") !== String(item.width || "")) return false;
        if (getCardAttribute(image, "height") !== String(item.height || "")) return false;
        if (getCardAttribute(image, "loading") !== (shouldEager ? "eager" : "lazy")) return false;
        if (getCardAttribute(image, "fetchpriority") !== expectedPriority) return false;
        if (String(label.textContent || "").trim() !== displayTitle) return false;
        return true;
      });
    }

    function hydrateStaticHomeAlbumGrid(grid, albums) {
      if (!homeAlbumGridMatchesCatalog(grid, albums)) return false;
      resetProgressiveAlbumGrid();
      grid.dataset.catalogReady = "1";
      grid.querySelectorAll("img.album-cover[src]").forEach(function (image) {
        setHomeCoverCandidates(image, resolveRuntimeAssetUrl(image.getAttribute("src")), false);
      });
      observeDeferredAlbumCovers(document);
      return true;
    }

    function orderHomeAlbumsForSession(albums) {
      return Array.isArray(albums) ? albums.filter(Boolean) : [];
    }

    // Clips sur l'accueil (maquette V5 validée par INFRA le 09/11/2026, DOCS/maquettes/MAQUETTE_V5_20261109.md) :
    // vignettes 16:9 ; toucher = le clip se lit sur place à la place de sa vignette (titre affiché une seule fois) ;
    // la musique se met en pause au lancement du clip, et le clip se met en pause quand la musique repart.
    function buildYouTubeEmbedUrl(videoId, autoplay) {
      const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        enablejsapi: "1"
      });
      if (autoplay) params.set("autoplay", "1");
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
    }

    function getClipThumbUrl(videoId) {
      const name = `../clips/${encodeURIComponent(videoId)}-480.webp`;
      try {
        return CLIP_SCRIPT_URL
          ? new URL(name, CLIP_SCRIPT_URL).href
          : `assets/clips/${encodeURIComponent(videoId)}-480.webp`;
      } catch (_err) {
        return `assets/clips/${encodeURIComponent(videoId)}-480.webp`;
      }
    }

    function getClipParts() {
      const module = document.querySelector('[data-module-id="clips"]');
      if (!module || typeof module.querySelector !== "function") return null;
      return {
        module,
        grid: document.querySelector('[data-catalog-grid="clips"]'),
        shell: module.querySelector("[data-clip-shell]"),
        iframe: document.querySelector("[data-clip-iframe]"),
        title: module.querySelector("[data-clip-title]")
      };
    }

    function pauseActiveClip() {
      const parts = getClipParts();
      const frame = parts && parts.iframe;
      if (!frame || !clipState.currentSrc || !frame.contentWindow) return;
      try {
        frame.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":[]}', "*");
      } catch (_err) {
        // The YouTube frame may not be ready yet.
      }
    }

    function pauseMusicForClip() {
      const toggle = document.querySelector(".global-transport.is-playing [data-transport-toggle]");
      if (toggle && typeof toggle.click === "function") toggle.click();
    }

    function revealClipPlayer(shell) {
      if (
        !shell ||
        typeof shell.getBoundingClientRect !== "function" ||
        typeof window.scrollBy !== "function"
      )
        return;
      const rect = shell.getBoundingClientRect();
      const bar = document.querySelector(".bib-tabs");
      const transport = document.querySelector(".global-transport");
      const top = (bar ? bar.getBoundingClientRect().bottom : 0) + 8;
      const bottom =
        (transport && transport.getBoundingClientRect().top > 0
          ? transport.getBoundingClientRect().top
          : window.innerHeight) - 8;
      const delta =
        rect.top < top
          ? rect.top - top
          : rect.bottom > bottom
            ? Math.min(rect.bottom - bottom, rect.top - top)
            : 0;
      if (!delta) return;
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    }

    function setActiveClip(clipId, opts) {
      const parts = getClipParts();
      if (!parts || !parts.iframe) return;
      const active = clipState.clips.find((clip) => clip.id === clipId);
      const options = opts || {};

      if (!active || !active.youtubeId) {
        parts.iframe.removeAttribute("src");
        clipState.currentSrc = "";
        clipState.activeId = "";
        if (parts.shell) parts.shell.hidden = true;
        if (parts.module.classList) parts.module.classList.remove("is-playing");
      } else {
        const embedUrl = buildYouTubeEmbedUrl(active.youtubeId, Boolean(options.autoplay));
        if (embedUrl !== clipState.currentSrc) {
          parts.iframe.src = embedUrl;
          clipState.currentSrc = embedUrl;
        }
        parts.iframe.setAttribute("title", active.title || "Clip INFRA");
        clipState.activeId = active.id;
        if (parts.title) parts.title.textContent = active.title || "";
        if (parts.shell) parts.shell.hidden = false;
        if (parts.module.classList) parts.module.classList.add("is-playing");
      }

      const items =
        parts.grid && Array.isArray(parts.grid.children)
          ? parts.grid.children
          : parts.grid
            ? Array.from(parts.grid.children || [])
            : [];
      items.forEach(function (li) {
        const button = li && li.firstChild ? li.firstChild : li && li.children ? li.children[0] : null;
        const isActive = Boolean(button && button.dataset && button.dataset.clipId === clipState.activeId);
        li.hidden = isActive;
      });
      if (clipState.activeId && options.reveal) revealClipPlayer(parts.shell);
    }

    function closeActiveClip() {
      setActiveClip("", {});
    }

    function buildClipItem(item) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bib-clipcard";
      button.dataset.clipId = item.id;
      button.setAttribute("aria-label", `Lire le clip ${item.title}`);

      const frame = document.createElement("span");
      frame.className = "bib-vid";
      frame.setAttribute("aria-hidden", "true");
      const image = document.createElement("img");
      image.setAttribute("src", getClipThumbUrl(item.youtubeId));
      image.setAttribute("alt", "");
      image.setAttribute("width", "480");
      image.setAttribute("height", "270");
      image.setAttribute("loading", "lazy");
      image.setAttribute("decoding", "async");
      const play = document.createElement("span");
      play.className = "bib-vidplay";
      play.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
      frame.appendChild(image);
      frame.appendChild(play);

      const title = document.createElement("span");
      title.className = "bib-cliptitle";
      if (item.editKey) title.setAttribute("data-edit-key", item.editKey);
      title.textContent = item.title;

      button.appendChild(frame);
      button.appendChild(title);
      button.addEventListener("click", function () {
        pauseMusicForClip();
        setActiveClip(item.id, { autoplay: true, reveal: true });
      });

      li.appendChild(button);
      return li;
    }

    function renderClipsSection(clips) {
      const parts = getClipParts();
      if (!parts || !parts.grid || !parts.iframe) return;

      // Ordre voulu par INFRA (09/11/2026, VOLDEMORT d'abord) = ordre du catalogue du site ; le
      // catalogue en ligne garde l'ancien ordre jusqu'à sa prochaine synchronisation.
      const clipKey = (entry) =>
        String(
          (entry && (entry.youtubeId || (String(entry.youtubeUrl || "").match(/[?&]v=([\w-]+)/) || [])[1])) ||
            ""
        );
      const siteOrder = (sanitizeCatalog(fallbackCatalog).clips || []).map(clipKey);
      const rank = (entry) => {
        const i = siteOrder.indexOf(clipKey(entry));
        return i < 0 ? siteOrder.length : i;
      };
      const safe = (Array.isArray(clips) ? clips.filter((entry) => entry && entry.id && entry.youtubeId) : [])
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
        .map((item) => item.entry);
      const previousActive = clipState.activeId;
      clipState.clips = safe.slice();

      if (!safe.length) {
        parts.module.hidden = true;
        parts.grid.replaceChildren();
        closeActiveClip();
        parts.grid.dataset.catalogReady = "1";
        return;
      }

      const fragment = document.createDocumentFragment();
      safe.forEach((item) => {
        fragment.appendChild(buildClipItem(item));
      });
      parts.grid.replaceChildren(fragment);
      parts.grid.dataset.catalogReady = "1";
      parts.module.hidden = false;

      // Le catalogue peut être redessiné (catalogue en direct) : un clip en cours continue.
      // Un accueil reconstruit (iframe vide) repart sans clip ouvert.
      const playing = Boolean(parts.iframe.getAttribute("src"));
      if (playing && previousActive && safe.some((clip) => clip.id === previousActive))
        setActiveClip(previousActive, {});
      else closeActiveClip();

      const closeButton = parts.module.querySelector("[data-clip-close]");
      if (closeButton && !closeButton._infraClipCloseBound) {
        closeButton._infraClipCloseBound = true;
        closeButton.addEventListener("click", closeActiveClip);
      }
      if (!clipState.musicListenerBound && typeof document.addEventListener === "function") {
        clipState.musicListenerBound = true;
        document.addEventListener(
          "play",
          function (event) {
            const target = event && event.target;
            if (target && String(target.tagName || "").toUpperCase() === "AUDIO") pauseActiveClip();
          },
          true
        );
      }
    }

    async function waitCatalogWithTimeout(promise, timeoutMs) {
      const safePromise =
        promise && typeof promise.then === "function"
          ? promise
          : Promise.resolve(sanitizeCatalog(fallbackCatalog));
      const waitMs = Math.max(0, Number(timeoutMs) || 0);
      if (!waitMs) {
        return {
          timedOut: false,
          catalog: await safePromise
        };
      }

      let timerId = 0;
      const timeoutPromise = new Promise(function (resolve) {
        timerId = window.setTimeout(function () {
          resolve({
            timedOut: true,
            catalog: null
          });
        }, waitMs);
      });

      const result = await Promise.race([
        safePromise.then(function (catalog) {
          return {
            timedOut: false,
            catalog
          };
        }),
        timeoutPromise
      ]);

      if (timerId) window.clearTimeout(timerId);
      return result;
    }

    async function hydrateHomeCatalog() {
      if (!document.body.classList.contains("home-screen")) return;

      const albumsGrid = document.querySelector('[data-catalog-grid="albums"]');
      const appsGrid = document.querySelector('[data-catalog-grid="apps"]');
      const clipsGrid = document.querySelector('[data-catalog-grid="clips"]');
      if (!albumsGrid || !appsGrid) return;

      const fallback = sanitizeCatalog(fallbackCatalog);
      const loadPromise = loadCatalogData().catch(function () {
        return fallback;
      });

      if (!catalogState.data) {
        const quick = await waitCatalogWithTimeout(loadPromise, 140);
        if (!quick.timedOut && quick.catalog) {
          const fastCatalog = sanitizeCatalog(quick.catalog);
          if (!hydrateStaticHomeAlbumGrid(albumsGrid, fastCatalog.albums || [])) {
            renderCatalogGrid(albumsGrid, orderHomeAlbumsForSession(fastCatalog.albums || []), "album");
          }
          renderCatalogGrid(appsGrid, fastCatalog.apps || [], "app");
          if (clipsGrid) renderClipsSection(fastCatalog.clips || []);
          return;
        }

        if (!hydrateStaticHomeAlbumGrid(albumsGrid, fallback.albums || [])) {
          renderCatalogGrid(albumsGrid, orderHomeAlbumsForSession(fallback.albums || []), "album");
        }
        renderCatalogGrid(appsGrid, fallback.apps || [], "app");
        if (clipsGrid) renderClipsSection(fallback.clips || []);
      }

      const catalog = await loadPromise;
      if (!hydrateStaticHomeAlbumGrid(albumsGrid, catalog.albums || [])) {
        renderCatalogGrid(albumsGrid, orderHomeAlbumsForSession(catalog.albums || []), "album");
      }
      renderCatalogGrid(appsGrid, catalog.apps || [], "app");
      if (clipsGrid) renderClipsSection(catalog.clips || []);
    }

    return {
      buildCatalogCard,
      renderCatalogGrid,
      resetProgressiveAlbumGrid,
      renderProgressiveAlbumGrid,
      reconcileHomeAlbumGrid,
      hydrateStaticHomeAlbumGrid,
      renderClipsSection,
      initAlbumSwipeNavigation,
      hydrateHomeCatalog
    };
  }

  window.InfraHomeCatalog = {
    createHomeCatalog
  };
})();

// Bibliothèque V3 (INFRA, 08/11/2026) : charge la feuille et le script de la bibliothèque
// s'ils manquent (arrivée par une page album puis retour à l'accueil par la navigation interne).
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (typeof document.createElement !== "function" || !document.head) return;
  var VERSION = "bibliotheque-v28-20261111";
  try {
    var script = document.currentScript;
    if (!script || !script.src) return;
    // Styles : dans styles.css depuis le lot 3 (INFRA, 09/11/2026).
    if (!document.querySelector("script[data-bib-js]")) {
      var js = document.createElement("script");
      js.src = new URL("bibliotheque.js?v=" + VERSION, script.src).href;
      js.defer = true;
      js.setAttribute("data-bib-js", "");
      document.head.appendChild(js);
    }
  } catch (_err) {}
})();
