import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { addPaiement } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const factureId = String(body.factureId ?? "").trim();
    const montant = Number(body.montant);

    if (!factureId) throw new AppError("Choisissez la facture à régler.");
    if (!Number.isFinite(montant) || montant <= 0)
      throw new AppError("Le montant réglé doit être un nombre positif.");

    const rawDate = String(body.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? isoToFr(rawDate) : rawDate;

    const result = await addPaiement({
      factureId,
      montant,
      date,
      moyen: body.moyen ? String(body.moyen) : undefined,
      reference: body.reference ? String(body.reference) : undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
