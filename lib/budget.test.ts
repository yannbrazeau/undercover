// Tests contre les valeurs de contrôle du chantier réel (onglet LISEZ-MOI /
// cahier de conception §12) : budget 629 850, dépense prévue 686 556,01,
// écart -56 706,01, engagé 2 800. Tant qu'ils ne passent pas, rien ne part
// en production. Lancer : npx tsx lib/budget.test.ts
//
// Les lots et devis ci-dessous sont ceux du classeur réel, à l'état attendu
// après nettoyage des données de test (voir /api/admin/nettoyer-donnees-test) :
// seul DEV-001 est signé, DEV-002/006/016 sont revenus à leur statut d'avant
// les essais de signature (retenu / reçu / retenu), aucune facture ni paiement.

import { computeBudget } from "./budget";
import type { Lot, Devis, Avenant, Facture, Paiement, Entreprise, ProjetParams } from "./types";

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

function lot(nom: string, uuid: string, budget: number): Lot {
  return {
    LOT_UUID: uuid,
    NOM: nom,
    BUDGET_TTC: budget,
    STATUT: "",
    RESPONSABLE: "",
    DRIVE_FOLDER_ID: "",
    ACTIF: "oui",
    DEBUT_PREVU: "",
    FIN_PREVUE: "",
    AVANCEMENT_PCT: 0,
    PERIMETRE: "",
  };
}

function devis(id: string, lotUuid: string, ttc: number, statut: string): Devis {
  return {
    DEVIS_ID: id,
    LOT_UUID: lotUuid,
    LOT: "",
    ENTREPRISE_ID: "",
    ENTREPRISE: "",
    TTC: ttc,
    STATUT: statut,
    DATE_SIGNATURE: "",
    REMPLACE: "",
    ENTREPRISE_PREVENUE: "",
    DRIVE_URL: "",
  };
}

// Lots actifs réels du chantier — somme des budgets = 629 850,00 €.
const LOTS: Lot[] = [
  lot("Architecte / PC", "a9108942", 0),
  lot("Gros œuvre / maçonnerie", "f761a99b", 90000),
  lot("Menuiseries / ouvertures", "b7016df4", 85000),
  lot("Façades", "50bc0228", 20000),
  lot("Plâtrerie / isolation", "65741d05", 50000),
  lot("Électricité", "7026fcc2", 22500),
  lot("Plomberie", "6c553fd3", 28000),
  lot("Chauffage / PAC", "edb534d5", 25000),
  lot("Chape liquide", "202227d6", 6500),
  lot("Carrelage / faïence", "3da152ea", 55000),
  lot("Peinture", "a56a6230", 22500),
  lot("Extérieurs / divers", "06d3f78a", 0),
  lot("Terrassement", "c185883b", 5000),
  lot("Charpente", "b74be7a0", 30000),
  lot("Couverture", "b7834961", 50000),
  lot("Piscine", "c223d781", 30000),
  lot("Pergola", "2976f07b", 30000),
  lot("Cuisine", "6567c406", 30000),
  lot("Architecte paysager", "e8730f62", 0),
  lot("Paysagiste", "5a08addc", 0),
  lot("08 — Forage puit artésien", "4cff11f0", 0),
  lot("Honoraires HMP", "9c1e0a54", 50000),
  lot("Étude thermique", "3f8b6d21", 350),
];

// Devis réels, à l'état attendu après nettoyage (seul DEV-001 signé).
const DEVIS: Devis[] = [
  devis("DEV-001", "a9108942", 2800, "signé"),
  devis("DEV-002", "f761a99b", 115204.42, "retenu"),
  devis("DEV-003", "b7834961", 54794.87, "reçu"),
  devis("DEV-004", "b7834961", 48495.13, "reçu"),
  devis("DEV-005", "b7016df4", 88293.85, "reçu"),
  devis("DEV-006", "b7016df4", 99838.70, "reçu"),
  devis("DEV-007", "b7016df4", 143704.18, "reçu"),
  devis("DEV-008", "b7016df4", 120618.63, "reçu"),
  devis("DEV-009", "50bc0228", 15228.91, "retenu"),
  devis("DEV-010", "65741d05", 61104.78, "retenu"),
  devis("DEV-011", "7026fcc2", 30758.84, "retenu"),
  devis("DEV-012", "6c553fd3", 25126.15, "retenu"),
  devis("DEV-013", "edb534d5", 24566.91, "expiré"),
  devis("DEV-014", "edb534d5", 25621.91, "expiré"),
  devis("DEV-015", "202227d6", 5742.38, "retenu"),
  devis("DEV-016", "3da152ea", 30276.29, "retenu"),
  devis("DEV-017", "a56a6230", 44635.20, "retenu"),
  devis("DEV-018", "65741d05", 0, "annexe"),
  devis("DEV-019", "edb534d5", 31702.54, "remplacé"),
  devis("DEV-020", "", 7535.00, "reçu"),
  devis("DEV-021", "edb534d5", 32109.94, "expiré"),
  devis("DEV-022", "c223d781", 50329.04, "retenu"),
];

const AVENANTS: Avenant[] = [];
const FACTURES: Facture[] = [];
const PAIEMENTS: Paiement[] = [];
const ENTREPRISES: Entreprise[] = [];
const PROJET: ProjetParams = {
  budgetContractuel: 629850,
  dateOuvertureChantier: "",
  tauxRetenueGarantie: 5,
  doSouscrite: false,
};

const budget = computeBudget({
  lots: LOTS,
  devis: DEVIS,
  avenants: AVENANTS,
  factures: FACTURES,
  paiements: PAIEMENTS,
  entreprises: ENTREPRISES,
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

console.log(`${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
