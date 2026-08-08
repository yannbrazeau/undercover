import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { addReserve, getReserves } from "@/lib/sheets";
import { todayFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liste des réserves — filtrable par lot pour la fiche du lot.
export async function GET(req: Request) {
  try {
    requireConfigured();
    const url = new URL(req.url);
    const lotUuid = url.searchParams.get("lotUuid");
    const reserves = await getReserves();
    return NextResponse.json({
      reserves: lotUuid ? reserves.filter((r) => r.LOT_UUID === lotUuid) : reserves,
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// Enregistre une réserve — le point d'entrée de la tuile Photo sur Ajouter :
// une malfaçon constatée, photographiée, avec un commentaire qui la décrit.
export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const lotUuid = String(body.lotUuid ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!lotUuid) throw new AppError("Choisissez un lot.");
    if (!description) throw new AppError("Décrivez ce que montre la photo.");

    const reserve = await addReserve({
      lotUuid,
      description,
      date: todayFr(),
      driveUrl: body.driveUrl ? String(body.driveUrl) : undefined,
    });

    return NextResponse.json({ reserve });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
