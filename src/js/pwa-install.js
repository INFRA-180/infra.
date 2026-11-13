(function () {
  "use strict";

  function call(ctx, name) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;
    return ctx[name].apply(ctx, Array.prototype.slice.call(arguments, 2));
  }

  function createPwaInstall(context) {
    const ctx = context || {};
    const pwaState = ctx.pwaState || {
      choiceStorageKey: "infra_pwa_install_choice_v1",
      sessionDismissed: false
    };

    function isIosDevice() {
      return Boolean(call(ctx, "isIosDevice"));
    }

    function isAndroidDevice() {
      return Boolean(call(ctx, "isAndroidDevice"));
    }

    function isStandaloneDisplayMode() {
      return Boolean(call(ctx, "isStandaloneDisplayMode"));
    }

    function getIosBrowserKind() {
      if (!isIosDevice()) return "other";
      const ua = String(navigator.userAgent || "");
      const vendor = String(navigator.vendor || "");
      if (/Brave|BraveiOS/i.test(ua)) return "brave";
      if (/CriOS/i.test(ua)) return "chrome";
      const blocked = /FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(ua);
      if (/Safari/i.test(ua) && /Apple/i.test(vendor) && !blocked) return "safari";
      return "other";
    }

    function getAndroidBrowserKind() {
      if (!isAndroidDevice()) return "other";
      const ua = String(navigator.userAgent || "");
      if (/Brave/i.test(ua)) return "brave";
      if (/SamsungBrowser/i.test(ua)) return "samsung";
      if (/MiuiBrowser|MiBrowser|Xiaomi|Redmi|Poco/i.test(ua)) return "xiaomi";
      if (/Firefox/i.test(ua)) return "firefox";
      if (/EdgA/i.test(ua)) return "edge";
      if (/OPR|Opera/i.test(ua)) return "opera";
      if (/Chrome/i.test(ua)) return "chrome";
      return "other";
    }

    function getInstallBrowserKind() {
      const iosKind = getIosBrowserKind();
      if (iosKind !== "other") return `ios-${iosKind}`;
      const androidKind = getAndroidBrowserKind();
      if (androidKind !== "other") return `android-${androidKind}`;
      if (isAndroidDevice()) return "android-other";
      if (isMacSafari()) return "mac-safari";
      return "other";
    }

    // Safari sur Mac (pas l'iPad, qui se dit aussi « Macintosh » mais a un écran tactile) :
    // Fichier › Ajouter au Dock.
    function isMacSafari() {
      const ua = String(navigator.userAgent || "");
      const vendor = String(navigator.vendor || "");
      if (!/Macintosh/i.test(ua) || Number(navigator.maxTouchPoints || 0) > 1) return false;
      return /Safari/i.test(ua) && /Apple/i.test(vendor) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
    }

    function isSafariOnIos() {
      return getIosBrowserKind() === "safari";
    }

    function getPwaGuideContent(browserKind) {
      if (browserKind === "ios-safari") {
        return {
          text: "Safari iPhone: installation PWA fiable ici. Ouvre Partager puis Sur l'ecran d'accueil.",
          steps: [
            "Appuie sur Partager (carre + fleche).",
            "Choisis Sur l'ecran d'accueil.",
            "Valide avec Ajouter."
          ]
        };
      }

      if (browserKind === "ios-chrome") {
        return {
          text: "Sur iPhone, installation PWA fiable uniquement via Safari.",
          steps: [
            "Appuie sur le menu Chrome.",
            "Choisis Ouvrir dans Safari (ou copie ce lien dans Safari).",
            "Dans Safari: Partager -> Sur l'ecran d'accueil -> Ajouter."
          ]
        };
      }

      if (browserKind === "ios-brave") {
        return {
          text: "Sur iPhone, installation PWA fiable uniquement via Safari.",
          steps: [
            "Appuie sur le menu Brave.",
            "Choisis Ouvrir dans Safari (ou copie ce lien dans Safari).",
            "Dans Safari: Partager -> Sur l'ecran d'accueil -> Ajouter."
          ]
        };
      }

      if (browserKind === "android-chrome") {
        return {
          text: "Android (Chrome): installe via le menu Chrome.",
          steps: [
            "Appuie sur le menu Chrome (3 points).",
            "Choisis Installer l'application ou Ajouter a l'ecran d'accueil.",
            "Valide avec Installer/Ajouter."
          ]
        };
      }

      if (browserKind === "android-brave") {
        return {
          text: "Android (Brave): installation possible directement depuis Brave.",
          steps: [
            "Appuie sur le menu Brave.",
            "Choisis Installer l'app ou Ajouter a l'ecran d'accueil.",
            "Valide l'installation."
          ]
        };
      }

      if (browserKind === "android-samsung") {
        return {
          text: "Android (Samsung Internet): installation possible depuis le menu.",
          steps: [
            "Appuie sur le menu Samsung Internet.",
            "Choisis Ajouter la page a puis Ecran d'accueil (ou Installer l'app).",
            "Confirme Ajouter."
          ]
        };
      }

      if (browserKind === "android-xiaomi") {
        return {
          text: "Android Xiaomi/Redmi/Poco: installation possible via le menu du navigateur.",
          steps: [
            "Appuie sur le menu du navigateur (Chrome ou Mi Browser).",
            "Choisis Ajouter a l'ecran d'accueil ou Installer l'app.",
            "Si l'option n'apparait pas, ouvre le site dans Chrome puis installe."
          ]
        };
      }

      if (
        browserKind === "android-firefox" ||
        browserKind === "android-edge" ||
        browserKind === "android-opera" ||
        browserKind === "android-other"
      ) {
        return {
          text: "Android: installation possible via le menu du navigateur.",
          steps: [
            "Ouvre le menu du navigateur.",
            "Choisis Ajouter a l'ecran d'accueil ou Installer l'app.",
            "Si indisponible, ouvre ce site dans Chrome et installe depuis Chrome."
          ]
        };
      }

      return {
        text: "Sur mobile, installe INFRA depuis iPhone (Safari) ou Android (menu navigateur).",
        steps: [
          "iPhone: utilise Safari.",
          "Android: utilise le menu du navigateur.",
          "Ajoute l'app a l'ecran d'accueil."
        ]
      };
    }

    function fillPwaGuide(guideText, guideSteps, browserKind) {
      const content = getPwaGuideContent(browserKind);
      if (guideText) {
        guideText.textContent = content.text;
      }
      if (guideSteps) {
        guideSteps.replaceChildren();
        content.steps.forEach(function (stepText) {
          const li = document.createElement("li");
          li.textContent = stepText;
          guideSteps.appendChild(li);
        });
        guideSteps.hidden = false;
      }
    }

    function readPwaChoice() {
      try {
        return String(localStorage.getItem(pwaState.choiceStorageKey) || "")
          .trim()
          .toLowerCase();
      } catch (_err) {
        return "";
      }
    }

    function persistPwaChoice(choice) {
      try {
        localStorage.setItem(
          pwaState.choiceStorageKey,
          String(choice || "")
            .trim()
            .toLowerCase()
        );
      } catch (_err) {
        // Ignore storage errors.
      }
    }

    // Fenêtre d'installation (INFRA, 08/11/2026) : montrée une seule fois, jamais quand le site est
    // déjà installé, sans cadre ; une ligne et les étapes en pictogrammes, une croix pour fermer.
    const ICON_SHARE =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m-4 4 4-4 4 4M8 11H5v10h14V11h-3"/></svg>';
    const ICON_ADD =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
    const ICON_MENU =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5.5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.5" r="1.7"/></g></svg>';
    const ICON_FILE =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18"/></svg>';
    const ICON_DOCK =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="14" width="17" height="6" rx="2"/><rect x="9" y="6" width="6" height="6" rx="1.6"/></svg>';
    const ICON_CLOSE =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

    function getInstallSteps(browserKind) {
      if (browserKind === "ios-safari") {
        return [
          [ICON_SHARE, "Partager"],
          [ICON_ADD, "Sur l’écran d’accueil"]
        ];
      }
      if (browserKind === "ios-chrome" || browserKind === "ios-brave") {
        return [
          [ICON_SHARE, "Partager"],
          [ICON_ADD, "Ajouter à l’écran d’accueil"]
        ];
      }
      if (browserKind === "mac-safari") {
        return [
          [ICON_FILE, "Fichier"],
          [ICON_DOCK, "Ajouter au Dock"]
        ];
      }
      if (String(browserKind).indexOf("android-") === 0) {
        return [
          [ICON_MENU, "Menu"],
          [ICON_ADD, "Installer l’application"]
        ];
      }
      return [
        [ICON_SHARE, "Partager"],
        [ICON_ADD, "Sur l’écran d’accueil"]
      ];
    }

    function ensurePwaInstallPromptUi() {
      let root = document.getElementById("infraPwaInstallModal");
      if (root) return root;

      root = document.createElement("div");
      root.id = "infraPwaInstallModal";
      root.className = "bib-install";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-label", "Ajouter INFRA. à l’écran d’accueil");
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = [
        '<div class="bib-install-in">',
        '  <div class="bib-install-tx">',
        "    <strong>Ajouter INFRA. à l’écran d’accueil</strong>",
        '    <span class="bib-install-steps" data-pwa-steps></span>',
        "  </div>",
        '  <button class="bib-install-close" type="button" data-pwa-browser aria-label="Fermer" title="Fermer">' +
          ICON_CLOSE +
          "</button>",
        "</div>"
      ].join("");

      document.body.appendChild(root);

      const closeBtn = root.querySelector("[data-pwa-browser]");
      if (closeBtn) {
        closeBtn.addEventListener("click", hideBanner);
      }
      return root;
    }

    // Installation discrète (INFRA, 13/11/2026) : pas de bandeau automatique, pas d'entrée dans la carte
    // de partage. Un petit pictogramme en haut à droite de l'accueil pendant les deux premières visites,
    // retiré dès la troisième ; jamais une fois installé. Un geste : fenêtre d'installation du navigateur
    // quand il en a une, sinon le petit bandeau avec les étapes en pictogrammes (seulement à la demande).
    const INSTALL_STATE_KEY = "infra_pwa_install_v2";
    const VISIT_SESSION_KEY = "infra_pwa_visit_v2";
    const ICON_VISITS = 2;
    const ICON_INSTALL =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11m-4.2-4.2L12 14.5l4.2-4.2"/><path d="M5 15.5v2.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-2.2"/></svg>';
    let deferredPrompt = null;
    let lastAdminMode = false;

    function readInstallState() {
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem(INSTALL_STATE_KEY) || "{}") || {};
      } catch (_err) {
        state = {};
      }
      return { visits: Number(state.visits) || 0, installed: Boolean(state.installed) };
    }

    function writeInstallState(state) {
      try {
        localStorage.setItem(INSTALL_STATE_KEY, JSON.stringify(state));
      } catch (_err) {
        // Ignore storage errors.
      }
    }

    // Une visite = une session du navigateur.
    (function countVisit() {
      try {
        if (sessionStorage.getItem(VISIT_SESSION_KEY)) return;
        sessionStorage.setItem(VISIT_SESSION_KEY, "1");
      } catch (_err) {
        return;
      }
      const state = readInstallState();
      state.visits += 1;
      writeInstallState(state);
    })();

    function isInstalled() {
      return isStandaloneDisplayMode() || readInstallState().installed;
    }

    function markInstalled() {
      const state = readInstallState();
      state.installed = true;
      writeInstallState(state);
      hideBanner();
      initPwaInstallPrompt(lastAdminMode);
    }

    window.addEventListener("beforeinstallprompt", function (event) {
      // Le site propose lui-même l'installation (pictogramme discret).
      event.preventDefault();
      deferredPrompt = event;
      initPwaInstallPrompt(lastAdminMode);
    });
    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      markInstalled();
    });

    function promptNative() {
      const prompt = deferredPrompt;
      if (!prompt) return Promise.resolve(false);
      deferredPrompt = null;
      return Promise.resolve(prompt.prompt())
        .then(function () {
          return prompt.userChoice;
        })
        .then(function (choice) {
          const accepted = Boolean(choice && choice.outcome === "accepted");
          if (accepted) markInstalled();
          return accepted;
        })
        .catch(function () {
          return false;
        });
    }

    function stepsHtml(browserKind) {
      return getInstallSteps(browserKind)
        .map(function (step) {
          return '<span class="bib-install-step">' + step[0] + "<span>" + step[1] + "</span></span>";
        })
        .join('<span class="bib-install-sep" aria-hidden="true">›</span>');
    }

    function hideBanner() {
      const root = document.getElementById("infraPwaInstallModal");
      if (!root) return;
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
    }

    function openStepsBanner() {
      const root = ensurePwaInstallPromptUi();
      if (root.classList.contains("is-open")) {
        hideBanner();
        return;
      }
      const steps = root.querySelector("[data-pwa-steps]");
      if (steps) steps.innerHTML = stepsHtml(getInstallBrowserKind());
      root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
    }

    function ensureInstallIcon(hero) {
      let button = hero.querySelector("[data-pwa-icon]");
      if (button) return button;
      button = document.createElement("button");
      button.type = "button";
      button.className = "bib-install-icon";
      button.dataset.pwaIcon = "";
      button.setAttribute("aria-label", "Installer INFRA.");
      button.title = "Installer INFRA.";
      button.innerHTML = ICON_INSTALL;
      button.addEventListener("click", function () {
        if (deferredPrompt) {
          promptNative();
          return;
        }
        openStepsBanner();
      });
      hero.appendChild(button);
      return button;
    }

    function initPwaInstallPrompt(adminMode) {
      lastAdminMode = Boolean(adminMode);
      const kind = getInstallBrowserKind();
      const hero = document.querySelector("body.home-screen header.hero");
      const show =
        !adminMode &&
        Boolean(hero) &&
        !isInstalled() &&
        readInstallState().visits <= ICON_VISITS &&
        (Boolean(deferredPrompt) || kind !== "other");

      document.querySelectorAll("[data-pwa-icon]").forEach(function (icon) {
        if (!show || icon.parentElement !== hero) icon.hidden = true;
      });
      if (!show) {
        hideBanner();
        return;
      }
      ensureInstallIcon(hero).hidden = false;
    }

    return {
      getIosBrowserKind,
      getAndroidBrowserKind,
      getInstallBrowserKind,
      isSafariOnIos,
      getPwaGuideContent,
      fillPwaGuide,
      getInstallSteps,
      readPwaChoice,
      persistPwaChoice,
      ensurePwaInstallPromptUi,
      initPwaInstallPrompt
    };
  }

  window.InfraPwaInstall = {
    createPwaInstall
  };
})();
