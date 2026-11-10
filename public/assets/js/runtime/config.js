// Réglages, états partagés et constantes du lecteur.
// Extrait de l'ancien scripts.js (chantier JavaScript d'INFRA, 10/11/2026). Uniquement des fonctions
// et leurs variables : l'état partagé et l'ordre de démarrage restent dans scripts.js.
import { audioTelemetryModule } from "../scripts.js";

function getAudioTelemetryNow() {
  return audioTelemetryModule && typeof audioTelemetryModule.now === "function"
    ? audioTelemetryModule.now()
    : (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());
}

export { getAudioTelemetryNow };
