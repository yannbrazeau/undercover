// Lecture et écriture du Google Sheet. Le classeur est la seule source de vérité.

import { randomUUID } from "crypto";
import { sheetsClient } from "./google";
import { config, isFixtureMode } from "./config";
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
  type Reserve,
  type ProjetParams,
} from "./types";
import {
  FIXTURE_LOTS,
  FIXTURE_DEVIS,
  FIXTURE_AVENANTS,
  FIXTURE_FACTURES,
  FIXTURE_PAIEMENTS,
  FIXTURE_ENTREPRISES,
  FIXTURE_PROJET,
} from "./fixtures";

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

/**
 * En mode fixtures (PILOTAGE_FIXTURES=1), les onglets sont servis depuis les
 * données de référence du chantier réel plutôt que depuis Google Sheets —
 * ce qui permet de figer les sept écrans pour les captures Playwright (§12)
 * sans connexion. Aucune écriture n'est prise en charge dans ce mode.
 */
function fixtureTab(tab: string): Table {
  const rows: Record<string, Record<string, unknown>[]> = {
    [TAB.LOTS]: FIXTURE_LOTS as unknown as Record<string, unknown>[],
    [TAB.DEVIS]: FIXTURE_DEVIS as unknown as Record<string, unknown>[],
    [TAB.AVENANTS]: FIXTURE_AVENANTS as unknown as Record<string, unknown>[],
    [TAB.FACTURES]: FIXTURE_FACTURES as unknown as Record<string, unknown>[],
    [TAB.PAIEMENTS]: FIXTURE_PAIEMENTS as unknown as Record<string, unknown>[],
    [TAB.ENTREPRISES]: FIXTURE_ENTREPRISES as unknown as Record<string, unknown>[],
    [TAB.PROJET]: Object.entries(FIXTURE_PROJET).map(([CLE, VALEUR]) => ({ CLE, VALEUR })),
  };
  return { headers: [], rows: rows[tab] ?? [] };
}

/** Lit un onglet entier et le transforme en objets (clé = en-tête de colonne). */
export async function readTab(tab: string): Promise<Table> {
  if (isFixtureMode()) return fixtureTab(tab);

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
    DEBUT_PREVU: String(r.DEBUT_PREVU ?? ""),
    FIN_PREVUE: String(r.FIN_PREVUE ?? ""),
    AVANCEMENT_PCT: parseNum(r.AVANCEMENT_PCT),
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
    DATE_ANNULATION: String(r.DATE_ANNULATION ?? ""),
    REMPLACE: String(r.REMPLACE ?? ""),
    ENTREPRISE_PREVENUE: String(r.ENTREPRISE_PREVENUE ?? ""),
    DRIVE_URL: String(r.DRIVE_URL ?? ""),
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
    DECENNALE_ASSUREUR: String(r.DECENNALE_ASSUREUR ?? ""),
    DECENNALE_DEBUT: String(r.DECENNALE_DEBUT ?? ""),
    DECENNALE_FIN: String(r.DECENNALE_FIN ?? ""),
    DECENNALE_ACTIVITES: String(r.DECENNALE_ACTIVITES ?? ""),
    DECENNALE_DRIVE_URL: String(r.DECENNALE_DRIVE_URL ?? ""),
    ATTESTATION_TVA_REMISE: String(r.ATTESTATION_TVA_REMISE ?? ""),
    SIRET: String(r.SIRET ?? ""),
    CONTACT: String(r.CONTACT ?? ""),
    DRIVE_FOLDER_ID: String(r.DRIVE_FOLDER_ID ?? ""),
  }));
}

export type NewAttestationDecennale = {
  entrepriseId: string;
  assureur?: string;
  debut: string; // JJ/MM/AAAA
  fin: string; // JJ/MM/AAAA
  activites?: string;
  driveUrl?: string;
};

/** Enregistre l'attestation décennale d'une entreprise déjà répertoriée. */
export async function enregistrerAttestationDecennale(input: NewAttestationDecennale): Promise<void> {
  const { headers, rows } = await readTab(TAB.ENTREPRISES);
  const idx = rows.findIndex((r) => String(r.ENTREPRISE_ID ?? "") === input.entrepriseId);
  if (idx < 0) throw new Error("Entreprise introuvable.");

  const sheets = sheetsClient();
  const sheetRow = idx + 2;
  const writes: [string, string][] = [
    ["DECENNALE_DEBUT", input.debut],
    ["DECENNALE_FIN", input.fin],
  ];
  if (input.assureur !== undefined) writes.push(["DECENNALE_ASSUREUR", input.assureur]);
  if (input.activites !== undefined) writes.push(["DECENNALE_ACTIVITES", input.activites]);
  if (input.driveUrl) writes.push(["DECENNALE_DRIVE_URL", input.driveUrl]);

  for (const [colName, value] of writes) {
    const c = headers.indexOf(colName);
    if (c < 0) continue;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.ENTREPRISES}!${colLetter(c)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
  }
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
      DATE_ANNULATION: String(r.DATE_ANNULATION ?? ""),
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
      STATUT: String(r.STATUT ?? ""),
      DATE_ANNULATION: String(r.DATE_ANNULATION ?? ""),
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
      STATUT: String(r.STATUT ?? ""),
      DATE_ANNULATION: String(r.DATE_ANNULATION ?? ""),
    }));
}

export async function getReserves(): Promise<Reserve[]> {
  const { rows } = await readTab(TAB.RESERVES);
  return rows
    .filter((r) => !isExample(r))
    .filter((r) => String(r.RESERVE_ID ?? "") !== "")
    .map((r) => ({
      RESERVE_ID: String(r.RESERVE_ID ?? ""),
      LOT_UUID: String(r.LOT_UUID ?? ""),
      LOT: String(r.LOT ?? ""),
      DESCRIPTION: String(r.DESCRIPTION ?? ""),
      DATE: String(r.DATE ?? ""),
      STATUT: String(r.STATUT ?? ""),
      DATE_LEVEE: String(r.DATE_LEVEE ?? ""),
      DRIVE_URL: String(r.DRIVE_URL ?? ""),
      COMMENTAIRE: String(r.COMMENTAIRE ?? ""),
    }));
}

export type NewReserve = {
  lotUuid: string;
  description: string;
  date: string; // JJ/MM/AAAA
  driveUrl?: string;
};

/** Enregistre une réserve — une malfaçon constatée, photographiée, à lever plus tard. */
export async function addReserve(input: NewReserve): Promise<Record<string, unknown>> {
  const [{ headers, rows }, lots] = await Promise.all([readTab(TAB.RESERVES), getLots()]);
  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);
  if (!lot) throw new Error("Lot introuvable pour cette réserve.");

  const row: Record<string, unknown> = {
    RESERVE_ID: nextId("RES-", rows.map((r) => String(r.RESERVE_ID ?? ""))),
    LOT_UUID: lot.LOT_UUID,
    LOT: lot.NOM,
    DESCRIPTION: input.description,
    DATE: input.date,
    STATUT: "ouverte",
    DATE_LEVEE: "",
    DRIVE_URL: input.driveUrl || "",
    COMMENTAIRE: "",
  };

  await appendRow(TAB.RESERVES, headers, row);
  return row;
}

/** Lève une réserve : statut + date, jamais effacée — l'historique des malfaçons reste lisible. */
export async function cocherReserve(reserveId: string, date: string): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.RESERVES, "RESERVE_ID", reserveId, "Réserve");
  if (norm(String(row.STATUT ?? "")) === "levee") throw new Error("Cette réserve est déjà levée.");
  await ecrireCellules(TAB.RESERVES, headers, sheetRow, [
    ["STATUT", "levée"],
    ["DATE_LEVEE", date],
  ]);
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
    doSouscrite: norm(map.get("DO_SOUSCRITE")) === "oui",
    doAssureur: map.get("DO_ASSUREUR") ?? "",
    doDateEffet: map.get("DO_DATE_EFFET") ?? "",
    doDocumentUrl: map.get("DO_DOCUMENT_URL") ?? "",
    maitreOeuvre: map.get("MAITRE_OEUVRE") ?? "",
  };
}

/** Met à jour (ou crée) une ou plusieurs paires clé/valeur de DATA_PROJET. */
export async function updateProjetKeys(pairs: Record<string, string>): Promise<void> {
  const { headers, rows } = await readTab(TAB.PROJET);
  const cleCol = headers.indexOf("CLE");
  const valeurCol = headers.indexOf("VALEUR");
  if (cleCol < 0 || valeurCol < 0) throw new Error("Colonnes CLE/VALEUR introuvables dans DATA_PROJET.");

  const sheets = sheetsClient();
  for (const [cle, valeur] of Object.entries(pairs)) {
    const idx = rows.findIndex((r) => String(r.CLE ?? "").trim() === cle);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config().spreadsheetId,
        range: `${TAB.PROJET}!${colLetter(valeurCol)}${idx + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[valeur]] },
      });
    } else {
      await appendRow(TAB.PROJET, headers, { CLE: cle, VALEUR: valeur });
    }
  }
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

/** Total du scénario en cours : somme des devis retenus ou signés, tous lots confondus. */
export function scenarioTotal(devis: Devis[]): number {
  return round2(devis.filter(devisCompteScenario).reduce((s, d) => s + d.TTC, 0));
}

/** L'entreprise qui exécute un lot : celle du devis signé, sinon retenu. */
export function resolveEntrepriseForLot(lotUuid: string, devis: Devis[]) {
  const lotDevis = devis.filter((d) => d.LOT_UUID === lotUuid);
  const chosen =
    lotDevis.find(devisEngage) ??
    lotDevis.find((d) => norm(d.STATUT) === "retenu" || norm(d.RETENU) === "oui");
  return { id: chosen?.ENTREPRISE_ID ?? "", nom: chosen?.ENTREPRISE ?? "" };
}

// Une écriture annulée passe en statut « annulé », jamais effacée — elle
// reste visible pour l'historique mais sort de tous les calculs. Ces trois
// prédicats sont le seul endroit qui décide de « compte encore ou pas »,
// pour que chaque moteur de calcul (engageLot, factureCumulLot, budget)
// applique exactement la même règle.
export function avenantActif(a: Avenant): boolean {
  return norm(a.STATUT) !== "annule";
}
export function factureActive(f: Facture): boolean {
  return norm(f.STATUT) !== "annulee";
}
export function paiementActif(p: Paiement): boolean {
  return norm(p.STATUT) !== "annule";
}

/** Engagé d'un lot : montant du devis signé, augmenté des avenants validés. Zéro si rien n'est signé. */
export function engageLot(lotUuid: string, devis: Devis[], avenants: Avenant[]): number {
  const signe = devis.find((d) => d.LOT_UUID === lotUuid && devisEngage(d));
  const base = signe ? signe.TTC : 0;
  const totalAvenants = avenants
    .filter((a) => a.LOT_UUID === lotUuid && avenantActif(a))
    .reduce((s, a) => s + a.MONTANT_TTC, 0);
  return round2(base + totalAvenants);
}

/** Cumul facturé d'un lot, en TTC — ce qui sort du compte en banque. */
export function factureCumulLot(lotUuid: string, factures: Facture[]): number {
  return round2(
    factures.filter((f) => f.LOT_UUID === lotUuid && factureActive(f)).reduce((s, f) => s + f.MONTANT_TTC, 0),
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
    message: `${entreprise} a facturé ${euros(facture)} pour un devis signé de ${euros(engage)}. Écart de ${euros(ecart)} sans avenant validé.`,
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

/**
 * Garantit que chaque colonne demandée existe dans l'onglet, en l'ajoutant
 * en fin de ligne d'en-têtes au besoin. Modifier et annuler des écritures
 * demande des colonnes (STATUT, DATE_ANNULATION) que d'anciens onglets ne
 * portent pas encore — plutôt que d'exiger un bricolage manuel du classeur
 * avant de pouvoir utiliser la fonctionnalité, la route qui en a besoin la
 * crée elle-même, une seule fois. Renvoie les en-têtes à jour.
 */
async function assurerColonnes(tab: string, headers: string[], noms: string[]): Promise<string[]> {
  const manquantes = noms.filter((n) => !headers.includes(n));
  if (manquantes.length === 0) return headers;
  const sheets = sheetsClient();
  const nouveauxHeaders = [...headers];
  for (const nom of manquantes) {
    const col = nouveauxHeaders.length;
    nouveauxHeaders.push(nom);
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${tab}!${colLetter(col)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[nom]] },
    });
  }
  return nouveauxHeaders;
}

/** Retrouve une ligne par son identifiant, ou lève une erreur lisible. */
async function trouverLigne(tab: string, idCol: string, idVal: string, label: string) {
  const { headers, rows } = await readTab(tab);
  const idx = rows.findIndex((r) => String(r[idCol] ?? "") === idVal);
  if (idx < 0) throw new Error(`${label} introuvable.`);
  return { headers, rows, idx, sheetRow: idx + 2, row: rows[idx] };
}

/** Écrit plusieurs cellules d'une même ligne, par nom de colonne. */
async function ecrireCellules(
  tab: string,
  headers: string[],
  sheetRow: number,
  updates: [string, unknown][],
): Promise<void> {
  const sheets = sheetsClient();
  for (const [colName, value] of updates) {
    const c = headers.indexOf(colName);
    if (c < 0) throw new Error(`Colonne ${colName} introuvable dans ${tab}.`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${tab}!${colLetter(c)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
  }
}

export type NewLot = {
  nom: string;
  budgetTTC?: number;
  perimetre?: string;
  responsable?: string;
};

/** Crée un nouveau lot — apparaît aussitôt dans les écrans Budget et Lots. */
export async function creerLot(input: NewLot): Promise<Lot> {
  const { headers } = await readTab(TAB.LOTS);
  const lotUuid = randomUUID();

  const lot: Lot = {
    LOT_UUID: lotUuid,
    NOM: input.nom,
    BUDGET_TTC: input.budgetTTC ?? 0,
    STATUT: "Non lancé",
    RESPONSABLE: input.responsable || "",
    DRIVE_FOLDER_ID: "",
    ACTIF: "OUI",
    DEBUT_PREVU: "",
    FIN_PREVUE: "",
    AVANCEMENT_PCT: 0,
    PERIMETRE: input.perimetre || "",
  };

  await appendRow(TAB.LOTS, headers, {
    LOT_UUID: lot.LOT_UUID,
    NOM: lot.NOM,
    BUDGET_TTC: input.budgetTTC ?? "",
    STATUT: lot.STATUT,
    RESPONSABLE: lot.RESPONSABLE,
    DRIVE_FOLDER_ID: "",
    ACTIF: lot.ACTIF,
    DEBUT_PREVU: "",
    FIN_PREVUE: "",
    AVANCEMENT_PCT: 0,
    PERIMETRE: lot.PERIMETRE,
  });

  return lot;
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

/**
 * Modifie le montant TTC (et, avec lui, la retenue de garantie et le net à
 * payer, recalculés par le même moteur qu'à la création) d'une facture
 * active. Une facture annulée ne se modifie pas — on en crée une nouvelle.
 */
export async function modifierFacture(
  factureId: string,
  input: { montantTTC: number; tauxRetenue: number; nature?: string },
): Promise<{ montantTTC: number; retenueGarantie: number; netAPayer: number }> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.FACTURES, "FACTURE_ID", factureId, "Facture");
  if (norm(String(row.STATUT ?? "")) === "annulee") {
    throw new Error("Cette facture est annulée : impossible de la modifier.");
  }
  const m = computeFacture({ montantTTC: input.montantTTC, tauxRetenue: input.tauxRetenue });
  const updates: [string, unknown][] = [
    ["MONTANT_TTC", m.montantTTC],
    ["RETENUE_GARANTIE", m.retenueGarantie],
    ["NET_A_PAYER", m.netAPayer],
  ];
  if (input.nature !== undefined) updates.push(["NATURE", input.nature]);
  await ecrireCellules(TAB.FACTURES, headers, sheetRow, updates);
  return m;
}

/** Annule une facture : statut + date, la ligne reste, son montant sort de factureCumulLot(). */
export async function annulerFacture(factureId: string, date: string): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.FACTURES, "FACTURE_ID", factureId, "Facture");
  if (norm(String(row.STATUT ?? "")) === "annulee") throw new Error("Cette facture est déjà annulée.");
  const headersAJour = await assurerColonnes(TAB.FACTURES, headers, ["DATE_ANNULATION"]);
  await ecrireCellules(TAB.FACTURES, headersAJour, sheetRow, [
    ["STATUT", "annulée"],
    ["DATE_ANNULATION", date],
  ]);
}

export type NewDevis = {
  lotUuid: string;
  entrepriseId: string;
  ttc: number;
  driveUrl?: string;
};

/** Enregistre un devis reçu — le point de départ du cycle comparer → choisir → signer. */
export async function addDevis(input: NewDevis): Promise<Record<string, unknown>> {
  const [{ headers, rows }, lots, entreprises] = await Promise.all([
    readTab(TAB.DEVIS),
    getLots(),
    getEntreprises(),
  ]);

  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);
  if (!lot) throw new Error("Lot introuvable pour ce devis.");
  const entreprise = entreprises.find((e) => e.ENTREPRISE_ID === input.entrepriseId);
  if (!entreprise) throw new Error("Entreprise introuvable pour ce devis.");

  const row: Record<string, unknown> = {
    DEVIS_ID: nextId("DEV-", rows.map((r) => String(r.DEVIS_ID ?? ""))),
    LOT_UUID: lot.LOT_UUID,
    LOT: lot.NOM,
    ENTREPRISE_ID: entreprise.ENTREPRISE_ID,
    ENTREPRISE: entreprise.NOM,
    TTC: input.ttc,
    STATUT: STATUT_DEVIS.RECU,
    DATE_SIGNATURE: "",
    REMPLACE: "",
    ENTREPRISE_PREVENUE: "",
    DRIVE_URL: input.driveUrl || "",
  };

  await appendRow(TAB.DEVIS, headers, row);
  return row;
}

export type NewDevisRemplacant = {
  remplaceDevisId: string;
  lotUuid: string;
  entrepriseId: string;
  entreprise: string;
  ttc: number;
  statut: string; // reprend le statut du devis remplacé, plutôt que "reçu"
  dateSignature: string;
  driveUrl: string;
};

/**
 * Enregistre un devis qui en remplace un autre déjà en lice (montant erroné,
 * variante retenue plus tard…) — jamais un écrasement en place. Utilisée
 * pour les corrections ponctuelles (ex. /api/admin/corriger-ave-001) où le
 * nouveau devis doit reprendre le statut et la date de signature de celui
 * qu'il remplace plutôt que de repartir de zéro.
 */
export async function appendDevisRemplacant(input: NewDevisRemplacant): Promise<Record<string, unknown>> {
  const [{ headers, rows }, lots] = await Promise.all([readTab(TAB.DEVIS), getLots()]);
  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);

  const row: Record<string, unknown> = {
    DEVIS_ID: nextId("DEV-", rows.map((r) => String(r.DEVIS_ID ?? ""))),
    LOT_UUID: input.lotUuid,
    LOT: lot?.NOM ?? "",
    ENTREPRISE_ID: input.entrepriseId,
    ENTREPRISE: input.entreprise,
    TTC: input.ttc,
    STATUT: input.statut,
    DATE_SIGNATURE: input.dateSignature,
    REMPLACE: input.remplaceDevisId,
    ENTREPRISE_PREVENUE: "",
    DRIVE_URL: input.driveUrl || "",
  };

  await appendRow(TAB.DEVIS, headers, row);
  return row;
}

/** Bascule un devis en « remplacé » — pour les migrations ponctuelles (voir appendDevisRemplacant). */
export async function marquerDevisRemplace(devisId: string): Promise<void> {
  const { headers, sheetRow } = await trouverLigne(TAB.DEVIS, "DEVIS_ID", devisId, "Devis");
  await ecrireCellules(TAB.DEVIS, headers, sheetRow, [["STATUT", STATUT_DEVIS.REMPLACE]]);
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
  const [{ headers, rows }, lots, devis, avenants] = await Promise.all([
    readTab(TAB.AVENANTS),
    getLots(),
    getDevis(),
    getAvenants(),
  ]);

  const lot = lots.find((l) => l.LOT_UUID === input.lotUuid);
  if (!lot) throw new Error("Lot introuvable pour cet avenant.");

  // Un avenant fait évoluer un engagement — il ne peut pas en créer un.
  // Vérifié ici, pas seulement dans le formulaire : la route doit refuser
  // même si l'écran a été contourné.
  if (engageLot(lot.LOT_UUID, devis, avenants) <= 0) {
    throw new Error("Ce lot n'a pas de devis signé : impossible d'ajouter un avenant.");
  }

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

/** Modifie la description ou le montant d'un avenant actif — jamais un annulé. */
export async function modifierAvenant(
  avenantId: string,
  input: { description?: string; montantTTC?: number },
): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.AVENANTS, "AVENANT_ID", avenantId, "Avenant");
  if (norm(String(row.STATUT ?? "")) === "annule") {
    throw new Error("Cet avenant est annulé : impossible de le modifier.");
  }
  const updates: [string, unknown][] = [];
  if (input.description !== undefined) updates.push(["DESCRIPTION", input.description]);
  if (input.montantTTC !== undefined) updates.push(["MONTANT_TTC", input.montantTTC]);
  if (updates.length === 0) return;
  await ecrireCellules(TAB.AVENANTS, headers, sheetRow, updates);
}

/** Annule un avenant : statut + date, la ligne reste, son montant sort d'engageLot(). */
export async function annulerAvenant(avenantId: string, date: string): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.AVENANTS, "AVENANT_ID", avenantId, "Avenant");
  if (norm(String(row.STATUT ?? "")) === "annule") throw new Error("Cet avenant est déjà annulé.");
  const headersAJour = await assurerColonnes(TAB.AVENANTS, headers, ["STATUT", "DATE_ANNULATION"]);
  await ecrireCellules(TAB.AVENANTS, headersAJour, sheetRow, [
    ["STATUT", "annulé"],
    ["DATE_ANNULATION", date],
  ]);
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
    .filter((p) => p.FACTURE_ID === input.factureId && paiementActif(p))
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

/** Remet le statut d'une facture en cohérence avec ses paiements actifs. */
async function reevaluerStatutFacture(factureId: string): Promise<void> {
  const [factTable, paiements] = await Promise.all([readTab(TAB.FACTURES), getPaiements()]);
  const idx = factTable.rows.findIndex((r) => String(r.FACTURE_ID ?? "") === factureId);
  if (idx < 0) return;
  if (norm(String(factTable.rows[idx].STATUT ?? "")) === "annulee") return; // une facture annulée ne se rouvre pas toute seule
  const netAPayer = parseNum(factTable.rows[idx].NET_A_PAYER);
  const paye = paiements
    .filter((p) => p.FACTURE_ID === factureId && paiementActif(p))
    .reduce((s, p) => s + p.MONTANT, 0);
  const resteDu = Math.max(0, round2(netAPayer - paye));
  const statut: "payée" | "à payer" = resteDu <= 0.01 ? "payée" : "à payer";
  await ecrireCellules(TAB.FACTURES, factTable.headers, idx + 2, [["STATUT", statut]]);
}

/** Modifie un paiement actif — recalcule aussitôt le statut de sa facture. */
export async function modifierPaiement(
  paiementId: string,
  input: { montant?: number; moyen?: string; reference?: string },
): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.PAIEMENTS, "PAIEMENT_ID", paiementId, "Paiement");
  if (norm(String(row.STATUT ?? "")) === "annule") {
    throw new Error("Ce paiement est annulé : impossible de le modifier.");
  }
  const updates: [string, unknown][] = [];
  if (input.montant !== undefined) updates.push(["MONTANT", input.montant]);
  if (input.moyen !== undefined) updates.push(["MOYEN", input.moyen]);
  if (input.reference !== undefined) updates.push(["REFERENCE", input.reference]);
  if (updates.length === 0) return;
  await ecrireCellules(TAB.PAIEMENTS, headers, sheetRow, updates);
  if (input.montant !== undefined) {
    const factureId = String(row.FACTURE_ID ?? "");
    if (factureId) await reevaluerStatutFacture(factureId);
  }
}

/**
 * Annule un paiement : statut + date, jamais effacé. Rouvre aussitôt la
 * facture si ce paiement l'avait soldée — sinon elle resterait « payée »
 * en apparence alors qu'il reste de l'argent dû.
 */
export async function annulerPaiement(paiementId: string, date: string): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.PAIEMENTS, "PAIEMENT_ID", paiementId, "Paiement");
  if (norm(String(row.STATUT ?? "")) === "annule") throw new Error("Ce paiement est déjà annulé.");
  const headersAJour = await assurerColonnes(TAB.PAIEMENTS, headers, ["STATUT", "DATE_ANNULATION"]);
  await ecrireCellules(TAB.PAIEMENTS, headersAJour, sheetRow, [
    ["STATUT", "annulé"],
    ["DATE_ANNULATION", date],
  ]);
  const factureId = String(row.FACTURE_ID ?? "");
  if (factureId) await reevaluerStatutFacture(factureId);
}

export type SignDevisInput = {
  devisId: string;
  date: string; // JJ/MM/AAAA
  confirmerMalgreDecennale?: boolean;
  driveUrl?: string; // le devis signé, joint au moment de la signature
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
  const driveUrlCol = headers.indexOf("DRIVE_URL");
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
  if (driveUrlCol >= 0 && input.driveUrl) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.DEVIS}!${colLetter(driveUrlCol)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[input.driveUrl]] },
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

export type ChoisirDevisResult = {
  devisId: string;
  lotUuid: string;
  ecartes: { devisId: string; entreprise: string }[];
};

// Un devis « reçu » ou « à corriger » peut être retenu — l'arbitrage, avant l'engagement.
const STATUTS_ELIGIBLES_CHOIX = [STATUT_DEVIS.RECU, STATUT_DEVIS.A_CORRIGER].map(norm);
// Choisir un devis écarte les autres candidats du même lot — un seul retenu à la fois,
// pour que le scénario budgétaire ne compte jamais deux devis concurrents du même lot.
const STATUTS_A_ECARTER_AU_CHOIX = [...STATUTS_ELIGIBLES_CHOIX, norm(STATUT_DEVIS.RETENU)];

/**
 * Retient un devis parmi ceux reçus pour un lot — comparer, puis choisir, avant de
 * signer. Compte aussitôt dans le scénario budgétaire (voir devisCompteScenario),
 * sans encore engager le lot : c'est signDevis qui engage. Aucun contrôle de
 * décennale ici, il n'intervient qu'à la signature.
 */
export async function choisirDevis(devisId: string): Promise<ChoisirDevisResult> {
  const devisTable = await readTab(TAB.DEVIS);
  const idx = devisTable.rows.findIndex((r) => String(r.DEVIS_ID ?? "") === devisId);
  if (idx < 0) throw new Error("Devis introuvable.");

  const row = devisTable.rows[idx];
  const currentStatut = norm(String(row.STATUT ?? ""));
  if (!STATUTS_ELIGIBLES_CHOIX.includes(currentStatut)) {
    throw new Error(`Ce devis n'est plus disponible au choix (statut actuel : ${row.STATUT}).`);
  }

  const lotUuid = String(row.LOT_UUID ?? "");
  const sheets = sheetsClient();
  const headers = devisTable.headers;
  const statutCol = headers.indexOf("STATUT");
  const sheetRow = idx + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config().spreadsheetId,
    range: `${TAB.DEVIS}!${colLetter(statutCol)}${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[STATUT_DEVIS.RETENU]] },
  });

  const ecartes: { devisId: string; entreprise: string }[] = [];
  for (let i = 0; i < devisTable.rows.length; i++) {
    if (i === idx) continue;
    const r = devisTable.rows[i];
    if (String(r.LOT_UUID ?? "") !== lotUuid) continue;
    if (!STATUTS_A_ECARTER_AU_CHOIX.includes(norm(String(r.STATUT ?? "")))) continue;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.DEVIS}!${colLetter(statutCol)}${i + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[STATUT_DEVIS.ECARTE]] },
    });
    ecartes.push({ devisId: String(r.DEVIS_ID ?? ""), entreprise: String(r.ENTREPRISE ?? "") });
  }

  return { devisId, lotUuid, ecartes };
}

/**
 * Modifie le montant TTC d'un devis pas encore signé. Un devis signé engage
 * déjà le budget du lot : le modifier en place changerait ce chiffre sans
 * le geste explicite d'une nouvelle signature — on enregistre un nouveau
 * devis à la place, relié par REMPLACE (voir addDevis).
 */
export async function modifierDevis(devisId: string, ttc: number): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.DEVIS, "DEVIS_ID", devisId, "Devis");
  const statutActuel = norm(String(row.STATUT ?? ""));
  if (statutActuel === "signe") {
    throw new Error("Un devis signé ne se modifie pas : enregistrez un nouveau devis en remplacement.");
  }
  if (statutActuel === "annule") throw new Error("Ce devis est annulé : impossible de le modifier.");
  await ecrireCellules(TAB.DEVIS, headers, sheetRow, [["TTC", ttc]]);
}

/** Annule un devis non signé : statut + date, jamais un devis déjà engagé. */
export async function annulerDevis(devisId: string, date: string): Promise<void> {
  const { headers, sheetRow, row } = await trouverLigne(TAB.DEVIS, "DEVIS_ID", devisId, "Devis");
  const statutActuel = norm(String(row.STATUT ?? ""));
  if (statutActuel === "signe") {
    throw new Error("Un devis signé ne s'annule pas : enregistrez un nouveau devis en remplacement.");
  }
  if (statutActuel === "annule") throw new Error("Ce devis est déjà annulé.");
  const headersAJour = await assurerColonnes(TAB.DEVIS, headers, ["DATE_ANNULATION"]);
  await ecrireCellules(TAB.DEVIS, headersAJour, sheetRow, [
    ["STATUT", STATUT_DEVIS.ANNULE],
    ["DATE_ANNULATION", date],
  ]);
}

export type LotPlanningInput = {
  debutPrevu?: string; // JJ/MM/AAAA
  finPrevue?: string; // JJ/MM/AAAA
  avancementPct?: number;
};

/** Met à jour les trois champs de planning d'un lot (fiche du lot). */
export async function updateLotPlanning(lotUuid: string, input: LotPlanningInput): Promise<void> {
  const { headers, rows } = await readTab(TAB.LOTS);
  const idx = rows.findIndex((r) => String(r.LOT_UUID ?? "") === lotUuid);
  if (idx < 0) throw new Error("Lot introuvable.");

  const sheets = sheetsClient();
  const sheetRow = idx + 2;
  const writes: { col: string; value: string | number }[] = [];

  if (input.debutPrevu !== undefined) {
    const col = headers.indexOf("DEBUT_PREVU");
    if (col >= 0) writes.push({ col: colLetter(col), value: input.debutPrevu });
  }
  if (input.finPrevue !== undefined) {
    const col = headers.indexOf("FIN_PREVUE");
    if (col >= 0) writes.push({ col: colLetter(col), value: input.finPrevue });
  }
  if (input.avancementPct !== undefined) {
    const col = headers.indexOf("AVANCEMENT_PCT");
    if (col >= 0) writes.push({ col: colLetter(col), value: input.avancementPct });
  }

  for (const w of writes) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config().spreadsheetId,
      range: `${TAB.LOTS}!${w.col}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[w.value]] },
    });
  }
}

/** Suppression douce d'un lot : il disparaît de tous les écrans, la ligne reste tracée. */
export type SuppressionLot = { requiresConfirmation: true; engage: number } | { requiresConfirmation: false };

/**
 * Supprime (soft-delete) un lot. Si un devis signé y engage un budget, la
 * suppression n'est pas silencieuse : elle s'arrête et rend la main à
 * l'appelant pour une confirmation explicite — les devis/factures/avenants
 * existants ne sont jamais effacés, ils resteraient simplement rattachés à
 * un lot disparu.
 */
export async function supprimerLot(
  lotUuid: string,
  confirmerMalgreEngagement = false,
): Promise<SuppressionLot> {
  const [{ headers, rows }, devis, avenants] = await Promise.all([
    readTab(TAB.LOTS),
    getDevis(),
    getAvenants(),
  ]);
  const idx = rows.findIndex((r) => String(r.LOT_UUID ?? "") === lotUuid);
  if (idx < 0) throw new Error("Lot introuvable.");

  const engage = engageLot(lotUuid, devis, avenants);
  if (engage > 0 && !confirmerMalgreEngagement) {
    return { requiresConfirmation: true, engage };
  }

  const col = headers.indexOf("ACTIF");
  if (col < 0) throw new Error("Colonne ACTIF introuvable.");

  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: config().spreadsheetId,
    range: `${TAB.LOTS}!${colLetter(col)}${idx + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [["NON"]] },
  });
  return { requiresConfirmation: false };
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
