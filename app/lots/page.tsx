"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";

type DevisItem = {
  id: string;
  lotUuid: string;
  lot: string;
  entreprise: string;
  ttc: number;
  statut: string;
  decennale: string;
  entreprisePrevenue: boolean;
};

function normStatut(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Confirmation = { devisId: string; entreprise: string; etatDecennale: string } | null;

export default function LotsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [devis, setDevis] = useState<DevisItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const charger = useCallback(() => {
    fetch("/api/devis", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) setDevis(d.devis ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const parLot = useMemo(() => {
    const map = new Map<string, { lot: string; devis: DevisItem[] }>();
    for (const d of devis) {
      if (!map.has(d.lotUuid)) map.set(d.lotUuid, { lot: d.lot, devis: [] });
      map.get(d.lotUuid)!.devis.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.lot.localeCompare(b.lot));
  }, [devis]);

  const signer = useCallback(
    async (devisId: string, confirmerMalgreDecennale = false) => {
      setError("");
      setMessage("");
      setBusyId(devisId);
      try {
        const res = await fetch("/api/devis/signer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId, confirmerMalgreDecennale }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La signature a échoué.");

        if (json.requiresConfirmation) {
          setConfirmation({ devisId, entreprise: json.entreprise, etatDecennale: json.etatDecennale });
          return;
        }

        setConfirmation(null);
        const nb = (json.ecartes ?? []).length;
        setMessage(
          `Devis ${devisId} signé.` +
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

  return (
    <>
      <ScreenHeader eyebrow="24 lots" title="Lots" />
      <div className="sticky">
        <span className="l">Scénario · écart au budget</span>
        <span className="r">—</span>
      </div>
      <div className="screen-body">
        <div className="tabs">
          <span className="on">Liste</span>
          <span>Chronologie</span>
        </div>

        <div className="info">
          Vue provisoire — pour signer un devis et tester les garde-fous. La liste, la
          recherche et la fiche complète du lot arrivent à l&apos;étape suivante.
        </div>

        {message && <div className="ok">{message}</div>}
        {error && (
          <div className="alert">
            <b>Ça n&apos;a pas abouti</b>
            <span>{error}</span>
          </div>
        )}

        {configured === false && (
          <div className="info">La liste des devis demande la connexion Google.</div>
        )}

        {parLot.map(({ lot, devis: devisDuLot }) => {
          const aPrevenir = devisDuLot.filter(
            (d) => normStatut(d.statut) === "ecarte" && !d.entreprisePrevenue,
          );
          return (
            <div className="card" key={devisDuLot[0]?.lotUuid || lot}>
              <h4>{lot}</h4>
              {devisDuLot.map((d) => {
                const estEligible = ["recu", "a corriger", "retenu"].includes(normStatut(d.statut));
                const estEnConfirmation = confirmation?.devisId === d.id;
                return (
                  <div className="item" key={d.id}>
                    <div className="t">
                      <span>
                        {d.entreprise} <span className="sub">— {d.id}</span>
                      </span>
                      <span className="num">{euros(d.ttc)}</span>
                    </div>
                    <div className="m">
                      <span className="pill">{d.statut}</span>
                      {estEligible && d.decennale !== "valide" && (
                        <span className="pill warn" style={{ marginLeft: 6 }}>
                          décennale {d.decennale}
                        </span>
                      )}
                    </div>

                    {estEligible && !estEnConfirmation && (
                      <button
                        className="btn sec"
                        style={{ marginTop: 8 }}
                        disabled={busyId === d.id}
                        onClick={() => signer(d.id)}
                      >
                        {busyId === d.id ? "Signature…" : "Signer ce devis"}
                      </button>
                    )}

                    {estEnConfirmation && (
                      <div className="notice" style={{ marginTop: 8 }}>
                        <b style={{ display: "block", marginBottom: 6 }}>
                          Attestation décennale {confirmation.etatDecennale} pour {confirmation.entreprise}.
                        </b>
                        Signer quand même ?
                        <div className="choice" style={{ marginTop: 10, marginBottom: 0 }}>
                          <span onClick={() => setConfirmation(null)}>Annuler</span>
                          <span className="on" onClick={() => signer(d.id, true)}>
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
          );
        })}
      </div>
    </>
  );
}
