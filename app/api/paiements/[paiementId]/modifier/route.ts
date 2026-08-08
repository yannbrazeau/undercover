import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { modifierPaiement } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ paiementId: string }> }) {
  try {
    requireConfigured();
    const { paiementId } = await params;
    const body = await req.json();

    const input: { montant?: number; moyen?: string; reference?: string } = {};
    if (body.montant !== undefined) {
      const montant = Number(body.montant);
      if (!Number.isFinite(montant) || montant <= 0) throw new AppError("Le montant doit être positif.");
      input.montant = montant;
    }
    if (body.moyen !== undefined) input.moyen = String(body.moyen).trim();
    if (body.reference !== undefined) input.reference = String(body.reference).trim();

    await modifierPaiement(paiementId, input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
