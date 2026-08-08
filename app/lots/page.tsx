"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ScreenHeader from "@/components/ScreenHeader";
import EchoMontant from "@/components/EchoMontant";
import { euros, parseMontantSaisi } from "@/lib/format";

type Etat = "dépassement" | "sous le budget" | "signé" | "expirés" | "à choisir" | "budget estimé";
type Tonalite = "danger" | "warn" | "ok" | "mute";

type LotItem = {
  lotUuid: string;
  nom: string;
  perimetre: string;
  budget: number;
  engage: number;
  facture: number;
  paye: number;
  entreprise: string;
  nbDevis: number;
  etat: Etat;
  etatTonalite: Tonalite;
  aLabel: string;
  aTonalite: Tonalite;
  l2Primaire: string;
  l2Secondaire: string | null;
  debutPrevu: string;
  finPrevue: string;
  avancementPct: number;
};

const ETAT_LABEL: Record<Etat, string> = {
  "dépassement": "Dépassement",
  "sous le budget": "Sous le budget",
  "signé": "Signé",
  "expirés": "Expirés",
  "à choisir": "À choisir",
  "budget estimé": "Budget estimé",
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
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const budgetSaisi = nouveauBudget.trim() === "" ? null : parseMontantSaisi(nouveauBudget);
  const budgetInvalide = nouveauBudget.trim() !== "" && budgetSaisi === null;

  const creerLot = useCallback(async () => {
    const nom = nouveauNom.trim();
    if (!nom || budgetInvalide) return;
    setCreation(true);
    setErreurCreation("");
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          budgetTTC: budgetSaisi ?? undefined,
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
  }, [nouveauNom, budgetSaisi, budgetInvalide, nouveauPerimetre, charger]);

  const lotsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((l) => l.nom.toLowerCase().includes(q));
  }, [lots, recherche]);

  const aujourdHui = useMemo(() => new Date(), []);

  const chronologie = useMemo(() => {
    const avecDate = lotsFiltres
      .filter((l) => parseFr(l.debutPrevu))
      .sort((a, b) => parseFr(a.debutPrevu)!.getTime() - parseFr(b.debutPrevu)!.getTime());
    const sansDate = lotsFiltres.filter((l) => !parseFr(l.debutPrevu));
    return { avecDate, sansDate };
  }, [lotsFiltres]);

  if (configured === false) {
    return (
      <>
        <ScreenHeader title="Lots" />
        <div className="pad top">
          <div className="info">La liste des lots demande la connexion Google, à établir dans Chantier.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader eyebrow={`${lots.length} lots`} title="Lots" />
      <div className="strip">
        <span className="k">Dépense prévue</span>
        <span className="v">{configured ? euros(depensePrevue) : "…"}</span>
      </div>
      <div className="pad top">
        <div className="tabs">
          <span className={vue === "liste" ? "on" : undefined} onClick={() => setVue("liste")}>
            Liste
          </span>
          <span className={vue === "chronologie" ? "on" : undefined} onClick={() => setVue("chronologie")}>
            Chronologie
          </span>
        </div>
        {vue === "liste" && (
          <input
            className="search"
            placeholder="Rechercher un lot"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        )}
      </div>

      {vue === "liste" && (
        <>
          <div className="pad">
            {lotsFiltres.map((l) => (
              <LigneLot key={l.lotUuid} lot={l} />
            ))}
          </div>
          <div className="pad">
            {!ajoutOuvert ? (
              <div className="acts">
                <button type="button" className="act" onClick={() => setAjoutOuvert(true)}>
                  <span className="ic accent">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <div>
                    <p className="t">Ajouter un lot</p>
                    <p className="m">Créer un poste de travaux et son dossier</p>
                  </div>
                  <i className="chev">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </i>
                </button>
              </div>
            ) : (
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
                  placeholder="90 000"
                  value={nouveauBudget}
                  onChange={(e) => setNouveauBudget(e.target.value)}
                />
                <EchoMontant brut={nouveauBudget} />
                <label>Périmètre</label>
                <input
                  className="field"
                  placeholder="Ce que couvre le lot"
                  value={nouveauPerimetre}
                  onChange={(e) => setNouveauPerimetre(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={creation || !nouveauNom.trim() || budgetInvalide}
                  onClick={creerLot}
                >
                  {creation ? "Création…" : "Créer le lot"}
                </button>
                <button type="button" className="destroy" onClick={() => setAjoutOuvert(false)}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {vue === "chronologie" && (
        <div className="pad">
          {chronologie.avecDate.map((l, i) => (
            <LigneChronologie key={l.lotUuid} lot={l} aujourdHui={aujourdHui} dernier={i === chronologie.avecDate.length - 1 && chronologie.sansDate.length === 0} />
          ))}
          {chronologie.sansDate.length > 0 && (
            <div className="empty">
              <span className="round">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2.5" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </span>
              <div>
                <p className="t">{chronologie.sansDate.length} lots sans date</p>
                <p className="m">Le planning général doit être fourni par HMP. Tu pourras saisir les dates lot par lot.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LigneLot({ lot }: { lot: LotItem }) {
  return (
    <Link href={`/lots/${lot.lotUuid}`} className="lot">
      <div className="l1">
        <span className="n">{lot.nom}</span>
        <span className={`a ${lot.aTonalite}`}>{lot.aLabel}</span>
      </div>
      <div className="l2">
        <span>{lot.l2Secondaire ? `${lot.l2Primaire} · ${lot.l2Secondaire}` : lot.l2Primaire}</span>
        <span className={`st ${lot.etatTonalite}`}>{ETAT_LABEL[lot.etat]}</span>
      </div>
    </Link>
  );
}

function LigneChronologie({ lot, aujourdHui, dernier }: { lot: LotItem; aujourdHui: Date; dernier: boolean }) {
  const fin = parseFr(lot.finPrevue);
  const enRetard = !!fin && fin < aujourdHui && lot.avancementPct < 100;
  const pointTonalite = enRetard ? "warn" : lot.avancementPct > 0 ? "on" : "";
  return (
    <Link href={`/lots/${lot.lotUuid}`} className={`tl${dernier ? " last" : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
      <span className={`pt ${pointTonalite}`} />
      <div className="tc">
        <p className="d">
          {lot.debutPrevu} au {lot.finPrevue || "date de fin non définie"}
        </p>
        <p className="n">{lot.nom}</p>
        {lot.avancementPct > 0 ? (
          <>
            <p className="m">Avancement {lot.avancementPct} %</p>
            <div className="bar thin">
              <i style={{ width: `${Math.max(0, Math.min(100, lot.avancementPct))}%` }} />
            </div>
          </>
        ) : (
          <p className={`m st ${lot.etatTonalite}`}>{lot.l2Primaire}</p>
        )}
      </div>
    </Link>
  );
}
