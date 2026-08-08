import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getAvenants, getDevis, annulerAvenant, engageLot, appendDevisRemplacant, marquerDevisRemplace } from "@/lib/sheets";
import { todayFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Correction ponctuelle demandée le 08/08/2026 : AVE-001 avait enregistré
// -16 € au lieu du montant réel du devis CI Construction. Plutôt que de
// changer un chiffre en place sur une écriture déjà enregistrée (ce que le
// cahier interdit désormais), on annule AVE-001 — il reste visible, daté —
// et on remplace DEV-002 par un nouveau devis à 98 477,87 € TTC, relié par
// REMPLACE, qui prend le relais de DEV-002 (même statut, même date de
// signature, même entreprise) pendant que DEV-002 bascule en « remplacé ».
// Rien n'est écrasé : DEV-002 et AVE-001 restent lisibles dans leur état
// d'origine, seulement sortis du calcul.
//
// Non rejouable une fois appliquée : si un devis remplace déjà DEV-002, la
// route le signale et ne touche à rien.

const MONTANT_CORRIGE = 98477.87;

export async function GET(req: Request) {
  try {
    requireConfigured();
    const url = new URL(req.url);
    const confirmer = url.searchParams.get("confirmer") === "oui";

    const [avenants, devis] = await Promise.all([getAvenants(), getDevis()]);

    const ave001 = avenants.find((a) => a.AVENANT_ID === "AVE-001");
    if (!ave001) throw new AppError("AVE-001 introuvable — rien à corriger.", 404);

    const dev002 = devis.find((d) => d.DEVIS_ID === "DEV-002");
    if (!dev002) throw new AppError("DEV-002 introuvable — rien à corriger.", 404);

    const dejaCorrige = devis.find((d) => d.REMPLACE === "DEV-002");
    if (dejaCorrige) {
      return NextResponse.json({
        aFaire: `Déjà corrigé : ${dejaCorrige.DEVIS_ID} remplace déjà DEV-002. Rien n'est rejoué.`,
      });
    }

    const engageAvant = engageLot(dev002.LOT_UUID, devis, avenants);

    if (!confirmer) {
      return NextResponse.json({
        aFaire: "Rien n'a été écrit. Ajoutez ?confirmer=oui à l'adresse pour appliquer la correction.",
        prevu: {
          "1_annulerAvenant": { id: "AVE-001", montantActuel: ave001.MONTANT_TTC },
          "2_nouveauDevis": {
            lotUuid: dev002.LOT_UUID,
            entreprise: dev002.ENTREPRISE,
            ttc: MONTANT_CORRIGE,
            remplace: "DEV-002",
            statutRepris: dev002.STATUT,
          },
          "3_devis002": { nouveauStatut: "remplacé" },
          engageDuLotAvant: engageAvant,
        },
      });
    }

    await annulerAvenant("AVE-001", todayFr());
    const devisCree = await appendDevisRemplacant({
      remplaceDevisId: "DEV-002",
      lotUuid: dev002.LOT_UUID,
      entrepriseId: dev002.ENTREPRISE_ID,
      entreprise: dev002.ENTREPRISE,
      ttc: MONTANT_CORRIGE,
      statut: dev002.STATUT,
      dateSignature: dev002.DATE_SIGNATURE,
      driveUrl: dev002.DRIVE_URL,
    });
    await marquerDevisRemplace("DEV-002");

    const [avenantsApres, devisApres] = await Promise.all([getAvenants(), getDevis()]);
    const engageApres = engageLot(dev002.LOT_UUID, devisApres, avenantsApres);

    return NextResponse.json({
      applique: true,
      avenantAnnule: "AVE-001",
      devisCree: devisCree.DEVIS_ID,
      devisRemplace: "DEV-002",
      engageDuLotAvant: engageAvant,
      engageDuLotApres: engageApres,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
