import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { addAvenant } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();

    const lotUuid = String(body.lotUuid ?? "").trim();
    const description = String(body.description ?? "").trim();
    const montantTTC = Number(body.montantTTC);

    if (!lotUuid) throw new AppError("Choisissez un lot.");
    if (!description) throw new AppError("Décrivez l'avenant.");
    if (!Number.isFinite(montantTTC) || montantTTC === 0)
      throw new AppError("Le montant doit être un nombre, positif ou négatif.");

    const rawDate = String(body.date ?? "");
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? isoToFr(rawDate) : rawDate;

    const avenant = await addAvenant({
      lotUuid,
      description,
      montantTTC,
      date,
      driveUrl: body.driveUrl ? String(body.driveUrl) : undefined,
    });

    return NextResponse.json({ avenant });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
