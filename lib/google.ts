// Connexion à Google — un seul point d'authentification (OAuth au nom de Yann).
// Plus de compte de service : l'appli agit avec les droits de l'utilisateur.

import { google } from "googleapis";
import { config, isConfigured } from "./config";

/** Erreur applicative propre, transformée en réponse HTTP par les routes. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function oauthClient() {
  const c = config();
  const client = new google.auth.OAuth2(c.clientId, c.clientSecret);
  client.setCredentials({ refresh_token: c.refreshToken });
  return client;
}

export function sheetsClient() {
  return google.sheets({ version: "v4", auth: oauthClient() });
}

export function driveClient() {
  return google.drive({ version: "v3", auth: oauthClient() });
}

/** Jeton d'accès court (dérivé du refresh token) — pour ouvrir une session d'envoi Drive. */
export async function accessToken(): Promise<string> {
  const { token } = await oauthClient().getAccessToken();
  if (!token) throw new AppError("Jeton d'accès Google indisponible.", 500);
  return token;
}

export function requireConfigured() {
  if (!isConfigured()) {
    throw new AppError(
      "L'accès Google n'est pas encore configuré. Renseignez les identifiants dans l'hébergement.",
      503,
    );
  }
}
