import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { addFacture } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const lotUuid = String(body.lotUuid ?? "").trim();
    const montantHT = Number(body.montantHT);
    const tauxTVA = Number(body.tauxTVA);
    const tauxRetenue = Number(body.tauxRetenue ?? 0);

    if (!lotUuid) throw new AppError("Choisissez un lot.");
    if (!Number.isFinite(montantHT) || montantHT <= 0)
      throw new AppError("Le montant HT doit être un nombre positif.");
    if (!Number.isFinite(tauxTVA) || tauxTVA < 0)
      throw new AppError("Le taux de TVA est invalide.");

    const rawDate = String(body.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? isoToFr(rawDate) : rawDate;

    const facture = await addFacture({
      lotUuid,
      nature: String(body.nature ?? "").trim() || "Facture",
      montantHT,
      tauxTVA,
      tauxRetenue: Number.isFinite(tauxRetenue) ? tauxRetenue : 0,
      numero: body.numero ? String(body.numero) : undefined,
      date,
      driveUrl: body.driveUrl ? String(body.driveUrl) : undefined,
    });

    return NextResponse.json({ facture });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
