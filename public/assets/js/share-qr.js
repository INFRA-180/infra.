(function () {
  "use strict";

  if (window.__infraShareQrBound) return;
  window.__infraShareQrBound = true;

  const LONG_PRESS_MS = 600;
  const MOVE_TOLERANCE_PX = 12;
  const CLICK_SUPPRESSION_MS = 1200;
  const CLOSE_CLICK_SUPPRESSION_MS = 650;
  const SHARE_BRAND_RED = "#e52c31";
  const QR_FILL = "#000000";
  const moduleScript = document.currentScript;
  const vendorUrl = new URL(
    "../vendor/qr-creator.min.js?v=1.0.0",
    moduleScript && moduleScript.src ? moduleScript.src : window.location.href
  ).href;
  const brandLogoUrl = new URL(
    "../branding/infra-logo-white-photoroom-title.png",
    moduleScript && moduleScript.src ? moduleScript.src : window.location.href
  ).href;

  let activeGesture = null;
  let suppressedClick = null;
  let qrLibraryPromise = null;
  let dialogParts = null;
  let dialogInvoker = null;
  let currentShareUrl = "";
  let openToken = 0;
  let copyStateTimer = 0;
  let closeClickSuppressionUntil = 0;
  let backdropPointer = null;
  let shareSelectionElement = null;

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
    dialog.classList.remove("is-fallback-open");
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
    handleDialogClosed();
  }

  function closeFromPointer(event) {
    closeClickSuppressionUntil = Date.now() + CLOSE_CLICK_SUPPRESSION_MS;
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (event && typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    } else if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    closeDialog();
  }

  function clearShareSelection() {
    if (shareSelectionElement && shareSelectionElement.isConnected) {
      shareSelectionElement.classList.remove("is-share-pressing", "is-share-selected");
    }
    shareSelectionElement = null;
  }

  function markSharePress(element) {
    if (shareSelectionElement && shareSelectionElement !== element && shareSelectionElement.isConnected) {
      shareSelectionElement.classList.remove("is-share-pressing", "is-share-selected");
    }
    shareSelectionElement = element || null;
    if (shareSelectionElement && shareSelectionElement.isConnected) {
      shareSelectionElement.classList.add("is-share-pressing");
      shareSelectionElement.classList.remove("is-share-selected");
    }
  }

  function markShareSelected(element) {
    if (shareSelectionElement && shareSelectionElement !== element && shareSelectionElement.isConnected) {
      shareSelectionElement.classList.remove("is-share-pressing", "is-share-selected");
    }
    shareSelectionElement = element || null;
    if (shareSelectionElement && shareSelectionElement.isConnected) {
      shareSelectionElement.classList.remove("is-share-pressing");
      shareSelectionElement.classList.add("is-share-selected");
    }
  }

  function restoreDialogFocus() {
    const target = dialogInvoker;
    dialogInvoker = null;
    if (target && target.isConnected && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function resetCopyFeedback() {
    if (!dialogParts) return;
    window.clearTimeout(copyStateTimer);
    dialogParts.copyToast.textContent = "";
    dialogParts.copyToast.classList.remove("is-visible");
    delete dialogParts.copyToast.dataset.state;
    delete dialogParts.copyButton.dataset.state;
  }

  function showCopyFeedback(message, state) {
    if (!dialogParts) return;
    window.clearTimeout(copyStateTimer);
    dialogParts.copyToast.textContent = message;
    dialogParts.copyToast.dataset.state = state || "info";
    dialogParts.copyToast.classList.add("is-visible");
    dialogParts.copyButton.dataset.state = state || "info";
    copyStateTimer = window.setTimeout(resetCopyFeedback, 1600);
  }

  function handleDialogClosed() {
    window.clearTimeout(copyStateTimer);
    backdropPointer = null;
    clearShareSelection();
    resetCopyFeedback();
    restoreDialogFocus();
  }

  function ensureDialog() {
    if (dialogParts && dialogParts.dialog.isConnected) return dialogParts;

    const dialog = document.createElement("dialog");
    dialog.id = "infraShareDialog";
    dialog.className = "share-dialog";
    dialog.style.setProperty("--share-brand-red", SHARE_BRAND_RED);
    dialog.setAttribute("closedby", "any");
    dialog.setAttribute("aria-labelledby", "infraShareTitle");
    dialog.innerHTML = [
      '<div class="share-dialog-panel" data-share-dialog-panel>',
      '  <header class="share-dialog-head">',
      '    <button class="share-icon-button share-dialog-close" type="button" aria-label="Fermer" autofocus>',
      '      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.75 5.75 18.25 18.25M18.25 5.75 5.75 18.25"/></svg>',
      "    </button>",
      '    <h2 id="infraShareTitle"></h2>',
      '    <button class="share-icon-button share-copy" type="button" aria-label="Copier le lien">',
      '      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.25" y="8.25" width="11" height="11" rx="2"/><rect x="4.75" y="4.75" width="11" height="11" rx="2"/></svg>',
      "    </button>",
      '    <div class="share-copy-toast" data-share-copy-toast role="status" aria-live="polite" aria-atomic="true"></div>',
      "  </header>",
      '  <div class="share-qr" data-share-qr aria-live="off"></div>',
      '  <img class="share-brand-logo" data-share-brand-logo alt="" aria-hidden="true" decoding="async" />',
      "</div>"
    ].join("");

    const closeButton = dialog.querySelector(".share-dialog-close");
    const copyButton = dialog.querySelector(".share-copy");
    const copyToast = dialog.querySelector("[data-share-copy-toast]");
    const panel = dialog.querySelector("[data-share-dialog-panel]");
    const title = dialog.querySelector("#infraShareTitle");
    const qr = dialog.querySelector("[data-share-qr]");
    const brandLogo = dialog.querySelector("[data-share-brand-logo]");
    brandLogo.src = brandLogoUrl;

    closeButton.addEventListener("click", closeFromPointer);
    closeButton.addEventListener("pointerup", closeFromPointer);
    dialog.addEventListener("pointerdown", function (event) {
      if (event.target !== dialog) return;
      backdropPointer = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      };
    }, { passive: true });
    dialog.addEventListener("pointerup", function (event) {
      if (!backdropPointer || event.pointerId !== backdropPointer.pointerId || event.target !== dialog) return;
      const dx = event.clientX - backdropPointer.startX;
      const dy = event.clientY - backdropPointer.startY;
      backdropPointer = null;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) return;
      closeFromPointer(event);
    });
    dialog.addEventListener("pointercancel", function () {
      backdropPointer = null;
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || (panel && !panel.contains(event.target))) closeFromPointer(event);
    });
    dialog.addEventListener("close", handleDialogClosed);
    dialog.addEventListener("cancel", function () {
      backdropPointer = null;
      window.clearTimeout(copyStateTimer);
    });
    copyButton.addEventListener("click", async function () {
      const copyToken = openToken;
      const copyUrl = currentShareUrl;
      const copied = await copyText(copyUrl, dialog);
      if (
        copyToken !== openToken ||
        copyUrl !== currentShareUrl ||
        !(dialog.open || dialog.classList.contains("is-fallback-open"))
      ) {
        return;
      }
      showCopyFeedback(copied ? "Lien copié" : "Copie impossible", copied ? "success" : "error");
    });

    getPersistRoot().appendChild(dialog);
    dialogParts = { dialog, closeButton, copyButton, copyToast, title, qr, brandLogo };
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
        radius: 0.5,
        ecLevel: "H",
        fill: QR_FILL,
        background: SHARE_BRAND_RED,
        quiet: 4,
        size: 280
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
    markShareSelected(intent.element);
    parts.title.textContent = intent.title;
    parts.qr.classList.remove("is-error");
    resetCopyFeedback();

    if (typeof parts.dialog.showModal === "function") {
      if (!parts.dialog.open) parts.dialog.showModal();
    } else {
      parts.dialog.setAttribute("open", "");
      parts.dialog.classList.add("is-fallback-open");
    }
    parts.closeButton.focus({ preventScroll: true });

    renderQr(intent.url, token);
  }

  function clearGesture() {
    if (!activeGesture) return;
    if (!activeGesture.activated && activeGesture.intent && activeGesture.intent.element) {
      activeGesture.intent.element.classList.remove("is-share-pressing");
      if (shareSelectionElement === activeGesture.intent.element) shareSelectionElement = null;
    }
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
    markSharePress(intent.element);
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
    if (Date.now() < closeClickSuppressionUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
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
