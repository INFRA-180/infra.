// Onglet Samples · interface du Mix (choix validés par INFRA le 20/11/2026, LOT_SAMPLES_20261119 § T bis).
// Chargé par samples.js (injectCss), à côté de samples-mix.css. Ce fichier ne touche jamais au son :
// il lit et règle les options par l'API de l'agent son, si elle existe (InfraSamples.mix), sinon il
// montre les options grisées plutôt que de mentir.
//   - barre de pictos : touches 1 / 2 / 3, ← / → sur la barre (Mac) ; glisser entre sections (iPhone) ;
//   - menu ⋯ du Mix (page et lecteur) : Durée, Effet, « Écouter la transition », « Remettre par défaut » ;
//   - pendant une transition (événement samples:transition) : pochette suivante qui glisse, picto de
//     l'effet sur le bord, BPM qui compte de l'ancien au nouveau ;
//   - « À suivre » du Mix : petit picto d'effet entre deux lignes ;
//   - A cappella : mini-ligne de ton morceau avec le micro à l'entrée de la voix (champ at).
// Tout ce qui bouge respecte « Réduire les animations ».
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.InfraSamplesUI) return;

  // ---------- Réglages (à ajuster après validation de la maquette) ----------
  var CFG = {
    defaults: { dur: "4", fx: "fade" }, // T12 (27/11) : 4 mesures (l'ancien « Auto ») + Fondu
    // Durée en mesures (T12) au tempo du morceau qui se termine ; l'agent son plafonne à ce que l'extrait
    // permet et l'événement samples:transition donne la vraie durée en secondes (repli ci-dessous sinon).
    autoBars: 4,
    autoMin: 4,
    autoMax: 12,
    autoNoBpm: 8,
    // iPhone : options à griser « Pas encore sur iPhone » même si l'API répond (ex. ["fx:reverb"]).
    // Vide par défaut : T bis 1 = effets sur le sample seulement, ce qui marche aussi sur iPhone.
    // L'API peut aussi répondre elle-même : InfraSamples.mix.supports(kind, value) === false → grisé.
    iosOff: [],
    swipeEdge: 24, // pas de glisser à moins de 24 pt du bord (retour de Safari)
    swipeSlop: 16, // distance avant de décider horizontal / vertical (comme la bibliothèque)
    swipeRatio: 2, // horizontal si |dx| > 2 × |dy|
    swipeMin: 56, // distance pour changer de section au lâcher
    swipeFling: 0.5, // ou vitesse (px/ms) sur un geste plus court
    swipeFollow: 0.5, // le contenu suit le doigt à moitié
    xfEndFade: 250 // ms : disparition du calque de transition à la fin
  };
  var SECS = ["samples", "mix", "voix"];
  // T12 (validé, 27/11) : Aucune · 2 · 4 mesures ; 8 · 16 quand les extraits seront recoupés.
  var DUR = [
    ["none", "Aucune"],
    ["2", "2"],
    ["4", "4"]
  ];
  var DUR_LONG = { none: "Aucune", 2: "2 mesures", 4: "4 mesures" };
  function durName(v) {
    return DUR_LONG[v] || label(DUR, v);
  }
  var FX = [
    ["fade", "Fondu"],
    ["reverb", "Reverb"],
    ["echo", "Écho"],
    ["bass", "Basses"],
    ["random", "Hasard"]
  ];
  var FX_LONG = { bass: "Filtre de basses", random: "Hasard qui écoute" };

  // ---------- Pictos (24 × 24, trait 1,9 comme ceux du lecteur) ----------
  var LINE =
    ' fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  function svg(body, size) {
    return (
      '<svg viewBox="0 0 24 24" width="' +
      (size || 20) +
      '" height="' +
      (size || 20) +
      '" aria-hidden="true"' +
      LINE +
      ">" +
      body +
      "</svg>"
    );
  }
  var FX_ICON = {
    // Fondu = les deux ondes croisées du Mix (même sens, même dessin)
    fade: '<path d="M2.5 7c6 0 7 10 19 10"/><path d="M2.5 17c6 0 7-10 19-10"/>',
    // Reverb : un point puis trois arcs qui s'estompent
    reverb:
      '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><path d="M9 8.5a5 5 0 0 1 0 7"/><path d="M12.5 6a8.5 8.5 0 0 1 0 12" opacity=".65"/><path d="M16 3.5a12 12 0 0 1 0 17" opacity=".35"/>',
    // Écho : trois traits de plus en plus petits (des répétitions séparées)
    echo: '<path d="M5 4.5v15"/><path d="M11.5 7.5v9" opacity=".7"/><path d="M18 10v4" opacity=".4"/>',
    // Filtre de basses : courbe plate à droite qui plonge à gauche (filtre d'Ableton)
    bass: '<path d="M3 20c3.5 0 4.5-11 8.5-11H21"/>',
    // Hasard qui écoute : un dé (pas les flèches croisées, qui veulent déjà dire « ordre aléatoire »)
    random:
      '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>'
  };
  var ICON_PLAY = '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>';
  var ICON_RESET = '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.5v3.7h3.7"/>';
  var ICON_MIC =
    '<rect x="8.6" y="2.6" width="6.8" height="11.8" rx="3.4" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke-width="2.4"/>';

  // ---------- Outils ----------
  var scriptUrl = document.currentScript && document.currentScript.src;
  function rootUrl(rel) {
    try {
      return scriptUrl ? new URL("../../" + rel, scriptUrl).href : new URL(rel, document.baseURI).href;
    } catch (_e) {
      return rel;
    }
  }
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function track(name, extra) {
    try {
      if (typeof window.InfraTrackEvent === "function") window.InfraTrackEvent(name, extra || {});
    } catch (_e) {}
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function label(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1];
    return "";
  }
  function typing(t) {
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")));
  }
  function sheetEl() {
    return $(".smp-sheet.sx-fs");
  }
  function sheetOpen() {
    var s = sheetEl();
    return !!(s && !s.hidden && s.classList.contains("on"));
  }
  function mixPlaying() {
    var k = $("[data-smp-kicker]", sheetEl() || document);
    return !!(k && /^Mix · /.test(k.textContent || ""));
  }

  // ---------- Options du Mix (API de l'agent son, si elle existe) ----------
  function api() {
    var s = window.InfraSamples;
    return s && s.mix && typeof s.mix.getOptions === "function" ? s.mix : null;
  }
  function opts() {
    var m = api(),
      o = {};
    try {
      o = (m && m.getOptions()) || {};
    } catch (_e) {}
    // Le moteur nomme le hasard « listen » ; l'interface, « random ».
    if (o.fx === "listen") o.fx = "random";
    return {
      dur: label(DUR, o.dur) ? o.dur : CFG.defaults.dur,
      fx: label(FX, o.fx) ? o.fx : CFG.defaults.fx
    };
  }
  // Une option est utilisable si l'API existe et ne la refuse pas ; sur iPhone, CFG.iosOff en plus.
  function usable(kind, v) {
    var m = api();
    if (!m || typeof m.setOptions !== "function") return false;
    try {
      if (typeof m.supports === "function" && m.supports(kind, v) === false) return false;
    } catch (_e) {}
    return !(isIOS() && CFG.iosOff.indexOf(kind + ":" + v) >= 0);
  }
  function canTry() {
    var m = api();
    return !!(m && typeof m.previewTransition === "function");
  }
  function canReset() {
    var m = api();
    return !!(m && typeof m.resetOptions === "function");
  }
  function why() {
    return isIOS() ? "Pas encore sur iPhone" : "Pas encore disponible";
  }
  function optsLine() {
    var o = opts();
    return (
      '<span class="sx-opts-ic">' +
      svg(FX_ICON[o.fx], 18) +
      "</span><span>" +
      durName(o.dur) +
      " · " +
      label(FX, o.fx) +
      '</span><span class="sx-opts-go" aria-hidden="true">›</span>'
    );
  }
  function refreshLines() {
    var nodes = document.querySelectorAll("[data-sx-mixopts]");
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = optsLine();
    paintMarks();
  }

  // ---------- Menu ⋯ du Mix (réutilise le menu « ta-menu » du site : popover Mac, feuille iPhone) ----------
  var menu = null;
  function closeMenu() {
    if (!menu) return;
    menu.scrim.remove();
    menu.box.remove();
    var back = menu.invoker;
    menu = null;
    if (back && back.isConnected && typeof back.focus === "function") back.focus({ preventScroll: true });
  }
  function menuHtml() {
    var o = opts(),
      off = false;
    var chip = function (kind, v, name, icon) {
      var ok = usable(kind, v),
        on = (kind === "dur" ? o.dur : o.fx) === v;
      if (!ok) off = true;
      return (
        '<button type="button" role="menuitemradio" class="' +
        (on ? "on" : "") +
        (ok ? "" : " off") +
        '" data-sxm-' +
        kind +
        '="' +
        v +
        '" aria-checked="' +
        on +
        '"' +
        (ok ? "" : ' aria-disabled="true" title="' + why() + '"') +
        (kind === "fx" && FX_LONG[v] ? ' aria-label="' + FX_LONG[v] + '"' : "") +
        ">" +
        (icon ? svg(icon, 24) : "") +
        "<span>" +
        name +
        "</span></button>"
      );
    };
    var dur = DUR.map(function (d) {
        return chip("dur", d[0], d[1]);
      }).join(""),
      fx = FX.map(function (f) {
        return chip("fx", f[0], f[1], FX_ICON[f[0]]);
      }).join("");
    var act = function (key, icon, text, ok) {
      return (
        '<button type="button" role="menuitem" class="sxm-act' +
        (ok ? "" : " off") +
        '" data-sxm-act="' +
        key +
        '"' +
        (ok ? "" : ' aria-disabled="true" title="' + why() + '"') +
        ">" +
        svg(icon) +
        "<span>" +
        text +
        "</span></button>"
      );
    };
    return (
      '<div class="sxm-h">Durée en mesures</div><div class="sxm-dur" role="group" aria-label="Durée de transition, en mesures">' +
      dur +
      '</div><div class="sxm-h">Effet</div><div class="sxm-fx" role="group" aria-label="Effet de transition">' +
      fx +
      "</div>" +
      (off ? '<p class="sxm-note">' + why() + "</p>" : "") +
      '<div class="sxm-acts">' +
      act("try", ICON_PLAY, "Écouter la transition", canTry()) +
      act("reset", ICON_RESET, "Remettre par défaut", canReset()) +
      "</div>"
    );
  }
  function openMenu(invoker, viaKeyboard) {
    closeMenu();
    var dark = !!(invoker.closest && invoker.closest(".smp-sheet"));
    var asSheet = !viaKeyboard && window.matchMedia && window.matchMedia("(max-width: 639px)").matches;
    var scrim = document.createElement("div");
    scrim.className = "ta-scrim" + (asSheet ? " is-sheet" : "");
    var box = document.createElement("div");
    box.className = "ta-menu sxm" + (asSheet ? " is-sheet" : "") + (dark ? " is-dark" : "");
    box.setAttribute("role", "menu");
    box.setAttribute("aria-label", "Options du Mix");
    if (!dark) {
      var body = getComputedStyle(document.body);
      box.style.setProperty(
        "--ta-bg",
        body.backgroundColor && body.backgroundColor !== "rgba(0, 0, 0, 0)" ? body.backgroundColor : "#fff"
      );
      box.style.setProperty("--ta-ink", body.color || "#111");
    }
    box.innerHTML = menuHtml();
    document.body.append(scrim, box);
    if (!asSheet) {
      var r = invoker.getBoundingClientRect(),
        w = box.offsetWidth,
        h = box.offsetHeight,
        left = r.right - w,
        top = r.bottom + 4;
      if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 4);
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      box.style.left = left + "px";
      box.style.top = top + "px";
    }
    menu = { scrim: scrim, box: box, invoker: invoker };
    scrim.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      closeMenu();
    });
    box.addEventListener("click", onMenuClick);
    var first = box.querySelector("button.on:not(.off)") || box.querySelector("button");
    if (viaKeyboard && first) first.focus();
  }
  function onMenuClick(e) {
    var b = e.target.closest && e.target.closest("button");
    if (!b || !menu) return;
    if (b.classList.contains("off")) return; // grisé : ne fait rien, la raison est écrite
    var m = api(),
      d = b.getAttribute("data-sxm-dur"),
      f = b.getAttribute("data-sxm-fx"),
      a = b.getAttribute("data-sxm-act");
    if (!m) return;
    try {
      if (d || f) {
        var next = opts();
        if (d) next.dur = d;
        if (f) next.fx = f;
        m.setOptions(d ? { dur: d } : { fx: f });
        track("samples_mix_opt", { dur: next.dur, fx: next.fx });
        menu.box.innerHTML = menuHtml(); // reste ouvert : on voit le choix
        var again = menu.box.querySelector(d ? '[data-sxm-dur="' + d + '"]' : '[data-sxm-fx="' + f + '"]');
        if (again && document.activeElement === document.body) again.focus();
        refreshLines();
        return;
      }
      if (a === "reset") {
        m.resetOptions();
        var o = opts();
        track("samples_mix_opt", { dur: o.dur, fx: o.fx, reset: 1 });
        menu.box.innerHTML = menuHtml();
        refreshLines();
        return;
      }
      if (a === "try") {
        closeMenu();
        track("samples_mix_try", {});
        m.previewTransition();
      }
    } catch (_e) {}
  }

  // ---------- Barre de pictos : clavier (Mac) ----------
  var focusTabAfter = false;
  function tabsEl() {
    var t = $("[data-sx-tabs]");
    return t && t.isConnected && t.offsetParent !== null ? t : null;
  }
  function goSec(sec) {
    var bar = tabsEl(),
      b = bar && bar.querySelector('[data-smp-sec="' + sec + '"]');
    if (b && b.getAttribute("aria-selected") !== "true") b.click();
    return !!b;
  }
  function curSec() {
    var on = $("[data-sx-tabs] .sx-tab.on");
    return on ? on.getAttribute("data-smp-sec") : "";
  }
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (menu) return;
    if (sheetOpen()) {
      // Mac : T = écouter la prochaine transition (lecteur Mix ouvert)
      if ((e.key === "t" || e.key === "T") && !typing(e.target) && mixPlaying() && canTry()) {
        e.preventDefault();
        track("samples_mix_try", { key: 1 });
        try {
          api().previewTransition();
        } catch (_e) {}
      }
      return;
    }
    if (typing(e.target) || !tabsEl()) return;
    var i = "123".indexOf(e.key);
    if (i >= 0 && e.key.length === 1) {
      e.preventDefault();
      goSec(SECS[i]);
      return;
    }
    var onTab = e.target && e.target.closest && e.target.closest(".sx-tab");
    if (onTab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      var k = SECS.indexOf(curSec()) + (e.key === "ArrowRight" ? 1 : -1);
      e.preventDefault();
      if (k < 0 || k >= SECS.length) return;
      focusTabAfter = true;
      goSec(SECS[k]);
    }
  });
  // Échap ferme le menu sans fermer le lecteur (capture sur la fenêtre, avant le lecteur)
  window.addEventListener(
    "keydown",
    function (e) {
      if (menu && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      }
    },
    true
  );
  window.addEventListener("resize", closeMenu);

  // Clics : ⋯ et ligne des réglages ; repère de voix
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var opener = t.closest("[data-sx-mixopts],[data-sx-mixmore]");
    if (opener) {
      e.preventDefault();
      openMenu(opener, e.detail === 0);
      return;
    }
    var vm = t.closest("[data-sx-vgo]");
    if (vm) {
      var go = $("[data-smp-goto]", sheetEl() || document);
      track("samples_voice_mark", { at: Number(vm.getAttribute("data-sx-at")) || 0 });
      if (go) go.click();
    }
  });

  // ---------- Glisser entre sections (iPhone) ----------
  // La bibliothèque glisse déjà entre ses onglets (bibliotheque.js, tabSwipe). Ici, sur la page Samples :
  // le glisser change d'abord de section ; au bord (Samples vers la droite, A cappella vers la gauche),
  // il laisse la main à la bibliothèque. Tant que le sens n'est pas décidé, on retient ses touchmove.
  var sw = null;
  window.addEventListener(
    "touchstart",
    function (e) {
      sw = null;
      if (!e.touches || e.touches.length !== 1 || menu || sheetOpen()) return;
      var t = e.target,
        page = t && t.closest && t.closest("[data-sx-page]");
      if (!page || t.closest("input, textarea, select")) return;
      var x = e.touches[0].clientX;
      if (x < CFG.swipeEdge || x > window.innerWidth - CFG.swipeEdge) return;
      sw = { page: page, x: x, y: e.touches[0].clientY, t: Date.now(), mode: "", dx: 0 };
    },
    { capture: true, passive: true }
  );
  window.addEventListener(
    "touchmove",
    function (e) {
      if (!sw || !e.touches || !e.touches[0]) return;
      var dx = e.touches[0].clientX - sw.x,
        dy = e.touches[0].clientY - sw.y;
      if (!sw.mode) {
        if (Math.sqrt(dx * dx + dy * dy) <= CFG.swipeSlop) {
          e.stopPropagation(); // la bibliothèque ne décide pas avant nous
          return;
        }
        if (Math.abs(dx) <= Math.abs(dy) * CFG.swipeRatio) {
          sw.mode = "pass"; // vertical : défilement normal
          return;
        }
        var k = SECS.indexOf(curSec()) + (dx < 0 ? 1 : -1);
        sw.to = SECS[k];
        sw.mode = sw.to ? "mine" : "pass"; // au bord : onglet de la bibliothèque
        if (sw.mode === "pass") return;
        sw.page.classList.add("sx-swiping");
      }
      if (sw.mode !== "mine") return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      sw.dx = dx;
      if (!reduced()) sw.page.style.setProperty("--sx-swipe-x", (dx * CFG.swipeFollow).toFixed(1) + "px");
    },
    { capture: true, passive: false }
  );
  function swipeEnd() {
    if (!sw || sw.mode !== "mine") {
      sw = null;
      return;
    }
    var g = sw,
      v = Math.abs(g.dx) / Math.max(1, Date.now() - g.t);
    sw = null;
    g.page.classList.remove("sx-swiping");
    g.page.style.setProperty("--sx-swipe-x", "0px");
    if (Math.abs(g.dx) >= CFG.swipeMin || (Math.abs(g.dx) >= 24 && v >= CFG.swipeFling)) {
      track("samples_tab_swipe", { from: curSec(), to: g.to });
      goSec(g.to);
    }
  }
  window.addEventListener("touchend", swipeEnd, true);
  window.addEventListener("touchcancel", swipeEnd, true);

  // ---------- Pendant une transition ----------
  // Événement de l'agent son : samples:transition, detail { phase, fx, dur, fromBpm, toBpm, toCover }.
  var xf = { raf: 0, timer: 0 };
  function durSeconds(d) {
    var dur = d.dur,
      n = Number(dur);
    if (typeof dur === "number") return Math.max(0, n || 0);
    if (dur === "none") return 0;
    // choix en mesures (« 2 », « 4 ») si l'événement ne donne pas les secondes
    var bars = dur === "2" ? 2 : CFG.autoBars,
      bpm = Number(d.fromBpm);
    if (!(bpm > 0)) return CFG.autoNoBpm;
    return Math.max(CFG.autoMin, Math.min(CFG.autoMax, (bars * 4 * 60) / bpm));
  }
  function coverUrl(c) {
    if (!c) return "";
    return /^(https?:|data:|blob:|\/)/.test(c) ? c : rootUrl(c);
  }
  function stopXf(box) {
    cancelAnimationFrame(xf.raf);
    clearTimeout(xf.timer);
    xf.raf = 0;
    if (!box) return;
    box.classList.remove("on", "go", "reduce");
    box.style.removeProperty("--sx-xf-dur");
  }
  function countBpm(el, from, to, ms) {
    if (!el || !(from > 0) || !(to > 0) || from === to) return;
    var t0 = performance.now();
    var step = function (now) {
      var p = Math.min(1, (now - t0) / Math.max(1, ms));
      el.textContent = String(Math.round(from + (to - from) * p));
      if (p < 1) xf.raf = requestAnimationFrame(step);
    };
    el.textContent = String(Math.round(from));
    xf.raf = requestAnimationFrame(step);
  }
  window.addEventListener(
    "samples:transition",
    function (e) {
      var d = (e && e.detail) || {},
        s = sheetEl(),
        box = s && $("[data-sx-xf]", s),
        bpm = s && $("[data-smp-bpm] b", s);
      if (!box) return;
      if (d.phase === "end") {
        cancelAnimationFrame(xf.raf);
        if (bpm && Number(d.toBpm) > 0) bpm.textContent = String(Math.round(d.toBpm));
        box.classList.remove("go");
        xf.timer = setTimeout(function () {
          stopXf(box);
        }, CFG.xfEndFade);
        return;
      }
      if (d.phase !== "start") return;
      stopXf(box);
      var secs = durSeconds(d),
        fx = FX_ICON[d.fx] ? d.fx : "fade",
        img = box.querySelector("img");
      if (!(secs > 0) || !sheetOpen()) return; // « Aucune » : coupe sèche, rien ne glisse
      img.src = coverUrl(d.toCover) || img.src;
      box.querySelector(".sx-xf-fx").innerHTML = svg(FX_ICON[fx], 28);
      box.style.setProperty("--sx-xf-dur", secs + "s");
      box.classList.toggle("reduce", reduced());
      box.classList.add("on");
      void box.offsetWidth; // départ à 0 % avant de lancer la transition CSS
      box.classList.add("go");
      if (!reduced()) countBpm(bpm, Number(d.fromBpm), Number(d.toBpm), secs * 1000);
      // filet de sécurité : si « end » n'arrive pas, le calque s'en va après la durée
      xf.timer = setTimeout(
        function () {
          stopXf(box);
        },
        secs * 1000 + 1500
      );
    },
    true
  );

  // ---------- « À suivre » du Mix : picto d'effet entre deux lignes ----------
  function paintMarks() {
    var s = sheetEl(),
      ol = s && $("[data-smp-list]", s);
    if (!ol) return;
    var old = ol.querySelectorAll(".sx-xfm");
    for (var i = 0; i < old.length; i++) old[i].remove();
    var mix = mixPlaying() && !!ol.querySelector(".smp-row em");
    ol.classList.toggle("sx-hasxf", mix);
    if (!mix) return;
    var o = opts(),
      icon = svg(FX_ICON[o.fx], 16),
      rows = ol.querySelectorAll("li"),
      title = durName(o.dur) + " · " + (FX_LONG[o.fx] || label(FX, o.fx));
    for (var k = 1; k < rows.length; k++) {
      if (!rows[k].querySelector(".smp-row") || !rows[k - 1].querySelector(".smp-row")) continue;
      var li = document.createElement("li");
      li.className = "sx-xfm";
      li.setAttribute("aria-hidden", "true");
      li.title = title;
      li.innerHTML = icon;
      ol.insertBefore(li, rows[k]);
    }
  }

  // ---------- A cappella : micro à l'entrée de la voix ----------
  var secondsBySrc = null;
  function trackSeconds() {
    if (secondsBySrc) return Promise.resolve(secondsBySrc);
    var u = new URL(rootUrl("data/tracks.json"));
    if (window.INFRA_BUILD_TAG) u.searchParams.set("v", window.INFRA_BUILD_TAG);
    return fetch(u, { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        var m = {};
        ((j && j.albums) || []).forEach(function (a) {
          (a.tracks || []).forEach(function (t) {
            if (t.src && Number(t.seconds) > 0) m[t.src] = Number(t.seconds);
          });
        });
        secondsBySrc = m;
        return m;
      })
      .catch(function () {
        return {};
      });
  }
  function norm(v) {
    return String(v || "")
      .normalize("NFC")
      .trim()
      .toLocaleUpperCase("fr");
  }
  // Ce qu'on entend : InfraSamples.current() si l'agent son l'expose, sinon lu dans le lecteur.
  function currentVoice() {
    var S = window.InfraSamples,
      s = sheetEl();
    if (S && typeof S.current === "function") {
      try {
        var c = S.current();
        return Promise.resolve(c && c.v ? c : null);
      } catch (_e) {}
    }
    var go = s && $("[data-smp-goto]", s),
      who = s && $("[data-smp-a]", s);
    if (!go || !who || !/(^|· )voix( ·|$)/.test(who.textContent || "")) return Promise.resolve(null);
    var m = /Entre à (\d+):(\d\d)/.exec(go.textContent || ""),
      b = go.querySelector("b");
    if (!m || !b || !S || typeof S.load !== "function") return Promise.resolve(null);
    var at = Number(m[1]) * 60 + Number(m[2]),
      name = norm(b.textContent);
    return S.load()
      .then(function (data) {
        var hit = null;
        ((data && data.albums) || []).forEach(function (a) {
          (a.items || []).forEach(function (i) {
            if (!hit && i.v && norm(i.track) === name && Math.round(i.at) === at) hit = i;
          });
        });
        return hit;
      })
      .catch(function () {
        return null;
      });
  }
  var vmTicket = 0;
  function paintVoice() {
    var s = sheetEl(),
      box = s && $("[data-sx-vmark]", s);
    if (!box) return;
    var ticket = ++vmTicket;
    currentVoice()
      .then(function (cur) {
        if (!cur || !cur.src || !isFinite(cur.at)) return null;
        return trackSeconds().then(function (m) {
          return { cur: cur, len: m[cur.src] || 0 };
        });
      })
      .then(function (r) {
        if (ticket !== vmTicket) return;
        // Jamais de repère faux : pas de temps connu, ou entrée après la fin du morceau (D4) → rien.
        if (!r || !(r.len > 0) || !(r.cur.at >= 0) || r.cur.at > r.len) {
          box.hidden = true;
          box.innerHTML = "";
          return;
        }
        var pct = (100 * r.cur.at) / r.len,
          at = Math.round(r.cur.at),
          mm = Math.floor(at / 60) + ":" + String(at % 60).padStart(2, "0");
        box.innerHTML =
          '<button type="button" class="sx-vline" data-sx-vgo data-sx-at="' +
          at +
          '" aria-label="Aller au morceau, la voix entre à ' +
          mm +
          '" title="Aller au morceau · la voix entre à ' +
          mm +
          '"><span class="sx-vtrk"><i style="left:' +
          pct.toFixed(2) +
          '%">' +
          svg(ICON_MIC, 20) +
          "</i></span></button>";
        box.hidden = false;
      });
  }

  // ---------- Lecteur : branchements (le lecteur est créé à la première ouverture) ----------
  function bindSheet(s) {
    if (!s || s.__sxBound) return;
    s.__sxBound = true;
    var more = $(".sx-tools [data-sx-mixmore]", s);
    var onTop = function () {
      if (more) more.hidden = !mixPlaying();
    };
    var mo = function (sel, fn, opt) {
      var el = $(sel, s);
      if (el) new MutationObserver(fn).observe(el, opt || { childList: true });
    };
    mo("[data-smp-kicker]", onTop, { childList: true, characterData: true, subtree: true });
    mo("[data-smp-list]", function () {
      if (!$("[data-smp-list] .sx-xfm", s)) paintMarks();
    });
    mo("[data-smp-leg]", paintVoice);
    mo("[data-smp-a]", paintVoice, { childList: true, characterData: true, subtree: true });
    new MutationObserver(function () {
      if (s.hidden) {
        stopXf($("[data-sx-xf]", s));
        closeMenu();
      }
    }).observe(s, { attributes: true, attributeFilter: ["hidden"] });
    onTop();
    paintMarks();
    paintVoice();
  }
  function watchSheet() {
    var s = sheetEl();
    if (s) return bindSheet(s);
    var mo = new MutationObserver(function () {
      var el = sheetEl();
      if (el) {
        mo.disconnect();
        bindSheet(el);
      }
    });
    mo.observe(document.body, { childList: true });
  }

  // ---------- Après chaque rendu de la page (appelé par samples.js) ----------
  function afterRender(panel) {
    var root = panel || document;
    var lines = root.querySelectorAll("[data-sx-mixopts]");
    for (var i = 0; i < lines.length; i++) if (!lines[i].innerHTML) lines[i].innerHTML = optsLine();
    if (focusTabAfter) {
      focusTabAfter = false;
      var on = $("[data-sx-tabs] .sx-tab.on", root);
      if (on) on.focus({ preventScroll: true });
    }
  }

  window.InfraSamplesUI = {
    afterRender: afterRender,
    optsLine: optsLine,
    refresh: refreshLines
  };
  afterRender(document);
  if (document.body) watchSheet();
  else document.addEventListener("DOMContentLoaded", watchSheet);
})();
