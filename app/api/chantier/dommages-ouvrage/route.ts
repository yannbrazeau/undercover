import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { updateProjetKeys } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enregistre le contrat de dommages-ouvrage — la seule assurance du projet
// lui-même, à souscrire une fois avant l'ouverture du chantier.
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();
    const assureur = String(body.assureur ?? "").trim();
    const dateEffet = String(body.dateEffet ?? "").trim();
    if (!assureur) throw new AppError("L'assureur est obligatoire.");
    if (!dateEffet) throw new AppError("La date d'effet est obligatoire.");

    await updateProjetKeys({
      DO_SOUSCRITE: "oui",
      DO_ASSUREUR: assureur,
      DO_DATE_EFFET: dateEffet.includes("-") ? isoToFr(dateEffet) : dateEffet,
      DO_DOCUMENT_URL: String(body.driveUrl ?? ""),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
