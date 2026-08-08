// Tests de l'état d'une attestation décennale. Lancer : npx tsx lib/decennale.test.ts

import { etatDecennale } from "./decennale";

let pass = 0;
let fail = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL ${label}: attendu ${expected}, obtenu ${actual}`);
  }
}

const AUJOURDHUI = new Date(2026, 7, 8); // 8 août 2026

// Cas HMP : attestation acquise avant aujourd'hui, valable jusqu'au 31
// décembre 2026, mais l'ouverture du chantier n'est pas encore déclarée.
// L'ancien écran Réglages affichait ce cas comme « acquis » (coche verte) —
// c'était un bug de l'écran (une fonction ad hoc qui ne passait jamais par
// etatDecennale), pas de la règle elle-même : appelée directement, la règle
// répond bien « valide sous réserve ».
assertEqual(
  etatDecennale("01/01/2024", "31/12/2026", "", AUJOURDHUI),
  "valide sous réserve",
  "décennale en cours, ouverture du chantier non déclarée",
);

assertEqual(etatDecennale("", "", "", AUJOURDHUI), "à réclamer", "aucune date renseignée");

assertEqual(
  etatDecennale("01/01/2023", "15/07/2026", "", AUJOURDHUI),
  "à renouveler",
  "décennale expirée avant aujourd'hui, ouverture non déclarée",
);

assertEqual(
  etatDecennale("01/01/2024", "31/12/2026", "15/01/2027", AUJOURDHUI),
  "à renouveler",
  "ouverture déclarée après la fin de la décennale",
);

assertEqual(
  etatDecennale("01/01/2024", "31/12/2026", "10/03/2025", AUJOURDHUI),
  "valide",
  "ouverture déclarée pendant la période de la décennale",
);

console.log(`${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
