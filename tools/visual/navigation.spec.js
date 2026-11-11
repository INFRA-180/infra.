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

// ---------- Lot Nav-2 (INFRA, 11/11/2026) : la pile vaut pour toutes les fiches ----------
// Accueil → album A → album B (ouvert depuis A, comme le nom de l'album dans le grand lecteur).

// Ouvre, depuis la fiche affichée, un autre album par un lien (même chemin que le lien du grand lecteur).
async function openOtherAlbum(page, href) {
  const before = await page.evaluate((current) => {
    window.scrollTo(0, 250);
    const layer = document.querySelector(current);
    const imgs = [...layer.querySelectorAll("img")];
    imgs.forEach((img) => (img.__navMarkA = true));
    return { url: location.pathname, title: document.title, images: imgs.length };
  }, CURRENT);
  await page.waitForTimeout(200);
  await page.evaluate(
    ({ current, href }) => {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = "autre album";
      document.querySelector(current).appendChild(a);
      a.click();
    },
    { current: CURRENT, href }
  );
  await expect(page).not.toHaveURL(new RegExp(before.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await page.waitForTimeout(800);
  return before;
}

// Un autre album que celui ouvert, pris dans l'accueil gardé.
async function otherAlbumHref(page) {
  return page.evaluate((retained) => {
    const here = location.pathname.split("/").pop();
    const a = [...document.querySelectorAll(retained + " a.album-card[href*='music/']")].find(
      (x) => !x.getAttribute("href").endsWith(here)
    );
    return new URL(a.getAttribute("href"), location.origin + "/").href;
  }, RETAINED);
}

async function stackState(page) {
  return page.evaluate(
    ({ current, retained }) => {
      const layer = document.querySelector(current);
      const imgs = layer ? [...layer.querySelectorAll("img")] : [];
      return {
        url: location.pathname,
        layers: document.querySelectorAll(".spa-route-layer").length,
        retained: [...document.querySelectorAll(retained)].map((l) => getComputedStyle(l).opacity),
        reusedA: imgs.filter((img) => img.__navMarkA).length,
        reusedHome: imgs.filter((img) => img.__navMark).length,
        scrollY: Math.round(window.scrollY),
        back: layer && layer.querySelector(".back") ? layer.querySelector(".back").textContent.trim() : ""
      };
    },
    { current: CURRENT, retained: RETAINED }
  );
}

test("Nav-2 : album ouvert depuis un album, les deux écrans du dessous restent peints", async ({ page }) => {
  await openAlbumFromHome(page);
  const href = await otherAlbumHref(page);
  await openOtherAlbum(page, href);
  const s = await stackState(page);
  expect(s.layers).toBe(3);
  expect(s.retained).toEqual(["1", "1"]);
});

test("Nav-2 : le retour remet l'album d'avant (même page, même place), puis l'accueil", async ({ page }) => {
  const home = await openAlbumFromHome(page);
  const href = await otherAlbumHref(page);
  const a = await openOtherAlbum(page, href);
  expect((await stackState(page)).back).toContain(a.title.split(/\s[-–|·]\s/)[0].trim());
  await page.locator(CURRENT + " .back").first().click();
  await expect(page).toHaveURL(new RegExp(a.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await page.waitForTimeout(800);
  let s = await stackState(page);
  expect(s.reusedA).toBe(a.images);
  expect(s.scrollY).toBe(250);
  expect(s.layers).toBe(2);
  await page.locator(CURRENT + " .back").first().click();
  const after = await homeState(page);
  expect(after.reused).toBe(home.images);
  expect(after.scrollY).toBe(400);
  expect(after.layers).toBe(1);
});

test("Nav-2 : retour du navigateur, deux fois", async ({ page }) => {
  const home = await openAlbumFromHome(page);
  const href = await otherAlbumHref(page);
  const a = await openOtherAlbum(page, href);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(a.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await page.waitForTimeout(800);
  expect((await stackState(page)).reusedA).toBe(a.images);
  await page.goBack();
  const after = await homeState(page);
  expect(after.reused).toBe(home.images);
});

test("Nav-2 : 5 écrans gardés au plus", async ({ page }) => {
  await openAlbumFromHome(page);
  const hrefs = await page.evaluate((retained) => {
    return [...document.querySelectorAll(retained + " a.album-card[href*='music/']")]
      .map((a) => new URL(a.getAttribute("href"), location.origin + "/").href)
      .filter((h, i, all) => all.indexOf(h) === i && !h.endsWith(location.pathname.split("/").pop()))
      .slice(0, 6);
  }, RETAINED);
  for (const href of hrefs) await openOtherAlbum(page, href);
  const s = await stackState(page);
  expect(s.layers).toBeLessThanOrEqual(5);
  expect(s.layers).toBeGreaterThanOrEqual(4);
});

test("Nav-2 : vignettes de l'accueil préparées au repos, sans défiler", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const pending = () =>
    page.evaluate(
      (current) =>
        document.querySelectorAll(
          current + " img.album-cover[data-cover-src], " + current + " img.playlist-cover-tile[data-cover-src]"
        ).length,
      CURRENT
    );
  await expect.poll(pending, { timeout: 30000 }).toBe(0);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
});
