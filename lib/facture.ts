// Cœur calculable d'une facture — pur, sans dépendance, testable seul.
// Une facture porte deux montants de référence : le TTC et le net à payer
// (TTC diminué de la retenue de garantie). C'est le net à payer qui sera réglé.

export type FactureSaisie = {
  montantHT: number;
  tauxTVA: number; // en %
  tauxRetenue: number; // en %, 0 si le marché n'en prévoit pas
};

export type FactureMontants = {
  montantHT: number;
  tauxTVA: number;
  montantTVA: number;
  montantTTC: number;
  retenueGarantie: number;
  netAPayer: number;
};

/** Arrondi comptable à 2 décimales. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcule TVA, TTC, retenue et net à payer à partir du HT et des deux taux. */
export function computeFacture({ montantHT, tauxTVA, tauxRetenue }: FactureSaisie): FactureMontants {
  const ht = round2(montantHT);
  const montantTVA = round2((ht * tauxTVA) / 100);
  const montantTTC = round2(ht + montantTVA);
  const retenueGarantie = round2((montantTTC * tauxRetenue) / 100);
  const netAPayer = round2(montantTTC - retenueGarantie);
  return { montantHT: ht, tauxTVA, montantTVA, montantTTC, retenueGarantie, netAPayer };
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
