import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { annulerPaiement } from "@/lib/sheets";
import { todayFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ paiementId: string }> }) {
  try {
    requireConfigured();
    const { paiementId } = await params;
    await annulerPaiement(paiementId, todayFr());
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
