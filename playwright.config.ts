import { defineConfig, devices } from "@playwright/test";

// §12 du cahier de conception : les sept écrans sont figés en 390 px comme
// référence visuelle. Toute dérive de la maquette Jour doit apparaître ici,
// pas être découverte au déploiement.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  webServer: {
    command: "npm run build && npm run start -- -p 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Écrans figés à partir des données de référence (lib/fixtures.ts), pas
    // du classeur réel : la capture ne doit dépendre d'aucun identifiant Google.
    env: { PILOTAGE_FIXTURES: "1" },
  },
});
