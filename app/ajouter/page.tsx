"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import EchoMontant from "@/components/EchoMontant";
import { computeFacture } from "@/lib/facture";
import { euros, todayFr, parseMontantSaisi } from "@/lib/format";
import { envoyerDocument, envoyerPhotoLot, readJson } from "@/lib/upload";

type LotOption = { uuid: string; nom: string; engage: number; facture: number };
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
// Autre n'a jamais eu de route derrière : plutôt qu'un bouton désactivé qui
// promet une fonction absente, elle ne figure pas ici. Le jour où elle est
// construite, elle rejoint cette liste avec sa route.
const KINDS = [
  { key: "facture", label: "Facture", Icon: IconFacture },
  { key: "paiement", label: "Paiement", Icon: IconPaiement },
  { key: "avenant", label: "Avenant", Icon: IconAvenant },
  { key: "devis", label: "Devis", Icon: IconDevis },
  { key: "photo", label: "Photo", Icon: IconPhoto },
] as const;
type Kind = (typeof KINDS)[number]["key"];

type EntrepriseOption = { id: string; nom: string; activite: string };

export default function AjouterPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [facturesOuvertes, setFacturesOuvertes] = useState<FactureOuverte[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseOption[]>([]);

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

  // Devis
  const [entrepriseIdDevis, setEntrepriseIdDevis] = useState("");
  const [montantDevisTTC, setMontantDevisTTC] = useState("");

  // Photo (réserve)
  const [photoDescription, setPhotoDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [alerte, setAlerte] = useState("");

  const chargerListes = useCallback(() => {
    Promise.all([
      fetch("/api/lots", { cache: "no-store" }).then((r) => r.json().then((d) => ({ status: r.status, d }))),
      fetch("/api/factures", { cache: "no-store" }).then((r) => r.json().then((d) => ({ status: r.status, d }))),
      fetch("/api/entreprises", { cache: "no-store" }).then((r) => r.json().then((d) => ({ status: r.status, d }))),
    ])
      .then(([lotsRes, facRes, entRes]) => {
        setConfigured(lotsRes.status === 200);
        if (lotsRes.status === 200) {
          setLots(lotsRes.d.lots ?? []);
          if (lotsRes.d.defaults?.tauxRetenue != null) setTauxRetenue(String(lotsRes.d.defaults.tauxRetenue));
        }
        if (facRes.status === 200) setFacturesOuvertes(facRes.d.factures ?? []);
        if (entRes.status === 200) {
          setEntreprises((entRes.d.entreprises ?? []).map((e: { id: string; nom: string; activite: string }) => e));
        }
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
    if (
      kindParam === "facture" ||
      kindParam === "paiement" ||
      kindParam === "avenant" ||
      kindParam === "devis" ||
      kindParam === "photo"
    ) {
      setKind(kindParam);
    }
  }, []);

  const lot = lots.find((l) => l.uuid === lotUuid);

  // Un montant saisi illisible (espace interne, lettres…) ne se transforme
  // jamais silencieusement en 0 ou en un chiffre tronqué : il bloque l'envoi
  // et un message apparaît sous le champ, tant que la saisie n'est pas vide.
  const ttc = parseMontantSaisi(montantTTC) ?? 0;
  const ttcInvalide = montantTTC.trim() !== "" && parseMontantSaisi(montantTTC) === null;
  const tauxRetenueNum = parseMontantSaisi(tauxRetenue) ?? 0;
  const tauxRetenueInvalide = tauxRetenue.trim() !== "" && parseMontantSaisi(tauxRetenue) === null;
  const montants = useMemo(
    () => computeFacture({ montantTTC: ttc, tauxRetenue: tauxRetenueNum }),
    [ttc, tauxRetenueNum],
  );

  const factureAPayer = facturesOuvertes.find((f) => f.id === factureId);
  const montantRegle = parseMontantSaisi(montantPaiement) ?? 0;
  const montantRegleInvalide = montantPaiement.trim() !== "" && parseMontantSaisi(montantPaiement) === null;
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

  const montantAvenant = parseMontantSaisi(avenantMontant) ?? 0;
  const montantAvenantInvalide = avenantMontant.trim() !== "" && parseMontantSaisi(avenantMontant) === null;
  const ttcDevis = parseMontantSaisi(montantDevisTTC) ?? 0;
  const ttcDevisInvalide = montantDevisTTC.trim() !== "" && parseMontantSaisi(montantDevisTTC) === null;
  const canSubmitFacture =
    configured === true && !!lotUuid && ttc > 0 && !ttcInvalide && !tauxRetenueInvalide && !submitting;
  const canSubmitPaiement =
    configured === true && !!factureId && montantRegle > 0 && !montantRegleInvalide && !submitting;
  const canSubmitAvenant =
    configured === true &&
    !!lotUuid &&
    !!avenantDescription.trim() &&
    montantAvenant !== 0 &&
    !montantAvenantInvalide &&
    !submitting;
  const canSubmitDevis =
    configured === true && !!lotUuid && !!entrepriseIdDevis && ttcDevis > 0 && !ttcDevisInvalide && !submitting;
  const canSubmitPhoto =
    configured === true && !!lotUuid && !!file && !!photoDescription.trim() && !submitting;
  const canSubmit =
    kind === "facture"
      ? canSubmitFacture
      : kind === "paiement"
        ? canSubmitPaiement
        : kind === "avenant"
          ? canSubmitAvenant
          : kind === "devis"
            ? canSubmitDevis
            : kind === "photo"
              ? canSubmitPhoto
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
        tauxRetenue: tauxRetenueNum,
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
  }, [file, lotUuid, nature, ttc, tauxRetenueNum]);

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

  const submitDevis = useCallback(async () => {
    const driveUrl = file ? await envoyerDocument(lotUuid, file) : "";

    const res = await fetch("/api/devis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotUuid,
        entrepriseId: entrepriseIdDevis,
        ttc: ttcDevis,
        driveUrl,
      }),
    });
    const json = await readJson(res);
    if (!res.ok) throw new Error(String(json.error) || "L'enregistrement a échoué.");

    const dev = json.devis as { DEVIS_ID?: string } | undefined;
    setDone(`Devis ${dev?.DEVIS_ID ?? ""} enregistré. Il apparaît dans le lot, prêt à comparer.`);
    setEntrepriseIdDevis("");
    setMontantDevisTTC("");
    clearFile();
  }, [file, lotUuid, entrepriseIdDevis, ttcDevis]);

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

  const submitPhoto = useCallback(async () => {
    if (!file) throw new Error("Choisissez une photo.");
    const driveUrl = await envoyerPhotoLot(lotUuid, file);

    const res = await fetch("/api/reserves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotUuid, description: photoDescription, driveUrl }),
    });
    const json = await readJson(res);
    if (!res.ok) throw new Error(String(json.error) || "L'enregistrement a échoué.");

    const reserveCreee = json.reserve as { RESERVE_ID?: string } | undefined;
    setDone(`Réserve ${reserveCreee?.RESERVE_ID ?? ""} enregistrée. Elle apparaît cochable dans le lot.`);
    setPhotoDescription("");
    clearFile();
  }, [file, lotUuid, photoDescription]);

  const submit = useCallback(async () => {
    resetMessages();
    setSubmitting(true);
    try {
      if (kind === "facture") await submitFacture();
      else if (kind === "paiement") await submitPaiement();
      else if (kind === "avenant") await submitAvenant();
      else if (kind === "devis") await submitDevis();
      else if (kind === "photo") await submitPhoto();
      chargerListes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [kind, submitFacture, submitPaiement, submitAvenant, submitDevis, submitPhoto, chargerListes]);

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

        {(kind === "facture" || kind === "avenant" || kind === "devis" || kind === "photo") && (
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
            <p className="m">
              {file ? file.name : kind === "photo" ? "Obligatoire pour une réserve" : "ou choisir un fichier"}
            </p>
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
              placeholder="16 000"
              value={montantTTC}
              onChange={(e) => setMontantTTC(e.target.value)}
            />
            <EchoMontant brut={montantTTC} />
            {lot && ttc > 0 && !ttcInvalide && (
              <p className={`echo ${lot.engage > 0 && lot.facture + ttc > lot.engage + 0.01 ? "danger" : ""}`}>
                {euros(lot.facture + ttc)} facturés
                {lot.engage > 0 ? ` sur ${euros(lot.engage)} engagés` : " (aucun devis signé sur ce lot)"}
              </p>
            )}

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
              {ttc > 0 && !tauxRetenueInvalide && <span className="calc">soit {euros(montants.retenueGarantie)}</span>}
            </div>
            {tauxRetenueInvalide && <p className="fieldErr">Taux non reconnu.</p>}

            {ttc > 0 && !ttcInvalide && !tauxRetenueInvalide && (
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
            <EchoMontant brut={montantPaiement} />

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

            <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
              Nécessite un devis signé sur ce lot : sans engagement existant, la route refuse
              l&apos;enregistrement.
            </p>

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
            <EchoMontant brut={avenantMontant} />

            {lot && montantAvenant !== 0 && !montantAvenantInvalide && (
              <div className="recap">
                <p className="t">Nouvel engagé du lot : {euros(lot.engage + montantAvenant)}</p>
                <p className="m">
                  {montantAvenant > 0
                    ? `Augmente l'engagé de ${euros(montantAvenant)}`
                    : `Diminue l'engagé de ${euros(Math.abs(montantAvenant))}`}
                </p>
              </div>
            )}
          </>
        )}

        {kind === "devis" && (
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

            <p className="lbl">Quelle entreprise ?</p>
            {configured === false ? (
              <div className="info">Le répertoire des entreprises demande la connexion Google.</div>
            ) : entreprises.length === 0 ? (
              <div className="info">
                Aucune entreprise répertoriée. Ajoute-la d&apos;abord dans Chantier → Les entreprises.
              </div>
            ) : (
              <select
                className="field"
                value={entrepriseIdDevis}
                onChange={(e) => setEntrepriseIdDevis(e.target.value)}
                aria-label="Quelle entreprise"
              >
                <option value="">Choisir une entreprise…</option>
                {entreprises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom} · {e.activite}
                  </option>
                ))}
              </select>
            )}

            <p className="lbl">Montant TTC</p>
            <input
              className="field"
              inputMode="decimal"
              placeholder="0,00 €"
              value={montantDevisTTC}
              onChange={(e) => setMontantDevisTTC(e.target.value)}
            />
            <EchoMontant brut={montantDevisTTC} />

            {ttcDevis > 0 && !ttcDevisInvalide && (
              <div className="recap">
                <p className="t">{euros(ttcDevis)}</p>
                <p className="m">{lot ? `Sera rangé dans ${lot.nom}, dossier Devis` : "Choisis un lot pour le classement"}</p>
              </div>
            )}
          </>
        )}

        {kind === "photo" && (
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

            <p className="lbl">Qu&apos;est-ce que ça montre ?</p>
            <input
              className="field"
              placeholder="Fissure sur le mur porteur, angle nord"
              value={photoDescription}
              onChange={(e) => setPhotoDescription(e.target.value)}
            />

            {file && photoDescription.trim() && (
              <div className="recap">
                <p className="t">Réserve à lever</p>
                <p className="m">
                  {lot
                    ? `Photo rangée dans ${lot.nom}, sous-dossier Photos`
                    : "Choisis un lot pour le classement"}
                </p>
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
                : kind === "devis"
                  ? "Enregistrer le devis"
                  : kind === "photo"
                    ? "Enregistrer la réserve"
                    : "Enregistrer la facture"}
        </button>
      </div>
    </>
  );
}
