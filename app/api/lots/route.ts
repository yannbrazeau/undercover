import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getLots, getProjet } from "@/lib/sheets";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liste des lots actifs pour les sélecteurs, et valeurs par défaut du projet.
export async function GET() {
  try {
    requireConfigured();
    const [lots, projet] = await Promise.all([getLots(), getProjet()]);
    return NextResponse.json({
      lots: lots
        .filter((l) => norm(l.ACTIF) === "oui")
        .map((l) => ({ uuid: l.LOT_UUID, nom: l.NOM })),
      defaults: { tauxRetenue: projet.tauxRetenueGarantie },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
