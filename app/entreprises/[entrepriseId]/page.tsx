"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScreenHeader from "@/components/ScreenHeader";
import { euros } from "@/lib/format";
import { envoyerDocumentEntreprise } from "@/lib/upload";

type EtatDecennale = "à réclamer" | "valide" | "valide sous réserve" | "à renouveler";

type Fiche = {
  entreprise: {
    id: string;
    nom: string;
    activite: string;
    attestationTvaRemise: boolean;
    siret: string;
    contact: string;
    decennale: {
      etat: EtatDecennale;
      assureur: string;
      debut: string;
      fin: string;
      activites: string;
      driveUrl: string;
    };
  };
  surCeChantier: { lotUuid: string; lotNom: string; devisId: string; ttc: number; statut: string; engage: number }[];
};

const IconAttestation = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const NOTE_DECENNALE: Record<EtatDecennale, { titre: string; message: string; tonalite: "danger" | "warn" } | null> = {
  "à réclamer": {
    titre: "Décennale à réclamer",
    message: "À obtenir avant de signer le devis. Après signature, tu perds ton pouvoir de négociation.",
    tonalite: "warn",
  },
  "à renouveler": {
    titre: "Décennale à renouveler",
    message: "Expirée : à obtenir avant de signer un nouveau devis avec cette entreprise.",
    tonalite: "danger",
  },
  "valide sous réserve": {
    titre: "Décennale valide sous réserve",
    message: "La date d'ouverture du chantier n'est pas encore déclarée. Sa couverture sera confirmée à ce moment-là.",
    tonalite: "warn",
  },
  valide: null,
};

export default function FicheEntreprisePage() {
  const params = useParams<{ entrepriseId: string }>();
  const entrepriseId = params.entrepriseId;

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [formOuvert, setFormOuvert] = useState(false);
  const [assureur, setAssureur] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [activites, setActivites] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/entreprises/${entrepriseId}`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ status: r.status, d })))
      .then(({ status, d }) => {
        if (status === 404) {
          setNotFound(true);
          return;
        }
        setConfigured(status === 200);
        if (status === 200) setFiche(d);
      })
      .catch(() => setConfigured(false));
  }, [entrepriseId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const datesIncoherentes = !!debut && !!fin && fin < debut;

  const enregistrer = useCallback(async () => {
    if (!debut || !fin || fin < debut) return;
    setEnvoi(true);
    setError("");
    setMessage("");
    try {
      const driveUrl = fichier ? await envoyerDocumentEntreprise(entrepriseId, fichier) : "";
      const res = await fetch(`/api/entreprises/${entrepriseId}/decennale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assureur, debut, fin, activites, driveUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "L'enregistrement a échoué.");
      setMessage("Attestation enregistrée.");
      setFormOuvert(false);
      setAssureur("");
      setDebut("");
      setFin("");
      setActivites("");
      setFichier(null);
      charger();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }, [entrepriseId, assureur, debut, fin, activites, fichier, charger]);

  if (notFound) {
    return (
      <>
        <ScreenHeader eyebrow="Entreprise" title="Introuvable" />
        <div className="pad top">
          <div className="info">Cette entreprise n&apos;est pas répertoriée.</div>
        </div>
      </>
    );
  }

  if (configured === false) {
    return (
      <>
        <ScreenHeader title="Entreprise" />
        <div className="pad top">
          <div className="info">La fiche entreprise demande la connexion Google.</div>
        </div>
      </>
    );
  }

  const note = fiche ? NOTE_DECENNALE[fiche.entreprise.decennale.etat] : null;

  return (
    <>
      <ScreenHeader eyebrow={fiche?.entreprise.activite || "Entreprise"} title={fiche?.entreprise.nom || "…"} />

      {fiche && (
        <>
          <div className="pad top">
            {message && <div className="ok-block">{message}</div>}
            {error && (
              <div className="alert">
                <b>Ça n&apos;a pas abouti</b>
                {error}
              </div>
            )}
            {note && (
              <div className={`note big ${note.tonalite}`}>
                <span className={`dot ${note.tonalite}`} />
                <div>
                  <p className="t">{note.titre}</p>
                  <p className="m">{note.message}</p>
                </div>
              </div>
            )}
          </div>

          <p className="sect">Assurance décennale</p>
          <div className="pad">
            <div className="card">
              <div className="row">
                <span className="k">Assureur</span>
                <span className="v">{fiche.entreprise.decennale.assureur || <span className="mute">Non renseigné</span>}</span>
              </div>
              <div className="row">
                <span className="k">Valable du</span>
                <span className="v">
                  {fiche.entreprise.decennale.debut && fiche.entreprise.decennale.fin ? (
                    `${fiche.entreprise.decennale.debut} au ${fiche.entreprise.decennale.fin}`
                  ) : (
                    <span className="mute">Non renseigné</span>
                  )}
                </span>
              </div>
              <div className="row">
                <span className="k">Activités couvertes</span>
                <span className="v">{fiche.entreprise.decennale.activites || <span className="mute">Non renseignées</span>}</span>
              </div>
            </div>

            {!formOuvert ? (
              <div className="acts">
                <button type="button" className="act" onClick={() => setFormOuvert(true)}>
                  <span className="ic warn">
                    <IconAttestation />
                  </span>
                  <div>
                    <p className="t">Ajouter l&apos;attestation</p>
                    <p className="m">Photo ou PDF de la décennale</p>
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
                {(fiche.entreprise.decennale.debut || fiche.entreprise.decennale.fin) && (
                  <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                    Remplace l&apos;attestation actuellement enregistrée ({fiche.entreprise.decennale.debut} au{" "}
                    {fiche.entreprise.decennale.fin}).
                  </p>
                )}
                <label>Assureur</label>
                <input className="field" value={assureur} onChange={(e) => setAssureur(e.target.value)} placeholder="Nom de l'assureur" />
                <label>Valable du</label>
                <input className="field" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
                <label>Au</label>
                <input className="field" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
                {datesIncoherentes && <p className="fieldErr">La date de fin ne peut pas être avant la date de début.</p>}
                <label>Activités couvertes</label>
                <input
                  className="field"
                  value={activites}
                  onChange={(e) => setActivites(e.target.value)}
                  placeholder="Ce que couvre l'attestation"
                />
                <label style={{ display: "block", cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                  />
                  {fichier ? `Document joint : ${fichier.name}` : "Joindre l'attestation (PDF ou photo, optionnel)"}
                </label>
                <button className="btn" disabled={!debut || !fin || datesIncoherentes || envoi} onClick={enregistrer}>
                  {envoi ? "Enregistrement…" : "Enregistrer l'attestation"}
                </button>
                <button type="button" className="destroy" onClick={() => setFormOuvert(false)}>
                  Annuler
                </button>
              </div>
            )}
          </div>

          <p className="sect">Sur ce chantier</p>
          <div className="pad">
            {fiche.surCeChantier.length === 0 ? (
              <div className="empty">
                <span className="round">
                  <IconAttestation />
                </span>
                <div>
                  <p className="t">Aucun devis pour ce chantier</p>
                  <p className="m">Cette entreprise n&apos;a pas encore de devis rattaché à un lot.</p>
                </div>
              </div>
            ) : (
              <div className="card">
                {fiche.surCeChantier.map((d) => (
                  <div key={d.devisId} style={{ marginBottom: 4 }}>
                    <div className="row">
                      <span className="k">Lot</span>
                      <span className="v">{d.lotNom}</span>
                    </div>
                    <div className="row">
                      <span className="k">Devis</span>
                      <span className="v">
                        {euros(d.ttc)} · {d.statut}
                      </span>
                    </div>
                    <div className="row">
                      <span className="k">Engagé</span>
                      <span className="v">{d.engage > 0 ? euros(d.engage) : <span className="mute">Aucun devis signé</span>}</span>
                    </div>
                  </div>
                ))}
                <div className="row">
                  <span className="k">Attestation TVA remise</span>
                  <span className={`v st ${fiche.entreprise.attestationTvaRemise ? "ok" : "warn"}`}>
                    {fiche.entreprise.attestationTvaRemise ? "Oui" : "Non"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="sect">Coordonnées</p>
          <div className="pad">
            <div className="card">
              <div className="row">
                <span className="k">SIRET</span>
                <span className="v">{fiche.entreprise.siret || <span className="mute">Non renseigné</span>}</span>
              </div>
              <div className="row">
                <span className="k">Contact</span>
                <span className="v">{fiche.entreprise.contact || <span className="mute">Non renseigné</span>}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
