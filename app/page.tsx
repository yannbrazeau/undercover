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
  devisExpiresCount: number;
  retenueGarantieEnCours: number;
};

type Tache = { dot: "danger" | "warn" | "mute"; titre: string; detail: string };

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

  if (configured === false) {
    return (
      <>
        <ScreenHeader hero title="Budget" />
        <div className="pad top">
          <div className="info">
            {error ||
              "La connexion au chantier n'est pas encore établie. Les chiffres s'afficheront une fois qu'elle le sera, dans Réglages."}
          </div>
        </div>
      </>
    );
  }

  if (!budget) {
    return <ScreenHeader hero title="Budget" />;
  }

  const enDepassement = budget.ilVousReste < 0;
  const pctDepassement =
    budget.budgetContractuel > 0 ? Math.abs(Math.round((budget.ilVousReste / budget.budgetContractuel) * 100)) : 0;

  const total = budget.depensePrevue > 0 ? budget.depensePrevue : 1;
  const pctEngage = Math.round((budget.engageTotal / total) * 1000) / 10;
  const pctRetenu = Math.round((budget.retenuTotal / total) * 1000) / 10;
  const pctEstime = Math.max(0, 100 - pctEngage - pctRetenu);

  const taches: Tache[] = [];
  if (budget.rappelDommagesOuvrage) {
    taches.push({
      dot: "danger",
      titre: "Souscrire l'assurance dommages-ouvrage",
      detail: "Avant l'ouverture du chantier",
    });
  }
  if (budget.decennaleAReclamer.length > 0) {
    taches.push({
      dot: "warn",
      titre: `Réclamer ${budget.decennaleAReclamer.length} attestation${budget.decennaleAReclamer.length > 1 ? "s" : ""} décennale${budget.decennaleAReclamer.length > 1 ? "s" : ""}`,
      detail: "Avant de signer les devis",
    });
  }
  if (budget.devisExpiresCount > 0) {
    taches.push({
      dot: "warn",
      titre: `${budget.devisExpiresCount} devis expiré${budget.devisExpiresCount > 1 ? "s" : ""}`,
      detail: "À renouveler ou à écarter",
    });
  }
  if (budget.rappelOuvertureChantier) {
    taches.push({
      dot: "mute",
      titre: "Date d'ouverture non renseignée",
      detail: "Les attestations restent sous réserve",
    });
  }

  return (
    <>
      <ScreenHeader hero eyebrow="Bouchemaine" title="Budget" />
      <div className="lift">
        <div className="card big">
          <p className="lbl">Il te reste</p>
          <p className={`amount num ${enDepassement ? "bad" : ""}`}>{euros(budget.ilVousReste)}</p>
          {enDepassement && <span className="badge danger">Dépassement de {pctDepassement} %</span>}
          <div className="seg">
            <i style={{ width: `${pctEngage}%`, background: "var(--ink)" }} />
            <i style={{ width: `${pctRetenu}%`, background: "var(--accent)" }} />
            <i style={{ width: `${pctEstime}%`, background: "var(--line)" }} />
          </div>
          <div className="legend">
            <span>Engagé {euros(budget.engageTotal)}</span>
            <span>Retenu {euros(budget.retenuTotal)}</span>
            <span>Estimé {euros(budget.estimeTotal)}</span>
          </div>
          <p className="hint">
            Sur {euros(budget.budgetContractuel)} prévus au contrat.{" "}
            {enDepassement && "Regarde d'abord les lots encore sans devis."}
          </p>
        </div>
      </div>

      {taches.length > 0 && (
        <>
          <p className="sect">À faire</p>
          <div className="pad">
            {taches.map((t, i) => (
              <div className="task" key={i}>
                <span className={`dot ${t.dot}`} />
                <div>
                  <p className="t">{t.titre}</p>
                  <p className="m">{t.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="sect">Retenues de garantie</p>
      <div className="pad">
        <div className="card flat">
          <p className="amount sm">{euros(budget.retenueGarantieEnCours)}</p>
          <p className="m">
            {budget.retenueGarantieEnCours > 0
              ? "Se libère un an après la réception, si aucune réserve ne subsiste."
              : "Aucune retenue en cours. Elles se libèrent un an après la réception."}
          </p>
        </div>
      </div>

      <p className="sect">À surveiller</p>
      <div className="pad">
        {budget.aSurveiller.length === 0 && (
          <div className="empty">
            <span className="round">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13h4l2 3h6l2-3h4" />
                <path d="M5.5 5h13l2.5 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" />
              </svg>
            </span>
            <div>
              <p className="t">Aucune facture enregistrée</p>
              <p className="m">Rien n&apos;a encore été saisi. Cela ne veut pas dire qu&apos;aucune facture n&apos;est arrivée.</p>
            </div>
          </div>
        )}
        {budget.aSurveiller.map((l) => (
          <div className="card" key={l.lotUuid}>
            <div className="l1">
              <span className="n">{l.nom}</span>
              <span className="a danger">+{euros(l.ecart)}</span>
            </div>
            <div className="l2">
              <span>{l.entreprise}</span>
              <span className="st danger">Dépassement</span>
            </div>
            <p className="hint">
              Engagé {euros(l.engage)} · Facturé {euros(l.facture)}
            </p>
          </div>
        ))}
      </div>

      {(budget.decennaleAReclamer.length > 0 || budget.decennaleSousReserve.length > 0) && (
        <>
          <p className="sect">Attestations décennales</p>
          <div className="pad">
            <div className="acts">
              {budget.decennaleAReclamer.map((e) => (
                <div className="act" key={e.entrepriseId}>
                  <span className="ic warn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <div>
                    <p className="t">{e.nom}</p>
                    <p className="m">{e.etat === "à renouveler" ? "À renouveler" : "À réclamer"}</p>
                  </div>
                </div>
              ))}
              {budget.decennaleSousReserve.map((e) => (
                <div className="act" key={e.entrepriseId}>
                  <span className="ic warn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <div>
                    <p className="t">{e.nom}</p>
                    <p className="m">En attente de la date d&apos;ouverture du chantier</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
