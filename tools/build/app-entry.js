// Point d'entrée de app.js (chantier JavaScript, étape 4a — INFRA, 10/11/2026).
// Même ordre que les 21 balises <script defer> d'avant. Chaque fichier est isolé par
// tools/build/vite.config.js : s'il plante au démarrage, les suivants s'exécutent quand même.
// À l'étape 4b, ces fichiers deviennent des modules rangés par sujet.
import "../../src/js/covers.js";
import "../../src/js/favorites.js";
import "../../src/js/favorites-ui.js";
import "../../src/js/audio-visualizer.js";
import "../../src/js/transport-ui.js";
import "../../src/js/now-playing.js";
import "../../src/js/album-player-ui.js";
import "../../src/js/spa-renderer.js";
import "../../src/js/audio-radio.js";
import "../../src/js/media-session.js";
import "../../src/js/audio-prefetch.js";
import "../../src/js/spa-router.js";
import "../../src/js/catalog-fallback.js";
import "../../src/js/catalog-loader.js";
import "../../src/js/audio-telemetry.js";
import "../../src/js/downloads.js";
import "../../src/js/home-catalog.js";
import "../../src/js/audio-core.js";
import "../../src/js/pwa-install.js";
import "../../src/js/share-qr.js";
import "../../src/js/scripts.js";
