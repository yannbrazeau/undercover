"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { computeFacture } from "@/lib/facture";
import { euros, todayFr } from "@/lib/format";

type LotOption = { uuid: string; nom: string };
type FactureOuverte = {
  id: string;
  lot: string;
  entreprise: string;
  nature: string;
  netAPayer: number;
  resteDu: number;
};

const NATURES = ["Acompte", "Situation d'avancement", "Solde"];
const MOYENS = ["Virement", "Chèque", "Espèces", "Autre"];
const KINDS = [
  { key: "facture", label: "Facture", enabled: true },
  { key: "paiement", label: "Paiement", enabled: true },
  { key: "avenant", label: "Avenant", enabled: true },
  { key: "devis", label: "Devis", enabled: false },
] as const;
type Kind = (typeof KINDS)[number]["key"];

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
  const [facturesOuvertes, setFacturesOuvertes] = useState<FactureOuverte[]>([]);

  const [kind, setKind] = useState<Kind>("facture");

  // Facture
  const [file, setFile] = useState<File | null>(null);
  const [lotUuid, setLotUuid] = useState("");
  const [nature, setNature] = useState(NATURES[0]);
  const [montantTTC, setMontantTTC] = useState("");
  const [tauxRetenue, setTauxRetenue] = useState("5");
  const fileRef = useRef<HTMLInputElement>(null);

  // Paiement
  const [factureId, setFactureId] = useState("");
  const [montantPaiement, setMontantPaiement] = useState("");
  const [moyen, setMoyen] = useState(MOYENS[0]);
  const [reference, setReference] = useState("");

  // Avenant
  const [avenantDescription, setAvenantDescription] = useState("");
  const [avenantMontant, setAvenantMontant] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [alerte, setAlerte] = useState("");

  const chargerListes = useCallback(() => {
    Promise.all([
      fetch("/api/lots", { cache: "no-store" }).then((r) => r.json().then((d) => ({ status: r.status, d }))),
      fetch("/api/factures", { cache: "no-store" }).then((r) => r.json().then((d) => ({ status: r.status, d }))),
    ])
      .then(([lotsRes, facRes]) => {
        setConfigured(lotsRes.status === 200);
        if (lotsRes.status === 200) {
          setLots(lotsRes.d.lots ?? []);
          if (lotsRes.d.defaults?.tauxRetenue != null) setTauxRetenue(String(lotsRes.d.defaults.tauxRetenue));
        }
        if (facRes.status === 200) setFacturesOuvertes(facRes.d.factures ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    chargerListes();
  }, [chargerListes]);

  const lot = lots.find((l) => l.uuid === lotUuid);
  const ttc = num(montantTTC);
  const montants = useMemo(
    () => computeFacture({ montantTTC: ttc, tauxRetenue: num(tauxRetenue) }),
    [ttc, tauxRetenue],
  );

  const factureAPayer = facturesOuvertes.find((f) => f.id === factureId);
  const montantRegle = num(montantPaiement);
  const resteApres = factureAPayer ? Math.max(0, Math.round((factureAPayer.resteDu - montantRegle) * 100) / 100) : 0;

  const onPickFacture = (id: string) => {
    setFactureId(id);
    const f = facturesOuvertes.find((x) => x.id === id);
    if (f) setMontantPaiement(String(f.resteDu));
  };

  const clearFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const resetMessages = () => {
    setError("");
    setDone("");
    setAlerte("");
  };

  const montantAvenant = num(avenantMontant);
  const canSubmitFacture = configured === true && !!lotUuid && ttc > 0 && !submitting;
  const canSubmitPaiement = configured === true && !!factureId && montantRegle > 0 && !submitting;
  const canSubmitAvenant =
    configured === true && !!lotUuid && !!avenantDescription.trim() && montantAvenant !== 0 && !submitting;
  const canSubmit =
    kind === "facture"
      ? canSubmitFacture
      : kind === "paiement"
        ? canSubmitPaiement
        : kind === "avenant"
          ? canSubmitAvenant
          : false;

  const submitFacture = useCallback(async () => {
    let driveUrl = "";
    if (file) {
      if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux.");

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

      const result = await uploadViaChunks(String(initJson.sessionUri), file);
      driveUrl = result?.webViewLink || (result?.id ? `https://drive.google.com/file/d/${result.id}/view` : "");
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
    const alerteJson = json.alerte as { message?: string } | null;
    if (alerteJson?.message) setAlerte(alerteJson.message);
    setMontantTTC("");
    clearFile();
  }, [file, lotUuid, nature, ttc, tauxRetenue]);

  const submitAvenant = useCallback(async () => {
    const res = await fetch("/api/avenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotUuid,
        description: avenantDescription,
        montantTTC: montantAvenant,
        date: todayFr(),
      }),
    });
    const json = await readJson(res);
    if (!res.ok) throw new Error(String(json.error) || "L'enregistrement a échoué.");

    const ave = json.avenant as { AVENANT_ID?: string } | undefined;
    setDone(`Avenant ${ave?.AVENANT_ID ?? ""} enregistré. L'engagé du lot est mis à jour.`);
    setAvenantDescription("");
    setAvenantMontant("");
  }, [lotUuid, avenantDescription, montantAvenant]);

  const submitPaiement = useCallback(async () => {
    const res = await fetch("/api/paiements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factureId,
        montant: montantRegle,
        date: todayFr(),
        moyen,
        reference,
      }),
    });
    const json = await readJson(res);
    if (!res.ok) throw new Error(String(json.error) || "L'enregistrement a échoué.");

    const soldee = json.statut === "payée";
    setDone(
      soldee
        ? `Paiement enregistré. La facture ${factureId} est soldée.`
        : `Paiement enregistré. Reste dû sur ${factureId} : ${euros(json.resteDu as number)}.`,
    );
    setFactureId("");
    setMontantPaiement("");
    setReference("");
  }, [factureId, montantRegle, moyen, reference]);

  const submit = useCallback(async () => {
    resetMessages();
    setSubmitting(true);
    try {
      if (kind === "facture") await submitFacture();
      else if (kind === "paiement") await submitPaiement();
      else if (kind === "avenant") await submitAvenant();
      chargerListes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [kind, submitFacture, submitPaiement, submitAvenant, chargerListes]);

  return (
    <>
      <ScreenHeader eyebrow="Nouveau document" title="Ajouter" />
      <div className="screen-body">
        {done && <div className="ok">{done}</div>}
        {alerte && (
          <div className="alert">
            <b>Dépassement du marché signé</b>
            <span>{alerte}</span>
          </div>
        )}
        {error && (
          <div className="alert">
            <b>L&apos;enregistrement n&apos;a pas abouti</b>
            <span>{error}</span>
          </div>
        )}

        {kind === "facture" && (
          <>
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
          </>
        )}

        <label>C&apos;est quoi ?</label>
        <div className="choice">
          {KINDS.map((k) => (
            <span
              key={k.key}
              className={kind === k.key ? "on" : undefined}
              style={{ opacity: k.enabled ? 1 : 0.45, cursor: k.enabled ? "pointer" : "default" }}
              onClick={() => {
                if (!k.enabled) return;
                resetMessages();
                setKind(k.key);
              }}
            >
              {k.label}
            </span>
          ))}
        </div>

        {kind === "facture" && (
          <>
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
          </>
        )}

        {kind === "paiement" && (
          <>
            <label>Quelle facture régler ?</label>
            {configured === false ? (
              <div className="info">
                La liste des factures demande la connexion Google.
              </div>
            ) : facturesOuvertes.length === 0 ? (
              <div className="info">Aucune facture en attente de règlement pour le moment.</div>
            ) : (
              <select
                className="field"
                value={factureId}
                onChange={(e) => onPickFacture(e.target.value)}
                aria-label="Quelle facture régler"
              >
                <option value="">Choisir une facture…</option>
                {facturesOuvertes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.entreprise} — {f.nature} — {euros(f.resteDu)} restant ({f.lot})
                  </option>
                ))}
              </select>
            )}

            <label>Montant réglé</label>
            <input
              className="field"
              inputMode="decimal"
              placeholder="0,00 €"
              value={montantPaiement}
              onChange={(e) => setMontantPaiement(e.target.value)}
            />

            <label>Moyen</label>
            <select className="field" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
              {MOYENS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label>Référence</label>
            <input
              className="field"
              placeholder="Numéro de virement, par exemple"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />

            {factureAPayer && montantRegle > 0 && (
              <div className="info num">
                {resteApres <= 0
                  ? "Facture soldée après ce paiement."
                  : `Reste dû après ce paiement : ${euros(resteApres)}.`}
              </div>
            )}
          </>
        )}

        {kind === "avenant" && (
          <>
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

            <label>Description</label>
            <input
              className="field"
              placeholder="Reprise de fondations non prévue au devis"
              value={avenantDescription}
              onChange={(e) => setAvenantDescription(e.target.value)}
            />

            <label>Montant TTC</label>
            <input
              className="field"
              inputMode="decimal"
              placeholder="Positif ou négatif, ex. -500"
              value={avenantMontant}
              onChange={(e) => setAvenantMontant(e.target.value)}
            />

            {montantAvenant !== 0 && (
              <div className="info num">
                {montantAvenant > 0
                  ? `Augmente l'engagé du lot de ${euros(montantAvenant)}.`
                  : `Diminue l'engagé du lot de ${euros(Math.abs(montantAvenant))}.`}
              </div>
            )}
          </>
        )}

        <button className="btn" onClick={submit} disabled={!canSubmit}>
          {submitting
            ? "Enregistrement…"
            : kind === "paiement"
              ? "Enregistrer le paiement"
              : kind === "avenant"
                ? "Enregistrer l'avenant"
                : "Enregistrer la facture"}
        </button>
      </div>
    </>
  );
}
