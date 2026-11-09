// Lot 1 (INFRA, 09/11/2026) : écrans de référence du site. Toute différence au pixel fait échouer.
const { test, expect } = require("@playwright/test");

// Rien ne sort de la machine : audio Cloudflare, télémétrie, YouTube sont coupés → captures stables.
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:") ? route.continue() : route.abort();
  });
});

// Attend que les pochettes visibles soient chargées et décodées, et que la page ne bouge plus.
async function settle(page) {
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = () => [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    const deadline = performance.now() + 8000;
    while (performance.now() < deadline) {
      const imgs = visible();
      const pending = imgs.filter((img) => !img.complete || (img.dataset.coverSrc && !img.getAttribute("src")));
      if (!pending.length) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await Promise.all(visible().map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(300);
}

const SCREENS = [
  { name: "accueil", path: "/" },
  { name: "accueil-defile", path: "/", scroll: 900 },
  { name: "album-kali", path: "/music/kali-infra.html" },
  { name: "playlist-moon", path: "/playlists/infra-moon.html" },
  { name: "onglet-albums", path: "/", click: '[data-bib-tab="albums"]' },
  { name: "onglet-titres", path: "/", click: '[data-bib-tab="titres"]' },
  { name: "grand-lecteur", path: "/", click: "[data-transport-now]" },
  { name: "application-vizu", path: "/apps/vizu.html" }
];

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await page.goto(screen.path);
    await settle(page);
    if (screen.click) {
      await page.locator(screen.click).first().click();
      await settle(page);
    }
    if (screen.scroll) {
      await page.evaluate((y) => window.scrollTo(0, y), screen.scroll);
      await settle(page);
    }
    await expect(page).toHaveScreenshot(`${screen.name}.png`);
  });
}
