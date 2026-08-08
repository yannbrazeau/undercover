"use client";

import { useCallback, useEffect, useState } from "react";
import { PiggyBank, TriangleAlert, ShieldAlert } from "lucide-react";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";

function initiale(nom: string): string {
  return (nom.trim()[0] || "?").toUpperCase();
}

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
      <ScreenHeader title="Budget" />
      <div className="screen-body">
        {configured === false && (
          <div className="info">
            {error ||
              "La connexion au chantier n'est pas encore établie. Les chiffres s'afficheront une fois qu'elle le sera, dans Réglages."}
          </div>
        )}

        {budget?.rappelOuvertureChantier && (
          <div className="warn">
            Déclare la date d&apos;ouverture du chantier dès que tu la connais : tant
            qu&apos;elle manque, les attestations décennales restent « valide sous réserve ».
          </div>
        )}
        {budget?.rappelDommagesOuvrage && (
          <div className="warn">
            Souscris l&apos;assurance dommages-ouvrage avant l&apos;ouverture du chantier :
            elle n&apos;est pas encore faite.
          </div>
        )}

        <div className="hero">
          <p className="sub">Il te reste</p>
          <p className={`amount num ${enDepassement ? "bad" : ""}`}>
            {budget ? euros(budget.ilVousReste) : "…"}
          </p>
          <p className="sub">
            sur {budget ? euros(budget.budgetContractuel) : "…"} prévus au contrat
          </p>
          {enDepassement && (
            <p className="lead" style={{ margin: "10px 0 0" }}>
              Regarde d&apos;abord les lots encore sans devis : c&apos;est souvent là que se
              cache la marge qui manque.
            </p>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            <span className="k">Engagé (devis signés)</span>
            <span className="v num">{budget ? euros(budget.engageTotal) : "…"}</span>
          </div>
          <div className="row">
            <span className="k">Retenu (devis choisis, non signés)</span>
            <span className="v num">{budget ? euros(budget.retenuTotal) : "…"}</span>
          </div>
          <div className="row">
            <span className="k">Estimé (lots sans devis)</span>
            <span className="v num">{budget ? euros(budget.estimeTotal) : "…"}</span>
          </div>
        </div>

        <div className="card">
          <h4>
            <PiggyBank /> Engagé et payé
          </h4>
          <div className="bar">
            <i style={{ width: `${pctPaye}%` }} />
            <i className="light" style={{ width: `${pctEngageRestant}%` }} />
          </div>
          <div className="legend">
            <span>
              <i className="dot" /> Payé : {budget ? euros(budget.paye) : "…"}
            </span>
            <span>
              <i className="dot light" /> Engagé restant à payer :{" "}
              {budget ? euros(Math.max(0, budget.engageTotal - budget.paye)) : "…"}
            </span>
            <span>
              <i className="dot track" /> Budget contractuel :{" "}
              {budget ? euros(budget.budgetContractuel) : "…"}
            </span>
          </div>
        </div>

        <div className="card">
          <h4>
            <TriangleAlert /> À surveiller
          </h4>
          {!budget && (
            <p className="lead">
              Les lots en dépassement apparaîtront ici, du plus grave au moins grave.
            </p>
          )}
          {budget && budget.aSurveiller.length === 0 && (
            <p className="lead" style={{ marginBottom: 0 }}>
              Aucun lot ne dépasse ce qui a été signé pour le moment.
            </p>
          )}
          {budget && budget.aSurveiller.length > 0 && (
            <p className="lead">
              Ces entreprises ont facturé plus que ce qu&apos;elles ont signé, sans avenant
              validé pour couvrir l&apos;écart : à éclaircir avant de payer.
            </p>
          )}
          {budget?.aSurveiller.map((l) => (
            <div className="item" key={l.lotUuid}>
              <div className="t">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="avatar">{initiale(l.entreprise || l.nom)}</span>
                  {l.nom} <span className="sub">· {l.entreprise}</span>
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
            <h4>
              <ShieldAlert /> Attestations décennales
            </h4>
            {budget.decennaleAReclamer.length > 0 && (
              <>
                <p className="lead" style={{ marginBottom: 6 }}>
                  Réclame l&apos;attestation de ces entreprises avant de signer avec elles :
                  après, tu perds ton pouvoir de négociation.
                </p>
                <p className="sub">À réclamer ou à renouveler</p>
                {budget.decennaleAReclamer.map((e) => (
                  <div className="item" key={e.entrepriseId}>
                    <div className="t">
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="avatar">{initiale(e.nom)}</span>
                        {e.nom}
                      </span>
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
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="avatar">{initiale(e.nom)}</span>
                        {e.nom}
                      </span>
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
