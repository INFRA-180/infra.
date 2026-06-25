(function () {
  "use strict";

  function call(ctx, name) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;
    return ctx[name].apply(ctx, Array.prototype.slice.call(arguments, 2));
  }

  function createPwaInstall(context) {
    const ctx = context || {};
    const pwaState = ctx.pwaState || { choiceStorageKey: "infra_pwa_install_choice_v1", sessionDismissed: false };

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
        return String(localStorage.getItem(pwaState.choiceStorageKey) || "").trim().toLowerCase();
      } catch (_err) {
        return "";
      }
    }

    function persistPwaChoice(choice) {
      try {
        localStorage.setItem(pwaState.choiceStorageKey, String(choice || "").trim().toLowerCase());
      } catch (_err) {
        // Ignore storage errors.
      }
    }

    function ensurePwaInstallPromptUi() {
      let root = document.getElementById("infraPwaInstallModal");
      if (root) return root;

      root = document.createElement("div");
      root.id = "infraPwaInstallModal";
      root.className = "pwa-install-modal";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = [
        "<div class=\"pwa-install-card\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Installer INFRA\">",
        "  <div class=\"pwa-install-head\">",
        "    <h3>Installer INFRA.</h3>",
        "    <p>iPhone (Safari) et Android: installation sur l'ecran d'accueil.</p>",
        "  </div>",
        "  <div class=\"pwa-choice-grid\">",
        "    <button class=\"pwa-choice-btn is-primary\" type=\"button\" data-pwa-install>",
        "      <span class=\"pwa-choice-badge\">APP</span>",
        "      <strong>Installer</strong>",
        "      <span>Ecran d'accueil</span>",
        "    </button>",
        "    <button class=\"pwa-choice-btn\" type=\"button\" data-pwa-browser>",
        "      <span class=\"pwa-choice-badge\">WEB</span>",
        "      <strong>Navigateur</strong>",
        "      <span>Continuer ici</span>",
        "    </button>",
        "  </div>",
        "  <div class=\"pwa-install-guide\" data-pwa-guide hidden>",
        "    <p data-pwa-guide-text>iPhone et Android: instructions d'installation.</p>",
        "    <ol data-pwa-guide-steps>",
        "      <li>Appuie sur le bouton <strong>Partager</strong> (carre + fleche).</li>",
        "      <li>Choisis <strong>Sur l'ecran d'accueil</strong>.</li>",
        "      <li>Valide avec <strong>Ajouter</strong>.</li>",
        "    </ol>",
        "    <div class=\"pwa-install-foot\">",
        "      <button class=\"mini-btn mini-btn-dark\" type=\"button\" data-pwa-done>OK</button>",
        "    </div>",
        "  </div>",
        "</div>"
      ].join("");

      document.body.appendChild(root);

      const installBtn = root.querySelector("[data-pwa-install]");
      const browserBtn = root.querySelector("[data-pwa-browser]");
      const guide = root.querySelector("[data-pwa-guide]");
      const guideText = root.querySelector("[data-pwa-guide-text]");
      const guideSteps = root.querySelector("[data-pwa-guide-steps]");
      const doneBtn = root.querySelector("[data-pwa-done]");

      function closePrompt(markSessionDismissed) {
        root.classList.remove("is-open");
        root.setAttribute("aria-hidden", "true");
        if (markSessionDismissed) {
          pwaState.sessionDismissed = true;
        }
      }

      root.addEventListener("click", function (event) {
        if (event.target === root) {
          closePrompt(true);
        }
      });

      if (browserBtn) {
        browserBtn.addEventListener("click", function () {
          if (!isSafariOnIos()) {
            persistPwaChoice("browser");
          }
          closePrompt(true);
        });
      }

      if (installBtn) {
        installBtn.addEventListener("click", function () {
          if (!isSafariOnIos()) {
            persistPwaChoice("install");
          }
          if (!guide) {
            closePrompt(true);
            return;
          }

          fillPwaGuide(guideText, guideSteps, getInstallBrowserKind());

          guide.hidden = false;
        });
      }

      if (doneBtn) {
        doneBtn.addEventListener("click", function () {
          closePrompt(true);
        });
      }

      return root;
    }

    function initPwaInstallPrompt(adminMode) {
      const existing = document.getElementById("infraPwaInstallModal");
      const browserKind = getInstallBrowserKind();
      const showEveryLaunch = browserKind === "ios-safari";
      const savedChoice = readPwaChoice();
      const canShow = !adminMode &&
        document.body.classList.contains("home-screen") &&
        (isIosDevice() || isAndroidDevice()) &&
        !isStandaloneDisplayMode() &&
        !pwaState.sessionDismissed &&
        (showEveryLaunch || !savedChoice);

      if (!canShow) {
        if (existing) {
          existing.classList.remove("is-open");
          existing.setAttribute("aria-hidden", "true");
        }
        return;
      }

      const root = ensurePwaInstallPromptUi();
      const guide = root.querySelector("[data-pwa-guide]");
      const guideSteps = root.querySelector("[data-pwa-guide-steps]");
      const guideText = root.querySelector("[data-pwa-guide-text]");
      if (guide) guide.hidden = true;
      fillPwaGuide(guideText, guideSteps, browserKind);
      root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
    }


    return {
      getIosBrowserKind,
      getAndroidBrowserKind,
      getInstallBrowserKind,
      isSafariOnIos,
      getPwaGuideContent,
      fillPwaGuide,
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
