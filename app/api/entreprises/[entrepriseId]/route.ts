import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getEntreprises, getLots, getDevis, getAvenants, getProjet, devisEngage, engageLot } from "@/lib/sheets";
import { etatDecennale } from "@/lib/decennale";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ entrepriseId: string }> }) {
  try {
    requireConfigured();
    const { entrepriseId } = await params;

    const [entreprises, lots, devis, avenants, projet] = await Promise.all([
      getEntreprises(),
      getLots(),
      getDevis(),
      getAvenants(),
      getProjet(),
    ]);

    const entreprise = entreprises.find((e) => e.ENTREPRISE_ID === entrepriseId);
    if (!entreprise) throw new AppError("Entreprise introuvable.", 404);

    const etat = etatDecennale(
      entreprise.DECENNALE_DEBUT,
      entreprise.DECENNALE_FIN,
      projet.dateOuvertureChantier,
      new Date(),
    );

    const lotsActifs = lots.filter((l) => norm(l.ACTIF) === "oui");
    const devisDeLEntreprise = devis.filter((d) => d.ENTREPRISE_ID === entrepriseId);
    const surCeChantier = devisDeLEntreprise
      .map((d) => {
        const lot = lotsActifs.find((l) => l.LOT_UUID === d.LOT_UUID);
        if (!lot) return null;
        return {
          lotUuid: lot.LOT_UUID,
          lotNom: lot.NOM,
          devisId: d.DEVIS_ID,
          ttc: d.TTC,
          statut: d.STATUT,
          engage: devisEngage(d) ? engageLot(lot.LOT_UUID, devis, avenants) : 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({
      entreprise: {
        id: entreprise.ENTREPRISE_ID,
        nom: entreprise.NOM,
        activite: entreprise.ACTIVITE,
        attestationTvaRemise: norm(entreprise.ATTESTATION_TVA_REMISE) === "oui",
        siret: entreprise.SIRET,
        contact: entreprise.CONTACT,
        decennale: {
          etat,
          assureur: entreprise.DECENNALE_ASSUREUR,
          debut: entreprise.DECENNALE_DEBUT,
          fin: entreprise.DECENNALE_FIN,
          activites: entreprise.DECENNALE_ACTIVITES,
          driveUrl: entreprise.DECENNALE_DRIVE_URL,
        },
      },
      surCeChantier,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
