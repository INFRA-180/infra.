// Section Samples (maquette Samples v2, validée par INFRA le 18/11/2026 :
// INVENTAIRE_SAMPLES/MAQUETTE_SAMPLES_V2_20261118.html).
// Onglet « Samples » de la bibliothèque : deux playlists mélangées (samples seuls ; samples + voix),
// puis les albums, chacun = la playlist de ses samples. Le lecteur YouTube enchaîne les samples
// lui-même (messages de l'iframe, sans script externe) ; la musique INFRA se met en pause pendant
// un sample, et le sample se met en pause quand la musique repart.
// « Sample → morceau » (demande INFRA, 19/11/2026) : le passage du sample qu'INFRA a pris (lu dans le projet
// Ableton), une transition, puis son morceau à l'endroit où le sample entre, ~35 s, et ainsi de suite.
// Mode Mix (INFRA, 19/11/2026) : paires triées par tempo, le sample et le morceau se chevauchent 5 s
// (le morceau entre là où le sample sort), 1 minute de morceau, puis fondu croisé avec le sample suivant.
// Données : data/samples.json, fabriqué par INVENTAIRE_SAMPLES/_outils/publie.py (rien de privé).
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.InfraSamples) return;
  var scriptUrl = document.currentScript && document.currentScript.src;
  var ORIGIN = "https://www.youtube-nocookie.com";

  var data = null,
    loading = null;
  var st = {
    list: [],
    pos: -1,
    title: "",
    mode: "album",
    album: null,
    voix: false,
    duo: false,
    mix: false,
    ready: false
  };
  var duo = { phase: "", timers: [], item: null, end: 0, fading: false, outroUntil: 0 };
  var TRACK_SECONDS = 35,
    MIX_SECONDS = 60,
    OVERLAP = 5;
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
        var covers = {},
          srcs = {};
        ((res[1] && res[1].albums) || []).forEach(function (a) {
          covers[a.title] = a.cover;
          srcs[a.title] = {};
          (a.tracks || []).forEach(function (t) {
            srcs[a.title][t.title] = t.src;
          });
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
                album: a.title,
                cover: covers[a.title] || "",
                src: (srcs[a.title] || {})[t.title] || "",
                s0: Number(it.s0),
                s1: Number(it.s1),
                at: Number(it.at),
                dt: Number(it.dt) || 0,
                bpm: Array.isArray(it.bpm) ? it.bpm : null,
                tb: Number(it.tb) || 0
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
  function duoOk(i) {
    return !i.v && i.src && isFinite(i.s0) && isFinite(i.s1) && i.s1 > i.s0 && isFinite(i.at);
  }
  // Tempo ressenti : 140 et 70 BPM se mixent ensemble (demi-tempo), tout est ramené entre 70 et 140.
  function feel(i) {
    var b = i.tb || 0;
    if (!b) return 999;
    while (b < 70) b *= 2;
    while (b >= 140) b /= 2;
    return Math.round(b);
  }
  function byTempo(list) {
    return list
      .map(function (i, k) {
        return { i: i, k: k };
      })
      .sort(function (a, b) {
        return feel(a.i) - feel(b.i) || a.k - b.k;
      })
      .map(function (x) {
        return x.i;
      });
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
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12h1.5M7 8v8M10.5 5v14M14 9v6M17.5 7v10M21 12h0"/></svg>';
  var VOICE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  var DUO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="6" opacity=".45"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/></svg>';
  var MIX =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M12 12c-2.2-3-3.8-4.5-5.8-4.5a4.5 4.5 0 0 0 0 9c2 0 3.6-1.5 5.8-4.5s3.8-4.5 5.8-4.5a4.5 4.5 0 0 1 0 9c-2 0-3.6-1.5-5.8-4.5Z"/></svg>';
  function mixLine(k, icon, title, sub) {
    return (
      '<button type="button" class="smp-mixbtn' +
      " smp-red" +
      '" data-smp-mix="' +
      k +
      '">' +
      icon +
      "<span><b>" +
      esc(title) +
      "</b><small>" +
      esc(sub) +
      "</small></span></button>"
    );
  }
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
      mixLine(0, SHUFFLE, "Samples", count(everything, false) + " samples, sans les voix") +
      mixLine(1, VOICE, "Samples + voix", count(everything, true) + " sons, avec les voix") +
      mixLine(
        2,
        DUO,
        "Sample → morceau",
        everything.filter(duoOk).length + " paires : le sample, puis ton morceau"
      ) +
      mixLine(3, MIX, "Mix", "rangé par BPM, fondus enchaînés, 1 minute de chaque morceau") +
      "</div>" +
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
      return st.duo ? duoOk(i) : st.voix || !i.v;
    });
  }
  function shownList() {
    var l = shown();
    return st.mix ? byTempo(l) : l;
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
      '<div class="smp-card" tabindex="-1">' +
      '<div class="smp-top"><span class="smp-kicker" data-smp-kicker></span>' +
      '<span class="smp-tools">' +
      '<a class="smp-ytic" data-smp-sp target="_blank" rel="noopener" aria-label="Chercher dans Spotify" title="Chercher ce sample dans Spotify">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M7 9.6c3.4-1 7.2-.7 10.2 1M7.6 12.6c2.8-.8 5.8-.5 8.3.9M8.3 15.4c2.2-.6 4.4-.3 6.4.7" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg></a>' +
      '<a class="smp-ytic" data-smp-am target="_blank" rel="noopener" aria-label="Chercher dans Apple Music" title="Chercher ce sample dans Apple Music">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor"/><path d="M10 16.3V8.2l6-1.4v7.9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8.6" cy="16.4" r="1.6" fill="#fff"/><circle cx="14.6" cy="14.8" r="1.6" fill="#fff"/></svg></a>' +
      '<a class="smp-ytic" data-smp-yt target="_blank" rel="noopener" aria-label="Ouvrir dans YouTube" title="Ouvrir dans YouTube">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg></a>' +
      '<button type="button" class="smp-x" data-smp-close aria-label="Fermer">✕</button></span></div>' +
      '<div class="smp-scroll">' +
      '<div class="smp-video"><iframe data-smp-frame title="Sample" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      '<div class="smp-bridge" data-smp-bridge hidden><img class="smp-bg" data-smp-bg alt=""><span class="smp-dot"></span>' +
      '<div class="smp-bt"><small data-smp-b1></small><b data-smp-b2 dir="auto"></b><small data-smp-b3></small>' +
      '<button type="button" class="smp-full" data-smp-full>Écouter tout le morceau</button></div><i class="smp-prog" data-smp-prog></i></div></div>' +
      '<div class="smp-now"><b data-smp-t dir="auto"></b><small data-smp-a dir="auto"></small><small class="smp-from" data-smp-from></small></div>' +
      '<div class="smp-ctr"><button type="button" data-smp-prev aria-label="Sample précédent"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>' +
      '<button type="button" data-smp-next aria-label="Sample suivant"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button></div>' +
      '<div class="smp-switch" role="radiogroup" aria-label="Voix">' +
      '<button type="button" role="radio" data-smp-voix="0">Samples</button>' +
      '<button type="button" role="radio" data-smp-voix="1">+ voix</button>' +
      '<button type="button" role="radio" data-smp-voix="2">→ morceau</button>' +
      '<button type="button" role="radio" data-smp-voix="3">Mix</button></div>' +
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
  function embed(id, item) {
    var p = new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      origin: window.location.origin
    });
    if (st.duo && item) {
      p.set("start", String(Math.floor(item.s0)));
      p.set("end", String(Math.ceil(item.s1)));
    }
    return ORIGIN + "/embed/" + encodeURIComponent(id) + "?" + p.toString();
  }
  function open(list, title, mode, album) {
    buildSheet();
    st.list = list;
    st.title = title;
    st.mode = mode;
    st.album = album || null;
    var first = shownList()[0];
    if (!first && st.duo) {
      st.duo = false;
      st.mix = false;
      first = shownList()[0];
    }
    if (!first && !st.voix) {
      st.voix = true; // album sans sample instrumental : on montre ses voix
      first = shownList()[0];
    }
    if (!first) return;
    sheet.hidden = false;
    document.documentElement.classList.add("smp-open");
    requestAnimationFrame(function () {
      sheet.classList.add("on");
    });
    play(first, true);
    track("samples_open", { mode: mode, n: shown().length });
    var card = $(".smp-card", sheet);
    if (card) card.focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    var f = frame();
    if (f) f.removeAttribute("src");
    stopDuo(true);
    st.ready = false;
    st.pos = -1;
    sheet.classList.remove("on");
    sheet.hidden = true;
    document.documentElement.classList.remove("smp-open");
  }
  function play(item, fresh, fadeIn) {
    var f = frame();
    if (!f || !item) return;
    stopDuo(!fadeIn && (duo.phase === "track" || duo.phase === "mixin"));
    if (fadeIn) {
      // fondu croisé : le morceau descend pendant que le sample monte, puis s'arrête
      duo.outroUntil = Date.now() + OVERLAP * 1000 + 1500;
      ramp(setAudioVolume, 1, 0.05, OVERLAP * 1000);
      later(
        function () {
          pauseMusic();
          setAudioVolume(1);
        },
        OVERLAP * 1000 + 100
      );
    }
    st.pos = st.list.indexOf(item);
    if (st.duo) {
      duo.phase = "sample";
      duo.item = item;
      duo.end = item.s1;
      duo.fading = false;
    }
    if (fresh || !st.ready) {
      st.ready = false;
      f.src = embed(item.y, item);
    } else if (st.duo) {
      setVideoVolume(fadeIn ? 0 : 100);
      send("loadVideoById", [{ videoId: item.y, startSeconds: item.s0, endSeconds: item.s1 }]);
      if (fadeIn) ramp(setVideoVolume, 0, 100, OVERLAP * 1000);
    } else send("loadVideoById", [item.y]);
    paint(fresh);
  }
  function step(d) {
    var list = shownList();
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
      ? "samplé dans <b>" +
        esc(cur.track) +
        "</b>" +
        (st.mode === "album" ? "" : " · " + esc(cur.album)) +
        (st.duo ? " · " + esc(transfo(cur) || "passage utilisé") : "")
      : "";
    Array.prototype.forEach.call(sheet.querySelectorAll("[data-smp-voix]"), function (b) {
      var k = b.getAttribute("data-smp-voix");
      b.setAttribute("aria-checked", String(k === (st.mix ? "3" : st.duo ? "2" : st.voix ? "1" : "0")));
    });
    var list = shownList(),
      html = "",
      group = null;
    list.forEach(function (i) {
      var idx = st.list.indexOf(i);
      if (st.mode === "album" && !st.mix && i.track !== group) {
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
          (st.mix
            ? [feel(i) < 999 ? feel(i) + " BPM" : "", i.track].filter(Boolean).join(" · ")
            : st.mode === "album"
              ? who(i)
              : [i.a, i.track].filter(Boolean).join(" · ")) + (i.v ? " · voix" : "")
        ) +
        "</small></span></button></li>";
    });
    $("[data-smp-list]", sheet).innerHTML = html;
    var from = Math.max(0, list.indexOf(cur));
    var ids = list.slice(from, from + 50).map(function (i) {
      return i.y;
    });
    $("[data-smp-yt]", sheet).href = "https://www.youtube.com/watch_videos?video_ids=" + ids.join(",");
    // Spotify et Apple Music : recherche du sample en cours (les vraies playlists Spotify viendront avec le Client ID).
    var q = cur ? encodeURIComponent([cur.a, cur.t].filter(Boolean).join(" ")) : "";
    $("[data-smp-sp]", sheet).href = "https://open.spotify.com/search/" + q;
    $("[data-smp-am]", sheet).href = "https://music.apple.com/search?term=" + q;
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
    if (t.closest && t.closest("[data-smp-full]")) return keepTrack();
    var v = t.closest && t.closest("[data-smp-voix]");
    if (v) {
      var k = v.getAttribute("data-smp-voix");
      var wasDuo = st.duo + "" + st.mix;
      st.mix = k === "3";
      st.duo = k === "2" || st.mix;
      st.voix = k === "1";
      if (st.duo) unlockAudio();
      try {
        localStorage.setItem("infra-samples-voix", st.voix ? "1" : "0");
      } catch (_e) {}
      var cur = st.list[st.pos];
      if (st.duo + "" + st.mix !== wasDuo) {
        var first = shownList().indexOf(cur) >= 0 && !st.mix ? cur : shownList()[0];
        if (first) play(first);
        else paint();
      } else if (cur && cur.v && !st.voix) {
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
    var inBridge = st.duo && (duo.phase === "bridge" || duo.phase === "track" || duo.phase === "mixin");
    var inOutro = Date.now() < duo.outroUntil;
    if (state === 1 && !inBridge && !inOutro) pauseMusic();
    if (st.duo && (duo.phase === "sample" || duo.phase === "mixin")) {
      var tm = m.info && typeof m.info === "object" ? Number(m.info.currentTime) : NaN;
      if (st.mix) {
        if (duo.phase === "sample" && isFinite(tm) && tm >= duo.end - OVERLAP) mixIn();
        if (duo.phase === "sample" && (state === 0 || (state === 2 && isFinite(tm) && tm >= duo.end - 0.6)))
          mixIn();
        return;
      }
      if (isFinite(tm) && tm >= duo.end - 1.6 && !duo.fading) fadeVideo();
      if (state === 0 || (state === 2 && isFinite(tm) && tm >= duo.end - 0.6)) return bridge();
    } else if (state === 0 && !inBridge) step(1);
    if (m.event === "onError") {
      track("samples_unavailable", {});
      if (!inBridge) step(1);
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
      if (e.target && e.target.tagName === "AUDIO" && sheet && !sheet.hidden && duo.phase !== "mixin")
        send("pauseVideo");
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

  // ---------- Sample → morceau ----------
  function later(fn, ms) {
    duo.timers.push(setTimeout(fn, ms));
  }
  function stopDuo(pauseTrack) {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    if (pauseTrack && (duo.phase === "track" || duo.phase === "mixin")) pauseMusic();
    duo.phase = "";
    duo.outroUntil = 0;
    var b = sheet && $("[data-smp-bridge]", sheet);
    if (b) {
      b.hidden = true;
      b.classList.remove("in", "track", "full");
    }
    var a = audioEl();
    if (a && a.volume < 1) a.volume = 1;
  }
  function audioEl() {
    return document.querySelector("audio");
  }
  function transfo(i) {
    var out = [];
    if (i.dt)
      out.push((i.dt > 0 ? "+" : "−") + Math.abs(i.dt) + " demi-ton" + (Math.abs(i.dt) > 1 ? "s" : ""));
    if (i.bpm) out.push(i.bpm[0] + " → " + i.bpm[1] + " BPM");
    return out.join(" · ");
  }
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  // Fondu de sortie du sample (volume YouTube, 1,5 s).
  function fadeVideo() {
    duo.fading = true;
    [80, 60, 40, 25, 12, 4].forEach(function (v, k) {
      later(function () {
        send("setVolume", [v]);
      }, k * 250);
    });
  }
  // Transition : la pochette du morceau INFRA monte par-dessus la vidéo, le point rouge s'ouvre,
  // puis le morceau démarre là où le sample entre.
  function bridge() {
    if (duo.phase !== "sample") return;
    var i = duo.item;
    duo.phase = "bridge";
    send("pauseVideo");
    send("setVolume", [100]);
    var b = $("[data-smp-bridge]", sheet);
    $("[data-smp-bg]", sheet).src = assetUrl(i.cover);
    $("[data-smp-b1]", sheet).textContent = i.t + " →";
    $("[data-smp-b2]", sheet).textContent = i.track;
    $("[data-smp-b3]", sheet).textContent = [i.album, transfo(i)].filter(Boolean).join(" · ");
    b.classList.remove("track", "full");
    b.hidden = false;
    requestAnimationFrame(function () {
      b.classList.add("in");
    });
    track("samples_duo_bridge", {});
    later(function () {
      startTrack(i);
    }, 900);
  }
  function startTrack(i, mixFrom) {
    var lib = window.InfraLibraryPlayback;
    if (!lib || typeof lib.playPaths !== "function" || !i.src) return step(1);
    duo.phase = mixFrom != null ? "mixin" : "track";
    var from = mixFrom != null ? mixFrom : Math.max(0, i.at - 1);
    var seconds = st.mix ? MIX_SECONDS : TRACK_SECONDS;
    var a = audioEl();
    var seek = function () {
      var el = audioEl();
      if (el && (duo.phase === "track" || duo.phase === "mixin") && Math.abs(el.currentTime - from) > 2) {
        try {
          el.currentTime = from;
        } catch (_e) {}
      }
    };
    var onPlaying = function () {
      seek();
      if (a) a.removeEventListener("playing", onPlaying);
    };
    if (a) a.addEventListener("playing", onPlaying);
    if (!lib.playPaths([i.src], 0)) return step(1);
    later(seek, 1200);
    var b = $("[data-smp-bridge]", sheet);
    b.classList.add("track");
    $("[data-smp-b1]", sheet).textContent = st.mix
      ? "Mix · " + (feel(i) < 999 ? feel(i) + " BPM · " : "") + "le sample entre à " + mmss(i.at)
      : "Ton morceau · à " + mmss(i.at) + ", là où le sample entre";
    var prog = $("[data-smp-prog]", sheet);
    prog.style.animationDuration = seconds + "s";
    if (st.mix) {
      later(mixOut, seconds * 1000);
      return;
    }
    later(function () {
      var el = audioEl();
      if (el) {
        [0.75, 0.5, 0.3, 0.12].forEach(function (v, k) {
          later(function () {
            try {
              el.volume = v;
            } catch (_e) {}
          }, k * 300);
        });
      }
      later(function () {
        pauseMusic();
        var el2 = audioEl();
        if (el2) el2.volume = 1;
        duo.phase = "";
        step(1);
      }, 1300);
    }, seconds * 1000);
  }
  // Mix : le morceau INFRA entre pendant que le sample sort, calé pour que le sample y arrive pile
  // quand l'extrait YouTube se termine.
  function ramp(set, from, to, ms) {
    var n = 10;
    for (var k = 1; k <= n; k++) {
      (function (k) {
        later(
          function () {
            set(from + ((to - from) * k) / n);
          },
          (ms * k) / n
        );
      })(k);
    }
  }
  function setAudioVolume(v) {
    var el = audioEl();
    if (el)
      try {
        el.volume = Math.max(0, Math.min(1, v));
      } catch (_e) {}
  }
  function setVideoVolume(v) {
    send("setVolume", [Math.round(v)]);
  }
  function mixIn() {
    if (duo.phase !== "sample") return;
    var i = duo.item;
    var b = $("[data-smp-bridge]", sheet);
    $("[data-smp-bg]", sheet).src = assetUrl(i.cover);
    $("[data-smp-b2]", sheet).textContent = i.track;
    $("[data-smp-b3]", sheet).textContent = [i.album, transfo(i)].filter(Boolean).join(" · ");
    b.classList.remove("track", "full");
    b.classList.add("slow");
    b.hidden = false;
    requestAnimationFrame(function () {
      b.classList.add("in");
    });
    setAudioVolume(0.15);
    startTrack(i, Math.max(0, i.at - OVERLAP));
    ramp(setAudioVolume, 0.15, 1, OVERLAP * 1000);
    ramp(setVideoVolume, 100, 0, OVERLAP * 1000);
    later(
      function () {
        send("pauseVideo");
        setVideoVolume(100);
        if (duo.phase === "mixin") duo.phase = "track";
        b.classList.remove("slow");
      },
      OVERLAP * 1000 + 200
    );
    track("samples_mix_in", { bpm: feel(i) });
  }
  // Fin de la minute : le sample suivant monte pendant que le morceau descend, puis s'arrête.
  function mixOut() {
    var list = shownList();
    var next = list[list.indexOf(st.list[st.pos]) + 1];
    if (!next) {
      ramp(setAudioVolume, 1, 0, 3000);
      later(function () {
        pauseMusic();
        setAudioVolume(1);
      }, 3200);
      return;
    }
    play(next, false, true);
  }
  function keepTrack() {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    var el = audioEl();
    if (el) el.volume = 1;
    var b = $("[data-smp-bridge]", sheet);
    if (b) b.classList.add("full");
    track("samples_duo_full", {});
  }
  // iPhone : le lecteur INFRA doit avoir été touché pendant le geste pour pouvoir repartir seul ensuite.
  function unlockAudio() {
    var a = audioEl();
    if (!a || !a.paused || !a.currentSrc) return;
    try {
      a.muted = true;
      var p = a.play();
      var undo = function () {
        a.pause();
        a.muted = false;
      };
      if (p && typeof p.then === "function")
        p.then(undo, function () {
          a.muted = false;
        });
      else undo();
    } catch (_e) {
      a.muted = false;
    }
  }

  // Clics dans l'onglet Samples
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !data) return;
    var mix = t.closest("[data-smp-mix]");
    if (mix) {
      var kind = mix.getAttribute("data-smp-mix");
      var voix = kind === "1";
      st.voix = voix;
      st.mix = kind === "3";
      st.duo = kind === "2" || st.mix;
      if (st.duo) unlockAudio();
      var list = shuffle(
        all().filter(function (i) {
          return st.duo ? duoOk(i) : voix || !i.v;
        })
      );
      return open(
        list,
        st.mix
          ? "Mix"
          : st.duo
            ? "Sample → morceau"
            : voix
              ? "Samples + voix, mélangés"
              : "Samples, mélangés",
        "mix"
      );
    }
    var al = t.closest("[data-smp-album]");
    if (al) {
      var a = data.albums[Number(al.getAttribute("data-smp-album"))];
      st.duo = false;
      st.mix = false;
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
      st.duo = false;
      st.mix = false;
      open(items, trackTitle, "album", a);
      return true;
    });
  }

  window.InfraSamples = { render: render, load: load, openTrack: openTrack, close: close };
})();
