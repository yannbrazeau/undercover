"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";

type LotItem = {
  lotUuid: string;
  nom: string;
  perimetre: string;
  budget: number;
  engage: number;
  facture: number;
  paye: number;
  ecartBudget: number;
  entreprise: string;
  nbDevis: number;
  etat: "aucun devis" | "à choisir" | "en cours" | "terminé";
  debutPrevu: string;
  finPrevue: string;
  avancementPct: number;
};

function parseFr(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
}

export default function LotsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lots, setLots] = useState<LotItem[]>([]);
  const [scenario, setScenario] = useState(0);
  const [budgetContractuel, setBudgetContractuel] = useState(0);
  const [vue, setVue] = useState<"liste" | "chronologie">("liste");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    fetch("/api/lots/liste", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) {
          setLots(d.lots ?? []);
          setScenario(d.scenario ?? 0);
          setBudgetContractuel(d.budgetContractuel ?? 0);
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  const ecartScenario = scenario - budgetContractuel;

  const lotsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((l) => l.nom.toLowerCase().includes(q));
  }, [lots, recherche]);

  const aujourdHui = useMemo(() => new Date(), []);

  const chronologie = useMemo(() => {
    const avecDate = lotsFiltres
      .filter((l) => parseFr(l.debutPrevu))
      .sort((a, b) => (parseFr(a.debutPrevu)!.getTime() - parseFr(b.debutPrevu)!.getTime()));
    const sansDate = lotsFiltres.filter((l) => !parseFr(l.debutPrevu));
    return { avecDate, sansDate };
  }, [lotsFiltres]);

  return (
    <>
      <ScreenHeader eyebrow={`${lots.length} lots`} title="Lots" />
      <div className="sticky">
        <span className="l">Scénario · écart au budget</span>
        <span className="r">
          {configured ? (
            <>
              {euros(scenario)}{" "}
              <span style={{ color: ecartScenario > 0 ? "var(--danger)" : "var(--ok)" }}>
                {ecartScenario > 0 ? "+" : ""}
                {euros(ecartScenario)}
              </span>
            </>
          ) : (
            "—"
          )}
        </span>
      </div>
      <div className="screen-body">
        <div className="tabs">
          <span className={vue === "liste" ? "on" : undefined} onClick={() => setVue("liste")}>
            Liste
          </span>
          <span className={vue === "chronologie" ? "on" : undefined} onClick={() => setVue("chronologie")}>
            Chronologie
          </span>
        </div>

        {configured === false && (
          <div className="info">La liste des lots demande la connexion Google.</div>
        )}

        {vue === "liste" && (
          <>
            <input
              className="field"
              placeholder="Rechercher un lot"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {lotsFiltres.map((l) => (
              <LigneLot key={l.lotUuid} lot={l} />
            ))}
          </>
        )}

        {vue === "chronologie" && (
          <>
            {chronologie.avecDate.map((l) => (
              <LigneChronologie key={l.lotUuid} lot={l} aujourdHui={aujourdHui} />
            ))}
            {chronologie.sansDate.length > 0 && (
              <>
                <p className="sub" style={{ marginTop: 14, marginBottom: 6 }}>
                  Dates à définir
                </p>
                {chronologie.sansDate.map((l) => (
                  <LigneChronologie key={l.lotUuid} lot={l} aujourdHui={aujourdHui} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function LigneLot({ lot }: { lot: LotItem }) {
  const fraction = lot.engage > 0 ? Math.min(100, Math.round((lot.paye / lot.engage) * 100)) : 0;
  return (
    <Link href={`/lots/${lot.lotUuid}`} className="item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div className="t">
        <span>{lot.nom}</span>
        <span className={`num ${lot.ecartBudget > 0.01 ? "bad" : "good"}`}>
          {lot.ecartBudget > 0 ? "+" : ""}
          {euros(lot.ecartBudget)}
        </span>
      </div>
      <div className="m">
        {lot.entreprise || "aucune entreprise retenue"} · {lot.nbDevis} devis · {lot.etat}
      </div>
      <div className="bar" style={{ margin: "8px 0 0" }}>
        <i style={{ width: `${fraction}%` }} />
      </div>
    </Link>
  );
}

function LigneChronologie({ lot, aujourdHui }: { lot: LotItem; aujourdHui: Date }) {
  const fin = parseFr(lot.finPrevue);
  const enRetard = !!fin && fin < aujourdHui && lot.avancementPct < 100;
  return (
    <Link href={`/lots/${lot.lotUuid}`} className="item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div className="t">
        <span style={enRetard ? { color: "var(--danger)" } : undefined}>{lot.nom}</span>
        <span className="sub">{lot.avancementPct}%</span>
      </div>
      <div className="m" style={enRetard ? { color: "var(--danger)" } : undefined}>
        {lot.debutPrevu || "début non défini"} → {lot.finPrevue || "fin non définie"}
        {enRetard ? " · en retard" : ""}
      </div>
      <div className="bar" style={{ margin: "8px 0 0" }}>
        <i style={{ width: `${Math.max(0, Math.min(100, lot.avancementPct))}%` }} />
      </div>
    </Link>
  );
}
