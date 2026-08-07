// Modèle de données — reflète les neuf onglets DATA_ du classeur.

export const TAB = {
  LOTS: "DATA_LOTS",
  DEVIS: "DATA_DEVIS",
  FACTURES: "DATA_FACTURES",
  PAIEMENTS: "DATA_PAIEMENTS",
  ENTREPRISES: "DATA_ENTREPRISES",
  AVENANTS: "DATA_AVENANTS",
  RESERVES: "DATA_RESERVES",
  COMPTES_RENDUS: "DATA_COMPTES_RENDUS",
  PROJET: "DATA_PROJET",
} as const;

export type Lot = {
  LOT_UUID: string;
  NOM: string;
  BUDGET_TTC: number;
  STATUT: string;
  RESPONSABLE: string;
  DRIVE_FOLDER_ID: string;
  ACTIF: string;
  PERIMETRE: string;
};

// Vocabulaire contrôlé de STATUT (source unique de vérité pour un devis).
export const STATUT_DEVIS = {
  RECU: "reçu",
  A_CORRIGER: "à corriger",
  REMPLACE: "remplacé",
  RETENU: "retenu",
  SIGNE: "signé",
  ECARTE: "écarté",
  EXPIRE: "expiré",
  ANNEXE: "annexe",
} as const;

export type Devis = {
  DEVIS_ID: string;
  LOT_UUID: string;
  ENTREPRISE_ID: string;
  ENTREPRISE: string;
  TTC: number;
  STATUT: string; // vocabulaire contrôlé (STATUT_DEVIS) — fait foi à lui seul
  REMPLACE: string; // DEVIS_ID de la version précédente (versionnage, jamais d'écrasement)
  ENTREPRISE_PREVENUE: string; // oui/non, une fois le devis écarté
  // Champs hérités — lus tant que le classeur n'est pas migré au nouveau modèle.
  RETENU?: string;
  SIGNE?: string;
};

export type Entreprise = {
  ENTREPRISE_ID: string;
  NOM: string;
  ACTIVITE: string;
  DECENNALE_DEBUT: string;
  DECENNALE_FIN: string;
  DECENNALE_ACTIVITES: string;
  DECENNALE_DRIVE_URL: string;
  ATTESTATION_TVA_REMISE: string; // oui/non — remise du CERFA, action unique, sans calcul
};

export type Facture = {
  FACTURE_ID: string;
  LOT_UUID: string;
  LOT: string;
  ENTREPRISE_ID: string;
  ENTREPRISE: string;
  NATURE: string;
  NUMERO: string;
  DATE: string;
  MONTANT_HT: number; // facultatif — archive uniquement, aucun calcul ne s'y appuie
  MONTANT_TTC: number;
  RETENUE_GARANTIE: number;
  NET_A_PAYER: number;
  STATUT: string;
  DATE_PAIEMENT: string;
  DRIVE_URL: string;
  COMMENTAIRE: string;
};

export type Paiement = {
  PAIEMENT_ID: string;
  FACTURE_ID: string;
  DATE: string;
  MONTANT: number;
  MOYEN: string;
  REFERENCE: string;
  COMMENTAIRE: string;
};

/** Paramètres de niveau projet (onglet clé/valeur DATA_PROJET). */
export type ProjetParams = {
  budgetContractuel: number;
  dateOuvertureChantier: string; // vide tant que non déclarée
  tauxRetenueGarantie: number;
};
