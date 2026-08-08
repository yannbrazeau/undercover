"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ScreenHeader from "@/components/ScreenHeader";

type EtatDecennale = "à réclamer" | "valide" | "valide sous réserve" | "à renouveler";
type Entreprise = { id: string; nom: string; activite: string; etat: EtatDecennale };

const TONE: Record<EtatDecennale, "danger" | "warn" | "ok"> = {
  "à réclamer": "danger",
  "à renouveler": "danger",
  "valide sous réserve": "warn",
  valide: "ok",
};

const IconBouclier = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function EntreprisesPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);

  const charger = useCallback(() => {
    fetch("/api/entreprises", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) setEntreprises(d.entreprises ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  if (configured === false) {
    return (
      <>
        <ScreenHeader eyebrow="Chantier" title="Entreprises" />
        <div className="pad top">
          <div className="info">Le répertoire des entreprises demande la connexion Google.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader eyebrow={`${entreprises.length} entreprises`} title="Entreprises" />
      <div className="pad top">
        <div className="acts">
          {entreprises.map((e) => (
            <Link key={e.id} href={`/entreprises/${e.id}`} className="act">
              <span className="ic neutral">
                <IconBouclier />
              </span>
              <div>
                <p className="t">{e.nom}</p>
                <p className="m">{e.activite}</p>
              </div>
              <span className={`tag ${TONE[e.etat]}`}>{e.etat}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
