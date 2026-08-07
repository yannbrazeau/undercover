import { NextResponse } from "next/server";
import { configStatus, isConfigured } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// À ce stade, on rapporte seulement si la configuration est présente.
// Le test réel de connexion à Google viendra avec la couche données.
export async function GET() {
  return NextResponse.json({
    configured: isConfigured(),
    status: configStatus(),
  });
}
