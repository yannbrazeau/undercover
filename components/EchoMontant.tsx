// Confirme ce qui a été compris d'un montant saisi, plutôt que de refuser
// une saisie ambiguë : l'utilisateur voit le résultat formaté et corrige
// lui-même s'il ne correspond pas (cahier §5 — un message d'erreur ne peut
// pas détecter "1600" tapé pour "16000", mais l'œil le voit tout de suite).

import { parseMontantSaisi, euros } from "@/lib/format";

export default function EchoMontant({ brut }: { brut: string }) {
  if (brut.trim() === "") return null;
  const n = parseMontantSaisi(brut);
  if (n === null) return <p className="fieldErr">Montant non reconnu.</p>;
  return <p className="echo">{euros(n)}</p>;
}
