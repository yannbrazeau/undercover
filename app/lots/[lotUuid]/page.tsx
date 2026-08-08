"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";
import { envoyerDocument } from "@/lib/upload";

type DevisItem = {
  id: string;
  entreprise: string;
  ttc: number;
  statut: string;
  dateSignature: string;
  driveUrl: string;
  decennale: string;
  entreprisePrevenue: boolean;
  eligibleSignature: boolean;
  eligibleChoix: boolean;
};

type FactureItem = {
  id: string;
  nature: string;
  numero: string;
  date: string;
  montantTTC: number;
  retenueGarantie: number;
  netAPayer: number;
  statut: string;
  resteDu: number;
  driveUrl: string;
};

type AvenantItem = { id: string; description: string; montantTTC: number; date: string };

type Fiche = {
  lot: {
    lotUuid: string;
    nom: string;
    perimetre: string;
    budget: number;
    responsable: string;
    driveFolderUrl: string;
    debutPrevu: string;
    finPrevue: string;
    avancementPct: number;
  };
  engage: number;
  facture: number;
  paye: number;
  resteAFacturer: number;
  devis: DevisItem[];
  factures: FactureItem[];
  avenants: AvenantItem[];
};

function normStatut(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function frToIso(fr: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

type Confirmation = { devisId: string; entreprise: string; etatDecennale: string; driveUrl: string } | null;

export default function FicheLotPage() {
  const params = useParams<{ lotUuid: string }>();
  const router = useRouter();
  const lotUuid = params.lotUuid;

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [debutPrevu, setDebutPrevu] = useState("");
  const [finPrevue, setFinPrevue] = useState("");
  const [avancementPct, setAvancementPct] = useState("0");
  const [enregistrementPlanning, setEnregistrementPlanning] = useState(false);

  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);

  const [fichiersSignature, setFichiersSignature] = useState<Record<string, File | null>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/lots/${lotUuid}`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        if (status === 404) {
          setNotFound(true);
          return;
        }
        setConfigured(status === 200);
        if (status === 200) {
          setFiche(d);
          setDebutPrevu(frToIso(d.lot.debutPrevu));
          setFinPrevue(frToIso(d.lot.finPrevue));
          setAvancementPct(String(d.lot.avancementPct ?? 0));
        }
      })
      .catch(() => setConfigured(false));
  }, [lotUuid]);

  useEffect(() => {
    charger();
  }, [charger]);

  const signer = useCallback(
    async (devisId: string, confirmerMalgreDecennale = false, driveUrlDejaEnvoye?: string) => {
      setError("");
      setMessage("");
      setBusyId(devisId);
      try {
        let driveUrl = driveUrlDejaEnvoye ?? "";
        const fichier = fichiersSignature[devisId];
        if (driveUrlDejaEnvoye === undefined && fichier) {
          setEnvoiEnCours(true);
          try {
            driveUrl = await envoyerDocument(lotUuid, fichier);
          } finally {
            setEnvoiEnCours(false);
          }
        }

        const res = await fetch("/api/devis/signer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId, confirmerMalgreDecennale, driveUrl }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La signature a échoué.");

        if (json.requiresConfirmation) {
          setConfirmation({ devisId, entreprise: json.entreprise, etatDecennale: json.etatDecennale, driveUrl });
          return;
        }

        setConfirmation(null);
        setFichiersSignature((prev) => ({ ...prev, [devisId]: null }));
        const nb = (json.ecartes ?? []).length;
        setMessage(
          `Devis ${devisId} signé${driveUrl ? ", document joint" : ""}.` +
            (nb > 0 ? ` ${nb} entreprise${nb > 1 ? "s" : ""} non retenue${nb > 1 ? "s" : ""} à prévenir.` : ""),
        );
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [charger, lotUuid, fichiersSignature],
  );

  const choisir = useCallback(
    async (devisId: string) => {
      setError("");
      setMessage("");
      setBusyId(devisId);
      try {
        const res = await fetch("/api/devis/choisir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Le choix a échoué.");

        const nb = (json.ecartes ?? []).length;
        setMessage(
          `Devis ${devisId} retenu.` +
            (nb > 0 ? ` ${nb} entreprise${nb > 1 ? "s" : ""} non retenue${nb > 1 ? "s" : ""} à prévenir.` : ""),
        );
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [charger],
  );

  const prevenir = useCallback(
    async (devisId: string) => {
      try {
        await fetch("/api/devis/prevenir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId }),
        });
        charger();
      } catch {
        setError("Impossible de marquer l'entreprise comme prévenue.");
      }
    },
    [charger],
  );

  const enregistrerPlanning = useCallback(async () => {
    setEnregistrementPlanning(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/lots/${lotUuid}/planning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debutPrevu,
          finPrevue,
          avancementPct: Number(avancementPct) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "L'enregistrement a échoué.");
      setMessage("Planning mis à jour.");
      charger();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnregistrementPlanning(false);
    }
  }, [lotUuid, debutPrevu, finPrevue, avancementPct, charger]);

  const supprimer = useCallback(async () => {
    setSuppression(true);
    setError("");
    try {
      const res = await fetch(`/api/lots/${lotUuid}/supprimer`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "La suppression a échoué.");
      router.push("/lots");
    } catch (e) {
      setError((e as Error).message);
      setSuppression(false);
    }
  }, [lotUuid, router]);

  if (notFound) {
    return (
      <>
        <ScreenHeader eyebrow="Lot" title="Introuvable" />
        <div className="screen-body">
          <div className="info">Ce lot n&apos;existe pas ou a été supprimé.</div>
          <Link href="/lots" className="btn sec" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
            Retour aux lots
          </Link>
        </div>
      </>
    );
  }

  const aPrevenir = fiche?.devis.filter((d) => normStatut(d.statut) === "ecarte" && !d.entreprisePrevenue) ?? [];

  return (
    <>
      <ScreenHeader eyebrow={fiche?.lot.perimetre || "Lot"} title={fiche?.lot.nom || "…"} />
      <div className="screen-body">
        {configured === false && <div className="info">La fiche du lot demande la connexion Google.</div>}
        {message && <div className="ok">{message}</div>}
        {error && (
          <div className="alert">
            <b>Ça n&apos;a pas abouti</b>
            <span>{error}</span>
          </div>
        )}

        {fiche && (
          <>
            <div className="card">
              <div className="row">
                <span className="k">Budget</span>
                <span className="v num">{euros(fiche.lot.budget)}</span>
              </div>
              <div className="row">
                <span className="k">Engagé</span>
                <span className="v num">{euros(fiche.engage)}</span>
              </div>
              <div className="row">
                <span className="k">Facturé</span>
                <span className="v num">{euros(fiche.facture)}</span>
              </div>
              <div className="row">
                <span className="k">Payé</span>
                <span className="v num">{euros(fiche.paye)}</span>
              </div>
            </div>

            <div className="choice">
              <span onClick={() => router.push(`/ajouter?lot=${lotUuid}&kind=facture`)}>
                Enregistrer une facture
              </span>
              <span onClick={() => router.push(`/ajouter?lot=${lotUuid}&kind=avenant`)}>Saisir un avenant</span>
            </div>

            <div className="card">
              <h4>Devis</h4>
              {fiche.devis.length > 1 && (
                <p className="lead">
                  Compare les montants et l&apos;écart au budget du lot, choisis celui qui te
                  convainc, puis signe-le quand tu es prêt à t&apos;engager.
                </p>
              )}
              {fiche.devis.length === 0 && <p className="sub">Aucun devis reçu pour ce lot.</p>}
              {fiche.devis.map((d) => {
                const ecart = d.ttc - fiche.lot.budget;
                const estEnConfirmation = confirmation?.devisId === d.id;
                return (
                  <div className="item" key={d.id}>
                    <div className="t">
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="avatar">{(d.entreprise.trim()[0] || "?").toUpperCase()}</span>
                        {d.entreprise} <span className="sub">— {d.id}</span>
                      </span>
                      <span className="num">{euros(d.ttc)}</span>
                    </div>
                    <div className="m">
                      <span className="pill">{d.statut}</span>{" "}
                      {d.eligibleSignature && d.decennale !== "valide" && (
                        <span className="pill warn">décennale {d.decennale}</span>
                      )}{" "}
                      {fiche.lot.budget > 0 ? (
                        <span className={ecart > 0.01 ? "bad" : "good"}>
                          {ecart > 0 ? "+" : ""}
                          {euros(ecart)} vs budget du lot
                        </span>
                      ) : (
                        <span className="sub">budget du lot non renseigné</span>
                      )}
                      {d.driveUrl && (
                        <>
                          {" · "}
                          <a href={d.driveUrl} target="_blank" rel="noreferrer">
                            devis signé
                          </a>
                        </>
                      )}
                    </div>

                    {d.eligibleChoix && !estEnConfirmation && (
                      <button
                        className="btn sec"
                        style={{ marginTop: 8 }}
                        disabled={busyId === d.id}
                        onClick={() => choisir(d.id)}
                      >
                        {busyId === d.id ? "Choix…" : "Choisir ce devis"}
                      </button>
                    )}

                    {d.eligibleSignature && !estEnConfirmation && (
                      <>
                        <label className="lead" style={{ display: "block", cursor: "pointer", marginTop: 8, marginBottom: 0 }}>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            hidden
                            onChange={(e) =>
                              setFichiersSignature((prev) => ({ ...prev, [d.id]: e.target.files?.[0] ?? null }))
                            }
                          />
                          {fichiersSignature[d.id]
                            ? `Document joint : ${fichiersSignature[d.id]!.name}`
                            : "Joindre le devis signé (PDF ou photo) — optionnel"}
                        </label>
                        <button
                          className="btn sec"
                          style={{ marginTop: 8 }}
                          disabled={busyId === d.id}
                          onClick={() => signer(d.id)}
                        >
                          {busyId === d.id
                            ? envoiEnCours
                              ? "Envoi du document…"
                              : "Signature…"
                            : "Signer ce devis"}
                        </button>
                      </>
                    )}

                    {estEnConfirmation && (
                      <div className="warn" style={{ marginTop: 8 }}>
                        <b style={{ display: "block", marginBottom: 6 }}>
                          Attestation décennale {confirmation.etatDecennale} pour {confirmation.entreprise}.
                        </b>
                        Signer quand même ?
                        <div className="choice" style={{ marginTop: 10, marginBottom: 0 }}>
                          <span onClick={() => setConfirmation(null)}>Annuler</span>
                          <span className="on" onClick={() => signer(d.id, true, confirmation.driveUrl)}>
                            Signer quand même
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {aPrevenir.length > 0 && (
                <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <p className="sub" style={{ marginBottom: 6 }}>
                    Entreprises non retenues à prévenir
                  </p>
                  {aPrevenir.map((d) => (
                    <div className="check" key={d.id} onClick={() => prevenir(d.id)} style={{ cursor: "pointer" }}>
                      <span className="box" />
                      <span>
                        {d.entreprise} — {d.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {fiche.avenants.length > 0 && (
              <div className="card">
                <h4>Avenants</h4>
                {fiche.avenants.map((a) => (
                  <div className="item" key={a.id}>
                    <div className="t">
                      <span>{a.description}</span>
                      <span className="num">
                        {a.montantTTC > 0 ? "+" : ""}
                        {euros(a.montantTTC)}
                      </span>
                    </div>
                    <div className="m">
                      {a.id} · {a.date}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <h4>Factures</h4>
              {fiche.factures.length === 0 && <p className="sub">Aucune facture rattachée à ce lot.</p>}
              {fiche.factures.map((f) => (
                <div className="item" key={f.id}>
                  <div className="t">
                    <span>
                      {f.nature} <span className="sub">— {f.id}</span>
                    </span>
                    <span className="num">{euros(f.montantTTC)}</span>
                  </div>
                  <div className="m">
                    <span className="pill">{f.statut}</span> {f.date}
                    {f.resteDu > 0.01 ? ` · reste dû ${euros(f.resteDu)}` : ""}
                    {f.driveUrl && (
                      <>
                        {" · "}
                        <a href={f.driveUrl} target="_blank" rel="noreferrer">
                          document
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h4>Planning</h4>
              <label>Début prévu</label>
              <input
                className="field"
                type="date"
                value={debutPrevu}
                onChange={(e) => setDebutPrevu(e.target.value)}
              />
              <label>Fin prévue</label>
              <input className="field" type="date" value={finPrevue} onChange={(e) => setFinPrevue(e.target.value)} />
              <label>Avancement réel (%)</label>
              <input
                className="field"
                inputMode="numeric"
                value={avancementPct}
                onChange={(e) => setAvancementPct(e.target.value)}
              />
              <button className="btn sec" onClick={enregistrerPlanning} disabled={enregistrementPlanning}>
                {enregistrementPlanning ? "Enregistrement…" : "Enregistrer le planning"}
              </button>
            </div>

            {fiche.lot.driveFolderUrl && (
              <div className="card">
                <a href={fiche.lot.driveFolderUrl} target="_blank" rel="noreferrer">
                  Ouvrir le dossier de documents
                </a>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              {!confirmerSuppression ? (
                <button className="btn danger" onClick={() => setConfirmerSuppression(true)}>
                  Supprimer ce lot
                </button>
              ) : (
                <div className="warn">
                  <b style={{ display: "block", marginBottom: 6 }}>Supprimer {fiche.lot.nom} ?</b>
                  <div className="choice" style={{ marginTop: 4, marginBottom: 0 }}>
                    <span onClick={() => setConfirmerSuppression(false)}>Annuler</span>
                    <span className="on" onClick={supprimer}>
                      {suppression ? "Suppression…" : "Confirmer la suppression"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
