import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { updateProjetKeys } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Déclare (ou corrige) la date d'ouverture du chantier — la seule donnée
// dont dépend toute la règle des attestations décennales.
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();
    const date = String(body.date ?? "").trim();
    if (!date) throw new AppError("La date d'ouverture est obligatoire.");

    const dateFr = date.includes("-") ? isoToFr(date) : date;
    await updateProjetKeys({ DATE_OUVERTURE_CHANTIER: dateFr });

    return NextResponse.json({ dateOuvertureChantier: dateFr });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
