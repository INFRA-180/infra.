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
  var pref = { sec: "samples", voix: false, sort: {}, mixo: null };
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
      // options du Mix (durée, effet), 20/11 : validées à la lecture par mixOpts()
      if (saved.mixo && typeof saved.mixo === "object") pref.mixo = saved.mixo;
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
        when = v && v.item === item ? ctxAt(v, before.s1 - SEGXF / 2) : null;
      duo.k = k;
      duo.end = sg.s1;
      duo.armed = false;
      duo.segAt = Date.now();
      engStart(
        item,
        k,
        Math.max(sg.x[1], sg.s0 - SEGXF / 2),
        planOf("seg", item, item, { dur: SEGXF, when: when, k: k }),
      );
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
      ".sx-allrow{display:flex;align-items:center;gap:4px;margin-bottom:16px}",
      ".sx-all{display:flex;align-items:center;gap:12px;min-height:58px;padding:6px 8px 6px 0;border:0;background:none;font:inherit;color:var(--ink,#111);text-align:left;cursor:pointer}",
      ".sx-allic{display:grid;place-items:center;width:28px;height:28px;color:var(--ink,#111);transition:transform .2s}",
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
      // Rouge (T bis 8, 20/11) : seulement la partie sample de la barre, ton plus doux. Valeur réglée dans
      // samples-mix.css (--sx-red) ; le repli ici sert avant le chargement de ce fichier.
      ".sx-seg.s i{background:var(--sx-red,#e5605f)}",
      ".sx-knob{position:absolute;top:6px;left:0;width:3px;height:16px;margin-left:-1.5px;background:#fff;pointer-events:none}",
      ".sx-times{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums}",
      ".sx-leg{display:flex;gap:3px;margin-top:6px;font-size:13px}",
      ".sx-leg button{min-width:0;border:0;background:none;padding:6px 0;margin:-6px 0;font:inherit;text-align:left;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:rgba(255,255,255,.4)}",
      ".sx-leg button:hover{color:rgba(255,255,255,.75)}",
      ".sx-leg button.on{color:#fff;font-weight:700}",
      ".sx-leg button.s.on{color:#fff}",
      // INFRA, 19/11 : pas de barre de défilement dans le lecteur (on fait défiler, c'est tout)
      ".smp-sheet .sx-panel,.smp-sheet .sx-queue{scrollbar-width:none;-ms-overflow-style:none}",
      ".smp-sheet .sx-panel::-webkit-scrollbar,.smp-sheet .sx-queue::-webkit-scrollbar{display:none;width:0;height:0}",
      ".sx-info{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 14px;width:100%;font-size:13px;color:rgba(255,255,255,.6)}",
      ".sx-info .sx-pas{font-variant-numeric:tabular-nums}",
      ".sx-leg .sx-go{flex:none;max-width:100%;margin:-6px 0;padding:6px 0;color:#fff;font-weight:400}",
      ".sx-leg .sx-go b{font-weight:700}",
      ".sx-leg .sx-go:hover{color:#fff;text-decoration:underline}",
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
      ".sx-fs .smp-row.on b{color:#fff;font-weight:800}",
      ".sx-fs .smp-grp{color:rgba(255,255,255,.5)}",
      ".sx-rb{flex:none;min-width:34px;text-align:right;font-family:'Antique Olive','Helvetica Neue',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,.85);font-variant-numeric:tabular-nums}",
      ".sx-fs .smp-row em{font-style:normal;font-size:12px;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums;flex:none;min-width:30px;text-align:right}",
      // Ordinateur : image et commandes au centre, « À suivre » à droite (comme la file du grand lecteur).
      "@media (min-width:980px){.sx-fs{--w:min(440px,54vh,calc(50vw - 120px))}.sx-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);grid-template-rows:auto minmax(0,1fr);column-gap:clamp(32px,5vw,80px);overflow:hidden;padding:20px clamp(28px,4vw,72px) 24px}.sx-top{grid-column:1/-1;max-width:none;margin:0}.sx-main{align-self:center;justify-self:center;width:var(--w)}.sx-queue{max-width:none;margin:0;overflow:auto;overscroll-behavior:contain;min-height:0;align-self:stretch;padding-right:4px}.sx-title{font-size:clamp(1.4rem,1.2vw + .8rem,2rem)}}",
      "@media (prefers-reduced-motion:reduce){.sx-cov,.sx-allic,.sx-ctr>button,.smp-sheet.sx-fs{transition:none}}",
    ].join("\n");
    document.head.appendChild(s);
    // Barre de pictos, page Mix, menu ⋯ du Mix, transitions et repère de voix (T bis, 20/11) : leur style
    // et leur comportement vivent à part (samples-mix.css, samples-mix-ui.js), chargés ici, après ce style.
    var tag = window.INFRA_BUILD_TAG
      ? "?v=" + encodeURIComponent(window.INFRA_BUILD_TAG)
      : "";
    var link = document.createElement("link");
    link.id = "sx-mix-css";
    link.rel = "stylesheet";
    link.href = assetUrl("assets/css/samples-mix.css") + tag;
    document.head.appendChild(link);
    // Règles du Mix (durée, hasard qui écoute, courbes) : samples-mix-core.js ; le moteur a un repli identique.
    if (!window.InfraSamplesMixCore) {
      var mc = document.createElement("script");
      mc.src = assetUrl("assets/js/samples-mix-core.js") + tag;
      mc.async = true;
      document.head.appendChild(mc);
    }
    if (!window.InfraSamplesUI) {
      var ui = document.createElement("script");
      ui.src = assetUrl("assets/js/samples-mix-ui.js") + tag;
      ui.async = true;
      document.head.appendChild(ui);
    }
  }

  // ---------- Page (onglet Samples) ----------
  // Barre de pictos collée en haut (T bis 5 et 7, 20/11) : vinyle · deux ondes croisées · micro. Le choisi
  // est plein, son nom dessous ; les autres en trait gris, sans nom ; aucun fond ni rond derrière.
  // Style : samples-mix.css ; touches 1/2/3 et glisser entre sections : samples-mix-ui.js.
  var TAB_DIM = ' width="26" height="26"';
  var TABS = [
    {
      k: "samples",
      name: "Samples",
      hint: "Les morceaux d’origine, en playlist",
      line: svg(
        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2"/>',
        TAB_DIM + LINE,
      ),
      full: svg(
        '<defs><mask id="sx-m-vinyl"><rect width="24" height="24" fill="#fff"/><circle cx="12" cy="12" r="2.3" fill="#000"/><path d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round"/></mask></defs><circle cx="12" cy="12" r="9.95" fill="currentColor" mask="url(#sx-m-vinyl)"/>',
        TAB_DIM,
      ),
    },
    {
      k: "mix",
      name: "Mix",
      hint: "Le passage samplé, puis ton morceau là où il entre",
      line: svg(
        '<path d="M2.5 7c6 0 7 10 19 10"/><path d="M2.5 17c6 0 7-10 19-10"/>',
        TAB_DIM + LINE,
      ),
      full: svg(
        '<path d="M2.5 7c6 0 7 10 19 10"/><path d="M2.5 17c6 0 7-10 19-10"/>',
        TAB_DIM + LINE.replace('stroke-width="1.9"', 'stroke-width="3"'),
      ),
    },
    {
      k: "voix",
      name: "A cappella",
      hint: "Les voix que tu as reprises, seules",
      line: svg(
        '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
        TAB_DIM + LINE,
      ),
      full: svg(
        '<rect x="8.6" y="2.6" width="6.8" height="11.8" rx="3.4" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke-width="2.4"/>',
        TAB_DIM + LINE,
      ),
    },
  ];
  var DOTS = svg(
    '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
    ' width="24" height="24" fill="currentColor"',
  );
  function moreBtn() {
    return (
      '<button type="button" class="sx-more" data-sx-mixmore aria-haspopup="menu" aria-label="Options du Mix" title="Options du Mix">' +
      DOTS +
      "</button>"
    );
  }
  function tabsHtml(sec) {
    return (
      '<div class="sx-tabs" role="tablist" aria-label="Samples, Mix ou A cappella" data-sx-tabs>' +
      TABS.map(function (t, i) {
        var on = sec === t.k;
        return (
          '<button type="button" role="tab" class="sx-tab' +
          (on ? " on" : "") +
          '" data-smp-sec="' +
          t.k +
          '" aria-selected="' +
          on +
          '" tabindex="' +
          (on ? 0 : -1) +
          '" aria-label="' +
          t.name +
          '" title="' +
          t.name +
          " (" +
          (i + 1) +
          ") · " +
          t.hint +
          '"><span class="sx-tab-ic">' +
          (on ? t.full : t.line) +
          "</span>" +
          (on
            ? '<span class="sx-tab-name" aria-hidden="true">' +
              t.name +
              "</span>"
            : "") +
          "</button>"
        );
      }).join("") +
      (sec === "mix" ? moreBtn() : "") +
      "</div>"
    );
  }
  // Page Mix (T bis 6) : pile des 3 prochaines pochettes (toucher = lancer « Tout le Mix »), le nombre
  // d'enchaînements et l'écart de tempo, BPM / aléatoire (V1), ligne des réglages « ≈ Auto · Fondu › ».
  function mixHead(pool) {
    var sort = sortFor(true, "all"),
      order =
        sort === "bpm" || sort === "bpmdown"
          ? byTempo(pool, sort === "bpmdown")
          : sort === "shuffle"
            ? shuffle(pool)
            : pool,
      covers = [],
      bpms = pool.map(bpmOf).filter(Boolean);
    order.forEach(function (c) {
      if (covers.length < 3 && c.cover && covers.indexOf(c.cover) < 0)
        covers.push(c.cover);
    });
    var ui = window.InfraSamplesUI;
    return (
      '<div class="sx-mixhead"><button type="button" class="sx-stack" data-smp-all aria-label="Lancer tout le Mix" title="Lancer tout le Mix">' +
      covers
        .map(function (c, k) {
          return (
            '<img class="sx-stack-c" style="--k:' +
            k +
            '" src="' +
            esc(assetUrl(c)) +
            '" alt="" decoding="async">'
          );
        })
        .reverse()
        .join("") +
      '<span class="sx-stack-play">' +
      PLAY +
      "</span></button>" +
      '<div class="sx-mixinfo"><button type="button" class="sx-mixtitle" data-smp-all tabindex="-1" aria-hidden="true"><b>Tout le Mix</b><small>' +
      pool.length +
      " enchaînements" +
      (bpms.length
        ? " · " +
          Math.min.apply(null, bpms) +
          " → " +
          Math.max.apply(null, bpms) +
          " BPM"
        : "") +
      '</small></button><div class="sx-mixrow"><span class="sx-sorts">' +
      sortBtns(sort, "all") +
      '</span><button type="button" class="sx-opts" data-sx-mixopts aria-haspopup="menu" aria-label="Options du Mix" title="Options du Mix">' +
      (ui && ui.optsLine ? ui.optsLine() : "") +
      "</button></div></div></div>"
    );
  }
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
      tabsHtml(pref.sec) +
      (mix
        ? mixHead(pool)
        : '<div class="sx-allrow"><button type="button" class="sx-all" data-smp-all><span class="sx-allic">' +
          PLAY +
          "</span><span><b>" +
          (voixSec ? "Toutes les voix" : "Tous les samples") +
          "</b><small>" +
          pool.length +
          (voixSec ? " voix" : " samples") +
          "</small></span></button>" +
          sortBtns(sortFor(mix, "all"), "all") +
          "</div>") +
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
    panel.innerHTML = '<div class="sx-page" data-sx-page>' + html + "</div>";
    if (window.InfraSamplesUI && window.InfraSamplesUI.afterRender)
      window.InfraSamplesUI.afterRender(panel);
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
      // ⋯ du Mix (T bis) : affiché seulement en lecture Mix, par samples-mix-ui.js
      moreBtn().replace("<button ", "<button hidden ") +
      '<button type="button" class="sx-x" data-smp-close aria-label="Fermer" title="Fermer (Échap)">' +
      svg('<path d="M6 6l12 12M18 6L6 18"/>', LINE) +
      "</button></span></div>" +
      '<div class="sx-main">' +
      '<div class="sx-art"><div class="sx-vid"><iframe data-smp-alt title="Sample suivant" tabindex="-1" aria-hidden="true" allow="autoplay; encrypted-media"></iframe><iframe data-smp-frame title="Sample" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<img class="sx-cov" data-smp-cov alt="">' +
      // transition du Mix : la pochette suivante glisse sur l'actuelle, picto de l'effet sur le bord
      '<div class="sx-xf" data-sx-xf aria-hidden="true"><img alt=""><span class="sx-xf-edge"><i class="sx-xf-fx"></i></span></div></div>' +
      '<div class="sx-meta"><div class="sx-mt"><b class="sx-title" data-smp-t dir="auto"></b>' +
      '<small data-smp-a dir="auto"></small></div>' +
      '<div class="sx-bpm" data-smp-bpm title="Tempo du morceau"><b></b><small>BPM</small></div></div>' +
      '<div class="sx-bar" data-smp-bar role="slider" aria-label="Position" tabindex="0"><div class="sx-trk" data-smp-trk></div><i class="sx-knob" data-smp-knob></i></div>' +
      '<div class="sx-times"><span data-smp-t0>0:00</span><span data-smp-t1></span></div>' +
      '<div class="sx-leg" data-smp-leg></div>' +
      // A cappella : mini-ligne de ton morceau, micro à l'entrée de la voix (rempli par samples-mix-ui.js)
      '<div class="sx-vmark" data-sx-vmark hidden></div>' +
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
    bindSwipeClose();
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
    var plan = transition(
      {
        set: function (v) {
          sendTo(old, "setVolume", [Math.round(v * 100)]);
        },
      },
      {
        set: function (v) {
          sendTo(nf, "setVolume", [Math.round(v * 100)]);
        },
      },
      planOf("seg", duo.item, duo.item, { dur: SEGXF, k: duo.k }),
    );
    clockAt(plan.when + SEGXF + 0.3, function () {
      if (old !== frame() && !nx.item) {
        sendTo(old, "stopVideo");
        old.removeAttribute("src");
      }
    });
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
  function open(list, title, scope, album, voix, cue) {
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
    if (cue && !st.mix) {
      // rien ne joue : le premier son est prêt, la liste montre les morceaux de l'album
      st.cued = true;
      st.pos = st.list.indexOf(first);
      paint(true);
      paintNow();
    } else play(first, true);
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
    evFlush(); // l'interface sait que la transition en cours s'arrête
    clockClear();
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
    st.cued = false;
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
  // plan : transition préparée par planOf() (instant sur l'horloge audio, durée, effet), pour un
  // enchaînement automatique ; sinon passage manuel (fondu SMPXF), saut ou premier son.
  function play(item, fresh, fadeIn, offset, plan) {
    var f = frame();
    if (!f || !item) return;
    st.cued = false;
    var useE = useEng(item),
      hadVoice = !!(eng.on && eng.cur && !eng.paused),
      prevItem = st.list[st.pos];
    dropNext();
    stopDuo(!fadeIn && trackPhase());
    var fade = fadeIn && canFade();
    if (fadeIn) {
      // morceau → sample : le morceau sort pendant que le sample entre (iPhone : coupe nette)
      plan = plan || planOf("out", prevItem, item);
      duo.outroUntil = Date.now() + plan.dur * 1000 + 1500;
      // extrait : il entre par son propre gain (moteur, dans engStart) ; ton morceau sort par le volume
      transition(
        fade ? { set: setAudioVolume } : null,
        useE || !fade
          ? null
          : {
              set: function (v) {
                setVideoVolume(v * 100);
              },
            },
        plan,
      );
      clockAt(plan.when + (fade ? plan.dur + 0.1 : 0.9), function () {
        pauseMusic();
        setAudioVolume(1);
      });
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
        xf = plan ? plan.dur : !hadVoice ? 0 : offset ? 0.06 : SMPXF,
        from = sg0.s0 + loc0.local;
      if (!offset && xf) from = Math.max(sg0.x[1], sg0.s0 - xf / 2); // marge de l'extrait
      yt.time = from;
      engStart(
        item,
        loc0.k,
        from,
        plan ||
          planOf(offset ? "seek" : hadVoice ? "skip" : "first", prevItem, item, {
            dur: xf,
            k: loc0.k,
          }),
      );
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
      : infoHtml(cur);
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
  // Samples / Acapella (INFRA, 19/11) : quel passage de l'original a été samplé, où il entre dans ton morceau,
  // et un bouton pour y aller.
  function infoHtml(cur) {
    if (!cur) return "";
    var parts = (cur.p && cur.p.length ? cur.p : [[cur.s0, cur.s1]]).filter(
      function (q) {
        return isFinite(q[0]) && isFinite(q[1]) && q[1] > q[0];
      },
    );
    var pas = parts.length
      ? (parts.length > 1 ? "Passages " : "Passage ") +
        parts
          .map(function (q) {
            return mmss(q[0]) + " → " + mmss(q[1]);
          })
          .join(" · ") +
        " de l’original"
      : "";
    var go = cur.src
      ? '<button type="button" class="sx-go" data-smp-goto title="Écouter ton morceau à cet endroit" dir="auto">' +
        (isFinite(cur.at) ? "Entre à " + mmss(cur.at) + " dans " : "Aller à ") +
        "<b>" +
        esc(cur.track) +
        "</b> ›</button>"
      : "";
    return (
      '<div class="sx-info">' +
      (pas ? '<span class="sx-pas">' + pas + "</span>" : "") +
      go +
      "</div>"
    );
  }
  // « Aller au morceau » : ferme le lecteur de samples et lance ton morceau à l'entrée du sample.
  function goToTrack(cur) {
    var lib = window.InfraLibraryPlayback;
    if (!cur || !cur.src || !lib || typeof lib.playPaths !== "function") return;
    var at = isFinite(cur.at) ? Math.max(0, cur.at) : 0;
    track("samples_goto", { at: Math.round(at) });
    close();
    var seek = function () {
      var el = audioEl();
      if (el && at && Math.abs(el.currentTime - at) > 0.4)
        try {
          el.currentTime = at;
        } catch (_e) {}
    };
    if (at) onNextPlaying(audioEl(), seek);
    if (!lib.playPaths([cur.src], 0)) dropPlaying();
  }
  // Rapport terrain 20/11 (§ 3a, bugs 1-2) : un seul écouteur « playing » en attente à la fois. Le précédent
  // est retiré, et il expire s'il ne vient jamais (sinon il recalait plus tard un autre morceau).
  var waitPlaying = null;
  function onNextPlaying(a, fn) {
    dropPlaying();
    if (!a) return;
    var h = function () {
      dropPlaying();
      fn();
    };
    waitPlaying = { a: a, h: h, t: setTimeout(dropPlaying, 20000) };
    a.addEventListener("playing", h);
  }
  function dropPlaying() {
    var w = waitPlaying;
    if (!w) return;
    waitPlaying = null;
    clearTimeout(w.t);
    w.a.removeEventListener("playing", w.h);
  }
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
      covSrc = inTrack || !(eng.on || st.cued) ? assetUrl(cur.cover) : smpCover(smp, cur);
    if (cov.getAttribute("src") !== covSrc) cov.setAttribute("src", covSrc);
    cov.classList.toggle("on", inTrack || eng.on || st.cued);
    $(".sx-vid", sheet).hidden = eng.on || st.cued;
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
    if (st.cued) return play(st.list[st.pos], true);
    if (trackPhase()) {
      var a = audioEl();
      if (!a) return;
      if (a.paused) {
        resumeMusic();
        scheduleOut(Math.max(1, TRACK - (a.currentTime - duo.from)));
      } else {
        clearOut();
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
        // fondu : il commence SEGXF s avant la fin de la partie, pour finir pile à sa fin
        clockAt(
          now() + Math.max(0, duo.end - tp - (canSwapNext() ? SEGXF : 0)),
          function () {
            if (duo.k === kk) nextSeg();
          },
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
  // Attentes de chargement (pas de son) ; tout ce qui s'entend passe par clockAt / clockRamp.
  function later(fn, ms) {
    duo.timers.push(setTimeout(fn, ms));
  }
  // Fin de la minute de ton morceau, comptée sur l'horloge audio.
  function scheduleOut(sec) {
    clearOut();
    duo.out = clockAt(now() + sec, mixOut, "out");
  }
  function clearOut() {
    if (duo.out && typeof duo.out === "object") duo.out.dead = true;
    duo.out = 0;
  }
  function stopDuo(pauseTrack) {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    clockClear("duo");
    clearOut();
    dropPlaying();
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
    if (a) {
      if (hush) a.muted = true;
      onNextPlaying(a, function () {
        seek();
        setTimeout(unhush, 150);
      });
      // Morceau qui finit avant la minute (PHI, MIEL…) : on passe tout de suite au sample suivant.
      if (!a.__smpEnded) {
        a.__smpEnded = true;
        a.addEventListener("ended", function () {
          if (st.mix && trackPhase() && sheet && !sheet.hidden) {
            clearOut();
            mixOut();
          }
        });
      }
    }
    if (!lib.playPaths([i.src], 0)) {
      dropPlaying();
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
    // l'entrée est calée sur l'horloge audio : instant exact de l'extrait, sinon temps YouTube
    var v = eng.on && eng.cur && eng.cur.item === i ? eng.cur : null;
    clockAt(
      v ? ctxAt(v, duo.end - XF) : now() + Math.max(0, duo.end - XF - yt.time),
      mixIn,
    );
  }
  function cancelPre() {
    duo.timers.forEach(clearTimeout);
    duo.timers = [];
    clockClear("duo");
    dropPlaying();
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
    // sample → morceau : toujours « pile et fort » (XF s, sans effet), quel que soit le réglage du Mix
    var wait = pre ? 0 : 1.3,
      plan = planOf("in", i, i, { dur: XF, when: now() + wait });
    var open = function () {
      var el = audioEl();
      if (!el) return;
      if (Math.abs(el.currentTime - base) > 0.1)
        try {
          el.currentTime = base;
        } catch (_e) {}
      // extrait : vrai fondu de sortie par le gain (iPhone compris) ; ton morceau entre comme avant
      var out = eng.on
        ? { all: true }
        : fade
          ? {
              set: function (v) {
                setVideoVolume(v * 100);
              },
            }
          : null;
      if (fade) {
        setAudioVolume(0);
        el.muted = false;
        transition(out, { set: setAudioVolume }, plan);
      } else {
        el.muted = false;
        if (!eng.on) send("pauseVideo");
        transition(out, null, plan);
      }
      paintNow();
    };
    if (wait) clockAt(plan.when, open);
    else open();
    clockAt(plan.when + (fade ? XF : 0) + 0.1, function () {
      send("pauseVideo");
      setVideoVolume(100);
      setAudioVolume(1);
      if (duo.phase === "mixin") duo.phase = "track";
    });
    scheduleOut(TRACK + wait);
    track("samples_mix_in", { bpm: bpmOf(i), pre: pre, fade: fade });
  }
  // Fin de la minute : le sample suivant entre pendant que le morceau sort (durée et effet du Mix).
  function mixOut() {
    var list = shownList(),
      cur = st.list[st.pos],
      next = list[list.indexOf(cur) + 1];
    if (!next) {
      var t = now();
      clockRamp(setAudioVolume, 1, 0, t, 3, "duo", true);
      clockAt(t + 3.2, function () {
        pauseMusic();
        setAudioVolume(1);
      });
      return;
    }
    play(next, false, true, 0, planOf("out", cur, next));
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

  // ---------- Horloge audio (20/11) : tout ce qui s'entend est calé sur ctx.currentTime ----------
  // Ton morceau (<audio> du site) et YouTube ne passent pas par Web Audio : leur volume est réglé par
  // petits pas lus sur la même horloge (20 ms). Si le contexte audio est arrêté (onglet caché, iPhone
  // « interrupted »), chaque tâche retombe sur l'heure murale pour ne jamais rester bloquée.
  var clk = { jobs: [], iv: 0 };
  function ctxNow() {
    var c = eng.ctx;
    return c && c.state === "running" ? c.currentTime : null;
  }
  function now() {
    var t = ctxNow();
    return t != null ? t : performance.now() / 1000;
  }
  function clockJob(j, t, grp) {
    j.t = t;
    j.ctx = ctxNow() != null;
    j.w = Date.now() + (t - now()) * 1000;
    j.grp = grp || "duo";
    clk.jobs.push(j);
    if (!clk.iv) clk.iv = setInterval(clockTick, 20);
    return j;
  }
  // fn à l'instant t de l'horloge audio. Groupes : « duo » (effacé par stopDuo), « out » (fin de la
  // minute de ton morceau), « eng » (moteur), « ev » (événements pour l'interface).
  function clockAt(t, fn, grp) {
    return clockJob({ fn: fn }, t, grp);
  }
  // Volume 0..1 d'un lecteur hors Web Audio : fondu à puissance égale (ou linéaire) de t à t + d.
  function clockRamp(set, from, to, t, d, grp, lin) {
    return clockJob(
      { set: set, from: from, to: to, d: Math.max(0.02, d), lin: !!lin },
      t,
      grp,
    );
  }
  function clockTick() {
    var jobs = clk.jobs,
      keep = [],
      c = ctxNow();
    clk.jobs = [];
    jobs.forEach(function (j) {
      if (j.dead) return;
      var e = j.ctx && c != null ? c - j.t : (Date.now() - j.w) / 1000;
      try {
        if (j.set) {
          if (e < 0) return keep.push(j);
          var p = Math.min(1, e / j.d);
          j.set(j.lin ? j.from + (j.to - j.from) * p : shape(j.from, j.to, p));
          if (p < 1) keep.push(j);
        } else if (e >= 0) {
          j.dead = true;
          j.fn();
        } else keep.push(j);
      } catch (err) {
        setTimeout(function () {
          throw err;
        });
      }
    });
    clk.jobs = keep.concat(clk.jobs).filter(function (j) {
      return !j.dead;
    });
    if (!clk.jobs.length) {
      clearInterval(clk.iv);
      clk.iv = 0;
    }
  }
  function clockClear(grp) {
    clk.jobs.forEach(function (j) {
      if (!grp || j.grp === grp) j.dead = true;
    });
    clk.jobs = clk.jobs.filter(function (j) {
      return !j.dead;
    });
  }

  // ---------- Options du Mix (T bis, validé par INFRA le 20/11) ----------
  // Durée : Aucune · 5 s · Auto (4 mesures) ; effet : Fondu (défaut) · Reverb · Écho · Basses · Hasard
  // qui écoute. Pour sample → sample (Samples, A cappella) et morceau → sample (Mix) ; sample → morceau
  // reste à XF s, « pile et fort ». Les effets ne touchent que la sortie du sample (ton morceau n'y passe
  // pas). Les règles (durée, hasard) viennent de samples-mix-core.js s'il est chargé, sinon du repli.
  var CORE0 = {
    DURATIONS: ["none", "5", "auto"],
    EFFECTS: ["fade", "reverb", "echo", "bass", "listen"],
    DEFAULTS: { dur: "auto", fx: "fade" },
    NONE_S: 0.03,
    transitionSeconds: function (c, bpm, m) {
      if (c === "none") return 0.03;
      var w = c === "5" ? 5 : bpm > 0 ? clamp(960 / bpm, 4, 12) : 8;
      return Math.max(0.03, Math.min(w, 2 * (m >= 0 ? m : 4)));
    },
    resolveEffect: function (fx, a, b) {
      if (fx !== "listen") return fx;
      var g = a > 0 && b > 0 ? Math.abs(a - b) : NaN;
      return !isFinite(g) || g < 4 ? "fade" : g <= 12 ? "bass" : "echo";
    },
  };
  function core() {
    var c = window.InfraSamplesMixCore;
    return c && typeof c.transitionSeconds === "function" ? c : CORE0;
  }
  var ALIAS = {
    aucune: "none",
    0: "none",
    "5s": "5",
    fondu: "fade",
    basses: "bass",
    filtre: "bass",
    hasard: "listen",
    random: "listen",
    "aléatoire": "listen",
    "écho": "echo",
  };
  function normOpt(v, list) {
    var s = String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    s = ALIAS[s] || s;
    return list.indexOf(s) >= 0 ? s : null;
  }
  function mixOpts() {
    var C = core(),
      o = pref.mixo || {};
    return {
      dur: normOpt(o.dur, C.DURATIONS) || C.DEFAULTS.dur,
      fx: normOpt(o.fx, C.EFFECTS) || C.DEFAULTS.fx,
    };
  }
  // Tempo entendu : le sample joue à son tempo d'origine (bpm[0] s'il a été changé), ton morceau à tb.
  function smpTempo(s) {
    return s ? Number(s.bpm && s.bpm[0]) || Number(s.tb) || 0 : 0;
  }
  // Marges réelles des extraits (champ x : [id, début, durée]) : beaucoup n'ont pas 4 s des deux côtés.
  function marginBefore(sg) {
    return sg && sg.x ? Math.max(0, sg.s0 - sg.x[1]) : 60;
  }
  function marginAfter(sg, v) {
    if (!sg || !sg.x) return 60;
    var m = sg.x[1] + sg.x[2] - sg.s1;
    if (v && v.len) m = Math.min(m, v.x0 + v.len - sg.s1);
    return Math.max(0, m);
  }
  var MIXED = { smp: 1, out: 1 },
    EMIT = { smp: 1, out: 1, in: 1, seg: 1, skip: 1 },
    planSeq = 0;
  // Durée et effet réellement joués pour un passage. kind : « smp » (sample → sample), « out » (ton
  // morceau → sample), « in » (sample → morceau), « seg » (partie → partie), « skip » (passage à la main),
  // « seek », « first », « resume ». o : { dur, when, k, voice (voix qui sort, pour sa vraie marge) }.
  function planOf(kind, from, to, o) {
    o = o || {};
    var C = core(),
      opt = mixOpts(),
      dur = o.dur > 0 ? o.dur : 0.05,
      fx = "fade",
      tOut = 0,
      tIn = 0;
    if (MIXED[kind]) {
      var eIn = !!to && useEng(to),
        eOut = false,
        m = 60;
      tOut = kind === "out" ? Number(from && from.tb) || 0 : smpTempo(from);
      tIn = smpTempo(to);
      if (kind === "smp" && from && useEng(from)) {
        var ls = segsOf(from);
        m = marginAfter(ls[ls.length - 1], o.voice);
        eOut = true;
      }
      if (eIn) m = Math.min(m, marginBefore(segsOf(to)[0]));
      else if (to) m = Math.min(m, OVERLAP / 2); // YouTube : fondu court, comme avant
      // iPhone : ton morceau est coupé net ; le sample entre comme avant (OVERLAP s au plus)
      if (kind === "out" && !canFade()) m = Math.min(m, OVERLAP / 2);
      dur = C.transitionSeconds(opt.dur, tOut, m);
      // Extrait sans marge suffisante (la moitié des passages, 20/11) : jamais moins que le fondu validé
      // d'avant (SMPXF / OVERLAP, qui rogne déjà au bord de l'extrait), sauf « Aucune ».
      var base = kind === "smp" ? SMPXF : OVERLAP;
      if (opt.dur !== "none" && dur < base) dur = base;
      fx = C.resolveEffect(opt.fx, tOut, tIn);
      if (dur < 0.1) {
        dur = C.NONE_S || 0.03;
        fx = "cut";
      } else if (fx !== "fade" && !(kind === "smp" ? eOut : eIn)) fx = "fade";
    }
    return {
      id: ++planSeq,
      kind: kind,
      when: o.when != null ? o.when : now(),
      dur: dur,
      fx: fx,
      picked: MIXED[kind] ? opt.fx : "fade",
      opt: { dur: opt.dur, fx: opt.fx }, // le choix de l'utilisateur (dur / fx : ce qui est vraiment joué)
      fromBpm: bpmOf(from),
      toBpm: bpmOf(to),
      fromTempo: tOut,
      toTempo: tIn,
      toCover: !to ? "" : kind === "in" ? assetUrl(to.cover) : coverOf(to, o.k),
      ev: {},
    };
  }
  function coverOf(item, k) {
    if (!useEng(item)) return assetUrl(item.cover);
    var sg = item.segs && item.segs[k || 0],
      s = item.chain ? item.chain[sg ? sg.ci : 0] : item;
    return smpCover(s, item);
  }

  // UNE fonction pour tous les passages : fondu à puissance égale sur l'horloge audio, effet sur la sortie
  // du sample, événements pour l'interface. from / to : { v: voix Web Audio }, { all: true } (toutes les
  // voix du moteur), { set: fn(0..1) } (volume de ton morceau ou de YouTube), ou null. Peut être appelée
  // en deux fois pour un même plan (ton morceau d'abord, l'extrait quand il est prêt) : un seul événement.
  function transition(from, to, plan, at) {
    var T = Math.max(now(), at || plan.when || 0),
      D = plan.dur;
    if (from && from.all) engHush(D, T);
    else if (from && from.v) {
      if (plan.kind === "smp") applyFx(from.v, plan, "out", T);
      fadeOutVoice(from.v, T, D);
    } else if (from && from.set) clockRamp(from.set, 1, 0, T, D);
    if (to && to.v) {
      setCurve(to.v, 0, 1, T, D);
      if (plan.kind === "smp") applyFx(to.v, plan, "swap", T);
      else if (plan.kind === "out") applyFx(to.v, plan, "in", T);
    } else if (to && to.set) clockRamp(to.set, 0, 1, T, D);
    emit(plan, T);
    return plan;
  }
  // Événements DOM « samples:transition » (detail : phase start | end, fx joué, dur, BPM, pochette).
  var evEnd = null;
  function emit(plan, T) {
    if (!EMIT[plan.kind] || plan.ev.done) return;
    plan.ev.done = true;
    evFlush();
    var fire = function (phase) {
      try {
        document.dispatchEvent(
          new CustomEvent("samples:transition", {
            detail: {
              phase: phase,
              kind: plan.kind,
              fx: plan.fx,
              picked: plan.picked,
              dur: plan.dur,
              fromBpm: plan.fromBpm,
              toBpm: plan.toBpm,
              toCover: plan.toCover,
              opt: plan.opt,
            },
          }),
        );
      } catch (_e) {}
    };
    clockAt(
      T,
      function () {
        plan.ev.started = true;
        fire("start");
        if (MIXED[plan.kind])
          track("samples_mix_fx", {
            fx: plan.fx,
            dur_s: Math.round(plan.dur * 10) / 10,
            bpm_gap:
              plan.fromTempo && plan.toTempo
                ? Math.round(Math.abs(plan.fromTempo - plan.toTempo))
                : -1,
          });
      },
      "ev",
    );
    evEnd = clockAt(
      T + plan.dur,
      function () {
        evEnd = null;
        if (plan.ev.started) fire("end");
      },
      "ev",
    );
  }
  // La transition affichée se termine tout de suite (on passe à autre chose, ou le lecteur se ferme).
  function evFlush() {
    var e = evEnd;
    evEnd = null;
    clockClear("ev");
    if (e) e.fn();
  }

  // ---------- Bus de sortie et effets ----------
  // voix : source → passe-haut (10 Hz, transparent ; « Basses » le fait monter) → gain → bus.in → bus.out
  // → sortie. Les effets reçoivent un envoi pris avant le gain de la voix et reviennent dans bus.out.
  function bus() {
    var c = eng.ctx;
    if (!c) return null;
    if (eng.bus && eng.bus.c === c) return eng.bus;
    var b = { c: c, in: c.createGain(), out: c.createGain(), rev: null };
    b.in.connect(b.out);
    b.out.connect(c.destination);
    eng.bus = b;
    return b;
  }
  // Reverb : réponse générée (bruit stéréo qui décroît, 2,4 s), créée une seule fois.
  function reverbIn() {
    var b = bus();
    if (!b) return null;
    if (!b.rev) {
      var c = b.c,
        n = Math.round(c.sampleRate * 2.4),
        ir = c.createBuffer(2, n, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < n; i++)
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      }
      var cv = c.createConvolver(),
        r = c.createGain();
      cv.buffer = ir;
      r.gain.value = 0.8;
      cv.connect(r);
      r.connect(b.out);
      b.rev = cv;
    }
    return b.rev;
  }
  // Écho : retard calé sur le tempo (3/4 de temps), retour 0,45 (< 1) assombri par un passe-bas.
  // Un par transition ; débranché quand la queue est éteinte.
  function echoIn(bpm, until) {
    var b = bus();
    if (!b) return null;
    var c = b.c,
      dt = clamp((60 / (bpm > 0 ? bpm : 120)) * 0.75, 0.12, 1.2),
      inp = c.createGain(),
      dl = c.createDelay(2),
      lp = c.createBiquadFilter(),
      fb = c.createGain(),
      out = c.createGain();
    dl.delayTime.value = dt;
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    fb.gain.value = 0.45;
    out.gain.value = 0.7;
    inp.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    lp.connect(out);
    out.connect(b.out);
    setTimeout(
      function () {
        [inp, dl, lp, fb, out].forEach(function (n) {
          try {
            n.disconnect();
          } catch (_e) {}
        });
      },
      Math.max(0, until - c.currentTime + dt * 14 + 1) * 1000,
    );
    return inp;
  }
  function sendFrom(v, dest) {
    var s = eng.ctx.createGain();
    s.gain.value = 0;
    v.hp.connect(s);
    s.connect(dest);
    (v.sends = v.sends || []).push(s);
    return s.gain;
  }
  // role : « out » (sample qui sort), « in » (sample qui entre après ton morceau : effet à l'envers),
  // « swap » (sample qui entre après un sample : seules ses basses attendent le milieu).
  function applyFx(v, plan, role, T) {
    var D = plan.dur,
      fx = plan.fx;
    if (!eng.ctx || !v.hp || fx === "fade" || fx === "cut") return;
    try {
      if (fx === "bass") {
        var f = v.hp.frequency;
        f.cancelScheduledValues(T);
        if (role === "out") {
          f.setValueAtTime(20, T);
          f.exponentialRampToValueAtTime(900, T + D);
        } else if (role === "in") {
          f.setValueAtTime(900, T);
          f.exponentialRampToValueAtTime(10, T + D);
        } else {
          f.setValueAtTime(320, T);
          f.setValueAtTime(320, T + D / 2);
          f.exponentialRampToValueAtTime(10, T + D / 2 + 0.12);
        }
        return;
      }
      if (role === "swap") return;
      var dest =
        fx === "reverb"
          ? reverbIn()
          : fx === "echo"
            ? echoIn(role === "out" ? plan.fromTempo : plan.toTempo, T + D)
            : null;
      if (!dest) return;
      var g = sendFrom(v, dest),
        top = fx === "reverb" ? 0.9 : 0.8;
      if (role === "out") {
        // l'envoi monte pendant que le sample sort, puis se coupe : la queue reste seule
        g.setValueAtTime(0, T);
        g.linearRampToValueAtTime(top, T + D * 0.5);
        g.setValueAtTime(top, Math.max(T + D * 0.5, T + D - 0.03));
        g.linearRampToValueAtTime(0, T + D);
      } else {
        // le sample sort de l'effet à mesure qu'il entre
        g.setValueAtTime(top, T);
        g.linearRampToValueAtTime(0, T + D * (fx === "echo" ? 0.6 : 1));
      }
    } catch (_e) {}
  }
  function unplug(v) {
    [v.g, v.hp].concat(v.sends || []).forEach(function (n) {
      try {
        if (n) n.disconnect();
      } catch (_e) {}
    });
  }
  function voiceNodes(c) {
    var hp = c.createBiquadFilter(),
      g = c.createGain();
    hp.type = "highpass";
    hp.frequency.value = 10;
    hp.Q.value = 0.7071;
    g.gain.value = 0;
    hp.connect(g);
    g.connect(bus().in);
    return { hp: hp, g: g };
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
    POOL = 3, // lecteurs <audio> pour la lecture en flux, tous débloqués pendant le geste
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
    unlockPool();
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
    // noX : instant jusqu'auquel l'extrait est mis de côté (échec réseau), plus « toute la session »
    if (!i || (i.noX && Date.now() < i.noX) || !audioCtor()) return false;
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
          .then(decode)
          .then(function (b) {
            e.buf = b;
            return b;
          }),
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
      now = eng.ctx.currentTime;
    dur = Math.max(0.02, dur);
    var n = Math.max(16, Math.ceil(dur * 8)); // fondus longs (Mix) : paliers de 1/8 s au plus
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
    if (v.el) return v.x0 + (v.el.readyState > 0 ? v.el.currentTime : v.off);
    return v.x0 + v.off + Math.max(0, eng.ctx.currentTime - v.at);
  }
  function ctxAt(v, t) {
    if (v.el) return eng.ctx.currentTime + (t - ytNow(v));
    return v.at + (t - v.x0 - v.off);
  }
  // 19/11 (INFRA : « ça met énormément de temps à play ») : comme la bibliothèque, le premier son est lu
  // pendant qu'il arrive (élément <audio> branché dans Web Audio pour garder les fondus), au lieu
  // d'attendre le téléchargement complet. Les extraits suivants, préchargés, passent par les tampons.
  var SILENT =
    "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQgAAAAAAAAAAAAAAA==";
  function poolEl(fresh) {
    eng.pool = eng.pool || [];
    if (!fresh)
      for (var i = 0; i < eng.pool.length; i++) if (!eng.pool[i].busy) return eng.pool[i];
    if (eng.pool.length >= POOL || !eng.ctx) return null;
    var el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    var e = { el: el, busy: false, node: null };
    try {
      e.node = eng.ctx.createMediaElementSource(el);
    } catch (_e) {
      return null;
    }
    eng.pool.push(e);
    return e;
  }
  // Pendant le geste : chaque lecteur du lot joue un son vide, pour que l'iPhone le laisse jouer ensuite seul.
  // Rapport terrain 20/11 (§ 3a, bug 4) : les POOL lecteurs sont tous créés ici, dans le geste (avant, le
  // 3e naissait plus tard, hors geste, et l'iPhone pouvait le refuser).
  function unlockPool() {
    if (!eng.ctx) return;
    while ((eng.pool || []).length < POOL) if (!poolEl(true)) break;
    (eng.pool || []).forEach(function (e) {
      if (e.busy || e.ok) return;
      try {
        e.el.src = SILENT;
        var p = e.el.play();
        e.ok = true;
        if (p && p.then)
          p.then(
            function () {
              if (!e.busy) e.el.pause();
            },
            function () {
              e.ok = false;
            },
          );
      } catch (_e) {}
    });
  }
  // Voix muette (gain 0) : c'est transition() qui l'ouvre, avec la durée et l'effet du passage.
  function startStreamVoice(item, k, ytFrom, when, onFail) {
    var c = eng.ctx,
      sg = segsOf(item)[k],
      e = poolEl();
    if (!e) return null;
    e.busy = true;
    var el = e.el,
      nd = voiceNodes(c),
      off = Math.max(0, ytFrom - sg.x[1]),
      stopT = null;
    try {
      e.node.disconnect();
    } catch (_e) {}
    e.node.connect(nd.hp);
    var release = function () {
      clearTimeout(stopT);
      try {
        el.pause();
      } catch (_e) {}
      unplug(v);
      try {
        e.node.disconnect();
      } catch (_e) {}
      el.onended = el.onerror = el.onplaying = null;
      e.busy = false;
    };
    var v = {
      el: el,
      g: nd.g,
      hp: nd.hp,
      item: item,
      k: k,
      sg: sg,
      name: sg.x[0],
      x0: sg.x[1],
      len: sg.x[2],
      off: off,
      at: when,
      gv: { from: 0, to: 0, when: 0, dur: 0.02 },
      s: {
        stop: function (t) {
          clearTimeout(stopT);
          stopT = setTimeout(function () {
            var j = eng.voices.indexOf(v);
            if (j >= 0) eng.voices.splice(j, 1);
            release();
          }, Math.max(0, (t - c.currentTime) * 1000));
        },
      },
    };
    el.onended = function () {
      var j = eng.voices.indexOf(v);
      if (j >= 0) eng.voices.splice(j, 1);
      release();
      if (eng.cur === v && !v.done) engEnded(v);
    };
    el.onerror = function () {
      if (v.done) return;
      var j = eng.voices.indexOf(v);
      if (j >= 0) eng.voices.splice(j, 1);
      release();
      if (eng.cur === v) eng.cur = null;
      onFail(v);
    };
    var tStart = Date.now();
    el.onplaying = function () {
      el.onplaying = null;
      var ms = Date.now() - tStart;
      if (ms > 1500)
        track("samples_audio_slow", { delta_ms: ms, mode: st.mix ? "mix" : "samples" });
    };
    el.src = xUrl(sg.x[0]) + (off > 0.05 ? "#t=" + off.toFixed(2) : "");
    try {
      if (off > 0.05) el.currentTime = off;
    } catch (_e) {}
    var p = el.play();
    if (p && p.catch)
      p.catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (el.onerror) el.onerror();
      });
    eng.voices.push(v);
    return v;
  }
  function startVoice(buf, item, k, ytFrom, when) {
    var c = eng.ctx,
      sg = segsOf(item)[k],
      nd = voiceNodes(c),
      s = c.createBufferSource();
    s.buffer = buf;
    s.connect(nd.hp);
    var v = {
      s: s,
      g: nd.g,
      hp: nd.hp,
      item: item,
      k: k,
      sg: sg,
      name: sg.x[0],
      x0: sg.x[1],
      len: buf.duration,
      off: clamp(ytFrom - sg.x[1], 0, Math.max(0, buf.duration - 0.05)),
      at: when,
      gv: { from: 0, to: 0, when: 0, dur: 0.02 }, // muette jusqu'à son départ
    };
    s.onended = function () {
      var j = eng.voices.indexOf(v);
      if (j >= 0) eng.voices.splice(j, 1);
      unplug(v);
      if (eng.cur === v && !v.done) engEnded(v);
    };
    s.start(when, v.off);
    eng.voices.push(v);
    return v;
  }
  // force : voix déjà en train de sortir (fondu long du Mix) raccourcie quand tout s'arrête (fermer, pause).
  function fadeOutVoice(v, when, dur, force) {
    if (!v || (v.done && !force)) return;
    if (v.done) {
      var r = v.gv;
      if (r && r.to === 0 && r.when + r.dur <= when + dur) return; // déjà plus court
    }
    v.done = true;
    setCurve(v, gainAt(v, when), 0, when, dur);
    try {
      v.s.stop(when + Math.max(0.02, dur) + 0.05);
    } catch (_e) {}
    if (eng.cur === v) eng.cur = null;
  }
  // Coupe tout ce que joue le moteur (fondu de d s, maintenant ou à l'instant « when ») ; les chargements
  // en cours sont oubliés.
  function engHush(d, when) {
    eng.gen++;
    eng.armed = false;
    eng.loading = false;
    if (!eng.ctx) return;
    var t = Math.max(eng.ctx.currentTime, when || 0);
    eng.voices.slice().forEach(function (v) {
      fadeOutVoice(v, t, d, true);
    });
    eng.cur = null;
  }
  function engStop(d) {
    eng.on = false;
    eng.paused = false;
    eng.hold = null;
    engHush(d == null ? 0.15 : d);
  }
  // Joue la partie k de l'item à partir du temps YouTube ytFrom ; le passage avec ce qui joue suit le
  // plan (instant sur l'horloge audio, durée, effet) : voir transition().
  // noStream : lecture en flux refusée (autoplay iPhone, réseau) → on repasse par le tampon décodé.
  function engStart(item, k, ytFrom, plan, noStream) {
    var gen = ++eng.gen,
      sg = segsOf(item)[k];
    eng.on = true;
    eng.paused = false;
    eng.hold = null;
    ensureCtx();
    var ready = eng.bufs[sg.x[0]] && eng.bufs[sg.x[0]].buf;
    if (!ready && !noStream && eng.ctx && eng.ctx.state === "running") {
      var at0 = Math.max(eng.ctx.currentTime + 0.02, plan.when || 0);
      // Rapport terrain 20/11 (§ 3a, bug 3) : un refus passager ne bascule plus l'extrait sur YouTube
      // pour toute la session ; on réessaie aussitôt par le tampon (fetch + décodage, sans <audio>).
      var sv = startStreamVoice(item, k, ytFrom, at0, function (v) {
        if (gen !== eng.gen) return;
        track("samples_audio_retry", { mode: st.mix ? "mix" : "samples" });
        engStart(item, k, Math.max(ytFrom, ytNow(v)), plan, true);
      });
      if (sv) {
        transition(eng.cur ? { v: eng.cur } : null, { v: sv }, plan, at0);
        eng.cur = sv;
        eng.armed = false;
        if (!trackPhase() && Date.now() >= duo.outroUntil && duo.phase !== "pre")
          pauseMusic();
        // le flux d'abord : le préchargement du suivant attend que ce son soit bien parti (réseau lent)
        var g0 = gen;
        setTimeout(function () {
          if (g0 === eng.gen) engPreload(item, k);
        }, 4000);
        setTimeout(paintBar, 30);
        return;
      }
    }
    eng.loading = true;
    var t0 = Date.now();
    getBuf(sg.x[0]).then(
      function (buf) {
        if (gen !== eng.gen || !sheet || sheet.hidden) return;
        eng.loading = false;
        var at = Math.max(eng.ctx.currentTime + 0.02, plan.when || 0),
          nv = startVoice(buf, item, k, ytFrom, at);
        transition(eng.cur ? { v: eng.cur } : null, { v: nv }, plan, at);
        eng.cur = nv;
        eng.armed = false;
        if (
          !trackPhase() &&
          Date.now() >= duo.outroUntil &&
          duo.phase !== "pre"
        )
          pauseMusic();
        if (Date.now() - t0 > 1500)
          track("samples_audio_slow", { delta_ms: Date.now() - t0, mode: st.mix ? "mix" : "samples" });
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
  // Extrait introuvable (404, réseau) : cet item repasse par YouTube, comme avant — 2 minutes au premier
  // échec (le réseau revient), puis pour la session au deuxième.
  function engFail(item, k) {
    track("samples_audio_fail", { mode: st.mix ? "mix" : "samples" });
    item.xFails = (item.xFails || 0) + 1;
    item.noX = item.xFails >= 2 ? Infinity : Date.now() + 120000;
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
      engStart(h.item, h.k, h.t, planOf("resume", null, null, { dur: 0.08 }));
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
    engStart(item, loc.k, y, planOf("seek", null, null, { dur: 0.06 }));
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
  // Fin d'un sample (Samples, A cappella) : le suivant entre selon les options du Mix (durée, effet),
  // centré sur la jointure et plafonné par la vraie marge des deux extraits.
  function nextOf(item) {
    var list = shownList();
    return list[list.indexOf(item) + 1];
  }
  function engAuto(v) {
    eng.armed = true;
    var next = nextOf(v.item),
      t = eng.ctx.currentTime;
    if (!next) {
      if (eng.cur === v)
        fadeOutVoice(v, Math.max(t, ctxAt(v, v.sg.s1 - 0.5)), 1);
      return;
    }
    if (!useEng(next)) {
      // son suivant sans extrait : YouTube prend le relais à la fin de celui-ci
      clockAt(
        Math.max(t, ctxAt(v, v.sg.s1)),
        function () {
          if (eng.on && st.list[st.pos] === v.item && !eng.paused) play(next);
        },
        "eng",
      );
      return;
    }
    var plan = planOf("smp", v.item, next, { voice: v, k: 0 });
    plan.when = ctxAt(v, v.sg.s1 - plan.dur / 2);
    play(next, false, false, 0, plan);
  }
  // Durée du prochain passage sample → sample (pour l'armer à temps).
  function autoDur(v) {
    var next = nextOf(v.item);
    return next && useEng(next)
      ? planOf("smp", v.item, next, { voice: v }).dur
      : SMPXF;
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
          planOf("seg", v.item, v.item, {
            dur: SEGXF,
            when: ctxAt(v, sg.s1 - SEGXF / 2),
            k: nk,
          }),
        );
        track("samples_part", { k: nk, n: segsOf(v.item).length });
      }
      return;
    }
    // dernier passage : la transition est armée LOOK s avant son début (au plus 6 s avant la jointure)
    if (sg.s1 - tp < 6 + LOOK && sg.s1 - tp < autoDur(v) / 2 + LOOK) engAuto(v);
  }
  // Retour sur la page (iPhone : contexte « interrupted » après verrouillage ou arrière-plan) : on relance.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !eng.ctx || !sheet || sheet.hidden)
      return;
    if (eng.ctx.state !== "running")
      try {
        var p = eng.ctx.resume();
        if (p && p.catch) p.catch(noop);
      } catch (_e) {}
  });

  // ---------- API pour l'interface (page Mix, menu ⋯ du lecteur) ----------
  function getOptions() {
    var C = core(),
      o = mixOpts();
    return {
      dur: o.dur,
      fx: o.fx,
      defaults: { dur: C.DEFAULTS.dur, fx: C.DEFAULTS.fx },
      durations: C.DURATIONS.slice(),
      effects: C.EFFECTS.slice(),
      // iPhone : ton morceau ne se fond pas (coupe nette) ; les effets restent sur le sample
      trackFades: canFade(),
    };
  }
  function setOptions(o) {
    var C = core(),
      cur = mixOpts(),
      next = { dur: cur.dur, fx: cur.fx };
    if (o && o.dur != null) next.dur = normOpt(o.dur, C.DURATIONS) || cur.dur;
    if (o && o.fx != null) next.fx = normOpt(o.fx, C.EFFECTS) || cur.fx;
    pref.mixo = next;
    save();
    if (next.dur !== cur.dur) track("samples_mix_opt", { opt: "dur", choice: next.dur });
    if (next.fx !== cur.fx) track("samples_mix_opt", { opt: "fx", choice: next.fx });
    var out = getOptions();
    try {
      document.dispatchEvent(new CustomEvent("samples:options", { detail: out }));
    } catch (_e) {}
    return out;
  }
  // false = option à griser. iPhone (volume de ton morceau bloqué) : dans le Mix, ton morceau est coupé
  // net et le sample entre en OVERLAP s au plus, donc seules « Aucune » et les effets restent vrais.
  function supports(kind, value) {
    var C = core();
    if (kind === "fx") return !!normOpt(value, C.EFFECTS);
    if (kind !== "dur") return false;
    var d = normOpt(value, C.DURATIONS);
    if (!d) return false;
    return d === "none" || pref.sec !== "mix" || canFade();
  }
  // Ce qu'on entend maintenant (aucune donnée privée), pour l'interface ; null si le lecteur est fermé.
  function current() {
    var cur = st.list[st.pos];
    if (!sheet || sheet.hidden || !cur) return null;
    var inTrack = trackPhase(),
      smp = curSample() || cur;
    return {
      mode: st.mix ? "mix" : pref.sec === "voix" ? "voix" : "samples",
      phase: inTrack ? "track" : "sample",
      title: inTrack ? cur.track : smp.t,
      artist: inTrack ? "INFRA" : smp.a,
      track: cur.track,
      album: cur.album,
      bpm: bpmOf(cur),
      tempo: inTrack ? Number(cur.tb) || 0 : smpTempo(smp),
      cover:
        inTrack || !(eng.on || st.cued) ? assetUrl(cur.cover) : smpCover(smp, cur),
      playing: isPlaying(),
    };
  }
  function resetOptions() {
    var C = core();
    return setOptions({ dur: C.DEFAULTS.dur, fx: C.DEFAULTS.fx });
  }
  // Le prochain passage tel qu'il sera joué (durée, effet réel), sans rien lancer ; null si aucun.
  function nextTransition() {
    var cur = st.list[st.pos];
    if (!sheet || sheet.hidden || !cur) return null;
    var next = nextOf(cur);
    if (!next) return null;
    var p = st.mix
      ? planOf("out", cur, next)
      : planOf("smp", cur, next, {
          voice: eng.cur && eng.cur.item === cur ? eng.cur : null,
        });
    return {
      kind: p.kind,
      dur: p.dur,
      fx: p.fx,
      picked: p.picked,
      fromBpm: p.fromBpm,
      toBpm: p.toBpm,
      toCover: p.toCover,
    };
  }
  // « Écouter la transition » : saute 6 s avant la prochaine transition (Mix : fin de la minute de ton
  // morceau ; Samples : jointure avec le sample suivant, moins la moitié du fondu).
  function previewTransition() {
    var cur = st.list[st.pos];
    if (!sheet || sheet.hidden || !cur) return null;
    ensureCtx();
    if (st.cued) {
      toggle();
      return null;
    }
    var nt = nextTransition(),
      b = barState(),
      was = isPlaying();
    if (!b || !b.T) return null;
    var t = st.mix ? b.T - 6 : b.T - (nt ? nt.dur / 2 : 0) - 6;
    seekTo(Math.max(0, t));
    // Mix : le saut dans ton morceau le lance déjà ; Samples en pause : on reprend à la nouvelle place
    if (!st.mix && !was) toggle();
    track("samples_mix_try", {
      fx: nt ? nt.fx : "",
      dur_s: nt ? Math.round(nt.dur * 10) / 10 : 0,
    });
    return nt;
  }
  // Pochette affichée à la place de la vidéo : celle du sample (assets/samples/<y>.webp) si elle existe.
  function smpCover(smp, cur) {
    return smp && smp.c
      ? assetUrl("assets/samples/" + smp.y + ".webp")
      : assetUrl(cur.cover);
  }

  // Glisser vers le bas pour fermer, comme le grand lecteur (INFRA, 19/11). Seulement quand le panneau est
  // tout en haut, jamais depuis la barre de lecture ni les tris ; suit le doigt, ferme au-delà de 110 px
  // ou sur un geste rapide.
  function bindSwipeClose() {
    var panel = $(".sx-panel", sheet),
      y0 = null,
      x0 = 0,
      t0 = 0,
      dy = 0,
      live = false;
    var reset = function (anim) {
      panel.style.transition = anim ? "transform .22s ease" : "";
      panel.style.transform = "";
      y0 = null;
      dy = 0;
      live = false;
    };
    panel.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1 || panel.scrollTop > 2) return (y0 = null);
        var t = e.target;
        if (t.closest && t.closest("[data-smp-bar],.sx-ctr,input,a")) return (y0 = null);
        y0 = e.touches[0].clientY;
        x0 = e.touches[0].clientX;
        t0 = Date.now();
        dy = 0;
        live = false;
      },
      { passive: true },
    );
    panel.addEventListener(
      "touchmove",
      function (e) {
        if (y0 == null) return;
        if (e.touches.length !== 1) return reset(true);
        var d = e.touches[0].clientY - y0,
          dx = Math.abs(e.touches[0].clientX - x0);
        if (!live) {
          if (d < 8 || dx > d) {
            if (d < -4 || dx > 12) y0 = null;
            return;
          }
          live = true;
        }
        dy = Math.max(0, d);
        if (e.cancelable) e.preventDefault();
        panel.style.transition = "";
        panel.style.transform = "translateY(" + dy.toFixed(1) + "px)";
      },
      { passive: false },
    );
    var end = function () {
      if (y0 == null) return;
      var fast = live && dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
      if (live && (dy > 110 || fast)) {
        track("samples_swipe_close", {});
        reset(false);
        close();
      } else reset(true);
    };
    panel.addEventListener("touchend", end);
    panel.addEventListener("touchcancel", function () {
      reset(true);
    });
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
    if (t.closest("[data-smp-goto]")) return goToTrack(st.list[st.pos]);
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
      // Samples / Acapella (INFRA, 19/11) : on ouvre l'album sans rien lancer, pour choisir le morceau.
      if (a) open(a.items.slice(), a.title, "album", a, null, pref.sec !== "mix");
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
    // Options du Mix (20/11) : voir DOCS/LOTS/AGENTS_MIX_20261120/CODE_A_MOTEUR.md
    mix: {
      getOptions: getOptions,
      setOptions: setOptions,
      resetOptions: resetOptions,
      nextTransition: nextTransition,
      previewTransition: previewTransition,
      supports: supports,
    },
    current: current,
    // état du moteur audio, pour les vérifications (aucune donnée privée)
    audioState: function () {
      return {
        ctx: eng.ctx ? eng.ctx.state : "",
        time: eng.ctx ? eng.ctx.currentTime : 0,
        on: eng.on,
        paused: eng.paused,
        loading: !!eng.loading,
        bufs: Object.keys(eng.bufs),
        pool: (eng.pool || []).map(function (e) {
          return {
            busy: e.busy,
            rs: e.el.readyState,
            t: e.el.currentTime,
            paused: e.el.paused,
            err: e.el.error ? e.el.error.code : 0,
          };
        }),
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
