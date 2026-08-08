import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { modifierDevis } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ devisId: string }> }) {
  try {
    requireConfigured();
    const { devisId } = await params;
    const body = await req.json();

    const ttc = Number(body.ttc);
    if (!Number.isFinite(ttc) || ttc <= 0) throw new AppError("Le montant TTC doit être positif.");

    await modifierDevis(devisId, ttc);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
