import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { modifierFacture } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ factureId: string }> }) {
  try {
    requireConfigured();
    const { factureId } = await params;
    const body = await req.json();

    const montantTTC = Number(body.montantTTC);
    const tauxRetenue = Number(body.tauxRetenue);
    if (!Number.isFinite(montantTTC) || montantTTC <= 0) throw new AppError("Le montant TTC doit être positif.");
    if (!Number.isFinite(tauxRetenue) || tauxRetenue < 0) throw new AppError("Le taux de retenue est invalide.");

    const nature = body.nature !== undefined ? String(body.nature).trim() : undefined;

    const montants = await modifierFacture(factureId, { montantTTC, tauxRetenue, nature });
    return NextResponse.json({ montants });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
