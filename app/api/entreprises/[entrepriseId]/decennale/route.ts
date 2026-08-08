import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { enregistrerAttestationDecennale } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(s: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (fr) return new Date(Date.UTC(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1])));
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ entrepriseId: string }> }) {
  try {
    requireConfigured();
    const { entrepriseId } = await params;
    const body = await req.json();

    const debut = String(body.debut ?? "").trim();
    const fin = String(body.fin ?? "").trim();
    if (!debut || !fin) throw new AppError("Les deux dates de validité sont obligatoires.");

    const dDebut = toDate(debut);
    const dFin = toDate(fin);
    if (dDebut && dFin && dFin < dDebut) {
      throw new AppError("La date de fin ne peut pas être avant la date de début.");
    }

    await enregistrerAttestationDecennale({
      entrepriseId,
      assureur: body.assureur !== undefined ? String(body.assureur).trim() : undefined,
      debut: debut.includes("-") ? isoToFr(debut) : debut,
      fin: fin.includes("-") ? isoToFr(fin) : fin,
      activites: body.activites !== undefined ? String(body.activites).trim() : undefined,
      driveUrl: body.driveUrl ? String(body.driveUrl) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
