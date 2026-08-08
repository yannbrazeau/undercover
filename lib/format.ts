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

/**
 * Interprète un montant tapé au clavier par l'utilisateur. L'espace — y
 * compris l'insécable (U+00A0) et la fine insécable (U+202F) — est le
 * séparateur des milliers en français : "16 000" vaut seize mille sans
 * ambiguïté, ce n'est pas une saisie à refuser. On retire les espaces, le
 * symbole euro, on convertit la virgule décimale en point, puis on ne
 * refuse que ce qui reste réellement illisible (NaN) — jamais une devinette
 * silencieuse : c'est à l'écho affiché à côté (EchoMontant) de montrer ce
 * qui a été compris, pas à ce parseur de trancher tout seul.
 */
export function parseMontantSaisi(s: string): number | null {
  const t = s
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/€/g, "")
    .replace(/,/g, ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Même principe que parseMontantSaisi(), pour un pourcentage entier 0-100. */
export function parsePourcentageSaisi(s: string): number | null {
  const t = s.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = parseInt(t, 10);
  return n >= 0 && n <= 100 ? n : null;
}

/** Minuscules, sans accents — pour comparer des libellés (OUI/oui, etc.). */
export function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Convertit une date ISO (AAAA-MM-JJ d'un champ <input type="date">) en JJ/MM/AAAA. */
export function isoToFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

/** Date du jour au format JJ/MM/AAAA. */
export function todayFr(): string {
  return isoToFr(new Date().toISOString().slice(0, 10));
}
