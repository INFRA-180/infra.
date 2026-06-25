(function () {
  "use strict";

  function normalizeDownloadUrl(rawUrl) {
    const cleaned = String(rawUrl || "").replace(/&amp;/g, "&").trim();
    if (!cleaned) return "";
  
    let parsed = null;
    try {
      parsed = new URL(cleaned, window.location.href);
    } catch (_err) {
      return cleaned;
    }
  
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname || "";
    let driveId = "";
  
    if (host === "drive.google.com" || host === "docs.google.com") {
      driveId = parsed.searchParams.get("id") || "";
      if (!driveId) {
        const fileMatch = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        driveId = fileMatch ? fileMatch[1] : "";
      }
    } else if (host === "drive.usercontent.google.com") {
      driveId = parsed.searchParams.get("id") || "";
    }
  
    if (driveId) {
      return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`;
    }
  
    return parsed.href;
  }
  
  function downloadNow(url) {
    const directUrl = normalizeDownloadUrl(url);
    if (!directUrl) return;
  
    const link = document.createElement("a");
    link.href = directUrl;
    link.rel = "noopener";
    link.target = "_self";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!target || !(target instanceof Element)) return;
    const downloadButton = target.closest("[data-download-url]");
    if (!downloadButton) return;
    const url = downloadButton.getAttribute("data-download-url") || "";
    if (!url) return;
    event.preventDefault();
    downloadNow(url);
  });
  
  function ensureGatekeeperModal() {
    let modal = document.getElementById("gatekeeperModal");
    if (modal) return modal;
  
    modal = document.createElement("div");
    modal.id = "gatekeeperModal";
    modal.className = "gatekeeper-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = [
      "<div class=\"gatekeeper-panel\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Memo Gatekeeper\">",
      "  <h3>Memo Gatekeeper macOS (Intel + Apple Silicon)</h3>",
      "  <p class=\"tiny-note\">Cette application n'est pas signee. Si macOS bloque l'ouverture, suis ces etapes.</p>",
      "  <ol class=\"gate-list\">",
      "    <li>Apres telechargement: clic droit sur l'app, puis <strong>Ouvrir</strong>.</li>",
      "    <li>Sur macOS Sequoia (15+) / Sonoma / Ventura: <strong>Reglages Systeme</strong> > <strong>Confidentialite et securite</strong> > <strong>Ouvrir quand meme</strong>.</li>",
      "    <li>Si toujours bloque, execute ces commandes Terminal:</li>",
      "  </ol>",
      "  <pre class=\"gate-code\" data-gate-code></pre>",
      "  <p class=\"tiny-note\">Meme procedure pour Mac Intel et Apple Silicon. Ajuste le chemin si besoin. Utilise ces commandes seulement pour tes apps de confiance.</p>",
      "  <div class=\"gate-actions\">",
      "    <button class=\"mini-btn\" type=\"button\" data-gate-close>Annuler</button>",
      "    <button class=\"mini-btn mini-btn-dark\" type=\"button\" data-gate-download>Telecharger</button>",
      "  </div>",
      "</div>"
    ].join("");
  
    document.body.appendChild(modal);
  
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
    });
  
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
    });
  
    return modal;
  }
  
  function openAppDownloadGatekeeper(appName, url) {
    const modal = ensureGatekeeperModal();
    const code = modal.querySelector("[data-gate-code]");
    const closeBtn = modal.querySelector("[data-gate-close]");
    const downloadBtn = modal.querySelector("[data-gate-download]");
    const safeName = appName || "APP";
    const appBundle = `${safeName}.app`;
    const appPath = `/Applications/${appBundle}`;
    const instructions = [
      `xattr -dr com.apple.quarantine \"${appPath}\"`,
      `spctl --add --label \"INFRA\" \"${appPath}\"`
    ].join("\n");
  
    if (code) code.textContent = instructions;
  
    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
  
    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }
  
    if (downloadBtn) {
      downloadBtn.onclick = function () {
        closeModal();
        downloadNow(url);
      };
    }
  
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }
  

  function enhanceAlbumDownloadButtons(options) {
    const opts = options || {};
    const icon = String(opts.icon || "");
    const ensureAlbumHeaderActions = typeof opts.ensureAlbumHeaderActions === "function"
      ? opts.ensureAlbumHeaderActions
      : function () { return null; };
    if (!document.body.classList.contains("album-screen")) return;
    document.querySelectorAll(".btn-right[data-download-url]").forEach(function (button) {
      if (button.dataset.downloadEnhanced === "1") return;
      button.dataset.downloadEnhanced = "1";
      button.classList.add("album-download-icon");
      button.setAttribute("aria-label", "Telecharger l'album");
      button.setAttribute("title", "Telecharger l'album");
      button.innerHTML = icon;
      const albumRight = button.closest(".album-right");
      const tracks = albumRight && albumRight.querySelector(".tracks");
      const actions = tracks && ensureAlbumHeaderActions(tracks);
      if (actions) {
        const toolbar = actions.querySelector("[data-album-favorite-toolbar]");
        if (button.parentNode !== actions) {
          actions.insertBefore(button, toolbar || null);
        }
      } else if (tracks && button.previousElementSibling !== tracks) {
        tracks.insertAdjacentElement("afterend", button);
      }
    });
  }

  window.InfraDownloads = {
    normalizeDownloadUrl,
    downloadNow,
    openAppDownloadGatekeeper,
    enhanceAlbumDownloadButtons
  };
  window.normalizeDownloadUrl = normalizeDownloadUrl;
  window.downloadNow = downloadNow;
  window.openAppDownloadGatekeeper = openAppDownloadGatekeeper;
})();
