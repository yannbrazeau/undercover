import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getProjet } from "@/lib/sheets";
import { round2 } from "@/lib/facture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFr(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
}

type EtatDecennaleHmp = "à réclamer" | "valide" | "expirée";

function etatDecennaleHmp(dateFr: string, aujourdHui: Date): EtatDecennaleHmp {
  const d = parseFr(dateFr);
  if (!d) return "à réclamer";
  return d >= aujourdHui ? "valide" : "expirée";
}

export async function GET() {
  try {
    requireConfigured();
    const projet = await getProjet();
    const decennaleHmpEtat = etatDecennaleHmp(projet.decennaleHmpValidite, new Date());

    return NextResponse.json({
      maitreOeuvre: projet.maitreOeuvre,
      budgetContractuel: round2(projet.budgetContractuel),
      dateOuvertureChantier: projet.dateOuvertureChantier,
      doSouscrite: projet.doSouscrite,
      decennaleHmpValidite: projet.decennaleHmpValidite,
      decennaleHmpEtat,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
