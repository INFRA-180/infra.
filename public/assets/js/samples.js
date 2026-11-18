// Section Samples (maquette Samples v2, validée par INFRA le 18/11/2026 :
// INVENTAIRE_SAMPLES/MAQUETTE_SAMPLES_V2_20261118.html).
// Onglet « Samples » de la bibliothèque : deux playlists mélangées (samples seuls ; samples + voix),
// puis les albums, chacun = la playlist de ses samples. Le lecteur YouTube enchaîne les samples
// lui-même (messages de l'iframe, sans script externe) ; la musique INFRA se met en pause pendant
// un sample, et le sample se met en pause quand la musique repart.
// Données : data/samples.json, fabriqué par INVENTAIRE_SAMPLES/_outils/publie.py (rien de privé).
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.InfraSamples) return;
  var scriptUrl = document.currentScript && document.currentScript.src;
  var ORIGIN = "https://www.youtube-nocookie.com";

  var data = null,
    loading = null;
  var st = { list: [], pos: -1, title: "", mode: "album", album: null, voix: false, ready: false };
  try {
    st.voix = localStorage.getItem("infra-samples-voix") === "1";
  } catch (_e) {}

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function dataUrl(name) {
    var u = scriptUrl ? new URL("../../data/" + name, scriptUrl) : new URL("data/" + name, document.baseURI);
    if (window.INFRA_BUILD_TAG) u.searchParams.set("v", window.INFRA_BUILD_TAG);
    return u;
  }
  function assetUrl(rel) {
    try {
      return scriptUrl ? new URL("../../" + rel, scriptUrl).href : rel;
    } catch (_e) {
      return rel;
    }
  }
  function getJson(name) {
    return fetch(dataUrl(name), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(name + " " + r.status);
      return r.json();
    });
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = Promise.all([
      getJson("samples.json"),
      getJson("tracks.json").catch(function () {
        return null;
      })
    ])
      .then(function (res) {
        var covers = {};
        ((res[1] && res[1].albums) || []).forEach(function (a) {
          covers[a.title] = a.cover;
        });
        var albums = ((res[0] && res[0].albums) || []).map(function (a) {
          var items = [];
          (a.tracks || []).forEach(function (t) {
            (t.items || []).forEach(function (it) {
              if (!it || !/^[\w-]{11}$/.test(String(it.y || ""))) return;
              items.push({
                t: String(it.t || ""),
                a: String(it.a || ""),
                an: String(it.an || ""),
                y: it.y,
                v: it.v === 1,
                track: String(t.title || ""),
                n: Number(t.n) || 0,
                album: a.title
              });
            });
          });
          return { title: a.title, cover: covers[a.title] || "", items: items };
        });
        data = { albums: albums };
        return data;
      })
      .catch(function (err) {
        loading = null;
        throw err;
      });
    return loading;
  }
  function count(items, voix) {
    return items.filter(function (i) {
      return voix || !i.v;
    }).length;
  }
  function all() {
    var out = [];
    data.albums.forEach(function (a) {
      out = out.concat(a.items);
    });
    return out;
  }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)),
        x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  }
  function track(name, extra) {
    try {
      if (typeof window.InfraTrackEvent === "function") window.InfraTrackEvent(name, extra || {});
    } catch (_e) {}
  }

  // ---------- Page (onglet Samples) ----------
  var PLAY =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
  var SHUFFLE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/></svg>';
  function render(panel) {
    if (!panel) return;
    if (!data) {
      panel.innerHTML = '<p class="bib-empty">Chargement…</p>';
      load()
        .then(function () {
          if (document.body.getAttribute("data-bib-view") === "samples") render(panel);
        })
        .catch(function () {
          panel.innerHTML = '<p class="bib-empty">Les samples n\'ont pas pu être chargés.</p>';
        });
      return;
    }
    var everything = all();
    var html =
      '<div class="module-head bib-panel-head"><h2>Tout mélangé</h2></div>' +
      '<div class="smp-mix">' +
      '<button type="button" class="smp-mixbtn" data-smp-mix="0">' +
      SHUFFLE +
      "<span><b>Samples</b><small>" +
      count(everything, false) +
      " samples · sans les voix</small></span></button>" +
      '<button type="button" class="smp-mixbtn" data-smp-mix="1">' +
      SHUFFLE +
      "<span><b>Samples + voix</b><small>" +
      count(everything, true) +
      " sons · avec les voix</small></span></button></div>" +
      '<div class="module-head bib-panel-head"><h2>Les samples, album par album</h2></div>' +
      '<ul class="smp-grid">' +
      data.albums
        .map(function (a, i) {
          var n = count(a.items, false);
          return (
            '<li><button type="button" class="smp-al" data-smp-album="' +
            i +
            '" aria-label="Samples de ' +
            esc(a.title) +
            '"><span class="smp-cover"><img src="' +
            esc(assetUrl(a.cover)) +
            '" alt="" loading="lazy" decoding="async"><span class="smp-play">' +
            PLAY +
            '</span></span><b dir="auto">' +
            esc(a.title) +
            "</b><small>" +
            (n ? n + (n > 1 ? " samples" : " sample") : count(a.items, true) + " voix") +
            "</small></button></li>"
          );
        })
        .join("") +
      "</ul>";
    panel.innerHTML = html;
  }

  // ---------- Lecteur ----------
  var sheet = null;
  function shown() {
    return st.list.filter(function (i) {
      return st.voix || !i.v;
    });
  }
  function buildSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.className = "smp-sheet";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Lecteur de samples");
    sheet.innerHTML =
      '<div class="smp-card">' +
      '<div class="smp-top"><span class="smp-kicker" data-smp-kicker></span>' +
      '<span class="smp-tools"><a class="smp-ytic" data-smp-yt target="_blank" rel="noopener" aria-label="Ouvrir dans YouTube" title="Ouvrir dans YouTube">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg></a>' +
      '<button type="button" class="smp-x" data-smp-close aria-label="Fermer">✕</button></span></div>' +
      '<div class="smp-scroll">' +
      '<div class="smp-video"><iframe data-smp-frame title="Sample" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<div class="smp-now"><b data-smp-t dir="auto"></b><small data-smp-a dir="auto"></small><small class="smp-from" data-smp-from></small></div>' +
      '<div class="smp-ctr"><button type="button" data-smp-prev aria-label="Sample précédent"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>' +
      '<button type="button" data-smp-next aria-label="Sample suivant"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button></div>' +
      '<div class="smp-switch" role="radiogroup" aria-label="Voix">' +
      '<button type="button" role="radio" data-smp-voix="0">Samples</button>' +
      '<button type="button" role="radio" data-smp-voix="1">Samples + voix</button></div>' +
      '<ol class="smp-list" data-smp-list></ol>' +
      "</div></div>";
    document.body.appendChild(sheet);
    sheet.addEventListener("click", onSheetClick);
    return sheet;
  }
  function frame() {
    return sheet && $("[data-smp-frame]", sheet);
  }
  function send(func, args) {
    var f = frame();
    if (!f || !f.contentWindow || !st.ready) return;
    try {
      f.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: args || [] }), ORIGIN);
    } catch (_e) {}
  }
  function embed(id) {
    var p = new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      origin: window.location.origin
    });
    return ORIGIN + "/embed/" + encodeURIComponent(id) + "?" + p.toString();
  }
  function open(list, title, mode, album) {
    buildSheet();
    st.list = list;
    st.title = title;
    st.mode = mode;
    st.album = album || null;
    var first = shown()[0];
    if (!first && !st.voix) {
      st.voix = true; // album sans sample instrumental : on montre ses voix
      first = shown()[0];
    }
    if (!first) return;
    sheet.hidden = false;
    document.documentElement.classList.add("smp-open");
    requestAnimationFrame(function () {
      sheet.classList.add("on");
    });
    play(first, true);
    track("samples_open", { mode: mode, n: shown().length });
    var x = $("[data-smp-close]", sheet);
    if (x) x.focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    var f = frame();
    if (f) f.removeAttribute("src");
    st.ready = false;
    st.pos = -1;
    sheet.classList.remove("on");
    sheet.hidden = true;
    document.documentElement.classList.remove("smp-open");
  }
  function play(item, fresh) {
    var f = frame();
    if (!f || !item) return;
    st.pos = st.list.indexOf(item);
    if (fresh || !st.ready) {
      st.ready = false;
      f.src = embed(item.y);
    } else send("loadVideoById", [item.y]);
    paint(fresh);
  }
  function step(d) {
    var list = shown();
    var cur = list.indexOf(st.list[st.pos]);
    var next = list[cur + d];
    if (!next && d > 0) return; // fin de la playlist
    if (next) play(next);
  }
  function who(i) {
    return [i.a, i.an].filter(Boolean).join(" · ");
  }
  function paint(top) {
    if (!sheet) return;
    var cur = st.list[st.pos];
    $("[data-smp-kicker]", sheet).textContent = "Samples · " + st.title;
    $("[data-smp-t]", sheet).textContent = cur ? cur.t : "";
    $("[data-smp-a]", sheet).textContent = cur
      ? who(cur) + (cur.v ? (who(cur) ? " · " : "") + "voix" : "")
      : "";
    $("[data-smp-from]", sheet).innerHTML = cur
      ? "samplé dans <b>" + esc(cur.track) + "</b>" + (st.mode === "album" ? "" : " · " + esc(cur.album))
      : "";
    Array.prototype.forEach.call(sheet.querySelectorAll("[data-smp-voix]"), function (b) {
      b.setAttribute("aria-checked", String((b.getAttribute("data-smp-voix") === "1") === st.voix));
    });
    var list = shown(),
      html = "",
      group = null;
    list.forEach(function (i) {
      var idx = st.list.indexOf(i);
      if (st.mode === "album" && i.track !== group) {
        group = i.track;
        html += '<li class="smp-grp" aria-hidden="true">' + (i.n ? i.n + ". " : "") + esc(i.track) + "</li>";
      }
      html +=
        '<li><button type="button" class="smp-row' +
        (idx === st.pos ? " on" : "") +
        '" data-smp-i="' +
        idx +
        '"' +
        (idx === st.pos ? ' aria-current="true"' : "") +
        '><img src="https://i.ytimg.com/vi/' +
        esc(i.y) +
        '/mqdefault.jpg" alt="" loading="lazy" decoding="async"><span><b dir="auto">' +
        esc(i.t) +
        '</b><small dir="auto">' +
        esc(
          (st.mode === "album" ? who(i) : [i.a, i.track].filter(Boolean).join(" · ")) + (i.v ? " · voix" : "")
        ) +
        "</small></span></button></li>";
    });
    $("[data-smp-list]", sheet).innerHTML = html;
    var from = Math.max(0, list.indexOf(cur));
    var ids = list.slice(from, from + 50).map(function (i) {
      return i.y;
    });
    $("[data-smp-yt]", sheet).href = "https://www.youtube.com/watch_videos?video_ids=" + ids.join(",");
    var scroller = $(".smp-scroll", sheet),
      on = $(".smp-row.on", sheet);
    if (top)
      scroller.scrollTop = 0; // à l'ouverture : la vidéo en haut, visible
    else if (on && typeof on.scrollIntoView === "function") on.scrollIntoView({ block: "nearest" });
  }
  function onSheetClick(e) {
    var t = e.target;
    if (t === sheet || (t.closest && t.closest("[data-smp-close]"))) return close();
    var row = t.closest && t.closest("[data-smp-i]");
    if (row) return play(st.list[Number(row.getAttribute("data-smp-i"))]);
    if (t.closest && t.closest("[data-smp-prev]")) return step(-1);
    if (t.closest && t.closest("[data-smp-next]")) return step(1);
    var v = t.closest && t.closest("[data-smp-voix]");
    if (v) {
      st.voix = v.getAttribute("data-smp-voix") === "1";
      try {
        localStorage.setItem("infra-samples-voix", st.voix ? "1" : "0");
      } catch (_e) {}
      var cur = st.list[st.pos];
      if (cur && cur.v && !st.voix) {
        var next = shown()[0];
        if (next) play(next);
        else paint();
      } else paint();
    }
  }

  // Messages du lecteur YouTube : prêt, fin d'un sample (suivant), sample indisponible (suivant).
  window.addEventListener("message", function (e) {
    if (!sheet || sheet.hidden || e.origin !== ORIGIN) return;
    var f = frame();
    if (!f || e.source !== f.contentWindow) return;
    var m;
    try {
      m = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch (_e) {
      return;
    }
    if (!m || !m.event) return;
    if (m.event === "onReady" || m.event === "initialDelivery") st.ready = true;
    var state =
      m.info && typeof m.info === "object"
        ? m.info.playerState
        : m.event === "onStateChange"
          ? m.info
          : undefined;
    if (state === 1) pauseMusic();
    if (state === 0) step(1);
    if (m.event === "onError") {
      track("samples_unavailable", {});
      step(1);
    }
  });
  function listen() {
    var f = frame();
    if (!f || !f.contentWindow) return;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({ event: "listening", id: "infra-samples", channel: "widget" }),
        ORIGIN
      );
    } catch (_e) {}
  }
  document.addEventListener(
    "load",
    function (e) {
      if (e.target && e.target === frame()) {
        listen();
        setTimeout(listen, 400);
        setTimeout(listen, 1500);
      }
    },
    true
  );
  function pauseMusic() {
    var toggle = $(".global-transport.is-playing [data-transport-toggle]");
    if (toggle && typeof toggle.click === "function") toggle.click();
  }
  // La musique INFRA repart : le sample se met en pause.
  document.addEventListener(
    "play",
    function (e) {
      if (e.target && e.target.tagName === "AUDIO" && sheet && !sheet.hidden) send("pauseVideo");
    },
    true
  );
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Escape" && sheet && !sheet.hidden) {
        e.stopPropagation();
        close();
      }
    },
    true
  );

  // Clics dans l'onglet Samples
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !data) return;
    var mix = t.closest("[data-smp-mix]");
    if (mix) {
      var voix = mix.getAttribute("data-smp-mix") === "1";
      st.voix = voix;
      var list = shuffle(
        all().filter(function (i) {
          return voix || !i.v;
        })
      );
      return open(list, voix ? "Samples + voix, mélangés" : "Samples, mélangés", "mix");
    }
    var al = t.closest("[data-smp-album]");
    if (al) {
      var a = data.albums[Number(al.getAttribute("data-smp-album"))];
      if (a) open(a.items.slice(), a.title, "album", a);
    }
  });

  // Afficher les samples d'un morceau (avec les voix), pour le futur clic droit › Afficher les samples.
  function openTrack(albumTitle, trackTitle) {
    return load().then(function () {
      var a = data.albums.filter(function (x) {
        return x.title === albumTitle;
      })[0];
      if (!a) return false;
      var items = a.items.filter(function (i) {
        return i.track === trackTitle;
      });
      if (!items.length) return false;
      st.voix = true;
      open(items, trackTitle, "album", a);
      return true;
    });
  }

  window.InfraSamples = { render: render, load: load, openTrack: openTrack, close: close };
})();
