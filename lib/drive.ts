// Drive : dossier d'un lot + ouverture d'une session d'envoi « reprenable ».
// Le fichier ne transite PAS par l'hébergeur (limite ~4,5 Mo) : le serveur ouvre
// une session autorisée, le navigateur envoie ensuite les octets directement à Google.

import { driveClient, sheetsClient, accessToken } from "./google";
import { config } from "./config";
import { readTab } from "./sheets";
import { TAB } from "./types";

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Renvoie l'ID du dossier Drive d'un lot. Les lots ajoutés (Honoraires HMP,
 * Étude thermique) n'en ont pas encore : on le crée sous le dossier parent
 * et on réécrit l'ID dans DATA_LOTS.
 */
export async function ensureLotFolder(lotUuid: string): Promise<string> {
  const { headers, rows } = await readTab(TAB.LOTS);
  const idx = rows.findIndex((r) => String(r.LOT_UUID ?? "") === lotUuid);
  if (idx < 0) throw new Error("Lot introuvable.");

  const existing = String(rows[idx].DRIVE_FOLDER_ID ?? "").trim();
  if (existing) return existing;

  const created = await driveClient().files.create({
    requestBody: {
      name: String(rows[idx].NOM ?? "Lot"),
      mimeType: "application/vnd.google-apps.folder",
      parents: config().lotsParentId ? [config().lotsParentId as string] : undefined,
    },
    fields: "id",
  });
  const folderId = created.data.id as string;

  const col = headers.indexOf("DRIVE_FOLDER_ID");
  if (col >= 0) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.LOTS}!${colLetter(col)}${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[folderId]] },
    });
  }
  return folderId;
}

/**
 * Renvoie l'ID du dossier Drive d'une entreprise (attestations décennales).
 * Créé au premier envoi, sous le même dossier parent que les lots.
 */
export async function ensureEntrepriseFolder(entrepriseId: string): Promise<string> {
  const { headers, rows } = await readTab(TAB.ENTREPRISES);
  const idx = rows.findIndex((r) => String(r.ENTREPRISE_ID ?? "") === entrepriseId);
  if (idx < 0) throw new Error("Entreprise introuvable.");

  const existing = String(rows[idx].DRIVE_FOLDER_ID ?? "").trim();
  if (existing) return existing;

  const created = await driveClient().files.create({
    requestBody: {
      name: String(rows[idx].NOM ?? "Entreprise"),
      mimeType: "application/vnd.google-apps.folder",
      parents: config().lotsParentId ? [config().lotsParentId as string] : undefined,
    },
    fields: "id",
  });
  const folderId = created.data.id as string;

  const col = headers.indexOf("DRIVE_FOLDER_ID");
  if (col >= 0) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.ENTREPRISES}!${colLetter(col)}${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[folderId]] },
    });
  }
  return folderId;
}

async function ouvrirSessionEnvoi(folderId: string, fileName: string, mimeType: string): Promise<string> {
  const token = await accessToken();

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ouverture de la session d'envoi refusée (${res.status}). ${detail.slice(0, 120)}`);
  }
  const sessionUri = res.headers.get("location");
  if (!sessionUri) throw new Error("Session d'envoi non obtenue de Google.");
  return sessionUri;
}

/**
 * Ouvre une session d'envoi reprenable dans le dossier du lot et renvoie l'URI
 * de session. Le navigateur enverra le fichier directement sur cette URI.
 */
export async function createUploadSession(lotUuid: string, fileName: string, mimeType: string): Promise<string> {
  const folderId = await ensureLotFolder(lotUuid);
  return ouvrirSessionEnvoi(folderId, fileName, mimeType);
}

/** Même chose, pour le dossier de documents d'une entreprise. */
export async function createUploadSessionEntreprise(
  entrepriseId: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const folderId = await ensureEntrepriseFolder(entrepriseId);
  return ouvrirSessionEnvoi(folderId, fileName, mimeType);
}
