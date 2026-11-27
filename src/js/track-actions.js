// Menu discret d'un morceau (INFRA, 19/11/2026 : « faut que ce soit discret », « pas de cadre »).
// Aucune icône en plus sur les lignes : on l'ouvre par l'appui long (téléphone) ou le clic droit
// (ordinateur), ou Maj+F10 / touche Menu au clavier, sur une ligne de morceau (Bibliothèque, page d'album).
// Actions : Télécharger le morceau (Cloudflare, pochette intégrée), Partager… (carte de partage), Copier le lien.
// 19/11/2026 (INFRA : « partager dans le grand lecteur, trois petits points ») : « ⋯ » à côté du cœur du grand
// lecteur, même menu + « Aller vers le sample » et « Crédits » quand le morceau a des samples.
(function () {
  "use strict";

  const WORKER_URL = "https://infra180-api.pages.dev";
  const LONG_PRESS_MS = 480;
  const MOVE_TOLERANCE_PX = 10;
  const ROW_SELECTOR =
    ".bib-li[data-bib-path], .track-player[data-favorite-path], .favorites-track-row[data-favorite-path], button.bib-row[data-bib-favplay]";
  // 23/11/2026 (INFRA : « chaque clic droit sur le site fasse quelque chose », « les playlists et tout ») :
  // clic droit partout où il y a de la musique — morceau, album, playlist, mini-lecteur, grand lecteur, logo.
  const ALBUM_LINK = 'a[href*="music/"][href$="-infra.html"]';
  const PLAYLIST_LINK = 'a[href*="playlists/"][href$=".html"]';
  // Au doigt, l'appui long sur le logo et les pochettes ouvre la carte QR (validé le 13/11) : on n'y touche pas.
  const SHARE_ZONE = "body.home-screen .hero-title-link, body.home-screen .album-card .album-cover, body.album-screen .album-layout .cover";
  // Le menu du navigateur reste là où il sert : champs, texte choisi, onglet Samples (il a son propre menu).
  const NATIVE_ZONE = "input, textarea, select, [contenteditable], [data-sx-page], .sx-sheet, dialog";
  // Lignes où l'appui long sert déjà à autre chose (réordonner « À suivre ») : pas de menu.
  const EXCLUDED = "[data-queue-list], .upnext, .queue-list, [data-transport-queue]";
  let menu = null;
  let press = null;
  let swallowClickUntil = 0;
  let swallowAnyUntil = 0; // fond du menu touché : le clic qui suit ne doit rien activer dessous
  let awaitRelease = false; // appui long : seul le clic de CE relâchement est avalé

  const TRACK_PATH = /streams\/(?:[^/]+\/)?([a-z0-9-]+)\/(\d{1,3})-[^/]+\.m4a$/i; // avec ou sans dossier de version
  // Position réelle du morceau dans son album (audit du 19/11) : le numéro du nom de fichier peut mentir
  // (V-23π56 : STROMBOLI et PANAREA sont tous deux « 08- ») ; le serveur, lui, compte les positions.
  let positions = null;
  let albumList = []; // tracks.json : slug, titre, page, morceaux (pour les menus d'album)
  function loadPositions() {
    if (positions) return;
    positions = {};
    fetch(`${siteRoot()}data/tracks.json?v=${encodeURIComponent(window.INFRA_BUILD_TAG || "")}`)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        albumList = (data && data.albums) || [];
        albumList.forEach(function (a) {
          (a.tracks || []).forEach(function (t, i) {
            const m = String(t.src || "").match(TRACK_PATH);
            if (m) positions[`${m[1]}/${String(t.src).split("/").pop()}`] = i + 1;
          });
        });
      })
      .catch(function () { positions = null; });
  }
  function positionOf(path, match) {
    const key = `${match[1]}/${String(path).split("/").pop()}`;
    return (positions && positions[key]) || Number(match[2]);
  }
  function trackOf(row) {
    let path = row.getAttribute("data-bib-path") || row.getAttribute("data-favorite-path") || "";
    if (!path && row.hasAttribute("data-bib-favplay")) {
      const favs = window.InfraHomeFavorites && typeof window.InfraHomeFavorites.list === "function" ? window.InfraHomeFavorites.list() : [];
      const fav = favs[Number(row.getAttribute("data-bib-favplay"))];
      path = fav ? fav.path || "" : "";
    }
    const match = path.match(TRACK_PATH);
    if (!match) return null;
    const titleNode = row.querySelector(".tx .t, .track-name, .infra-track-title");
    const albumNode = row.querySelector(".tx .a, .infra-track-album");
    const pageTitle = document.querySelector("body.album-screen main h1");
    return {
      slug: match[1],
      n: positionOf(path, match),
      title: titleNode ? titleNode.textContent.trim() : "Morceau",
      album: row.getAttribute("data-track-album") || (albumNode ? albumNode.textContent.trim() : pageTitle ? pageTitle.textContent.trim() : ""),
      path
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

  // Finition 19/11 : on vérifie d'abord que le fichier est disponible (en-têtes seulement, la suite est coupée) ;
  // sinon une erreur du serveur (ou hors ligne) remplaçait toute la page et coupait la musique.
  function download(t) {
    const url = `${WORKER_URL}/download/${t.slug}/${t.n}`;
    const stop = typeof AbortController === "function" ? new AbortController() : null;
    say(`Préparation : ${t.title}`);
    fetch(url, { mode: "cors", cache: "no-store", signal: stop ? stop.signal : undefined })
      .then(function (response) {
        if (stop) stop.abort();
        if (!response.ok) {
          say(response.status === 429 ? "Trop de téléchargements, réessaie dans une minute" : "Téléchargement indisponible pour le moment");
          return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        a.setAttribute("download", "");
        document.body.appendChild(a);
        a.click();
        a.remove();
        say(`Téléchargement : ${t.title}`);
      })
      .catch(function () {
        say(navigator.onLine === false ? "Téléchargement impossible hors ligne" : "Téléchargement indisponible pour le moment");
      });
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
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    sample: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l2-6 3 12 3-9 2 3h5"/></svg>',
    credits: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h3"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c4 0 5 10 9 10H20M17 14l3 3-3 3M4 17h3.5c1.6 0 2.7-1.6 3.6-3.4M13.4 9.4C14.3 8 15.2 7 16.5 7H20M17 4l3 3-3 3"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M4 11h10M4 16h6M15 14v6M12 17h6"/></svg>',
    queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10M18 14v6M15 17h6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    album: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>'
  };

  function injectStyle() {
    if (document.getElementById("infraTrackActionsStyle")) return;
    const style = document.createElement("style");
    style.id = "infraTrackActionsStyle";
    // Couleurs du site lui-même (fond et encre de la page), aucune bordure : seulement une ombre douce.
    style.textContent = `
      .ta-scrim { position: fixed; inset: 0; z-index: 2147483000; background: transparent; }

      .ta-menu { position: fixed; z-index: 2147483001; min-width: 220px; max-width: min(300px, calc(100vw - 32px)); padding: 6px;
        border-radius: 12px; background: var(--ta-bg, #fff); color: var(--ta-ink, #111); box-shadow: 0 10px 34px rgba(0,0,0,.16);
        font: 400 14px/1.3 "Avenir Next", "Avenir", Arial, sans-serif; }
      .ta-menu.is-sheet { left: 0 !important; right: 0; top: auto !important; bottom: 0; max-width: none; min-width: 0;
        border-radius: 16px 16px 0 0; padding: 8px 16px calc(14px + env(safe-area-inset-bottom)); box-shadow: none; }
      .ta-menu .ta-head { padding: 8px 8px 10px; }
      .ta-menu .ta-sep { height: 1px; margin: 5px 8px; background: currentColor; opacity: .12; }
      .ta-menu.is-sheet .ta-sep { margin: 4px 0; }
      .ta-menu.is-sheet .ta-head { padding: 6px 0 10px; }
      .ta-menu .ta-head b { display: block; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-menu .ta-head span { display: block; font-size: 12px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-menu button { display: grid; grid-template-columns: 24px 1fr; gap: 12px; align-items: center; width: 100%; min-height: 40px;
        padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .ta-menu.is-sheet button { min-height: 52px; padding: 0; font-size: 16px; }
      /* 27/11 (INFRA, iPhone : « bug de sélection ») : le doigt encore posé à l'ouverture laissait l'entrée
         dessous grisée (survol collant d'iOS). Survol seulement avec une vraie souris ; au doigt, rien. */
      .ta-menu button:focus-visible { background: rgba(127,127,127,.12); outline: none; }
      @media (hover: hover) and (pointer: fine) { .ta-menu button:hover { background: rgba(127,127,127,.12); } }
      .ta-menu button:focus:not(:focus-visible) { outline: none; }
      .ta-menu, .ta-scrim { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
      /* Appui long façon Apple : la ligne s'enfonce un peu pendant l'appui, puis se détache (plus grande,
         ombre, coins arrondis) au-dessus du fond flouté ; elle se recolle à sa place en fermant. */
      .ta-pressing { transform: scale(.975); transition: transform .38s cubic-bezier(.2,.8,.2,1); }
      .ta-lift { position: fixed; z-index: 2147483001; margin: 0 !important; pointer-events: none; box-sizing: border-box;
        background: var(--ta-bg, #fff); color: var(--ta-ink, #111); border-radius: 12px; overflow: hidden;
        transform-origin: 50% 50%; transition: transform .32s cubic-bezier(.2,.8,.2,1.1), box-shadow .32s ease, opacity .2s ease;
        box-shadow: 0 0 0 rgba(0,0,0,0); }
      .ta-lift-track { display: flex; align-items: center; gap: 12px; padding: 10px 14px;
        font: 400 15px/1.25 "Avenir Next", "Avenir", Arial, sans-serif; }
      .ta-lift-track img { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex: none; }
      .ta-lift-track div { min-width: 0; }
      .ta-lift-track b { display: block; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-lift-track span { display: block; font-size: 13px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ta-lift.is-up { box-shadow: 0 14px 40px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.08); }
      .ta-lift-hidden { visibility: hidden; }
      .ta-menu.has-lift .ta-head { display: none; }
      .ta-menu.is-sheet.has-lift { padding-top: 12px; }
      .ta-scrim.is-sheet { background: rgba(0,0,0,.18); -webkit-backdrop-filter: blur(14px) saturate(1.1); backdrop-filter: blur(14px) saturate(1.1);
        animation: ta-fade .22s ease both; }
      @keyframes ta-fade { from { opacity: 0; } to { opacity: 1; } }
      .ta-menu.is-sheet { animation: ta-rise .28s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes ta-rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .ta-pressing { transform: none; } .ta-lift { transition: opacity .15s; } .ta-scrim.is-sheet, .ta-menu.is-sheet { animation: none; }
      }
      .ta-menu .ta-credit { padding: 8px 8px 10px; font-size: 13px; line-height: 1.35; }
      .ta-menu.is-sheet .ta-credit { padding: 8px 0 10px; font-size: 15px; }
      .ta-menu .ta-credit b { font-weight: 600; } .ta-menu .ta-credit span { opacity: .55; }
      .ta-menu .ta-credits { max-height: min(50vh, 360px); overflow-y: auto; }
      .now-playing-meta.has-more { grid-template-columns: minmax(0, 1fr) 40px 40px; column-gap: 0; }
      .now-playing-meta.has-more .now-playing-meta-text { margin-right: 12px; }
      .np-more { width: 40px; min-height: 40px; display: grid; place-items: center; justify-self: end; align-self: start; border: 0;
        background: transparent; color: rgba(255,255,255,.92); padding: 0; cursor: pointer; touch-action: manipulation; }
      .np-more svg { width: 25px; height: 25px; display: block; fill: currentColor; }
      /* Ordinateur : le cœur est dans la barre du haut (V19) ; « ⋯ » se place juste avant lui. */
      @media (min-width: 981px) {
        .now-playing-meta.has-more { grid-template-columns: minmax(0, 1fr) 40px; column-gap: 12px; }
        .now-playing-meta.has-more .now-playing-meta-text { margin-right: 0; }
        .np-more { position: absolute; top: 50px; right: 272px; width: 44px; min-height: 44px; z-index: 5; }
        .now-playing-overlay.is-queue-inline .np-more { top: calc(50px + var(--np-scroll, 0px) - var(--np-bar-shift, 0px)); }
      }
      /* Audit 19/11 : à 1024 px la colonne de lecture ne faisait que 260 px et les commandes dépassaient la barre. */
      @media (min-width: 981px) and (max-width: 1199px) {
        .now-playing-panel { column-gap: 48px; padding-left: 48px; padding-right: 48px; }
      }
      .ta-menu.is-dark { --ta-bg: rgba(28,28,30,.97); --ta-ink: #fff; }
      .np-more:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; border-radius: 6px; }
      .ta-menu svg { width: 20px; height: 20px; justify-self: center; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .ta-toast { position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 2147483002; padding: 8px 14px; border-radius: 999px;
        background: rgba(17,17,17,.92); color: #fff; font: 600 13px/1.2 "Avenir Next", "Avenir", Arial, sans-serif; opacity: 0;
        transform: translate(-50%, 6px); transition: opacity .15s, transform .15s; pointer-events: none; }
      .ta-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
      .bib-li.ta-held, .track-player.ta-held { opacity: .7; transition: opacity .15s; }
      /* Finition 19/11 (INFRA : « j'appuie sur le morceau, ça sélectionne et ça me dit copier ») : aucune
         ligne de morceau ni de liste ne se sélectionne ; posé dès le chargement, pas au 1er menu. */
      .bib-li, .bib-row, .track-player, .bib-list-rows a, .favorites-track-row, a.album-card, a.playlist-card { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      @media (prefers-reduced-motion: reduce) { .ta-toast { transition: none; } }`;
    document.head.appendChild(style);
  }

  // ---------- Décollage (27/11/2026) ----------
  let lift = null; // { el, clone }
  let liftNext = null; // élément touché à l'appui long, décollé à l'ouverture du menu
  function liftRow(el, box, pageBg, pageInk) {
    if (lift && lift.el === el) { placeLift(box); return; }
    dropLift(true);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Morceau : aperçu propre (pochette, titre, album), comme Musique d'Apple ; une ligne copiée hors de sa
    // liste perdait sa mise en page. Carte d'album ou de playlist : copiée telle quelle.
    const t = el.matches(ROW_SELECTOR) ? trackOf(el) : null;
    let clone;
    if (t) {
      const album = albumBySlug(t.slug);
      clone = document.createElement("div");
      clone.className = "ta-lift ta-lift-track";
      clone.innerHTML = (album && album.cover ? `<img src="${esc(siteRoot() + album.cover)}" alt="">` : "") + "<div><b></b><span></span></div>";
      clone.querySelector("b").textContent = t.title;
      clone.querySelector("span").textContent = t.album;
    } else {
      clone = el.cloneNode(true);
      clone.querySelectorAll("audio, video, iframe, [id]").forEach(function (n) { if (/^(AUDIO|VIDEO|IFRAME)$/.test(n.tagName)) n.remove(); else n.removeAttribute("id"); });
      clone.removeAttribute("id");
      clone.classList.remove("ta-pressing", "ta-held");
      clone.classList.add("ta-lift");
    }
    clone.setAttribute("aria-hidden", "true");
    clone.style.left = r.left + "px";
    clone.style.top = r.top + "px";
    clone.style.width = r.width + "px";
    const h = t ? Math.max(64, r.height) : r.height;
    clone.style.height = h + "px";
    if (t) clone.style.top = r.top - (h - r.height) / 2 + "px";
    clone.style.setProperty("--ta-bg", pageBg);
    clone.style.setProperty("--ta-ink", pageInk);
    clone.style.transformOrigin = "50% 0";
    clone.style.transform = "scale(.975)";
    document.body.appendChild(clone);
    el.classList.remove("ta-pressing");
    el.classList.add("ta-lift-hidden");
    lift = { el, clone, top: t ? r.top - (h - r.height) / 2 : r.top, height: h };
    placeLift(box);
  }
  function placeLift(box, settled) {
    if (!lift) return;
    const isSheet = box && box.classList.contains("is-sheet");
    if (!isSheet) { applyLift(0, 1.03); return; }
    // Téléphone : l'élément reste à sa place si la feuille ne le cache pas ; sinon il monte juste au-dessus,
    // et s'il est trop grand pour tenir (carte de playlist), il se réduit comme l'aperçu d'Apple.
    const bottomMax = sheetTopOf(box) - 20;
    const topMin = 12 + safeTop();
    let scale = 1.03;
    if (lift.height * scale > bottomMax - topMin) scale = Math.max(0.45, (bottomMax - topMin) / lift.height);
    let top = Math.min(lift.top, bottomMax - lift.height * scale);
    top = Math.max(topMin, top);
    applyLift(top - lift.top, scale);
    if (!settled) window.setTimeout(function () { if (lift && menu && menu.box === box) placeLift(box, true); }, 320);
  }
  // Safari iPhone : on prend le plus haut des deux (zone visible ou position annoncée de la feuille).
  function sheetTopOf(box) {
    const vv = window.visualViewport;
    const visibleBottom = vv ? Math.min(window.innerHeight, vv.offsetTop + vv.height) : window.innerHeight;
    return Math.min(box.getBoundingClientRect().top, window.innerHeight - box.offsetHeight, visibleBottom - box.offsetHeight);
  }
  function applyLift(dy, scale) {
    if (!lift) return;
    lift.dy = Math.round(dy);
    requestAnimationFrame(function () {
      if (!lift) return;
      lift.clone.classList.add("is-up");
      lift.clone.style.transformOrigin = "50% 0";
      lift.clone.style.transform = `translateY(${lift.dy}px) scale(${scale.toFixed(3)})`;
    });
  }
  function safeTop() {
    return 36; // sous la barre d'état (iPhone, app installée)
  }
  function dropLift(now) {
    if (!lift) return;
    const l = lift;
    lift = null;
    if (now) { l.clone.remove(); l.el.classList.remove("ta-lift-hidden"); return; }
    l.clone.classList.remove("is-up");
    l.clone.style.transform = "none";
    window.setTimeout(function () {
      l.el.classList.remove("ta-lift-hidden");
      l.clone.remove();
    }, 260);
  }

  function closeMenu(rebuilding) {
    if (!rebuilding) dropLift(false);
    if (!menu) return;
    document.removeEventListener("touchmove", blockScrollBehindMenu, { capture: true });
    menu.scrim.remove();
    menu.box.remove();
    if (menu.row) menu.row.classList.remove("ta-held");
    const back = menu.invoker;
    menu = null;
    if (back && typeof back.focus === "function" && document.activeElement === document.body) back.focus({ preventScroll: true });
  }

  // ---------- Menus par élément (23/11/2026) ----------
  function playback() { return window.InfraLibraryPlayback || null; }
  function favApi() { return window.InfraHomeFavorites || null; }
  function play(paths, shuffled) {
    const api = playback();
    if (!api || typeof api.playPaths !== "function" || !paths.length) return say("Lecture indisponible pour le moment");
    const list = paths.slice();
    if (shuffled) for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const k = list[i]; list[i] = list[j]; list[j] = k; }
    api.playPaths(list, 0);
  }
  function queue(paths, where, label) {
    const api = playback();
    const done = api && typeof api.queuePaths === "function" ? api.queuePaths(paths, where) : false;
    if (done === "queued") say(where === "end" ? `Ajouté à la file : ${label}` : `Joué ensuite : ${label}`);
    else if (!done) say("Impossible pour le moment");
  }
  function isFavorite(path) {
    const api = favApi();
    return Boolean(api && path && typeof api.has === "function" && api.has(path));
  }
  function toggleFavorite(t) {
    const api = favApi();
    if (!api || !t.path || typeof api.toggle !== "function") return say("Favoris indisponibles");
    const was = isFavorite(t.path);
    Promise.resolve(api.toggle(t.path)).then(function () { say(was ? "Retiré des favoris" : "Ajouté aux favoris"); });
  }
  function albumBySlug(slug) { return albumList.find(function (a) { return a.slug === slug; }) || null; }
  function albumByPage(href) {
    const file = String(href || "").split(/[?#]/)[0].split("/").pop();
    return albumList.find(function (a) { return String(a.page || "").split("/").pop() === file; }) || null;
  }
  function onPage(page) {
    return String(window.location.pathname).split("/").pop() === String(page || "").split("/").pop();
  }
  function srcsOf(album) { return (album.tracks || []).map(function (x) { return x.src; }); }
  function goTo(url) {
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click(); // le routeur du site prend le lien comme un toucher normal (navigation douce)
    a.remove();
  }
  function downloadAlbum(slug, title) {
    const a = document.createElement("a");
    a.href = `${WORKER_URL}/download/${slug}`;
    a.rel = "noopener";
    a.setAttribute("download", "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    say(`Téléchargement : ${title}`);
  }
  function openSamplesAlbum(title) {
    samplesApi().then(function (api) { return api.openAlbum ? api.openAlbum(title) : false; })
      .then(function (ok) { if (!ok) say("Aucun sample pour cet album"); })
      .catch(function () { say("Samples indisponibles hors ligne"); });
  }
  function hasSamplesNow(t) {
    // Réponse immédiate si les samples sont déjà chargés ; sinon le menu se complète dès qu'ils arrivent.
    return samplesOf(t);
  }

  function trackItems(t, row, ctx) {
    const album = albumBySlug(t.slug);
    const items = ctx.current ? [] : [
      ["next", "Lire ensuite", function () { queue([t.path], "next", t.title); }],
      ["queue", "Ajouter à la file", function () { queue([t.path], "end", t.title); }],
      "-"
    ];
    items.push(
      ["heart", isFavorite(t.path) ? "Retirer des favoris" : "Ajouter aux favoris", function () { toggleFavorite(t); }]
    );
    if (ctx.samples && ctx.samples.length) {
      items.push(["sample", ctx.samples.length > 1 ? "Afficher les samples" : "Afficher le sample", function () { goToSample(t); }]);
    }
    items.push(["credits", "Crédits", function () { openCredits("track", t.slug, t.n); }]);
    if (album && !onPage(album.page)) items.push(["album", "Aller à l'album", function () { goTo(`${siteRoot()}${album.page}`); }]);
    items.push("-", ["dl", "Télécharger le morceau", function () { download(t); }]);
    if (album) items.push(["dl", "Télécharger l'album", function () { downloadAlbum(album.slug, album.title); }]);
    items.push("-", ["share", "Partager…", function () { share(t, row); }], ["link", "Copier le lien", function () { copyLink(trackUrl(t)); }]);
    return items;
  }

  function openTrackMenu(row, t, x, y, viaKeyboard, extraTop) {
    const build = function (list) {
      return (extraTop || []).concat(trackItems(t, row, { samples: list, current: Boolean(extraTop) }));
    };
    showMenu(t, row, x, y, viaKeyboard, build(null), x !== null);
    const shown = menu;
    hasSamplesNow(t).then(function (list) {
      if (!list || !list.length || menu !== shown) return;
      const focused = shown.box.contains(document.activeElement);
      showMenu(t, row, x, y, focused, build(list), x !== null);
    });
  }

  function albumMenu(album, el, x, y, viaKeyboard, withSamples) {
    const head = { title: album.title, album: `${(album.tracks || []).length} titres` };
    const srcs = srcsOf(album);
    const items = [
      ["play", "Lire", function () { play(srcs, false); }],
      ["shuffle", "Lecture aléatoire", function () { play(srcs, true); }],
      ["next", "Lire ensuite", function () { queue(srcs, "next", album.title); }],
      ["queue", "Ajouter à la file", function () { queue(srcs, "end", album.title); }],
      "-"
    ];
    if (!onPage(album.page)) items.push(["album", "Ouvrir l'album", function () { goTo(`${siteRoot()}${album.page}`); }]);
    if (withSamples) items.push(["sample", "Samples de l'album", function () { openSamplesAlbum(album.title); }]);
    items.push(["credits", "Crédits de l'album", function () { openCredits("album", album.slug); }]);
    items.push("-", ["dl", "Télécharger l'album", function () { downloadAlbum(album.slug, album.title); }]);
    const url = `${siteRoot()}${album.page}`;
    items.push("-", ["share", "Partager…", function () { shareUrl(album.title, url, el); }], ["link", "Copier le lien", function () { copyLink(url); }]);
    showMenu(head, el, x, y, viaKeyboard, items, x !== null);
    if (withSamples) return;
    const shown = menu;
    albumHasSamples(album.title).then(function (yes) {
      if (yes && menu === shown) albumMenu(album, el, x, y, shown.box.contains(document.activeElement), true);
    });
  }
  function albumHasSamples(title) {
    const wait = new Promise(function (resolve) { window.setTimeout(function () { resolve(null); }, 2500); });
    const get = samplesApi().then(function (api) { return api.load(); }).catch(function () { return null; });
    return Promise.race([get, wait]).then(function (data) {
      const a = data && (data.albums || []).find(function (x) { return sameText(x.title, title); });
      return Boolean(a && a.items && a.items.length);
    });
  }

  let playlistData = null;
  function loadPlaylists() {
    if (playlistData) return playlistData;
    playlistData = fetch(`${siteRoot()}data/playlists.json?v=${encodeURIComponent(window.INFRA_BUILD_TAG || "")}`)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.playlists) || []; })
      .catch(function () { playlistData = null; return []; });
    return playlistData;
  }
  function playlistMenu(href, el, x, y, viaKeyboard) {
    const file = String(href || "").split(/[?#]/)[0].split("/").pop();
    loadPlaylists().then(function (list) {
      const pl = list.find(function (p) { return String(p.page || "").split("/").pop() === file; });
      if (!pl) return;
      const srcs = (pl.tracks || []).map(function (x) { return x.src; });
      const url = `${siteRoot()}${pl.page}`;
      const items = [
        ["play", "Lire", function () { play(srcs, false); }],
        ["shuffle", "Lecture aléatoire", function () { play(srcs, true); }],
        ["next", "Lire ensuite", function () { queue(srcs, "next", pl.name); }],
        ["queue", "Ajouter à la file", function () { queue(srcs, "end", pl.name); }],
        "-"
      ];
      if (!onPage(pl.page)) items.push(["album", "Ouvrir la playlist", function () { goTo(url); }], "-");
      items.push(["share", "Partager…", function () { shareUrl(pl.name, url, el); }], ["link", "Copier le lien", function () { copyLink(url); }]);
      showMenu({ title: pl.name, album: `Playlist · ${srcs.length} titres` }, el, x, y, viaKeyboard, items, x !== null);
    });
  }
  function shareUrl(title, url, el) {
    const api = window.InfraShare;
    if (api && typeof api.open === "function") api.open({ title, url, element: el });
    else copyLink(url);
  }
  function logoMenu(el, x, y, viaKeyboard) {
    const url = siteRoot();
    showMenu({ title: "INFRA.", album: "Le site" }, el, x, y, viaKeyboard, [
      ["share", "Partager le site…", function () { shareUrl("INFRA.", url, el); }],
      ["link", "Copier le lien du site", function () { copyLink(url); }]
    ], x !== null);
  }
  function miniPlayerMenu(el, x, y, viaKeyboard) {
    const t = currentTrackFromPath();
    if (!t) return;
    const openPlayer = ["open", "Ouvrir le lecteur", function () {
      const title = document.querySelector("#infraGlobalTransport [data-transport-now-title]");
      if (title) title.click();
    }];
    openTrackMenu(el, t, x, y, viaKeyboard, [openPlayer, "-"]);
  }
  function currentTrackFromPath() {
    const api = favApi();
    const path = api && typeof api.current === "function" ? api.current() : "";
    const match = String(path || "").match(TRACK_PATH);
    if (!match) return null;
    const album = albumBySlug(match[1]);
    const n = positionOf(path, match);
    const meta = album && album.tracks ? album.tracks[n - 1] : null;
    return { slug: match[1], n, path, title: meta ? meta.title : "Morceau", album: album ? album.title : "" };
  }

  // Quel élément du site est sous le pointeur, et de quel genre (null = menu du navigateur)
  function targetFrom(node) {
    if (!(node instanceof Element)) return null;
    if (node.closest(EXCLUDED) || node.closest(NATIVE_ZONE)) return null;
    if (menu && menu.box.contains(node)) return null;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && sel.containsNode && sel.containsNode(node, true)) return null;
    const row = node.closest(ROW_SELECTOR);
    if (row) return { kind: "track", el: row };
    const np = node.closest("#infraNowPlayingOverlay");
    if (np) return node.closest(".now-playing-queue, [data-now-playing-queue]") ? null : { kind: "now", el: np };
    const mini = node.closest("#infraGlobalTransport");
    if (mini) return node.closest("[data-transport-mini-progress]") ? null : { kind: "mini", el: mini };
    const logo = node.closest(".hero-title-link");
    if (logo) return { kind: "logo", el: logo };
    const pl = node.closest(PLAYLIST_LINK);
    if (pl) return { kind: "playlist", el: pl, href: pl.getAttribute("href") };
    const al = node.closest(ALBUM_LINK);
    if (al) return { kind: "album", el: al, href: al.getAttribute("href") };
    const header = node.closest("body.album-screen main.page h1, body.album-screen .album-layout .cover, body.album-screen .playlist-hero-art");
    if (header) {
      const slug = document.body.getAttribute("data-playlist-slug");
      if (slug || document.body.classList.contains("playlist-screen")) return { kind: "playlist", el: header, href: window.location.pathname };
      return { kind: "album", el: header, href: window.location.pathname };
    }
    return null;
  }

  function openMenu(target, x, y, viaKeyboard) {
    loadPositions();
    if (target.kind === "track") {
      const t = trackOf(target.el);
      if (t) openTrackMenu(target.el, t, x, y, viaKeyboard);
    } else if (target.kind === "album") {
      const album = albumByPage(target.href);
      if (album) albumMenu(album, target.el, x, y, viaKeyboard);
      else if (!albumList.length) waitData(function () { const a = albumByPage(target.href); if (a) albumMenu(a, target.el, x, y, viaKeyboard); });
    } else if (target.kind === "playlist") playlistMenu(target.href, target.el, x, y, viaKeyboard);
    else if (target.kind === "logo") logoMenu(target.el, x, y, viaKeyboard);
    else if (target.kind === "mini") {
      if (albumList.length) miniPlayerMenu(target.el, x, y, viaKeyboard);
      else waitData(function () { miniPlayerMenu(target.el, x, y, viaKeyboard); });
    } else if (target.kind === "now") openNowPlayingMenu(x, y);
  }
  function waitData(fn) {
    let tries = 0;
    (function again() { if (albumList.length) fn(); else if (++tries < 25) window.setTimeout(again, 80); })();
  }

  function showMenu(t, row, x, y, viaKeyboard, items, asSheet) {
    closeMenu(true);
    injectStyle();
    const sheet = window.matchMedia && window.matchMedia("(max-width: 639px)").matches && !viaKeyboard && asSheet;
    const body = getComputedStyle(document.body);
    const scrim = document.createElement("div");
    scrim.className = "ta-scrim" + (sheet ? " is-sheet" : "");
    const box = document.createElement("div");
    box.className = "ta-menu" + (sheet ? " is-sheet" : "");
    box.setAttribute("role", "menu");
    box.setAttribute("aria-label", t.title);
    if (row.closest && row.closest("#infraNowPlayingOverlay")) box.classList.add("is-dark");
    else {
      box.style.setProperty("--ta-bg", body.backgroundColor && body.backgroundColor !== "rgba(0, 0, 0, 0)" ? body.backgroundColor : "#fff");
      box.style.setProperty("--ta-ink", body.color || "#111");
    }
    box.innerHTML =
      `<div class="ta-head"><b></b><span></span></div>` +
      items.map(function (it, i) {
        if (it === "-") return i && i < items.length - 1 && items[i - 1] !== "-" ? '<div class="ta-sep" role="separator"></div>' : "";
        return `<button type="button" role="menuitem" data-ta="${i}">${ICON[it[0]] || ""}<span>${esc(it[1])}</span></button>`;
      }).join("");
    box.querySelector(".ta-head b").textContent = t.title;
    box.querySelector(".ta-head span").textContent = t.album;
    box.querySelectorAll("[data-ta]").forEach(function (b) {
      if (items[Number(b.getAttribute("data-ta"))][3] === "keep") b.setAttribute("aria-haspopup", "true");
    });
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
    const touched = liftNext && (liftNext === row || (row.contains && row.contains(liftNext)) || (liftNext.contains && liftNext.contains(row)));
    if (touched || (lift && lift.el === row)) liftRow(lift && lift.el === row ? row : liftNext, box, box.style.getPropertyValue("--ta-bg") || "#fff", box.style.getPropertyValue("--ta-ink") || "#111");
    else if (row.matches && row.matches(ROW_SELECTOR)) row.classList.add("ta-held"); // souris : simple marque
    if (lift) box.classList.add("has-lift"); // l'aperçu montre déjà titre et album : pas de doublon (charte)
    liftNext = null;
    menu = { scrim, box, row, invoker: row.matches("button, a") ? row : row.querySelector("button, a") || row };
    document.addEventListener("touchmove", blockScrollBehindMenu, { capture: true, passive: false });
    scrim.addEventListener("pointerdown", function (e) { e.preventDefault(); swallowAnyUntil = Date.now() + 500; closeMenu(); });
    scrim.addEventListener("contextmenu", function (e) { e.preventDefault(); closeMenu(); });
    box.addEventListener("click", function (e) {
      const b = e.target.closest("[data-ta]");
      if (!b) return;
      const it = items[Number(b.getAttribute("data-ta"))];
      if (it[3] === "keep") { it[2](box); return; } // reste ouvert (Crédits)
      closeMenu();
      it[2]();
    });
    if (viaKeyboard) box.querySelector("button").focus();
  }

  function rowFrom(target) {
    if (!(target instanceof Element) || target.closest(EXCLUDED)) return null;
    return target.closest(ROW_SELECTOR);
  }

  // Clic droit (ordinateur) ; Alt + clic droit = menu du navigateur
  document.addEventListener("contextmenu", function (e) {
    if (e.altKey || (menu && menu.box.contains(e.target))) return;
    const target = targetFrom(e.target);
    if (!target) return;
    e.preventDefault();
    openMenu(target, e.clientX, e.clientY, false);
  });

  // Appui long (doigt) : 480 ms sans bouger ; bouger annule (le défilement reste libre)
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    if (!(e.target instanceof Element) || e.target.closest(SHARE_ZONE)) return;
    const row = targetFrom(e.target);
    // Au doigt : lignes, albums et playlists en liste ; le lecteur garde ses propres gestes.
    if (!row || row.kind === "mini" || row.kind === "now" || e.target.closest(".bib-heart, [data-bib-trackheart], [data-bib-favheart], [data-favorite-drag], [data-favorite-select]")) return;
    const el = row.el;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, row, el,
      // la ligne s'enfonce doucement si le doigt reste posé (après 120 ms : un simple toucher ne bouge rien)
      sink: window.setTimeout(function () { if (press && press.el === el) el.classList.add("ta-pressing"); }, 120),
      timer: window.setTimeout(function () {
        if (!press) return;
        swallowClickUntil = Date.now() + 5000;
        awaitRelease = true;
        try { if (navigator.vibrate) navigator.vibrate(8); } catch (_e) { /* pas de vibration */ }
        liftNext = el;
        window.setTimeout(function () { if (liftNext === el && !menu) { liftNext = null; el.classList.remove("ta-pressing"); } }, 2500);
        openMenu(press.row, press.x, press.y, false);
        press = null;
      }, LONG_PRESS_MS) };
  }, { capture: true, passive: true });
  function cancelPress() {
    if (!press) return;
    window.clearTimeout(press.timer);
    window.clearTimeout(press.sink);
    if (press.el && liftNext !== press.el) press.el.classList.remove("ta-pressing");
    press = null;
  }
  document.addEventListener("pointermove", function (e) {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE_PX) cancelPress();
  }, { capture: true, passive: true });
  document.addEventListener("pointerup", function () {
    cancelPress();
    // Audit 19/11 : avant, la garde restait armée 700 ms et avalait le 1er vrai toucher dans le menu.
    if (awaitRelease) { awaitRelease = false; swallowClickUntil = Date.now() + 150; }
  }, { capture: true, passive: true });
  // Menu ouvert pendant que le doigt est encore posé : il ne fait plus défiler la liste derrière.
  // 23/11/2026 : écouteur posé seulement menu ouvert (non passif en permanence, il retardait tout défilement).
  function blockScrollBehindMenu(e) {
    if (menu && !menu.box.contains(e.target)) e.preventDefault();
  }
  document.addEventListener("pointercancel", cancelPress, { capture: true, passive: true });
  window.addEventListener("scroll", cancelPress, { capture: true, passive: true });
  // Le relâchement de l'appui long ne lance pas le morceau
  document.addEventListener("click", function (e) {
    const now = Date.now();
    if (now < swallowAnyUntil) { e.preventDefault(); e.stopImmediatePropagation(); swallowAnyUntil = 0; return; }
    if (now < swallowClickUntil && (targetFrom(e.target) || (menu && (menu.box.contains(e.target) || menu.scrim === e.target)))) { e.preventDefault(); e.stopImmediatePropagation(); swallowClickUntil = 0; }
  }, true);
  // Retour (historique) : le menu et la carte de partage ne restent pas ouverts sur la page d'avant (audit 19/11).
  window.addEventListener("popstate", function () {
    closeMenu();
    const card = document.getElementById("infraShareDialog");
    if (card && card.open && typeof card.close === "function") card.close();
  });

  // Clavier : Maj+F10 ou touche Menu sur une ligne ; ↑ ↓ dans le menu ; Échap ferme
  document.addEventListener("keydown", function (e) {
    if (menu) {
      const items = Array.from(menu.box.querySelectorAll("[data-ta], [data-ta-back]"));
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); }
      else if (!items.length) return;
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
      const target = targetFrom(document.activeElement);
      if (target) { e.preventDefault(); openMenu(target, null, null, true); }
    }
  }, true);
  window.addEventListener("resize", closeMenu);
  injectStyle();
  window.setTimeout(loadPositions, 1500);

  // Hors ligne (audit du 19/11) : appuyer sur lecture échouait sans rien dire. Un seul message, discret.
  let offlineSaidAt = 0;
  document.addEventListener("error", function (e) {
    const el = e.target;
    if (!el || el.tagName !== "AUDIO" || navigator.onLine !== false) return;
    if (Date.now() - offlineSaidAt < 8000) return;
    offlineSaidAt = Date.now();
    say("Hors ligne : la musique reviendra avec la connexion");
  }, true);

  // ---------- Grand lecteur : « ⋯ » à côté du cœur ----------
  const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  let samplesJs = null;
  function samplesApi() {
    if (window.InfraSamples) return Promise.resolve(window.InfraSamples);
    if (samplesJs) return samplesJs;
    samplesJs = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = `${siteRoot()}assets/js/samples.js?v=${encodeURIComponent(window.INFRA_BUILD_TAG || "")}`;
      s.async = true;
      s.onload = function () { window.InfraSamples ? resolve(window.InfraSamples) : reject(new Error("samples")); };
      s.onerror = function () { samplesJs = null; reject(new Error("samples")); };
      document.head.appendChild(s);
    });
    return samplesJs;
  }
  // Crédits (V25 validée le 27/11/2026) : panneau chargé à la demande (credits.js).
  let creditsJs = null;
  function creditsApi() {
    if (window.InfraCredits) return Promise.resolve(window.InfraCredits);
    if (creditsJs) return creditsJs;
    creditsJs = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = `${siteRoot()}assets/js/credits.js?v=${encodeURIComponent(window.INFRA_BUILD_TAG || "")}`;
      s.async = true;
      s.onload = function () { window.InfraCredits ? resolve(window.InfraCredits) : reject(new Error("credits")); };
      s.onerror = function () { creditsJs = null; reject(new Error("credits")); };
      document.head.appendChild(s);
    });
    return creditsJs;
  }
  function openCredits(kind, a, b) {
    creditsApi()
      .then(function (api) { return kind === "album" ? api.openAlbum(a) : api.openTrack(a, b); })
      .then(function (ok) { if (!ok) say("Crédits indisponibles pour le moment"); })
      .catch(function () { say(navigator.onLine === false ? "Crédits indisponibles hors ligne" : "Crédits indisponibles pour le moment"); });
  }
  function samplesOf(t) {
    // Les samples de ce morceau (avec les voix), dans l'ordre où ils entrent ; [] si aucun ou hors ligne.
    const wait = new Promise(function (resolve) { window.setTimeout(function () { resolve(null); }, 2500); });
    const get = samplesApi().then(function (api) { return api.load(); }).catch(function () { return null; });
    return Promise.race([get, wait]).then(function (data) {
      // Le grand lecteur écrit titres et albums en majuscules : comparaison sans casse (81 morceaux manquaient).
      const album = data && (data.albums || []).find(function (a) { return sameText(a.title, t.album); });
      if (!album) return [];
      return album.items.filter(function (i) { return sameText(i.track, t.title); })
        .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    });
  }
  function sameText(x, y) {
    const n = function (v) { return String(v || "").normalize("NFC").trim().toLocaleUpperCase("fr"); };
    return n(x) === n(y);
  }
  function currentTrack() {
    const overlay = document.getElementById("infraNowPlayingOverlay");
    const fav = overlay && overlay.querySelector("[data-now-playing-favorite]");
    const favPath = (fav && fav.getAttribute("data-favorite-path")) || "";
    const match = favPath.match(TRACK_PATH);
    if (!match) return null;
    const title = overlay.querySelector("[data-now-playing-title]");
    const album = overlay.querySelector("[data-now-playing-album]");
    return { slug: match[1], n: positionOf(favPath, match), title: title ? title.textContent.trim() : "Morceau",
      album: album ? album.textContent.trim() : "" };
  }
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function goToSample(t) {
    const close = document.querySelector("#infraNowPlayingOverlay [data-now-playing-close]");
    if (close) close.click();
    samplesApi().then(function (api) { return api.openTrack(t.album, t.title); })
      .then(function (ok) { if (!ok) say("Aucun sample pour ce morceau"); })
      .catch(function () { say("Samples indisponibles hors ligne"); });
  }
  function openNowPlayingMenu(px, py) {
    const at = Number.isFinite(px) ? [px, py] : [null, null];
    const t = currentTrack();
    const button = document.querySelector("#infraNowPlayingOverlay [data-np-more]");
    if (!t || !button) return;
    samplesOf(t).then(function (list) {
      // Pendant le chargement (2,5 s au plus), le lecteur a pu se fermer ou changer de morceau : on n'ouvre rien.
      const now = currentTrack();
      if (!document.documentElement.classList.contains("now-playing-open") || !now || now.slug !== t.slug || now.n !== t.n) return;
      const album = albumBySlug(t.slug);
      const items = [];
      if (list.length) {
        items.push(["sample", list.length > 1 ? "Aller vers les samples" : "Aller vers le sample", function () { goToSample(t); }]);
      }
      items.push(["credits", "Crédits", function () { openCredits("track", t.slug, t.n); }]);
      if (album) items.push(["album", "Aller à l'album", function () {
        const close = document.querySelector("#infraNowPlayingOverlay [data-now-playing-close]");
        if (close) close.click();
        goTo(`${siteRoot()}${album.page}`);
      }]);
      items.push("-", ["dl", "Télécharger le morceau", function () { download(t); }]);
      if (album) items.push(["dl", "Télécharger l'album", function () { downloadAlbum(album.slug, album.title); }]);
      items.push("-", ["share", "Partager…", function () { share(t, button); }]);
      items.push(["link", "Copier le lien", function () { copyLink(trackUrl(t)); }]);
      showMenu(t, at[0] === null ? button : document.getElementById("infraNowPlayingOverlay"), at[0], at[1], false, items, true);
    });
  }
  function ensureNowPlayingMore() {
    const overlay = document.getElementById("infraNowPlayingOverlay");
    const meta = overlay && overlay.querySelector(".now-playing-meta");
    if (!meta || meta.querySelector("[data-np-more]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "np-more";
    button.setAttribute("data-np-more", "");
    button.setAttribute("aria-label", "Plus d'options");
    button.setAttribute("aria-haspopup", "menu");
    button.innerHTML = DOTS;
    button.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); loadPositions(); openNowPlayingMenu(); });
    meta.appendChild(button);
    meta.classList.add("has-more");
  }
  // Ordinateur : le cœur (et « ⋯ ») se placent juste avant « À suivre », quelle que soit sa largeur.
  // Audit 19/11 : à droite fixe (228 px), le cœur chevauchait « À suivre » dès 1680 px de large.
  function placeTopIcons() {
    const overlay = document.getElementById("infraNowPlayingOverlay");
    const heart = overlay && overlay.querySelector("[data-now-playing-favorite]");
    const more = overlay && overlay.querySelector("[data-np-more]");
    const toggle = overlay && overlay.querySelector("[data-now-playing-queue-toggle]");
    if (!heart) return;
    if (window.innerWidth < 981 || !toggle || !heart.offsetParent) {
      heart.style.removeProperty("right");
      if (more) more.style.removeProperty("right");
      return;
    }
    const host = heart.offsetParent.getBoundingClientRect();
    const right = Math.round(host.right - toggle.getBoundingClientRect().left + 8);
    if (right < 0 || right > host.width) return;
    heart.style.right = right + "px";
    if (more) more.style.right = right + 44 + "px";
  }
  window.addEventListener("resize", function () { window.requestAnimationFrame(placeTopIcons); });
  // Le grand lecteur est construit puis ouvert à la demande : on pose « ⋯ » à chaque ouverture.
  new MutationObserver(function () {
    if (!document.documentElement.classList.contains("now-playing-open")) return;
    ensureNowPlayingMore();
    placeTopIcons();
    window.setTimeout(placeTopIcons, 400);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  ensureNowPlayingMore();
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
