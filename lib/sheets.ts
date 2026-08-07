// Lecture et écriture du Google Sheet. Le classeur est la seule source de vérité.

import { sheetsClient } from "./google";
import { config } from "./config";
import { norm, parseNum } from "./format";
import { computeFacture, nextId, round2 } from "./facture";
import {
  TAB,
  type Lot,
  type Devis,
  type Entreprise,
  type Facture,
  type Paiement,
  type ProjetParams,
} from "./types";

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type Table = { headers: string[]; rows: Record<string, unknown>[] };

/** Lit un onglet entier et le transforme en objets (clé = en-tête de colonne). */
export async function readTab(tab: string): Promise<Table> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config().spreadsheetId,
    range: tab,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const headers = (values[0] ?? []).map((h) => String(h).trim());
  const rows = values.slice(1).map((r) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
  return { headers, rows };
}

/** Une ligne d'exemple (jaune) se reconnaît à « …EXEMPLE » dans une de ses cellules. */
function isExample(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => norm(v).includes("exemple"));
}

export async function getLots(): Promise<Lot[]> {
  const { rows } = await readTab(TAB.LOTS);
  return rows.map((r) => ({
    LOT_UUID: String(r.LOT_UUID ?? ""),
    NOM: String(r.NOM ?? ""),
    BUDGET_TTC: parseNum(r.BUDGET_TTC),
    STATUT: String(r.STATUT ?? ""),
    RESPONSABLE: String(r.RESPONSABLE ?? ""),
    DRIVE_FOLDER_ID: String(r.DRIVE_FOLDER_ID ?? ""),
    ACTIF: String(r.ACTIF ?? ""),
    PERIMETRE: String(r.PERIMETRE ?? ""),
  }));
}

export async function getDevis(): Promise<Devis[]> {
  const { rows } = await readTab(TAB.DEVIS);
  return rows.map((r) => ({
    DEVIS_ID: String(r.DEVIS_ID ?? ""),
    LOT_UUID: String(r.LOT_UUID ?? ""),
    ENTREPRISE_ID: String(r.ENTREPRISE_ID ?? ""),
    ENTREPRISE: String(r.ENTREPRISE ?? ""),
    TTC: parseNum(r.TTC),
    STATUT: String(r.STATUT ?? ""),
    REMPLACE: String(r.REMPLACE ?? ""),
    ENTREPRISE_PREVENUE: String(r.ENTREPRISE_PREVENUE ?? ""),
    RETENU: String(r.RETENU ?? ""),
    SIGNE: String(r.SIGNE ?? ""),
  }));
}

export async function getEntreprises(): Promise<Entreprise[]> {
  const { rows } = await readTab(TAB.ENTREPRISES);
  return rows.map((r) => ({
    ENTREPRISE_ID: String(r.ENTREPRISE_ID ?? ""),
    NOM: String(r.NOM ?? ""),
    ACTIVITE: String(r.ACTIVITE ?? ""),
    DECENNALE_DEBUT: String(r.DECENNALE_DEBUT ?? ""),
    DECENNALE_FIN: String(r.DECENNALE_FIN ?? ""),
    DECENNALE_ACTIVITES: String(r.DECENNALE_ACTIVITES ?? ""),
    DECENNALE_DRIVE_URL: String(r.DECENNALE_DRIVE_URL ?? ""),
    ATTESTATION_TVA_REMISE: String(r.ATTESTATION_TVA_REMISE ?? ""),
  }));
}

export async function getFactures(): Promise<Facture[]> {
  const { rows } = await readTab(TAB.FACTURES);
  return rows
    .filter((r) => !isExample(r))
    .filter((r) => String(r.FACTURE_ID ?? "") !== "")
    .map((r) => ({
      FACTURE_ID: String(r.FACTURE_ID ?? ""),
      LOT_UUID: String(r.LOT_UUID ?? ""),
      LOT: String(r.LOT ?? ""),
      ENTREPRISE_ID: String(r.ENTREPRISE_ID ?? ""),
      ENTREPRISE: String(r.ENTREPRISE ?? ""),
      NATURE: String(r.NATURE ?? ""),
      NUMERO: String(r.NUMERO ?? ""),
      DATE: String(r.DATE ?? ""),
      MONTANT_HT: parseNum(r.MONTANT_HT),
      MONTANT_TTC: parseNum(r.MONTANT_TTC),
      RETENUE_GARANTIE: parseNum(r.RETENUE_GARANTIE),
      NET_A_PAYER: parseNum(r.NET_A_PAYER),
      STATUT: String(r.STATUT ?? ""),
      DATE_PAIEMENT: String(r.DATE_PAIEMENT ?? ""),
      DRIVE_URL: String(r.DRIVE_URL ?? ""),
      COMMENTAIRE: String(r.COMMENTAIRE ?? ""),
    }));
}

export async function getPaiements(): Promise<Paiement[]> {
  const { rows } = await readTab(TAB.PAIEMENTS);
  return rows
    .filter((r) => !isExample(r))
    .filter((r) => String(r.PAIEMENT_ID ?? "") !== "")
    .map((r) => ({
      PAIEMENT_ID: String(r.PAIEMENT_ID ?? ""),
      FACTURE_ID: String(r.FACTURE_ID ?? ""),
      DATE: String(r.DATE ?? ""),
      MONTANT: parseNum(r.MONTANT),
      MOYEN: String(r.MOYEN ?? ""),
      REFERENCE: String(r.REFERENCE ?? ""),
      COMMENTAIRE: String(r.COMMENTAIRE ?? ""),
    }));
}

/** Lit l'onglet clé/valeur DATA_PROJET. */
export async function getProjet(): Promise<ProjetParams> {
  const { rows } = await readTab(TAB.PROJET);
  const map = new Map<string, string>();
  for (const r of rows) map.set(String(r.CLE ?? "").trim(), String(r.VALEUR ?? "").trim());
  const taux = parseNum(map.get("TAUX_RETENUE_GARANTIE"));
  return {
    budgetContractuel: parseNum(map.get("BUDGET_CONTRACTUEL_TTC")),
    dateOuvertureChantier: map.get("DATE_OUVERTURE_CHANTIER") ?? "",
    tauxRetenueGarantie: Number.isFinite(taux) ? taux : 0,
  };
}

// Sémantique du STATUT (source unique). Repli sur les anciennes colonnes
// RETENU/SIGNE tant que le classeur n'est pas migré au nouveau modèle.

/** Un devis « signé » engage le lot — c'est lui, plus les avenants, qui plafonne la facturation. */
export function devisEngage(d: Devis): boolean {
  return norm(d.STATUT) === "signe" || norm(d.SIGNE) === "oui";
}

/** Un devis « retenu » ou « signé » compte dans le scénario en cours. */
export function devisCompteScenario(d: Devis): boolean {
  const s = norm(d.STATUT);
  return s === "retenu" || s === "signe" || norm(d.RETENU) === "oui" || norm(d.SIGNE) === "oui";
}

/** L'entreprise qui exécute un lot : celle du devis signé, sinon retenu. */
export function resolveEntrepriseForLot(lotUuid: string, devis: Devis[]) {
  const lotDevis = devis.filter((d) => d.LOT_UUID === lotUuid);
  const chosen =
    lotDevis.find(devisEngage) ??
    lotDevis.find((d) => norm(d.STATUT) === "retenu" || norm(d.RETENU) === "oui");
  return { id: chosen?.ENTREPRISE_ID ?? "", nom: chosen?.ENTREPRISE ?? "" };
}

async function appendRow(tab: string, headers: string[], obj: Record<string, unknown>) {
  const sheets = sheetsClient();
  const row = headers.map((h) => obj[h] ?? "");
  await sheets.spreadsheets.values.append({
    spreadsheetId: config().spreadsheetId,
    range: tab,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export type NewFacture = {
  lotUuid: string;
  nature: string;
  montantTTC: number;
  tauxRetenue: number;
  numero?: string;
  date: string; // JJ/MM/AAAA
  driveUrl?: string;
  commentaire?: string;
};

/** Enregistre une facture dans DATA_FACTURES — la fonction qui manquait. Tout en TTC. */
export async function addFacture(input: NewFacture): Promise<Record<string, unknown>> {
  const [{ headers, rows }, lots, devis] = await Promise.all([
    readTab(TAB.FACTURES),
    getLots(),
    getDevis(),
  ]);

  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);
  if (!lot) throw new Error("Lot introuvable pour cette facture.");

  const entreprise = resolveEntrepriseForLot(lot.LOT_UUID, devis);
  const m = computeFacture({ montantTTC: input.montantTTC, tauxRetenue: input.tauxRetenue });

  const row: Record<string, unknown> = {
    FACTURE_ID: nextId("FAC-", rows.map((r) => String(r.FACTURE_ID ?? ""))),
    LOT_UUID: lot.LOT_UUID,
    LOT: lot.NOM,
    ENTREPRISE_ID: entreprise.id,
    ENTREPRISE: entreprise.nom,
    NATURE: input.nature,
    NUMERO: input.numero || "",
    DATE: input.date,
    MONTANT_HT: "", // facultatif — archive, non saisi
    MONTANT_TTC: m.montantTTC,
    RETENUE_GARANTIE: m.retenueGarantie,
    NET_A_PAYER: m.netAPayer,
    STATUT: "reçue",
    DATE_PAIEMENT: "",
    DRIVE_URL: input.driveUrl || "",
    COMMENTAIRE: input.commentaire || "",
  };

  await appendRow(TAB.FACTURES, headers, row);
  return row;
}

export type NewPaiement = {
  factureId: string;
  montant: number;
  date: string; // JJ/MM/AAAA
  moyen?: string;
  reference?: string;
  commentaire?: string;
};

export type PaiementResult = {
  paiement: Record<string, unknown>;
  statut: "payée" | "à payer";
  resteDu: number;
};

/**
 * Enregistre un paiement — toujours un geste explicite, avec date et montant.
 * Rien n'est déduit d'un rapprochement automatique. Un paiement partiel laisse
 * la facture en « à payer » avec le reste dû ; le solde bascule en « payée ».
 */
export async function addPaiement(input: NewPaiement): Promise<PaiementResult> {
  const [{ headers: paiHeaders, rows: paiRows }, factTable, paiementsExistants] = await Promise.all([
    readTab(TAB.PAIEMENTS),
    readTab(TAB.FACTURES),
    getPaiements(),
  ]);

  const idx = factTable.rows.findIndex((r) => String(r.FACTURE_ID ?? "") === input.factureId);
  if (idx < 0) throw new Error("Facture introuvable.");

  const netAPayer = parseNum(factTable.rows[idx].NET_A_PAYER);
  const dejaPaye = paiementsExistants
    .filter((p) => p.FACTURE_ID === input.factureId)
    .reduce((s, p) => s + p.MONTANT, 0);

  const row: Record<string, unknown> = {
    PAIEMENT_ID: nextId("PAY-", paiRows.map((r) => String(r.PAIEMENT_ID ?? ""))),
    FACTURE_ID: input.factureId,
    DATE: input.date,
    MONTANT: input.montant,
    MOYEN: input.moyen || "",
    REFERENCE: input.reference || "",
    COMMENTAIRE: input.commentaire || "",
  };
  await appendRow(TAB.PAIEMENTS, paiHeaders, row);

  const resteDu = Math.max(0, round2(netAPayer - (dejaPaye + input.montant)));
  const statut: "payée" | "à payer" = resteDu <= 0.01 ? "payée" : "à payer";

  const sheets = sheetsClient();
  const statutCol = factTable.headers.indexOf("STATUT");
  const dateCol = factTable.headers.indexOf("DATE_PAIEMENT");
  const sheetRow = idx + 2;

  if (statutCol >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.FACTURES}!${colLetter(statutCol)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[statut]] },
    });
  }
  if (dateCol >= 0 && statut === "payée") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.FACTURES}!${colLetter(dateCol)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[input.date]] },
    });
  }

  return { paiement: row, statut, resteDu };
}
