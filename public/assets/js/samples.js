// Section Samples (maquette Samples v2 validée le 18/11/2026, puis maquette « Samples et Mix » V1 validée le
// 19/11/2026 : DOCS/maquettes/MAQUETTE_SAMPLES_MIX_V1_20261119.html).
// Onglet « Samples » de la bibliothèque, deux sections :
// - Samples : les morceaux d'origine (vidéos YouTube) en simple playlist, sans les voix ;
// - Acapella (19/11, INFRA : « fais une playlist acapella pour départager les deux ») : les voix seules ;
// - Mix : le passage samplé par INFRA (lu dans le projet Ableton), puis son morceau là où le sample entre :
//   entrée pile à l'endroit du sample (fondu de 0,35 s), 1 minute de morceau, puis fondu croisé avec le
//   sample suivant ; entre deux samples d'un même morceau, fondu croisé d'1 s.
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
    OVERLAP = 2, // sortie de ton morceau vers le sample suivant (fondu croisé)
    XF = 0.35, // entrée : sample → ton morceau, quasi coupe (évite le clic), à plein volume
    LEAD = 3,
    SEGXF = 1, // 19/11 (INFRA : « fais la transition entre les deux samples ») : fondu croisé entre deux parties
    SEGPRE = 4, // la partie suivante se prépare, muette, dans un 2e lecteur caché, SEGPRE s avant
    SORTS = ["bpm", "bpmdown", "shuffle", "album"],
    ticker = 0;
  var pref = { sec: "samples", voix: false, sort: {} };
  try {
    var saved = JSON.parse(localStorage.getItem("infra-samples") || "null");
    if (saved && typeof saved === "object") {
      if (
        saved.sec === "mix" ||
        saved.sec === "samples" ||
        saved.sec === "voix"
      )
        pref.sec = saved.sec;
      pref.voix = saved.voix === true;
      if (saved.sort && typeof saved.sort === "object") pref.sort = saved.sort;
    } else pref.voix = localStorage.getItem("infra-samples-voix") === "1";
  } catch (_e) {}
  function save() {
    try {
      localStorage.setItem("infra-samples", JSON.stringify(pref));
    } catch (_e) {}
  }
  // Section en cours : samples (sans voix), voix (acapella seules) ou mix.
  function secVoix() {
    return pref.sec === "voix" ? "only" : false;
  }
  function sortKey(mix) {
    return mix ? "mix-" : pref.sec === "voix" ? "voix-" : "smp-";
  }
  function sortFor(mix, scope) {
    var v = pref.sort[sortKey(mix) + scope];
    if (SORTS.indexOf(v) >= 0) return v;
    return scope === "all" ? (mix ? "bpm" : "shuffle") : "album";
  }
  function setSort(mix, scope, v) {
    pref.sort[sortKey(mix) + scope] = v;
    save();
  }
  // BPM : 1er toucher du plus lent au plus rapide, 2e du plus rapide au plus lent, 3e ordre des morceaux.
  // Aléatoire : toucher l'actif le relâche (ordre des morceaux).
  function pickSort(current, v) {
    if (v === "bpm")
      return current === "bpm"
        ? "bpmdown"
        : current === "bpmdown"
          ? "album"
          : "bpm";
    return current === v ? "album" : v;
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
                go: it.go == null ? NaN : Number(it.go),
                p: Array.isArray(it.p) ? it.p : null,
                dt: Number(it.dt) || 0,
                bpm: Array.isArray(it.bpm) ? it.bpm : null,
                tb: Number(it.tb) || 0,
                x: xList(it.x),
                c: it.c === 1,
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
  // Extraits audio (samples.json v2) : [nomFichier, x0 (temps YouTube du début), xd (durée)].
  function xList(x) {
    if (!Array.isArray(x) || !x.length) return null;
    var ok = x.every(function (e) {
      return (
        Array.isArray(e) &&
        /^[\w.-]+$/.test(String(e[0] || "")) &&
        isFinite(e[1]) &&
        Number(e[2]) > 0
      );
    });
    return ok
      ? x.map(function (e) {
          return [String(e[0]), Number(e[1]), Number(e[2])];
        })
      : null;
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
  // Mix (INFRA, 19/11) : les samples d'un même morceau sont joués à la suite, dans l'ordre où ils y
  // entrent, chacun en une ou plusieurs parties (vraie durée lue dans le projet Ableton), puis ton morceau
  // entre pile à l'entrée du premier. Un enchaînement = le 1er sample + { chain, segs, S }.
  function chainOf(list) {
    var groups = [],
      byKey = {};
    list.filter(duoOk).forEach(function (i) {
      var k = i.album + "|" + i.track;
      if (!byKey[k]) {
        byKey[k] = [];
        groups.push(byKey[k]);
      }
      byKey[k].push(i);
    });
    return groups.map(function (chain) {
      chain = chain.slice().sort(function (a, b) {
        return a.at - b.at;
      });
      var segs = [],
        S = 0;
      chain.forEach(function (c, ci) {
        (c.p || [[c.s0, c.s1]]).forEach(function (q, qi) {
          if (!(q[1] > q[0])) return;
          segs.push({
            y: c.y,
            s0: q[0],
            s1: q[1],
            ci: ci,
            from: S,
            x: c.x ? c.x[qi] || null : null,
          });
          S += q[1] - q[0];
        });
      });
      return Object.assign({}, chain[0], {
        chain: chain,
        segs: segs,
        S: Math.max(1, S),
        t: chain
          .map(function (c) {
            return c.t;
          })
          .join(" + "),
      });
    });
  }
  // position t (s depuis le début du sample) → partie k et décalage dans la partie
  function locate(item, t) {
    var segs = item.segs || [{ s0: item.s0, s1: item.s1, from: 0 }];
    for (var k = 0; k < segs.length; k++) {
      var len = segs[k].s1 - segs[k].s0;
      if (t < segs[k].from + len || k === segs.length - 1)
        return { k: k, local: clamp(t - segs[k].from, 0, len) };
    }
    return { k: 0, local: 0 };
  }
  // fin de chargement YouTube : la partie, ou la dernière partie suivante de la même vidéo (sauts par seekTo)
  function endFor(item, k) {
    var segs = item.segs,
      e = segs[k].s1;
    for (
      var j = k + 1;
      j < segs.length &&
      segs[j].y === segs[k].y &&
      segs[j].s0 >= segs[j - 1].s1;
      j++
    )
      e = segs[j].s1;
    return e;
  }
  function curSample() {
    var c = st.list[st.pos];
    if (!c || !st.mix || !c.chain) return c;
    var sg = c.segs[duo.k || 0];
    return c.chain[sg ? sg.ci : 0];
  }
  function isLastSeg() {
    var c = duo.item;
    return !c || !c.segs || duo.k >= c.segs.length - 1;
  }
  // partie suivante : même vidéo → saut ; autre sample → chargement
  function nextSeg() {
    var item = duo.item;
    if (!item || !item.segs || duo.phase !== "sample") return;
    var k = duo.k + 1,
      sg = item.segs[k],
      before = item.segs[duo.k];
    if (!sg) return;
    if (eng.on) {
      // extraits : fondu croisé de SEGXF s centré sur la fin de la partie (marge des extraits)
      var v = eng.cur,
        when = v && v.item === item ? ctxAt(v, before.s1 - SEGXF / 2) : 0;
      duo.k = k;
      duo.end = sg.s1;
      duo.armed = false;
      duo.segAt = Date.now();
      engStart(item, k, Math.max(sg.x[1], sg.s0 - SEGXF / 2), SEGXF, when);
      paintNow();
      track("samples_part", { k: k, n: item.segs.length });
      return;
    }
    var swap = canSwapNext(); // avant de passer à la partie suivante (nx.k === duo.k + 1)
    duo.k = k;
    duo.end = sg.s1;
    duo.armed = false;
    duo.segAt = Date.now();
    yt.time = sg.s0;
    if (swap) swapToNext(sg);
    else {
      if (nx.item) dropNext(); // préparé mais pas prêt : on l'arrête (sinon il joue muet pour rien)
      if (sg.y === before.y && sg.s0 >= before.s1)
        send("seekTo", [sg.s0, true]);
      else
        send("loadVideoById", [
          { videoId: sg.y, startSeconds: sg.s0, endSeconds: endFor(item, k) },
        ]);
    }
    paintNow();
    track("samples_part", { k: k, n: item.segs.length });
  }
  function keep(mix, voix) {
    return function (i) {
      if (mix) return duoOk(i);
      return voix === "only" ? i.v : voix || !i.v;
    };
  }
  // Tri sur le vrai tempo du morceau (affiché partout, INFRA 19/11) ; tempo inconnu en dernier.
  function bpmOf(i) {
    return i && i.tb ? Math.round(i.tb) : 0;
  }
  function byTempo(list, desc) {
    return list
      .map(function (i, k) {
        return { i: i, k: k };
      })
      .sort(function (a, b) {
        var x = bpmOf(a.i),
          y = bpmOf(b.i);
        if (!x !== !y) return x ? -1 : 1;
        return (desc ? y - x : x - y) || a.k - b.k;
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
  // Ordre (INFRA, 19/11) : « BPM » et « aléatoire » côte à côte, l'actif en foncé ; toucher l'actif
  // le relâche → ordre des morceaux. Le mot « BPM » plutôt qu'un métronome ; aléatoire = deux flèches
  // qui se croisent (forme de la lecture aléatoire d'Apple Musique).
  var SORT_ICON = {
    shuffle: svg(
      '<path d="M3 17.5h2.6c1.6 0 2.6-.6 3.5-1.9l5.8-8.2c.9-1.3 1.9-1.9 3.5-1.9H21"/><path d="M18 2.5 21 5.5 18 8.5"/><path d="M3 6.5h2.6c1.6 0 2.6.6 3.5 1.9l.6.9M21 17.5h-2.6c-1.6 0-2.6-.6-3.5-1.9l-.6-.9"/><path d="M18 14.5 21 17.5 18 20.5"/>',
      LINE,
    ),
  };
  var SORT_LABEL = { bpm: "Par BPM", shuffle: "Aléatoire" };
  function sortBtns(sort, scope, only) {
    return (only ? [only] : ["bpm", "shuffle"])
      .map(function (v) {
        var on = sort === v || (v === "bpm" && sort === "bpmdown");
        var label =
          v === "bpm" && on
            ? sort === "bpm"
              ? "Du plus lent au plus rapide (toucher : l'inverse)"
              : "Du plus rapide au plus lent (toucher : ordre des morceaux)"
            : SORT_LABEL[v] + (on ? " (toucher : ordre des morceaux)" : "");
        var icon =
          v === "bpm"
            ? '<span class="sx-word" aria-hidden="true">BPM' +
              (on
                ? '<i class="sx-arrow">' + (sort === "bpm" ? "↑" : "↓") + "</i>"
                : "") +
              "</span>"
            : SORT_ICON[v];
        return (
          '<button type="button" class="sx-ic' +
          (on ? " on" : "") +
          '" data-smp-sortv="' +
          v +
          '" data-smp-sortscope="' +
          scope +
          '" aria-pressed="' +
          on +
          '" title="' +
          label +
          '" aria-label="' +
          label +
          '">' +
          icon +
          "</button>"
        );
      })
      .join("");
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
      "@media (max-width:639px){.sx-sec{gap:20px}.sx-sec button{font-size:26px}}",
      "@media (max-width:379px){.sx-sec{gap:16px}.sx-sec button{font-size:23px}}",
      ".sx-sub{font-size:13px;color:rgba(17,17,17,.5);margin:0 0 10px}",
      ".sx-allrow{display:flex;align-items:center;gap:4px;margin-bottom:16px}",
      ".sx-all{display:flex;align-items:center;gap:12px;min-height:58px;padding:6px 8px 6px 0;border:0;background:none;font:inherit;color:var(--ink,#111);text-align:left;cursor:pointer}",
      ".sx-allic{display:grid;place-items:center;width:28px;height:28px;color:#e0353b;transition:transform .2s}",
      ".sx-allic svg{width:28px;height:28px}",
      ".sx-all:hover .sx-allic,.sx-all:focus-visible .sx-allic{transform:scale(1.12)}",
      ".sx-all b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}",
      ".sx-all small{display:block;font-size:12px;color:rgba(17,17,17,.45)}",
      ".sx-ic{width:40px;height:40px;border:0;background:none;padding:0;display:grid;place-items:center;color:rgba(17,17,17,.3);cursor:pointer;flex:none;transition:color .15s}",
      ".sx-ic svg{width:22px;height:22px}",
      ".sx-word{font-size:12px;font-weight:800;letter-spacing:.04em;line-height:1}",
      ".sx-ic:hover,.sx-ic:focus-visible{color:rgba(17,17,17,.6)}",
      ".sx-ic.on{color:#111}",
      ".sx-ic+.sx-ic{margin-left:-6px}",
      ".smp-al .smp-play{background:none;color:#fff;width:auto;height:auto;filter:drop-shadow(0 1px 4px rgba(0,0,0,.7))}",
      ".smp-al .smp-play svg{width:24px;height:24px;margin:0}",
      ".sx-word{display:inline-flex;align-items:baseline;gap:1px}",
      ".sx-arrow{font-style:normal;font-size:12px;font-weight:800}",
      // Lecteur plein écran (INFRA, 19/11 : « réutiliser la lecture en plein écran ») : mêmes valeurs que
      // le grand lecteur du site (fond flou de la pochette, titre Antique Olive, blanc sur sombre).
      // Fond = exactement celui du grand lecteur des albums (INFRA, 19/11) : voile sombre + page floutée
      // (styles.css .now-playing-overlay), pochette de l'album floutée (élément .now-playing-backdrop du
      // site, réutilisé tel quel), dégradé ::before (mêmes valeurs, version ordinateur dès 860 px).
      ".smp-sheet.sx-fs{display:block;background:rgba(6,7,10,.62);-webkit-backdrop-filter:blur(18px) saturate(1.18);backdrop-filter:blur(18px) saturate(1.18);color:#fff;opacity:0;overflow:hidden;transition:opacity .25s ease}",
      ".smp-sheet.sx-fs.on{opacity:1;background:rgba(6,7,10,.62)}",
      ".smp-sheet.sx-fs:not(.on){pointer-events:none}",
      "@supports not ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){.smp-sheet.sx-fs,.smp-sheet.sx-fs.on{background:rgba(10,10,15,.95)}}",
      ".sx-fs{--w:min(540px,calc(100vw - 32px))}",
      "@media (min-width:860px){.sx-fs::before{background:radial-gradient(90% 78% at 32% 0%,rgba(255,255,255,.13),rgba(255,255,255,0) 60%),linear-gradient(180deg,rgba(5,6,9,.2),rgba(5,6,9,.76))}}",
      ".sx-fs::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(90% 80% at 50% 0%,rgba(255,255,255,.15),rgba(255,255,255,0) 58%),linear-gradient(180deg,rgba(5,6,9,.18),rgba(5,6,9,.78))}",
      ".sx-panel{position:relative;z-index:2;height:100%;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:calc(8px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom));outline:none}",
      ".sx-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:var(--w);margin:0 auto 8px}",
      ".sx-kick{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".sx-tools{display:flex;align-items:center;flex:none}",
      ".sx-fs .smp-ytic{color:rgba(255,255,255,.5)}",
      ".sx-fs .smp-ytic:hover{color:#fff}",
      ".sx-fs .smp-ytic [fill='#fff']{fill:#16181d}",
      ".sx-fs .smp-ytic [stroke='#fff']{stroke:#16181d}",
      ".sx-x{width:40px;height:40px;border:0;background:none;padding:0;color:#fff;display:grid;place-items:center;cursor:pointer;margin-right:-10px}",
      ".sx-x svg{width:22px;height:22px}",
      ".sx-main{max-width:var(--w);margin:0 auto}",
      // L'image se réduit avec la hauteur de l'écran : titre, barre et commandes toujours visibles (INFRA, 19/11).
      ".sx-art{position:relative;width:min(100%,max(160px,calc(100vh - 350px)));width:min(100%,max(160px,calc(100dvh - 350px)));margin:0 auto;aspect-ratio:1;border-radius:24px;overflow:hidden;background:#000}",
      ".sx-vid{position:absolute;inset:0;overflow:hidden}",
      ".sx-vid iframe{position:absolute;top:0;left:50%;height:100%;width:177.78%;transform:translateX(-50%);border:0;display:block;transition:opacity 1s ease}",
      ".sx-vid iframe[data-smp-alt]{opacity:0;pointer-events:none}",
      ".sx-cov{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;pointer-events:none;transition:opacity 1.4s ease}",
      ".sx-cov.on{opacity:1;pointer-events:auto}",
      ".sx-meta{display:flex;align-items:flex-end;gap:16px;margin-top:20px}",
      ".sx-mt{flex:1;min-width:0}",
      ".sx-title{display:block;font-family:'Antique Olive','Helvetica Neue',Arial,sans-serif;font-weight:400;font-size:clamp(1.7rem,6.2vw,2.35rem);line-height:1.04;overflow-wrap:anywhere;color:#fff}",
      ".sx-mt small{display:block;margin-top:8px;color:rgba(255,255,255,.55);font-size:clamp(.95rem,3.4vw,1.1rem);line-height:1.15;letter-spacing:.02em}",
      ".sx-bpm{flex:none;text-align:right;line-height:1}",
      ".sx-bpm[hidden]{display:none}",
      ".sx-bpm b{display:block;font-family:'Antique Olive','Helvetica Neue',Arial,sans-serif;font-weight:400;font-size:clamp(2.2rem,9vw,3.1rem);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#fff}",
      ".sx-bpm small{display:block;margin-top:5px;font-size:11px;font-weight:700;letter-spacing:.2em;color:rgba(255,255,255,.55)}",
      ".sx-bar{position:relative;height:28px;margin-top:18px;cursor:pointer;touch-action:none}",
      ".sx-trk{position:absolute;left:0;right:0;top:12px;height:4px;display:flex;gap:3px}",
      ".sx-seg{position:relative;height:100%;background:rgba(255,255,255,.22);overflow:hidden}",
      ".sx-seg i{position:absolute;left:0;top:0;bottom:0;width:0;background:#fff}",
      ".sx-seg.s i{background:#e0353b}",
      ".sx-knob{position:absolute;top:6px;left:0;width:3px;height:16px;margin-left:-1.5px;background:#fff;pointer-events:none}",
      ".sx-times{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums}",
      ".sx-leg{display:flex;gap:3px;margin-top:6px;font-size:13px}",
      ".sx-leg button{min-width:0;border:0;background:none;padding:6px 0;margin:-6px 0;font:inherit;text-align:left;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:rgba(255,255,255,.4)}",
      ".sx-leg button:hover{color:rgba(255,255,255,.75)}",
      ".sx-leg button.on{color:#fff;font-weight:700}",
      ".sx-leg button.s.on{color:#e0353b}",
      ".sx-ctr{display:grid;grid-template-columns:minmax(44px,1fr) auto auto auto minmax(44px,1fr);align-items:center;justify-items:center;column-gap:clamp(8px,4vw,28px);margin:12px 0 4px}",
      ".sx-ctr>button{width:56px;height:56px;border:0;background:none;padding:0;color:#fff;cursor:pointer;display:grid;place-items:center;transition:transform .12s}",
      ".sx-ctr>button svg{width:30px;height:30px}",
      ".sx-ctr>.sx-pp{width:72px;height:72px}",
      ".sx-ctr>.sx-pp svg{width:50px;height:50px}",
      ".sx-ctr>button:active{transform:scale(.9)}",
      ".sx-fs .sx-ic{color:rgba(255,255,255,.4)}",
      ".sx-fs .sx-ic:hover,.sx-fs .sx-ic:focus-visible{color:rgba(255,255,255,.75)}",
      ".sx-fs .sx-ic.on{color:#fff}",
      ".sx-queue{max-width:var(--w);margin:28px auto 0}",
      ".sx-h{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:0 0 4px}",
      ".sx-fs .smp-row{color:#fff;border-bottom-color:rgba(255,255,255,.1)}",
      ".sx-fs .smp-row img{width:44px;height:44px;border-radius:6px;background:rgba(255,255,255,.08)}",
      ".sx-fs .smp-row small{color:rgba(255,255,255,.5)}",
      ".sx-fs .smp-row.on b{color:#e0353b}",
      ".sx-fs .smp-grp{color:rgba(255,255,255,.5)}",
      ".sx-rb{flex:none;min-width:34px;text-align:right;font-family:'Antique Olive','Helvetica Neue',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,.85);font-variant-numeric:tabular-nums}",
      ".sx-fs .smp-row em{font-style:normal;font-size:12px;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums;flex:none;min-width:30px;text-align:right}",
      // Ordinateur : image et commandes au centre, « À suivre » à droite (comme la file du grand lecteur).
      "@media (min-width:980px){.sx-fs{--w:min(440px,54vh,calc(50vw - 120px))}.sx-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);grid-template-rows:auto minmax(0,1fr);column-gap:clamp(32px,5vw,80px);overflow:hidden;padding:20px clamp(28px,4vw,72px) 24px}.sx-top{grid-column:1/-1;max-width:none;margin:0}.sx-main{align-self:center;justify-self:center;width:var(--w)}.sx-queue{max-width:none;margin:0;overflow:auto;overscroll-behavior:contain;min-height:0;align-self:stretch;padding-right:4px}.sx-title{font-size:clamp(1.4rem,1.2vw + .8rem,2rem)}}",
      "@media (prefers-reduced-motion:reduce){.sx-cov,.sx-allic,.sx-ctr>button,.smp-sheet.sx-fs{transition:none}}",
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
    var voixSec = pref.sec === "voix";
    var pool = mix ? chainOf(all()) : all().filter(keep(mix, secVoix()));
    var html =
      '<div class="sx-sec" role="tablist" aria-label="Samples, Acapella ou Mix">' +
      '<button type="button" role="tab" data-smp-sec="samples" aria-selected="' +
      (!mix && !voixSec) +
      '">Samples</button>' +
      '<button type="button" role="tab" data-smp-sec="voix" aria-selected="' +
      voixSec +
      '">Acapella</button>' +
      '<button type="button" role="tab" data-smp-sec="mix" aria-selected="' +
      mix +
      '">Mix</button></div>' +
      '<p class="sx-sub">' +
      (mix
        ? "Le passage samplé, puis ton morceau là où il entre."
        : voixSec
          ? "Les voix que tu as reprises, seules."
          : "Les morceaux d'origine, en playlist.") +
      "</p>" +
      '<div class="sx-allrow"><button type="button" class="sx-all" data-smp-all><span class="sx-allic">' +
      PLAY +
      "</span><span><b>" +
      (mix ? "Tout le Mix" : voixSec ? "Toutes les voix" : "Tous les samples") +
      "</b><small>" +
      pool.length +
      (mix ? " enchaînements" : voixSec ? " voix" : " samples") +
      "</small></span></button>" +
      sortBtns(sortFor(mix, "all"), "all") +
      "</div>" +
      '<ul class="smp-grid">' +
      data.albums
        .map(function (a, i) {
          var n = mix
            ? chainOf(a.items).length
            : a.items.filter(keep(mix, secVoix())).length;
          if (!n) return "";
          var label = mix
            ? n + (n > 1 ? " enchaînements" : " enchaînement")
            : voixSec
              ? n + " voix"
              : n + (n > 1 ? " samples" : " sample");
          return (
            '<li><button type="button" class="smp-al" data-smp-album="' +
            i +
            '" aria-label="' +
            (mix ? "Mix de " : voixSec ? "Voix de " : "Samples de ") +
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
    if (st.sort === "bpm" || st.sort === "bpmdown")
      return byTempo(l, st.sort === "bpmdown");
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
    sheet.className = "smp-sheet sx-fs";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Lecteur de samples");
    sheet.innerHTML =
      '<div class="now-playing-backdrop" data-smp-bg aria-hidden="true"></div>' +
      '<div class="sx-panel" tabindex="-1">' +
      '<div class="sx-top"><span class="sx-kick" data-smp-kicker></span>' +
      '<span class="sx-tools">' +
      '<a class="smp-ytic" data-smp-sp target="_blank" rel="noopener" aria-label="Chercher dans Spotify" title="Chercher ce sample dans Spotify">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M7 9.6c3.4-1 7.2-.7 10.2 1M7.6 12.6c2.8-.8 5.8-.5 8.3.9M8.3 15.4c2.2-.6 4.4-.3 6.4.7" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg></a>' +
      '<a class="smp-ytic" data-smp-am target="_blank" rel="noopener" aria-label="Chercher dans Apple Music" title="Chercher ce sample dans Apple Music">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor"/><path d="M10 16.3V8.2l6-1.4v7.9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8.6" cy="16.4" r="1.6" fill="#fff"/><circle cx="14.6" cy="14.8" r="1.6" fill="#fff"/></svg></a>' +
      '<a class="smp-ytic" data-smp-yt target="_blank" rel="noopener" aria-label="Ouvrir dans YouTube" title="Ouvrir dans YouTube">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg></a>' +
      '<button type="button" class="sx-x" data-smp-close aria-label="Fermer" title="Fermer (Échap)">' +
      svg('<path d="M6 6l12 12M18 6L6 18"/>', LINE) +
      "</button></span></div>" +
      '<div class="sx-main">' +
      '<div class="sx-art"><div class="sx-vid"><iframe data-smp-alt title="Sample suivant" tabindex="-1" aria-hidden="true" allow="autoplay; encrypted-media"></iframe><iframe data-smp-frame title="Sample" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<img class="sx-cov" data-smp-cov alt=""></div>' +
      '<div class="sx-meta"><div class="sx-mt"><b class="sx-title" data-smp-t dir="auto"></b>' +
      '<small data-smp-a dir="auto"></small></div>' +
      '<div class="sx-bpm" data-smp-bpm title="Tempo du morceau"><b></b><small>BPM</small></div></div>' +
      '<div class="sx-bar" data-smp-bar role="slider" aria-label="Position" tabindex="0"><div class="sx-trk" data-smp-trk></div><i class="sx-knob" data-smp-knob></i></div>' +
      '<div class="sx-times"><span data-smp-t0>0:00</span><span data-smp-t1></span></div>' +
      '<div class="sx-leg" data-smp-leg></div>' +
      '<div class="sx-ctr"><span data-smp-sortl></span><button type="button" data-smp-prev aria-label="Précédent">' +
      PREV +
      '</button><button type="button" class="sx-pp" data-smp-pp aria-label="Lecture">' +
      PLAY +
      '</button><button type="button" data-smp-next aria-label="Suivant">' +
      NEXT +
      "</button><span data-smp-sortr></span></div>" +
      "</div>" +
      '<section class="sx-queue" aria-label="À suivre"><h4 class="sx-h">À suivre</h4>' +
      '<ol class="smp-list" data-smp-list></ol></section>' +
      "</div>";
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
  // Fondu croisé entre deux parties (deux samples, ou deux passages d'un même sample) : la partie suivante
  // est chargée MUETTE dans le 2e lecteur, puis les deux lecteurs échangent leur rôle et le son passe de l'un
  // à l'autre en SEGXF s (puissance égale). iPhone (volume bloqué) ou lecteur pas prêt : saut comme avant.
  var nx = { k: -1, item: null, ready: false, loaded: false };
  function nextFrame() {
    return sheet && $("iframe[data-smp-alt]", sheet);
  }
  function sendTo(f, func, args) {
    if (!f || !f.contentWindow) return;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: args || [] }),
        ORIGIN,
      );
    } catch (_e) {}
  }
  function listenTo(f) {
    if (!f || !f.contentWindow) return;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({
          event: "listening",
          id: "infra-samples-next",
          channel: "widget",
        }),
        ORIGIN,
      );
    } catch (_e) {}
  }
  function dropNext() {
    nx.k = -1;
    nx.item = null;
    nx.ready = false;
    var f = nextFrame();
    if (f && f.getAttribute("src")) {
      sendTo(f, "stopVideo");
      f.removeAttribute("src");
    }
  }
  function prepNext() {
    var item = duo.item,
      k = duo.k + 1,
      sg = item && item.segs && item.segs[k],
      f = nextFrame();
    if (!sg || !f || (nx.item === item && nx.k === k)) return;
    nx.k = k;
    nx.item = item;
    nx.ready = false;
    nx.loaded = false; // les messages de l'ancienne vidéo ne comptent pas : on attend le chargement de la nouvelle
    f.src = embed(sg.y, sg.s0, endFor(item, k)) + "&mute=1";
  }
  function canSwapNext() {
    return nx.ready && nx.item === duo.item && nx.k === duo.k + 1 && canFade();
  }
  function swapToNext(sg) {
    var old = frame(),
      nf = nextFrame();
    sendTo(nf, "seekTo", [sg.s0, true]);
    sendTo(nf, "setVolume", [0]);
    sendTo(nf, "unMute");
    sendTo(nf, "playVideo");
    old.removeAttribute("data-smp-frame");
    old.setAttribute("data-smp-alt", "");
    old.setAttribute("tabindex", "-1");
    old.setAttribute("aria-hidden", "true");
    old.setAttribute("title", "Sample suivant");
    nf.removeAttribute("data-smp-alt");
    nf.removeAttribute("tabindex");
    nf.removeAttribute("aria-hidden");
    nf.setAttribute("title", "Sample");
    nf.setAttribute("data-smp-frame", "");
    nx.k = -1;
    nx.item = null;
    nx.ready = false;
    st.ready = true;
    listen();
    xfade(
      function (v) {
        sendTo(nf, "setVolume", [Math.round(v * 100)]);
      },
      function (v) {
        sendTo(old, "setVolume", [Math.round(v * 100)]);
      },
      SEGXF * 1000,
    );
    later(
      function () {
        if (old !== frame() && !nx.item) {
          sendTo(old, "stopVideo");
          old.removeAttribute("src");
        }
      },
      SEGXF * 1000 + 300,
    );
  }
  function embed(id, start, end) {
    var p = new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    if (end != null) {
      p.set("start", String(Math.floor(start)));
      p.set("end", String(Math.ceil(end)));
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
    if (st.mix) st.list = list = chainOf(list);
    st.voix = voix == null ? secVoix() : voix;
    st.sort = sortFor(st.mix, scope);
    reshuffle(null);
    var first = shownList()[0];
    if (!first && !st.voix && !st.mix) {
      st.voix = true; // album sans sample instrumental : on montre ses voix
      first = shownList()[0];
    }
    if (!first) return;
    ensureCtx(); // dans le geste : indispensable sur iPhone
    if (st.mix) unlockAudio();
    sheet.hidden = false;
    document.documentElement.classList.add("smp-open");
    requestAnimationFrame(function () {
      sheet.classList.add("on");
    });
    play(first, true);
    clearInterval(ticker);
    ticker = setInterval(paintBar, 250);
    clearInterval(eng.tick);
    eng.tick = setInterval(engTick, 100);
    track("samples_open", {
      mode: st.mix ? "mix" : "samples",
      scope: scope,
      sort: st.sort,
      n: shown().length,
    });
    var panel = $(".sx-panel", sheet);
    if (panel) panel.focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    var f = frame();
    if (f) f.removeAttribute("src");
    dropNext();
    stopDuo(true);
    engStop(0.25);
    clearInterval(ticker);
    clearInterval(eng.tick);
    setTimeout(function () {
      // lecteur fermé : l'horloge audio s'arrête (rouverte dans le prochain geste)
      if (eng.ctx && sheet && sheet.hidden && eng.ctx.state === "running")
        try {
          eng.ctx.suspend();
        } catch (_e) {}
    }, 600);
    st.ready = false;
    st.pos = -1;
    sheet.classList.remove("on");
    // Audit 19/11 : il se fermait d'un coup ; on laisse le fondu de sortie se jouer (comme à l'ouverture).
    var closing = sheet;
    setTimeout(function () {
      if (!closing.classList.contains("on")) closing.hidden = true;
    }, 260);
    document.documentElement.classList.remove("smp-open");
  }
  function trackPhase() {
    return st.mix && (duo.phase === "track" || duo.phase === "mixin");
  }
  // when : instant (horloge audio) du fondu, pour un enchaînement automatique programmé à l'avance.
  function play(item, fresh, fadeIn, offset, when) {
    var f = frame();
    if (!f || !item) return;
    var useE = useEng(item),
      hadVoice = !!(eng.on && eng.cur && !eng.paused);
    dropNext();
    stopDuo(!fadeIn && trackPhase());
    var fade = fadeIn && canFade();
    if (fadeIn) {
      // fondu croisé : le morceau sort pendant que le sample entre (iPhone : coupe nette)
      duo.outroUntil = Date.now() + OVERLAP * 1000 + 1500;
      // extrait : il entre par son propre gain (moteur) ; ton morceau sort par le volume si possible
      if (fade)
        xfade(
          useE
            ? noop
            : function (v) {
                setVideoVolume(v * 100);
              },
          setAudioVolume,
          OVERLAP * 1000,
        );
      later(
        function () {
          pauseMusic();
          setAudioVolume(1);
        },
        fade ? OVERLAP * 1000 + 100 : 900,
      );
    }
    st.pos = st.list.indexOf(item);
    var start = offset || 0,
      vid = item.y,
      endS = null;
    if (st.mix) {
      var loc = locate(item, offset || 0),
        sg = item.segs[loc.k];
      duo.phase = "sample";
      duo.item = item;
      duo.k = loc.k;
      duo.end = sg.s1;
      duo.armed = false;
      duo.segAt = Date.now();
      start = sg.s0 + loc.local;
      vid = sg.y;
      endS = endFor(item, loc.k);
    }
    yt.time = start;
    yt.dur = 0;
    yt.state = -1;
    if (useE) {
      // extrait audio : aucun lecteur YouTube chargé
      if (f.getAttribute("src")) f.removeAttribute("src");
      st.ready = false;
      var segs = segsOf(item),
        loc0 = locate({ segs: segs }, offset || 0),
        sg0 = segs[loc0.k],
        xf = fadeIn ? OVERLAP : !hadVoice ? 0 : offset ? 0.06 : SMPXF,
        from = sg0.s0 + loc0.local;
      if (!offset && xf) from = Math.max(sg0.x[1], sg0.s0 - xf / 2); // marge de l'extrait
      yt.time = from;
      engStart(item, loc0.k, from, xf, when);
      paint(fresh);
      return;
    }
    engStop(0.3);
    if (fresh || !st.ready) {
      st.ready = false;
      f.src = embed(vid, start, endS);
    } else if (st.mix) {
      setVideoVolume(fade ? 0 : 100);
      send("loadVideoById", [
        { videoId: vid, startSeconds: start, endSeconds: endS },
      ]);
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
    $("[data-smp-sortl]", sheet).innerHTML = sortBtns(st.sort, "here", "bpm");
    $("[data-smp-sortr]", sheet).innerHTML = sortBtns(
      st.sort,
      "here",
      "shuffle",
    );
    var bpmBox = $("[data-smp-bpm]", sheet);
    bpmBox.hidden = !bpmOf(cur);
    bpmBox.firstChild.textContent = bpmOf(cur) || "";
    // barre : un segment (Samples) ou deux (Mix : sample | morceau)
    // barre : Samples = un morceau ; Mix = chaque partie du (des) sample(s), puis ton morceau
    var segsM = cur.segs || [{ s0: cur.s0, s1: cur.s1, ci: 0, from: 0 }],
      chain = cur.chain || [cur];
    $("[data-smp-trk]", sheet).innerHTML = st.mix
      ? segsM
          .map(function (sg) {
            return (
              '<div class="sx-seg s" style="flex:' +
              (sg.s1 - sg.s0) +
              '"><i></i></div>'
            );
          })
          .join("") +
        '<div class="sx-seg" style="flex:' +
        TRACK +
        '"><i></i></div>'
      : '<div class="sx-seg s" style="flex:1"><i></i></div>';
    // légende : un bouton par sample (début de ce sample), puis ton morceau
    $("[data-smp-leg]", sheet).innerHTML = st.mix
      ? chain
          .map(function (c, ci) {
            var mine = segsM.filter(function (sg) {
                return sg.ci === ci;
              }),
              len = mine.reduce(function (a, sg) {
                return a + sg.s1 - sg.s0;
              }, 0);
            return (
              '<button type="button" class="s" data-smp-jump="s' +
              ci +
              '" title="Revenir au début de ce sample" style="flex:' +
              len +
              '" dir="auto">' +
              esc(chain.length > 1 ? c.t : "Sample") +
              "</button>"
            );
          })
          .join("") +
        '<button type="button" data-smp-jump="1" title="Aller à ton morceau" style="flex:' +
        TRACK +
        '" dir="auto">' +
        esc(cur.track) +
        "</button>"
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
        ? [st.scope === "album" ? "" : i.album, transfo(i)]
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
          : i.c
            ? esc(assetUrl("assets/samples/" + i.y + ".webp"))
            : "https://i.ytimg.com/vi/" + esc(i.y) + "/mqdefault.jpg") +
        '" alt="" loading="lazy" decoding="async"><span><b dir="auto">' +
        esc(i.t) +
        (st.mix ? " → " + esc(i.track) : "") +
        '</b><small dir="auto">' +
        esc(sub.filter(Boolean).join(" · ") + (i.v ? " · voix" : "")) +
        "</small></span>" +
        '<span class="sx-rb" title="BPM">' +
        (bpmOf(i) || "") +
        "</span>" +
        (st.mix ? "<em>" + mmss((i.S || i.s1 - i.s0) + TRACK) + "</em>" : "") +
        "</button></li>";
    });
    $("[data-smp-list]", sheet).innerHTML = html;
    var from = Math.max(0, list.indexOf(cur));
    $("[data-smp-yt]", sheet).href = st.mix
      ? "https://www.youtube.com/watch?v=" +
        encodeURIComponent(segsM[0].y || cur.y) +
        "&t=" +
        Math.floor(segsM[0].s0) +
        "s"
      : "https://www.youtube.com/watch_videos?video_ids=" +
        list
          .slice(from, from + 50)
          .map(function (i) {
            return i.y;
          })
          .join(",");
    paintNow();
    var scroller = $(".sx-panel", sheet),
      on = $(".smp-row.on", sheet);
    if (top) {
      scroller.scrollTop = 0;
      var queue = $(".sx-queue", sheet);
      if (queue) queue.scrollTop = 0;
    } else if (on && typeof on.scrollIntoView === "function")
      on.scrollIntoView({ block: "nearest" });
  }
  // En haut : ce qu'on entend (le sample, puis ton morceau).
  function paintNow() {
    var cur = st.list[st.pos];
    if (!sheet || !cur) return;
    var inTrack = trackPhase(),
      smp = curSample() || cur;
    $("[data-smp-t]", sheet).textContent = inTrack ? cur.track : smp.t;
    // Spotify et Apple Music : recherche du sample entendu
    var q = encodeURIComponent([smp.a, smp.t].filter(Boolean).join(" "));
    $("[data-smp-sp]", sheet).href = "https://open.spotify.com/search/" + q;
    $("[data-smp-am]", sheet).href = "https://music.apple.com/search?term=" + q;
    $("[data-smp-a]", sheet).textContent = inTrack
      ? ["INFRA", cur.album, transfo(smp)].filter(Boolean).join(" · ")
      : [
          who(smp) + (smp.v ? (who(smp) ? " · " : "") + "voix" : ""),
          "samplé dans " + cur.track,
        ]
          .filter(Boolean)
          .join(" · ");
    // Extrait audio : pas de vidéo, la pochette du sample à sa place (celle de l'album pour ton morceau).
    var cov = $("[data-smp-cov]", sheet),
      covSrc = inTrack || !eng.on ? assetUrl(cur.cover) : smpCover(smp, cur);
    if (cov.getAttribute("src") !== covSrc) cov.setAttribute("src", covSrc);
    cov.classList.toggle("on", inTrack || eng.on);
    $(".sx-vid", sheet).hidden = eng.on;
    // même asset que le grand lecteur : la pochette de l'album (sample comme morceau)
    $("[data-smp-bg]", sheet).style.backgroundImage =
      'url("' + assetUrl(cur.cover) + '")';
    var leg = $("[data-smp-leg]", sheet).children,
      sgNow = cur.segs ? cur.segs[duo.k || 0] : null,
      ciNow = sgNow ? sgNow.ci : 0;
    for (var li = 0; li < leg.length; li++)
      leg[li].classList.toggle(
        "on",
        li === leg.length - 1 ? inTrack : !inTrack && li === ciNow,
      );
    paintBar();
  }
  function audioEl() {
    return (
      document.getElementById("infraGlobalAudio") ||
      document.querySelector("audio")
    );
  }
  // Position dans la barre : t (secondes depuis le début du sample) sur T (durée totale).
  function barState() {
    var cur = st.list[st.pos];
    if (!cur) return null;
    if (!st.mix && eng.on) {
      var xs = segsOf(cur),
        XT = segsLen(xs),
        v = eng.cur,
        h = eng.hold,
        xk = -1,
        xt = 0;
      if (v && v.item === cur) {
        xk = v.k;
        xt = ytNow(v);
      } else if (h && h.item === cur) {
        xk = h.k;
        xt = h.t;
      }
      if (xk < 0) return { S: 0, T: XT, t: 0 };
      var xg = xs[xk];
      return {
        S: 0,
        T: XT,
        t: clamp(xg.from + clamp(xt - xg.s0, 0, xg.s1 - xg.s0), 0, XT),
      };
    }
    if (!st.mix)
      return {
        S: 0,
        T: yt.dur || 0,
        t: yt.dur ? clamp(yt.time, 0, yt.dur) : 0,
      };
    var S = cur.S || Math.max(1, cur.s1 - cur.s0),
      t;
    if (trackPhase()) {
      var a = audioEl();
      t = S + clamp(a ? a.currentTime - duo.from : 0, 0, TRACK);
    } else {
      var sg = cur.segs
        ? cur.segs[duo.k || 0]
        : { s0: cur.s0, s1: cur.s1, from: 0 };
      t = clamp(sg.from + clamp(yt.time - sg.s0, 0, sg.s1 - sg.s0), 0, S);
    }
    return { S: S, T: S + TRACK, t: t };
  }
  function isPlaying() {
    if (trackPhase()) {
      var a = audioEl();
      return !!(a && !a.paused);
    }
    if (eng.on) return !eng.paused && (!!eng.cur || eng.loading);
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
    var L = st.mix ? barLens() : null;
    if (L && segs.length === L.length) {
      var acc = 0;
      L.forEach(function (len, k) {
        segs[k].style.width =
          (clamp((t - acc) / len, 0, 1) * 100).toFixed(2) + "%";
        acc += len;
      });
      x = tToX(L, t, w);
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
  // Mix : longueurs des morceaux de barre (parties du sample, puis ton morceau), 3 px entre eux.
  function barLens() {
    var cur = st.list[st.pos];
    if (!cur) return [TRACK];
    var L = (cur.segs || [{ s0: cur.s0, s1: cur.s1 }]).map(function (sg) {
      return Math.max(0.1, sg.s1 - sg.s0);
    });
    L.push(TRACK);
    return L;
  }
  function tToX(L, t, w) {
    var T = L.reduce(function (a, b) {
        return a + b;
      }, 0),
      avail = w - 3 * (L.length - 1),
      x = 0,
      acc = 0;
    for (var k = 0; k < L.length; k++) {
      var wk = (avail * L[k]) / T;
      if (t <= acc + L[k] || k === L.length - 1)
        return x + wk * clamp((t - acc) / L[k], 0, 1);
      x += wk + 3;
      acc += L[k];
    }
    return x;
  }
  function xToT(L, x, w) {
    var T = L.reduce(function (a, b) {
        return a + b;
      }, 0),
      avail = w - 3 * (L.length - 1),
      pos = 0,
      acc = 0;
    for (var k = 0; k < L.length; k++) {
      var wk = (avail * L[k]) / T;
      if (x <= pos + wk || k === L.length - 1)
        return acc + L[k] * clamp((x - pos) / wk, 0, 1);
      pos += wk + 3;
      acc += L[k];
      if (x < pos) return acc; // dans l'espace entre deux morceaux : début du suivant
    }
    return acc;
  }
  // Barre : toucher ou glisser n'importe où.
  function bindBar(bar) {
    function at(e) {
      var b = barState();
      if (!b || !b.T) return null;
      var r = $("[data-smp-trk]", sheet).getBoundingClientRect(),
        x = clamp(e.clientX - r.left, 0, r.width);
      if (!st.mix) return (x / r.width) * b.T;
      return xToT(barLens(), x, r.width);
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
    if (!st.mix && eng.on) {
      engSeek(cur, t);
      return paintBar();
    }
    if (!st.mix) {
      if (yt.dur) {
        send("seekTo", [t, true]);
        yt.time = t;
      }
      return paintBar();
    }
    if (duo.phase === "pre") cancelPre();
    dropNext();
    var S = cur.S || Math.max(1, cur.s1 - cur.s0);
    if (t < S) {
      var loc = locate(cur, t);
      if (duo.phase === "sample" && loc.k === (duo.k || 0) && eng.on) {
        engSeek(cur, t);
        duo.armed = false;
      } else if (duo.phase === "sample" && loc.k === (duo.k || 0)) {
        var sg = cur.segs ? cur.segs[loc.k] : { s0: cur.s0 };
        send("seekTo", [sg.s0 + loc.local, true]);
        yt.time = sg.s0 + loc.local;
        duo.armed = false;
      } else play(cur, false, false, t); // retour dans le sample : ton morceau s'arrête, le sample reprend
    } else {
      var off = clamp(t - S, 0, TRACK - 1);
      if (duo.phase === "sample") {
        // saut direct dans ton morceau
        if (eng.on) engHush(0.3);
        send("pauseVideo");
        startTrack(cur, entryOf(cur), off, "track", TRACK - off);
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
    } else if (eng.on) {
      if (isPlaying()) {
        if (duo.phase === "pre") cancelPre();
        engPause();
      } else engResume();
    } else if (isPlaying()) {
      if (duo.phase === "pre") cancelPre();
      send("pauseVideo");
    } else send("playVideo");
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
    var nf = nextFrame();
    if (nf && nf.getAttribute("src") && e.source === nf.contentWindow) {
      if (nx.loaded) nx.ready = true; // le lecteur caché (nouvelle vidéo) répond : prêt pour le fondu
      return;
    }
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
    var inPre = duo.phase === "pre";
    if (state === 1 && !inTrack && !inOutro && !inPre) pauseMusic();
    var settling = Date.now() - (duo.segAt || 0) < 1200;
    if (st.mix && duo.phase === "sample" && !isLastSeg()) {
      // fin d'une partie : partie suivante (minuterie précise, ou fin de vidéo)
      var tp = yt.time,
        kk = duo.k;
      if (!settling && isFinite(tp) && canFade() && duo.end - tp < SEGPRE)
        prepNext();
      if (!settling && isFinite(tp) && !duo.armed && duo.end - tp < 1.5) {
        duo.armed = true;
        later(
          function () {
            if (duo.k === kk) nextSeg();
          },
          // fondu : il commence SEGXF s avant la fin de la partie, pour finir pile à sa fin
          Math.max(0, (duo.end - tp - (canSwapNext() ? SEGXF : 0)) * 1000),
        );
      }
      if (!settling && (state === 0 || state === 2) && tp >= duo.end - 0.6)
        nextSeg();
    } else if (st.mix && (duo.phase === "sample" || inPre) && !settling) {
      var tm = yt.time;
      if (
        duo.phase === "sample" &&
        isFinite(tm) &&
        tm >= duo.end - XF - LEAD &&
        tm < duo.end - XF
      )
        preroll();
      if (isFinite(tm) && tm >= duo.end - XF) mixIn();
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
      if (
        e.target &&
        e.target === nextFrame() &&
        e.target.getAttribute("src")
      ) {
        var nf = e.target;
        nx.loaded = true;
        [0, 400, 1500].forEach(function (ms) {
          setTimeout(function () {
            listenTo(nf);
          }, ms);
        });
      }
      if (e.target && e.target === frame()) {
        listen();
        setTimeout(listen, 400);
        setTimeout(listen, 1500);
      }
    },
    true,
  );
  function pauseMusic() {
    // le bouton du lecteur est une bascule : ne l'appuyer que si la musique joue vraiment (sinon il la relance)
    var el = audioEl();
    if (el && el.paused) return;
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
        duo.phase !== "mixin" &&
        duo.phase !== "pre"
      ) {
        if (eng.on) {
          if (eng.cur || eng.loading) engPause();
        } else send("pauseVideo");
      }
    },
    true,
  );
  document.addEventListener(
    "keydown",
    function (e) {
      if (!sheet || sheet.hidden) return;
      var tag = e.target && e.target.tagName;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "ArrowLeft")
        ensureCtx();
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
    // Audit du 19/11 : ton morceau préparé muet (« pre ») ne doit jamais s'entendre, et fermer pendant sa
    // sortie (fondu vers le sample suivant) doit aussi l'arrêter — avant, il continuait à plein volume.
    var wasPre = duo.phase === "pre";
    if (wasPre || (pauseTrack && (trackPhase() || Date.now() < duo.outroUntil)))
      pauseMusic();
    duo.phase = "";
    duo.outroUntil = 0;
    var c = sheet && $("[data-smp-cov]", sheet);
    if (c) {
      c.classList.remove("on");
      c.style.transitionDuration = "";
    }
    var a = audioEl();
    if (a) {
      a.muted = false;
      if (a.volume < 1) a.volume = 1;
    }
  }
  function startTrack(i, from, offset, phase, seconds) {
    var lib = window.InfraLibraryPlayback;
    if (!lib || typeof lib.playPaths !== "function" || !i.src) {
      if (phase !== "pre") step(1);
      return false;
    }
    duo.phase = phase;
    duo.from = from;
    var target = Math.max(0, from + (offset || 0));
    var a = audioEl();
    var seek = function () {
      var el = audioEl();
      // seulement tant qu'on est dans la phase de départ : une fois le morceau entré (« mixin »), la seconde
      // visée de la préparation (entrée − 3 s) ne doit plus être réappliquée (réseau lent : entrée 3 s trop tôt).
      if (
        el &&
        duo.phase === phase &&
        Math.abs(el.currentTime - target) > 0.4
      ) {
        try {
          el.currentTime = target;
        } catch (_e) {}
      }
    };
    // Saut direct (« track ») : muet le temps de se caler, pour ne pas entendre le début du morceau.
    var hush = phase === "track";
    var unhush = function () {
      var el = audioEl();
      if (hush && el && duo.phase === "track") el.muted = false;
      hush = false;
    };
    var onPlaying = function () {
      seek();
      if (a) a.removeEventListener("playing", onPlaying);
      setTimeout(unhush, 150);
    };
    if (a) {
      if (hush) a.muted = true;
      a.addEventListener("playing", onPlaying);
      // Morceau qui finit avant la minute (PHI, MIEL…) : on passe tout de suite au sample suivant.
      if (!a.__smpEnded) {
        a.__smpEnded = true;
        a.addEventListener("ended", function () {
          if (st.mix && trackPhase() && sheet && !sheet.hidden) {
            clearTimeout(duo.out);
            mixOut();
          }
        });
      }
    }
    if (!lib.playPaths([i.src], 0)) {
      if (a) a.removeEventListener("playing", onPlaying);
      if (phase !== "pre") step(1);
      return false;
    }
    later(function () {
      seek();
      setTimeout(unhush, 150);
    }, 1200);
    paintNow();
    if (seconds != null) scheduleOut(seconds);
    return true;
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
  // Transition (retouchée le 19/11, INFRA : « pas très bien ») :
  // - avant, le morceau était lancé au moment du fondu : il chargeait, démarrait au début puis sautait
  //   ~1 s plus tard à la bonne seconde → un raté audible en plein fondu ;
  // - maintenant il est lancé MUET LEAD s plus tôt, déjà calé ; au fondu on le recale au dixième puis
  //   on ouvre le son en fondu à puissance égale (pas de creux au milieu) ;
  // - iPhone : le volume ne se règle pas depuis une page → pas de chevauchement à plein volume, mais
  //   une coupe nette et calée (le morceau prend la place du sample).
  // - 19/11 (INFRA : « exactement commencer le sample… la musique, elle soit forte ») : ton morceau
  //   n'entre plus 5 s avant en fondu lent, mais PILE à la seconde où le sample y apparaît, à plein
  //   volume, en XF s (le temps d'éviter un clic).
  var fadeOk = null;
  function canFade() {
    if (fadeOk !== null) return fadeOk;
    var a = audioEl();
    if (!a) return true;
    var v = a.volume;
    try {
      a.volume = v > 0.5 ? 0.3 : 0.7;
    } catch (_e) {}
    fadeOk = Math.abs(a.volume - v) > 0.1;
    try {
      a.volume = v;
    } catch (_e) {}
    return fadeOk;
  }
  // Fondu croisé à puissance égale : ce qui entre suit un sinus, ce qui sort un cosinus.
  function xfade(setIn, setOut, ms) {
    var n = 24;
    for (var k = 1; k <= n; k++) {
      (function (k) {
        later(
          function () {
            var x = (k / n) * (Math.PI / 2);
            setIn(Math.sin(x));
            setOut(Math.cos(x));
          },
          (ms * k) / n,
        );
      })(k);
    }
  }
  // Où ton morceau entre : la seconde où le sample y apparaît (ou, si l'entrée est en fondu, le moment
  // où le son devient fort : champ « go » mesuré sur ton fichier audio).
  function entryOf(i) {
    return Math.max(0, isFinite(i.go) ? i.go : i.at);
  }
  function preroll() {
    if (duo.phase !== "sample") return;
    var i = duo.item;
    var a = audioEl();
    if (a) a.muted = true;
    if (!startTrack(i, entryOf(i), -LEAD, "pre", null)) {
      if (a) a.muted = false;
      duo.phase = "sample";
      return;
    }
    // l'entrée est déclenchée par une minuterie, plus précise que les messages de YouTube
    later(mixIn, Math.max(0, (duo.end - XF - yt.time) * 1000));
  }
  function cancelPre() {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    pauseMusic();
    var a = audioEl();
    if (a) a.muted = false;
    duo.phase = "sample";
  }
  function mixIn() {
    if (duo.phase !== "sample" && duo.phase !== "pre") return;
    var i = duo.item,
      pre = duo.phase === "pre",
      fade = canFade(),
      base = entryOf(i);
    if (!pre) {
      // pas eu le temps de pré-charger (saut, sample court) : lancé muet, son ouvert une fois calé
      var a0 = audioEl();
      if (a0) a0.muted = true;
      if (!startTrack(i, base, 0, "mixin", null)) return;
    }
    duo.phase = "mixin";
    var c = $("[data-smp-cov]", sheet);
    if (c) c.style.transitionDuration = "0.5s";
    var open = function () {
      var el = audioEl();
      if (!el) return;
      if (Math.abs(el.currentTime - base) > 0.1)
        try {
          el.currentTime = base;
        } catch (_e) {}
      // extrait : vrai fondu de sortie par le gain (iPhone compris) ; ton morceau entre comme avant
      if (eng.on) engHush(XF);
      if (fade) {
        setAudioVolume(0);
        el.muted = false;
        xfade(
          setAudioVolume,
          eng.on
            ? noop
            : function (v) {
                setVideoVolume(v * 100);
              },
          XF * 1000,
        );
      } else {
        el.muted = false;
        send("pauseVideo");
      }
      paintNow();
    };
    var wait = pre ? 0 : 1300;
    if (wait) later(open, wait);
    else open();
    later(
      function () {
        send("pauseVideo");
        setVideoVolume(100);
        setAudioVolume(1);
        if (duo.phase === "mixin") duo.phase = "track";
      },
      wait + (fade ? XF * 1000 : 0) + 100,
    );
    scheduleOut(TRACK + wait / 1000);
    track("samples_mix_in", { bpm: bpmOf(i), pre: pre, fade: fade });
  }
  // Fin de la minute : le sample suivant entre pendant que le morceau sort.
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

  // ---------- Extraits audio (Cloudflare R2) : moteur Web Audio ----------
  // 19/11 : les samples sont joués depuis de courts extraits (AAC, ~s0 − 4 s → s1 + 4 s) au lieu des
  // iframes YouTube : vrais fondus partout (iPhone compris, le gain d'un AudioContext n'est pas bloqué
  // comme <audio>.volume), démarrage au toucher, aucune vidéo affichée. YouTube reste le secours (item
  // sans extrait, ou extrait introuvable). Temps YouTube t → temps dans l'extrait : t − x0.
  var XBASE =
      "https://infra180-api.pages.dev/audio/assets/music/streams/samples/",
    SMPXF = 2, // fondu croisé entre deux samples
    MAXBUF = 3, // extraits décodés gardés en mémoire
    LOOK = 1.2; // avance (s) avec laquelle une transition est programmée sur l'horloge audio
  var eng = {
    ctx: null,
    bufs: {},
    lru: [],
    voices: [],
    cur: null,
    hold: null,
    on: false,
    paused: false,
    armed: false,
    gen: 0,
    tick: 0,
  };
  function noop() {}
  function audioCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  // À appeler DANS le geste (clic, touche) : sur iPhone, l'AudioContext ne démarre qu'ainsi.
  function ensureCtx() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback"; // ignore le bouton silencieux
    } catch (_e) {}
    var AC = audioCtor();
    if (!AC) return null;
    if (!eng.ctx)
      try {
        eng.ctx = new AC();
      } catch (_e) {
        return null;
      }
    if (eng.ctx.state !== "running") {
      try {
        var p = eng.ctx.resume();
        if (p && p.catch) p.catch(noop);
      } catch (_e) {}
      try {
        // un son vide joué pendant le geste déverrouille la sortie (anciens iOS)
        var s = eng.ctx.createBufferSource();
        s.buffer = eng.ctx.createBuffer(1, 1, 22050);
        s.connect(eng.ctx.destination);
        s.start(0);
      } catch (_e) {}
    }
    return eng.ctx;
  }
  // Parties jouées d'un item : ses passages (Samples, Acapella) ou les parties de l'enchaînement (Mix).
  function segsOf(i) {
    if (i.segs) return i.segs;
    if (!i._segs) {
      var S = 0,
        out = [];
      (i.p || [[i.s0, i.s1]]).forEach(function (q, qi) {
        var x = i.x ? i.x[qi] || null : null,
          a = Number(q && q[0]),
          b = Number(q && q[1]);
        if (!(b > a) && x) {
          a = x[1];
          b = x[1] + x[2];
        }
        if (!(b > a)) return;
        out.push({ y: i.y, s0: a, s1: b, ci: 0, from: S, x: x });
        S += b - a;
      });
      i._segs = out;
    }
    return i._segs;
  }
  function useEng(i) {
    if (!i || i.noX || !audioCtor()) return false;
    var segs = segsOf(i);
    return (
      segs.length > 0 &&
      segs.every(function (sg) {
        return !!sg.x;
      })
    );
  }
  function segsLen(segs) {
    return segs.reduce(function (a, sg) {
      return a + sg.s1 - sg.s0;
    }, 0);
  }
  function xUrl(name) {
    return XBASE + encodeURIComponent(name) + ".m4a";
  }
  function decode(ab) {
    var c = eng.ctx || ensureCtx();
    return new Promise(function (res, rej) {
      if (!c) return rej(new Error("no audio"));
      var p = c.decodeAudioData(ab, res, rej); // forme à rappels : anciens Safari
      if (p && p.then) p.then(res, rej);
    });
  }
  // fetch → arrayBuffer → decodeAudioData ; au plus MAXBUF extraits gardés (le plus ancien sort, sauf
  // celui qu'on entend ou qu'on reprendra après une pause). Pas de Range : le service worker laisse passer.
  function getBuf(name) {
    var e = eng.bufs[name];
    if (!e) {
      e = eng.bufs[name] = {
        p: fetch(xUrl(name), { mode: "cors", credentials: "omit" })
          .then(function (r) {
            if (!r.ok) throw new Error("extrait " + r.status);
            return r.arrayBuffer();
          })
          .then(decode),
      };
      e.p.catch(function () {
        if (eng.bufs[name] === e) delete eng.bufs[name];
        var j = eng.lru.indexOf(name);
        if (j >= 0) eng.lru.splice(j, 1);
      });
    }
    var j = eng.lru.indexOf(name);
    if (j >= 0) eng.lru.splice(j, 1);
    eng.lru.push(name);
    var keepNames = eng.voices
      .map(function (v) {
        return v.name;
      })
      .concat(eng.hold ? [eng.hold.name, name] : [name]);
    for (var k = 0; eng.lru.length > MAXBUF && k < eng.lru.length;) {
      var old = eng.lru[k];
      if (keepNames.indexOf(old) >= 0) k++;
      else {
        eng.lru.splice(k, 1);
        delete eng.bufs[old];
      }
    }
    return e.p;
  }
  // Fondu à puissance égale (entrée en sinus, sortie en cosinus), en paliers linéaires sur l'horloge audio.
  function shape(a, b, p) {
    return b > a
      ? a + (b - a) * Math.sin((p * Math.PI) / 2)
      : b + (a - b) * Math.cos((p * Math.PI) / 2);
  }
  function gainAt(v, t) {
    var r = v.gv;
    if (!r) return 1;
    if (t <= r.when) return r.from;
    if (t >= r.when + r.dur) return r.to;
    return shape(r.from, r.to, (t - r.when) / r.dur);
  }
  function setCurve(v, from, to, when, dur) {
    var gp = v.g.gain,
      now = eng.ctx.currentTime,
      n = 16;
    dur = Math.max(0.02, dur);
    when = Math.max(now, when);
    var nowV = gainAt(v, now);
    gp.cancelScheduledValues(0);
    gp.setValueAtTime(nowV, now);
    gp.setValueAtTime(from, Math.max(now, when));
    for (var k = 1; k <= n; k++)
      gp.linearRampToValueAtTime(shape(from, to, k / n), when + (dur * k) / n);
    v.gv = { from: from, to: to, when: when, dur: dur };
  }
  // Temps YouTube entendu par une voix, et instant (horloge audio) où elle atteindra le temps YouTube t.
  function ytNow(v) {
    if (!v) return 0;
    return v.x0 + v.off + Math.max(0, eng.ctx.currentTime - v.at);
  }
  function ctxAt(v, t) {
    return v.at + (t - v.x0 - v.off);
  }
  function startVoice(buf, item, k, ytFrom, when, fade) {
    var c = eng.ctx,
      sg = segsOf(item)[k],
      g = c.createGain(),
      s = c.createBufferSource();
    s.buffer = buf;
    s.connect(g);
    g.connect(c.destination);
    var v = {
      s: s,
      g: g,
      item: item,
      k: k,
      sg: sg,
      name: sg.x[0],
      x0: sg.x[1],
      off: clamp(ytFrom - sg.x[1], 0, Math.max(0, buf.duration - 0.05)),
      at: when,
      gv: { from: 0, to: 0, when: 0, dur: 0.02 }, // muette jusqu'à son départ
    };
    g.gain.value = 0;
    setCurve(v, 0, 1, when, fade);
    s.onended = function () {
      var j = eng.voices.indexOf(v);
      if (j >= 0) eng.voices.splice(j, 1);
      try {
        g.disconnect();
      } catch (_e) {}
      if (eng.cur === v && !v.done) engEnded(v);
    };
    s.start(when, v.off);
    eng.voices.push(v);
    return v;
  }
  function fadeOutVoice(v, when, dur) {
    if (!v || v.done) return;
    v.done = true;
    setCurve(v, gainAt(v, when), 0, when, dur);
    try {
      v.s.stop(when + Math.max(0.02, dur) + 0.05);
    } catch (_e) {}
    if (eng.cur === v) eng.cur = null;
  }
  // Coupe tout ce que joue le moteur (fondu court) ; les chargements en cours sont oubliés.
  function engHush(d) {
    eng.gen++;
    eng.armed = false;
    eng.loading = false;
    if (!eng.ctx) return;
    var now = eng.ctx.currentTime;
    eng.voices.slice().forEach(function (v) {
      fadeOutVoice(v, now, d);
    });
    eng.cur = null;
  }
  function engStop(d) {
    eng.on = false;
    eng.paused = false;
    eng.hold = null;
    engHush(d == null ? 0.15 : d);
  }
  // Joue la partie k de l'item à partir du temps YouTube ytFrom ; fondu croisé de xf s avec ce qui
  // joue, à l'instant « when » de l'horloge audio (maintenant par défaut).
  function engStart(item, k, ytFrom, xf, when) {
    var gen = ++eng.gen,
      sg = segsOf(item)[k];
    eng.on = true;
    eng.paused = false;
    eng.hold = null;
    ensureCtx();
    eng.loading = true;
    var t0 = Date.now();
    getBuf(sg.x[0]).then(
      function (buf) {
        if (gen !== eng.gen || !sheet || sheet.hidden) return;
        eng.loading = false;
        var now = eng.ctx.currentTime,
          at = Math.max(now + 0.02, when || 0),
          d = xf || 0.05;
        if (eng.cur) fadeOutVoice(eng.cur, at, d);
        eng.cur = startVoice(buf, item, k, ytFrom, at, d);
        eng.armed = false;
        if (
          !trackPhase() &&
          Date.now() >= duo.outroUntil &&
          duo.phase !== "pre"
        )
          pauseMusic();
        if (Date.now() - t0 > 1500)
          track("samples_audio_slow", { ms: Date.now() - t0 });
        engPreload(item, k);
        setTimeout(paintBar, 30);
      },
      function () {
        if (gen !== eng.gen) return;
        eng.loading = false;
        engFail(item, k);
      },
    );
  }
  // Précharge ce qui vient après : la partie suivante, sinon le premier extrait du son suivant.
  function engPreload(item, k) {
    var segs = segsOf(item),
      nxt = segs[k + 1];
    if (!nxt) {
      var list = shownList(),
        n = list[list.indexOf(item) + 1];
      if (n && useEng(n)) nxt = segsOf(n)[0];
    }
    if (nxt && nxt.x) getBuf(nxt.x[0]).catch(noop);
  }
  // Extrait introuvable (404, réseau) : cet item repasse par YouTube, comme avant.
  function engFail(item, k) {
    track("samples_audio_fail", { mode: st.mix ? "mix" : "samples" });
    item.noX = true;
    engStop(0.1);
    if (!sheet || sheet.hidden || st.list[st.pos] !== item) return;
    play(item, true, false, st.mix ? segsOf(item)[k].from : 0);
  }
  function engPause() {
    var v = eng.cur;
    if (v) eng.hold = { item: v.item, k: v.k, t: ytNow(v), name: v.name };
    engHush(0.08);
    eng.paused = true;
    yt.state = 2;
  }
  function engResume() {
    ensureCtx();
    var h = eng.hold,
      cur = st.list[st.pos];
    if (h && h.item === cur) {
      if (st.mix) {
        duo.k = h.k;
        duo.end = segsOf(cur)[h.k].s1;
      }
      engStart(h.item, h.k, h.t, 0.08);
    } else if (cur) play(cur, false, false, 0);
  }
  function engSeek(item, t) {
    var segs = segsOf(item),
      loc = locate({ segs: segs }, t),
      y = segs[loc.k].s0 + loc.local;
    yt.time = y;
    if (st.mix) {
      duo.k = loc.k;
      duo.end = segs[loc.k].s1;
    }
    if (eng.paused) {
      eng.hold = { item: item, k: loc.k, t: y, name: segs[loc.k].x[0] };
      return;
    }
    engStart(item, loc.k, y, 0.06);
  }
  // Fin naturelle de l'extrait sans transition programmée (onglet en arrière-plan…).
  function engEnded(v) {
    eng.cur = null;
    if (st.mix) {
      if (duo.phase === "sample" && !isLastSeg()) {
        if (!eng.armed) {
          eng.armed = true;
          nextSeg();
        }
      } else if (duo.phase === "sample" || duo.phase === "pre") mixIn();
      return;
    }
    if (!eng.armed) engAuto(v);
  }
  // Fin d'un sample (Samples, Acapella) : le suivant entre en fondu croisé de SMPXF s.
  function engAuto(v) {
    eng.armed = true;
    var list = shownList(),
      next = list[list.indexOf(v.item) + 1],
      now = eng.ctx.currentTime;
    if (!next) {
      if (eng.cur === v)
        fadeOutVoice(v, Math.max(now, ctxAt(v, v.sg.s1 - 0.5)), 1);
      return;
    }
    if (!useEng(next)) {
      // son suivant sans extrait : YouTube prend le relais à la fin de celui-ci
      var ms = Math.max(0, (ctxAt(v, v.sg.s1) - now) * 1000);
      setTimeout(function () {
        if (eng.on && st.list[st.pos] === v.item && !eng.paused) play(next);
      }, ms);
      return;
    }
    play(next, false, false, 0, ctxAt(v, v.sg.s1 - SMPXF / 2));
  }
  // Toutes les 100 ms : position, puis transitions programmées à l'avance sur l'horloge audio.
  function engTick() {
    if (!eng.on || !eng.ctx || !sheet || sheet.hidden) return;
    var v = eng.cur;
    if (eng.paused || !v || v.item !== st.list[st.pos]) return;
    var tp = ytNow(v),
      sg = v.sg,
      last = v.k >= segsOf(v.item).length - 1;
    yt.time = tp;
    yt.state = 1;
    if (st.mix) {
      if (duo.phase !== "sample" && duo.phase !== "pre") return;
      if (!last) {
        if (!eng.armed && sg.s1 - tp < SEGXF / 2 + LOOK) {
          eng.armed = true;
          nextSeg();
        }
        return;
      }
      if (
        duo.phase === "sample" &&
        tp >= duo.end - XF - LEAD &&
        tp < duo.end - XF
      )
        preroll();
      if (tp >= duo.end - XF) mixIn();
      return;
    }
    if (eng.armed) return;
    if (!last) {
      if (sg.s1 - tp < SEGXF / 2 + LOOK) {
        eng.armed = true;
        var nk = v.k + 1,
          ns = segsOf(v.item)[nk];
        engStart(
          v.item,
          nk,
          Math.max(ns.x[1], ns.s0 - SEGXF / 2),
          SEGXF,
          ctxAt(v, sg.s1 - SEGXF / 2),
        );
        track("samples_part", { k: nk, n: segsOf(v.item).length });
      }
      return;
    }
    if (sg.s1 - tp < SMPXF / 2 + LOOK) engAuto(v);
  }
  // Pochette affichée à la place de la vidéo : celle du sample (assets/samples/<y>.webp) si elle existe.
  function smpCover(smp, cur) {
    return smp && smp.c
      ? assetUrl("assets/samples/" + smp.y + ".webp")
      : assetUrl(cur.cover);
  }

  function onSheetClick(e) {
    ensureCtx();
    var t = e.target;
    if (t === sheet || (t.closest && t.closest("[data-smp-close]")))
      return close();
    if (!t.closest) return;
    var row = t.closest("[data-smp-i]");
    if (row) return play(st.list[Number(row.getAttribute("data-smp-i"))]);
    if (t.closest("[data-smp-prev]")) return prev();
    if (t.closest("[data-smp-next]")) return step(1);
    if (t.closest("[data-smp-pp]")) return toggle();
    // « Sample » : le sample reprend au début ; nom du morceau : saut à ton morceau (INFRA, 19/11).
    var jump = t.closest("[data-smp-jump]");
    if (jump) {
      var cj = st.list[st.pos];
      if (!cj) return;
      var to = jump.getAttribute("data-smp-jump");
      track("samples_jump", { to: to === "1" ? "track" : "sample" });
      if (to === "1") return seekTo(cj.S || Math.max(1, cj.s1 - cj.s0));
      var ci = Number(to.slice(1)) || 0,
        first = (cj.segs || []).filter(function (sg) {
          return sg.ci === ci;
        })[0];
      return seekTo(first ? first.from : 0);
    }
    var sb = t.closest("[data-smp-sortv]");
    if (sb)
      return setSortHere(pickSort(st.sort, sb.getAttribute("data-smp-sortv")));
  }

  // Clics dans l'onglet Samples
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest || !data) return;
    var sec = t.closest("[data-smp-sec]");
    if (sec) {
      var want = sec.getAttribute("data-smp-sec");
      pref.sec = want === "mix" || want === "voix" ? want : "samples";
      save();
      track("samples_section", { sec: pref.sec });
      return rerender();
    }
    var sb = t.closest("[data-smp-sortv]");
    if (sb && sb.getAttribute("data-smp-sortscope") === "all") {
      var mixNow = pref.sec === "mix";
      var v = pickSort(
        sortFor(mixNow, "all"),
        sb.getAttribute("data-smp-sortv"),
      );
      setSort(mixNow, "all", v);
      track("samples_sort", { sort: v, scope: "all", mode: pref.sec });
      return rerender();
    }
    if (t.closest("[data-smp-all]")) {
      var mix = pref.sec === "mix";
      return open(
        mix ? all() : all().filter(keep(mix, secVoix())),
        mix
          ? "Tout le Mix"
          : pref.sec === "voix"
            ? "Toutes les voix"
            : "Tous les samples",
        "all",
      );
    }
    var al = t.closest("[data-smp-album]");
    if (al) {
      var a = data.albums[Number(al.getAttribute("data-smp-album"))];
      if (a) open(a.items.slice(), a.title, "album", a);
    }
  });

  function same(x, y) {
    var n = function (v) {
      return String(v || "")
        .normalize("NFC")
        .trim()
        .toLocaleUpperCase("fr");
    };
    return n(x) === n(y);
  }
  // Afficher les samples d'un morceau (avec les voix), pour le futur clic droit › Afficher les samples.
  function openTrack(albumTitle, trackTitle) {
    ensureCtx(); // encore dans le geste (clic droit › Afficher les samples)
    return load().then(function () {
      // Le grand lecteur écrit titres et albums en majuscules (« HE 4.0026 », « V-23Π56 ») : comparaison sans casse.
      var a = data.albums.filter(function (x) {
        return same(x.title, albumTitle);
      })[0];
      if (!a) return false;
      var items = a.items.filter(function (i) {
        return same(i.track, trackTitle);
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
    same: same,
    close: close,
    // état du moteur audio, pour les vérifications (aucune donnée privée)
    audioState: function () {
      return {
        ctx: eng.ctx ? eng.ctx.state : "",
        time: eng.ctx ? eng.ctx.currentTime : 0,
        on: eng.on,
        paused: eng.paused,
        loading: !!eng.loading,
        bufs: Object.keys(eng.bufs),
        yt: yt.time,
        phase: duo.phase,
        k: duo.k,
        voices: eng.voices.map(function (v) {
          return {
            name: v.name,
            k: v.k,
            gain: v.g.gain.value,
            yt: ytNow(v),
            cur: v === eng.cur,
          };
        }),
      };
    },
  };
})();
