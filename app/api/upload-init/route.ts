import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { createUploadSession, createUploadSessionEntreprise, createUploadSessionProjet } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ouvre une session d'envoi Drive et renvoie son URI. Aucun octet de fichier ne
// transite ici : c'est le navigateur qui enverra le fichier directement à Google.
// Le dossier de destination dépend de qui reçoit le document : un lot (devis,
// facture) ou une entreprise (attestation décennale).
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();
    const lotUuid = String(body.lotUuid ?? "").trim();
    const entrepriseId = String(body.entrepriseId ?? "").trim();
    const projet = Boolean(body.projet);
    const fileName = String(body.fileName ?? "").trim() || "document";
    const mimeType = String(body.mimeType ?? "application/octet-stream");

    if (!lotUuid && !entrepriseId && !projet) {
      throw new AppError("Lot, entreprise ou projet manquant pour le dépôt du fichier.");
    }

    const sessionUri = projet
      ? await createUploadSessionProjet(fileName, mimeType)
      : entrepriseId
        ? await createUploadSessionEntreprise(entrepriseId, fileName, mimeType)
        : await createUploadSession(lotUuid, fileName, mimeType);
    return NextResponse.json({ sessionUri });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
