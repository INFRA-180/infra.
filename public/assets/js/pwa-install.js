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
      return "other";
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
        closeBtn.addEventListener("click", function () {
          root.classList.remove("is-open");
          root.setAttribute("aria-hidden", "true");
          pwaState.sessionDismissed = true;
          persistPwaChoice("browser");
        });
      }
      return root;
    }

    function initPwaInstallPrompt(adminMode) {
      const existing = document.getElementById("infraPwaInstallModal");
      const browserKind = getInstallBrowserKind();
      const savedChoice = readPwaChoice();
      const canShow =
        !adminMode &&
        document.body.classList.contains("home-screen") &&
        (isIosDevice() || isAndroidDevice()) &&
        !isStandaloneDisplayMode() &&
        !pwaState.sessionDismissed &&
        !savedChoice;

      if (!canShow) {
        if (existing && (!pwaState.shownThisSession || !document.body.classList.contains("home-screen"))) {
          existing.classList.remove("is-open");
          existing.setAttribute("aria-hidden", "true");
        }
        return;
      }

      const root = ensurePwaInstallPromptUi();
      const steps = root.querySelector("[data-pwa-steps]");
      if (steps) {
        steps.innerHTML = getInstallSteps(browserKind)
          .map(function (step) {
            return '<span class="bib-install-step">' + step[0] + "<span>" + step[1] + "</span></span>";
          })
          .join('<span class="bib-install-sep" aria-hidden="true">›</span>');
      }
      root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
      // Une seule fois : le choix est retenu dès l'affichage (la fenêtre reste ouverte pour cette visite).
      pwaState.shownThisSession = true;
      persistPwaChoice("seen");
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
