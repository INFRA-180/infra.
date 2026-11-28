// Crédits d'un morceau, d'un album, d'un artiste samplé (maquette V25 validée par INFRA le 27/11/2026 : « Go, reporte V25 »).
// Morceau : résumé puis détail (samples ouverts avec ▶, Sons et Chaîne repliés). Album : livret (morceaux en accordéon).
// V26 (28/11/2026, validée par INFRA) : « INFRA » + rôles, session (début date et heure, Ableton, tempo, lieu, pistes),
// voix (a cappella en texte + lien vers l’original), instruments joués, chaîne de mastering.
// Ordinateur : panneau à droite ; téléphone : feuille du bas. Chargé à la demande par track-actions.js.
// Données : data/credits.json (projets Ableton relus, rien de privé) + data/samples.json (une seule source des samples).
(function () {
  "use strict";
  if (window.InfraCredits) return;

  var BUILD = window.INFRA_BUILD_TAG || "";
  var MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var ROLE_ORDER = ["Production", "Arrangement", "Mixage", "Mastering"];
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
  function quand(h) {
    // « 2026-08-23 20:22 » → « dimanche 23 août 2026 · 20 h 22 » (heure de Paris, lue dans le projet)
    var m = /^(\d{4})-(\d\d)-(\d\d)(?: (\d\d):(\d\d))?/.exec(h || "");
    if (!m) return "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return JOURS[d.getUTCDay()] + " " + Number(m[3]) + " " + MOIS_L[+m[2] - 1] + " " + m[1] + (m[4] ? " · " + Number(m[4]) + "\u00a0h\u00a0" + m[5] : "");
  }
  function court(h) {
    var m = /^(\d{4})-(\d\d)-(\d\d)(?: (\d\d):(\d\d))?/.exec(h || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] + (m[4] ? " · " + Number(m[4]) + "\u00a0h\u00a0" + m[5] : "") : "";
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
      ".icr .who{margin:0 0 4px}",
      ".icr .who b{display:block;font:800 20px/1.15 'Avenir Next','Avenir',Arial,sans-serif;letter-spacing:.01em}",
      ".icr .who span{display:block;opacity:.72;font-size:13px;margin-top:2px}",
      ".icr .kv{display:grid;grid-template-columns:132px minmax(0,1fr);gap:4px 12px;margin:0;font-size:13px}",
      "@media (max-width:639px){.icr .kv{grid-template-columns:118px minmax(0,1fr)}}",
      ".icr .kv dt{opacity:.5}",
      ".icr .kv dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}",
      ".icr .ext{display:inline-flex;align-items:center;min-height:32px;font-size:12px;font-weight:600;color:inherit;text-decoration:none}",
      "@media (hover:hover){.icr .ext:hover{text-decoration:underline;text-underline-offset:2px}}",
      ".icr .sxgo{min-height:32px;padding:0;font-size:12px;font-weight:600}",
      ".icr.icr-page{position:static;inset:auto;z-index:auto;width:auto;height:auto;display:block;transform:none;transition:none;box-shadow:none;border-radius:0;background:transparent;color:inherit;padding:8px 0 32px}",
      ".icr.icr-page h1{font-size:34px;margin:4px 0 12px}",
      ".icr-page .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 32px}",
      "@media (max-width:639px){.icr-page .cols{grid-template-columns:1fr}}",
      ".icr-page .alg{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:16px 12px;margin-top:8px}",
      "@media (max-width:639px){.icr-page .alg{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      ".icr-page .alg button{display:block;text-align:left;padding:0;font-size:12px;line-height:1.3;min-width:0}",
      ".icr-page .alg img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;margin-bottom:6px;background:rgba(127,127,127,.2)}",
      ".icr-page .alg span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}",
      ".icr-page .line{font-size:13px;opacity:.8}",
      ".icr .chain{display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;padding:2px 0 4px}",
      ".icr .chain i{opacity:.35;font-style:normal;margin:0 6px}",
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
    window.addEventListener("scroll", hideFx, { passive: true }); // page de l'onglet Crédits
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
  function who() {
    return '<div class="who"><b>' + esc(data.credits.by || "INFRA") + "</b><span>" + esc(String(data.credits.roles || "").split(" · ").sort(function (a, b) {
      return ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b);
    }).join(" · ")) + "</span></div>";
  }
  function kv(rows) {
    rows = rows.filter(function (r) { return r[1]; });
    return rows.length ? '<h2 class="sec">Session</h2><dl class="kv">' + rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>" : "";
  }
  function pistesTxt(k) {
    if (!k) return "";
    return [k[0] ? k[0] + " audio" : "", k[1] ? k[1] + " MIDI" : "", k[2] ? plural(k[2], "retour") : ""].filter(Boolean).join(" · ");
  }
  function voixFold(vx) {
    if (!vx || !vx.length) return "";
    var who = [];
    vx.forEach(function (v) { if (v[1] && who.indexOf(v[1]) < 0) who.push(v[1]); });
    var body = vx.map(function (v) {
      var link = v[2] ? '<a class="ext" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v[2]) + '" target="_blank" rel="noopener noreferrer">Écouter l’original ↗</a>' : "";
      return '<div class="song"><div style="min-width:0"><div class="t">« ' + esc(v[0]) + " »</div>" + (v[1] ? '<div class="x">' + esc(v[1]) + "</div>" : "") + link + "</div><span></span></div>";
    }).join("");
    return fold("Voix", vx.length + " a cappella" + (who.length ? " · " + who.slice(0, 3).map(esc).join(", ") : ""), body);
  }
  function instFold(list) {
    if (!list || !list.length) return "";
    var body = '<div class="fxl">' + list.map(function (x) { return '<span class="fx v">' + esc(x[0]) + (x[1] ? "<small>" + esc(x[1]) + "</small>" : "") + "</span>"; }).join("") + "</div>";
    return fold("Instruments", list.map(function (x) { return esc(x[0]); }).join(" · "), body);
  }
  function masterBlock(m) {
    var ids = (m || []).filter(function (id) { return data.credits.plugins[id]; });
    if (!ids.length) return "";
    return '<h2 class="sec">Chaîne de mastering</h2><div class="chain">' + ids.map(function (id) {
      var pl = data.credits.plugins[id];
      return fxButton({ id: id, name: pl[0], vst: pl[1], on: ["Master"] }, ["Master"]);
    }).join("<i>→</i>") + "</div>";
  }
  function pics(x) {
    var out = [];
    if (x.dt) out.push('<span class="pic" title="Transposé de ' + (x.dt > 0 ? "+" : "") + x.dt + " demi-ton" + (Math.abs(x.dt) > 1 ? "s" : "") + '">' + IC.pitch + (x.dt > 0 ? "+" : "−") + Math.abs(x.dt) + "</span>");
    if (x.bpm) out.push('<span class="pic" title="Tempo ' + x.bpm[0] + " → " + x.bpm[1] + ' BPM">' + IC.tempo + x.bpm[0] + "→" + x.bpm[1] + "</span>");
    return out.length ? '<div class="x">' + out.join("") + "</div>" : "";
  }
  function songs(items, albumTitle, trackTitle, pro) {
    return items.map(function (x, i) {
      var artist = x.a ? '<button type="button" class="who-l" data-artist="' + esc(x.a) + '" title="Tous les samples de ' + esc(x.a) + ' chez INFRA">' + esc(x.a) + "</button>" : "";
      var sub = [artist, x.an ? esc(x.an) : "", x.v ? "voix" : ""].filter(Boolean).join(" · ");
      var title = pro ? "Contient un sample de « " + esc(x.t) + " »" : esc(x.t);
      var go = pro ? '<button type="button" class="sxgo" data-sxgo data-al="' + esc(albumTitle) + '" data-tr="' + esc(trackTitle) + '">Voir dans Samples ›</button>' : "";
      return '<div class="song"><div style="min-width:0"><div class="t">' + title + "</div>" + (sub ? '<div class="x">' + sub + "</div>" : "") + pics(x) + go + "</div>" +
        '<button type="button" class="lis" data-listen="' + i + '" data-al="' + esc(albumTitle) + '" data-tr="' + esc(trackTitle) + '" aria-label="Écouter ' + esc(x.t) + '" title="Écouter">' + IC.play + "</button></div>";
    }).join("");
  }
  function fold(title, summary, body) {
    return '<details class="fold"><summary><span style="min-width:0"><b>' + esc(title) + "</b><span>" + summary + "</span></span>" + IC.chev + "</summary>" + body + "</details>";
  }
  function soundsFold(c) {
    var n = count(c.sp) + (c.u || 0);
    if (!n) return "";
    var labs = {};
    (c.sp || []).forEach(function (s) { (labs[s[0]] = labs[s[0]] || []).push(s); });
    var names = Object.keys(labs).sort(function (a, b) { return count(labs[b]) - count(labs[a]); });
    var body = names.map(function (l) {
      return '<div class="lab">' + esc(l) + "</div>" + labs[l].map(function (s) {
        return '<div class="it"><div class="t" style="font-weight:600">' + esc(s[1] || "Splice") + '</div><div class="x">' + plural(s[2], "son") + "</div></div>";
      }).join("");
    }).join("") + (c.u ? '<div class="lab">Batterie</div><div class="it"><div class="x">' + plural(c.u, "son") + " d’origine inconnue</div></div>" : "");
    return fold("Sons", plural(n, "son") + (names.length ? " · " + plural(names.length, "créateur") : ""), body);
  }
  function count(list) { return (list || []).reduce(function (k, s) { return k + s[2]; }, 0); }
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
    return fold(labelTrack === "Par morceau" ? "Plugins les plus utilisés" : "Plugins", plural(all.length, "plugin") + (eds.length ? " · " + eds.slice(0, 3).map(esc).join(", ") : ""), body);
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
        var full = c && c.p;
        var sess = kv([
          ["Projet commencé", full ? quand(c.h) || quand(c.s) : ""],
          ["Dernière session", full && c.he && c.he !== c.h ? quand(c.he) : ""],
          ["Logiciel", full && c.v ? "Ableton Live " + c.v : ""],
          ["Tempo", full && c.b ? c.b + " BPM" : ""],
          ["Lieu", data.credits.lieu],
          ["Pistes", full ? pistesTxt(c.k) : ""]
        ]);
        return head + who() + sess +
          (items.length ? '<h2 class="sec">Samples <span>' + items.length + "</span></h2>" + songs(items, album.title, title, true) : "") +
          voixFold(c && c.vx) +
          (full ? instFold(c.in) + masterBlock(c.m) + soundsFold(c) + chainFold(c.p, c.m) : "") +
          '<div class="gear">Écoute : ' + esc(data.credits.materiel) + "<br>Tout sur ordinateur, aucune prise de son.</div>";
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
        var ok = cs.filter(function (c) { return c && c.p; });
        var st = ok.map(function (c) { return c.s; }).filter(Boolean).sort();
        var en = ok.map(function (c) { return c.e; }).filter(Boolean).sort();
        var vers = [];
        ok.forEach(function (c) { if (c.v && vers.indexOf(c.v) < 0) vers.push(c.v); });
        vers.sort(function (a, b) { return a.localeCompare(b, "fr", { numeric: true }); });
        var rows = album.tracks.map(function (t, i) {
          var c = cs[i];
          var items = samplesOf(album.title, t.title);
          var sons = c && c.p ? count(c.sp) + (c.u || 0) : 0;
          var sum = [c && c.h ? "commencé le " + court(c.h) : "", items.length ? plural(items.length, "sample") : "", sons ? plural(sons, "son") : ""].filter(Boolean).join(" · ") || "—";
          var inside = (items.length ? songs(items, album.title, t.title) : "") +
            '<button type="button" class="go" data-track="' + esc(slug) + ":" + (i + 1) + '">Tout le détail ' + IC.chev + "</button>";
          return '<details class="acc"><summary><span class="i">' + String(i + 1).padStart(2, "0") + '</span><span style="min-width:0"><span class="t">' + esc(t.title) +
            '</span><span class="x">' + sum + "</span></span>" + IC.chev + '</summary><div class="in">' + inside + "</div></details>";
        }).join("");
        var labs = {};
        ok.forEach(function (c) { (c.sp || []).forEach(function (s) { labs[s[0]] = (labs[s[0]] || 0) + s[2]; }); });
        var labNames = Object.keys(labs).sort(function (a, b) { return labs[b] - labs[a]; });
        var pistes = album.tracks.map(function (t, i) {
          var c = cs[i];
          if (!c || !c.p) return null;
          var ids = [];
          c.p.forEach(function (p) { p[1].forEach(function (id) { ids.push(id); }); });
          return [t.title, ids.concat(c.m || [])];
        }).filter(Boolean);
        return '<div class="crh"><img src="' + esc(cover(album)) + '" alt=""><div><h1>' + esc(album.title) + '</h1><div class="m">Crédits · ' + plural(album.tracks.length, "titre") + "</div></div></div>" +
          who() + kv([["Période", periode(st[0], en[en.length - 1])], ["Logiciel", vers.length ? "Ableton Live " + (vers.length > 1 ? vers[0] + " → " + vers[vers.length - 1] : vers[0]) : ""], ["Lieu", data.credits.lieu]]) +
          '<h2 class="sec">Morceaux</h2>' + rows +
          (labNames.length ? fold("Créateurs des sons", plural(labNames.length, "créateur"), '<p class="top">' + labNames.map(function (l) { return "<b>" + esc(l) + "</b> " + labs[l]; }).join(" · ") + "</p>") : "") +
          chainFold(pistes, [], "Par morceau") +
          '<div class="gear">Écoute : ' + esc(data.credits.materiel) + "<br>Tout sur ordinateur, aucune prise de son.</div>";
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
    var alb = t.closest("[data-album]");
    if (alb) { track("credits_album", {}); return show(albumView(alb.getAttribute("data-album"))); }
    var tab = t.closest("[data-goto-samples]");
    if (tab) { var b = document.querySelector('[data-bib-tab="samples"]'); if (b) b.click(); return; }
    var tr = t.closest("[data-track]");
    if (tr) {
      var p = tr.getAttribute("data-track").split(":");
      return show(trackView(p[0], Number(p[1])));
    }
    var lis = t.closest("[data-listen]");
    if (lis) return listen(lis);
    var sx = t.closest("[data-sxgo]");
    if (sx) return seeSamples(sx);
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
  function seeSamples(b) {
    track("credits_samples", {});
    var go = function (s) { close(); return s.openTrack(b.getAttribute("data-al"), b.getAttribute("data-tr")); };
    if (window.InfraSamples) return go(window.InfraSamples);
    var s = document.createElement("script");
    s.src = siteRoot() + "assets/js/samples.js?v=" + encodeURIComponent(BUILD);
    s.onload = function () { if (window.InfraSamples) go(window.InfraSamples); };
    document.head.appendChild(s);
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

  // ---------- Onglet Crédits (V26, validée par INFRA le 28/11/2026) ----------
  function pageHtml() {
    var albums = data.tracks.albums || [];
    var nTracks = 0, nSamples = 0, vers = [], years = [], use = {};
    albums.forEach(function (a) {
      nTracks += (a.tracks || []).length;
      (a.tracks || []).forEach(function (t, i) {
        var c = creditOf(a.slug, i + 1);
        if (samplesOf(a.title, t.title).length) nSamples++;
        if (!c || !c.p) return;
        if (c.v && vers.indexOf(c.v) < 0) vers.push(c.v);
        if (c.s) years.push(c.s.slice(0, 4));
        var seen = {};
        c.p.forEach(function (p) { p[1].forEach(function (id) { seen[id] = 1; }); });
        (c.m || []).forEach(function (id) { seen[id] = 1; });
        Object.keys(seen).forEach(function (id) { use[id] = (use[id] || 0) + 1; });
      });
    });
    vers.sort(function (a, b) { return a.localeCompare(b, "fr", { numeric: true }); });
    years.sort();
    var labs = {};
    (data.samples.albums || []).forEach(function (a) { (a.tracks || []).forEach(function (t) { (t.items || []).forEach(function (x) { if (x.a) labs[x.a] = 1; }); }); });
    var top = Object.keys(use).filter(function (id) { return data.credits.plugins[id] && data.credits.plugins[id][1]; })
      .sort(function (a, b) { return use[b] - use[a]; }).slice(0, 10).map(function (id) {
        var pl = data.credits.plugins[id];
        return fxButton({ id: id, name: pl[0], vst: 1, on: [] }, [plural(use[id], "morceau").replace("morceaus", "morceaux")]);
      }).join("");
    var grid = albums.map(function (a) {
      return '<button type="button" data-album="' + esc(a.slug) + '" title="Crédits de ' + esc(a.title) + '"><img src="' + esc(cover(a)) + '" alt="" loading="lazy" decoding="async"><span>' + esc(a.title) + "</span></button>";
    }).join("");
    return '<h1>Crédits</h1>' +
      '<div class="who"><b>' + esc(data.credits.by || "INFRA") + "</b><span>" + esc(ROLE_ORDER.join(" · ")) + " — " + nTracks + " morceaux, " + albums.length + " albums</span></div>" +
      '<div class="cols"><div>' + kv([["Logiciel", vers.length ? "Ableton Live " + (vers.length > 1 ? vers[0] + " → " + vers[vers.length - 1] : vers[0]) : ""], ["Lieu", data.credits.lieu],
        ["Écoute", data.credits.materiel], ["Depuis", years.length ? years[0] + " → aujourd’hui" : ""]]).replace(">Session<", ">Studio<") + "</div>" +
      '<div><h2 class="sec">Plugins les plus utilisés</h2><div class="fxl">' + top + "</div></div></div>" +
      '<h2 class="sec">Crédits par album</h2><div class="alg">' + grid + "</div>" +
      '<h2 class="sec">Samples et voix</h2><div class="line">' + nSamples + " morceaux contiennent un sample · " + plural(Object.keys(labs).length, "artiste samplé").replace("artistes samplé", "artistes samplés") +
      ' · <button type="button" class="sxgo" data-goto-samples>Voir dans Samples ›</button></div>';
  }
  function renderPage(el) {
    if (!el) return Promise.resolve(false);
    build();
    if (!el.__icr) {
      el.__icr = true;
      el.addEventListener("click", function (e) { if (el.querySelector(".icr-page")) onClick(e); });
      el.addEventListener("pointerover", function (e) { if (e.pointerType === "mouse" && el.querySelector(".icr-page")) { var b = e.target.closest("[data-fx]"); if (b) showFx(b); } });
      el.addEventListener("pointerout", function (e) { if (e.pointerType === "mouse" && e.target.closest("[data-fx]")) hideFx(); });
    }
    return load().then(function () {
      // On a pu changer d'onglet pendant le chargement : ne jamais écraser Samples ou une recherche.
      if (document.body.getAttribute("data-bib-view") !== "credits" || document.body.classList.contains("bib-searching")) return false;
      colors();
      el.innerHTML = '<div class="icr icr-page">' + pageHtml() + "</div>";
      track("credits_page", {});
      return true;
    });
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
    renderPage: renderPage,
    close: close,
    load: load
  };
})();
