import { NextResponse } from "next/server";
import { configStatus, isConfigured } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Consommée par « Vérifier la connexion » sur l'écran Chantier : ne
// confirme que la présence des identifiants Google, pas un appel réel à
// l'API (les écrans qui chargent déjà des données du classeur remplissent
// ce rôle-là, avec leurs propres messages d'erreur).
export async function GET() {
  return NextResponse.json({
    configured: isConfigured(),
    status: configStatus(),
  });
}
