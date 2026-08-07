import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import {
  getLots,
  getDevis,
  getAvenants,
  getFactures,
  getPaiements,
  getEntreprises,
  getProjet,
  engageLot,
  factureCumulLot,
} from "@/lib/sheets";
import { etatDecennale } from "@/lib/decennale";
import { round2 } from "@/lib/facture";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUTS_ELIGIBLES_SIGNATURE = ["reçu", "à corriger", "retenu"].map(norm);
const STATUTS_ELIGIBLES_CHOIX = ["reçu", "à corriger"].map(norm);

export async function GET(req: Request, { params }: { params: Promise<{ lotUuid: string }> }) {
  try {
    requireConfigured();
    const { lotUuid } = await params;

    const [lots, devis, avenants, factures, paiements, entreprises, projet] = await Promise.all([
      getLots(),
      getDevis(),
      getAvenants(),
      getFactures(),
      getPaiements(),
      getEntreprises(),
      getProjet(),
    ]);

    const lot = lots.find((l) => l.LOT_UUID === lotUuid);
    if (!lot) throw new AppError("Lot introuvable.", 404);

    const entrepriseById = new Map(entreprises.map((e) => [e.ENTREPRISE_ID, e]));
    const aujourdHui = new Date();

    const devisDuLot = devis
      .filter((d) => d.LOT_UUID === lotUuid)
      .map((d) => {
        const ent = entrepriseById.get(d.ENTREPRISE_ID);
        const decennale = ent
          ? etatDecennale(ent.DECENNALE_DEBUT, ent.DECENNALE_FIN, projet.dateOuvertureChantier, aujourdHui)
          : "à réclamer";
        return {
          id: d.DEVIS_ID,
          entreprise: d.ENTREPRISE,
          ttc: d.TTC,
          statut: d.STATUT,
          dateSignature: d.DATE_SIGNATURE,
          driveUrl: d.DRIVE_URL,
          decennale,
          entreprisePrevenue: norm(d.ENTREPRISE_PREVENUE) === "oui",
          eligibleSignature: STATUTS_ELIGIBLES_SIGNATURE.includes(norm(d.STATUT)),
          eligibleChoix: STATUTS_ELIGIBLES_CHOIX.includes(norm(d.STATUT)),
        };
      });

    const payeParFacture = new Map<string, number>();
    for (const p of paiements) {
      payeParFacture.set(p.FACTURE_ID, (payeParFacture.get(p.FACTURE_ID) ?? 0) + p.MONTANT);
    }

    const facturesDuLot = factures
      .filter((f) => f.LOT_UUID === lotUuid)
      .map((f) => {
        const paye = payeParFacture.get(f.FACTURE_ID) ?? 0;
        return {
          id: f.FACTURE_ID,
          nature: f.NATURE,
          numero: f.NUMERO,
          date: f.DATE,
          montantTTC: f.MONTANT_TTC,
          retenueGarantie: f.RETENUE_GARANTIE,
          netAPayer: f.NET_A_PAYER,
          statut: f.STATUT,
          resteDu: Math.max(0, round2(f.NET_A_PAYER - paye)),
          driveUrl: f.DRIVE_URL,
        };
      });

    const avenantsDuLot = avenants
      .filter((a) => a.LOT_UUID === lotUuid)
      .map((a) => ({
        id: a.AVENANT_ID,
        description: a.DESCRIPTION,
        montantTTC: a.MONTANT_TTC,
        date: a.DATE,
      }));

    const engage = engageLot(lotUuid, devis, avenants);
    const facture = factureCumulLot(lotUuid, factures);
    const paye = round2(facturesDuLot.reduce((s, f) => s + (payeParFacture.get(f.id) ?? 0), 0));

    return NextResponse.json({
      lot: {
        lotUuid: lot.LOT_UUID,
        nom: lot.NOM,
        perimetre: lot.PERIMETRE,
        budget: lot.BUDGET_TTC,
        responsable: lot.RESPONSABLE,
        driveFolderUrl: lot.DRIVE_FOLDER_ID
          ? `https://drive.google.com/drive/folders/${lot.DRIVE_FOLDER_ID}`
          : "",
        debutPrevu: lot.DEBUT_PREVU,
        finPrevue: lot.FIN_PREVUE,
        avancementPct: lot.AVANCEMENT_PCT,
      },
      engage,
      facture,
      paye,
      resteAFacturer: Math.max(0, round2(engage - facture)),
      devis: devisDuLot,
      factures: facturesDuLot,
      avenants: avenantsDuLot,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
