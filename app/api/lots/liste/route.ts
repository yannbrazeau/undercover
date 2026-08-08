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
  resolveEntrepriseForLot,
  engageLot,
  factureCumulLot,
} from "@/lib/sheets";
import { computeBudget } from "@/lib/budget";
import { round2 } from "@/lib/facture";
import { norm, euros } from "@/lib/format";
import type { Devis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Etat = "dépassement" | "sous le budget" | "signé" | "expirés" | "à choisir" | "budget estimé";
type Tonalite = "danger" | "warn" | "ok" | "mute";

const STATUTS_HORS_SCENARIO = new Set(["remplace", "annexe"]);

/**
 * L'état d'un lot, dans l'ordre où il compte pour la décision : un devis
 * signé écarté du budget (dépassement ou marge), sinon la situation des
 * devis en lice, sinon le budget seul. Chaque état porte son propre libellé
 * de montant (`aLabel`) — jamais un « 0 € » qui ne voudrait rien dire.
 */
function calculerEtatLot(devisDuLot: Devis[], engage: number, budgetLot: number) {
  const actifs = devisDuLot.filter((d) => !STATUTS_HORS_SCENARIO.has(norm(d.STATUT)));
  const signe = actifs.find(devisEngage);

  if (signe) {
    const ecart = budgetLot > 0 ? round2(engage - budgetLot) : null;
    if (ecart !== null && ecart > 0.01) {
      return { etat: "dépassement" as Etat, tonalite: "danger" as Tonalite, aLabel: `+${euros(ecart)}`, aTonalite: "danger" as Tonalite };
    }
    if (ecart !== null && ecart < -0.01) {
      return { etat: "sous le budget" as Etat, tonalite: "ok" as Tonalite, aLabel: euros(ecart), aTonalite: "ok" as Tonalite };
    }
    return {
      etat: "signé" as Etat,
      tonalite: "ok" as Tonalite,
      aLabel: euros(budgetLot > 0 ? budgetLot : engage),
      aTonalite: "mute" as Tonalite,
    };
  }

  const expires = actifs.filter((d) => norm(d.STATUT) === "expire");
  if (actifs.length > 0 && expires.length === actifs.length) {
    return {
      etat: "expirés" as Etat,
      tonalite: "warn" as Tonalite,
      aLabel: `${actifs.length} devis`,
      aTonalite: "mute" as Tonalite,
    };
  }
  if (actifs.length > 0) {
    return {
      etat: "à choisir" as Etat,
      tonalite: "warn" as Tonalite,
      aLabel: `${actifs.length} devis`,
      aTonalite: "mute" as Tonalite,
    };
  }
  return {
    etat: "budget estimé" as Etat,
    tonalite: "mute" as Tonalite,
    aLabel: budgetLot > 0 ? euros(budgetLot) : "budget non renseigné",
    aTonalite: "mute" as Tonalite,
  };
}

/** La deuxième ligne d'un lot : qui l'exécute et ce qui a été facturé, ou à
 * défaut ce qu'il reste à trancher — jamais une ligne vide. */
function calculerSousLigne(etat: Etat, devisDuLot: Devis[], entreprise: string, facture: number) {
  if (etat === "dépassement" || etat === "sous le budget" || etat === "signé") {
    const primaire = entreprise || "Entreprise non renseignée";
    const secondaire = facture > 0.01 ? `${euros(facture)} facturés` : null;
    return { primaire, secondaire };
  }
  if (etat === "expirés") {
    const expire = devisDuLot.find((d) => norm(d.STATUT) === "expire");
    return { primaire: expire?.ENTREPRISE || "Entreprise non renseignée", secondaire: null };
  }
  if (etat === "à choisir") {
    const actifs = devisDuLot.filter((d) => !STATUTS_HORS_SCENARIO.has(norm(d.STATUT)));
    const montants = actifs.map((d) => d.TTC).sort((a, b) => a - b);
    if (montants.length > 1) {
      return { primaire: `${euros(montants[0])} à ${euros(montants[montants.length - 1])}`, secondaire: null };
    }
    if (montants.length === 1) {
      return { primaire: euros(montants[0]), secondaire: null };
    }
  }
  return { primaire: "Aucun devis reçu", secondaire: null };
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
      const entreprise = resolveEntrepriseForLot(lot.LOT_UUID, devis).nom;

      const { etat, tonalite, aLabel, aTonalite } = calculerEtatLot(devisDuLot, engage, lot.BUDGET_TTC);
      const { primaire: l2Primaire, secondaire: l2Secondaire } = calculerSousLigne(etat, devisDuLot, entreprise, facture);

      return {
        lotUuid: lot.LOT_UUID,
        nom: lot.NOM,
        perimetre: lot.PERIMETRE,
        budget: lot.BUDGET_TTC,
        engage,
        facture,
        paye,
        entreprise,
        nbDevis: devisDuLot.length,
        etat,
        etatTonalite: tonalite,
        aLabel,
        aTonalite,
        l2Primaire,
        l2Secondaire,
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
