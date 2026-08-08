"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";
import { envoyerDocumentProjet } from "@/lib/upload";

type EtatDecennale = "à réclamer" | "valide" | "valide sous réserve" | "à renouveler";

type EntrepriseApercu = { id: string; nom: string; activite: string; etat: EtatDecennale };

type Chantier = {
  maitreOeuvre: string;
  budgetContractuel: number;
  dateOuvertureChantier: string;
  dommagesOuvrage: { souscrite: boolean; assureur: string; dateEffet: string; documentUrl: string };
  entreprisesApercu: EntrepriseApercu[];
  totalEntreprises: number;
};

const TONE: Record<EtatDecennale, "danger" | "warn" | "ok"> = {
  "à réclamer": "danger",
  "à renouveler": "danger",
  "valide sous réserve": "warn",
  valide: "ok",
};

const IconCalendrier = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const IconBouclier = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconPrise = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0z" />
    <path d="M12 18v3" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export default function ChantierPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [ouvertureOuvert, setOuvertureOuvert] = useState(false);
  const [dateOuverture, setDateOuverture] = useState("");
  const [enregistrementOuverture, setEnregistrementOuverture] = useState(false);

  const [doOuvert, setDoOuvert] = useState(false);
  const [assureur, setAssureur] = useState("");
  const [dateEffet, setDateEffet] = useState("");
  const [documentDo, setDocumentDo] = useState<File | null>(null);
  const [enregistrementDo, setEnregistrementDo] = useState(false);

  const [verifConnexion, setVerifConnexion] = useState<"idle" | "loading" | "done">("idle");
  const [verifResultat, setVerifResultat] = useState<{ configured: boolean; status: Record<string, boolean> } | null>(
    null,
  );

  const charger = useCallback(() => {
    fetch("/api/chantier", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        setConfigured(status === 200);
        if (status === 200) setChantier(d);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const enregistrerOuverture = useCallback(async () => {
    if (!dateOuverture) return;
    setEnregistrementOuverture(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/chantier/ouverture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateOuverture }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "L'enregistrement a échoué.");
      setMessage("Date d'ouverture enregistrée.");
      setOuvertureOuvert(false);
      charger();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnregistrementOuverture(false);
    }
  }, [dateOuverture, charger]);

  const enregistrerDo = useCallback(async () => {
    if (!assureur.trim() || !dateEffet) return;
    setEnregistrementDo(true);
    setError("");
    setMessage("");
    try {
      const driveUrl = documentDo ? await envoyerDocumentProjet(documentDo) : "";
      const res = await fetch("/api/chantier/dommages-ouvrage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assureur, dateEffet, driveUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "L'enregistrement a échoué.");
      setMessage(`Contrat dommages-ouvrage enregistré${driveUrl ? ", document joint" : ""}.`);
      setDoOuvert(false);
      setAssureur("");
      setDateEffet("");
      setDocumentDo(null);
      charger();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnregistrementDo(false);
    }
  }, [assureur, dateEffet, documentDo, charger]);

  const verifierConnexion = useCallback(async () => {
    setVerifConnexion("loading");
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      setVerifResultat(json);
    } catch {
      setVerifResultat({ configured: false, status: {} });
    } finally {
      setVerifConnexion("done");
    }
  }, []);

  if (configured === false) {
    return (
      <>
        <ScreenHeader title="Chantier" />
        <div className="pad top">
          <div className="info">La fiche du chantier demande la connexion Google, à établir ci-dessous.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader eyebrow="Rénovation à Bouchemaine" title="Chantier" />

      <div className="pad top">
        {message && <div className="ok-block">{message}</div>}
        {error && (
          <div className="alert">
            <b>Ça n&apos;a pas abouti</b>
            {error}
          </div>
        )}
      </div>

      {chantier && (
        <>
          <p className="sect">Le projet</p>
          <div className="pad">
            <div className="card">
              <div className="row">
                <span className="k">Maître d&apos;œuvre</span>
                <span className="v">{chantier.maitreOeuvre || <span className="mute">Non renseigné</span>}</span>
              </div>
              <div className="row">
                <span className="k">Budget contractuel</span>
                <span className="v">{euros(chantier.budgetContractuel)}</span>
              </div>
              <div className="row">
                <span className="k">Ouverture du chantier</span>
                <span className="v">
                  {chantier.dateOuvertureChantier || <span className="st warn">Non déclarée</span>}
                </span>
              </div>
            </div>

            {!ouvertureOuvert ? (
              <div className="acts">
                <button type="button" className="act" onClick={() => setOuvertureOuvert(true)}>
                  <span className={`ic ${chantier.dateOuvertureChantier ? "ok" : "warn"}`}>
                    <IconCalendrier />
                  </span>
                  <div>
                    <p className="t">{chantier.dateOuvertureChantier ? "Modifier la date d'ouverture" : "Déclarer l'ouverture"}</p>
                    <p className="m">Cette date décide de la validité des décennales</p>
                  </div>
                  <i className="chev">
                    <IconChevron />
                  </i>
                </button>
              </div>
            ) : (
              <div className="card">
                <label>Date d&apos;ouverture du chantier</label>
                <input
                  className="field"
                  type="date"
                  value={dateOuverture}
                  onChange={(e) => setDateOuverture(e.target.value)}
                />
                <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                  Recalcule aussitôt l&apos;état de toutes les attestations décennales du chantier.
                </p>
                <button className="btn" disabled={!dateOuverture || enregistrementOuverture} onClick={enregistrerOuverture}>
                  {enregistrementOuverture ? "Enregistrement…" : "Enregistrer la date"}
                </button>
                <button type="button" className="destroy" onClick={() => setOuvertureOuvert(false)}>
                  Annuler
                </button>
              </div>
            )}
          </div>

          <p className="sect">Assurance dommages-ouvrage</p>
          <div className="pad">
            <div className="card">
              <div className={`check ${chantier.dommagesOuvrage.souscrite ? "done" : ""}`}>
                <span className={`box ${chantier.dommagesOuvrage.souscrite ? "on" : ""}`}>
                  {chantier.dommagesOuvrage.souscrite ? "✓" : ""}
                </span>
                <div>
                  <p className="t">{chantier.dommagesOuvrage.souscrite ? "Souscrite" : "Non souscrite"}</p>
                  {chantier.dommagesOuvrage.souscrite ? (
                    <p className="m">
                      {chantier.dommagesOuvrage.assureur}
                      {chantier.dommagesOuvrage.dateEffet ? ` · effet le ${chantier.dommagesOuvrage.dateEffet}` : ""}
                    </p>
                  ) : (
                    <p className="m st danger">Obligatoire avant l&apos;ouverture du chantier</p>
                  )}
                </div>
              </div>
            </div>

            {!chantier.dommagesOuvrage.souscrite &&
              (!doOuvert ? (
                <div className="acts">
                  <button type="button" className="act" onClick={() => setDoOuvert(true)}>
                    <span className="ic accent">
                      <IconBouclier />
                    </span>
                    <div>
                      <p className="t">Enregistrer le contrat</p>
                      <p className="m">Assureur, date d&apos;effet et attestation</p>
                    </div>
                    <i className="chev">
                      <IconChevron />
                    </i>
                  </button>
                </div>
              ) : (
                <div className="card">
                  <label>Assureur</label>
                  <input className="field" value={assureur} onChange={(e) => setAssureur(e.target.value)} placeholder="Nom de l'assureur" />
                  <label>Date d&apos;effet</label>
                  <input className="field" type="date" value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} />
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={(e) => setDocumentDo(e.target.files?.[0] ?? null)}
                    />
                    {documentDo ? `Document joint : ${documentDo.name}` : "Joindre l'attestation (PDF ou photo, optionnel)"}
                  </label>
                  <button className="btn" disabled={!assureur.trim() || !dateEffet || enregistrementDo} onClick={enregistrerDo}>
                    {enregistrementDo ? (documentDo ? "Envoi du document…" : "Enregistrement…") : "Enregistrer le contrat"}
                  </button>
                  <button type="button" className="destroy" onClick={() => setDoOuvert(false)}>
                    Annuler
                  </button>
                </div>
              ))}
          </div>

          <p className="sect">Les entreprises</p>
          <div className="pad">
            <div className="acts">
              {chantier.entreprisesApercu.map((e) => (
                <Link key={e.id} href={`/entreprises/${e.id}`} className="act">
                  <span className="ic neutral">
                    <IconBouclier />
                  </span>
                  <div>
                    <p className="t">{e.nom}</p>
                    <p className="m">{e.activite}</p>
                  </div>
                  <span className={`tag ${TONE[e.etat]}`}>{e.etat}</span>
                </Link>
              ))}
            </div>
            <Link href="/entreprises" className="destroy" style={{ color: "var(--accent-press)" }}>
              Voir les {chantier.totalEntreprises} entreprises
            </Link>
          </div>

          <p className="sect">Connexion</p>
          <div className="pad">
            <div className="acts">
              <button
                type="button"
                className="act"
                onClick={verifierConnexion}
                disabled={verifConnexion === "loading"}
              >
                <span
                  className={`ic ${
                    verifConnexion !== "done" ? "neutral" : verifResultat?.configured ? "ok" : "danger"
                  }`}
                >
                  <IconPrise />
                </span>
                <div>
                  <p className="t">Vérifier la connexion</p>
                  <p className="m">
                    {verifConnexion === "loading"
                      ? "Vérification…"
                      : verifConnexion === "idle"
                        ? "Classeur et dossier de documents"
                        : verifResultat?.configured
                          ? "Connexion Google établie."
                          : `Incomplète : ${
                              Object.entries(verifResultat?.status ?? {})
                                .filter(([, ok]) => !ok)
                                .map(([cle]) => cle)
                                .join(", ") || "cause inconnue"
                            }.`}
                  </p>
                </div>
                <span
                  className={`tag ${
                    verifConnexion !== "done" ? "mute" : verifResultat?.configured ? "ok" : "danger"
                  }`}
                >
                  {verifConnexion === "loading"
                    ? "…"
                    : verifConnexion === "idle"
                      ? "vérifier"
                      : verifResultat?.configured
                        ? "établi"
                        : "échec"}
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
