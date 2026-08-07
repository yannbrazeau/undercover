import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { getLots, getProjet, creerLot } from "@/lib/sheets";
import { ensureLotFolder } from "@/lib/drive";
import { norm } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liste des lots actifs pour les sélecteurs, et valeurs par défaut du projet.
export async function GET() {
  try {
    requireConfigured();
    const [lots, projet] = await Promise.all([getLots(), getProjet()]);
    return NextResponse.json({
      lots: lots
        .filter((l) => norm(l.ACTIF) === "oui")
        .map((l) => ({ uuid: l.LOT_UUID, nom: l.NOM })),
      defaults: { tauxRetenue: projet.tauxRetenueGarantie },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// Créer un lot — apparaît aussitôt sur Budget et Lots, avec son dossier de documents.
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const nom = String(body.nom ?? "").trim();
    if (!nom) throw new AppError("Le nom du lot est obligatoire.");

    const budgetRaw = body.budgetTTC;
    const budgetTTC =
      budgetRaw === undefined || budgetRaw === null || budgetRaw === "" ? undefined : Number(budgetRaw);

    const lot = await creerLot({
      nom,
      budgetTTC: Number.isFinite(budgetTTC as number) ? budgetTTC : undefined,
      perimetre: body.perimetre ? String(body.perimetre).trim() : undefined,
    });

    let driveFolderError = "";
    try {
      await ensureLotFolder(lot.LOT_UUID);
    } catch {
      driveFolderError = "Le dossier de documents n'a pas pu être créé. Réessayer.";
    }

    return NextResponse.json({ lot: { uuid: lot.LOT_UUID, nom: lot.NOM }, driveFolderError });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
