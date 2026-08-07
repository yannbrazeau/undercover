"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { computeFacture } from "@/lib/facture";
import { euros, todayFr } from "@/lib/format";

type LotOption = { uuid: string; nom: string; tauxTVA: number };
const NATURES = ["Acompte", "Situation d'avancement", "Solde"];

function num(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function AjouterPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [defaultRetenue, setDefaultRetenue] = useState("5");

  const [file, setFile] = useState<File | null>(null);
  const [lotUuid, setLotUuid] = useState("");
  const [nature, setNature] = useState(NATURES[0]);
  const [montantHT, setMontantHT] = useState("");
  const [tauxTVA, setTauxTVA] = useState("");
  const [tauxRetenue, setTauxRetenue] = useState("5");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/lots", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        if (status === 200) {
          setConfigured(true);
          setLots(d.lots ?? []);
          if (d.defaults?.tauxRetenue != null) {
            const t = String(d.defaults.tauxRetenue);
            setDefaultRetenue(t);
            setTauxRetenue(t);
          }
        } else {
          setConfigured(false);
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  const lot = lots.find((l) => l.uuid === lotUuid);
  const ht = num(montantHT);
  const montants = useMemo(
    () => computeFacture({ montantHT: ht, tauxTVA: num(tauxTVA), tauxRetenue: num(tauxRetenue) }),
    [ht, tauxTVA, tauxRetenue],
  );

  const onPickLot = (uuid: string) => {
    setLotUuid(uuid);
    const l = lots.find((x) => x.uuid === uuid);
    if (l && l.tauxTVA > 0) setTauxTVA(String(l.tauxTVA));
  };

  const canSubmit = configured === true && !!lotUuid && ht > 0 && !submitting;

  const submit = useCallback(async () => {
    setError("");
    setDone("");
    setSubmitting(true);
    try {
      let driveUrl = "";
      if (file) {
        const fd = new FormData();
        fd.append("lotUuid", lotUuid);
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Le dépôt du fichier a échoué.");
        driveUrl = upJson.upload?.url || "";
      }
      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotUuid,
          nature,
          montantHT: ht,
          tauxTVA: num(tauxTVA),
          tauxRetenue: num(tauxRetenue),
          date: todayFr(),
          driveUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "L'enregistrement a échoué.");
      setDone(`Facture ${json.facture.FACTURE_ID} enregistrée. Elle apparaît dans le lot.`);
      setMontantHT("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [file, lotUuid, nature, ht, tauxTVA, tauxRetenue]);

  return (
    <>
      <ScreenHeader eyebrow="Nouveau document" title="Ajouter" />
      <div className="screen-body">
        {done && <div className="ok">{done}</div>}
        {error && (
          <div className="alert">
            <b>L&apos;enregistrement n&apos;a pas abouti</b>
            <span>{error}</span>
          </div>
        )}

        <label className="drop" style={{ cursor: "pointer" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <b>Photographier</b>
          <span>{file ? file.name : "ou choisir un fichier"}</span>
        </label>

        <label>C&apos;est quoi ?</label>
        <div className="choice">
          <span className="on">Facture</span>
          <span style={{ opacity: 0.45 }}>Devis</span>
          <span style={{ opacity: 0.45 }}>Avenant</span>
        </div>

        <label>Pour quel lot ?</label>
        {configured === false ? (
          <div className="info">
            La liste des lots demande la connexion Google. Une fois les identifiants en place,
            elle se remplit toute seule.
          </div>
        ) : (
          <select
            className="field"
            value={lotUuid}
            onChange={(e) => onPickLot(e.target.value)}
            aria-label="Pour quel lot"
          >
            <option value="">Choisir un lot…</option>
            {lots.map((l) => (
              <option key={l.uuid} value={l.uuid}>
                {l.nom}
              </option>
            ))}
          </select>
        )}

        <label>Nature</label>
        <select className="field" value={nature} onChange={(e) => setNature(e.target.value)}>
          {NATURES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <label>Montant HT</label>
        <input
          className="field"
          inputMode="decimal"
          placeholder="0,00 €"
          value={montantHT}
          onChange={(e) => setMontantHT(e.target.value)}
        />

        <label>Taux de TVA</label>
        <input
          className="field"
          inputMode="decimal"
          placeholder="10 %"
          value={tauxTVA}
          onChange={(e) => setTauxTVA(e.target.value)}
        />

        <label>Retenue de garantie</label>
        <input
          className="field"
          inputMode="decimal"
          placeholder={`${defaultRetenue} %`}
          value={tauxRetenue}
          onChange={(e) => setTauxRetenue(e.target.value)}
        />

        {ht > 0 && (
          <div className="info num">
            Montant TTC {euros(montants.montantTTC)} · net à payer {euros(montants.netAPayer)}
            <br />
            {lot ? `Sera rangé dans ${lot.nom} → Factures` : "Choisissez un lot pour le classement"}
          </div>
        )}

        <button className="btn" onClick={submit} disabled={!canSubmit}>
          {submitting ? "Enregistrement…" : "Enregistrer la facture"}
        </button>
      </div>
    </>
  );
}
