import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { marquerEntreprisePrevenue } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    requireConfigured();
    const body = await req.json();
    const devisId = String(body.devisId ?? "").trim();
    if (!devisId) throw new AppError("Devis manquant.");

    await marquerEntreprisePrevenue(devisId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
