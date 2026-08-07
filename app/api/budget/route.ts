import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getLots, getDevis, getAvenants, getFactures, getPaiements, getEntreprises, getProjet } from "@/lib/sheets";
import { computeBudget } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireConfigured();
    const [lots, devis, avenants, factures, paiements, entreprises, projet] = await Promise.all([
      getLots(),
      getDevis(),
      getAvenants(),
      getFactures(),
      getPaiements(),
      getEntreprises(),
      getProjet(),
    ]);

    const budget = computeBudget({
      lots,
      devis,
      avenants,
      factures,
      paiements,
      entreprises,
      projet,
      aujourdHui: new Date(),
    });

    return NextResponse.json({ budget });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
