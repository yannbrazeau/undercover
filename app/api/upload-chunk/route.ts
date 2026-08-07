import { NextResponse } from "next/server";
import { requireConfigured, AppError } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Relaie un morceau de fichier vers la session Drive ouverte par /api/upload-init.
// Le navigateur ne parle jamais directement à Google (Drive refuse cet envoi
// cross-site) : chaque morceau reste sous la limite de l'hébergeur, quelle que
// soit la taille totale du fichier.
export async function PUT(req: Request) {
  try {
    requireConfigured();
    const sessionUri = req.headers.get("x-session-uri");
    const contentRange = req.headers.get("x-content-range");
    if (!sessionUri) throw new AppError("Session d'envoi manquante.");
    if (!contentRange) throw new AppError("Plage de contenu manquante.");

    const chunk = Buffer.from(await req.arrayBuffer());

    const res = await fetch(sessionUri, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": contentRange,
      },
      body: chunk,
    });

    const text = await res.text();
    const headers = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    // 308 = morceau reçu, Google indique où reprendre ; on relaie ce repère au client.
    const range = res.headers.get("range");
    if (range) headers.set("range", range);

    return new NextResponse(text, { status: res.status, headers });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
