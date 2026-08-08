import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { annulerDevis } from "@/lib/sheets";
import { todayFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ devisId: string }> }) {
  try {
    requireConfigured();
    const { devisId } = await params;
    await annulerDevis(devisId, todayFr());
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
