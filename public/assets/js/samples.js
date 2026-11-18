// Section Samples (maquette Samples v2 validée le 18/11/2026, puis maquette « Samples et Mix » V1 validée le
// 19/11/2026 : DOCS/maquettes/MAQUETTE_SAMPLES_MIX_V1_20261119.html).
// Onglet « Samples » de la bibliothèque, deux sections :
// - Samples : les morceaux d'origine (vidéos YouTube) en simple playlist ; voix (a cappella) en option.
// - Mix : le passage samplé par INFRA (lu dans le projet Ableton), puis son morceau là où le sample entre :
//   5 s de chevauchement, 1 minute de morceau, puis fondu croisé avec le sample suivant.
// Lecteur simple : titre de ce qu'on entend en haut, une vraie barre (sample | morceau), précédent ·
// lecture/pause · suivant, pictos sans rond ni carré (INFRA, 19/11). Ordre au choix partout : par BPM,
// aléatoire ou dans l'ordre des morceaux (picto à côté de « Tout » et à droite du titre), retenu par écran.
// Le lecteur YouTube est piloté par messages de l'iframe (sans script externe) ; la musique INFRA se met en
// pause pendant un sample, et inversement.
// Données : data/samples.json, fabriqué par INVENTAIRE_SAMPLES/_outils/publie.py (rien de privé).
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.InfraSamples) return;
  var scriptUrl = document.currentScript && document.currentScript.src;
  var ORIGIN = "https://www.youtube-nocookie.com";

  var data = null,
    loading = null,
    lastPanel = null;
  var st = {
    list: [],
    shuf: [],
    pos: -1,
    title: "",
    scope: "all",
    album: null,
    mix: false,
    voix: false,
    sort: "shuffle",
    ready: false,
    drag: null,
  };
  var yt = { state: -1, time: 0, dur: 0 };
  var duo = {
    phase: "",
    timers: [],
    out: 0,
    item: null,
    end: 0,
    outroUntil: 0,
    from: 0,
  };
  var TRACK = 60,
    OVERLAP = 5,
    SORTS = ["bpm", "shuffle", "album"],
    ticker = 0;
  var pref = { sec: "samples", voix: false, sort: {} };
  try {
    var saved = JSON.parse(localStorage.getItem("infra-samples") || "null");
    if (saved && typeof saved === "object") {
      if (saved.sec === "mix" || saved.sec === "samples") pref.sec = saved.sec;
      pref.voix = saved.voix === true;
      if (saved.sort && typeof saved.sort === "object") pref.sort = saved.sort;
    } else pref.voix = localStorage.getItem("infra-samples-voix") === "1";
  } catch (_e) {}
  function save() {
    try {
      localStorage.setItem("infra-samples", JSON.stringify(pref));
    } catch (_e) {}
  }
  function sortFor(mix, scope) {
    var v = pref.sort[(mix ? "mix-" : "smp-") + scope];
    if (SORTS.indexOf(v) >= 0) return v;
    return scope === "all" ? (mix ? "bpm" : "shuffle") : "album";
  }
  function setSort(mix, scope, v) {
    pref.sort[(mix ? "mix-" : "smp-") + scope] = v;
    save();
  }
  function nextSort(v) {
    return SORTS[(SORTS.indexOf(v) + 1) % SORTS.length];
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function dataUrl(name) {
    var u = scriptUrl
      ? new URL("../../data/" + name, scriptUrl)
      : new URL("data/" + name, document.baseURI);
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
    return fetch(dataUrl(name), { credentials: "same-origin" }).then(
      function (r) {
        if (!r.ok) throw new Error(name + " " + r.status);
        return r.json();
      },
    );
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = Promise.all([
      getJson("samples.json"),
      getJson("tracks.json").catch(function () {
        return null;
      }),
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
                tb: Number(it.tb) || 0,
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
  function duoOk(i) {
    return (
      !i.v &&
      i.src &&
      isFinite(i.s0) &&
      isFinite(i.s1) &&
      i.s1 > i.s0 &&
      isFinite(i.at)
    );
  }
  function keep(mix, voix) {
    return function (i) {
      return mix ? duoOk(i) : voix || !i.v;
    };
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
      if (typeof window.InfraTrackEvent === "function")
        window.InfraTrackEvent(name, extra || {});
    } catch (_e) {}
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function mmss(s) {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function transfo(i) {
    var out = [];
    if (i.dt)
      out.push(
        (i.dt > 0 ? "+" : "−") +
          Math.abs(i.dt) +
          " demi-ton" +
          (Math.abs(i.dt) > 1 ? "s" : ""),
      );
    if (i.bpm) out.push(i.bpm[0] + " → " + i.bpm[1] + " BPM");
    return out.join(" · ");
  }
  function who(i) {
    return [i.a, i.an].filter(Boolean).join(" · ");
  }

  // ---------- Pictos (sans rond ni carré derrière) ----------
  function svg(body, extra) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"' +
      (extra || "") +
      ">" +
      body +
      "</svg>"
    );
  }
  var LINE =
    ' fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  var PLAY = svg('<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>');
  var PAUSE = svg(
    '<path fill="currentColor" d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>',
  );
  var PREV = svg('<path fill="currentColor" d="M6 5h2v14H6zM20 5v14L9 12z"/>');
  var NEXT = svg('<path fill="currentColor" d="M16 5h2v14h-2zM4 5v14l11-7z"/>');
  var VOICE = svg(
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    LINE,
  );
  var SORT_ICON = {
    bpm: svg(
      '<path d="M9.2 3.5h5.6L19 20.5H5z"/><path d="M12 15.5l5-9M8 15.5h8"/>',
      LINE,
    ),
    shuffle: svg(
      '<path d="M3 7h3.2c1.9 0 3 .9 4.2 2.8l2.4 4.4c1.2 1.9 2.3 2.8 4.2 2.8H21M18 14l3 3-3 3M3 17h3.2c1.4 0 2.4-.5 3.3-1.5M14.5 8.5c.9-1 1.9-1.5 3.3-1.5H21M18 4l3 3-3 3"/>',
      LINE,
    ),
    album: svg(
      '<path d="M9 6h12M9 12h12M9 18h12M3 6h2.5M3 12h2.5M3 18h2.5"/>',
      LINE,
    ),
  };
  var SORT_LABEL = {
    bpm: "Par BPM",
    shuffle: "Aléatoire",
    album: "Dans l'ordre des morceaux",
  };
  function sortBtn(sort, attr) {
    return (
      '<button type="button" class="sx-ic" ' +
      attr +
      ' title="Ordre : ' +
      SORT_LABEL[sort] +
      ' (toucher pour changer)" aria-label="Ordre : ' +
      SORT_LABEL[sort] +
      '">' +
      SORT_ICON[sort] +
      "</button>"
    );
  }

  // ---------- Styles (dans ce fichier : styles.css est figé par empreinte) ----------
  function injectCss() {
    if (document.getElementById("sx-style")) return;
    var s = document.createElement("style");
    s.id = "sx-style";
    s.textContent = [
      ".sx-sec{display:flex;gap:28px;align-items:baseline;margin:4px 0 6px}",
      ".sx-sec button{border:0;background:none;padding:0;cursor:pointer;font:inherit;font-size:34px;font-weight:800;letter-spacing:-.02em;color:rgba(17,17,17,.22);transition:color .2s}",
      '.sx-sec button[aria-selected="true"]{color:var(--ink,#111)}',
      "@media (max-width:639px){.sx-sec button{font-size:28px}}",
      ".sx-sub{font-size:13px;color:rgba(17,17,17,.5);margin:0 0 10px}",
      ".sx-allrow{display:flex;align-items:center;gap:4px;margin-bottom:16px}",
      ".sx-all{display:flex;align-items:center;gap:12px;min-height:58px;padding:6px 8px 6px 0;border:0;background:none;font:inherit;color:var(--ink,#111);text-align:left;cursor:pointer}",
      ".sx-allic{display:grid;place-items:center;width:28px;height:28px;color:#e0353b;transition:transform .2s}",
      ".sx-allic svg{width:28px;height:28px}",
      ".sx-all:hover .sx-allic,.sx-all:focus-visible .sx-allic{transform:scale(1.12)}",
      ".sx-all b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}",
      ".sx-all small{display:block;font-size:12px;color:rgba(17,17,17,.45)}",
      ".sx-ic{width:40px;height:40px;border:0;background:none;padding:0;display:grid;place-items:center;color:rgba(17,17,17,.42);cursor:pointer;flex:none}",
      ".sx-ic svg{width:22px;height:22px}",
      ".sx-ic:hover,.sx-ic:focus-visible,.sx-ic.on{color:#e0353b}",
      ".smp-al .smp-play{background:none;color:#fff;width:auto;height:auto;filter:drop-shadow(0 1px 4px rgba(0,0,0,.7))}",
      ".smp-al .smp-play svg{width:24px;height:24px;margin:0}",
      ".sx-card{max-width:440px}",
      ".sx-art{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;background:#000;margin-top:4px}",
      ".sx-vid{position:absolute;inset:0;overflow:hidden}",
      ".sx-vid iframe{position:absolute;top:0;left:50%;height:100%;width:177.78%;transform:translateX(-50%);border:0;display:block}",
      ".sx-cov{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;pointer-events:none;transition:opacity 1.4s ease}",
      ".sx-cov.on{opacity:1;pointer-events:auto}",
      ".sx-now{margin-top:16px}",
      ".sx-tr{display:flex;align-items:center;gap:8px}",
      ".sx-tr b{flex:1;min-width:0;font-size:22px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".sx-tr .sx-ic{margin-right:-9px}",
      ".sx-now small{display:block;font-size:14px;color:rgba(17,17,17,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".sx-bar{position:relative;height:28px;margin-top:10px;cursor:pointer;touch-action:none}",
      ".sx-trk{position:absolute;left:0;right:0;top:12px;height:4px;display:flex;gap:3px}",
      ".sx-seg{position:relative;height:100%;background:rgba(17,17,17,.1);overflow:hidden}",
      ".sx-seg i{position:absolute;left:0;top:0;bottom:0;width:0;background:#111}",
      ".sx-seg.s i{background:#e0353b}",
      ".sx-knob{position:absolute;top:6px;left:0;width:3px;height:16px;margin-left:-1.5px;background:#111;pointer-events:none}",
      ".sx-times{display:flex;justify-content:space-between;font-size:12px;color:rgba(17,17,17,.5);font-variant-numeric:tabular-nums}",
      ".sx-leg{display:flex;gap:3px;margin-top:4px;font-size:12px}",
      ".sx-leg span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:rgba(17,17,17,.35)}",
      ".sx-leg span.on{color:#111;font-weight:700}",
      ".sx-leg span.s.on{color:#e0353b}",
      ".sx-ctr{display:flex;justify-content:center;align-items:center;gap:44px;margin:10px 0 6px}",
      ".sx-ctr button{width:56px;height:56px;border:0;background:none;padding:0;color:#111;cursor:pointer;display:grid;place-items:center;transition:transform .12s}",
      ".sx-ctr button svg{width:28px;height:28px}",
      ".sx-ctr .sx-pp svg{width:46px;height:46px}",
      ".sx-ctr button:active{transform:scale(.9)}",
      ".sx-h{font-size:12px;font-weight:600;color:rgba(17,17,17,.45);margin:14px 0 2px}",
      ".sx-card .smp-row img{width:40px;height:40px;border-radius:6px}",
      ".sx-card .smp-row em{font-style:normal;font-size:12px;color:rgba(17,17,17,.45);font-variant-numeric:tabular-nums;flex:none}",
      "@media (prefers-reduced-motion:reduce){.sx-cov,.sx-allic,.sx-ctr button{transition:none}}",
    ].join("\n");
    document.head.appendChild(s);
  }

  // ---------- Page (onglet Samples) ----------
  function render(panel) {
    if (!panel) return;
    lastPanel = panel;
    injectCss();
    if (!data) {
      panel.innerHTML = '<p class="bib-empty">Chargement…</p>';
      load()
        .then(function () {
          if (document.body.getAttribute("data-bib-view") === "samples")
            render(panel);
        })
        .catch(function () {
          panel.innerHTML =
            '<p class="bib-empty">Les samples n\'ont pas pu être chargés.</p>';
        });
      return;
    }
    var mix = pref.sec === "mix";
    var pool = all().filter(keep(mix, pref.voix));
    var html =
      '<div class="sx-sec" role="tablist" aria-label="Samples ou Mix">' +
      '<button type="button" role="tab" data-smp-sec="samples" aria-selected="' +
      !mix +
      '">Samples</button>' +
      '<button type="button" role="tab" data-smp-sec="mix" aria-selected="' +
      mix +
      '">Mix</button></div>' +
      '<p class="sx-sub">' +
      (mix
        ? "Le passage samplé, puis ton morceau là où il entre."
        : "Les morceaux d'origine, en playlist.") +
      "</p>" +
      '<div class="sx-allrow"><button type="button" class="sx-all" data-smp-all><span class="sx-allic">' +
      PLAY +
      "</span><span><b>" +
      (mix ? "Tout le Mix" : "Tous les samples") +
      "</b><small>" +
      pool.length +
      (mix
        ? " enchaînements"
        : pref.voix
          ? " sons, avec les voix"
          : " samples") +
      "</small></span></button>" +
      sortBtn(sortFor(mix, "all"), "data-smp-allsort") +
      (mix
        ? ""
        : '<button type="button" class="sx-ic' +
          (pref.voix ? " on" : "") +
          '" data-smp-voixbtn aria-pressed="' +
          pref.voix +
          '" title="' +
          (pref.voix ? "Avec les voix (a cappella)" : "Sans les voix") +
          '" aria-label="Voix (a cappella)">' +
          VOICE +
          "</button>") +
      "</div>" +
      '<ul class="smp-grid">' +
      data.albums
        .map(function (a, i) {
          var n = a.items.filter(keep(mix, pref.voix)).length;
          if (mix && !n) return "";
          var label = mix
            ? n + (n > 1 ? " enchaînements" : " enchaînement")
            : n
              ? n + (n > 1 ? " samples" : " sample")
              : a.items.length + " voix";
          return (
            '<li><button type="button" class="smp-al" data-smp-album="' +
            i +
            '" aria-label="' +
            (mix ? "Mix de " : "Samples de ") +
            esc(a.title) +
            '"><span class="smp-cover"><img src="' +
            esc(assetUrl(a.cover)) +
            '" alt="" loading="lazy" decoding="async"><span class="smp-play">' +
            PLAY +
            '</span></span><b dir="auto">' +
            esc(a.title) +
            "</b><small>" +
            label +
            "</small></button></li>"
          );
        })
        .join("") +
      "</ul>";
    panel.innerHTML = html;
  }
  function rerender() {
    if (lastPanel && lastPanel.isConnected) render(lastPanel);
  }

  // ---------- Lecteur ----------
  var sheet = null;
  function shown() {
    return st.list.filter(keep(st.mix, st.voix));
  }
  function shownList() {
    var l = shown();
    if (st.sort === "bpm") return byTempo(l);
    if (st.sort === "shuffle")
      return st.shuf.filter(function (i) {
        return l.indexOf(i) >= 0;
      });
    return l;
  }
  // Nouvel ordre aléatoire, le son en cours en tête (« À suivre » reste juste).
  function reshuffle(first) {
    st.shuf = shuffle(st.list);
    if (first)
      st.shuf = [first].concat(
        st.shuf.filter(function (i) {
          return i !== first;
        }),
      );
  }
  function buildSheet() {
    if (sheet) return sheet;
    injectCss();
    sheet = document.createElement("div");
    sheet.className = "smp-sheet";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Lecteur de samples");
    sheet.innerHTML =
      '<div class="smp-card sx-card" tabindex="-1">' +
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
      '<div class="sx-art"><div class="sx-vid"><iframe data-smp-frame title="Sample" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<img class="sx-cov" data-smp-cov alt=""></div>' +
      '<div class="sx-now"><div class="sx-tr"><b data-smp-t dir="auto"></b><span data-smp-sortslot></span></div>' +
      '<small data-smp-a dir="auto"></small></div>' +
      '<div class="sx-bar" data-smp-bar role="slider" aria-label="Position" tabindex="0"><div class="sx-trk" data-smp-trk></div><i class="sx-knob" data-smp-knob></i></div>' +
      '<div class="sx-times"><span data-smp-t0>0:00</span><span data-smp-t1></span></div>' +
      '<div class="sx-leg" data-smp-leg></div>' +
      '<div class="sx-ctr"><button type="button" data-smp-prev aria-label="Précédent">' +
      PREV +
      '</button><button type="button" class="sx-pp" data-smp-pp aria-label="Lecture">' +
      PLAY +
      '</button><button type="button" data-smp-next aria-label="Suivant">' +
      NEXT +
      "</button></div>" +
      '<h4 class="sx-h">À suivre</h4>' +
      '<ol class="smp-list" data-smp-list></ol>' +
      "</div></div>";
    document.body.appendChild(sheet);
    sheet.addEventListener("click", onSheetClick);
    bindBar($("[data-smp-bar]", sheet));
    return sheet;
  }
  function frame() {
    return sheet && $("[data-smp-frame]", sheet);
  }
  function send(func, args) {
    var f = frame();
    if (!f || !f.contentWindow || !st.ready) return;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: args || [] }),
        ORIGIN,
      );
    } catch (_e) {}
  }
  function embed(id, item, start) {
    var p = new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    if (st.mix && item) {
      p.set("start", String(Math.floor(start)));
      p.set("end", String(Math.ceil(item.s1)));
    } else if (start) p.set("start", String(Math.floor(start)));
    return ORIGIN + "/embed/" + encodeURIComponent(id) + "?" + p.toString();
  }
  function open(list, title, scope, album, voix) {
    buildSheet();
    st.list = list;
    st.title = title;
    st.scope = scope;
    st.album = album || null;
    st.mix = pref.sec === "mix";
    st.voix = voix == null ? pref.voix : voix;
    st.sort = sortFor(st.mix, scope);
    reshuffle(null);
    var first = shownList()[0];
    if (!first && !st.voix && !st.mix) {
      st.voix = true; // album sans sample instrumental : on montre ses voix
      first = shownList()[0];
    }
    if (!first) return;
    if (st.mix) unlockAudio();
    sheet.hidden = false;
    document.documentElement.classList.add("smp-open");
    requestAnimationFrame(function () {
      sheet.classList.add("on");
    });
    play(first, true);
    clearInterval(ticker);
    ticker = setInterval(paintBar, 250);
    track("samples_open", {
      mode: st.mix ? "mix" : "samples",
      scope: scope,
      sort: st.sort,
      n: shown().length,
    });
    var card = $(".smp-card", sheet);
    if (card) card.focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    var f = frame();
    if (f) f.removeAttribute("src");
    stopDuo(true);
    clearInterval(ticker);
    st.ready = false;
    st.pos = -1;
    sheet.classList.remove("on");
    sheet.hidden = true;
    document.documentElement.classList.remove("smp-open");
  }
  function trackPhase() {
    return st.mix && (duo.phase === "track" || duo.phase === "mixin");
  }
  function play(item, fresh, fadeIn, offset) {
    var f = frame();
    if (!f || !item) return;
    stopDuo(!fadeIn && trackPhase());
    if (fadeIn) {
      // fondu croisé : le morceau descend pendant que le sample monte, puis s'arrête
      duo.outroUntil = Date.now() + OVERLAP * 1000 + 1500;
      ramp(setAudioVolume, 1, 0.05, OVERLAP * 1000);
      later(
        function () {
          pauseMusic();
          setAudioVolume(1);
        },
        OVERLAP * 1000 + 100,
      );
    }
    st.pos = st.list.indexOf(item);
    var start = (st.mix ? item.s0 : 0) + (offset || 0);
    if (st.mix) {
      duo.phase = "sample";
      duo.item = item;
      duo.end = item.s1;
    }
    yt.time = start;
    yt.dur = 0;
    yt.state = -1;
    if (fresh || !st.ready) {
      st.ready = false;
      f.src = embed(item.y, item, start);
    } else if (st.mix) {
      setVideoVolume(fadeIn ? 0 : 100);
      send("loadVideoById", [
        { videoId: item.y, startSeconds: start, endSeconds: item.s1 },
      ]);
      if (fadeIn) ramp(setVideoVolume, 0, 100, OVERLAP * 1000);
    } else if (offset)
      send("loadVideoById", [{ videoId: item.y, startSeconds: start }]);
    else send("loadVideoById", [item.y]);
    paint(fresh);
  }
  function step(d) {
    var list = shownList();
    var cur = list.indexOf(st.list[st.pos]);
    var next = list[cur + d];
    if (!next && d > 0) return; // fin de la playlist
    if (next) play(next);
  }
  // Précédent : revient au début du son en cours s'il a joué plus de 3 s, sinon son précédent.
  function prev() {
    var b = barState();
    if (b && b.t > 3) return seekTo(0);
    step(-1);
  }

  function paint(top) {
    if (!sheet) return;
    var cur = st.list[st.pos];
    if (!cur) return;
    $("[data-smp-kicker]", sheet).textContent =
      (st.mix ? "Mix · " : "Samples · ") + st.title;
    $("[data-smp-sortslot]", sheet).innerHTML = sortBtn(
      st.sort,
      "data-smp-sort",
    );
    $("[data-smp-cov]", sheet).src = assetUrl(cur.cover);
    // barre : un segment (Samples) ou deux (Mix : sample | morceau)
    var S = Math.max(1, cur.s1 - cur.s0);
    $("[data-smp-trk]", sheet).innerHTML = st.mix
      ? '<div class="sx-seg s" style="flex:' +
        S +
        '"><i></i></div><div class="sx-seg" style="flex:' +
        TRACK +
        '"><i></i></div>'
      : '<div class="sx-seg s" style="flex:1"><i></i></div>';
    $("[data-smp-leg]", sheet).innerHTML = st.mix
      ? '<span class="s" style="flex:' +
        S +
        '">Sample</span><span style="flex:' +
        TRACK +
        '" dir="auto">' +
        esc(cur.track) +
        "</span>"
      : "";
    var list = shownList(),
      html = "",
      group = null,
      grouped = st.scope === "album" && st.sort === "album" && !st.mix;
    list.forEach(function (i) {
      var idx = st.list.indexOf(i);
      if (grouped && i.track !== group) {
        group = i.track;
        html +=
          '<li class="smp-grp" aria-hidden="true">' +
          (i.n ? i.n + ". " : "") +
          esc(i.track) +
          "</li>";
      }
      var sub = st.mix
        ? [
            feel(i) < 999 ? feel(i) + " BPM" : "",
            st.scope === "album" ? "" : i.album,
            transfo(i),
          ]
        : [
            st.scope === "album" ? who(i) : i.a,
            st.scope === "album" ? "" : "samplé dans " + i.track,
          ];
      html +=
        '<li><button type="button" class="smp-row' +
        (idx === st.pos ? " on" : "") +
        '" data-smp-i="' +
        idx +
        '"' +
        (idx === st.pos ? ' aria-current="true"' : "") +
        '><img src="' +
        (st.mix
          ? esc(assetUrl(i.cover))
          : "https://i.ytimg.com/vi/" + esc(i.y) + "/mqdefault.jpg") +
        '" alt="" loading="lazy" decoding="async"><span><b dir="auto">' +
        esc(i.t) +
        (st.mix ? " → " + esc(i.track) : "") +
        '</b><small dir="auto">' +
        esc(sub.filter(Boolean).join(" · ") + (i.v ? " · voix" : "")) +
        "</small></span>" +
        (st.mix ? "<em>" + mmss(i.s1 - i.s0 + TRACK) + "</em>" : "") +
        "</button></li>";
    });
    $("[data-smp-list]", sheet).innerHTML = html;
    var from = Math.max(0, list.indexOf(cur));
    $("[data-smp-yt]", sheet).href = st.mix
      ? "https://www.youtube.com/watch?v=" +
        encodeURIComponent(cur.y) +
        "&t=" +
        Math.floor(cur.s0) +
        "s"
      : "https://www.youtube.com/watch_videos?video_ids=" +
        list
          .slice(from, from + 50)
          .map(function (i) {
            return i.y;
          })
          .join(",");
    // Spotify et Apple Music : recherche du sample en cours.
    var q = encodeURIComponent([cur.a, cur.t].filter(Boolean).join(" "));
    $("[data-smp-sp]", sheet).href = "https://open.spotify.com/search/" + q;
    $("[data-smp-am]", sheet).href = "https://music.apple.com/search?term=" + q;
    paintNow();
    var scroller = $(".smp-scroll", sheet),
      on = $(".smp-row.on", sheet);
    if (top) scroller.scrollTop = 0;
    else if (on && typeof on.scrollIntoView === "function")
      on.scrollIntoView({ block: "nearest" });
  }
  // En haut : ce qu'on entend (le sample, puis ton morceau).
  function paintNow() {
    var cur = st.list[st.pos];
    if (!sheet || !cur) return;
    var inTrack = trackPhase();
    $("[data-smp-t]", sheet).textContent = inTrack ? cur.track : cur.t;
    $("[data-smp-a]", sheet).textContent = inTrack
      ? ["INFRA", cur.album, transfo(cur)].filter(Boolean).join(" · ")
      : [
          who(cur) + (cur.v ? (who(cur) ? " · " : "") + "voix" : ""),
          "samplé dans " + cur.track,
        ]
          .filter(Boolean)
          .join(" · ");
    $("[data-smp-cov]", sheet).classList.toggle("on", inTrack);
    var leg = $("[data-smp-leg]", sheet).children;
    if (leg.length === 2) {
      leg[0].classList.toggle("on", !inTrack);
      leg[1].classList.toggle("on", inTrack);
    }
    paintBar();
  }
  function audioEl() {
    return document.querySelector("audio");
  }
  // Position dans la barre : t (secondes depuis le début du sample) sur T (durée totale).
  function barState() {
    var cur = st.list[st.pos];
    if (!cur) return null;
    if (!st.mix)
      return {
        S: 0,
        T: yt.dur || 0,
        t: yt.dur ? clamp(yt.time, 0, yt.dur) : 0,
      };
    var S = Math.max(1, cur.s1 - cur.s0),
      t;
    if (trackPhase()) {
      var a = audioEl();
      t = S + clamp(a ? a.currentTime - duo.from : 0, 0, TRACK);
    } else t = clamp(yt.time - cur.s0, 0, S);
    return { S: S, T: S + TRACK, t: t };
  }
  function isPlaying() {
    if (trackPhase()) {
      var a = audioEl();
      return !!(a && !a.paused);
    }
    return yt.state === 1 || yt.state === 3;
  }
  function paintBar() {
    if (!sheet || sheet.hidden) return;
    var b = barState();
    if (!b) return;
    var t = st.drag != null ? st.drag : b.t;
    var segs = sheet.querySelectorAll(".sx-seg i"),
      trk = $("[data-smp-trk]", sheet),
      w = trk.clientWidth,
      x = 0;
    if (st.mix && segs.length === 2) {
      segs[0].style.width = (clamp(t / b.S, 0, 1) * 100).toFixed(2) + "%";
      segs[1].style.width =
        (clamp((t - b.S) / TRACK, 0, 1) * 100).toFixed(2) + "%";
      var w1 = ((w - 3) * b.S) / b.T;
      x =
        t <= b.S ? (w1 * t) / b.S : w1 + 3 + ((w - 3 - w1) * (t - b.S)) / TRACK;
    } else if (segs.length) {
      segs[0].style.width = b.T ? ((t / b.T) * 100).toFixed(2) + "%" : "0";
      x = b.T ? (w * t) / b.T : 0;
    }
    $("[data-smp-knob]", sheet).style.transform =
      "translateX(" + x.toFixed(1) + "px)";
    $("[data-smp-t0]", sheet).textContent = mmss(t);
    $("[data-smp-t1]", sheet).textContent = b.T ? "−" + mmss(b.T - t) : "";
    var bar = $("[data-smp-bar]", sheet);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(Math.round(b.T)));
    bar.setAttribute("aria-valuenow", String(Math.round(t)));
    var pp = $("[data-smp-pp]", sheet),
      on = isPlaying();
    if (pp.getAttribute("data-on") !== String(on)) {
      pp.setAttribute("data-on", String(on));
      pp.innerHTML = on ? PAUSE : PLAY;
      pp.setAttribute("aria-label", on ? "Pause" : "Lecture");
    }
  }
  // Barre : toucher ou glisser n'importe où.
  function bindBar(bar) {
    function at(e) {
      var b = barState();
      if (!b || !b.T) return null;
      var r = $("[data-smp-trk]", sheet).getBoundingClientRect(),
        x = clamp(e.clientX - r.left, 0, r.width);
      if (!st.mix) return (x / r.width) * b.T;
      var w1 = ((r.width - 3) * b.S) / b.T;
      return x <= w1
        ? (b.S * x) / w1
        : b.S + TRACK * clamp((x - w1 - 3) / (r.width - 3 - w1), 0, 1);
    }
    bar.addEventListener("pointerdown", function (e) {
      var t = at(e);
      if (t == null) return;
      st.drag = t;
      try {
        bar.setPointerCapture(e.pointerId);
      } catch (_e) {}
      paintBar();
    });
    bar.addEventListener("pointermove", function (e) {
      if (st.drag == null) return;
      var t = at(e);
      if (t != null) st.drag = t;
      paintBar();
    });
    function end() {
      if (st.drag == null) return;
      var t = st.drag;
      st.drag = null;
      seekTo(t);
      track("samples_seek", { mode: st.mix ? "mix" : "samples" });
    }
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", function () {
      st.drag = null;
      paintBar();
    });
    bar.addEventListener("keydown", function (e) {
      var b = barState();
      if (!b || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      e.stopPropagation();
      seekTo(clamp(b.t + (e.key === "ArrowRight" ? 5 : -5), 0, b.T));
    });
  }
  function seekTo(t) {
    var cur = st.list[st.pos];
    if (!cur) return;
    if (!st.mix) {
      if (yt.dur) {
        send("seekTo", [t, true]);
        yt.time = t;
      }
      return paintBar();
    }
    var S = Math.max(1, cur.s1 - cur.s0);
    if (t < S) {
      if (duo.phase === "sample") {
        send("seekTo", [cur.s0 + t, true]);
        yt.time = cur.s0 + t;
      } else play(cur, false, false, t); // retour dans le sample : ton morceau s'arrête, le sample reprend
    } else {
      var off = clamp(t - S, 0, TRACK - 1);
      if (duo.phase === "sample") {
        // saut direct dans ton morceau
        send("pauseVideo");
        startTrack(
          cur,
          Math.max(0, cur.at - OVERLAP),
          off,
          "track",
          TRACK - off,
        );
      } else {
        var a = audioEl();
        if (a)
          try {
            a.currentTime = duo.from + off;
          } catch (_e) {}
        if (a && !a.paused) scheduleOut(TRACK - off);
      }
    }
    paintBar();
  }
  function toggle() {
    if (trackPhase()) {
      var a = audioEl();
      if (!a) return;
      if (a.paused) {
        resumeMusic();
        scheduleOut(Math.max(1, TRACK - (a.currentTime - duo.from)));
      } else {
        clearTimeout(duo.out);
        pauseMusic();
      }
    } else if (isPlaying()) send("pauseVideo");
    else send("playVideo");
    track("samples_toggle", { mode: st.mix ? "mix" : "samples" });
    setTimeout(paintBar, 120);
  }
  function setSortHere(v) {
    var cur = st.list[st.pos];
    st.sort = v;
    setSort(st.mix, st.scope, v);
    if (v === "shuffle") reshuffle(cur);
    paint(false);
    track("samples_sort", {
      sort: v,
      scope: st.scope,
      mode: st.mix ? "mix" : "samples",
    });
  }

  // Messages du lecteur YouTube : prêt, position, fin d'un sample, sample indisponible.
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
    var state;
    if (m.info && typeof m.info === "object") {
      if (isFinite(m.info.currentTime)) yt.time = Number(m.info.currentTime);
      if (isFinite(m.info.duration) && m.info.duration > 0)
        yt.dur = Number(m.info.duration);
      state = m.info.playerState;
    } else if (m.event === "onStateChange") state = m.info;
    if (state != null && isFinite(state)) yt.state = Number(state);
    var inTrack = trackPhase();
    var inOutro = Date.now() < duo.outroUntil;
    if (state === 1 && !inTrack && !inOutro) pauseMusic();
    if (st.mix && duo.phase === "sample") {
      var tm = yt.time;
      if (isFinite(tm) && tm >= duo.end - OVERLAP) mixIn();
      else if (state === 0 || (state === 2 && tm >= duo.end - 0.6)) mixIn();
    } else if (!st.mix && state === 0) step(1);
    if (m.event === "onError") {
      track("samples_unavailable", {});
      if (!inTrack) step(1);
    }
  });
  function listen() {
    var f = frame();
    if (!f || !f.contentWindow) return;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({
          event: "listening",
          id: "infra-samples",
          channel: "widget",
        }),
        ORIGIN,
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
    true,
  );
  function pauseMusic() {
    var toggleBtn = $(".global-transport.is-playing [data-transport-toggle]");
    if (toggleBtn && typeof toggleBtn.click === "function") toggleBtn.click();
  }
  function resumeMusic() {
    var toggleBtn = $(
      ".global-transport:not(.is-playing) [data-transport-toggle]",
    );
    if (toggleBtn && typeof toggleBtn.click === "function")
      return toggleBtn.click();
    var a = audioEl();
    if (a && a.paused)
      try {
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
      } catch (_e) {}
  }
  // La musique INFRA repart (hors Mix) : le sample se met en pause.
  document.addEventListener(
    "play",
    function (e) {
      if (
        e.target &&
        e.target.tagName === "AUDIO" &&
        sheet &&
        !sheet.hidden &&
        duo.phase !== "mixin"
      )
        send("pauseVideo");
    },
    true,
  );
  document.addEventListener(
    "keydown",
    function (e) {
      if (!sheet || sheet.hidden) return;
      var tag = e.target && e.target.tagName;
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === " " && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      } else if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        !(e.target && e.target.closest && e.target.closest("[data-smp-bar]"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "ArrowRight") step(1);
        else prev();
      }
    },
    true,
  );

  // ---------- Mix : sample → morceau ----------
  function later(fn, ms) {
    duo.timers.push(setTimeout(fn, ms));
  }
  function scheduleOut(sec) {
    clearTimeout(duo.out);
    duo.out = setTimeout(mixOut, sec * 1000);
  }
  function stopDuo(pauseTrack) {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    clearTimeout(duo.out);
    if (pauseTrack && trackPhase()) pauseMusic();
    duo.phase = "";
    duo.outroUntil = 0;
    var c = sheet && $("[data-smp-cov]", sheet);
    if (c) c.classList.remove("on");
    var a = audioEl();
    if (a && a.volume < 1) a.volume = 1;
  }
  function startTrack(i, from, offset, phase, seconds) {
    var lib = window.InfraLibraryPlayback;
    if (!lib || typeof lib.playPaths !== "function" || !i.src) return step(1);
    duo.phase = phase;
    duo.from = from;
    var target = from + (offset || 0);
    var a = audioEl();
    var seek = function () {
      var el = audioEl();
      if (el && trackPhase() && Math.abs(el.currentTime - target) > 2) {
        try {
          el.currentTime = target;
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
    paintNow();
    scheduleOut(seconds);
  }
  function ramp(set, from, to, ms) {
    var n = 10;
    for (var k = 1; k <= n; k++) {
      (function (k) {
        later(
          function () {
            set(from + ((to - from) * k) / n);
          },
          (ms * k) / n,
        );
      })(k);
    }
  }
  function setAudioVolume(v) {
    var el = audioEl();
    if (el)
      try {
        el.volume = clamp(v, 0, 1);
      } catch (_e) {}
  }
  function setVideoVolume(v) {
    send("setVolume", [Math.round(v)]);
  }
  // Le morceau INFRA entre pendant que le sample sort (5 s), calé pour que le sample y arrive pile.
  function mixIn() {
    if (duo.phase !== "sample") return;
    var i = duo.item;
    setAudioVolume(0.15);
    startTrack(i, Math.max(0, i.at - OVERLAP), 0, "mixin", TRACK);
    ramp(setAudioVolume, 0.15, 1, OVERLAP * 1000);
    ramp(setVideoVolume, 100, 0, OVERLAP * 1000);
    later(
      function () {
        send("pauseVideo");
        setVideoVolume(100);
        if (duo.phase === "mixin") duo.phase = "track";
      },
      OVERLAP * 1000 + 200,
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

  function onSheetClick(e) {
    var t = e.target;
    if (t === sheet || (t.closest && t.closest("[data-smp-close]")))
      return close();
    if (!t.closest) return;
    var row = t.closest("[data-smp-i]");
    if (row) return play(st.list[Number(row.getAttribute("data-smp-i"))]);
    if (t.closest("[data-smp-prev]")) return prev();
    if (t.closest("[data-smp-next]")) return step(1);
    if (t.closest("[data-smp-pp]")) return toggle();
    if (t.closest("[data-smp-sort]")) return setSortHere(nextSort(st.sort));
  }

  // Clics dans l'onglet Samples
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !data) return;
    var sec = t.closest("[data-smp-sec]");
    if (sec) {
      pref.sec = sec.getAttribute("data-smp-sec") === "mix" ? "mix" : "samples";
      save();
      track("samples_section", { sec: pref.sec });
      return rerender();
    }
    if (t.closest("[data-smp-allsort]")) {
      var mixNow = pref.sec === "mix";
      var v = nextSort(sortFor(mixNow, "all"));
      setSort(mixNow, "all", v);
      track("samples_sort", { sort: v, scope: "all", mode: pref.sec });
      return rerender();
    }
    if (t.closest("[data-smp-voixbtn]")) {
      pref.voix = !pref.voix;
      save();
      return rerender();
    }
    if (t.closest("[data-smp-all]")) {
      var mix = pref.sec === "mix";
      return open(
        all().filter(keep(mix, pref.voix)),
        mix ? "Tout le Mix" : "Tous les samples",
        "all",
      );
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
      var sec = pref.sec;
      pref.sec = "samples";
      open(items, trackTitle, "track", a, true);
      pref.sec = sec;
      return true;
    });
  }

  window.InfraSamples = {
    render: render,
    load: load,
    openTrack: openTrack,
    close: close,
  };
})();
