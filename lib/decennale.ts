// État d'une attestation de décennale — logique isolée, sans dépendance.
//
// L'ordre des tests n'est pas décoratif : celui sur la date d'ouverture du
// chantier passe AVANT celui sur la date du jour. Une attestation acquise
// couvre les travaux dont le chantier a été ouvert pendant sa période de
// validité — pas ceux constatés à la date où on la consulte. Tester d'abord
// « fin antérieure à aujourd'hui » ferait basculer une couverture acquise en
// « à renouveler » un an après l'ouverture, sans raison.

export type EtatDecennale = "à réclamer" | "valide" | "à renouveler" | "valide sous réserve";

function parseDateFr(s: string | undefined | null): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param debut DECENNALE_DEBUT (JJ/MM/AAAA)
 * @param fin DECENNALE_FIN (JJ/MM/AAAA)
 * @param dateOuvertureChantier DATE_OUVERTURE_CHANTIER (JJ/MM/AAAA, vide si non déclarée)
 * @param aujourdHui la date du jour — passée en paramètre pour rester testable
 */
export function etatDecennale(
  debut: string | undefined,
  fin: string | undefined,
  dateOuvertureChantier: string | undefined,
  aujourdHui: Date,
): EtatDecennale {
  const dDebut = parseDateFr(debut);
  const dFin = parseDateFr(fin);
  if (!dDebut || !dFin) return "à réclamer";

  const dOuverture = parseDateFr(dateOuvertureChantier);

  // Ouverture connue : seule comparaison qui compte, la date du jour n'entre pas en ligne de compte.
  if (dOuverture) {
    return dOuverture >= dDebut && dOuverture <= dFin ? "valide" : "à renouveler";
  }

  // Ouverture inconnue : une fin déjà dépassée est une certitude, quoi qu'il arrive.
  if (dFin < aujourdHui) return "à renouveler";
  return dDebut <= aujourdHui && aujourdHui <= dFin ? "valide sous réserve" : "à renouveler";
}
