// Tests des parseurs de saisie utilisateur. Lancer : npx tsx lib/format.test.ts
//
// Le bug d'origine : parseFloat("-16 000") vaut -16 (il s'arrête au premier
// espace). parseMontantSaisi() doit refuser ce genre de saisie plutôt que
// deviner un montant faux.

import { parseMontantSaisi, parsePourcentageSaisi } from "./format";

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

assertEqual(parseMontantSaisi("16000"), 16000, "entier simple");
assertEqual(parseMontantSaisi("1250,50"), 1250.5, "virgule décimale française");
assertEqual(parseMontantSaisi("1250.50"), 1250.5, "point décimal");
assertEqual(parseMontantSaisi("-500"), -500, "négatif (avenant)");
assertEqual(parseMontantSaisi(" 16000 "), 16000, "espaces en bordure tolérés");

// Le bug du -16 000 devenu 16 € : un espace au milieu doit être refusé, pas
// interprété comme un séparateur de milliers.
assertEqual(parseMontantSaisi("16 000"), null, "espace interne refusé (ex-bug -16 000 -> 16)");
assertEqual(parseMontantSaisi("-16 000"), null, "espace interne refusé, signe négatif");
assertEqual(parseMontantSaisi("16 000,50"), null, "espace interne refusé, avec décimales");
assertEqual(parseMontantSaisi("environ 5000"), null, "texte non numérique refusé");
assertEqual(parseMontantSaisi("1e3"), null, "notation scientifique refusée");
assertEqual(parseMontantSaisi(""), null, "vide refusé");
assertEqual(parseMontantSaisi("16,505"), null, "trois décimales refusées");
assertEqual(parseMontantSaisi("16.5.2"), null, "deux séparateurs refusés");

assertEqual(parsePourcentageSaisi("50"), 50, "pourcentage simple");
assertEqual(parsePourcentageSaisi("0"), 0, "zéro accepté");
assertEqual(parsePourcentageSaisi("100"), 100, "cent accepté");
assertEqual(parsePourcentageSaisi("101"), null, "hors bornes refusé");
assertEqual(parsePourcentageSaisi("-5"), null, "négatif refusé");
assertEqual(parsePourcentageSaisi("cinquante"), null, "texte refusé");
assertEqual(parsePourcentageSaisi("50,5"), null, "décimales refusées");
assertEqual(parsePourcentageSaisi(""), null, "vide refusé");

console.log(`${pass} tests réussis, ${fail} échoués.`);
if (fail > 0) process.exit(1);
