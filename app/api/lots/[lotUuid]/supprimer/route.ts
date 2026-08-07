import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { supprimerLot } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ lotUuid: string }> }) {
  try {
    requireConfigured();
    const { lotUuid } = await params;
    await supprimerLot(lotUuid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
