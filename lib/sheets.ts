// Lecture et écriture du Google Sheet. Le classeur est la seule source de vérité.

import { sheetsClient } from "./google";
import { config } from "./config";
import { norm, parseNum, euros } from "./format";
import { computeFacture, nextId, round2 } from "./facture";
import { etatDecennale } from "./decennale";
import {
  TAB,
  STATUT_DEVIS,
  type Lot,
  type Devis,
  type Entreprise,
  type Facture,
  type Avenant,
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
    LOT: String(r.LOT ?? ""),
    ENTREPRISE_ID: String(r.ENTREPRISE_ID ?? ""),
    ENTREPRISE: String(r.ENTREPRISE ?? ""),
    TTC: parseNum(r.TTC),
    STATUT: String(r.STATUT ?? ""),
    DATE_SIGNATURE: String(r.DATE_SIGNATURE ?? ""),
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

export async function getAvenants(): Promise<Avenant[]> {
  const { rows } = await readTab(TAB.AVENANTS);
  return rows
    .filter((r) => !isExample(r))
    .filter((r) => String(r.AVENANT_ID ?? "") !== "")
    .map((r) => ({
      AVENANT_ID: String(r.AVENANT_ID ?? ""),
      LOT_UUID: String(r.LOT_UUID ?? ""),
      LOT: String(r.LOT ?? ""),
      ENTREPRISE_ID: String(r.ENTREPRISE_ID ?? ""),
      DESCRIPTION: String(r.DESCRIPTION ?? ""),
      MONTANT_TTC: parseNum(r.MONTANT_TTC),
      DATE: String(r.DATE ?? ""),
      VALIDE_PAR: String(r.VALIDE_PAR ?? ""),
      DRIVE_URL: String(r.DRIVE_URL ?? ""),
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

/** Engagé d'un lot : montant du devis signé, augmenté des avenants validés. Zéro si rien n'est signé. */
export function engageLot(lotUuid: string, devis: Devis[], avenants: Avenant[]): number {
  const signe = devis.find((d) => d.LOT_UUID === lotUuid && devisEngage(d));
  const base = signe ? signe.TTC : 0;
  const totalAvenants = avenants
    .filter((a) => a.LOT_UUID === lotUuid)
    .reduce((s, a) => s + a.MONTANT_TTC, 0);
  return round2(base + totalAvenants);
}

/** Cumul facturé d'un lot, en TTC — ce qui sort du compte en banque. */
export function factureCumulLot(lotUuid: string, factures: Facture[]): number {
  return round2(
    factures.filter((f) => f.LOT_UUID === lotUuid).reduce((s, f) => s + f.MONTANT_TTC, 0),
  );
}

export type AlerteDepassement = { engage: number; facture: number; ecart: number; message: string };

/**
 * Le garde-fou central : dès que le cumul facturé dépasse l'engagé (devis signé
 * + avenants), une alerte nommant l'entreprise, les deux montants et l'écart.
 * Se déclenche à la facture qui déborde, pas en fin de chantier.
 */
export function alerteDepassement(
  lotUuid: string,
  devis: Devis[],
  avenants: Avenant[],
  factures: Facture[],
): AlerteDepassement | null {
  const engage = engageLot(lotUuid, devis, avenants);
  const facture = factureCumulLot(lotUuid, factures);
  if (facture <= engage + 0.01) return null;

  const ecart = round2(facture - engage);
  const entreprise = devis.find((d) => d.LOT_UUID === lotUuid && devisEngage(d))?.ENTREPRISE || "L'entreprise";
  return {
    engage,
    facture,
    ecart,
    message: `${entreprise} a facturé ${euros(facture)} pour un marché de ${euros(engage)}. Écart de ${euros(ecart)} sans avenant validé.`,
  };
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

export type AddFactureResult = { facture: Record<string, unknown>; alerte: AlerteDepassement | null };

/** Enregistre une facture dans DATA_FACTURES — la fonction qui manquait. Tout en TTC. */
export async function addFacture(input: NewFacture): Promise<AddFactureResult> {
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

  // Le cumul facturé vient de changer : on vérifie tout de suite le dépassement.
  const [devisAJour, avenants, facturesAJour] = await Promise.all([
    getDevis(),
    getAvenants(),
    getFactures(),
  ]);
  const alerte = alerteDepassement(lot.LOT_UUID, devisAJour, avenants, facturesAJour);

  return { facture: row, alerte };
}

export type NewAvenant = {
  lotUuid: string;
  description: string;
  montantTTC: number; // positif ou négatif
  date: string; // JJ/MM/AAAA
  driveUrl?: string;
};

/** Enregistre un avenant — le seul moyen de faire évoluer l'engagé après signature. */
export async function addAvenant(input: NewAvenant): Promise<Record<string, unknown>> {
  const [{ headers, rows }, lots, devis] = await Promise.all([
    readTab(TAB.AVENANTS),
    getLots(),
    getDevis(),
  ]);

  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);
  if (!lot) throw new Error("Lot introuvable pour cet avenant.");

  const entreprise = resolveEntrepriseForLot(lot.LOT_UUID, devis);

  const row: Record<string, unknown> = {
    AVENANT_ID: nextId("AVE-", rows.map((r) => String(r.AVENANT_ID ?? ""))),
    LOT_UUID: lot.LOT_UUID,
    LOT: lot.NOM,
    ENTREPRISE_ID: entreprise.id,
    DESCRIPTION: input.description,
    MONTANT_TTC: input.montantTTC,
    DATE: input.date,
    VALIDE_PAR: "Yann",
    DRIVE_URL: input.driveUrl || "",
    COMMENTAIRE: "",
  };

  await appendRow(TAB.AVENANTS, headers, row);
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

export type SignDevisInput = {
  devisId: string;
  date: string; // JJ/MM/AAAA
  confirmerMalgreDecennale?: boolean;
};

export type SignDevisResult =
  | { requiresConfirmation: true; etatDecennale: string; entreprise: string }
  | {
      requiresConfirmation: false;
      devisId: string;
      lotUuid: string;
      ecartes: { devisId: string; entreprise: string }[];
    };

// Ce que DOIT être le devis qu'on signe, avant la signature.
const STATUTS_ELIGIBLES_SIGNATURE = [STATUT_DEVIS.RECU, STATUT_DEVIS.A_CORRIGER, STATUT_DEVIS.RETENU].map(
  norm,
);
// Ce qui bascule en écarté chez les AUTRES devis du lot — y compris un devis
// déjà signé, pour qu'une re-signature ne laisse jamais deux « signé » actifs.
const STATUTS_A_ECARTER = [...STATUTS_ELIGIBLES_SIGNATURE, norm(STATUT_DEVIS.SIGNE)];

/**
 * Signe un devis — le geste qui engage. Invariant appliqué ici, côté serveur :
 * un seul devis « signé » par lot. Les autres devis actifs du lot basculent en
 * « écarté », chacun avec une case ENTREPRISE_PREVENUE à cocher.
 *
 * Contrôle bloquant (mais jamais définitivement) : si l'entreprise n'a pas
 * d'attestation de décennale « valide », la fonction renvoie une demande de
 * confirmation au lieu d'écrire — sans le drapeau confirmerMalgreDecennale,
 * rien n'est modifié dans le classeur.
 */
export async function signDevis(input: SignDevisInput): Promise<SignDevisResult> {
  const [devisTable, entreprises, projet] = await Promise.all([
    readTab(TAB.DEVIS),
    getEntreprises(),
    getProjet(),
  ]);

  const idx = devisTable.rows.findIndex((r) => String(r.DEVIS_ID ?? "") === input.devisId);
  if (idx < 0) throw new Error("Devis introuvable.");

  const row = devisTable.rows[idx];
  const currentStatut = norm(String(row.STATUT ?? ""));
  if (!STATUTS_ELIGIBLES_SIGNATURE.includes(currentStatut)) {
    throw new Error(`Ce devis n'est plus disponible à la signature (statut actuel : ${row.STATUT}).`);
  }

  const lotUuid = String(row.LOT_UUID ?? "");
  const entrepriseId = String(row.ENTREPRISE_ID ?? "");
  const entreprise = entreprises.find((e) => e.ENTREPRISE_ID === entrepriseId);
  const nomEntreprise = entreprise?.NOM || String(row.ENTREPRISE ?? "");

  if (!input.confirmerMalgreDecennale) {
    const etat = etatDecennale(
      entreprise?.DECENNALE_DEBUT,
      entreprise?.DECENNALE_FIN,
      projet.dateOuvertureChantier,
      new Date(),
    );
    if (etat !== "valide") {
      return { requiresConfirmation: true, etatDecennale: etat, entreprise: nomEntreprise };
    }
  }

  const sheets = sheetsClient();
  const headers = devisTable.headers;
  const statutCol = headers.indexOf("STATUT");
  const dateCol = headers.indexOf("DATE_SIGNATURE");
  const sheetRow = idx + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config().spreadsheetId,
    range: `${TAB.DEVIS}!${colLetter(statutCol)}${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[STATUT_DEVIS.SIGNE]] },
  });
  if (dateCol >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.DEVIS}!${colLetter(dateCol)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[input.date]] },
    });
  }

  // Un seul devis signé par lot : les autres devis actifs du lot basculent en écarté.
  const ecartes: { devisId: string; entreprise: string }[] = [];
  for (let i = 0; i < devisTable.rows.length; i++) {
    if (i === idx) continue;
    const r = devisTable.rows[i];
    if (String(r.LOT_UUID ?? "") !== lotUuid) continue;
    if (!STATUTS_A_ECARTER.includes(norm(String(r.STATUT ?? "")))) continue;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.DEVIS}!${colLetter(statutCol)}${i + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[STATUT_DEVIS.ECARTE]] },
    });
    ecartes.push({ devisId: String(r.DEVIS_ID ?? ""), entreprise: String(r.ENTREPRISE ?? "") });
  }

  return { requiresConfirmation: false, devisId: input.devisId, lotUuid, ecartes };
}

/** Coche ENTREPRISE_PREVENUE une fois l'entreprise non retenue avertie. */
export async function marquerEntreprisePrevenue(devisId: string): Promise<void> {
  const { headers, rows } = await readTab(TAB.DEVIS);
  const idx = rows.findIndex((r) => String(r.DEVIS_ID ?? "") === devisId);
  if (idx < 0) throw new Error("Devis introuvable.");
  const col = headers.indexOf("ENTREPRISE_PREVENUE");
  if (col < 0) return;

  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: config().spreadsheetId,
    range: `${TAB.DEVIS}!${colLetter(col)}${idx + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [["oui"]] },
  });
}
