(function () {
  const storageKey = "infra_home_editor_v2";
  const legacyStorageKey = "infra_home_editor_v1";
  const fontChoices = {
    default: "",
    antique: "\"Antique Olive Nord Bold\", \"Avenir Next\", \"Helvetica Neue\", sans-serif",
    space: "\"Space Grotesk\", \"Avenir Next\", \"Helvetica Neue\", sans-serif",
    plex: "\"IBM Plex Sans\", \"Avenir Next\", \"Helvetica Neue\", sans-serif",
    lora: "\"Lora\", \"Times New Roman\", serif",
    sans: "\"Avenir Next\", \"Avenir\", \"Helvetica Neue\", Helvetica, Arial, sans-serif",
    serif: "\"Times New Roman\", \"Times\", serif"
  };

  const adminState = {
    cleanups: []
  };

  function addCleanup(fn) {
    adminState.cleanups.push(fn);
  }

  function on(target, eventName, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(eventName, handler, options);
    addCleanup(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function injectAdminUi() {
    const mount = document.getElementById("adminMount");
    const headerTemplate = document.getElementById("adminHeaderTemplate");
    const menuTemplate = document.getElementById("adminQuickMenuTemplate");

    if (mount && headerTemplate && headerTemplate.content && !mount.querySelector("[data-editor-toggle]")) {
      mount.appendChild(headerTemplate.content.cloneNode(true));
    }

    if (menuTemplate && menuTemplate.content && !document.getElementById("quickMenu")) {
      document.body.appendChild(menuTemplate.content.cloneNode(true));
    }
  }

  function runQuickAction(action, navigateTo) {
    if (!action) return;
    if (action.type === "app_download") {
      openAppDownloadGatekeeper(action.appName, action.url);
      return;
    }
    if (action.type === "download") {
      downloadNow(action.url);
      return;
    }
    if (action.url && typeof navigateTo === "function") {
      navigateTo(action.url);
    }
  }

  function initQuickMenu(options) {
    const menu = document.getElementById("quickMenu");
    const openBtn = document.querySelector("[data-menu-open]");
    const closeBtn = document.querySelector("[data-menu-close]");
    const input = document.getElementById("quickSearch");
    const results = document.getElementById("quickResults");

    if (!menu || !openBtn || !closeBtn || !input || !results) return;

    const navigateTo = typeof options.navigateTo === "function" ? options.navigateTo : null;

    function getActions() {
      if (typeof options.getQuickActions === "function") {
        return options.getQuickActions();
      }
      return [];
    }

    function render(query) {
      const q = String(query || "").trim().toLowerCase();
      const actions = getActions();
      const filtered = q
        ? actions.filter((entry) => String(entry.label || "").toLowerCase().includes(q))
        : actions;

      results.replaceChildren();
      filtered.forEach((action) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quick-action";
        btn.textContent = action.label;
        btn.addEventListener("click", function () {
          runQuickAction(action, navigateTo);
        });
        li.appendChild(btn);
        results.appendChild(li);
      });
    }

    function openMenu() {
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      input.value = "";
      render("");
      input.focus();
    }

    function closeMenu() {
      menu.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
    }

    on(openBtn, "click", openMenu);
    on(closeBtn, "click", closeMenu);

    on(menu, "click", function (event) {
      if (event.target === menu) closeMenu();
    });

    on(input, "input", function () {
      render(input.value);
    });

    on(input, "keydown", function (event) {
      if (event.key !== "Enter") return;
      const first = results.querySelector(".quick-action");
      if (first) first.click();
    });

    on(document, "keydown", function (event) {
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";
      if (isTyping) return;

      if (event.key.toLowerCase() === "m") {
        if (menu.classList.contains("is-open")) closeMenu();
        else openMenu();
        return;
      }

      if (event.key === "Escape" && menu.classList.contains("is-open")) {
        closeMenu();
      }
    });
  }

  function readState() {
    try {
      const raw = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}";
      return JSON.parse(raw);
    } catch (_err) {
      return {};
    }
  }

  function collectState(container, editableEls) {
    const text = {};
    const styles = {};

    editableEls.forEach((el) => {
      const key = el.getAttribute("data-edit-key");
      if (!key) return;
      text[key] = el.innerHTML;
      styles[key] = {
        fontFamily: el.style.fontFamily || "",
        fontSize: el.style.fontSize || "",
        color: el.style.color || "",
        fontChoice: el.dataset.fontChoice || "default"
      };
    });

    const order = Array.from(container.querySelectorAll(".module[data-module-id]"))
      .map((el) => el.getAttribute("data-module-id"))
      .filter(Boolean);

    return { text, styles, order };
  }

  function applyState(state, container, editableEls) {
    if (state && state.text && typeof state.text === "object") {
      editableEls.forEach((el) => {
        const key = el.getAttribute("data-edit-key");
        if (key && typeof state.text[key] === "string") {
          el.innerHTML = state.text[key];
        }
      });
    }

    if (state && state.styles && typeof state.styles === "object") {
      editableEls.forEach((el) => {
        const key = el.getAttribute("data-edit-key");
        const styleData = key ? state.styles[key] : null;
        if (!styleData) return;
        if (typeof styleData.fontFamily === "string") el.style.fontFamily = styleData.fontFamily;
        if (typeof styleData.fontSize === "string") el.style.fontSize = styleData.fontSize;
        if (typeof styleData.color === "string") el.style.color = styleData.color;
        if (typeof styleData.fontChoice === "string") el.dataset.fontChoice = styleData.fontChoice;
      });
    }

    if (state && Array.isArray(state.order)) {
      state.order.forEach((id) => {
        const moduleEl = container.querySelector(`.module[data-module-id="${id}"]`);
        if (moduleEl) container.appendChild(moduleEl);
      });
    }
  }

  function saveState(container, editableEls, saveBtn) {
    const state = collectState(container, editableEls);
    const serialized = JSON.stringify(state);
    localStorage.setItem(storageKey, serialized);
    localStorage.setItem(legacyStorageKey, serialized);

    const oldLabel = saveBtn.textContent;
    saveBtn.textContent = "Sauvegarde OK";
    setTimeout(function () {
      saveBtn.textContent = oldLabel;
    }, 1200);
  }

  function getDragAfterElement(parent, y) {
    const draggables = Array.from(parent.querySelectorAll(".module[data-module-id]:not(.is-dragging)"));
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;

    draggables.forEach((child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = child;
      }
    });

    return closest;
  }

  function initHomeEditor(options) {
    if (!document.body.classList.contains("home-screen")) return;

    const toggleBtn = document.querySelector("[data-editor-toggle]");
    const saveBtn = document.querySelector("[data-editor-save]");
    const fontSelect = document.querySelector("[data-editor-font]");
    const sizeInput = document.querySelector("[data-editor-size-px]");
    const colorInput = document.querySelector("[data-editor-color]");
    const themeSelect = document.querySelector("[data-editor-theme]");
    const fontWrap = fontSelect ? fontSelect.closest(".editor-control") : null;
    const sizeWrap = sizeInput ? sizeInput.closest(".editor-control") : null;
    const colorWrap = colorInput ? colorInput.closest(".editor-control") : null;
    const themeWrap = themeSelect ? themeSelect.closest(".editor-control") : null;
    const container = document.querySelector(".one-page-layout");
    const editableEls = Array.from(document.querySelectorAll("[data-edit-key]"));
    const moduleEls = Array.from(document.querySelectorAll(".module[data-module-id]"));

    if (!toggleBtn || !saveBtn || !container) return;
    if (container.dataset.adminEditorBound === "1") return;
    container.dataset.adminEditorBound = "1";

    const getCurrentTheme = typeof options.getCurrentTheme === "function"
      ? options.getCurrentTheme
      : function () { return "blanc"; };
    const applyThemePreset = typeof options.applyThemePreset === "function"
      ? options.applyThemePreset
      : function () {};

    let editing = false;
    let dragged = null;
    let activeEditable = editableEls[0] || null;

    function syncControlsFromActive() {
      if (!activeEditable) return;
      if (fontSelect) fontSelect.value = activeEditable.dataset.fontChoice || "default";
      if (sizeInput) {
        const match = String(activeEditable.style.fontSize || "").match(/^(\d+)px$/);
        sizeInput.value = match ? match[1] : "";
      }
      if (colorInput) colorInput.value = "#111111";
      if (themeSelect) themeSelect.value = getCurrentTheme();
    }

    function setEditing(on) {
      editing = on;
      document.body.classList.toggle("editor-on", on);
      saveBtn.hidden = !on;
      toggleBtn.textContent = on ? "Quitter edition" : "Mode edition";
      if (fontWrap) fontWrap.hidden = !on;
      if (sizeWrap) sizeWrap.hidden = !on;
      if (colorWrap) colorWrap.hidden = !on;
      if (themeWrap) themeWrap.hidden = !on;

      editableEls.forEach((el) => {
        el.setAttribute("contenteditable", on ? "true" : "false");
        el.setAttribute("spellcheck", "false");
        el.classList.toggle("is-active-edit", on && el === activeEditable);
      });

      moduleEls.forEach((el) => {
        el.setAttribute("draggable", on ? "true" : "false");
      });
    }

    applyState(readState(), container, editableEls);

    on(toggleBtn, "click", function () {
      if (!activeEditable && editableEls.length) activeEditable = editableEls[0];
      setEditing(!editing);
      syncControlsFromActive();
    });

    on(saveBtn, "click", function () {
      saveState(container, editableEls, saveBtn);
    });

    editableEls.forEach((el) => {
      on(el, "focus", function () {
        activeEditable = el;
        syncControlsFromActive();
      });
      on(el, "click", function () {
        activeEditable = el;
        syncControlsFromActive();
      });
      on(el, "input", function () {
        if (!editing) return;
      });
    });

    if (fontSelect) {
      on(fontSelect, "change", function () {
        if (!activeEditable) return;
        const choice = fontSelect.value || "default";
        activeEditable.dataset.fontChoice = choice;
        activeEditable.style.fontFamily = fontChoices[choice] || "";
      });
    }

    if (sizeInput) {
      const applySize = function () {
        if (!activeEditable) return;
        const value = sizeInput.value.trim();
        if (!value) {
          activeEditable.style.fontSize = "";
          return;
        }
        const size = Math.max(10, Math.min(160, Math.round(Number(value) || 0)));
        if (!size) return;
        sizeInput.value = String(size);
        activeEditable.style.fontSize = `${size}px`;
      };
      on(sizeInput, "input", applySize);
      on(sizeInput, "change", applySize);
    }

    if (colorInput) {
      const applyColor = function () {
        if (!activeEditable) return;
        activeEditable.style.color = colorInput.value;
      };
      on(colorInput, "input", applyColor);
      on(colorInput, "change", applyColor);
    }

    if (themeSelect) {
      themeSelect.value = getCurrentTheme();
      on(themeSelect, "input", function () {
        applyThemePreset(themeSelect.value || "blanc", false);
      });
      on(themeSelect, "change", function () {
        applyThemePreset(themeSelect.value || "blanc", true);
      });
    }

    moduleEls.forEach((moduleEl) => {
      on(moduleEl, "dragstart", function (event) {
        if (!editing) {
          event.preventDefault();
          return;
        }
        dragged = moduleEl;
        moduleEl.classList.add("is-dragging");
      });

      on(moduleEl, "dragend", function () {
        moduleEl.classList.remove("is-dragging");
        dragged = null;
      });
    });

    on(container, "dragover", function (event) {
      if (!editing || !dragged) return;
      event.preventDefault();
      const after = getDragAfterElement(container, event.clientY);
      if (!after) container.appendChild(dragged);
      else container.insertBefore(dragged, after);
    });

    on(document, "keydown", function (event) {
      if (!editing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        saveState(container, editableEls, saveBtn);
        setEditing(false);
      }
    });

    setEditing(false);
    syncControlsFromActive();
  }

  function init(options) {
    const opts = options || {};
    injectAdminUi();
    initQuickMenu(opts);
    initHomeEditor(opts);
  }

  function teardown() {
    while (adminState.cleanups.length) {
      const dispose = adminState.cleanups.pop();
      try {
        dispose();
      } catch (_err) {
        // Ignore teardown errors.
      }
    }
    document.body.classList.remove("editor-on");
  }

  window.InfraAdmin = {
    init,
    teardown
  };
})();
