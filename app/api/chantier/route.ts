import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getProjet, getEntreprises } from "@/lib/sheets";
import { resumerEntreprises } from "@/lib/entreprises";
import { round2 } from "@/lib/facture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Le projet, l'assurance dommages-ouvrage et un aperçu des entreprises —
// tout ce que l'écran Chantier affiche. La liste complète des entreprises
// vit dans /api/entreprises, consommée séparément par le répertoire.
export async function GET() {
  try {
    requireConfigured();
    const [projet, entreprises] = await Promise.all([getProjet(), getEntreprises()]);

    const resume = resumerEntreprises(entreprises, projet.dateOuvertureChantier, new Date());

    return NextResponse.json({
      maitreOeuvre: projet.maitreOeuvre,
      budgetContractuel: round2(projet.budgetContractuel),
      dateOuvertureChantier: projet.dateOuvertureChantier,
      dommagesOuvrage: {
        souscrite: projet.doSouscrite,
        assureur: projet.doAssureur,
        dateEffet: projet.doDateEffet,
        documentUrl: projet.doDocumentUrl,
      },
      entreprisesApercu: resume.slice(0, 4),
      totalEntreprises: resume.length,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
