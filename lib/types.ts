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
  TAUX_TVA: number;
  ATTESTATION_TVA: string;
  PERIMETRE: string;
};

export type Devis = {
  DEVIS_ID: string;
  LOT_UUID: string;
  ENTREPRISE_ID: string;
  ENTREPRISE: string;
  TTC: number;
  STATUT: string;
  RETENU: string;
  SIGNE: string;
};

export type Entreprise = {
  ENTREPRISE_ID: string;
  NOM: string;
  ACTIVITE: string;
  DECENNALE_DEBUT: string;
  DECENNALE_FIN: string;
  DECENNALE_ACTIVITES: string;
  DECENNALE_DRIVE_URL: string;
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
  MONTANT_HT: number;
  TAUX_TVA: number;
  MONTANT_TVA: number;
  MONTANT_TTC: number;
  RETENUE_GARANTIE: number;
  NET_A_PAYER: number;
  STATUT: string;
  DATE_PAIEMENT: string;
  DRIVE_URL: string;
  COMMENTAIRE: string;
};

/** Paramètres de niveau projet (onglet clé/valeur DATA_PROJET). */
export type ProjetParams = {
  budgetContractuel: number;
  dateOuvertureChantier: string; // vide tant que non déclarée
  tauxRetenueGarantie: number;
};
