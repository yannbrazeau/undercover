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

const IconFacture = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V4a1 1 0 0 1 1.5-.9L9 4.5 11.5 3 14 4.5 16.5 3 19 4.5V21l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
const IconAvenant = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 12v5M9.5 14.5h5" />
  </svg>
);
const IconDossier = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

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
        <div className="pad top">
          <div className="info">Ce lot n&apos;existe pas ou a été supprimé.</div>
          <Link href="/lots" className="btn sec">
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
      <div className="pad top">
        {configured === false && <div className="info">La fiche du lot demande la connexion Google.</div>}
        {message && <div className="ok-block">{message}</div>}
        {error && (
          <div className="alert">
            <b>Ça n&apos;a pas abouti</b>
            {error}
          </div>
        )}
      </div>

      {fiche && (
        <>
          <div className="pad">
            <div className="card">
              <div className="row">
                <span className="k">Budget</span>
                <span className="v">{fiche.lot.budget > 0 ? euros(fiche.lot.budget) : <span className="mute">Non renseigné</span>}</span>
              </div>
              <div className="row">
                <span className="k">Engagé</span>
                <span className="v">{fiche.engage > 0 ? euros(fiche.engage) : <span className="mute">Aucun devis signé</span>}</span>
              </div>
              <div className="row">
                <span className="k">Facturé</span>
                <span className="v">{fiche.facture > 0 ? euros(fiche.facture) : <span className="mute">Aucune facture</span>}</span>
              </div>
              <div className="row">
                <span className="k">Payé</span>
                <span className="v">{fiche.paye > 0 ? euros(fiche.paye) : <span className="mute">Aucun paiement</span>}</span>
              </div>
            </div>
          </div>

          <p className="sect">Devis</p>
          <div className="pad">
            {fiche.devis.length === 0 && (
              <div className="empty">
                <span className="round">
                  <IconFacture />
                </span>
                <div>
                  <p className="t">Aucun devis reçu</p>
                  <p className="m">Rien n&apos;a encore été saisi pour ce lot.</p>
                </div>
              </div>
            )}
            {fiche.devis.length > 1 && (
              <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                Compare les montants et l&apos;écart au budget du lot, choisis celui qui te convainc, puis signe-le
                quand tu es prêt à t&apos;engager.
              </p>
            )}
            {fiche.devis.map((d) => {
              const ecart = d.ttc - fiche.lot.budget;
              const estEnConfirmation = confirmation?.devisId === d.id;
              return (
                <div className="card" key={d.id}>
                  <div className="l1">
                    <span className="n">
                      <span className="avatar">{(d.entreprise.trim()[0] || "?").toUpperCase()}</span> {d.entreprise}
                    </span>
                    <span className="a">{euros(d.ttc)}</span>
                  </div>
                  <div className="l2">
                    <span>
                      {d.id} · {d.statut}
                      {d.dateSignature ? ` le ${d.dateSignature}` : ""}
                    </span>
                    {fiche.lot.budget > 0 ? (
                      <span className={`st ${ecart > 0.01 ? "danger" : "ok"}`}>
                        {ecart > 0 ? "+" : ""}
                        {euros(ecart)} vs budget
                      </span>
                    ) : (
                      <span className="st mute">budget non renseigné</span>
                    )}
                  </div>
                  {d.driveUrl && (
                    <p className="hint">
                      <a href={d.driveUrl} target="_blank" rel="noreferrer">
                        Voir le devis signé
                      </a>
                    </p>
                  )}

                  {d.eligibleSignature && d.decennale !== "valide" && !estEnConfirmation && (
                    <div className="note warn">
                      <span className="dot warn" />
                      <p>
                        {d.decennale === "à réclamer"
                          ? "Décennale à réclamer avant de signer"
                          : `Décennale ${d.decennale} — à réclamer avant de signer`}
                      </p>
                    </div>
                  )}

                  {d.eligibleChoix && !estEnConfirmation && (
                    <button className="btn sec" disabled={busyId === d.id} onClick={() => choisir(d.id)}>
                      {busyId === d.id ? "Choix…" : "Choisir ce devis"}
                    </button>
                  )}

                  {d.eligibleSignature && !estEnConfirmation && (
                    <>
                      <label style={{ display: "block", cursor: "pointer", marginTop: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
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
                          : "Joindre le devis signé (PDF ou photo, optionnel)"}
                      </label>
                      <button className="btn" disabled={busyId === d.id} onClick={() => signer(d.id)}>
                        {busyId === d.id ? (envoiEnCours ? "Envoi du document…" : "Signature…") : "Signer ce devis"}
                      </button>
                    </>
                  )}

                  {estEnConfirmation && (
                    <div className="note warn">
                      <span className="dot warn" />
                      <div>
                        <p className="t">
                          Attestation décennale {confirmation.etatDecennale} pour {confirmation.entreprise}.
                        </p>
                        <p className="m">Signer quand même ?</p>
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setConfirmation(null)}>
                            Annuler
                          </button>
                          <button className="btn" style={{ marginTop: 0 }} onClick={() => signer(d.id, true, confirmation.driveUrl)}>
                            Signer quand même
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {aPrevenir.length > 0 && (
              <div className="card flat">
                <p className="lbl">Entreprises non retenues à prévenir</p>
                {aPrevenir.map((d) => (
                  <div className="check" key={d.id} onClick={() => prevenir(d.id)} style={{ cursor: "pointer" }}>
                    <span className="box" />
                    <span>
                      {d.entreprise} · {d.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {fiche.avenants.length > 0 && (
            <>
              <p className="sect">Avenants</p>
              <div className="pad">
                <div className="card">
                  {fiche.avenants.map((a) => (
                    <div className="row" key={a.id}>
                      <span className="k">
                        {a.description} <span className="mute">· {a.id}</span>
                      </span>
                      <span className="v">
                        {a.montantTTC > 0 ? "+" : ""}
                        {euros(a.montantTTC)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="sect">Factures</p>
          <div className="pad">
            {fiche.factures.length === 0 ? (
              <div className="empty">
                <span className="round">
                  <IconFacture />
                </span>
                <div>
                  <p className="t">Aucune facture enregistrée</p>
                  <p className="m">Rien n&apos;a encore été saisi pour ce lot.</p>
                </div>
              </div>
            ) : (
              <div className="card">
                {fiche.factures.map((f) => (
                  <div className="row" key={f.id}>
                    <span className="k">
                      {f.nature} <span className="mute">· {f.id}</span>
                    </span>
                    <span className="v">{euros(f.montantTTC)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="acts">
              <button type="button" className="act" onClick={() => router.push(`/ajouter?lot=${lotUuid}&kind=facture`)}>
                <span className="ic accent">
                  <IconFacture />
                </span>
                <div>
                  <p className="t">Enregistrer une facture</p>
                  <p className="m">Acompte, situation ou solde</p>
                </div>
                <i className="chev">
                  <IconChevron />
                </i>
              </button>
              <button type="button" className="act" onClick={() => router.push(`/ajouter?lot=${lotUuid}&kind=avenant`)}>
                <span className="ic accent">
                  <IconAvenant />
                </span>
                <div>
                  <p className="t">Saisir un avenant</p>
                  <p className="m">Seul moyen de faire évoluer l&apos;engagé</p>
                </div>
                <i className="chev">
                  <IconChevron />
                </i>
              </button>
            </div>
          </div>

          <p className="sect">Planning</p>
          <div className="pad">
            <div className="card">
              <label>Début prévu</label>
              <input className="field" type="date" value={debutPrevu} onChange={(e) => setDebutPrevu(e.target.value)} />
              <label>Fin prévue</label>
              <input className="field" type="date" value={finPrevue} onChange={(e) => setFinPrevue(e.target.value)} />
              <label>Avancement réel (%)</label>
              <input
                className="field"
                inputMode="numeric"
                value={avancementPct}
                onChange={(e) => setAvancementPct(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button className="btn sec" onClick={enregistrerPlanning} disabled={enregistrementPlanning}>
                {enregistrementPlanning ? "Enregistrement…" : "Enregistrer le planning"}
              </button>
            </div>
          </div>

          <div className="pad">
            {fiche.lot.driveFolderUrl && (
              <div className="acts">
                <a className="act" href={fiche.lot.driveFolderUrl} target="_blank" rel="noreferrer">
                  <span className="ic neutral">
                    <IconDossier />
                  </span>
                  <div>
                    <p className="t">Dossier de documents</p>
                    <p className="m">Devis, factures et photos du lot</p>
                  </div>
                  <i className="chev">
                    <IconChevron />
                  </i>
                </a>
              </div>
            )}

            {!confirmerSuppression ? (
              <button type="button" className="destroy" onClick={() => setConfirmerSuppression(true)}>
                Supprimer ce lot
              </button>
            ) : (
              <div className="note warn">
                <span className="dot warn" />
                <div>
                  <p className="t">Supprimer {fiche.lot.nom} ?</p>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setConfirmerSuppression(false)}>
                      Annuler
                    </button>
                    <button className="btn danger" style={{ marginTop: 0 }} onClick={supprimer}>
                      {suppression ? "Suppression…" : "Confirmer la suppression"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
