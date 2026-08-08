// Tests contre les valeurs de contrôle du chantier réel (onglet LISEZ-MOI /
// cahier de conception §12) : budget 629 850, dépense prévue 686 556,01,
// écart -56 706,01, engagé 2 800. Tant qu'ils ne passent pas, rien ne part
// en production. Lancer : npx tsx lib/budget.test.ts
//
// Les lots et devis viennent de lib/fixtures.ts — la même référence du
// classeur réel que le mode fixtures utilisé pour les captures Playwright
// (§12), pour qu'un seul jeu de données serve de vérité aux deux.

import { computeBudget } from "./budget";
import { FIXTURE_LOTS, FIXTURE_DEVIS, FIXTURE_AVENANTS, FIXTURE_FACTURES, FIXTURE_PAIEMENTS, FIXTURE_ENTREPRISES } from "./fixtures";
import type { ProjetParams } from "./types";

let pass = 0;
let fail = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL ${label}: attendu ${expected}, obtenu ${actual}`);
  }
}

const PROJET: ProjetParams = {
  budgetContractuel: 629850,
  dateOuvertureChantier: "",
  tauxRetenueGarantie: 5,
  doSouscrite: false,
  maitreOeuvre: "HMP",
  decennaleHmpValidite: "",
};

const budget = computeBudget({
  lots: FIXTURE_LOTS,
  devis: FIXTURE_DEVIS,
  avenants: FIXTURE_AVENANTS,
  factures: FIXTURE_FACTURES,
  paiements: FIXTURE_PAIEMENTS,
  entreprises: FIXTURE_ENTREPRISES,
  projet: PROJET,
  aujourdHui: new Date(2026, 7, 8),
});

assertEqual(budget.budgetContractuel, 629850, "budget contractuel");
assertEqual(budget.engageTotal, 2800, "engagé (devis signés)");
assertEqual(budget.retenuTotal, 378406.01, "retenu (devis choisis, non signés)");
assertEqual(budget.estimeTotal, 305350, "estimé (lots sans devis)");
assertEqual(budget.depensePrevue, 686556.01, "dépense prévue");
assertEqual(budget.ilVousReste, -56706.01, "écart au budget (il reste)");
assertEqual(budget.paye, 0, "payé — aucune facture ni paiement réels");
assertEqual(budget.devisExpiresCount, 3, "devis expirés (DEV-013, DEV-014, DEV-021)");
assertEqual(budget.retenueGarantieEnCours, 0, "retenue de garantie — aucune facture réelle");

console.log(`${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
