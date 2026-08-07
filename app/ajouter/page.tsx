"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { computeFacture } from "@/lib/facture";
import { euros, todayFr } from "@/lib/format";

type LotOption = { uuid: string; nom: string };
const NATURES = ["Acompte", "Situation d'avancement", "Solde"];

const CHUNK_SIZE = 3 * 1024 * 1024; // 3 Mo, multiple de 256 Kio (exigé par Google)
const MAX_FILE_BYTES = 50 * 1024 * 1024; // garde-fou, pas une vraie limite technique

/**
 * Envoie le fichier par morceaux via notre propre serveur (jamais directement à
 * Google depuis le navigateur, qui refuse cet envoi cross-site). Chaque morceau
 * passe sous la limite de l'hébergeur, donc la taille totale n'est plus un problème.
 */
async function uploadViaChunks(
  sessionUri: string,
  file: File,
): Promise<{ id?: string; webViewLink?: string } | null> {
  const total = file.size;
  let start = 0;

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = file.slice(start, end);

    const res = await fetch("/api/upload-chunk", {
      method: "PUT",
      headers: {
        "x-session-uri": sessionUri,
        "x-content-range": `bytes ${start}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    if (res.status === 308) {
      const range = res.headers.get("range"); // "bytes=0-3145727"
      const m = range ? /bytes=\d+-(\d+)/.exec(range) : null;
      start = m ? parseInt(m[1], 10) + 1 : end;
      continue;
    }
    if (res.ok) {
      return res.json().catch(() => null);
    }

    const errJson = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new Error(String(errJson.error) || `L'envoi du fichier a échoué (${res.status}).`);
  }
  return null;
}

function num(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Lecture de réponse tolérante : si ce n'est pas du JSON (erreur d'hôte…), on renvoie le texte. */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) || `Erreur ${res.status}` };
  }
}

export default function AjouterPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lots, setLots] = useState<LotOption[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [lotUuid, setLotUuid] = useState("");
  const [nature, setNature] = useState(NATURES[0]);
  const [montantTTC, setMontantTTC] = useState("");
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
          if (d.defaults?.tauxRetenue != null) setTauxRetenue(String(d.defaults.tauxRetenue));
        } else {
          setConfigured(false);
        }
      })
      .catch(() => setConfigured(false));
  }, []);

  const lot = lots.find((l) => l.uuid === lotUuid);
  const ttc = num(montantTTC);
  const montants = useMemo(
    () => computeFacture({ montantTTC: ttc, tauxRetenue: num(tauxRetenue) }),
    [ttc, tauxRetenue],
  );

  const clearFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSubmit = configured === true && !!lotUuid && ttc > 0 && !submitting;

  const submit = useCallback(async () => {
    setError("");
    setDone("");
    setSubmitting(true);
    try {
      let driveUrl = "";
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux.");

        // 1) Le serveur ouvre une session d'envoi Drive.
        const init = await fetch("/api/upload-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lotUuid,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
          }),
        });
        const initJson = await readJson(init);
        if (!init.ok) throw new Error(String(initJson.error) || "L'envoi du fichier n'a pas pu démarrer.");

        // 2) Le fichier part par morceaux, relayés par notre serveur — aucune
        //    limite de taille, et aucun appel direct du navigateur vers Google.
        const result = await uploadViaChunks(String(initJson.sessionUri), file);
        driveUrl =
          result?.webViewLink ||
          (result?.id ? `https://drive.google.com/file/d/${result.id}/view` : "");
      }

      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotUuid,
          nature,
          montantTTC: ttc,
          tauxRetenue: num(tauxRetenue),
          date: todayFr(),
          driveUrl,
        }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(String(json.error) || "L'enregistrement a échoué.");

      const fac = json.facture as { FACTURE_ID?: string } | undefined;
      setDone(`Facture ${fac?.FACTURE_ID ?? ""} enregistrée. Elle apparaît dans le lot.`);
      setMontantTTC("");
      clearFile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [file, lotUuid, nature, ttc, tauxRetenue]);

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
        {file && (
          <button
            type="button"
            onClick={clearFile}
            style={{
              background: "none",
              border: 0,
              color: "var(--accent)",
              fontFamily: "inherit",
              fontSize: "var(--fs-secondary)",
              padding: "0 0 14px",
              cursor: "pointer",
            }}
          >
            Retirer le fichier
          </button>
        )}

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
            onChange={(e) => setLotUuid(e.target.value)}
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

        <label>Montant TTC</label>
        <input
          className="field"
          inputMode="decimal"
          placeholder="0,00 €"
          value={montantTTC}
          onChange={(e) => setMontantTTC(e.target.value)}
        />

        <label>Retenue de garantie</label>
        <input
          className="field"
          inputMode="decimal"
          placeholder="5 %"
          value={tauxRetenue}
          onChange={(e) => setTauxRetenue(e.target.value)}
        />

        {ttc > 0 && (
          <div className="info num">
            Retenue {euros(montants.retenueGarantie)} · net à payer {euros(montants.netAPayer)}
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
