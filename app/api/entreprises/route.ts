import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getProjet, getEntreprises } from "@/lib/sheets";
import { resumerEntreprises } from "@/lib/entreprises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Le répertoire complet des entreprises du chantier — la seule porte
// d'entrée vers une fiche entreprise qui ne passe pas par un lot.
export async function GET() {
  try {
    requireConfigured();
    const [projet, entreprises] = await Promise.all([getProjet(), getEntreprises()]);
    const resume = resumerEntreprises(entreprises, projet.dateOuvertureChantier, new Date());
    return NextResponse.json({ entreprises: resume });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
