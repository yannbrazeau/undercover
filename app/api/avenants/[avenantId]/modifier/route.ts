import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { modifierAvenant } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ avenantId: string }> }) {
  try {
    requireConfigured();
    const { avenantId } = await params;
    const body = await req.json();

    const input: { description?: string; montantTTC?: number } = {};
    if (body.description !== undefined) {
      const description = String(body.description).trim();
      if (!description) throw new AppError("La description ne peut pas être vide.");
      input.description = description;
    }
    if (body.montantTTC !== undefined) {
      const montantTTC = Number(body.montantTTC);
      if (!Number.isFinite(montantTTC) || montantTTC === 0) {
        throw new AppError("Le montant doit être un nombre, positif ou négatif.");
      }
      input.montantTTC = montantTTC;
    }

    await modifierAvenant(avenantId, input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
