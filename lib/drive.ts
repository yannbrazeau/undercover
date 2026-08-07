// Dépôt d'un document dans le dossier Drive d'un lot.

import { Readable } from "node:stream";
import { driveClient, sheetsClient } from "./google";
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

  const drive = driveClient();
  const created = await drive.files.create({
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

export type UploadResult = { fileId: string; url: string; name: string };

/** Dépose un fichier dans le dossier du lot et renvoie son lien de consultation. */
export async function uploadToLot(
  lotUuid: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<UploadResult> {
  const folderId = await ensureLotFolder(lotUuid);
  const res = await driveClient().files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(data) },
    fields: "id, webViewLink, name",
  });
  return {
    fileId: res.data.id as string,
    url: (res.data.webViewLink as string) || "",
    name: (res.data.name as string) || fileName,
  };
}
