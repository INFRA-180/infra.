// Lot 9 (Claude, 18/11/2026) : une erreur JavaScript ne passe plus inaperçue.
// Chaque erreur (script qui plante, promesse rejetée, bloc protégé du build) est notée dans la télémétrie
// existante sous « script_error », sans aucun contenu privé : seulement le type d'erreur, le fichier et la ligne.
// Au plus 10 par session, une seule fois par erreur identique.

const MAX_REPORTS = 10;
const seen = new Set();
let send = null;
const pending = [];

function fileOf(value) {
  const text = String(value || "");
  const clean = text.split(/[?#]/, 1)[0];
  return clean.split("/").pop().slice(0, 60) || "inconnu";
}

export function reportScriptError(error, origin, phase, file, line) {
  try {
    const name = String((error && error.name) || (typeof error === "string" ? "Message" : "Erreur")).slice(0, 40);
    const where = file ? fileOf(file) : String(origin || "inconnu").slice(0, 60);
    const key = `${name}|${where}|${line || 0}|${phase}`;
    if (seen.has(key) || seen.size >= MAX_REPORTS) return false;
    seen.add(key);
    const payload = { error_name: name, source: where, phase: String(phase || "runtime"), checkpoint: line ? String(line) : "", severity: "error" };
    if (send) send(payload);
    else pending.push(payload);
    return true;
  } catch (_error) {
    return false; // le rapport d'erreur ne doit jamais casser la page
  }
}

export function installScriptErrorReporting(track) {
  send = function (payload) {
    try {
      track("script_error", payload);
    } catch (_error) {
      // télémétrie indisponible : on n'insiste pas
    }
  };
  // Erreurs survenues dans les blocs protégés avant l'installation (voir tools/build/vite.config.mjs)
  const early = Array.isArray(window.__infraEarlyErrors) ? window.__infraEarlyErrors.splice(0) : [];
  early.forEach((item) => reportScriptError(item && item.error, item && item.module, "module", "", 0));
  window.__infraReportScriptError = function (error, module) {
    reportScriptError(error, module, "module", "", 0);
  };
  window.addEventListener("error", function (event) {
    // Image, son ou feuille de style qui ne charge pas : déjà suivis ailleurs, pas une erreur de script
    if (event && event.target && event.target !== window) return;
    reportScriptError(event && event.error, "", "runtime", event && event.filename, event && event.lineno);
  });
  window.addEventListener("unhandledrejection", function (event) {
    const reason = event && event.reason;
    if (reason && reason.name === "AbortError") return; // annulations voulues (préchargement, navigation)
    reportScriptError(reason, "promesse", "promise", "", 0);
  });
  // Les rapports attendent que la télémétrie soit prête (initialisée plus bas dans scripts.js)
  const flush = function () {
    pending.splice(0).forEach((payload) => send(payload));
  };
  if (document.readyState === "complete") setTimeout(flush, 0);
  else window.addEventListener("load", function () { setTimeout(flush, 0); }, { once: true });
}
