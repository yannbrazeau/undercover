"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [depensePrevue, setDepensePrevue] = useState(0);
  const [ilVousReste, setIlVousReste] = useState(0);
  const [budgetContractuel, setBudgetContractuel] = useState(0);
  const [vue, setVue] = useState<"liste" | "chronologie">("liste");
  const [recherche, setRecherche] = useState("");

  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauBudget, setNouveauBudget] = useState("");
  const [nouveauPerimetre, setNouveauPerimetre] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState("");

  const charger = useCallback(() => {
    fetch("/api/lots/liste", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) {
          setLots(d.lots ?? []);
          setDepensePrevue(d.depensePrevue ?? 0);
          setIlVousReste(d.ilVousReste ?? 0);
          setBudgetContractuel(d.budgetContractuel ?? 0);
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const creerLot = useCallback(async () => {
    const nom = nouveauNom.trim();
    if (!nom) return;
    setCreation(true);
    setErreurCreation("");
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          budgetTTC: nouveauBudget ? Number(nouveauBudget.replace(",", ".")) : undefined,
          perimetre: nouveauPerimetre,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "La création a échoué.");
      setNouveauNom("");
      setNouveauBudget("");
      setNouveauPerimetre("");
      setAjoutOuvert(false);
      charger();
    } catch (e) {
      setErreurCreation((e as Error).message);
    } finally {
      setCreation(false);
    }
  }, [nouveauNom, nouveauBudget, nouveauPerimetre, charger]);

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
        <span className="l">Dépense prévue · il vous reste</span>
        <span className="r">
          {configured ? (
            <>
              {euros(depensePrevue)}{" "}
              <span style={{ color: ilVousReste < 0 ? "var(--danger)" : "var(--ok)" }}>
                {ilVousReste < 0 ? "" : "+"}
                {euros(ilVousReste)}
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

        {!ajoutOuvert && (
          <button className="btn sec" style={{ marginBottom: 14 }} onClick={() => setAjoutOuvert(true)}>
            Ajouter un lot
          </button>
        )}

        {ajoutOuvert && (
          <div className="card">
            <h4>Nouveau lot</h4>
            {erreurCreation && (
              <div className="alert">
                <b>La création n&apos;a pas abouti</b>
                <span>{erreurCreation}</span>
              </div>
            )}
            <label>Nom</label>
            <input
              className="field"
              placeholder="Panneaux solaires"
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
            />
            <label>Budget TTC estimé</label>
            <input
              className="field"
              inputMode="decimal"
              placeholder="0,00 €"
              value={nouveauBudget}
              onChange={(e) => setNouveauBudget(e.target.value)}
            />
            <label>Périmètre</label>
            <input
              className="field"
              placeholder="Ce que couvre le lot"
              value={nouveauPerimetre}
              onChange={(e) => setNouveauPerimetre(e.target.value)}
            />
            <div className="choice" style={{ marginBottom: 0 }}>
              <span onClick={() => setAjoutOuvert(false)}>Annuler</span>
              <span className="on" onClick={creerLot}>
                {creation ? "Création…" : "Créer le lot"}
              </span>
            </div>
          </div>
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
        {lot.budget > 0 ? (
          <span className={`num ${lot.ecartBudget > 0.01 ? "bad" : "good"}`}>
            {lot.ecartBudget > 0 ? "+" : ""}
            {euros(lot.ecartBudget)}
          </span>
        ) : (
          <span className="sub">budget non renseigné</span>
        )}
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
