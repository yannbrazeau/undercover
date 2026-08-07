import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { addFacture, getFactures, getPaiements } from "@/lib/sheets";
import { isoToFr, norm } from "@/lib/format";
import { round2 } from "@/lib/facture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Factures encore ouvertes (pas soldées), avec leur reste dû — pour le
// sélecteur de l'écran Ajouter quand on enregistre un paiement.
export async function GET() {
  try {
    requireConfigured();
    const [factures, paiements] = await Promise.all([getFactures(), getPaiements()]);

    const payeParFacture = new Map<string, number>();
    for (const p of paiements) {
      payeParFacture.set(p.FACTURE_ID, (payeParFacture.get(p.FACTURE_ID) ?? 0) + p.MONTANT);
    }

    const ouvertes = factures
      .filter((f) => norm(f.STATUT) !== "payee")
      .map((f) => {
        const paye = payeParFacture.get(f.FACTURE_ID) ?? 0;
        return {
          id: f.FACTURE_ID,
          lot: f.LOT,
          entreprise: f.ENTREPRISE,
          nature: f.NATURE,
          netAPayer: f.NET_A_PAYER,
          resteDu: Math.max(0, round2(f.NET_A_PAYER - paye)),
        };
      })
      .filter((f) => f.resteDu > 0);

    return NextResponse.json({ factures: ouvertes });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const lotUuid = String(body.lotUuid ?? "").trim();
    const montantTTC = Number(body.montantTTC);
    const tauxRetenue = Number(body.tauxRetenue ?? 0);

    if (!lotUuid) throw new AppError("Choisissez un lot.");
    if (!Number.isFinite(montantTTC) || montantTTC <= 0)
      throw new AppError("Le montant TTC doit être un nombre positif.");

    const rawDate = String(body.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? isoToFr(rawDate) : rawDate;

    const facture = await addFacture({
      lotUuid,
      nature: String(body.nature ?? "").trim() || "Facture",
      montantTTC,
      tauxRetenue: Number.isFinite(tauxRetenue) ? tauxRetenue : 0,
      numero: body.numero ? String(body.numero) : undefined,
      date,
      driveUrl: body.driveUrl ? String(body.driveUrl) : undefined,
    });

    return NextResponse.json({ facture });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
