// Lot 1 (INFRA, 09/11/2026) : captures du site comparées au pixel, avant tout rangement du code.
// npm run visual            → compare aux références
// npm run visual:update     → refait les références (seulement après un changement d'affichage voulu)
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.VISUAL_PORT || 8793);

module.exports = defineConfig({
  testDir: ".",
  snapshotPathTemplate: "{testDir}/references/{projectName}/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: ".resultats",
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide", scale: "css" }
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: "block",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    colorScheme: "light",
    reducedMotion: "reduce"
  },
  projects: [
    { name: "telephone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 } },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] } },
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }
  ],
  webServer: {
    command: `node static-server.js`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    env: { VISUAL_PORT: String(PORT) },
    reuseExistingServer: false
  }
});
