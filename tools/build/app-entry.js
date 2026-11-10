// Point d'entrée de app.js (chantier JavaScript, étape 4a — INFRA, 10/11/2026).
// Même ordre que les 21 balises <script defer> d'avant. Chaque fichier est isolé par
// tools/build/vite.config.js : s'il plante au démarrage, les suivants s'exécutent quand même.
// À l'étape 4b, ces fichiers deviennent des modules rangés par sujet.
import "../../public/assets/js/covers.js";
import "../../public/assets/js/favorites.js";
import "../../public/assets/js/favorites-ui.js";
import "../../public/assets/js/audio-visualizer.js";
import "../../public/assets/js/transport-ui.js";
import "../../public/assets/js/now-playing.js";
import "../../public/assets/js/album-player-ui.js";
import "../../public/assets/js/spa-renderer.js";
import "../../public/assets/js/audio-radio.js";
import "../../public/assets/js/media-session.js";
import "../../public/assets/js/audio-prefetch.js";
import "../../public/assets/js/spa-router.js";
import "../../public/assets/js/catalog-fallback.js";
import "../../public/assets/js/catalog-loader.js";
import "../../public/assets/js/audio-telemetry.js";
import "../../public/assets/js/downloads.js";
import "../../public/assets/js/home-catalog.js";
import "../../public/assets/js/audio-core.js";
import "../../public/assets/js/pwa-install.js";
import "../../public/assets/js/share-qr.js";
import "../../public/assets/js/scripts.js";
