import { NextResponse } from "next/server";
import { requireConfigured, AppError, sheetsClient } from "@/lib/google";
import { config } from "@/lib/config";
import { TAB } from "@/lib/types";
import { readTab } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nettoyage ponctuel : les onglets DATA_FACTURES, DATA_PAIEMENTS, DATA_AVENANTS,
// DATA_RESERVES et DATA_COMPTES_RENDUS portent encore les lignes EXEMPLE
// d'origine et des lignes créées pendant les tests en direct (étapes 3/4/4 bis)
// — jamais nettoyées. DATA_DEVIS porte trois signatures de test (DEV-002,
// DEV-006, DEV-016) qui ont écarté d'autres devis par effet de bord.
//
// Idempotente : une ligne ou un statut déjà nettoyé est simplement ignoré.

const LIGNES_A_SUPPRIMER: { tab: string; idColonne: string; ids: string[] }[] = [
  { tab: TAB.FACTURES, idColonne: "FACTURE_ID", ids: ["FAC-EXEMPLE", "FAC-001", "FAC-002", "FAC-003", "FAC-004"] },
  { tab: TAB.PAIEMENTS, idColonne: "PAIEMENT_ID", ids: ["PAY-EXEMPLE", "PAY-001", "PAY-002", "PAY-003", "PAY-004"] },
  { tab: TAB.AVENANTS, idColonne: "AVENANT_ID", ids: ["AVE-EXEMPLE", "AVE-001", "AVE-002"] },
  { tab: TAB.RESERVES, idColonne: "RESERVE_ID", ids: ["RES-EXEMPLE"] },
  { tab: TAB.COMPTES_RENDUS, idColonne: "CR_ID", ids: ["CR-EXEMPLE"] },
];

// Devis à ramener à leur état d'avant les essais de signature.
const DEVIS_A_REVERTIR: { id: string; statut: string; clearDateSignature: boolean; clearEntreprisePrevenue: boolean }[] = [
  { id: "DEV-002", statut: "retenu", clearDateSignature: true, clearEntreprisePrevenue: false },
  { id: "DEV-006", statut: "reçu", clearDateSignature: true, clearEntreprisePrevenue: false },
  { id: "DEV-016", statut: "retenu", clearDateSignature: true, clearEntreprisePrevenue: false },
  { id: "DEV-005", statut: "reçu", clearDateSignature: false, clearEntreprisePrevenue: true },
  { id: "DEV-007", statut: "reçu", clearDateSignature: false, clearEntreprisePrevenue: true },
  { id: "DEV-008", statut: "reçu", clearDateSignature: false, clearEntreprisePrevenue: true },
];

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

export async function GET(req: Request) {
  try {
    requireConfigured();
    const url = new URL(req.url);
    if (url.searchParams.get("confirmer") !== "oui") {
      return NextResponse.json({
        aFaire: "Rien n'a été écrit. Ajoutez ?confirmer=oui à l'adresse pour lancer le nettoyage.",
      });
    }

    const sheets = sheetsClient();
    const spreadsheetId = config().spreadsheetId;

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const sheetIdByTitle = new Map<string, number>();
    for (const s of meta.data.sheets ?? []) {
      if (s.properties?.title && s.properties.sheetId != null) {
        sheetIdByTitle.set(s.properties.title, s.properties.sheetId);
      }
    }

    const rapport: Record<string, unknown> = {};

    // Suppression des lignes, triées du bas vers le haut par onglet pour ne
    // jamais décaler l'index d'une ligne pas encore supprimée.
    const requetesParFeuille = new Map<number, { deleteDimension: { range: { sheetId: number; dimension: string; startIndex: number; endIndex: number } } }[]>();

    for (const { tab, idColonne, ids } of LIGNES_A_SUPPRIMER) {
      const { rows } = await readTab(tab);
      const sheetId = sheetIdByTitle.get(tab);
      if (sheetId == null) continue;

      const supprimees: string[] = [];
      const indices: number[] = [];
      rows.forEach((r, idx) => {
        const val = String((r as Record<string, unknown>)[idColonne] ?? "");
        if (ids.includes(val)) {
          indices.push(idx);
          supprimees.push(val);
        }
      });
      rapport[tab] = { lignesSupprimees: supprimees };

      indices
        .sort((a, b) => b - a)
        .forEach((idx) => {
          const sheetRow0 = idx + 1; // +1 pour l'en-tête, 0-indexé
          const list = requetesParFeuille.get(sheetId) ?? [];
          list.push({
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: sheetRow0, endIndex: sheetRow0 + 1 },
            },
          });
          requetesParFeuille.set(sheetId, list);
        });
    }

    const toutesLesRequetes = Array.from(requetesParFeuille.values()).flat();
    if (toutesLesRequetes.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: toutesLesRequetes },
      });
    }

    // Retour des devis test-signés à leur état d'origine.
    const { headers, rows: devisRows } = await readTab(TAB.DEVIS);
    const statutCol = headers.indexOf("STATUT");
    const dateSignatureCol = headers.indexOf("DATE_SIGNATURE");
    const entreprisePrevenueCol = headers.indexOf("ENTREPRISE_PREVENUE");

    const devisRevertes: string[] = [];
    for (const regle of DEVIS_A_REVERTIR) {
      const idx = devisRows.findIndex((r) => String(r.DEVIS_ID ?? "") === regle.id);
      if (idx < 0) continue;
      const sheetRow = idx + 2;
      const currentStatut = String(devisRows[idx].STATUT ?? "");
      if (currentStatut === regle.statut) continue; // déjà revenu à l'état attendu

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${TAB.DEVIS}!${colLetter(statutCol)}${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[regle.statut]] },
      });
      if (regle.clearDateSignature && dateSignatureCol >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TAB.DEVIS}!${colLetter(dateSignatureCol)}${sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[""]] },
        });
      }
      if (regle.clearEntreprisePrevenue && entreprisePrevenueCol >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TAB.DEVIS}!${colLetter(entreprisePrevenueCol)}${sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[""]] },
        });
      }
      devisRevertes.push(`${regle.id} → ${regle.statut}`);
    }
    rapport[TAB.DEVIS] = { devisRevertes };

    return NextResponse.json({ ok: true, rapport });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
