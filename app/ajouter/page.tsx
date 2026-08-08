"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { computeFacture } from "@/lib/facture";
import { euros, todayFr } from "@/lib/format";
import { envoyerDocument, readJson } from "@/lib/upload";

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

const IconFacture = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V4a1 1 0 0 1 1.5-.9L9 4.5 11.5 3 14 4.5 16.5 3 19 4.5V21l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
const IconPaiement = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 5.5A7 7 0 0 0 7 12a7 7 0 0 0 10 6.5" />
    <path d="M3.5 10h8M3.5 14h8" />
  </svg>
);
const IconAvenant = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 12v5M9.5 14.5h5" />
  </svg>
);
const IconDevis = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
const IconPhoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
const IconAutre = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="5" cy="12" r="0.5" />
    <circle cx="12" cy="12" r="0.5" />
    <circle cx="19" cy="12" r="0.5" />
  </svg>
);

const KINDS = [
  { key: "facture", label: "Facture", Icon: IconFacture, disponible: true },
  { key: "paiement", label: "Paiement", Icon: IconPaiement, disponible: true },
  { key: "avenant", label: "Avenant", Icon: IconAvenant, disponible: true },
  { key: "devis", label: "Devis", Icon: IconDevis, disponible: false },
  { key: "photo", label: "Photo", Icon: IconPhoto, disponible: false },
  { key: "autre", label: "Autre", Icon: IconAutre, disponible: false },
] as const;
type Kind = (typeof KINDS)[number]["key"];

function num(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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

  // Arrivée depuis « Enregistrer une facture » / « Saisir un avenant » sur la
  // fiche d'un lot : préremplit le lot et le type de document.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const lotParam = qs.get("lot");
    const kindParam = qs.get("kind");
    if (lotParam) setLotUuid(lotParam);
    if (kindParam === "facture" || kindParam === "paiement" || kindParam === "avenant") {
      setKind(kindParam);
    }
  }, []);

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
    const driveUrl = file ? await envoyerDocument(lotUuid, file) : "";

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

  const kindActuel = KINDS.find((k) => k.key === kind)!;

  return (
    <>
      <ScreenHeader title="Ajouter" />
      <div className="pad top">
        {done && <div className="ok-block">{done}</div>}
        {alerte && (
          <div className="alert">
            <b>Dépassement du devis signé</b>
            {alerte}
          </div>
        )}
        {error && (
          <div className="alert">
            <b>L&apos;enregistrement n&apos;a pas abouti</b>
            {error}
          </div>
        )}

        {kindActuel.disponible && (kind === "facture" || kind === "avenant") && (
          <label className="drop">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <i className="ic">
              <IconPhoto />
            </i>
            <p className="t">Photographier</p>
            <p className="m">{file ? file.name : "ou choisir un fichier"}</p>
          </label>
        )}
        {file && (
          <button type="button" className="destroy" onClick={clearFile} style={{ marginTop: -10, marginBottom: 10 }}>
            Retirer le fichier
          </button>
        )}

        <p className="lbl">C&apos;est quoi ?</p>
        <div className="tiles">
          {KINDS.map((k) => (
            <span
              key={k.key}
              className={kind === k.key ? "on" : undefined}
              onClick={() => {
                resetMessages();
                setKind(k.key);
              }}
            >
              <i>
                <k.Icon />
              </i>
              {k.label}
            </span>
          ))}
        </div>

        {!kindActuel.disponible && (
          <div className="empty">
            <span className="round">
              <IconAutre />
            </span>
            <div>
              <p className="t">Pas encore disponible</p>
              <p className="m">
                L&apos;ajout de {kindActuel.label.toLowerCase()} n&apos;est pas encore relié au classeur. Utilise
                Facture, Paiement ou Avenant en attendant.
              </p>
            </div>
          </div>
        )}

        {kind === "facture" && (
          <>
            <p className="lbl">Pour quel lot ?</p>
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

            <p className="lbl">Nature</p>
            <select className="field" value={nature} onChange={(e) => setNature(e.target.value)}>
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <p className="lbl">Montant TTC</p>
            <input
              className="field"
              inputMode="decimal"
              placeholder="0,00 €"
              value={montantTTC}
              onChange={(e) => setMontantTTC(e.target.value)}
            />

            <p className="lbl">Retenue de garantie</p>
            <div className="field calcField">
              <input
                inputMode="decimal"
                placeholder="5"
                value={tauxRetenue}
                onChange={(e) => setTauxRetenue(e.target.value)}
                style={{ border: 0, outline: "none", width: 60, font: "inherit", background: "none" }}
              />
              <span>%</span>
              {ttc > 0 && <span className="calc">soit {euros(montants.retenueGarantie)}</span>}
            </div>

            {ttc > 0 && (
              <div className="recap">
                <p className="t">Net à payer {euros(montants.netAPayer)}</p>
                <p className="m">{lot ? `Sera rangé dans ${lot.nom}, dossier Factures` : "Choisis un lot pour le classement"}</p>
              </div>
            )}
          </>
        )}

        {kind === "paiement" && (
          <>
            <p className="lbl">Quelle facture régler ?</p>
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
                    {f.entreprise} · {f.nature} · {euros(f.resteDu)} restant ({f.lot})
                  </option>
                ))}
              </select>
            )}

            <p className="lbl">Montant réglé</p>
            <input
              className="field"
              inputMode="decimal"
              placeholder="0,00 €"
              value={montantPaiement}
              onChange={(e) => setMontantPaiement(e.target.value)}
            />

            <p className="lbl">Moyen</p>
            <select className="field" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
              {MOYENS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <p className="lbl">Référence</p>
            <input
              className="field"
              placeholder="Numéro de virement, par exemple"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />

            {factureAPayer && montantRegle > 0 && (
              <div className="recap">
                <p className="t">
                  {resteApres <= 0 ? "Facture soldée après ce paiement." : `Reste dû ${euros(resteApres)}`}
                </p>
              </div>
            )}
          </>
        )}

        {kind === "avenant" && (
          <>
            <p className="lbl">Pour quel lot ?</p>
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

            <p className="lbl">Description</p>
            <input
              className="field"
              placeholder="Reprise de fondations non prévue au devis"
              value={avenantDescription}
              onChange={(e) => setAvenantDescription(e.target.value)}
            />

            <p className="lbl">Montant TTC</p>
            <input
              className="field"
              inputMode="decimal"
              placeholder="Positif ou négatif, ex. -500"
              value={avenantMontant}
              onChange={(e) => setAvenantMontant(e.target.value)}
            />

            {montantAvenant !== 0 && (
              <div className="recap">
                <p className="t">
                  {montantAvenant > 0
                    ? `Augmente l'engagé du lot de ${euros(montantAvenant)}`
                    : `Diminue l'engagé du lot de ${euros(Math.abs(montantAvenant))}`}
                </p>
              </div>
            )}
          </>
        )}

        {kindActuel.disponible && (
          <button className="btn" onClick={submit} disabled={!canSubmit}>
            {submitting
              ? "Enregistrement…"
              : kind === "paiement"
                ? "Enregistrer le paiement"
                : kind === "avenant"
                  ? "Enregistrer l'avenant"
                  : "Enregistrer la facture"}
          </button>
        )}
      </div>
    </>
  );
}
