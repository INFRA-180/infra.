(function () {
  "use strict";

  if (window.__infraShareQrBound) return;
  window.__infraShareQrBound = true;

  const LONG_PRESS_MS = 600;
  const MOVE_TOLERANCE_PX = 12;
  const CLICK_SUPPRESSION_MS = 1200;
  const moduleScript = document.currentScript;
  const vendorUrl = new URL(
    "../vendor/qr-creator.min.js?v=1.0.0",
    moduleScript && moduleScript.src ? moduleScript.src : window.location.href
  ).href;

  let activeGesture = null;
  let suppressedClick = null;
  let qrLibraryPromise = null;
  let dialogParts = null;
  let dialogInvoker = null;
  let currentShareUrl = "";
  let openToken = 0;
  let toastTimer = 0;

  function cleanUrl(urlLike) {
    const url = new URL(String(urlLike || ""), window.location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function albumTitle(card) {
    const label = card && card.querySelector("span");
    return label && label.textContent ? label.textContent.trim() : "Album INFRA.";
  }

  function resolveShareIntent(node, allowWholeCard) {
    if (!(node instanceof Element)) return null;

    const logo = node.closest("body.home-screen .hero-title-link");
    if (logo) {
      return {
        element: logo,
        title: "INFRA.",
        url: cleanUrl(logo.href || "./")
      };
    }

    const card = node.closest("body.home-screen .album-card");
    const cardCover = node.closest("body.home-screen .album-card .album-cover");
    if (card && (allowWholeCard || cardCover)) {
      return {
        element: card,
        title: albumTitle(card),
        url: cleanUrl(card.href)
      };
    }

    const cover = node.closest("body.album-screen .album-layout .cover");
    if (cover) {
      const heading = document.querySelector("body.album-screen main h1");
      return {
        element: cover,
        title: heading && heading.textContent ? heading.textContent.trim() : "Album INFRA.",
        url: cleanUrl(window.location.href)
      };
    }

    return null;
  }

  function getPersistRoot() {
    let root = document.getElementById("infraSpaPersist");
    if (root) return root;

    root = document.createElement("div");
    root.id = "infraSpaPersist";
    document.body.insertBefore(root, document.body.firstChild);
    return root;
  }

  function closeDialog() {
    if (!dialogParts) return;
    const dialog = dialogParts.dialog;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
    dialog.classList.remove("is-fallback-open");
    restoreDialogFocus();
  }

  function restoreDialogFocus() {
    const target = dialogInvoker;
    dialogInvoker = null;
    if (target && target.isConnected && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function showToast(message, state) {
    if (!dialogParts) return;
    window.clearTimeout(toastTimer);
    dialogParts.toast.textContent = message;
    dialogParts.toast.dataset.state = state || "info";
    dialogParts.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      if (!dialogParts) return;
      dialogParts.toast.classList.remove("is-visible");
      dialogParts.toast.textContent = "";
      delete dialogParts.toast.dataset.state;
    }, 2200);
  }

  function ensureDialog() {
    if (dialogParts && dialogParts.dialog.isConnected) return dialogParts;

    const dialog = document.createElement("dialog");
    dialog.id = "infraShareDialog";
    dialog.className = "share-dialog";
    dialog.setAttribute("aria-labelledby", "infraShareTitle");
    dialog.innerHTML = [
      '<div class="share-dialog-panel">',
      '  <header class="share-dialog-head">',
      '    <h2 id="infraShareTitle"></h2>',
      '    <button class="share-dialog-close" type="button" aria-label="Fermer">&times;</button>',
      "  </header>",
      '  <div class="share-qr" data-share-qr aria-live="off"></div>',
      '  <input class="share-link" type="url" readonly spellcheck="false" aria-label="Lien de partage" />',
      '  <button class="share-copy" type="button">Copier le lien</button>',
      '  <div class="share-toast" role="status" aria-live="polite" aria-atomic="true"></div>',
      "</div>"
    ].join("");

    const closeButton = dialog.querySelector(".share-dialog-close");
    const copyButton = dialog.querySelector(".share-copy");
    const title = dialog.querySelector("#infraShareTitle");
    const qr = dialog.querySelector("[data-share-qr]");
    const link = dialog.querySelector(".share-link");
    const toast = dialog.querySelector(".share-toast");

    closeButton.addEventListener("click", closeDialog);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", restoreDialogFocus);
    dialog.addEventListener("cancel", function () {
      window.clearTimeout(toastTimer);
    });
    copyButton.addEventListener("click", async function () {
      const copied = await copyText(currentShareUrl, dialog);
      showToast(copied ? "Lien copié" : "Copie impossible", copied ? "success" : "error");
    });

    getPersistRoot().appendChild(dialog);
    dialogParts = { dialog, closeButton, copyButton, title, qr, link, toast };
    return dialogParts;
  }

  function loadQrLibrary() {
    if (window.QrCreator && typeof window.QrCreator.render === "function") {
      return Promise.resolve(window.QrCreator);
    }
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = vendorUrl;
      script.async = true;
      script.dataset.infraQrVendor = "true";
      script.addEventListener("load", function () {
        if (window.QrCreator && typeof window.QrCreator.render === "function") {
          resolve(window.QrCreator);
          return;
        }
        reject(new Error("qr_creator_unavailable"));
      }, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("qr_creator_load_failed"));
      }, { once: true });
      document.head.appendChild(script);
    });

    return qrLibraryPromise;
  }

  async function renderQr(url, token) {
    const parts = ensureDialog();
    parts.qr.replaceChildren();
    parts.qr.classList.add("is-loading");
    parts.qr.setAttribute("aria-busy", "true");

    try {
      const QrCreator = await loadQrLibrary();
      if (token !== openToken || currentShareUrl !== url) return;
      parts.qr.replaceChildren();
      QrCreator.render({
        text: url,
        radius: 0,
        ecLevel: "M",
        fill: "#000000",
        background: "#ffffff",
        size: 256
      }, parts.qr);
      const canvas = parts.qr.querySelector("canvas");
      if (canvas) {
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "QR code du lien");
      }
      parts.qr.classList.remove("is-loading");
      parts.qr.removeAttribute("aria-busy");
    } catch (_error) {
      if (token !== openToken) return;
      qrLibraryPromise = null;
      parts.qr.classList.remove("is-loading");
      parts.qr.classList.add("is-error");
      parts.qr.removeAttribute("aria-busy");
      parts.qr.textContent = "QR indisponible";
    }
  }

  function legacyCopy(text, scope) {
    const textarea = document.createElement("textarea");
    const previousFocus = document.activeElement;
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.className = "share-copy-source";
    (scope || document.body).appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = Boolean(document.execCommand("copy"));
    } catch (_error) {
      copied = false;
    }
    textarea.remove();
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
    return copied;
  }

  async function copyText(text, scope) {
    if (!text) return false;
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_error) {
        // The explicit button still gets a legacy selection-based fallback on Safari.
      }
    }
    return legacyCopy(text, scope);
  }

  async function openShare(intent, invoker) {
    const parts = ensureDialog();
    const token = ++openToken;
    currentShareUrl = intent.url;
    dialogInvoker = invoker || intent.element || document.activeElement;
    parts.title.textContent = intent.title;
    parts.link.value = intent.url;
    parts.qr.classList.remove("is-error");
    window.clearTimeout(toastTimer);
    parts.toast.classList.remove("is-visible");
    parts.toast.textContent = "";

    if (typeof parts.dialog.showModal === "function") {
      if (!parts.dialog.open) parts.dialog.showModal();
    } else {
      parts.dialog.setAttribute("open", "");
      parts.dialog.classList.add("is-fallback-open");
    }
    parts.closeButton.focus({ preventScroll: true });

    renderQr(intent.url, token);
    const copied = await copyText(intent.url, parts.dialog);
    if (token === openToken) {
      showToast(copied ? "Lien copié" : "Lien prêt à copier", copied ? "success" : "info");
    }
  }

  function clearGesture() {
    if (!activeGesture) return;
    window.clearTimeout(activeGesture.timer);
    activeGesture = null;
  }

  function beginLongPress(event) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const intent = resolveShareIntent(event.target, false);
    if (!intent) return;

    clearGesture();
    activeGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      intent,
      activated: false,
      timer: 0
    };
    const gesture = activeGesture;
    gesture.timer = window.setTimeout(function () {
      if (activeGesture !== gesture) return;
      gesture.activated = true;
      suppressedClick = {
        element: intent.element,
        until: Date.now() + CLICK_SUPPRESSION_MS
      };
      openShare(intent, intent.element);
    }, LONG_PRESS_MS);
  }

  function moveLongPress(event) {
    if (!activeGesture || event.pointerId !== activeGesture.pointerId || activeGesture.activated) return;
    const dx = event.clientX - activeGesture.startX;
    const dy = event.clientY - activeGesture.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) clearGesture();
  }

  function endLongPress(event) {
    if (!activeGesture || event.pointerId !== activeGesture.pointerId) return;
    const activated = activeGesture.activated;
    clearGesture();
    if (activated) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function suppressActivatedClick(event) {
    if (!suppressedClick) return;
    if (Date.now() > suppressedClick.until) {
      suppressedClick = null;
      return;
    }
    const target = event.target;
    if (
      target instanceof Node &&
      (target === suppressedClick.element || suppressedClick.element.contains(target))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressedClick = null;
    }
  }

  document.addEventListener("pointerdown", beginLongPress, { capture: true, passive: true });
  document.addEventListener("pointermove", moveLongPress, { capture: true, passive: true });
  document.addEventListener("pointerup", endLongPress, { capture: true, passive: false });
  document.addEventListener("pointercancel", endLongPress, { capture: true, passive: false });
  document.addEventListener("click", suppressActivatedClick, true);
  document.addEventListener("contextmenu", function (event) {
    if (resolveShareIntent(event.target, false)) event.preventDefault();
  }, true);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || !event.shiftKey) return;
    const intent = resolveShareIntent(event.target, true);
    if (!intent) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openShare(intent, intent.element);
  }, true);
  window.addEventListener("scroll", function () {
    if (activeGesture && !activeGesture.activated) clearGesture();
  }, { capture: true, passive: true });
  window.addEventListener("blur", clearGesture);
})();
