import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";
import { updateLotPlanning } from "@/lib/sheets";
import { isoToFr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ lotUuid: string }> }) {
  try {
    requireConfigured();
    const { lotUuid } = await params;
    const body = await req.json();

    const toFr = (v: unknown) => {
      const s = String(v ?? "");
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? isoToFr(s) : s;
    };

    const avancementRaw = body.avancementPct;
    const avancementPct =
      avancementRaw === undefined || avancementRaw === null || avancementRaw === ""
        ? undefined
        : Math.max(0, Math.min(100, Number(avancementRaw)));

    await updateLotPlanning(lotUuid, {
      debutPrevu: body.debutPrevu !== undefined ? toFr(body.debutPrevu) : undefined,
      finPrevue: body.finPrevue !== undefined ? toFr(body.finPrevue) : undefined,
      avancementPct,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
