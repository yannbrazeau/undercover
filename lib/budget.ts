// Calculs de l'écran Budget — pur, sans dépendance réseau, testable seul.

import { round2 } from "./facture";
import { etatDecennale, type EtatDecennale } from "./decennale";
import { norm } from "./format";
import { devisEngage, devisCompteScenario, engageLot, factureCumulLot } from "./sheets";
import type { Lot, Devis, Avenant, Facture, Paiement, Entreprise, ProjetParams } from "./types";

export type SourceDepense = "signé" | "retenu" | "estimé";

export type LotDepense = {
  lotUuid: string;
  nom: string;
  montant: number;
  source: SourceDepense;
};

/**
 * Dépense prévue d'un lot — la meilleure information connue, dans l'ordre :
 * devis signé (+ avenants) > devis retenu non signé > budget du lot.
 * Un lot sans devis ne coûtera pas zéro : c'est la règle qui empêche l'écran
 * de mentir en affichant une marge confortable pendant que des lots entiers
 * n'ont encore aucun chiffrage.
 */
export function depensePrevueLot(lot: Lot, devis: Devis[], avenants: Avenant[]): LotDepense {
  const lotDevis = devis.filter((d) => d.LOT_UUID === lot.LOT_UUID);

  const signe = lotDevis.find(devisEngage);
  if (signe) {
    const montant = engageLot(lot.LOT_UUID, devis, avenants);
    return { lotUuid: lot.LOT_UUID, nom: lot.NOM, montant, source: "signé" };
  }

  const retenu = lotDevis.find((d) => norm(d.STATUT) === "retenu" || norm(d.RETENU) === "oui");
  if (retenu) {
    return { lotUuid: lot.LOT_UUID, nom: lot.NOM, montant: round2(retenu.TTC), source: "retenu" };
  }

  return { lotUuid: lot.LOT_UUID, nom: lot.NOM, montant: round2(lot.BUDGET_TTC), source: "estimé" };
}

export type LotASurveiller = {
  lotUuid: string;
  nom: string;
  entreprise: string;
  engage: number;
  facture: number;
  ecart: number;
};

export type EntrepriseDecennaleAlerte = {
  entrepriseId: string;
  nom: string;
  etat: EtatDecennale;
};

export type BudgetSummary = {
  budgetContractuel: number;
  depensePrevue: number;
  ilVousReste: number;
  engageTotal: number;
  retenuTotal: number;
  estimeTotal: number;
  paye: number;
  aSurveiller: LotASurveiller[];
  decennaleAReclamer: EntrepriseDecennaleAlerte[];
  decennaleSousReserve: EntrepriseDecennaleAlerte[];
  rappelOuvertureChantier: boolean;
  rappelDommagesOuvrage: boolean;
  devisExpiresCount: number;
  retenueGarantieEnCours: number;
};

export type BudgetInput = {
  lots: Lot[];
  devis: Devis[];
  avenants: Avenant[];
  factures: Facture[];
  paiements: Paiement[];
  entreprises: Entreprise[];
  projet: ProjetParams;
  aujourdHui: Date; // passée en paramètre pour rester testable
};

export function computeBudget(input: BudgetInput): BudgetSummary {
  const { lots, devis, avenants, factures, paiements, entreprises, projet, aujourdHui } = input;
  const lotsActifs = lots.filter((l) => norm(l.ACTIF) === "oui");

  const depenses = lotsActifs.map((l) => depensePrevueLot(l, devis, avenants));
  const engageTotal = round2(depenses.filter((d) => d.source === "signé").reduce((s, d) => s + d.montant, 0));
  const retenuTotal = round2(depenses.filter((d) => d.source === "retenu").reduce((s, d) => s + d.montant, 0));
  const estimeTotal = round2(depenses.filter((d) => d.source === "estimé").reduce((s, d) => s + d.montant, 0));
  const depensePrevue = round2(engageTotal + retenuTotal + estimeTotal);
  const ilVousReste = round2(projet.budgetContractuel - depensePrevue);

  const paye = round2(paiements.reduce((s, p) => s + p.MONTANT, 0));

  const aSurveiller: LotASurveiller[] = [];
  for (const lot of lotsActifs) {
    const engage = engageLot(lot.LOT_UUID, devis, avenants);
    if (engage <= 0) continue; // rien à comparer sans marché signé
    const facture = factureCumulLot(lot.LOT_UUID, factures);
    const ecart = round2(facture - engage);
    if (ecart <= 0.01) continue;
    const entreprise = devis.find((d) => d.LOT_UUID === lot.LOT_UUID && devisEngage(d))?.ENTREPRISE || "";
    aSurveiller.push({ lotUuid: lot.LOT_UUID, nom: lot.NOM, entreprise, engage, facture, ecart });
  }
  aSurveiller.sort((a, b) => b.ecart - a.ecart);

  // Décennale : entreprises dont un devis compte dans le scénario (retenu ou
  // signé) et qui ne sont pas « valide ». L'attestation se réclame avant la
  // signature ; une entreprise sans devis en lice n'apparaît pas.
  const vues = new Set<string>();
  const decennaleAReclamer: EntrepriseDecennaleAlerte[] = [];
  const decennaleSousReserve: EntrepriseDecennaleAlerte[] = [];
  for (const d of devis) {
    if (!devisCompteScenario(d)) continue;
    if (!d.ENTREPRISE_ID || vues.has(d.ENTREPRISE_ID)) continue;
    const ent = entreprises.find((e) => e.ENTREPRISE_ID === d.ENTREPRISE_ID);
    const etat = etatDecennale(ent?.DECENNALE_DEBUT, ent?.DECENNALE_FIN, projet.dateOuvertureChantier, aujourdHui);
    if (etat === "valide") continue;
    vues.add(d.ENTREPRISE_ID);
    const item = { entrepriseId: d.ENTREPRISE_ID, nom: ent?.NOM || d.ENTREPRISE, etat };
    if (etat === "valide sous réserve") decennaleSousReserve.push(item);
    else decennaleAReclamer.push(item);
  }

  const devisExpiresCount = devis.filter((d) => norm(d.STATUT) === "expire").length;
  const retenueGarantieEnCours = round2(factures.reduce((s, f) => s + f.RETENUE_GARANTIE, 0));

  return {
    budgetContractuel: round2(projet.budgetContractuel),
    depensePrevue,
    ilVousReste,
    engageTotal,
    retenuTotal,
    estimeTotal,
    paye,
    aSurveiller,
    decennaleAReclamer,
    decennaleSousReserve,
    rappelOuvertureChantier: !projet.dateOuvertureChantier,
    rappelDommagesOuvrage: !projet.doSouscrite && !projet.dateOuvertureChantier,
    devisExpiresCount,
    retenueGarantieEnCours,
  };
}
