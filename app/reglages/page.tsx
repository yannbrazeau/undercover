"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";

type Reglages = {
  maitreOeuvre: string;
  budgetContractuel: number;
  dateOuvertureChantier: string;
  doSouscrite: boolean;
  decennaleHmpValidite: string;
  decennaleHmpEtat: "à réclamer" | "valide" | "expirée";
};

const IconVerifier = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0z" />
    <path d="M12 18v3" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export default function ReglagesPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [loading, setLoading] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reglages", { cache: "no-store" });
      const json = await res.json();
      setConfigured(res.status === 200);
      if (res.status === 200) setReglages(json);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <>
      <ScreenHeader title="Réglages" />

      <p className="sect">Connexion</p>
      <div className="pad">
        <div className="card">
          <div className="row">
            <span className="k">Accès au chantier</span>
            <span className={`v st ${configured ? "ok" : "danger"}`}>{configured ? "Établi" : "Non établi"}</span>
          </div>
        </div>
        <div className="acts">
          <button type="button" className="act" onClick={charger} disabled={loading}>
            <span className={`ic ${configured ? "ok" : "warn"}`}>
              <IconVerifier />
            </span>
            <div>
              <p className="t">{loading ? "Vérification…" : "Vérifier la connexion"}</p>
              <p className="m">Classeur et dossier de documents</p>
            </div>
            <i className="chev">
              <IconChevron />
            </i>
          </button>
        </div>
        {configured === false && (
          <div className="info">
            La connexion au chantier n&apos;est pas encore établie. Elle se renseigne dans l&apos;hébergement, une
            seule fois.
          </div>
        )}
      </div>

      {reglages && (
        <>
          <p className="sect">Assurances du projet</p>
          <div className="pad">
            <div className="card">
              <div className="check">
                <span className={`box ${reglages.doSouscrite ? "on" : ""}`}>{reglages.doSouscrite ? "✓" : ""}</span>
                <div>
                  <p className="t">Dommages-ouvrage</p>
                  {reglages.doSouscrite ? (
                    <p className="m">Souscrite</p>
                  ) : (
                    <p className="m st danger">À souscrire avant l&apos;ouverture du chantier</p>
                  )}
                </div>
              </div>
              <div className={`check ${reglages.decennaleHmpEtat === "valide" ? "done" : ""}`}>
                <span className={`box ${reglages.decennaleHmpEtat === "valide" ? "on" : ""}`}>
                  {reglages.decennaleHmpEtat === "valide" ? "✓" : ""}
                </span>
                <div>
                  <p className="t">Décennale HMP</p>
                  {reglages.decennaleHmpEtat === "valide" && (
                    <p className="m">Valable jusqu&apos;au {reglages.decennaleHmpValidite}</p>
                  )}
                  {reglages.decennaleHmpEtat === "expirée" && (
                    <p className="m st danger">Expirée le {reglages.decennaleHmpValidite}</p>
                  )}
                  {reglages.decennaleHmpEtat === "à réclamer" && <p className="m st warn">À réclamer</p>}
                </div>
              </div>
            </div>
          </div>

          <p className="sect">Le chantier</p>
          <div className="pad">
            <div className="card">
              <div className="row">
                <span className="k">Maître d&apos;œuvre</span>
                <span className="v">{reglages.maitreOeuvre || <span className="mute">Non renseigné</span>}</span>
              </div>
              <div className="row">
                <span className="k">Budget contractuel</span>
                <span className="v">{euros(reglages.budgetContractuel)}</span>
              </div>
              <div className="row">
                <span className="k">Ouverture du chantier</span>
                <span className="v">
                  {reglages.dateOuvertureChantier || <span className="st warn">Non déclarée</span>}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
