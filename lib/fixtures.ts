// Données de référence du chantier réel, à l'état attendu après nettoyage
// des données de test (seul DEV-001 signé — voir /api/admin/nettoyer-donnees-test).
// Utilisées à deux endroits : les assertions de lib/budget.test.ts contre les
// valeurs de contrôle du classeur, et le mode fixtures de lib/sheets.ts qui
// alimente les captures Playwright (§12 du cahier) sans connexion Google —
// une seule source, pour que la référence visuelle ne dérive jamais des
// chiffres réellement vérifiés.

import type { Lot, Devis, Avenant, Facture, Paiement, Entreprise } from "./types";

function lot(nom: string, uuid: string, budget: number, extra: Partial<Lot> = {}): Lot {
  return {
    LOT_UUID: uuid,
    NOM: nom,
    BUDGET_TTC: budget,
    STATUT: "",
    RESPONSABLE: "",
    DRIVE_FOLDER_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
    ACTIF: "oui",
    DEBUT_PREVU: "",
    FIN_PREVUE: "",
    AVANCEMENT_PCT: 0,
    PERIMETRE: "",
    ...extra,
  };
}

function devis(id: string, lotUuid: string, ttc: number, statut: string, extra: Partial<Devis> = {}): Devis {
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
    ...extra,
  };
}

// Lots actifs réels du chantier — somme des budgets = 629 850,00 €.
// Trois lots portent des dates de planning (les vingt autres n'en ont pas
// encore) : c'est la vue Chronologie telle qu'elle se présente aujourd'hui.
export const FIXTURE_LOTS: Lot[] = [
  lot("Architecte / PC", "a9108942", 0, { PERIMETRE: "Conception, permis de construire" }),
  lot("Gros œuvre / maçonnerie", "f761a99b", 90000, {
    PERIMETRE: "Démolition, structure, maçonnerie",
    DEBUT_PREVU: "01/10/2026",
    FIN_PREVUE: "15/12/2026",
    AVANCEMENT_PCT: 30,
  }),
  lot("Menuiseries / ouvertures", "b7016df4", 85000, { PERIMETRE: "Fenêtres, portes, volets" }),
  lot("Façades", "50bc0228", 20000, { PERIMETRE: "Ravalement, enduits" }),
  lot("Plâtrerie / isolation", "65741d05", 50000, { PERIMETRE: "Cloisons, isolation intérieure" }),
  lot("Électricité", "7026fcc2", 22500, { PERIMETRE: "Installation électrique complète" }),
  lot("Plomberie", "6c553fd3", 28000, { PERIMETRE: "Alimentation, évacuation, sanitaires" }),
  lot("Chauffage / PAC", "edb534d5", 25000, { PERIMETRE: "Pompe à chaleur, émetteurs" }),
  lot("Chape liquide", "202227d6", 6500, { PERIMETRE: "Chape fluide sur l'ensemble du rez-de-chaussée" }),
  lot("Carrelage / faïence", "3da152ea", 55000, { PERIMETRE: "Sols et murs, toutes pièces" }),
  lot("Peinture", "a56a6230", 22500, { PERIMETRE: "Finitions intérieures" }),
  lot("Extérieurs / divers", "06d3f78a", 0, { PERIMETRE: "Aménagements extérieurs divers" }),
  lot("Terrassement", "c185883b", 5000, {
    PERIMETRE: "Décaissement, nivellement",
    DEBUT_PREVU: "01/09/2026",
    FIN_PREVUE: "30/09/2026",
  }),
  lot("Charpente", "b74be7a0", 30000, {
    PERIMETRE: "Charpente traditionnelle",
    DEBUT_PREVU: "16/12/2026",
    FIN_PREVUE: "31/01/2027",
  }),
  lot("Couverture", "b7834961", 50000, { PERIMETRE: "Tuiles, zinguerie" }),
  lot("Piscine", "c223d781", 30000, { PERIMETRE: "Bassin et équipements" }),
  lot("Pergola", "2976f07b", 30000, { PERIMETRE: "Structure bois, couverture" }),
  lot("Cuisine", "6567c406", 30000, { PERIMETRE: "Cuisine équipée" }),
  lot("Architecte paysager", "e8730f62", 0, { PERIMETRE: "Conception des extérieurs" }),
  lot("Paysagiste", "5a08addc", 0, { PERIMETRE: "Réalisation des extérieurs" }),
  lot("08 — Forage puit artésien", "4cff11f0", 0, { PERIMETRE: "Forage et équipement du puits" }),
  lot("Honoraires HMP", "9c1e0a54", 50000, { PERIMETRE: "Maîtrise d'œuvre" }),
  lot("Étude thermique", "3f8b6d21", 350, { PERIMETRE: "Étude réglementaire RE2020" }),
];

// Devis réels, à l'état attendu après nettoyage (seul DEV-001 signé). Les
// entreprises portant un ENTREPRISE_ID sont celles dont le devis compte dans
// le scénario en cours (retenu ou signé) — ce sont elles dont l'attestation
// décennale doit être réclamée tant qu'aucune n'est enregistrée.
export const FIXTURE_DEVIS: Devis[] = [
  devis("DEV-001", "a9108942", 2800, "signé", { ENTREPRISE_ID: "ent-001", ENTREPRISE: "Cabinet Archipel" }),
  devis("DEV-002", "f761a99b", 115204.42, "retenu", { ENTREPRISE_ID: "ent-002", ENTREPRISE: "CI Construction" }),
  devis("DEV-003", "b7834961", 54794.87, "reçu", { ENTREPRISE: "Toitures Anjou" }),
  devis("DEV-004", "b7834961", 48495.13, "reçu", { ENTREPRISE: "Couverture Ligérienne" }),
  devis("DEV-005", "b7016df4", 88293.85, "reçu", { ENTREPRISE: "Menuiseries de l'Ouest" }),
  devis("DEV-006", "b7016df4", 99838.7, "reçu", { ENTREPRISE: "Fenêtrale 49" }),
  devis("DEV-007", "b7016df4", 143704.18, "reçu", { ENTREPRISE: "Alu Concept" }),
  devis("DEV-008", "b7016df4", 120618.63, "reçu", { ENTREPRISE: "Menuiseries Bouchemaine" }),
  devis("DEV-009", "50bc0228", 15228.91, "retenu", { ENTREPRISE_ID: "ent-003", ENTREPRISE: "Alliance Façades" }),
  devis("DEV-010", "65741d05", 61104.78, "retenu", { ENTREPRISE_ID: "ent-004", ENTREPRISE: "Batiplaf" }),
  devis("DEV-011", "7026fcc2", 30758.84, "retenu", { ENTREPRISE_ID: "ent-005", ENTREPRISE: "Elec Services 49" }),
  devis("DEV-012", "6c553fd3", 25126.15, "retenu", { ENTREPRISE_ID: "ent-006", ENTREPRISE: "Plomberie Bouchemaine" }),
  devis("DEV-013", "edb534d5", 24566.91, "expiré", { ENTREPRISE: "JCM Confort" }),
  devis("DEV-014", "edb534d5", 25621.91, "expiré", { ENTREPRISE: "JCM Confort" }),
  devis("DEV-015", "202227d6", 5742.38, "retenu", { ENTREPRISE_ID: "ent-007", ENTREPRISE: "Chape Anjou" }),
  devis("DEV-016", "3da152ea", 30276.29, "retenu", { ENTREPRISE_ID: "ent-008", ENTREPRISE: "Carro Design" }),
  devis("DEV-017", "a56a6230", 44635.2, "retenu", { ENTREPRISE_ID: "ent-009", ENTREPRISE: "Peinture Loire" }),
  devis("DEV-018", "65741d05", 0, "annexe"),
  devis("DEV-019", "edb534d5", 31702.54, "remplacé", { ENTREPRISE: "JCM Confort" }),
  devis("DEV-020", "", 7535.0, "reçu"),
  devis("DEV-021", "edb534d5", 32109.94, "expiré", { ENTREPRISE: "JCM Confort" }),
  devis("DEV-022", "c223d781", 50329.04, "retenu", { ENTREPRISE_ID: "ent-010", ENTREPRISE: "Piscines de l'Ouest" }),
];

export const FIXTURE_AVENANTS: Avenant[] = [];
export const FIXTURE_FACTURES: Facture[] = [];
export const FIXTURE_PAIEMENTS: Paiement[] = [];
export const FIXTURE_ENTREPRISES: Entreprise[] = [];

export const FIXTURE_PROJET: Record<string, string> = {
  BUDGET_CONTRACTUEL_TTC: "629850",
  DATE_OUVERTURE_CHANTIER: "",
  TAUX_RETENUE_GARANTIE: "5",
  DO_SOUSCRITE: "non",
  MAITRE_OEUVRE: "HMP",
  DECENNALE_HMP_VALIDITE: "31/12/2026",
};
