// Référence visuelle des écrans, à 390 px, contre la maquette Jour
// (MAQUETTES-ECRANS.html) — §12 du cahier de conception. Le serveur tourne
// en mode fixtures (lib/fixtures.ts, voir playwright.config.ts) : les
// captures ne dépendent d'aucune connexion Google et restent stables tant
// que l'écran ou les données de référence ne changent pas vraiment.
//
// Pour rejouer : npx playwright test
// Pour accepter un changement voulu : npx playwright test --update-snapshots

import { test, expect, type Page } from "@playwright/test";

/**
 * La navigation est en position sticky, collée au bas du viewport. Une
 * capture `fullPage: true` classique la fait apparaître au milieu de l'image
 * (Chromium la fige à la limite du premier viewport avant d'empiler la
 * suite) — pas un bug d'écran, un artefact de capture. On agrandit plutôt le
 * viewport à la hauteur réelle du contenu avant de photographier : plus
 * aucun défilement n'existe pendant la prise, la nav retrouve sa place.
 *
 * `.app` porte un `min-height: 100vh` pour ne jamais laisser un écran court
 * flotter dans une page trop grande à l'usage — mais mesuré depuis un
 * viewport qui n'est pas encore celui de la capture, ce plancher fausserait
 * la hauteur mesurée (100vh de l'ancien viewport, pas du contenu réel). On
 * la neutralise avant de mesurer, seulement pour cette page de test.
 *
 * `document.documentElement.scrollHeight` a, de par la spec CSSOM View, un
 * plancher égal à la hauteur du viewport courant, quel que soit le contenu
 * réel — mesurer sur `body` plutôt que sur l'élément racine l'évite.
 */
async function screenshotPleinePage(page: Page, nom: string) {
  await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>(".app");
    if (app) app.style.minHeight = "0";
  });
  const hauteur = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 390, height: hauteur });
  await expect(page).toHaveScreenshot(nom);
}

test("Budget", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("629 850,00 €")).toBeVisible();
  await screenshotPleinePage(page, "budget.png");
});

test("Lots, liste", async ({ page }) => {
  await page.goto("/lots");
  await expect(page.getByText("686 556,01 €")).toBeVisible();
  await screenshotPleinePage(page, "lots-liste.png");
});

test("Lots, chronologie", async ({ page }) => {
  await page.goto("/lots");
  await expect(page.getByText("686 556,01 €")).toBeVisible();
  await page.getByText("Chronologie", { exact: true }).click();
  await expect(page.getByText("Terrassement")).toBeVisible();
  await screenshotPleinePage(page, "lots-chronologie.png");
});

test("Fiche d'un lot", async ({ page }) => {
  await page.goto("/lots/f761a99b");
  await expect(page.getByText("CI Construction")).toBeVisible();
  await screenshotPleinePage(page, "fiche-lot.png");
});

test("Ajouter", async ({ page }) => {
  await page.goto("/ajouter?lot=f761a99b&kind=facture");
  await expect(page.getByLabel("Pour quel lot")).toHaveValue("f761a99b");
  await page.getByPlaceholder("16 000").fill("12 000");
  await expect(page.getByText("Net à payer")).toBeVisible();
  await expect(page.getByText("12 000,00 €", { exact: true })).toBeVisible();
  await screenshotPleinePage(page, "ajouter.png");
});

test("Chantier", async ({ page }) => {
  await page.goto("/chantier");
  await page.getByText("Vérifier la connexion").click();
  await expect(page.getByText("établi", { exact: true })).toBeVisible();
  await screenshotPleinePage(page, "chantier.png");
});

test("Entreprises", async ({ page }) => {
  await page.goto("/entreprises");
  await expect(page.getByText("15 entreprises")).toBeVisible();
  await screenshotPleinePage(page, "entreprises.png");
});

test("Fiche entreprise", async ({ page }) => {
  await page.goto("/entreprises/ent-002");
  await expect(page.getByText("115 204,42 €")).toBeVisible();
  await screenshotPleinePage(page, "fiche-entreprise.png");
});
