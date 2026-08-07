// Format des montants (euros) et des dates, au format français.

const eurosFmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 629850 -> "629 850,00 €". */
export function euros(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return eurosFmt.format(n);
}

/**
 * Convertit une valeur de cellule en nombre.
 * Accepte un nombre brut (629850) ou un texte français ("629 850,00 €").
 */
export function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v)
    .replace(/[\s\u00a0\u202f]/g, "") // espaces, dont insécables et fines
    .replace(/€/g, "")
    .replace(/\./g, "") // séparateur de milliers éventuel
    .replace(/,/g, "."); // virgule décimale française -> point
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Minuscules, sans accents — pour comparer des libellés (OUI/oui, etc.). */
export function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
