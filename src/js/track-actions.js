// Menu discret d'un morceau (INFRA, 19/11/2026 : « faut que ce soit discret », « pas de cadre »).
// Aucune icône en plus sur les lignes : on l'ouvre par l'appui long (téléphone) ou le clic droit
// (ordinateur), ou Maj+F10 / touche Menu au clavier, sur une ligne de morceau (Bibliothèque, page d'album).
// Actions : Télécharger le morceau (Cloudflare, pochette intégrée), Partager… (carte de partage), Copier le lien.
(function () {
  "use strict";

  const WORKER_URL = "https://infra180-api.pages.dev";
  const LONG_PRESS_MS = 480;
  const MOVE_TOLERANCE_PX = 10;
  const ROW_SELECTOR = ".bib-li[data-bib-path], .track-player[data-favorite-path]";
  // Lignes où l'appui long sert déjà à autre chose (réordonner « À suivre ») : pas de menu.
  const EXCLUDED = "[data-queue-list], .upnext, .queue-list, [data-transport-queue]";
  let menu = null;
  let press = null;
  let swallowClickUntil = 0;

  function trackOf(row) {
    const path = row.getAttribute("data-bib-path") || row.getAttribute("data-favorite-path") || "";
    const match = path.match(/streams\/(?:[^/]+\/)?([a-z0-9-]+)\/(\d{1,3})-[^/]+\.m4a$/i); // avec ou sans dossier de version
    if (!match) return null;
    const titleNode = row.querySelector(".tx .t, .track-name");
    const albumNode = row.querySelector(".tx .a");
    const pageTitle = document.querySelector("body.album-screen main h1");
    return {
      slug: match[1],
      n: Number(match[2]),
      title: titleNode ? titleNode.textContent.trim() : "Morceau",
      album: albumNode ? albumNode.textContent.trim() : pageTitle ? pageTitle.textContent.trim() : ""
    };
  }

  function siteRoot() {
    const link = document.querySelector('link[rel="manifest"]');
    const base = link ? new URL(".", link.href) : new URL("./", window.location.href);
    return base.href.replace(/(music|playlists)\/$/, "");
  }

  function trackUrl(t) {
    return `${siteRoot()}music/${t.slug}-infra.html#titre-${t.n}`;
  }

  function say(message) {
    // Même petit message que le reste du site : en bas, discret, puis il s'efface.
    let toast = document.getElementById("infraTrackToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "infraTrackToast";
      toast.className = "ta-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-on");
    window.clearTimeout(say.timer);
    say.timer = window.setTimeout(function () { toast.classList.remove("is-on"); }, 1800);
  }

  async function copyLink(url) {
    const api = window.InfraShare;
    const ok = api && typeof api.copy === "function" ? await api.copy(url) : false;
    say(ok ? "Lien copié" : "Copie impossible");
  }

  function download(t) {
    const a = document.createElement("a");
    a.href = `${WORKER_URL}/download/${t.slug}/${t.n}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    say(`Téléchargement : ${t.title}`);
  }

  function share(t, invoker) {
    const api = window.InfraShare;
    const url = trackUrl(t);
    if (api && typeof api.open === "function") api.open({ title: t.title, url, element: invoker });
    else copyLink(url);
  }

  const ICON = {
    dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M6 12v7h12v-7"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
  };

  function injectStyle() {
    if (document.getElementById("infraTrackActionsStyle")) return;
    const style = document.createElement("style");
    style.id = "infraTrackActionsStyle";
    // Couleurs du site lui-même (fond et encre de la page), aucune bordure : seulement une ombre douce.
    style.textContent = `
      .ta-scrim { position: fixed; inset: 0; z-index: 2147483000; background: transparent; }
      .ta-scrim.is-sheet { background: rgba(0,0,0,.28); }
      .ta-menu { position: fixed; z-index: 2147483001; min-width: 220px; max-width: min(300px, calc(100vw - 32px)); padding: 6px;
        border-radius: 12px; background: var(--ta-bg, #fff); color: var(--ta-ink, #111); box-shadow: 0 10px 34px rgba(0,0,0,.16);
        font: 400 14px/1.3 "Avenir Next", "Avenir", Arial, sans-serif; }
      .ta-menu.is-sheet { left: 0 !important; right: 0; top: auto !important; bottom: 0; max-width: none; min-width: 0;
        border-radius: 16px 16px 0 0; padding: 8px 16px calc(14px + env(safe-area-inset-bottom)); box-shadow: none; }
      .ta-menu .ta-head { padding: 8px 8px 10px; }
      .ta-menu.is-sheet .ta-head { padding: 6px 0 10px; }
      .ta-menu .ta-head b { display: block; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-menu .ta-head span { display: block; font-size: 12px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-menu button { display: grid; grid-template-columns: 24px 1fr; gap: 12px; align-items: center; width: 100%; min-height: 40px;
        padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .ta-menu.is-sheet button { min-height: 52px; padding: 0; font-size: 16px; }
      .ta-menu button:hover, .ta-menu button:focus-visible { background: rgba(127,127,127,.12); outline: none; }
      .ta-menu svg { width: 20px; height: 20px; justify-self: center; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .ta-toast { position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 2147483002; padding: 8px 14px; border-radius: 999px;
        background: rgba(17,17,17,.92); color: #fff; font: 600 13px/1.2 "Avenir Next", "Avenir", Arial, sans-serif; opacity: 0;
        transform: translate(-50%, 6px); transition: opacity .15s, transform .15s; pointer-events: none; }
      .ta-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
      .bib-li.ta-held, .track-player.ta-held { opacity: .7; transition: opacity .15s; }
      /* Finition 19/11 (INFRA : « j'appuie sur le morceau, ça sélectionne et ça me dit copier ») : aucune
         ligne de morceau ni de liste ne se sélectionne ; posé dès le chargement, pas au 1er menu. */
      .bib-li, .bib-row, .track-player, .bib-list-rows a { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      @media (prefers-reduced-motion: reduce) { .ta-toast { transition: none; } }`;
    document.head.appendChild(style);
  }

  function closeMenu() {
    if (!menu) return;
    menu.scrim.remove();
    menu.box.remove();
    if (menu.row) menu.row.classList.remove("ta-held");
    const back = menu.invoker;
    menu = null;
    if (back && typeof back.focus === "function" && document.activeElement === document.body) back.focus({ preventScroll: true });
  }

  function openMenu(row, x, y, viaKeyboard) {
    const t = trackOf(row);
    if (!t) return;
    closeMenu();
    injectStyle();
    const sheet = window.matchMedia && window.matchMedia("(max-width: 639px)").matches && !viaKeyboard && x !== null;
    const body = getComputedStyle(document.body);
    const scrim = document.createElement("div");
    scrim.className = "ta-scrim" + (sheet ? " is-sheet" : "");
    const box = document.createElement("div");
    box.className = "ta-menu" + (sheet ? " is-sheet" : "");
    box.setAttribute("role", "menu");
    box.setAttribute("aria-label", t.title);
    box.style.setProperty("--ta-bg", body.backgroundColor && body.backgroundColor !== "rgba(0, 0, 0, 0)" ? body.backgroundColor : "#fff");
    box.style.setProperty("--ta-ink", body.color || "#111");
    const items = [
      ["dl", "Télécharger le morceau", function () { download(t); }],
      ["share", "Partager…", function () { share(t, row); }],
      ["link", "Copier le lien", function () { copyLink(trackUrl(t)); }]
    ];
    box.innerHTML =
      `<div class="ta-head"><b></b><span></span></div>` +
      items.map(function (it, i) { return `<button type="button" role="menuitem" data-ta="${i}">${ICON[it[0]]}<span>${it[1]}</span></button>`; }).join("");
    box.querySelector(".ta-head b").textContent = t.title;
    box.querySelector(".ta-head span").textContent = t.album;
    document.body.append(scrim, box);
    if (!sheet) {
      const r = row.getBoundingClientRect();
      const w = box.offsetWidth, h = box.offsetHeight;
      let left = x !== null ? x : r.right - w;
      let top = y !== null ? y : r.bottom + 4;
      if (top + h > window.innerHeight - 12) top = Math.max(12, (y !== null ? y : r.top) - h - 4);
      left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      box.style.left = left + "px";
      box.style.top = top + "px";
    }
    row.classList.add("ta-held");
    menu = { scrim, box, row, invoker: row.querySelector("button") || row };
    scrim.addEventListener("pointerdown", function (e) { e.preventDefault(); swallowClickUntil = Date.now() + 500; closeMenu(); });
    scrim.addEventListener("contextmenu", function (e) { e.preventDefault(); closeMenu(); });
    box.addEventListener("click", function (e) {
      const b = e.target.closest("[data-ta]");
      if (!b) return;
      const action = items[Number(b.getAttribute("data-ta"))][2];
      closeMenu();
      action();
    });
    if (viaKeyboard) box.querySelector("button").focus();
  }

  function rowFrom(target) {
    if (!(target instanceof Element) || target.closest(EXCLUDED)) return null;
    return target.closest(ROW_SELECTOR);
  }

  // Clic droit (ordinateur)
  document.addEventListener("contextmenu", function (e) {
    if (menu && menu.box.contains(e.target)) return;
    const row = rowFrom(e.target);
    if (!row) return;
    e.preventDefault();
    openMenu(row, e.clientX, e.clientY, false);
  });

  // Appui long (doigt) : 480 ms sans bouger ; bouger annule (le défilement reste libre)
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    const row = rowFrom(e.target);
    if (!row || e.target.closest(".bib-heart, [data-bib-trackheart]")) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, row, timer: window.setTimeout(function () {
      if (!press) return;
      swallowClickUntil = Date.now() + 700;
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (_e) { /* pas de vibration */ }
      openMenu(press.row, press.x, press.y, false);
      press = null;
    }, LONG_PRESS_MS) };
  }, { capture: true, passive: true });
  function cancelPress() { if (press) { window.clearTimeout(press.timer); press = null; } }
  document.addEventListener("pointermove", function (e) {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE_PX) cancelPress();
  }, { capture: true, passive: true });
  document.addEventListener("pointerup", cancelPress, { capture: true, passive: true });
  document.addEventListener("pointercancel", cancelPress, { capture: true, passive: true });
  window.addEventListener("scroll", cancelPress, { capture: true, passive: true });
  // Le relâchement de l'appui long ne lance pas le morceau
  document.addEventListener("click", function (e) {
    if (Date.now() < swallowClickUntil && (rowFrom(e.target) || (menu && menu.box.contains(e.target)))) { e.preventDefault(); e.stopImmediatePropagation(); swallowClickUntil = 0; }
  }, true);

  // Clavier : Maj+F10 ou touche Menu sur une ligne ; ↑ ↓ dans le menu ; Échap ferme
  document.addEventListener("keydown", function (e) {
    if (menu) {
      const items = Array.from(menu.box.querySelectorAll("[data-ta]"));
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      } else if ((e.key === " " || e.key === "Enter") && i >= 0) {
        e.preventDefault();
        e.stopPropagation();
        items[i].click();
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
      }
      return;
    }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      const row = rowFrom(document.activeElement);
      if (row) { e.preventDefault(); openMenu(row, null, null, true); }
    }
  }, true);
  window.addEventListener("resize", closeMenu);
  injectStyle();
  // Lien partagé d'un morceau (…-infra.html#titre-N, finition 19/11) : la page de l'album s'ouvre sur ce
  // morceau (défilement jusqu'à lui, ligne brièvement marquée) ; on attend que les lignes soient là (3 s au plus).
  function revealSharedTrack() {
    const m = /^#titre-(\d+)$/.exec(window.location.hash || "");
    if (!m) return;
    const n = Number(m[1]);
    let tries = 0;
    (function look() {
      const rows = document.querySelectorAll(".track-player");
      const row = rows[n - 1];
      if (!row) { if (++tries < 30) window.setTimeout(look, 100); return; }
      // défilement direct, un peu après l'ouverture (le site remet la page en haut au chargement)
      window.setTimeout(function () {
        row.scrollIntoView({ block: "center" });
        row.classList.add("ta-held");
        window.setTimeout(function () { row.classList.remove("ta-held"); }, 1600);
      }, 300);
    })();
  }
  if (document.readyState === "complete") revealSharedTrack();
  else window.addEventListener("load", revealSharedTrack, { once: true });
  window.addEventListener("hashchange", revealSharedTrack);
  document.addEventListener("selectstart", function (e) {
    const el = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    if (rowFrom(el)) e.preventDefault();
  }, true);
  window.addEventListener("scroll", function () { if (menu && !menu.box.classList.contains("is-sheet")) closeMenu(); }, { capture: true, passive: true });
})();
