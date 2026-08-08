// Configuration lue depuis les variables d'environnement.
// La couche Google (OAuth, Sheets, Drive) sera ajoutée à l'étape des données.

export type AppConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  spreadsheetId?: string;
  lotsParentId?: string;
};

export function config(): AppConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    spreadsheetId: process.env.HMP_SPREADSHEET_ID,
    lotsParentId: process.env.HMP_DRIVE_LOTS_PARENT_ID,
  };
}

/** État de chaque variable, pour l'écran Réglages. */
export function configStatus(): Record<string, boolean> {
  const c = config();
  return {
    GOOGLE_CLIENT_ID: !!c.clientId,
    GOOGLE_CLIENT_SECRET: !!c.clientSecret,
    GOOGLE_REFRESH_TOKEN: !!c.refreshToken,
    HMP_SPREADSHEET_ID: !!c.spreadsheetId,
    HMP_DRIVE_LOTS_PARENT_ID: !!c.lotsParentId,
  };
}

/** Vrai si l'appli a tout ce qu'il faut pour parler à Google. */
export function isConfigured(): boolean {
  if (isFixtureMode()) return true;
  const c = config();
  return Boolean(c.clientId && c.clientSecret && c.refreshToken && c.spreadsheetId);
}

/**
 * Mode fixtures : les écrans se servent des données de référence du chantier
 * réel (lib/fixtures.ts) au lieu de Google Sheets — réservé aux captures
 * Playwright (§12 du cahier), jamais activé en production.
 */
export function isFixtureMode(): boolean {
  return process.env.PILOTAGE_FIXTURES === "1";
}
