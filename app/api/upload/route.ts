import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { uploadToLot } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // plafond fonctionnel : 25 Mo

export async function POST(req: Request) {
  try {
    requireConfigured();
    const form = await req.formData();
    const lotUuid = String(form.get("lotUuid") ?? "").trim();
    const file = form.get("file");

    if (!lotUuid) throw new AppError("Lot manquant pour le dépôt du fichier.");
    if (!(file instanceof File)) throw new AppError("Aucun fichier reçu.");
    if (file.size > MAX_BYTES) throw new AppError("Fichier trop volumineux (max 25 Mo).");

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadToLot(
      lotUuid,
      file.name || "document",
      file.type || "application/octet-stream",
      buffer,
    );
    return NextResponse.json({ upload });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
