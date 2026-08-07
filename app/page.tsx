"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";

type LotASurveiller = {
  lotUuid: string;
  nom: string;
  entreprise: string;
  engage: number;
  facture: number;
  ecart: number;
};

type DecennaleAlerte = { entrepriseId: string; nom: string; etat: string };

type BudgetSummary = {
  budgetContractuel: number;
  depensePrevue: number;
  ilVousReste: number;
  engageTotal: number;
  retenuTotal: number;
  estimeTotal: number;
  paye: number;
  aSurveiller: LotASurveiller[];
  decennaleAReclamer: DecennaleAlerte[];
  decennaleSousReserve: DecennaleAlerte[];
  rappelOuvertureChantier: boolean;
  rappelDommagesOuvrage: boolean;
};

export default function BudgetPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [error, setError] = useState("");

  const charger = useCallback(() => {
    fetch("/api/budget", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) setBudget(d.budget);
        else setError(d.error || "Le budget n'a pas pu être chargé.");
      })
      .catch(() => {
        setConfigured(false);
        setError("Le budget n'a pas pu être chargé.");
      });
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const enDepassement = budget ? budget.ilVousReste < 0 : false;

  const pctPaye = budget && budget.budgetContractuel > 0
    ? Math.min(100, Math.round((budget.paye / budget.budgetContractuel) * 1000) / 10)
    : 0;
  const pctEngageRestant = budget && budget.budgetContractuel > 0
    ? Math.max(0, Math.min(100 - pctPaye, Math.round(((budget.engageTotal - budget.paye) / budget.budgetContractuel) * 1000) / 10))
    : 0;

  return (
    <>
      <ScreenHeader eyebrow="Chantier Bouchemaine" title="Budget" />
      <div className="screen-body">
        {configured === false && (
          <div className="info">
            {error ||
              "L'accès Google n'est pas encore configuré. Les chiffres du chantier s'afficheront une fois la connexion établie, dans Réglages."}
          </div>
        )}

        {budget?.rappelOuvertureChantier && (
          <div className="warn">
            Date d&apos;ouverture du chantier non déclarée — les attestations décennales
            restent « valide sous réserve » tant qu&apos;elle n&apos;est pas renseignée.
          </div>
        )}
        {budget?.rappelDommagesOuvrage && (
          <div className="warn">
            Assurance dommages-ouvrage non souscrite — à faire avant l&apos;ouverture du chantier.
          </div>
        )}

        <div className="card">
          <p className="sub">Il vous reste</p>
          <p className={`amount num ${enDepassement ? "bad" : ""}`}>
            {budget ? euros(budget.ilVousReste) : "—"}
          </p>
          <p className="sub">
            sur {budget ? euros(budget.budgetContractuel) : "—"} prévus au contrat
          </p>

          <div className="row">
            <span className="k">Engagé (devis signés)</span>
            <span className="v num">{budget ? euros(budget.engageTotal) : "—"}</span>
          </div>
          <div className="row">
            <span className="k">Retenu (devis choisis, non signés)</span>
            <span className="v num">{budget ? euros(budget.retenuTotal) : "—"}</span>
          </div>
          <div className="row">
            <span className="k">Estimé (lots sans devis)</span>
            <span className="v num">{budget ? euros(budget.estimeTotal) : "—"}</span>
          </div>
        </div>

        <div className="card">
          <h4>Engagé et payé</h4>
          <div className="bar">
            <i style={{ width: `${pctPaye}%` }} />
            <i className="light" style={{ width: `${pctEngageRestant}%` }} />
          </div>
          <div className="legend">
            <span>
              <i className="dot" /> Payé — {budget ? euros(budget.paye) : "—"}
            </span>
            <span>
              <i className="dot light" /> Engagé restant à payer —{" "}
              {budget ? euros(Math.max(0, budget.engageTotal - budget.paye)) : "—"}
            </span>
            <span>
              <i className="dot track" /> Budget contractuel —{" "}
              {budget ? euros(budget.budgetContractuel) : "—"}
            </span>
          </div>
        </div>

        <div className="card">
          <h4>À surveiller</h4>
          {!budget && (
            <p className="sub">
              Les lots en dépassement apparaîtront ici, du plus grave au moins grave.
            </p>
          )}
          {budget && budget.aSurveiller.length === 0 && (
            <p className="sub">Aucun lot en dépassement pour le moment.</p>
          )}
          {budget?.aSurveiller.map((l) => (
            <div className="item" key={l.lotUuid}>
              <div className="t">
                <span>
                  {l.nom} <span className="sub">— {l.entreprise}</span>
                </span>
                <span className="num bad">{euros(l.ecart)}</span>
              </div>
              <div className="m">
                Engagé {euros(l.engage)} · Facturé {euros(l.facture)}
              </div>
            </div>
          ))}
        </div>

        {budget && (budget.decennaleAReclamer.length > 0 || budget.decennaleSousReserve.length > 0) && (
          <div className="card">
            <h4>Attestations décennales</h4>
            {budget.decennaleAReclamer.length > 0 && (
              <>
                <p className="sub">À réclamer ou à renouveler</p>
                {budget.decennaleAReclamer.map((e) => (
                  <div className="item" key={e.entrepriseId}>
                    <div className="t">
                      <span>{e.nom}</span>
                      <span className="pill danger">{e.etat}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
            {budget.decennaleSousReserve.length > 0 && (
              <>
                <p className="sub" style={{ marginTop: budget.decennaleAReclamer.length > 0 ? 12 : 0 }}>
                  En attente de la date d&apos;ouverture du chantier
                </p>
                {budget.decennaleSousReserve.map((e) => (
                  <div className="item" key={e.entrepriseId}>
                    <div className="t">
                      <span>{e.nom}</span>
                      <span className="pill warn">{e.etat}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
