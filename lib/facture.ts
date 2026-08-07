// Cœur calculable d'une facture — pur, sans dépendance, testable seul.
// Tout se compare en TTC. Une facture porte deux montants de référence : le TTC
// et le net à payer (TTC diminué de la retenue de garantie). C'est le net qui est réglé.
// L'outil ne pilote pas la TVA : une facture de travaux mêle plusieurs taux sur la
// même pièce, un « taux de TVA » serait faux. Le HT n'est conservé qu'en archive.

export type FactureSaisie = {
  montantTTC: number;
  tauxRetenue: number; // en %, 0 si le marché n'en prévoit pas
};

export type FactureMontants = {
  montantTTC: number;
  retenueGarantie: number;
  netAPayer: number;
};

/** Arrondi comptable à 2 décimales. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Déduit la retenue et le net à payer à partir du TTC et du taux de retenue. */
export function computeFacture({ montantTTC, tauxRetenue }: FactureSaisie): FactureMontants {
  const ttc = round2(montantTTC);
  const retenueGarantie = round2((ttc * tauxRetenue) / 100);
  const netAPayer = round2(ttc - retenueGarantie);
  return { montantTTC: ttc, retenueGarantie, netAPayer };
}

/**
 * Prochain identifiant PREFIX + numéro sur 3 chiffres (FAC-001, PAY-007…).
 * Ignore les lignes d'exemple (FAC-EXEMPLE) qui n'ont pas de suffixe numérique.
 */
export function nextId(prefix: string, existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const m = /(\d+)\s*$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
