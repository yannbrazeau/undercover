import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { createUploadSession } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ouvre une session d'envoi Drive et renvoie son URI. Aucun octet de fichier ne
// transite ici : c'est le navigateur qui enverra le fichier directement à Google.
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();
    const lotUuid = String(body.lotUuid ?? "").trim();
    const fileName = String(body.fileName ?? "").trim() || "document";
    const mimeType = String(body.mimeType ?? "application/octet-stream");

    if (!lotUuid) throw new AppError("Lot manquant pour le dépôt du fichier.");

    const sessionUri = await createUploadSession(lotUuid, fileName, mimeType);
    return NextResponse.json({ sessionUri });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
