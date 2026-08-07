import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getDevis, getLots, getEntreprises, getProjet } from "@/lib/sheets";
import { etatDecennale } from "@/lib/decennale";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liste des devis, groupables par lot côté client — sert au provisoire de
// l'écran Lots (la vraie fiche du lot arrive à l'étape 6).
export async function GET() {
  try {
    requireConfigured();
    const [devis, lots, entreprises, projet] = await Promise.all([
      getDevis(),
      getLots(),
      getEntreprises(),
      getProjet(),
    ]);

    const lotNom = new Map(lots.map((l) => [l.LOT_UUID, l.NOM]));
    const entrepriseById = new Map(entreprises.map((e) => [e.ENTREPRISE_ID, e]));
    const aujourdHui = new Date();

    const items = devis
      .filter((d) => lotNom.has(d.LOT_UUID))
      .map((d) => {
        const ent = entrepriseById.get(d.ENTREPRISE_ID);
        const decennale = ent
          ? etatDecennale(ent.DECENNALE_DEBUT, ent.DECENNALE_FIN, projet.dateOuvertureChantier, aujourdHui)
          : "à réclamer";
        return {
          id: d.DEVIS_ID,
          lotUuid: d.LOT_UUID,
          lot: lotNom.get(d.LOT_UUID) || "",
          entreprise: d.ENTREPRISE,
          ttc: d.TTC,
          statut: d.STATUT,
          decennale,
          entreprisePrevenue: norm(d.ENTREPRISE_PREVENUE) === "oui",
        };
      });

    return NextResponse.json({ devis: items });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
