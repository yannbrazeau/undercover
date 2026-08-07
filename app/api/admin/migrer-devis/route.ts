import { NextResponse } from "next/server";
import { requireConfigured, AppError, sheetsClient } from "@/lib/google";
import { config } from "@/lib/config";
import { TAB } from "@/lib/types";
import { getDevis, devisCompteScenario, devisEngage } from "@/lib/sheets";
import { round2 } from "@/lib/facture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Migration ponctuelle : le classeur en ligne portait encore l'ancien modèle
// de DATA_DEVIS (STATUT libre + RETENU + SIGNE + TAUX_TVA_CONSTATE +
// MONTANT_NEGOCIE), jamais réimporté depuis les deux refontes du cahier
// (STATUT unique, sortie de la TVA). Les données ci-dessous sont extraites
// mécaniquement du fichier source du dossier de travail — aucune retype à la
// main — et vérifiées : scénario 381 206,01 €, engagé 2 800,00 €.
//
// Idempotente : la relancer réécrit exactement les mêmes données.

const HEADER = [
  "DEVIS_ID",
  "LOT_UUID",
  "LOT",
  "ENTREPRISE_ID",
  "ENTREPRISE",
  "DOCUMENT",
  "DATE_DEVIS",
  "HT",
  "TVA",
  "TTC",
  "STATUT",
  "DATE_SIGNATURE",
  "REMPLACE",
  "ENTREPRISE_PREVENUE",
  "VALIDITE",
  "DRIVE_URL",
  "COMMENTAIRE",
];

const ROWS: (string | number)[][] = [
  ["DEV-001", "a9108942-4034-4882-8eba-d5a7b4b32ee3", "Architecte / PC", "ENT-01", "B.A. Architecture / D2PC", "Devis 2026032-BRAZEAU (1).pdf", "27/03/2026", 2800.0, "", 2800.0, "signé", "27/03/2026", "", "", "", "", ""],
  ["DEV-002", "f761a99b-5a12-4fac-9f02-e177bf4b0d95", "Gros œuvre / maçonnerie", "ENT-02", "CI Construction", "01 CI CONSTRUCTION.pdf", "07/07/2026", "", "", 115204.42, "retenu", "", "", "", "", "", "Périmètre mixte terrassement/maçonnerie à ventiler"],
  ["DEV-003", "b7834961-2440-49e4-a79e-109030242f1a", "Couverture", "ENT-03", "Rigaud – version principale", "03 RIGAUD.pdf", "28/06/2026", 45662.39, 9132.48, 54794.87, "reçu", "", "", "", "", "", "Ne pas cumuler avec DEV-004"],
  ["DEV-004", "b7834961-2440-49e4-a79e-109030242f1a", "Couverture", "ENT-03", "Rigaud – variante aluminium", "03 RIGAUD Variante alu.pdf", "28/06/2026", 40412.61, 8082.52, 48495.13, "reçu", "", "", "", "", "", "Ne pas cumuler avec DEV-003"],
  ["DEV-005", "b7016df4-7ec4-4377-86c8-643f8afc004e", "Menuiseries / ouvertures", "ENT-04", "DPS – variante DCd", "04 DPS n°D260601535DCd.pdf", "01/06/2026", 80932.49, 7361.36, 88293.85, "reçu", "", "", "", "", "", "Une seule variante DPS à retenir"],
  ["DEV-006", "b7016df4-7ec4-4377-86c8-643f8afc004e", "Menuiseries / ouvertures", "ENT-04", "DPS – variante DCc", "04 DPS n°D260601535DCc.pdf", "01/06/2026", 91501.77, 8336.93, 99838.7, "reçu", "", "", "", "", "", "Une seule variante DPS à retenir"],
  ["DEV-007", "b7016df4-7ec4-4377-86c8-643f8afc004e", "Menuiseries / ouvertures", "ENT-04", "DPS – variante 143704", "04 DPS 143704€ttc.pdf", "01/06/2026", 130113.68, 13590.5, 143704.18, "reçu", "", "", "", "", "", "Une seule variante DPS à retenir"],
  ["DEV-008", "b7016df4-7ec4-4377-86c8-643f8afc004e", "Menuiseries / ouvertures", "ENT-04", "DPS – variante 120618", "04 DPS 120618€ttc.pdf", "01/06/2026", 110875.72, 9742.91, 120618.63, "reçu", "", "", "", "", "", "Une seule variante DPS à retenir"],
  ["DEV-009", "50bc0228-b823-46aa-af0c-d43d73b609a9", "Façades", "ENT-05", "Alliance Façades", "05 ALLIANCE FACADES.pdf", "07/07/2026", 12690.76, 2538.15, 15228.91, "retenu", "", "", "", "", "", "Contradiction de périmètre à lever avec HMP"],
  ["DEV-010", "65741d05-195f-4251-b83b-68445d6866eb", "Plâtrerie / isolation", "ENT-06", "Batiplaf", "06 BATIPLAF.pdf", "06/07/2026", 55754.92, 5349.86, 61104.78, "retenu", "", "", "", "", "", ""],
  ["DEV-011", "7026fcc2-dd7d-4900-a924-de906edc52d8", "Électricité", "ENT-07", "Ribinet Électricité", "07 RIBINET ELECTRICITE.pdf", "07/07/2026", "", "", 30758.84, "retenu", "", "", "", "", "", ""],
  ["DEV-012", "6c553fd3-414b-4de4-987f-c9dbf88b770b", "Plomberie", "ENT-08", "Robinet Plomberie", "08 ROBINET PLOMBERIE.pdf", "07/07/2026", "", "", 25126.15, "retenu", "", "", "", "", "", ""],
  ["DEV-013", "edb534d5-395e-4020-bff8-6f0b8e2ed999", "Chauffage / PAC", "ENT-09", "JCM Confort – variante 1", "09 JCM 1.pdf", "07/07/2026", 22875.6, 1691.31, 24566.91, "expiré", "", "", "", "15/07/2026", "", "Validité dépassée"],
  ["DEV-014", "edb534d5-395e-4020-bff8-6f0b8e2ed999", "Chauffage / PAC", "ENT-09", "JCM Confort – variante 2", "09 JCM 2.pdf", "07/07/2026", 23875.6, 1746.31, 25621.91, "expiré", "", "", "", "15/07/2026", "", "Validité dépassée"],
  ["DEV-015", "202227d6-d04d-4cbe-b5bb-dbb1afe9cfb9", "Chape liquide", "ENT-10", "Anjou Chape", "10 ANJOU CHAPE.PDF", "03/06/2026", 5148.75, 593.63, 5742.38, "retenu", "", "", "", "03/12/2026", "", ""],
  ["DEV-016", "3da152ea-948b-43a1-a3a1-1f5f0d78eead", "Carrelage / faïence", "ENT-11", "Loire Carreaux", "11 LOIRE CARREAUX.pdf", "07/07/2026", 26854.11, 3422.18, 30276.29, "retenu", "", "", "", "", "", "Périmètre possiblement incomplet"],
  ["DEV-017", "a56a6230-fb9a-453a-9b9f-3cb168f3cfb7", "Peinture", "ENT-12", "Batinov", "13 BATINOV.pdf", "24/06/2026", 37196.0, 7439.2, 44635.2, "retenu", "", "", "", "", "", "TTC reconstitué des lignes — à confirmer"],
  ["DEV-018", "65741d05-195f-4251-b83b-68445d6866eb", "Plâtrerie / isolation", "ENT-06", "Batiplaf – plan", "06 BATIPLAF Plan.pdf", "06/07/2026", "", "", "", "annexe", "", "", "", "", "", "Plan, pas un devis"],
  ["DEV-019", "edb534d5-395e-4020-bff8-6f0b8e2ed999", "Chauffage / PAC", "ENT-09", "JCM – plancher RDC + gainable étage", "devis air eau + gainable Brazeau.pdf", "15/06/2026", 28561.4, 3141.14, 31702.54, "remplacé", "", "DEV-021", "", "15/07/2026", "", "Remplacé par DEV-021"],
  ["DEV-020", "", "Architecte intérieur", "ENT-13", "Chloé Billy", "Chloé Billy — Devis D-260186", "17/03/2026", 6850.0, 685.0, 7535.0, "reçu", "", "", "", "17/06/2026", "", "ATTENTION : aucun lot de ce nom n'existe"],
  ["DEV-021", "edb534d5-395e-4020-bff8-6f0b8e2ed999", "Chauffage / PAC", "ENT-09", "JCM Confort – v2 isolant extension", "JCM Confort — Devis 13045485 v2", "15/06/2026", 28771.4, 3338.54, 32109.94, "expiré", "", "", "", "15/07/2026", "", "Dernière version JCM"],
  ["DEV-022", "c223d781-0850-4137-93a4-9c6b4bf08347", "Piscine", "ENT-14", "REVA Piscines", "DV0012959 — REVA Piscines.pdf", "04/08/2026", 41940.87, 8388.17, 50329.04, "retenu", "", "", "", "", "", "LIGNE ABSENTE DE L'ONGLET ARBITRAGES — à confirmer"],
];

export async function GET(req: Request) {
  try {
    requireConfigured();
    const url = new URL(req.url);
    if (url.searchParams.get("confirmer") !== "oui") {
      return NextResponse.json({
        aFaire: "Rien n'a été écrit. Ajoutez ?confirmer=oui à l'adresse pour lancer la migration.",
      });
    }

    const sheets = sheetsClient();
    const spreadsheetId = config().spreadsheetId;

    // On efface une plage large pour ne laisser aucune colonne de l'ancien
    // modèle (TAUX_TVA_CONSTATE, RETENU, SIGNE, MONTANT_NEGOCIE) derrière soi.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${TAB.DEVIS}!A1:Z200`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB.DEVIS}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER, ...ROWS] },
    });

    const devis = await getDevis();
    const scenario = round2(devis.filter(devisCompteScenario).reduce((s, d) => s + d.TTC, 0));
    const engage = round2(devis.filter(devisEngage).reduce((s, d) => s + d.TTC, 0));

    return NextResponse.json({
      migre: true,
      lignes: devis.length,
      scenario,
      scenarioAttendu: 381206.01,
      engage,
      engageAttendu: 2800.0,
      ok: scenario === 381206.01 && engage === 2800.0,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
