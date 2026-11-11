// Pile d'écrans (INFRA, 11/11/2026 ; maquette V7, DOCS/NAVIGATION_20261111.md) : tests de comportement.
// L'accueil reste peint sous l'album, figé à sa place, et le retour le réaffiche sans le reconstruire.
// Lancés avec les captures : npm run visual.
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:") ? route.continue() : route.abort();
  });
});

const CURRENT = ".spa-route-layer[data-spa-route-state='current']";
const RETAINED = ".spa-route-layer[data-spa-route-state='retained']";

// Accueil défilé de 400 px, images marquées, une pochette visible retenue comme repère ; puis ouvre un album.
async function openAlbumFromHome(page) {
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const before = await page.evaluate((current) => {
    const imgs = [...document.querySelectorAll(current + " img")];
    imgs.forEach((img) => (img.__navMark = true));
    const probe = imgs.find((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.top > 0 && r.bottom < innerHeight;
    });
    window.__navProbe = probe;
    return { images: imgs.length, probeTop: Math.round(probe.getBoundingClientRect().top) };
  }, CURRENT);
  await page.evaluate((current) => {
    const card = [...document.querySelectorAll(current + " a[href*='music/']")].find((a) => {
      const r = a.getBoundingClientRect();
      return r.top > 60 && r.bottom < innerHeight - 120;
    });
    card.click();
  }, CURRENT);
  await expect(page).toHaveURL(/\/music\/.+\.html$/);
  await page.waitForTimeout(800);
  return before;
}

async function homeState(page) {
  await expect(page).toHaveURL(/\/(index\.html)?$/);
  await page.waitForTimeout(800);
  return page.evaluate((current) => {
    const imgs = [...document.querySelectorAll(current + " img")];
    return {
      images: imgs.length,
      reused: imgs.filter((img) => img.__navMark).length,
      probeTop: Math.round(window.__navProbe.getBoundingClientRect().top),
      scrollY: Math.round(window.scrollY),
      layers: document.querySelectorAll(".spa-route-layer").length
    };
  }, CURRENT);
}

test("accueil peint sous l'album, à sa place", async ({ page }) => {
  const before = await openAlbumFromHome(page);
  const under = await page.evaluate((retained) => {
    const layer = document.querySelector(retained);
    return {
      exists: Boolean(layer),
      opacity: layer && getComputedStyle(layer).opacity,
      probeTop: Math.round(window.__navProbe.getBoundingClientRect().top)
    };
  }, RETAINED);
  expect(under.exists).toBe(true);
  expect(under.opacity).toBe("1");
  expect(under.probeTop).toBe(before.probeTop);
});

test("retour par le bouton : même accueil, même place", async ({ page }) => {
  const before = await openAlbumFromHome(page);
  await page.locator(CURRENT + " .back").first().click();
  const after = await homeState(page);
  expect(after.reused).toBe(before.images);
  expect(after.probeTop).toBe(before.probeTop);
  expect(after.scrollY).toBe(400);
  expect(after.layers).toBe(1);
});

test("Échap puis Alt + ← : retour à l'accueil gardé", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "ordinateur", "raccourcis clavier : ordinateur");
  let before = await openAlbumFromHome(page);
  await page.keyboard.press("Escape");
  let after = await homeState(page);
  expect(after.reused).toBe(before.images);
  before = await openAlbumFromHome(page);
  await page.keyboard.press("Alt+ArrowLeft");
  after = await homeState(page);
  expect(after.reused).toBe(before.images);
});

test("« / » ouvre la recherche, onglet actif = haut de page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "ordinateur", "raccourci clavier : ordinateur");
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(600);
  await page.keyboard.press("/");
  await expect(page.locator("[data-bib-tabs]")).toHaveClass(/searching/);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-bib-tabs]")).not.toHaveClass(/searching/);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.locator('[data-bib-tab][aria-current="true"]').first().click();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
});

test("bord gauche : la page suit le doigt, puis retour", async ({ page }, testInfo) => {
  // Chromium tactile : le WebKit de bureau ne crée pas d'événements tactiles (vrai geste : simulateur iPhone).
  test.skip(testInfo.project.name !== "telephone", "geste tactile : téléphone");
  const before = await openAlbumFromHome(page);
  const mid = await page.evaluate(async (current) => {
    const layer = document.querySelector(current);
    const touch = (x) => new Touch({ identifier: 1, target: layer, clientX: x, clientY: 400 });
    const fire = (type, x) =>
      layer.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchend" ? [] : [touch(x)],
          changedTouches: [touch(x)]
        })
      );
    fire("touchstart", 6);
    for (const x of [20, 60, 120, 180]) fire("touchmove", x);
    const transform = layer.style.transform;
    await new Promise((r) => setTimeout(r, 300)); // geste lent : pas de « geste vif »
    fire("touchend", 180);
    return { transform };
  }, CURRENT);
  expect(mid.transform).toBe("translate3d(174px, 0px, 0px)");
  const after = await homeState(page);
  expect(after.reused).toBe(before.images);
  expect(after.probeTop).toBe(before.probeTop);
});
