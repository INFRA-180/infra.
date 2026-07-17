(function () {
  "use strict";

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
      albumGridScrollHandler: null
    };
    const clipState = ctx.clipState || {
      clips: [],
      activeId: "",
      currentSrc: ""
    };
    const albumGridInitialBatch = Math.max(1, Number(ctx.albumGridInitialBatch) || 8);
    const albumGridNextBatch = Math.max(1, Number(ctx.albumGridNextBatch) || 6);

    function displayAlbumCardTitle(title) {
      const formatted = call(ctx, "displayAlbumCardTitle", title);
      if (typeof formatted === "string") return formatted;
      const cleaned = String(title || "").replace(/\s+/g, " ").trim();
      if (!cleaned) return "";
      if (/[\u0370-\u03ff]/u.test(cleaned) || /\b[A-Z][a-z]\b/.test(cleaned)) return cleaned;
      return cleaned.toLocaleUpperCase();
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
      image.src = item.thumb;
      image.alt = item.thumbAlt || item.title;
      image.decoding = "async";
      const eagerCount = isApp ? 3 : 4;
      const shouldEager = index < eagerCount;
      image.loading = shouldEager ? "eager" : "lazy";
      image.setAttribute("fetchpriority", shouldEager ? "high" : "low");
      if (isApp && item.thumbSrcset) image.setAttribute("srcset", item.thumbSrcset);
      if (isApp && item.thumbSizes) image.setAttribute("sizes", item.thumbSizes);

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

    function renderProgressiveAlbumGrid(grid, items) {
      resetProgressiveAlbumGrid();

      const albums = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!albums.length) {
        grid.replaceChildren();
        grid.dataset.catalogReady = "1";
        return;
      }

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
        catalogState.albumGridObserver = new IntersectionObserver(function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; }) && shouldLoadMore()) {
            loadMore();
          }
        }, { rootMargin: "320px 0px" });
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
      const clean = String(value || "").trim().split("?")[0];
      if (!clean) return "";
      return clean.slice(clean.lastIndexOf("/") + 1);
    }

    function lockedCoverMatchesCatalog(image, expectedThumb) {
      if (!image || image.dataset.spaCoverLocked !== "1") return false;
      const fileName = getAssetFileName(image.getAttribute("src"));
      return Boolean(fileName && fileName === getAssetFileName(expectedThumb));
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
        const shouldEager = index < 4;
        const lockedCover = lockedCoverMatchesCatalog(image, item.thumb);

        if (getCardAttribute(card, "href") !== String(item.page || "").trim()) return false;
        if (!lockedCover && getCardAttribute(image, "src") !== String(item.thumb || "").trim()) return false;
        if (getCardAttribute(image, "alt") !== String(item.thumbAlt || item.title || "").trim()) return false;
        if (getCardAttribute(image, "width") !== String(item.width || "")) return false;
        if (getCardAttribute(image, "height") !== String(item.height || "")) return false;
        if (getCardAttribute(image, "loading") !== (shouldEager ? "eager" : "lazy")) return false;
        if (getCardAttribute(image, "fetchpriority") !== (shouldEager ? "high" : "low")) return false;
        if (getCardAttribute(image, "srcset")) return false;
        if (getCardAttribute(image, "sizes")) return false;
        if (String(label.textContent || "").trim() !== displayTitle) return false;
        return true;
      });
    }

    function hydrateStaticHomeAlbumGrid(grid, albums) {
      if (!homeAlbumGridMatchesCatalog(grid, albums)) return false;
      resetProgressiveAlbumGrid();
      grid.dataset.catalogReady = "1";
      return true;
    }

    function orderHomeAlbumsForSession(albums) {
      return Array.isArray(albums) ? albums.filter(Boolean) : [];
    }

    function buildYouTubeEmbedUrl(videoId, autoplay) {
      const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        playsinline: "1"
      });
      if (autoplay) params.set("autoplay", "1");
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
    }

    function setActiveClip(clipId, opts) {
      const iframe = document.querySelector("[data-clip-iframe]");
      const shell = iframe ? iframe.closest(".clip-player-shell") : null;
      if (!iframe) return;

      const active = clipState.clips.find((clip) => clip.id === clipId);
      if (!active || !active.youtubeId) return;

      const shouldLoad = !(opts && opts.loadPlayer === false);
      const autoplay = Boolean(opts && opts.autoplay);
      if (shouldLoad) {
        const embedUrl = buildYouTubeEmbedUrl(active.youtubeId, autoplay);
        if (embedUrl !== clipState.currentSrc) {
          iframe.src = embedUrl;
          clipState.currentSrc = embedUrl;
        }
        if (shell) shell.classList.remove("is-idle");
      } else {
        iframe.removeAttribute("src");
        clipState.currentSrc = "";
        if (shell) shell.classList.add("is-idle");
      }
      clipState.activeId = active.id;

      const buttons = Array.from(document.querySelectorAll(".clip-card[data-clip-id]"));
      buttons.forEach((button) => {
        const isActive = button.dataset.clipId === active.id;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function buildClipItem(item) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clip-card";
      button.dataset.clipId = item.id;
      button.setAttribute("aria-label", `Lire ${item.title}`);
      button.setAttribute("aria-pressed", "false");

      const title = document.createElement("span");
      title.className = "clip-title";
      if (item.editKey) title.setAttribute("data-edit-key", item.editKey);
      title.textContent = item.title;

      const source = document.createElement("span");
      source.className = "clip-source";
      source.textContent = "YouTube";

      button.appendChild(title);
      button.appendChild(source);
      button.addEventListener("click", function () {
        setActiveClip(item.id, { autoplay: true });
      });

      li.appendChild(button);
      return li;
    }

    function renderClipsSection(clips) {
      const module = document.querySelector('[data-module-id="clips"]');
      const grid = document.querySelector('[data-catalog-grid="clips"]');
      const iframe = document.querySelector("[data-clip-iframe]");
      if (!module || !grid || !iframe) return;
      const menu = module.querySelector(".clips-menu");

      const safe = Array.isArray(clips) ? clips.filter((entry) => entry && entry.id && entry.youtubeId) : [];
      clipState.clips = safe.slice();
      clipState.activeId = "";
      clipState.currentSrc = "";

      if (!safe.length) {
        module.hidden = true;
        grid.replaceChildren();
        iframe.removeAttribute("src");
        grid.dataset.catalogReady = "1";
        return;
      }

      const fragment = document.createDocumentFragment();
      safe.forEach((item) => {
        fragment.appendChild(buildClipItem(item));
      });
      grid.replaceChildren(fragment);
      grid.dataset.catalogReady = "1";
      module.hidden = false;

      const firstId = safe[0].id;
      const isOpen = menu ? menu.open : false;
      setActiveClip(firstId, {
        autoplay: false,
        loadPlayer: isOpen
      });

      if (menu) {
        if (menu._infraClipsToggleHandler) {
          menu.removeEventListener("toggle", menu._infraClipsToggleHandler);
        }
        const onToggle = function () {
          if (!clipState.activeId && clipState.clips.length) {
            clipState.activeId = clipState.clips[0].id;
          }
          if (!menu.open) {
            iframe.removeAttribute("src");
            clipState.currentSrc = "";
            const shell = iframe.closest(".clip-player-shell");
            if (shell) shell.classList.add("is-idle");
          }
        };
        menu._infraClipsToggleHandler = onToggle;
        menu.addEventListener("toggle", onToggle);
      }
    }

    async function waitCatalogWithTimeout(promise, timeoutMs) {
      const safePromise = promise && typeof promise.then === "function"
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
      hydrateStaticHomeAlbumGrid,
      renderClipsSection,
      hydrateHomeCatalog
    };
  }

  window.InfraHomeCatalog = {
    createHomeCatalog
  };
})();
