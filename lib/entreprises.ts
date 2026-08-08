// Résumé d'une entreprise pour les listes (Chantier, répertoire) — pur,
// sans dépendance réseau, testable seul.

import { etatDecennale, type EtatDecennale } from "./decennale";
import type { Entreprise } from "./types";

export type EntrepriseResume = {
  id: string;
  nom: string;
  activite: string;
  etat: EtatDecennale;
};

export function resumerEntreprises(
  entreprises: Entreprise[],
  dateOuvertureChantier: string,
  aujourdHui: Date,
): EntrepriseResume[] {
  return entreprises.map((e) => ({
    id: e.ENTREPRISE_ID,
    nom: e.NOM,
    activite: e.ACTIVITE,
    etat: etatDecennale(e.DECENNALE_DEBUT, e.DECENNALE_FIN, dateOuvertureChantier, aujourdHui),
  }));
}
