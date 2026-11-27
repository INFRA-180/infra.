// Crédits d'un morceau, d'un album, d'un artiste samplé (maquette V25 validée par INFRA le 27/11/2026 : « Go, reporte V25 »).
// Morceau : résumé puis détail (samples ouverts avec ▶, Sons et Chaîne repliés). Album : livret (morceaux en accordéon).
// Ordinateur : panneau à droite ; téléphone : feuille du bas. Chargé à la demande par track-actions.js.
// Données : data/credits.json (projets Ableton relus, rien de privé) + data/samples.json (une seule source des samples).
(function () {
  "use strict";
  if (window.InfraCredits) return;

  var BUILD = window.INFRA_BUILD_TAG || "";
  var MOIS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var CAT_ORDER = ["Instruments", "Égaliseurs", "Compression", "Limiteurs", "Saturation et bande", "Espace", "Modulation", "Filtres", "Outils", "Autres"];
  var VCOL = { FabFilter: "#f2a33a", "Universal Audio": "#8d8d8d", Soundtoys: "#e2474b", Arturia: "#3d7be0", "Analog Obsession": "#6aa36f",
    "Plugin Alliance": "#c9a227", Ableton: "#9a9a9a", Sonnox: "#5aa6d8", Cableguys: "#9a62d6", "SIR Audio Tools": "#5fbfb0" };
  var svg = function (d, extra) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + ">" + d + "</svg>";
  };
  var IC = {
    chev: svg('<path d="M9 5l7 7-7 7"/>'),
    back: svg('<path d="M15 6l-6 6 6 6"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>',
    pitch: svg('<path d="M8 4v16M8 4l-3 3M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3"/>'),
    tempo: svg('<path d="M5 6l7 6-7 6M12 6l7 6-7 6"/>')
  };

  var data = null; // { credits, samples, tracks }
  var loading = null;
  var root = null;
  var stack = []; // vues empilées (‹ Retour)
  var lastFocus = null;
  var fxCard = null;

  function siteRoot() {
    var link = document.querySelector('link[rel="manifest"]');
    var base = link ? new URL(".", link.href) : new URL("./", window.location.href);
    return base.href.replace(/(music|playlists)\/$/, "");
  }
  function getJson(name) {
    return fetch(siteRoot() + "data/" + name + "?v=" + encodeURIComponent(BUILD), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(name + " " + r.status);
      return r.json();
    });
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = Promise.all([getJson("credits.json"), getJson("samples.json").catch(function () { return { albums: [] }; }), getJson("tracks.json")])
      .then(function (r) {
        data = { credits: r[0], samples: r[1], tracks: r[2] };
        return data;
      })
      .catch(function (e) {
        loading = null;
        throw e;
      });
    return loading;
  }
  function track(name, extra) {
    try {
      if (typeof window.InfraTrackEvent === "function") window.InfraTrackEvent(name, extra || {});
    } catch (_e) { /* télémétrie facultative */ }
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function same(a, b) {
    var n = function (v) { return String(v || "").normalize("NFC").trim().toLocaleUpperCase("fr"); };
    return n(a) === n(b);
  }
  function moisAn(d) { return d ? MOIS[Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4) : ""; }
  function periode(a, b) { var x = moisAn(a), y = moisAn(b); return !x ? "" : !y || x === y ? x : x + " → " + y; }
  function plural(n, w) { return n + " " + w + (n > 1 ? "s" : ""); }

  function albumBySlug(slug) { return (data.tracks.albums || []).find(function (a) { return a.slug === slug; }) || null; }
  function samplesOf(albumTitle, trackTitle) {
    var a = (data.samples.albums || []).find(function (x) { return same(x.title, albumTitle); });
    var t = a && (a.tracks || []).find(function (x) { return same(x.title, trackTitle); });
    return t ? t.items : [];
  }
  function creditOf(slug, n) {
    var al = data.credits.albums[slug];
    return al ? al[String(n)] || null : null;
  }
  function cover(album) { return album && album.cover ? siteRoot() + album.cover : ""; }

  // ---------- Panneau ----------
  function injectCss() {
    if (document.getElementById("infraCreditsCss")) return;
    var s = document.createElement("style");
    s.id = "infraCreditsCss";
    s.textContent = [
      ".icr-scrim{position:fixed;inset:0;z-index:2147482990;background:rgba(0,0,0,.28);opacity:0;transition:opacity .2s}",
      ".icr-scrim.on{opacity:1}",
      ".icr{position:fixed;z-index:2147482995;top:0;right:0;bottom:0;width:min(440px,100vw);display:flex;flex-direction:column;background:var(--icr-bg,#fff);color:var(--icr-ink,#111);",
      "box-shadow:-12px 0 40px rgba(0,0,0,.18);transform:translateX(104%);transition:transform .26s cubic-bezier(.2,.8,.2,1);font:400 14px/1.35 'Avenir Next','Avenir',Arial,sans-serif}",
      ".icr.on{transform:none}",
      "@media (max-width:639px){.icr{top:auto;left:0;width:auto;height:92vh;height:92dvh;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.18);transform:translateY(104%)}}",
      "@media (prefers-reduced-motion:reduce){.icr,.icr-scrim{transition:none}}",
      ".icr-top{display:flex;align-items:center;justify-content:space-between;min-height:52px;padding:0 8px 0 4px;flex:none}",
      ".icr-grab{display:none}",
      "@media (max-width:639px){.icr-grab{display:block;width:36px;height:5px;border-radius:3px;background:currentColor;opacity:.18;margin:8px auto 0;flex:none}}",
      ".icr button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}",
      ".icr-back,.icr-x{min-height:44px;display:inline-flex;align-items:center;gap:4px;padding:0 12px;opacity:.7}",
      ".icr-back svg,.icr-x svg{width:18px;height:18px}",
      ".icr-back[hidden]{display:none}",
      ".icr-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 20px calc(24px + env(safe-area-inset-bottom))}",
      "@media (max-width:639px){.icr-body{padding-left:16px;padding-right:16px}}",
      ".icr .crh{display:grid;grid-template-columns:72px 1fr;gap:16px;align-items:center;margin:4px 0 16px}",
      ".icr .crh.solo{grid-template-columns:1fr}",
      ".icr .crh img{width:72px;height:72px;border-radius:8px;object-fit:cover;background:rgba(127,127,127,.2)}",
      ".icr h1{margin:0;font:800 26px/1.08 'Avenir Next','Avenir',Arial,sans-serif;overflow-wrap:anywhere}",
      ".icr .m{opacity:.6;font-size:13px;margin-top:4px}",
      ".icr .roles{opacity:.72;font-size:13px}",
      ".icr .facts{opacity:.5;font-size:12px;margin-top:6px;font-variant-numeric:tabular-nums}",
      ".icr .sec{font-size:13px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;font-weight:600;margin:26px 0 4px;min-height:32px;display:flex;align-items:center;gap:10px}",
      ".icr .song{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;align-items:center;padding:8px 0}",
      ".icr .song+.song{box-shadow:0 -1px 0 rgba(127,127,127,.16)}",
      ".icr .song .t{font-weight:600}",
      ".icr .x{font-size:12px;opacity:.62;margin-top:2px}",
      ".icr .who-l{color:inherit;text-decoration:none;padding:0;font-size:12px}",
      "@media (hover:hover){.icr .who-l:hover{text-decoration:underline;text-underline-offset:2px}}",
      ".icr .pic{display:inline-flex;align-items:center;gap:3px;margin-right:10px;font-variant-numeric:tabular-nums}",
      ".icr .pic svg{width:12px;height:12px}",
      ".icr .lis{width:44px;height:44px;display:grid;place-items:center;margin-right:-12px}",
      ".icr .lis svg{width:20px;height:20px}",
      ".icr .lis.on{color:#e0312b}",
      ".icr details{border:0;border-radius:0;margin:0;padding:0;background:none;box-shadow:0 -1px 0 rgba(127,127,127,.16)}",
      ".icr details>summary{border:0;padding:0;margin:0;background:none}",
      ".icr details.fold{margin-top:22px}",
      ".icr summary{list-style:none;cursor:pointer;display:grid;align-items:center;gap:12px;min-height:52px}",
      ".icr summary::-webkit-details-marker{display:none}",
      ".icr .fold>summary{grid-template-columns:minmax(0,1fr) 16px}",
      ".icr .fold>summary b{display:block;font-size:13px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;font-weight:600}",
      ".icr .fold>summary span span{display:block;font-size:13px;opacity:.72;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".icr summary>svg{width:16px;height:16px;opacity:.45;transition:transform .2s}",
      ".icr details[open]>summary>svg{transform:rotate(90deg)}",
      ".icr .acc>summary{grid-template-columns:28px minmax(0,1fr) 16px}",
      ".icr .acc .i{font-size:12px;opacity:.5;font-variant-numeric:tabular-nums}",
      ".icr .acc .t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".icr .acc .in{padding:0 0 10px 40px}",
      ".icr .go{min-height:40px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:4px;padding:0}",
      ".icr .go svg{width:14px;height:14px}",
      ".icr .row{display:grid;grid-template-columns:minmax(0,1fr) 16px;gap:12px;align-items:center;width:100%;min-height:52px;text-align:left;padding:0}",
      ".icr .row+.row{box-shadow:0 -1px 0 rgba(127,127,127,.16)}",
      ".icr .row svg{width:16px;height:16px;opacity:.45}",
      ".icr .lab{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.5;padding:12px 0 2px}",
      ".icr .it{padding:8px 0}",
      ".icr .fxl{display:flex;flex-wrap:wrap;gap:2px 14px;padding:2px 0 8px}",
      ".icr .fx{padding:6px 0;font-size:13px;text-align:left;opacity:.55}",
      ".icr .fx.v{opacity:1}",
      ".icr .fx small{opacity:.55;margin-left:3px;font-size:11px}",
      ".icr .fxp{padding:8px 0}",
      ".icr .fxp+.fxp{box-shadow:0 -1px 0 rgba(127,127,127,.16)}",
      ".icr .fxp .pn{font-weight:600;font-size:13px}",
      ".icr .fxp i{opacity:.35;font-style:normal;align-self:center}",
      ".icr .seg{display:flex;gap:16px;margin:6px 0 2px}",
      ".icr .seg button{min-height:40px;padding:0;font-size:13px;opacity:.5}",
      ".icr .seg button[aria-selected=true]{opacity:1;font-weight:700}",
      ".icr .seeall{min-height:44px;font-size:13px;font-weight:600;padding:0}",
      ".icr .top{opacity:.75;font-size:13px;line-height:1.7}",
      ".icr .gear{opacity:.5;font-size:12px;margin-top:22px}",
      ".icr .empty{opacity:.6;padding:24px 0}",
      ".icr-card{position:fixed;z-index:2147482999;width:220px;padding:12px;border-radius:12px;background:var(--icr-bg,#fff);color:var(--icr-ink,#111);box-shadow:0 10px 34px rgba(0,0,0,.2);font:400 13px/1.35 'Avenir Next','Avenir',Arial,sans-serif;pointer-events:none}",
      ".icr-card .shot{height:88px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(135deg,var(--vc),rgba(0,0,0,.55));color:#fff;font:800 26px/1 'Avenir Next','Avenir',Arial,sans-serif;margin-bottom:8px}",
      ".icr-card .t{font-weight:700}",
      ".icr-card .x{opacity:.6;font-size:12px;margin-top:2px}"
    ].join("\n");
    document.head.appendChild(s);
  }
  function build() {
    if (root) return root;
    injectCss();
    var scrim = document.createElement("div");
    scrim.className = "icr-scrim";
    scrim.hidden = true;
    root = document.createElement("div");
    root.className = "icr";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Crédits");
    root.innerHTML =
      '<div class="icr-grab" aria-hidden="true"></div>' +
      '<div class="icr-top"><button type="button" class="icr-back" data-icr-back hidden>' + IC.back + "<span>Retour</span></button>" +
      '<span></span><button type="button" class="icr-x" data-icr-close aria-label="Fermer" title="Fermer (Échap)">' + IC.close + "</button></div>" +
      '<div class="icr-body" tabindex="-1"></div>';
    root.scrim = scrim;
    document.body.append(scrim, root);
    scrim.addEventListener("click", close);
    root.addEventListener("click", onClick);
    root.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse") return;
      var b = e.target.closest("[data-fx]");
      if (b) showFx(b);
    });
    root.addEventListener("pointerout", function (e) {
      if (e.pointerType === "mouse" && e.target.closest("[data-fx]")) hideFx();
    });
    root.querySelector(".icr-body").addEventListener("scroll", hideFx, { passive: true });
    // Téléphone : tirer la feuille vers le bas depuis la poignée ou le haut la ferme
    var drag = null;
    root.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || !window.matchMedia("(max-width: 639px)").matches) return;
      if (!e.target.closest(".icr-grab, .icr-top") || e.target.closest("button")) return;
      drag = { y: e.clientY, id: e.pointerId };
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = Math.max(0, e.clientY - drag.y);
      root.style.transition = "none";
      root.style.transform = "translateY(" + dy + "px)";
    });
    var end = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = e.clientY - drag.y;
      drag = null;
      root.style.transition = "";
      root.style.transform = "";
      if (dy > 90) close();
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    document.addEventListener("keydown", function (e) {
      if (root.hidden || e.key !== "Escape") return;
      if (document.documentElement.classList.contains("smp-open")) return; // le lecteur de samples se ferme d'abord
      e.preventDefault();
      e.stopPropagation();
      if (stack.length > 1) back();
      else close();
    }, true);
    window.addEventListener("popstate", close);
    return root;
  }
  function colors() {
    var cs = getComputedStyle(document.body);
    var bg = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "#fff";
    root.style.setProperty("--icr-bg", bg);
    root.style.setProperty("--icr-ink", cs.color || "#111");
  }
  function show(view) {
    build();
    colors();
    if (root.hidden) {
      lastFocus = document.activeElement;
      root.hidden = false;
      root.scrim.hidden = false;
      document.documentElement.classList.add("icr-open");
      requestAnimationFrame(function () {
        root.classList.add("on");
        root.scrim.classList.add("on");
      });
    }
    stack.push(view);
    paint();
  }
  function paint() {
    var view = stack[stack.length - 1];
    hideFx();
    var body = root.querySelector(".icr-body");
    body.innerHTML = view.html();
    body.scrollTop = 0;
    root.querySelector("[data-icr-back]").hidden = stack.length < 2;
    root.setAttribute("aria-label", view.label);
    body.focus({ preventScroll: true });
  }
  function back() {
    if (stack.length < 2) return;
    stack.pop();
    paint();
  }
  function close() {
    if (!root || root.hidden) return;
    hideFx();
    stack = [];
    root.classList.remove("on");
    root.scrim.classList.remove("on");
    document.documentElement.classList.remove("icr-open");
    var r = root;
    window.setTimeout(function () {
      if (r.classList.contains("on")) return;
      r.hidden = true;
      r.scrim.hidden = true;
      r.querySelector(".icr-body").innerHTML = "";
    }, 280);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }

  // ---------- Morceaux de rendu (V25) ----------
  function roles(facts) {
    return '<div class="roles">' + esc(data.credits.roles) + '</div><div class="facts">' + facts.filter(Boolean).map(esc).join(" · ") + "</div>";
  }
  function pics(x) {
    var out = [];
    if (x.dt) out.push('<span class="pic" title="Transposé de ' + (x.dt > 0 ? "+" : "") + x.dt + " demi-ton" + (Math.abs(x.dt) > 1 ? "s" : "") + '">' + IC.pitch + (x.dt > 0 ? "+" : "−") + Math.abs(x.dt) + "</span>");
    if (x.bpm) out.push('<span class="pic" title="Tempo ' + x.bpm[0] + " → " + x.bpm[1] + ' BPM">' + IC.tempo + x.bpm[0] + "→" + x.bpm[1] + "</span>");
    return out.length ? '<div class="x">' + out.join("") + "</div>" : "";
  }
  function songs(items, albumTitle, trackTitle) {
    return items.map(function (x, i) {
      var artist = x.a ? '<button type="button" class="who-l" data-artist="' + esc(x.a) + '" title="Tous les samples de ' + esc(x.a) + ' chez INFRA">' + esc(x.a) + "</button>" : "";
      var sub = [artist, x.an ? esc(x.an) : "", x.v ? "voix" : ""].filter(Boolean).join(" · ");
      return '<div class="song"><div style="min-width:0"><div class="t">' + esc(x.t) + "</div>" + (sub ? '<div class="x">' + sub + "</div>" : "") + pics(x) + "</div>" +
        '<button type="button" class="lis" data-listen="' + i + '" data-al="' + esc(albumTitle) + '" data-tr="' + esc(trackTitle) + '" aria-label="Écouter ' + esc(x.t) + '" title="Écouter">' + IC.play + "</button></div>";
    }).join("");
  }
  function fold(title, summary, body) {
    return '<details class="fold"><summary><span style="min-width:0"><b>' + esc(title) + "</b><span>" + summary + "</span></span>" + IC.chev + "</summary>" + body + "</details>";
  }
  function soundsFold(c) {
    var n = c.sp.reduce(function (k, s) { return k + s[2]; }, 0) + (c.u || 0);
    if (!n) return "";
    var labs = {};
    c.sp.forEach(function (s) { (labs[s[0]] = labs[s[0]] || []).push(s); });
    var names = Object.keys(labs).sort(function (a, b) { return count(labs[b]) - count(labs[a]); });
    var body = names.map(function (l) {
      return '<div class="lab">' + esc(l) + "</div>" + labs[l].map(function (s) {
        return '<div class="it"><div class="t" style="font-weight:600">' + esc(s[1] || "Splice") + '</div><div class="x">' + plural(s[2], "son") + "</div></div>";
      }).join("");
    }).join("") + (c.u ? '<div class="lab">Batterie</div><div class="it"><div class="x">' + plural(c.u, "son") + " d’origine inconnue</div></div>" : "");
    return fold("Sons", plural(n, "son") + (names.length ? " · " + plural(names.length, "créateur") : ""), body);
  }
  function count(list) { return list.reduce(function (k, s) { return k + s[2]; }, 0); }
  function fxIndex(pistes, master) {
    var by = {};
    var all = (master && master.length ? [["Master", master]] : []).concat(pistes || []);
    all.forEach(function (p) {
      p[1].forEach(function (id) {
        var pl = data.credits.plugins[id];
        if (!pl) return;
        var f = by[id] || (by[id] = { id: id, name: pl[0], vst: pl[1], ed: pl[2], ty: pl[3], on: [] });
        if (f.on.indexOf(p[0]) < 0) f.on.push(p[0]);
      });
    });
    return by;
  }
  function fxButton(f, on) {
    return '<button type="button" class="fx' + (f.vst ? " v" : "") + '" data-fx="' + f.id + '" data-on="' + esc((on || f.on).join(" · ")) + '">' + esc(f.name) +
      (!on && f.on.length > 1 ? "<small>×" + f.on.length + "</small>" : "") + "</button>";
  }
  function chainFold(pistes, master, labelTrack) {
    var by = fxIndex(pistes, master);
    var all = Object.keys(by).map(function (k) { return by[k]; });
    if (!all.length) return "";
    var eds = [];
    all.forEach(function (f) { if (f.vst && f.ed && eds.indexOf(f.ed) < 0) eds.push(f.ed); });
    var top = all.slice().sort(function (a, b) { return b.vst - a.vst || b.on.length - a.on.length; }).slice(0, 5);
    var groups = {};
    all.forEach(function (f) { (groups[f.ty] = groups[f.ty] || []).push(f); });
    var byType = CAT_ORDER.filter(function (c) { return groups[c]; }).map(function (c) {
      return '<div class="lab">' + esc(c) + '</div><div class="fxl">' + groups[c].sort(function (a, b) { return b.on.length - a.on.length; }).map(function (f) { return fxButton(f); }).join("") + "</div>";
    }).join("");
    var rows = (master && master.length ? [["Master", master]] : []).concat(pistes || []);
    var byTrack = rows.map(function (p) {
      var chainHtml = p[1].map(function (id) { var f = by[id]; return f ? fxButton(f, [p[0]]) : ""; }).filter(Boolean).join("<i>→</i>");
      return '<div class="fxp"><div class="pn">' + esc(p[0]) + '</div><div class="fxl">' + (chainHtml || '<span class="x">sans effet</span>') + "</div></div>";
    }).join("");
    var body = '<div class="fxl">' + top.map(function (f) { return fxButton(f); }).join("") + "</div>" +
      '<button type="button" class="seeall" data-seeall data-label="Tout voir (' + all.length + ')">Tout voir (' + all.length + ")</button>" +
      '<div data-all hidden><div class="seg" role="tablist"><button type="button" role="tab" aria-selected="true" data-fxview="type">Par type</button>' +
      '<button type="button" role="tab" aria-selected="false" data-fxview="piste">' + esc(labelTrack || "Par piste") + "</button></div>" +
      '<div data-fxbox="type">' + byType + '</div><div data-fxbox="piste" hidden>' + byTrack + "</div></div>";
    return fold("Chaîne", plural(all.length, "plugin") + (eds.length ? " · " + eds.slice(0, 3).map(esc).join(", ") : ""), body);
  }

  // ---------- Vues ----------
  function trackView(slug, n) {
    var album = albumBySlug(slug);
    var meta = album && album.tracks[n - 1];
    var title = meta ? meta.title : "Morceau";
    return {
      label: "Crédits de " + title,
      html: function () {
        var c = creditOf(slug, n);
        var items = album ? samplesOf(album.title, title) : [];
        var img = cover(album);
        var head = '<div class="crh"><img src="' + esc(img) + '" alt=""><div><h1>' + esc(title) + '</h1><div class="m">' + esc(album ? album.title : "") + "</div></div></div>";
        var facts = [data.credits.lieu, c ? periode(c.s, c.e) : "", c && c.b ? c.b + " BPM" : "", "Tout sur ordinateur"];
        return head + roles(facts) +
          (items.length ? '<h2 class="sec">Samples <span>' + items.length + "</span></h2>" + songs(items, album.title, title) : "") +
          (c ? soundsFold(c) + chainFold(c.p, c.m) : "");
      }
    };
  }
  function albumView(slug) {
    var album = albumBySlug(slug);
    return {
      label: "Crédits de l’album " + (album ? album.title : ""),
      html: function () {
        if (!album) return '<p class="empty">Album introuvable.</p>';
        var cs = album.tracks.map(function (_t, i) { return creditOf(slug, i + 1); });
        var ok = cs.filter(Boolean);
        var st = ok.map(function (c) { return c.s; }).filter(Boolean).sort();
        var en = ok.map(function (c) { return c.e; }).filter(Boolean).sort();
        var rows = album.tracks.map(function (t, i) {
          var c = cs[i];
          var items = samplesOf(album.title, t.title);
          var sons = c ? count(c.sp) + (c.u || 0) : 0;
          var sum = [items.length ? plural(items.length, "sample") : "", sons ? plural(sons, "son") : ""].filter(Boolean).join(" · ") || "—";
          var inside = (items.length ? songs(items, album.title, t.title) : "") +
            '<button type="button" class="go" data-track="' + esc(slug) + ":" + (i + 1) + '">Tout le détail ' + IC.chev + "</button>";
          return '<details class="acc"><summary><span class="i">' + String(i + 1).padStart(2, "0") + '</span><span style="min-width:0"><span class="t">' + esc(t.title) +
            '</span><span class="x">' + sum + "</span></span>" + IC.chev + '</summary><div class="in">' + inside + "</div></details>";
        }).join("");
        var labs = {};
        ok.forEach(function (c) { c.sp.forEach(function (s) { labs[s[0]] = (labs[s[0]] || 0) + s[2]; }); });
        var labNames = Object.keys(labs).sort(function (a, b) { return labs[b] - labs[a]; });
        var pistes = album.tracks.map(function (t, i) {
          var c = cs[i];
          if (!c) return null;
          var ids = [];
          c.p.forEach(function (p) { p[1].forEach(function (id) { ids.push(id); }); });
          return [t.title, ids.concat(c.m)];
        }).filter(Boolean);
        return '<div class="crh"><img src="' + esc(cover(album)) + '" alt=""><div><h1>' + esc(album.title) + '</h1><div class="m">Crédits · ' + plural(album.tracks.length, "titre") + "</div></div></div>" +
          roles([data.credits.lieu, periode(st[0], en[en.length - 1]), "Tout sur ordinateur"]) +
          '<h2 class="sec">Morceaux</h2>' + rows +
          (labNames.length ? fold("Créateurs des sons", plural(labNames.length, "créateur"), '<p class="top">' + labNames.map(function (l) { return "<b>" + esc(l) + "</b> " + labs[l]; }).join(" · ") + "</p>") : "") +
          chainFold(pistes, [], "Par morceau") +
          '<div class="gear">' + esc(data.credits.materiel) + "</div>";
      }
    };
  }
  function artistView(name) {
    return {
      label: name,
      html: function () {
        var hits = [];
        (data.samples.albums || []).forEach(function (a) {
          var album = (data.tracks.albums || []).find(function (x) { return same(x.title, a.title); });
          (a.tracks || []).forEach(function (t) {
            t.items.forEach(function (x) {
              if (x.a !== name || !album) return;
              var n = album.tracks.findIndex(function (y) { return same(y.title, t.title); }) + 1;
              if (n > 0) hits.push({ x: x, album: album, title: t.title, n: n });
            });
          });
        });
        return '<div class="crh solo"><div><h1>' + esc(name) + '</h1><div class="m">' + plural(hits.length, "sample") + " chez INFRA</div></div></div>" +
          hits.map(function (h) {
            return '<button type="button" class="row" data-track="' + esc(h.album.slug) + ":" + h.n + '"><span style="min-width:0"><span style="display:block;font-weight:600">' + esc(h.title) +
              '</span><span class="x">' + esc(h.x.t) + " · " + esc(h.album.title) + "</span></span>" + IC.chev + "</button>";
          }).join("");
      }
    };
  }

  // ---------- Gestes ----------
  function onClick(e) {
    var t = e.target;
    if (t.closest("[data-icr-close]")) return close();
    if (t.closest("[data-icr-back]")) return back();
    var ar = t.closest("[data-artist]");
    if (ar) { track("credits_artist", {}); return show(artistView(ar.getAttribute("data-artist"))); }
    var tr = t.closest("[data-track]");
    if (tr) {
      var p = tr.getAttribute("data-track").split(":");
      return show(trackView(p[0], Number(p[1])));
    }
    var lis = t.closest("[data-listen]");
    if (lis) return listen(lis);
    var all = t.closest("[data-seeall]");
    if (all) {
      var box = all.parentElement.querySelector("[data-all]");
      box.hidden = !box.hidden;
      all.textContent = box.hidden ? all.getAttribute("data-label") : "Masquer";
      return;
    }
    var v = t.closest("[data-fxview]");
    if (v) {
      var wrap = v.closest("[data-all]");
      wrap.querySelectorAll("[data-fxview]").forEach(function (b) { b.setAttribute("aria-selected", String(b === v)); });
      wrap.querySelectorAll("[data-fxbox]").forEach(function (b) { b.hidden = b.getAttribute("data-fxbox") !== v.getAttribute("data-fxview"); });
      return;
    }
    var fx = t.closest("[data-fx]");
    if (fx) {
      if (fxCard && fxCard.forId === fx.getAttribute("data-fx") + fx.getAttribute("data-on")) hideFx();
      else showFx(fx);
      return;
    }
    hideFx();
  }
  function listen(b) {
    var api = window.InfraSamples;
    var go = function (s) {
      root.querySelectorAll(".lis.on").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      return s.openTrack(b.getAttribute("data-al"), b.getAttribute("data-tr"), Number(b.getAttribute("data-listen")));
    };
    track("credits_listen", {});
    if (api) return go(api);
    var s = document.createElement("script");
    s.src = siteRoot() + "assets/js/samples.js?v=" + encodeURIComponent(BUILD);
    s.onload = function () { if (window.InfraSamples) go(window.InfraSamples); };
    document.head.appendChild(s);
  }
  function showFx(b) {
    hideFx();
    var pl = data.credits.plugins[Number(b.getAttribute("data-fx"))];
    if (!pl) return;
    var ed = pl[2] || "éditeur inconnu";
    var mono = pl[0].replace(/^UADx? /, "").split(/[\s-]+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 3).toUpperCase();
    fxCard = document.createElement("div");
    fxCard.className = "icr-card";
    fxCard.setAttribute("role", "tooltip");
    fxCard.forId = b.getAttribute("data-fx") + b.getAttribute("data-on");
    fxCard.style.setProperty("--icr-bg", root.style.getPropertyValue("--icr-bg"));
    fxCard.style.setProperty("--icr-ink", root.style.getPropertyValue("--icr-ink"));
    fxCard.innerHTML = '<div class="shot" style="--vc:' + (VCOL[ed] || "#8a8a8a") + '">' + esc(mono) + '</div><div class="t">' + esc(pl[0]) + '</div><div class="x">' + esc(ed) + " · " + esc(pl[3]) +
      '</div><div class="x">Sur : ' + esc(b.getAttribute("data-on")) + "</div>";
    document.body.appendChild(fxCard);
    var r = b.getBoundingClientRect(), w = fxCard.offsetWidth, h = fxCard.offsetHeight;
    var top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    fxCard.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + "px";
    fxCard.style.top = top + "px";
  }
  function hideFx() {
    if (fxCard) { fxCard.remove(); fxCard = null; }
  }

  function open(viewMaker, kind) {
    return load().then(function () {
      stack = [];
      show(viewMaker());
      track("credits_open", { kind: kind });
      return true;
    }).catch(function () {
      return false;
    });
  }
  window.InfraCredits = {
    openTrack: function (slug, n) { return open(function () { return trackView(slug, Number(n)); }, "track"); },
    openAlbum: function (slug) { return open(function () { return albumView(slug); }, "album"); },
    openArtist: function (name) { return open(function () { return artistView(name); }, "artist"); },
    close: close,
    load: load
  };
})();
