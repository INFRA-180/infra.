(function () {
  "use strict";

  const WORKER_URL = "https://infra180-api.pages.dev";
  const root = document.querySelector("[data-sphragis]");
  if (!root) return;

  const form = root.querySelector("[data-sphragis-form]");
  const input = root.querySelector("[data-sphragis-answer]");
  const reward = root.querySelector("[data-sphragis-reward]");
  const feedback = root.querySelector("[data-sphragis-feedback]");

  function setFeedback(value) {
    if (feedback) feedback.textContent = value || "";
  }

  function setBusy(active) {
    root.classList.toggle("is-busy", Boolean(active));
    if (input) input.disabled = Boolean(active);
    const button = form && form.querySelector("button");
    if (button) button.disabled = Boolean(active);
  }

  async function requestUnlock(answer) {
    const response = await fetch(`${WORKER_URL}/sphragis/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer })
    });

    const payload = await response.json().catch(function () { return null; });
    return payload && payload.ok === true && typeof payload.html === "string"
      ? payload.html
      : "";
  }

  function reveal(html) {
    if (!reward) return;
    reward.innerHTML = html;
    reward.hidden = false;
    root.classList.add("is-open");
    if (form) form.setAttribute("aria-hidden", "true");
    setFeedback("");
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const raw = input ? input.value : "";
      if (!raw || !raw.trim()) {
        setFeedback("…");
        return;
      }

      setBusy(true);
      setFeedback("");

      try {
        const html = await requestUnlock(raw);
        if (html) {
          reveal(html);
          return;
        }
        setFeedback("οὐ λύεται");
      } catch (_err) {
        setFeedback("σιγᾷ");
      } finally {
        setBusy(false);
      }
    });
  }
})();
