// Tests des parseurs de saisie utilisateur. Lancer : npx tsx lib/format.test.ts
//
// L'espace est le séparateur des milliers en français : "16 000" doit être
// accepté comme seize mille, pas refusé comme ambigu. Le bug d'origine
// n'était pas la façon de taper, c'était parseFloat("-16 000") qui
// s'arrêtait au premier espace et rendait -16 en silence.

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
assertEqual(parseMontantSaisi("16 000"), 16000, "espace comme séparateur de milliers");
assertEqual(parseMontantSaisi("16\u00a0726,55"), 16726.55, "espace insécable + virgule décimale");
assertEqual(parseMontantSaisi("115 204,42 €"), 115204.42, "espace, virgule et symbole euro combinés");
assertEqual(parseMontantSaisi("-16 000"), -16000, "négatif avec séparateur de milliers (l'ex-bug)");
assertEqual(parseMontantSaisi("98477.87"), 98477.87, "point décimal, sans séparateur de milliers");
assertEqual(parseMontantSaisi("1250,50"), 1250.5, "virgule décimale française");
assertEqual(parseMontantSaisi("1250.50"), 1250.5, "point décimal");
assertEqual(parseMontantSaisi("-500"), -500, "négatif (avenant)");
assertEqual(parseMontantSaisi(" 16000 "), 16000, "espaces en bordure tolérés");
assertEqual(parseMontantSaisi("16 000,50"), 16000.5, "espace de milliers avec décimales");

assertEqual(parseMontantSaisi("12a34"), null, "lettres mêlées aux chiffres refusées");
assertEqual(parseMontantSaisi("environ 5000"), null, "texte libre refusé");
assertEqual(parseMontantSaisi(""), null, "vide refusé");
assertEqual(parseMontantSaisi("16.5.2"), null, "deux séparateurs décimaux refusés");

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
