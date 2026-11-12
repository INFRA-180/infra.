// Bibliothèque V3 (maquette validée par INFRA le 08/11/2026 — DOCS/maquettes/archives/MAQUETTE_V3_20261108.md)
// Lot 1 : ligne d'onglets. Lot 2 : vues Albums / Playlists / Titres / Favoris,
// recherche, tri, grille ou liste, nombres, titres écrits tels quels.
// Maquette V5 (validée par INFRA le 09/11/2026, DOCS/maquettes/MAQUETTE_V5_20261109.md) : onglet
// « Apps & clips » retiré ; accueil Playlists, Albums, Vos favoris, Clips, Applications ; Clips et
// Applications repliés par défaut, « Tout voir » / « Masquer » (choix retenu).
// Rien ici ne touche au moteur audio : la lecture d'une liste passe par
// window.InfraLibraryPlayback (favorites-ui.js), le même chemin que les favoris.
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (typeof document.addEventListener !== "function" || typeof window.addEventListener !== "function")
    return;
  if (window.__infraBibliotheque) return;
  window.__infraBibliotheque = true;
  var scriptUrl = document.currentScript && document.currentScript.src;

  var VIEWS = ["accueil", "albums", "playlists", "titres", "favoris"];
  var SORTS = { site: "Ordre du site", az: "A → Z", duree: "Durée", titres: "Nombre de titres" };
  var HOME_ALBUMS = 10;
  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem("infra-bib-" + k);
        return v == null ? d : JSON.parse(v);
      } catch (_e) {
        return d;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem("infra-bib-" + k, JSON.stringify(v));
      } catch (_e) {}
    }
  };
  var state = {
    view: "accueil",
    albumSort: store.get("albumSort", "site"),
    trackSort: store.get("trackSort", "site"),
    layout: store.get("layout", "grid"),
    sortOpen: false,
    q: "",
    open: { clips: store.get("clipsOpen", false) === true, apps: store.get("appsOpen", false) === true }
  };
  var data = null; // { albums: [{title, page, cover, tracks:[{title, src, seconds}]}], byPage: {} }
  var dataPromise = null;

  // ---------- Outils ----------
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function isHome() {
    return !!(document.body && document.body.classList.contains("home-screen"));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }
  function fmt(s) {
    s = Math.round(Number(s) || 0);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function fmtLong(s) {
    var m = Math.round((Number(s) || 0) / 60);
    return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") : m + " min";
  }
  function pageKey(href) {
    return decodeURIComponent(
      String(href || "")
        .split("#")[0]
        .split("?")[0]
        .split("/")
        .pop() || ""
    );
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function homeLayout() {
    return $(".home-screen .one-page-layout");
  }
  function module(id) {
    return $('.home-screen .one-page-layout > [data-module-id="' + id + '"]');
  }
  function albumsGrid() {
    return $('.home-screen [data-module-id="albums"] .albums-grid');
  }

  var ICON = {
    sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 19V5M4.5 8.5 8 5l3.5 3.5M16 5v14M12.5 15.5 16 19l3.5-3.5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/></g></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/></g><g fill="currentColor"><circle cx="4.8" cy="6.5" r="1.3"/><circle cx="4.8" cy="12" r="1.3"/><circle cx="4.8" cy="17.5" r="1.3"/></g></svg>'
  };

  // ---------- Données ----------
  function loadData() {
    if (data) return Promise.resolve(data);
    if (dataPromise) return dataPromise;
    var url = scriptUrl
      ? new URL("../../data/tracks.json", scriptUrl)
      : new URL("data/tracks.json", document.baseURI);
    if (window.INFRA_BUILD_TAG) url.searchParams.set("v", window.INFRA_BUILD_TAG);
    dataPromise = fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("tracks " + r.status);
        return r.json();
      })
      .then(function (json) {
        var albums = (json && Array.isArray(json.albums) ? json.albums : []).map(function (a, i) {
          var tracks = (Array.isArray(a.tracks) ? a.tracks : [])
            .map(function (t, j) {
              return {
                title: String(t.title || ""),
                src: String(t.src || ""),
                seconds: Number(t.seconds) || 0,
                index: j
              };
            })
            .filter(function (t) {
              return t.src;
            });
          var secs = tracks.reduce(function (s, t) {
            return s + t.seconds;
          }, 0);
          return {
            order: i,
            title: String(a.title || ""),
            page: String(a.page || ""),
            cover: String(a.cover || ""),
            tracks: tracks,
            secs: secs
          };
        });
        var byPage = {};
        albums.forEach(function (a) {
          byPage[pageKey(a.page)] = a;
        });
        var tracks = [];
        albums.forEach(function (a) {
          a.tracks.forEach(function (t) {
            tracks.push({ title: t.title, src: t.src, seconds: t.seconds, album: a, order: tracks.length });
          });
        });
        data = { albums: albums, byPage: byPage, tracks: tracks };
        return data;
      })
      .catch(function (err) {
        dataPromise = null;
        throw err;
      });
    return dataPromise;
  }

  // ---------- Onglets ----------
  function setCurrent(view) {
    $$("[data-bib-tab]").forEach(function (b) {
      if (b.getAttribute("data-bib-tab") === view) {
        b.setAttribute("aria-current", "true");
        // L'onglet choisi reste entier dans la ligne qui défile
        var row = b.parentNode;
        if (row && row.scrollWidth > row.clientWidth) {
          var left = b.offsetLeft - row.offsetLeft,
            right = left + b.offsetWidth;
          if (right > row.scrollLeft + row.clientWidth - 28) row.scrollLeft = right - row.clientWidth + 36;
          else if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left - 8);
        }
      } else b.removeAttribute("aria-current");
    });
  }
  function favoritesOpen() {
    return !!(document.body && document.body.classList.contains("favorites-view-open"));
  }

  function selectView(view, opts) {
    if (VIEWS.indexOf(view) < 0) view = "accueil";
    var options = opts || {};
    if (view === "favoris") {
      // Vue Favoris existante du site (route #favoris) : on la réutilise telle quelle.
      closeSearch(true);
      state.view = "favoris";
      document.body.setAttribute("data-bib-view", "favoris");
      setCurrent("favoris");
      if (!favoritesOpen()) window.location.hash = "favoris";
      return;
    }
    if (favoritesOpen() && String(window.location.hash || "") === "#favoris") {
      try {
        history.replaceState(history.state, "", window.location.pathname + window.location.search);
      } catch (_e) {}
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    if (!options.keepSearch) closeSearch(true);
    state.view = view;
    state.sortOpen = false;
    store.set("view", view);
    document.body.setAttribute("data-bib-view", view);
    setCurrent(view);
    render();
    var tabs = $("[data-bib-tabs]");
    if (tabs && !options.noScroll) {
      var top = tabs.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: reduced() ? "auto" : "smooth" });
    }
  }

  // ---------- Rendu ----------
  function render() {
    if (!isHome()) return;
    renderCounts();
    decorateAlbums();
    renderAlbumTools();
    renderPlaylistTools();
    renderFoldTools();
    renderHomeFavorites();
    if (state.view === "titres" || state.q) renderTracksView();
    else clearPanel();
  }

  function renderCounts() {
    if (!data) return;
    var n = {
      albums: data.albums.length,
      playlists: $$(".home-screen .playlists-grid > li").length,
      titres: data.tracks.length
    };
    Object.keys(n).forEach(function (k) {
      var b = $('[data-bib-tab="' + k + '"]');
      if (!b || !n[k]) return;
      var span = $(".n", b);
      if (!span) {
        span = document.createElement("span");
        span.className = "n";
        span.setAttribute("aria-hidden", "true");
        b.appendChild(span);
      }
      span.textContent = String(n[k]);
    });
  }

  // Cartes d'album : « 7 titres · 24 min » sous le nom, ordre de tri (CSS order), 10 seulement sur l'accueil.
  function decorateAlbums() {
    var grid = albumsGrid();
    if (!grid) return;
    grid.classList.toggle("bib-list", state.view === "albums" && state.layout === "list");
    var items = $$(":scope > li", grid);
    var rank = {};
    if (data) {
      var sorted = data.albums.slice();
      if (state.albumSort === "az")
        sorted.sort(function (a, b) {
          return a.title.localeCompare(b.title, "fr");
        });
      if (state.albumSort === "duree")
        sorted.sort(function (a, b) {
          return b.secs - a.secs;
        });
      if (state.albumSort === "titres")
        sorted.sort(function (a, b) {
          return b.tracks.length - a.tracks.length;
        });
      sorted.forEach(function (a, i) {
        rank[pageKey(a.page)] = i;
      });
    }
    items.forEach(function (li, i) {
      var card = $("a.album-card", li);
      if (!card) return;
      var album = data && data.byPage[pageKey(card.getAttribute("href"))];
      if (album && !$(".bib-meta", card)) {
        var meta = document.createElement("span");
        meta.className = "bib-meta";
        meta.setAttribute("aria-hidden", "true");
        meta.textContent = album.tracks.length + " titres · " + fmtLong(album.secs);
        card.appendChild(meta);
      }
      if (album && !$(".bib-coverplay", li)) {
        var play = document.createElement("button");
        play.type = "button";
        play.className = "bib-coverplay";
        play.setAttribute("data-bib-albumplay", pageKey(card.getAttribute("href")));
        play.setAttribute("aria-label", "Lire " + album.title);
        play.title = "Lire";
        play.innerHTML = '<span class="bib-coverplay-hit">' + ICON.play + "</span>";
        li.appendChild(play);
      }
      var key = pageKey(card.getAttribute("href"));
      li.style.order = state.view === "albums" && rank[key] != null ? String(rank[key]) : "";
      li.classList.toggle("bib-hide-home", state.view === "accueil" && i >= HOME_ALBUMS);
    });
  }

  // Titre de la section Albums : « Voir les 32 » (accueil) ou tri + grille/liste (onglet Albums).
  function renderAlbumTools() {
    var head = $('.home-screen [data-module-id="albums"] .module-head');
    if (!head) return;
    var tools = $(".bib-sectools", head);
    if (!tools) {
      tools = document.createElement("span");
      tools.className = "bib-sectools";
      head.appendChild(tools);
    }
    var count = data ? data.albums.length : $$("li", albumsGrid() || document.createElement("ul")).length;
    if (state.view === "accueil") {
      tools.innerHTML =
        '<button type="button" class="bib-link" data-bib-goto="albums">Voir les ' + count + "</button>";
    } else if (state.view === "albums") {
      tools.innerHTML =
        sortButton(state.albumSort) +
        '<button type="button" class="bib-ico" data-bib-layout="grid" aria-pressed="' +
        (state.layout === "grid") +
        '" aria-label="Afficher en grille" title="Grille">' +
        ICON.grid +
        "</button>" +
        '<button type="button" class="bib-ico" data-bib-layout="list" aria-pressed="' +
        (state.layout === "list") +
        '" aria-label="Afficher en liste" title="Liste">' +
        ICON.list +
        "</button>";
    } else {
      tools.innerHTML = "";
    }
    var row = $('.home-screen [data-module-id="albums"] .bib-sortrow');
    if (state.view === "albums" && state.sortOpen) {
      if (!row) {
        row = document.createElement("div");
        row.className = "bib-sortrow";
        head.parentNode.insertBefore(row, head.nextSibling);
      }
      row.innerHTML = sortRow(["site", "az", "duree", "titres"], state.albumSort, "album");
    } else if (row) {
      row.remove();
    }
  }
  // Maquette V4 : « Tout voir » à droite du titre Playlists (accueil) ; durées « 5 h 14 ».
  function renderPlaylistTools() {
    var head = $('.home-screen [data-module-id="playlists"] .module-head');
    if (!head) return;
    var tools = $(".bib-sectools", head);
    if (!tools) {
      tools = document.createElement("span");
      tools.className = "bib-sectools";
      head.appendChild(tools);
    }
    var html =
      state.view === "accueil"
        ? '<button type="button" class="bib-link" data-bib-goto="playlists">Tout voir</button>'
        : "";
    if (tools.innerHTML !== html) tools.innerHTML = html;
    $$(".home-screen .playlist-card-meta").forEach(function (m) {
      var t = String(m.textContent || ""),
        f = t.replace(/(\d+) h (\d+) min/, function (_x, h, mn) {
          return h + " h " + String(mn).padStart(2, "0");
        });
      if (f !== t) m.textContent = f;
    });
  }
  // Clips et Applications : repliés par défaut, « Tout voir » / « Masquer » dans le titre de section.
  function renderFoldTools() {
    ["clips", "apps"].forEach(function (id) {
      var open = !!state.open[id];
      document.body.classList.toggle("bib-" + id + "-open", open);
      var head = $('.home-screen [data-module-id="' + id + '"] .module-head');
      if (!head) return;
      var tools = $(".bib-sectools", head);
      if (!tools) {
        tools = document.createElement("span");
        tools.className = "bib-sectools";
        head.appendChild(tools);
      }
      var html =
        '<button type="button" class="bib-link" data-bib-fold="' +
        id +
        '" aria-expanded="' +
        open +
        '">' +
        (open ? "Masquer" : "Tout voir") +
        "</button>";
      if (tools.innerHTML !== html) tools.innerHTML = html;
    });
  }
  function toggleFold(id) {
    state.open[id] = !state.open[id];
    store.set(id + "Open", state.open[id]);
    if (id === "clips" && !state.open.clips) {
      var close = $('.home-screen [data-module-id="clips"] [data-clip-close]');
      var player = $('.home-screen [data-module-id="clips"] [data-clip-shell]');
      if (close && player && !player.hidden) close.click();
    }
    renderFoldTools();
    var again = $('[data-bib-fold="' + id + '"]');
    if (again) again.focus({ preventScroll: true });
  }

  // « Vos favoris » : les 4 premiers favoris, « Tout voir » ouvre l'onglet Favoris ; absente sans favori.
  var HOME_FAVS = 4;
  var HEART =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/></svg>';
  var homeFavs = [];
  function renderHomeFavorites() {
    var layout = homeLayout();
    if (!layout) return;
    var api = window.InfraHomeFavorites;
    var all = api && typeof api.list === "function" ? api.list() : [];
    homeFavs = all.slice(0, HOME_FAVS);
    var section = module("favoris");
    if (!homeFavs.length) {
      if (section) section.hidden = true;
      return;
    }
    if (!section) {
      section = document.createElement("section");
      section.className = "module one-col bib-favs";
      section.setAttribute("data-module-id", "favoris");
      layout.appendChild(section);
    }
    section.hidden = false;
    var html =
      '<div class="module-head bib-head"><h2>Vos favoris</h2><span class="bib-sectools"><button type="button" class="bib-link" data-bib-goto="favoris">Tout voir</button></span></div>' +
      '<ul class="bib-list-rows">' +
      homeFavs
        .map(function (t, i) {
          return (
            '<li><button type="button" class="bib-row" data-bib-favplay="' +
            i +
            '" aria-label="' +
            esc(t.title + ", " + t.album) +
            '">' +
            (t.cover
              ? '<img src="' + esc(t.cover) + '" alt="" loading="lazy" decoding="async">'
              : '<span class="bib-noimg"></span>') +
            '<span class="tx"><span class="t">' +
            esc(t.title) +
            '</span><span class="a">' +
            esc(t.album) +
            '</span></span><span class="d">' +
            esc(t.duration) +
            "</span></button>" +
            '<button type="button" class="bib-heart" data-bib-favheart="' +
            i +
            '" aria-pressed="true" aria-label="Retirer ' +
            esc(t.title) +
            ' des favoris" title="Retirer des favoris">' +
            HEART +
            "</button></li>"
          );
        })
        .join("") +
      "</ul>";
    if (section.innerHTML !== html) section.innerHTML = html;
  }

  function sortButton(current) {
    var label = "Trier : " + SORTS[current];
    return (
      '<button type="button" class="bib-ico' +
      (current !== "site" ? " set" : "") +
      '" data-bib-sortbtn aria-expanded="' +
      state.sortOpen +
      '" aria-label="' +
      esc(label) +
      '" title="' +
      esc(label) +
      '">' +
      ICON.sort +
      "</button>"
    );
  }
  function sortRow(keys, current, scope) {
    return (
      '<span class="k">Trier par</span>' +
      keys
        .map(function (k) {
          return (
            '<button type="button" role="radio" aria-checked="' +
            (k === current) +
            '" data-bib-sort="' +
            k +
            '" data-bib-scope="' +
            scope +
            '">' +
            SORTS[k] +
            "</button>"
          );
        })
        .join("")
    );
  }

  // Panneau des titres (onglet Titres et résultats de recherche)
  function panel() {
    var p = $("[data-bib-panel]");
    if (!p) {
      var layout = homeLayout();
      if (!layout) return null;
      p = document.createElement("section");
      p.className = "module one-col bib-panel";
      p.setAttribute("data-bib-panel", "");
      p.setAttribute("aria-live", "polite");
      layout.appendChild(p);
    }
    return p;
  }
  function clearPanel() {
    var p = $("[data-bib-panel]");
    if (p) p.innerHTML = "";
  }

  function trackRow(t, i) {
    var label = t.title + ", " + t.album.title + ", " + fmt(t.seconds);
    return (
      '<li><button type="button" class="bib-row" data-bib-play="' +
      i +
      '" aria-label="' +
      esc(label) +
      '">' +
      '<img src="' +
      esc(t.album.cover) +
      '" alt="" loading="lazy" decoding="async">' +
      '<span class="tx"><span class="t">' +
      esc(t.title) +
      '</span><span class="a">' +
      esc(t.album.title) +
      "</span></span>" +
      '<span class="d">' +
      fmt(t.seconds) +
      "</span></button></li>"
    );
  }

  var shownTracks = [];
  function renderTracksView() {
    var p = panel();
    if (!p) return;
    if (!data) {
      p.innerHTML = '<p class="bib-empty">Chargement…</p>';
      return;
    }
    var q = norm(state.q.trim());
    var html = "";
    if (q) {
      var albums = data.albums.filter(function (a) {
        return norm(a.title).indexOf(q) >= 0;
      });
      var playlists = $$(".home-screen .playlists-grid a.playlist-card").filter(function (a) {
        return (
          norm(a.getAttribute("aria-label")).indexOf(q) >= 0 || norm(a.getAttribute("href")).indexOf(q) >= 0
        );
      });
      shownTracks = data.tracks.filter(function (t) {
        return norm(t.title).indexOf(q) >= 0 || norm(t.album.title).indexOf(q) >= 0;
      });
      if (!albums.length && !playlists.length && !shownTracks.length) {
        p.innerHTML =
          '<p class="bib-empty"><b>Aucun résultat</b>Rien ne correspond à « ' + esc(state.q) + " ».</p>";
        return;
      }
      if (albums.length) {
        html +=
          '<h2 class="bib-h">Albums <span>' +
          albums.length +
          '</span></h2><ul class="bib-list-rows">' +
          albums
            .map(function (a) {
              return (
                '<li><a class="bib-row" href="' +
                esc(a.page) +
                '" aria-label="' +
                esc(a.title + ", " + a.tracks.length + " titres") +
                '"><img src="' +
                esc(a.cover) +
                '" alt="" loading="lazy" decoding="async"><span class="tx"><span class="t">' +
                esc(a.title) +
                '</span><span class="a">' +
                a.tracks.length +
                ' titres</span></span><span class="d">' +
                fmtLong(a.secs) +
                "</span></a></li>"
              );
            })
            .join("") +
          "</ul>";
      }
      if (playlists.length) {
        html +=
          '<h2 class="bib-h">Playlists</h2><ul class="bib-list-rows">' +
          playlists
            .map(function (a) {
              var name = String(a.getAttribute("aria-label") || "").replace(/^Ouvrir la playlist\s*/, "");
              return (
                '<li><a class="bib-row noimg" href="' +
                esc(a.getAttribute("href")) +
                '"><span class="tx"><span class="t">' +
                esc(name) +
                "</span></span></a></li>"
              );
            })
            .join("") +
          "</ul>";
      }
      if (shownTracks.length)
        html +=
          '<h2 class="bib-h">Titres <span>' +
          shownTracks.length +
          '</span></h2><ul class="bib-list-rows">' +
          shownTracks.map(trackRow).join("") +
          "</ul>";
      p.innerHTML = html;
      return;
    }
    shownTracks = data.tracks.slice();
    if (state.trackSort === "az")
      shownTracks.sort(function (a, b) {
        return a.title.localeCompare(b.title, "fr");
      });
    if (state.trackSort === "duree")
      shownTracks.sort(function (a, b) {
        return b.seconds - a.seconds;
      });
    var total = shownTracks.reduce(function (s, t) {
      return s + t.seconds;
    }, 0);
    var rows = "",
      last = "";
    shownTracks.forEach(function (t, i) {
      if (state.trackSort === "az") {
        var L = (norm(t.title).charAt(0) || "#").toUpperCase();
        var k = /[A-Z]/.test(L) ? L : "#";
        if (k !== last) {
          rows += '<li class="bib-letter" role="presentation">' + k + "</li>";
          last = k;
        }
      }
      rows += trackRow(t, i);
    });
    html =
      '<div class="module-head bib-panel-head"><h2>' +
      shownTracks.length +
      " titres · " +
      fmtLong(total) +
      '</h2><span class="bib-sectools">' +
      '<button type="button" class="bib-link" data-bib-playall>Tout lire</button>' +
      sortButton(state.trackSort) +
      "</span></div>" +
      (state.sortOpen
        ? '<div class="bib-sortrow">' + sortRow(["site", "az", "duree"], state.trackSort, "track") + "</div>"
        : "") +
      '<ul class="bib-list-rows">' +
      rows +
      "</ul>";
    p.innerHTML = html;
  }

  // ---------- Recherche ----------
  function openSearch() {
    var bar = $("[data-bib-tabs]");
    if (!bar) return;
    bar.classList.add("searching");
    var input = $("[data-bib-search]", bar);
    if (input)
      setTimeout(function () {
        input.focus();
      }, 0);
  }
  function closeSearch(silent) {
    var bar = $("[data-bib-tabs]");
    if (!bar) return;
    bar.classList.remove("searching");
    var input = $("[data-bib-search]", bar);
    if (input) input.value = "";
    var had = !!state.q;
    state.q = "";
    document.body.classList.remove("bib-searching");
    if (had && !silent) render();
  }

  // ---------- Événements ----------
  document.addEventListener("click", function (event) {
    if (!isHome()) return;
    var el =
      event.target && event.target.closest
        ? event.target.closest(
            "[data-bib-tab],[data-bib-goto],[data-bib-sortbtn],[data-bib-sort],[data-bib-layout],[data-bib-play],[data-bib-playall],[data-bib-albumplay],[data-bib-searchbtn],[data-bib-cancel],[data-bib-fold],[data-bib-favplay],[data-bib-favheart]"
          )
        : null;
    if (!el) return;
    if (el.closest("summary")) event.preventDefault(); // les outils sont dans le titre de section (<summary>)
    if (el.hasAttribute("data-bib-tab")) {
      var v = el.getAttribute("data-bib-tab");
      // Toucher l'onglet déjà actif : remonte en haut (convention iPhone ; maquette V7, INFRA 11/11/2026)
      var bar = $("[data-bib-tabs]");
      if (
        el.getAttribute("aria-current") === "true" &&
        !state.q &&
        !(bar && bar.classList.contains("searching"))
      ) {
        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      selectView(v === "top" ? "accueil" : v);
      return;
    }
    if (el.hasAttribute("data-bib-goto")) {
      selectView(el.getAttribute("data-bib-goto"));
      return;
    }
    if (el.hasAttribute("data-bib-sortbtn")) {
      state.sortOpen = !state.sortOpen;
      render();
      return;
    }
    if (el.hasAttribute("data-bib-sort")) {
      var scope = el.getAttribute("data-bib-scope"),
        key = el.getAttribute("data-bib-sort");
      if (scope === "album") {
        state.albumSort = key;
        store.set("albumSort", key);
      } else {
        state.trackSort = key;
        store.set("trackSort", key);
      }
      render();
      return;
    }
    if (el.hasAttribute("data-bib-layout")) {
      state.layout = el.getAttribute("data-bib-layout");
      store.set("layout", state.layout);
      render();
      return;
    }
    if (el.hasAttribute("data-bib-play") || el.hasAttribute("data-bib-playall")) {
      var api = window.InfraLibraryPlayback;
      if (!api || typeof api.playPaths !== "function") return;
      var index = el.hasAttribute("data-bib-play") ? Number(el.getAttribute("data-bib-play")) : 0;
      api.playPaths(
        shownTracks.map(function (t) {
          return t.src;
        }),
        index
      );
      return;
    }
    if (el.hasAttribute("data-bib-albumplay")) {
      event.preventDefault();
      var pb = window.InfraLibraryPlayback;
      loadData().then(
        function (d) {
          var al = d.byPage[el.getAttribute("data-bib-albumplay")];
          if (al && pb && typeof pb.playPaths === "function")
            pb.playPaths(
              al.tracks.map(function (t) {
                return t.src;
              }),
              0
            );
        },
        function () {}
      );
      return;
    }
    if (el.hasAttribute("data-bib-fold")) {
      toggleFold(el.getAttribute("data-bib-fold"));
      return;
    }
    if (el.hasAttribute("data-bib-favplay")) {
      var lib = window.InfraLibraryPlayback;
      if (lib && typeof lib.playPaths === "function")
        lib.playPaths(
          homeFavs.map(function (t) {
            return t.src;
          }),
          Number(el.getAttribute("data-bib-favplay"))
        );
      return;
    }
    if (el.hasAttribute("data-bib-favheart")) {
      var favApi = window.InfraHomeFavorites,
        item = homeFavs[Number(el.getAttribute("data-bib-favheart"))];
      if (favApi && item && typeof favApi.toggle === "function") favApi.toggle(item.path);
      return;
    }
    if (el.hasAttribute("data-bib-searchbtn")) {
      openSearch();
      return;
    }
    if (el.hasAttribute("data-bib-cancel")) {
      closeSearch();
      return;
    }
  });

  document.addEventListener("input", function (event) {
    var input = event.target;
    if (!input || !input.matches || !input.matches("[data-bib-search]")) return;
    state.q = String(input.value || "");
    document.body.classList.toggle("bib-searching", !!state.q.trim());
    if (state.q.trim()) loadData().then(render, render);
    else render();
  });

  // ---------- Une seule règle « retour » au clavier (maquette V7, INFRA 11/11/2026) ----------
  // Échap, Alt + ← et Cmd + [ : grand lecteur, puis fiche ouverte, puis recherche. « / » : recherche.
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.defaultPrevented) return;
      var target = event.target,
        typing =
          target &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(String(target.tagName || "")));
      var isEscape = event.key === "Escape",
        isBack =
          isEscape || (event.altKey && event.key === "ArrowLeft") || (event.metaKey && event.key === "[");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey && isHome()) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (!isBack || (typing && !isEscape)) return;
      var playerOpen = document.body.classList.contains("now-playing-open");
      var modalOpen = !!document.querySelector(".is-open[aria-hidden='false']");
      if (playerOpen || modalOpen) {
        // Échap est déjà traité par le lecteur et les fenêtres ; Alt + ← / Cmd + [ font pareil.
        if (!isEscape) {
          event.preventDefault();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
        return;
      }
      if (isHome()) {
        var bar = $("[data-bib-tabs]");
        if (!isEscape && (state.q || (bar && bar.classList.contains("searching")))) {
          event.preventDefault();
          closeSearch();
        }
        return; // Échap sur l'accueil : recherche et tri, gérés plus bas
      }
      var layer = document.querySelector(".spa-route-layer[data-spa-route-state='current']") || document.body,
        back = layer.querySelector(".back");
      if (back) {
        event.preventDefault();
        back.click();
      }
    },
    true
  );

  document.addEventListener("keydown", function (event) {
    if (!isHome()) return;
    if (
      event.key === "Escape" &&
      (state.q || ($("[data-bib-tabs]") && $("[data-bib-tabs]").classList.contains("searching")))
    ) {
      closeSearch();
      return;
    }
    if (event.key === "Escape" && state.sortOpen) {
      state.sortOpen = false;
      render();
    }
  });

  document.addEventListener("infra:favorites-sync", function () {
    if (isHome()) renderHomeFavorites();
  });

  // La vue Favoris du site se ferme par son propre bouton retour : on remet l'onglet Accueil.
  window.addEventListener("hashchange", function () {
    if (!isHome()) return;
    if (String(window.location.hash || "") === "#favoris") {
      document.body.setAttribute("data-bib-view", "favoris");
      setCurrent("favoris");
      state.view = "favoris";
    } else if (state.view === "favoris") {
      selectView("accueil", { noScroll: true });
    }
  });

  // L'accueil peut reconstruire la grille d'albums (catalogue en direct) : on redécore.
  var observed = null;
  function watchGrid() {
    var grid = albumsGrid();
    if (!grid || grid === observed) return;
    observed = grid;
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () {
        decorateAlbums();
      }).observe(grid, { childList: true });
    }
    return true;
  }

  // ---------- Lecteur au repos (maquette V4, INFRA 08/11/2026) ----------
  // Tant que rien n'est chargé, la barre du bas montre la dernière écoute (sinon le 1er titre du 1er album)
  // et Lecture la lance directement, avec la suite de son album.
  var IDLE_KEY = "last";
  function transport() {
    return $("[data-transport-pip-root]") || $(".global-transport");
  }
  function idleTrack(d) {
    var last = store.get(IDLE_KEY, null);
    if (last && last.src) {
      for (var i = 0; i < d.tracks.length; i += 1) {
        if (d.tracks[i].src === last.src) return d.tracks[i];
      }
    }
    return d.tracks[0] || null;
  }
  function paintIdle() {
    var t = transport();
    if (!t || !data) return;
    var title = $("[data-transport-now-title]", t),
      album = $("[data-transport-now-album]", t);
    if (!title || !album) return;
    if (String(title.textContent || "").trim() && !title.hasAttribute("data-bib-idle")) {
      t.classList.remove("bib-idle");
      return;
    }
    var tr = idleTrack(data);
    if (!tr) return;
    t.classList.add("bib-idle");
    title.setAttribute("data-bib-idle", "");
    if (title.textContent !== tr.title) title.textContent = tr.title;
    if (album.textContent !== tr.album.title) album.textContent = tr.album.title;
    if (album.hidden) {
      album.hidden = false;
      album.setAttribute("data-bib-idle", "");
    }
  }
  function clearIdleMark() {
    var t = transport();
    if (!t) return;
    var title = $("[data-transport-now-title]", t);
    if (title) title.removeAttribute("data-bib-idle");
    var album = $("[data-transport-now-album]", t);
    if (album && album.hasAttribute("data-bib-idle")) album.removeAttribute("data-bib-idle");
    t.classList.remove("bib-idle");
  }
  document.addEventListener(
    "click",
    function (event) {
      var t = transport();
      if (!t || !t.classList.contains("bib-idle")) return;
      var btn =
        event.target && event.target.closest
          ? event.target.closest("[data-transport-toggle],[data-transport-next],[data-transport-prev]")
          : null;
      if (!btn || !t.contains(btn) || !data) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var tr = idleTrack(data),
        pb = window.InfraLibraryPlayback;
      if (!tr || !pb || typeof pb.playPaths !== "function") return;
      var srcs = tr.album.tracks.map(function (x) {
        return x.src;
      });
      clearIdleMark();
      pb.playPaths(srcs, Math.max(0, srcs.indexOf(tr.src)));
    },
    true
  );
  // Retient la dernière écoute (pour la retrouver à la prochaine visite).
  document.addEventListener(
    "play",
    function (event) {
      var a = event.target;
      if (!a || a.tagName !== "AUDIO") return;
      clearIdleMark();
      loadData().then(
        function (d) {
          var src = decodeURIComponent(String(a.currentSrc || a.src || ""));
          for (var i = 0; i < d.tracks.length; i += 1) {
            var s2 = d.tracks[i].src.replace(/^(\.\.\/|\.\/)+/, "");
            if (s2 && src.indexOf(s2) >= 0) {
              store.set(IDLE_KEY, { src: d.tracks[i].src });
              return;
            }
          }
        },
        function () {}
      );
    },
    true
  );
  // ---------- Toucher la barre (INFRA, 08/11/2026) ----------
  // Toute la barre ouvre le grand lecteur, sauf Précédent / Lecture / Suivant et la ligne de progression.
  // Au repos (rien de chargé), toucher la barre lance la dernière écoute puis ouvre le grand lecteur.
  var BAR_SKIP =
    "[data-transport-prev],[data-transport-toggle],[data-transport-next],[data-transport-mini-progress],[data-transport-favorite],[data-transport-mode],[data-transport-shuffle]";
  var openingFromBar = false;
  function openBigPlayer() {
    var t = transport();
    if (!t) return;
    var title = $("[data-transport-now-title]", t);
    if (!title) return;
    openingFromBar = true;
    try {
      title.click();
    } finally {
      openingFromBar = false;
    }
  }
  document.addEventListener(
    "click",
    function (event) {
      if (openingFromBar) return;
      var t = transport();
      if (!t) return;
      var target = event.target;
      if (!target || !target.closest || !t.contains(target) || target.closest(BAR_SKIP)) return;
      if (document.documentElement.classList.contains("now-playing-open")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (t.classList.contains("bib-idle")) {
        var toggle = $("[data-transport-toggle]", t);
        if (toggle) toggle.click();
        window.setTimeout(openBigPlayer, 350);
        return;
      }
      openBigPlayer();
    },
    true
  );
  document.addEventListener(
    "pointerdown",
    function (event) {
      var t = transport();
      if (
        !t ||
        !event.target ||
        !event.target.closest ||
        !t.contains(event.target) ||
        event.target.closest(BAR_SKIP)
      )
        return;
      t.classList.add("bib-press");
      var off = function () {
        t.classList.remove("bib-press");
        document.removeEventListener("pointerup", off, true);
        document.removeEventListener("pointercancel", off, true);
      };
      document.addEventListener("pointerup", off, true);
      document.addEventListener("pointercancel", off, true);
    },
    true
  );

  var idleWatched = null;
  function watchIdle() {
    var t = transport();
    if (!t || t === idleWatched || typeof MutationObserver !== "function") return;
    idleWatched = t;
    new MutationObserver(function () {
      if (data) paintIdle();
    }).observe(t, { childList: true, subtree: true, characterData: true });
  }

  function boot() {
    loadData().then(
      function () {
        watchIdle();
        paintIdle();
      },
      function () {}
    );
    if (!isHome() || !watchGrid()) return;
    if (String(window.location.hash || "") === "#favoris") state.view = "favoris";
    setCurrent(state.view);
    document.body.setAttribute("data-bib-view", state.view);
    render();
    loadData().then(render, function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  // Retour à l'accueil par la navigation interne : la couche d'accueil est réinsérée.
  if (typeof MutationObserver === "function" && document.body) {
    new MutationObserver(boot).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // ---------- Gestes iPhone (INFRA, 09/11/2026 ; pile d'écrans 11/11/2026, maquette V7) ----------
  // 1. Fiche album/playlist : glisser depuis le bord gauche = retour. La fiche suit le doigt et laisse
  //    voir l'écran du dessous (accueil gardé peint, spa-renderer.js), qui s'éclaircit ; lâcher au-delà
  //    d'un tiers de l'écran (ou d'un geste vif) = retour, sinon la fiche revient.
  // 2. Barre du lecteur : glisser ← / → = titre suivant / précédent ; glisser ↑ = grand lecteur.
  (function gestures() {
    var g = null;
    function currentLayer() {
      return document.querySelector(".spa-route-layer[data-spa-route-state='current']") || document.body;
    }
    document.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || e.touches.length !== 1) {
          g = null;
          return;
        }
        var t = e.touches[0],
          target = e.target && e.target.closest ? e.target : null;
        var bar = transport();
        if (
          bar &&
          target &&
          bar.contains(target) &&
          !target.closest("[data-transport-mini-progress], input")
        ) {
          g = { kind: "bar", x: t.clientX, y: t.clientY };
        } else if (t.clientX < 24 && currentLayer().querySelector(".back")) {
          g = { kind: "edge", x: t.clientX, y: t.clientY, t: Date.now(), horiz: null, dx: 0 };
        } else g = null;
      },
      { passive: true, capture: true }
    );
    function underLayer() {
      // Pile d'écrans : l'écran juste dessous est la première couche gardée (la plus récente).
      return document.querySelector(".spa-route-layer[data-spa-route-state='retained']");
    }
    // Fiche du dessous qui avait reculé de 28 % (fiche ouverte depuis une fiche, V7 point 2,
    // spa-renderer.js) : elle revient avec le doigt. ratio 1 = reculée, 0 = en place.
    function underTransform(under, ratio) {
      var top = Number(under.getAttribute("data-spa-retained-top")) || 0;
      return "translate3d(" + -28 * ratio + "%, " + top + "px, 0)";
    }
    function paintEdge(layer, dx) {
      var p = Math.min(1, Math.max(0, dx / Math.max(1, window.innerWidth)));
      layer.style.transform = "translate3d(" + dx + "px, 0, 0)";
      var under = underLayer();
      if (!under) return;
      under.style.filter = "brightness(" + (0.78 + 0.22 * p).toFixed(3) + ")";
      if (under.hasAttribute("data-spa-receded")) under.style.transform = underTransform(under, 1 - p);
    }
    function settleEdge(layer, toX, done) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var under = underLayer();
      layer.style.transition = reduce ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1)";
      layer.style.transform = "translate3d(" + toX + "px, 0, 0)";
      if (under) {
        // Les transitions CSS de la couche gardée sont coupées : animation du navigateur.
        var receded = under.hasAttribute("data-spa-receded");
        var fromT = under.style.transform,
          fromF = under.style.filter || "brightness(1)";
        var toT = receded ? underTransform(under, toX > 0 ? 0 : 1) : fromT;
        var toF = toX > 0 ? "brightness(1)" : receded ? "brightness(0.78)" : "brightness(.78)";
        if (!reduce && typeof under.animate === "function") {
          under.animate(
            [
              { transform: fromT || "none", filter: fromF },
              { transform: toT || "none", filter: toF }
            ],
            { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
          );
        }
        under.style.transform = toT;
        under.style.filter = toF;
        // Retour confirmé : la fiche du dessous est déjà en place, pas de deuxième animation au retour.
        if (toX > 0) under.removeAttribute("data-spa-receded");
      }
      window.setTimeout(
        function () {
          if (under && toX <= 0 && !under.hasAttribute("data-spa-receded")) under.style.filter = "";
          done();
        },
        reduce ? 0 : 270
      );
    }
    document.addEventListener(
      "touchmove",
      function (e) {
        if (!g || g.kind !== "edge" || !e.touches || !e.touches[0]) return;
        var t = e.touches[0],
          mx = t.clientX - g.x,
          my = t.clientY - g.y;
        if (g.horiz === null && Math.abs(mx) + Math.abs(my) > 8) {
          g.horiz = mx > 0 && Math.abs(mx) > Math.abs(my);
          if (g.horiz) {
            g.layer = currentLayer();
            g.layer.style.transition = "none";
            g.layer.style.willChange = "transform";
          }
        }
        if (!g.horiz) return;
        if (e.cancelable) e.preventDefault(); // pas de défilement vertical pendant le geste
        g.dx = Math.max(0, mx);
        paintEdge(g.layer, g.dx);
      },
      { passive: false, capture: true }
    );
    document.addEventListener(
      "touchend",
      function (e) {
        if (!g || !e.changedTouches || !e.changedTouches[0]) {
          g = null;
          return;
        }
        var t = e.changedTouches[0],
          dx = t.clientX - g.x,
          dy = t.clientY - g.y,
          kind = g.kind,
          edge = g;
        g = null;
        if (kind === "edge" && edge.horiz && edge.layer) {
          var layer = edge.layer,
            fast = edge.dx / Math.max(1, Date.now() - edge.t) > 0.6;
          if (edge.dx > window.innerWidth / 3 || (fast && edge.dx > 40)) {
            settleEdge(layer, window.innerWidth, function () {
              // La page est sortie de l'écran : le retour la retire sans la reposer par-dessus.
              layer.setAttribute("data-spa-swiped-out", "");
              var back = layer.querySelector(".back");
              if (back) back.click();
            });
          } else {
            settleEdge(layer, 0, function () {
              layer.style.transform = "";
              layer.style.transition = "";
              layer.style.willChange = "";
            });
          }
        } else if (kind === "edge" && dx > 70 && Math.abs(dy) < dx / 2) {
          var backBtn = currentLayer().querySelector(".back");
          if (backBtn) backBtn.click();
        } else if (kind === "bar") {
          var bar = transport();
          if (!bar) return;
          var btn = null;
          if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) / 2)
            btn = bar.querySelector(dx < 0 ? "[data-transport-next]" : "[data-transport-prev]");
          else if (dy < -50 && Math.abs(dx) < -dy / 2) btn = bar.querySelector("[data-transport-now]");
          if (btn) {
            btn.click();
            if (e.cancelable) e.preventDefault();
          }
        }
      },
      { passive: false, capture: true }
    );
    document.addEventListener(
      "touchcancel",
      function () {
        if (g && g.kind === "edge" && g.horiz && g.layer) {
          var layer = g.layer;
          settleEdge(layer, 0, function () {
            layer.style.transform = "";
            layer.style.transition = "";
            layer.style.willChange = "";
          });
        }
        g = null;
      },
      true
    );
  })();

  // ---------- Fondu à droite des onglets seulement s'il reste des onglets cachés (V8) ----------
  (function tabsRowEnd() {
    function update() {
      $$(".bib-tabs-row").forEach(function (row) {
        row.classList.toggle("at-end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 2);
      });
    }
    document.addEventListener(
      "scroll",
      function (e) {
        if (e.target && e.target.classList && e.target.classList.contains("bib-tabs-row")) update();
      },
      true
    );
    window.addEventListener("resize", update);
    document.addEventListener("click", function () {
      window.setTimeout(update, 50);
    });
    if (typeof MutationObserver === "function" && document.body) {
      new MutationObserver(update).observe(document.body, {
        attributes: true,
        attributeFilter: ["data-bib-view"]
      });
    }
    update();
  })();

  // ---------- Glisser entre les onglets (maquette V8, INFRA 11/11/2026) ----------
  // Bibliothèque : glisser ← = onglet suivant, → = onglet précédent. Le contenu suit le doigt ; lâcher
  // au-delà d'un quart de l'écran (ou d'un geste vif) = changer d'onglet, sinon tout revient ; premier et
  // dernier onglet : élastique. Pas depuis une rangée qui défile de côté (playlists, tri, onglets), ni
  // depuis le bord gauche, ni avec la recherche ou le grand lecteur ouverts. Remplace le glisser des
  // pochettes qui ouvrait l'album (home-catalog.js, albumCoverSwipeOpens) : toucher une pochette l'ouvre.
  (function tabSwipe() {
    var g = null,
      swallowUntil = 0;
    var EASE = "cubic-bezier(.2,.8,.2,1)";
    function homeMain() {
      var layer = document.querySelector(".spa-route-layer[data-spa-route-state='current']") || document;
      return layer.querySelector("main.one-page-layout") || layer.querySelector("main");
    }
    function tabOrder() {
      return $$("[data-bib-tab]")
        .filter(function (b) {
          return b.offsetParent !== null;
        })
        .map(function (b) {
          return b.getAttribute("data-bib-tab");
        });
    }
    function scrollsSideways(el, stop) {
      for (var n = el; n && n !== stop && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 2) {
          var ox = window.getComputedStyle(n).overflowX;
          if (ox === "auto" || ox === "scroll") return true;
        }
      }
      return false;
    }
    function canStart(e, main) {
      if (!isHome() || !main || !e.touches || e.touches.length !== 1) return false;
      var bar = $("[data-bib-tabs]");
      if (state.q || (bar && bar.classList.contains("searching"))) return false;
      if (document.body.classList.contains("now-playing-open")) return false;
      var t = e.touches[0],
        target = e.target && e.target.closest ? e.target : null;
      if (!target || !main.contains(target) || t.clientX < 24) return false;
      if (target.closest("input, textarea, select, .bib-sortrow, [data-bib-tabs]")) return false;
      return !scrollsSideways(target, main);
    }
    function settle(main, ms) {
      window.setTimeout(function () {
        main.style.transition = "";
        main.style.willChange = "";
        main.style.opacity = "";
      }, ms);
    }
    document.addEventListener(
      "touchstart",
      function (e) {
        var main = homeMain();
        if (!canStart(e, main)) {
          g = null;
          return;
        }
        var order = tabOrder();
        g = {
          main: main,
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          t: Date.now(),
          dx: 0,
          horiz: null,
          order: order,
          i: order.indexOf(state.view)
        };
        if (g.i < 0) g = null;
      },
      { passive: true, capture: true }
    );
    document.addEventListener(
      "touchmove",
      function (e) {
        if (!g || !e.touches || !e.touches[0]) return;
        var mx = e.touches[0].clientX - g.x,
          my = e.touches[0].clientY - g.y;
        if (g.horiz === null && Math.abs(mx) + Math.abs(my) > 10) {
          g.horiz = Math.abs(mx) > Math.abs(my) * 1.2;
          if (!g.horiz) {
            g = null;
            return;
          }
          g.main.style.transition = "none";
          g.main.style.willChange = "transform";
        }
        if (!g.horiz) return;
        if (e.cancelable) e.preventDefault(); // pas de défilement vertical pendant le geste
        var next = g.i + (mx < 0 ? 1 : -1),
          atEdge = next < 0 || next >= g.order.length;
        g.dx = atEdge ? mx / 3 : mx; // élastique au premier et au dernier onglet
        g.main.style.transform = "translate3d(" + g.dx + "px, 0, 0)";
      },
      { passive: false, capture: true }
    );
    function end() {
      if (!g || !g.horiz) {
        g = null;
        return;
      }
      var main = g.main,
        dx = g.dx,
        order = g.order,
        next = g.i + (dx < 0 ? 1 : -1),
        fast = Math.abs(dx) / Math.max(1, Date.now() - g.t) > 0.5;
      g = null;
      swallowUntil = Date.now() + 450; // le toucher qui suit le glisser n'ouvre pas la pochette
      var go =
        next >= 0 &&
        next < order.length &&
        (Math.abs(dx) > window.innerWidth / 4 || (fast && Math.abs(dx) > 40));
      if (!go) {
        main.style.transition = "transform 260ms " + EASE;
        main.style.transform = "";
        settle(main, 270);
        return;
      }
      if (reduced()) {
        main.style.transform = "";
        settle(main, 0);
        selectView(order[next]);
        return;
      }
      var out = dx < 0 ? -window.innerWidth : window.innerWidth;
      main.style.transition = "transform 180ms " + EASE + ", opacity 180ms";
      main.style.transform = "translate3d(" + out + "px, 0, 0)";
      main.style.opacity = "0";
      window.setTimeout(function () {
        // Contenu remis en place AVANT de changer d'onglet : Favoris change l'adresse (#favoris) et Safari
        // reconstruit alors la page depuis une copie de l'écran ; une copie prise transparente et décalée
        // donnait une page blanche (vu dans le simulateur, 11/11/2026).
        main.style.transition = "none";
        main.style.transform = "";
        main.style.opacity = "";
        main.style.willChange = "";
        selectView(order[next]);
        if (homeMain() !== main || !main.isConnected) return; // page reconstruite : pas d'arrivée animée
        main.style.transform = "translate3d(" + -out * 0.3 + "px, 0, 0)";
        main.style.opacity = "0";
        // Sans attendre une image du navigateur : position de départ appliquée tout de suite, puis l'arrivée.
        void main.offsetWidth;
        main.style.transition = "transform 260ms " + EASE + ", opacity 200ms";
        main.style.transform = "";
        main.style.opacity = "";
        settle(main, 270);
      }, 180);
    }
    document.addEventListener("touchend", end, true);
    document.addEventListener("touchcancel", end, true);
    // Sur la fenêtre, en capture : avant le gestionnaire de liens du site (page-init.js, document).
    window.addEventListener(
      "click",
      function (e) {
        if (Date.now() > swallowUntil) return;
        swallowUntil = 0;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true
    );
  })();
})();
