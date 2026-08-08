import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import {
  getLots,
  getDevis,
  getAvenants,
  getFactures,
  getPaiements,
  getEntreprises,
  getProjet,
  devisEngage,
  devisCompteScenario,
  resolveEntrepriseForLot,
  engageLot,
  factureCumulLot,
} from "@/lib/sheets";
import { depensePrevueLot, computeBudget } from "@/lib/budget";
import { round2 } from "@/lib/facture";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Etat = "aucun devis" | "à choisir" | "en cours" | "terminé";

function etatLot(nbDevis: number, signe: boolean, choisi: boolean, avancementPct: number): Etat {
  if (nbDevis === 0) return "aucun devis";
  if (signe || choisi) return avancementPct >= 100 ? "terminé" : "en cours";
  return "à choisir";
}

// Barre fixe de dépense prévue + une ligne par lot pour l'écran Lots (vue
// liste et vue chronologie consomment la même donnée). Le total et l'écart
// viennent de computeBudget(), le même calcul que l'écran Budget — un seul
// moteur, jamais deux chiffres différents pour la même question.
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

    const payeParFacture = new Map<string, number>();
    for (const p of paiements) {
      payeParFacture.set(p.FACTURE_ID, (payeParFacture.get(p.FACTURE_ID) ?? 0) + p.MONTANT);
    }

    const lotsActifs = lots.filter((l) => norm(l.ACTIF) === "oui");

    const items = lotsActifs.map((lot) => {
      const devisDuLot = devis.filter((d) => d.LOT_UUID === lot.LOT_UUID);
      const engage = engageLot(lot.LOT_UUID, devis, avenants);
      const facture = factureCumulLot(lot.LOT_UUID, factures);
      const facturesDuLot = factures.filter((f) => f.LOT_UUID === lot.LOT_UUID);
      const paye = round2(facturesDuLot.reduce((s, f) => s + (payeParFacture.get(f.FACTURE_ID) ?? 0), 0));

      const depense = depensePrevueLot(lot, devis, avenants);
      const ecartBudget = round2(depense.montant - lot.BUDGET_TTC);
      const entreprise = resolveEntrepriseForLot(lot.LOT_UUID, devis).nom;

      const etat = etatLot(
        devisDuLot.length,
        devisDuLot.some(devisEngage),
        devisDuLot.some(devisCompteScenario),
        lot.AVANCEMENT_PCT,
      );

      return {
        lotUuid: lot.LOT_UUID,
        nom: lot.NOM,
        perimetre: lot.PERIMETRE,
        budget: lot.BUDGET_TTC,
        engage,
        facture,
        paye,
        ecartBudget,
        entreprise,
        nbDevis: devisDuLot.length,
        etat,
        debutPrevu: lot.DEBUT_PREVU,
        finPrevue: lot.FIN_PREVUE,
        avancementPct: lot.AVANCEMENT_PCT,
      };
    });

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

    return NextResponse.json({
      lots: items,
      depensePrevue: budget.depensePrevue,
      ilVousReste: budget.ilVousReste,
      budgetContractuel: round2(projet.budgetContractuel),
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
