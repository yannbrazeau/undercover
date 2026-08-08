"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/components/ScreenHeader";
import EchoMontant from "@/components/EchoMontant";
import { euros, parseMontantSaisi, parsePourcentageSaisi } from "@/lib/format";
import { computeFacture } from "@/lib/facture";
import { envoyerDocument } from "@/lib/upload";

type DevisItem = {
  id: string;
  entreprise: string;
  ttc: number;
  statut: string;
  dateSignature: string;
  dateAnnulation: string;
  driveUrl: string;
  decennale: string;
  entreprisePrevenue: boolean;
  eligibleSignature: boolean;
  eligibleChoix: boolean;
};

type PaiementItem = {
  id: string;
  date: string;
  montant: number;
  moyen: string;
  reference: string;
  statut: string;
  dateAnnulation: string;
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
  dateAnnulation: string;
  resteDu: number;
  driveUrl: string;
  paiements: PaiementItem[];
};

type AvenantItem = {
  id: string;
  description: string;
  montantTTC: number;
  date: string;
  statut: string;
  dateAnnulation: string;
};

function estAnnule(statut: string) {
  return normStatut(statut) === "annule";
}

type ReserveItem = {
  id: string;
  description: string;
  date: string;
  statut: string;
  dateLevee: string;
  driveUrl: string;
};

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
  reserves: ReserveItem[];
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
  const [confirmerSignatureId, setConfirmerSignatureId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [debutPrevu, setDebutPrevu] = useState("");
  const [finPrevue, setFinPrevue] = useState("");
  const [avancementPct, setAvancementPct] = useState("0");
  const [enregistrementPlanning, setEnregistrementPlanning] = useState(false);

  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [engagementASupprimer, setEngagementASupprimer] = useState<number | null>(null);
  const [suppression, setSuppression] = useState(false);

  const [fichiersSignature, setFichiersSignature] = useState<Record<string, File | null>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // Modification / annulation des écritures — jamais de suppression, un
  // statut « annulé » et sa date, la ligne reste visible (cahier §5).
  const [editionAvenantId, setEditionAvenantId] = useState<string | null>(null);
  const [editAvenantDescription, setEditAvenantDescription] = useState("");
  const [editAvenantMontant, setEditAvenantMontant] = useState("");
  const [enregistrementAvenant, setEnregistrementAvenant] = useState(false);
  const [confirmationAnnulationAvenantId, setConfirmationAnnulationAvenantId] = useState<string | null>(null);
  const [annulationEnCours, setAnnulationEnCours] = useState<string | null>(null);

  const [editionFactureId, setEditionFactureId] = useState<string | null>(null);
  const [editFactureMontant, setEditFactureMontant] = useState("");
  const [editFactureTaux, setEditFactureTaux] = useState("5");
  const [enregistrementFacture, setEnregistrementFacture] = useState(false);
  const [confirmationAnnulationFactureId, setConfirmationAnnulationFactureId] = useState<string | null>(null);

  const [editionPaiementId, setEditionPaiementId] = useState<string | null>(null);
  const [editPaiementMontant, setEditPaiementMontant] = useState("");
  const [enregistrementPaiement, setEnregistrementPaiement] = useState(false);
  const [confirmationAnnulationPaiementId, setConfirmationAnnulationPaiementId] = useState<string | null>(null);

  const [editionDevisId, setEditionDevisId] = useState<string | null>(null);
  const [editDevisMontant, setEditDevisMontant] = useState("");
  const [enregistrementDevis, setEnregistrementDevis] = useState(false);
  const [confirmationAnnulationDevisId, setConfirmationAnnulationDevisId] = useState<string | null>(null);

  const [levantEnCours, setLevantEnCours] = useState<string | null>(null);

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
        setConfirmerSignatureId(null);
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
        const res = await fetch("/api/devis/prevenir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devisId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Impossible de marquer l'entreprise comme prévenue.");
        charger();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [charger],
  );

  // Une saisie illisible (texte, hors 0-100) ne devient jamais silencieusement
  // 0 : elle bloque l'enregistrement et un message apparaît sous le champ.
  const avancementSaisi = avancementPct.trim() === "" ? null : parsePourcentageSaisi(avancementPct);
  const avancementInvalide = avancementPct.trim() !== "" && avancementSaisi === null;
  const datesIncoherentes = !!debutPrevu && !!finPrevue && finPrevue < debutPrevu;
  const planningInvalide = avancementInvalide || datesIncoherentes;

  const enregistrerPlanning = useCallback(async () => {
    if (planningInvalide) return;
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
          avancementPct: avancementSaisi ?? 0,
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
  }, [lotUuid, debutPrevu, finPrevue, avancementSaisi, planningInvalide, charger]);

  const supprimer = useCallback(
    async (confirmerMalgreEngagement = false) => {
      setSuppression(true);
      setError("");
      try {
        const res = await fetch(`/api/lots/${lotUuid}/supprimer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmerMalgreEngagement }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La suppression a échoué.");
        if (json.requiresConfirmation) {
          setEngagementASupprimer(json.engage);
          setSuppression(false);
          return;
        }
        router.push("/lots");
      } catch (e) {
        setError((e as Error).message);
        setSuppression(false);
      }
    },
    [lotUuid, router],
  );

  const ouvrirEditionAvenant = (a: AvenantItem) => {
    setEditionAvenantId(a.id);
    setEditAvenantDescription(a.description);
    setEditAvenantMontant(String(a.montantTTC));
    setMessage("");
    setError("");
  };

  const enregistrerModificationAvenant = useCallback(
    async (avenantId: string) => {
      setEnregistrementAvenant(true);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/avenants/${avenantId}/modifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: editAvenantDescription,
            montantTTC: parseMontantSaisi(editAvenantMontant),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La modification a échoué.");
        setMessage(`Avenant ${avenantId} modifié.`);
        setEditionAvenantId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setEnregistrementAvenant(false);
      }
    },
    [editAvenantDescription, editAvenantMontant, charger],
  );

  const annulerAvenantAction = useCallback(
    async (avenantId: string) => {
      setAnnulationEnCours(avenantId);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/avenants/${avenantId}/annuler`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "L'annulation a échoué.");
        setMessage(`Avenant ${avenantId} annulé.`);
        setConfirmationAnnulationAvenantId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setAnnulationEnCours(null);
      }
    },
    [charger],
  );

  const ouvrirEditionFacture = (f: FactureItem) => {
    setEditionFactureId(f.id);
    setEditFactureMontant(String(f.montantTTC));
    setEditFactureTaux(String(f.montantTTC > 0 ? Math.round((f.retenueGarantie / f.montantTTC) * 1000) / 10 : 5));
    setMessage("");
    setError("");
  };

  const enregistrerModificationFacture = useCallback(
    async (factureId: string) => {
      setEnregistrementFacture(true);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/factures/${factureId}/modifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            montantTTC: parseMontantSaisi(editFactureMontant),
            tauxRetenue: parseMontantSaisi(editFactureTaux),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La modification a échoué.");
        setMessage(`Facture ${factureId} modifiée.`);
        setEditionFactureId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setEnregistrementFacture(false);
      }
    },
    [editFactureMontant, editFactureTaux, charger],
  );

  const annulerFactureAction = useCallback(
    async (factureId: string) => {
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/factures/${factureId}/annuler`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "L'annulation a échoué.");
        setMessage(`Facture ${factureId} annulée.`);
        setConfirmationAnnulationFactureId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [charger],
  );

  const ouvrirEditionPaiement = (p: PaiementItem) => {
    setEditionPaiementId(p.id);
    setEditPaiementMontant(String(p.montant));
    setMessage("");
    setError("");
  };

  const enregistrerModificationPaiement = useCallback(
    async (paiementId: string) => {
      setEnregistrementPaiement(true);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/paiements/${paiementId}/modifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ montant: parseMontantSaisi(editPaiementMontant) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La modification a échoué.");
        setMessage(`Paiement ${paiementId} modifié.`);
        setEditionPaiementId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setEnregistrementPaiement(false);
      }
    },
    [editPaiementMontant, charger],
  );

  const annulerPaiementAction = useCallback(
    async (paiementId: string) => {
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/paiements/${paiementId}/annuler`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "L'annulation a échoué.");
        setMessage(`Paiement ${paiementId} annulé.`);
        setConfirmationAnnulationPaiementId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [charger],
  );

  const ouvrirEditionDevis = (d: DevisItem) => {
    setEditionDevisId(d.id);
    setEditDevisMontant(String(d.ttc));
    setMessage("");
    setError("");
  };

  const enregistrerModificationDevis = useCallback(
    async (devisId: string) => {
      setEnregistrementDevis(true);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/devis/${devisId}/modifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ttc: parseMontantSaisi(editDevisMontant) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "La modification a échoué.");
        setMessage(`Devis ${devisId} modifié.`);
        setEditionDevisId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setEnregistrementDevis(false);
      }
    },
    [editDevisMontant, charger],
  );

  const annulerDevisAction = useCallback(
    async (devisId: string) => {
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/devis/${devisId}/annuler`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "L'annulation a échoué.");
        setMessage(`Devis ${devisId} annulé.`);
        setConfirmationAnnulationDevisId(null);
        charger();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [charger],
  );

  const cocherReserveAction = useCallback(
    async (reserveId: string) => {
      setLevantEnCours(reserveId);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/reserves/${reserveId}/cocher`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Impossible de lever cette réserve.");
        charger();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLevantEnCours(null);
      }
    },
    [charger],
  );

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

                  {d.eligibleSignature &&
                    d.decennale !== "valide" &&
                    !estEnConfirmation &&
                    confirmerSignatureId !== d.id && (
                      <div className="note warn">
                        <span className="dot warn" />
                        <p>
                          {d.decennale === "à réclamer"
                            ? "Décennale à réclamer avant de signer"
                            : `Décennale ${d.decennale} — à réclamer avant de signer`}
                        </p>
                      </div>
                    )}

                  {d.eligibleChoix && !estEnConfirmation && confirmerSignatureId !== d.id && (
                    <>
                      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                        Écarte automatiquement les autres devis de ce lot.
                      </p>
                      <button className="btn sec" disabled={busyId === d.id} onClick={() => choisir(d.id)}>
                        {busyId === d.id ? "Choix…" : "Choisir ce devis"}
                      </button>
                    </>
                  )}

                  {d.eligibleSignature && !estEnConfirmation && confirmerSignatureId !== d.id && (
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
                      <button className="btn" onClick={() => setConfirmerSignatureId(d.id)}>
                        Signer ce devis
                      </button>
                    </>
                  )}

                  {d.eligibleSignature && !estEnConfirmation && confirmerSignatureId === d.id && (
                    <div className="note warn">
                      <span className="dot warn" />
                      <div>
                        <p className="t">Signature définitive</p>
                        <p className="m">
                          Engage {euros(d.ttc)} sur ce lot. Aucune fonction ne permet de revenir en arrière ensuite.
                        </p>
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setConfirmerSignatureId(null)}>
                            Annuler
                          </button>
                          <button className="btn" style={{ marginTop: 0 }} disabled={busyId === d.id} onClick={() => signer(d.id)}>
                            {busyId === d.id
                              ? envoiEnCours
                                ? "Envoi du document…"
                                : "Signature…"
                              : "Confirmer la signature"}
                          </button>
                        </div>
                      </div>
                    </div>
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
                          <button
                            className="btn ghost"
                            style={{ marginTop: 0 }}
                            onClick={() => {
                              setConfirmation(null);
                              setConfirmerSignatureId(null);
                            }}
                          >
                            Annuler
                          </button>
                          <button className="btn" style={{ marginTop: 0 }} onClick={() => signer(d.id, true, confirmation.driveUrl)}>
                            Signer quand même
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {estAnnule(d.statut) && <p className="hint">Annulé le {d.dateAnnulation}</p>}

                  {normStatut(d.statut) !== "signe" &&
                    !estAnnule(d.statut) &&
                    !estEnConfirmation &&
                    confirmerSignatureId !== d.id &&
                    editionDevisId !== d.id &&
                    confirmationAnnulationDevisId !== d.id && (
                      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        <button type="button" className="destroy" style={{ padding: 0 }} onClick={() => ouvrirEditionDevis(d)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="destroy"
                          style={{ padding: 0 }}
                          onClick={() => setConfirmationAnnulationDevisId(d.id)}
                        >
                          Annuler
                        </button>
                      </div>
                    )}

                  {editionDevisId === d.id && (
                    <div style={{ marginTop: 8 }}>
                      <label>Montant TTC</label>
                      <input
                        className="field"
                        inputMode="decimal"
                        value={editDevisMontant}
                        onChange={(e) => setEditDevisMontant(e.target.value)}
                      />
                      <EchoMontant brut={editDevisMontant} />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          className="btn sec"
                          style={{ marginTop: 0 }}
                          disabled={enregistrementDevis || !parseMontantSaisi(editDevisMontant)}
                          onClick={() => enregistrerModificationDevis(d.id)}
                        >
                          {enregistrementDevis ? "Enregistrement…" : "Enregistrer"}
                        </button>
                        <button type="button" className="btn ghost" style={{ marginTop: 0 }} onClick={() => setEditionDevisId(null)}>
                          Annuler la modification
                        </button>
                      </div>
                    </div>
                  )}

                  {confirmationAnnulationDevisId === d.id && (
                    <div className="note warn" style={{ marginTop: 8 }}>
                      <span className="dot warn" />
                      <div>
                        <p className="t">Annuler ce devis ?</p>
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button
                            className="btn ghost"
                            style={{ marginTop: 0 }}
                            onClick={() => setConfirmationAnnulationDevisId(null)}
                          >
                            Non
                          </button>
                          <button className="btn danger" style={{ marginTop: 0 }} onClick={() => annulerDevisAction(d.id)}>
                            Confirmer l&apos;annulation
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
                {fiche.avenants.map((a) => {
                  const annule = estAnnule(a.statut);
                  const enEdition = editionAvenantId === a.id;
                  const enConfirmation = confirmationAnnulationAvenantId === a.id;
                  const nouveauMontant = parseMontantSaisi(editAvenantMontant);
                  return (
                    <div className="card" key={a.id}>
                      <div className="row" style={annule ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                        <span className="k">
                          {a.description} <span className="mute">· {a.id}</span>
                        </span>
                        <span className="v">
                          {a.montantTTC > 0 ? "+" : ""}
                          {euros(a.montantTTC)}
                        </span>
                      </div>
                      {annule && <p className="hint">Annulé le {a.dateAnnulation}</p>}

                      {!annule && !enEdition && !enConfirmation && (
                        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                          <button type="button" className="destroy" style={{ padding: 0 }} onClick={() => ouvrirEditionAvenant(a)}>
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="destroy"
                            style={{ padding: 0 }}
                            onClick={() => setConfirmationAnnulationAvenantId(a.id)}
                          >
                            Annuler
                          </button>
                        </div>
                      )}

                      {enEdition && (
                        <div style={{ marginTop: 8 }}>
                          <label>Description</label>
                          <input
                            className="field"
                            value={editAvenantDescription}
                            onChange={(e) => setEditAvenantDescription(e.target.value)}
                          />
                          <label>Montant TTC</label>
                          <input
                            className="field"
                            inputMode="decimal"
                            value={editAvenantMontant}
                            onChange={(e) => setEditAvenantMontant(e.target.value)}
                          />
                          <EchoMontant brut={editAvenantMontant} />
                          {nouveauMontant !== null && nouveauMontant !== 0 && (
                            <p className="echo">
                              Nouvel engagé du lot : {euros(fiche.engage - a.montantTTC + nouveauMontant)}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              className="btn sec"
                              style={{ marginTop: 0 }}
                              disabled={enregistrementAvenant || !editAvenantDescription.trim() || !nouveauMontant}
                              onClick={() => enregistrerModificationAvenant(a.id)}
                            >
                              {enregistrementAvenant ? "Enregistrement…" : "Enregistrer"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ marginTop: 0 }}
                              onClick={() => setEditionAvenantId(null)}
                            >
                              Annuler la modification
                            </button>
                          </div>
                        </div>
                      )}

                      {enConfirmation && (
                        <div className="note warn" style={{ marginTop: 8 }}>
                          <span className="dot warn" />
                          <div>
                            <p className="t">Annuler cet avenant ?</p>
                            <p className="m">Nouvel engagé du lot : {euros(fiche.engage - a.montantTTC)}</p>
                            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                              <button
                                className="btn ghost"
                                style={{ marginTop: 0 }}
                                onClick={() => setConfirmationAnnulationAvenantId(null)}
                              >
                                Non
                              </button>
                              <button
                                className="btn danger"
                                style={{ marginTop: 0 }}
                                disabled={annulationEnCours === a.id}
                                onClick={() => annulerAvenantAction(a.id)}
                              >
                                {annulationEnCours === a.id ? "Annulation…" : "Confirmer l'annulation"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
              fiche.factures.map((f) => {
                const annule = estAnnule(f.statut);
                const enEdition = editionFactureId === f.id;
                const enConfirmation = confirmationAnnulationFactureId === f.id;
                const nouveauMontant = parseMontantSaisi(editFactureMontant);
                const nouveauTaux = parseMontantSaisi(editFactureTaux);
                return (
                  <div className="card" key={f.id}>
                    <div className="row" style={annule ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                      <span className="k">
                        {f.nature} <span className="mute">· {f.id}</span>
                      </span>
                      <span className="v">{euros(f.montantTTC)}</span>
                    </div>
                    {annule && <p className="hint">Annulée le {f.dateAnnulation}</p>}
                    {!annule && <p className="hint">Statut : {f.statut || "reçue"}</p>}

                    {f.paiements.length > 0 && (
                      <div style={{ marginTop: 6, marginBottom: 6 }}>
                        {f.paiements.map((p) => {
                          const pAnnule = estAnnule(p.statut);
                          const pEnEdition = editionPaiementId === p.id;
                          const pEnConfirmation = confirmationAnnulationPaiementId === p.id;
                          const pNouveauMontant = parseMontantSaisi(editPaiementMontant);
                          return (
                            <div key={p.id} style={{ marginBottom: 6 }}>
                              <div
                                className="row"
                                style={{
                                  fontSize: 13,
                                  ...(pAnnule ? { opacity: 0.5, textDecoration: "line-through" } : {}),
                                }}
                              >
                                <span className="k mute">
                                  Paiement {p.date} · {p.moyen || "moyen non précisé"}
                                </span>
                                <span className="v">{euros(p.montant)}</span>
                              </div>
                              {pAnnule && <p className="hint">Annulé le {p.dateAnnulation}</p>}
                              {!pAnnule && !pEnEdition && !pEnConfirmation && (
                                <div style={{ display: "flex", gap: 16 }}>
                                  <button
                                    type="button"
                                    className="destroy"
                                    style={{ padding: 0, fontSize: 12.5 }}
                                    onClick={() => ouvrirEditionPaiement(p)}
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    className="destroy"
                                    style={{ padding: 0, fontSize: 12.5 }}
                                    onClick={() => setConfirmationAnnulationPaiementId(p.id)}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              )}
                              {pEnEdition && (
                                <div>
                                  <input
                                    className="field"
                                    inputMode="decimal"
                                    value={editPaiementMontant}
                                    onChange={(e) => setEditPaiementMontant(e.target.value)}
                                  />
                                  <EchoMontant brut={editPaiementMontant} />
                                  <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                      className="btn sec"
                                      style={{ marginTop: 0 }}
                                      disabled={enregistrementPaiement || !pNouveauMontant}
                                      onClick={() => enregistrerModificationPaiement(p.id)}
                                    >
                                      {enregistrementPaiement ? "Enregistrement…" : "Enregistrer"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn ghost"
                                      style={{ marginTop: 0 }}
                                      onClick={() => setEditionPaiementId(null)}
                                    >
                                      Annuler la modification
                                    </button>
                                  </div>
                                </div>
                              )}
                              {pEnConfirmation && (
                                <div className="note warn">
                                  <span className="dot warn" />
                                  <div>
                                    <p className="t">Annuler ce paiement ?</p>
                                    <p className="m">
                                      La facture redevient à payer, reste dû recalculé aussitôt.
                                    </p>
                                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                                      <button
                                        className="btn ghost"
                                        style={{ marginTop: 0 }}
                                        onClick={() => setConfirmationAnnulationPaiementId(null)}
                                      >
                                        Non
                                      </button>
                                      <button
                                        className="btn danger"
                                        style={{ marginTop: 0 }}
                                        onClick={() => annulerPaiementAction(p.id)}
                                      >
                                        Confirmer l&apos;annulation
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!annule && !enEdition && !enConfirmation && (
                      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                        <button type="button" className="destroy" style={{ padding: 0 }} onClick={() => ouvrirEditionFacture(f)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="destroy"
                          style={{ padding: 0 }}
                          onClick={() => setConfirmationAnnulationFactureId(f.id)}
                        >
                          Annuler
                        </button>
                      </div>
                    )}

                    {enEdition && (
                      <div style={{ marginTop: 8 }}>
                        <label>Montant TTC</label>
                        <input
                          className="field"
                          inputMode="decimal"
                          value={editFactureMontant}
                          onChange={(e) => setEditFactureMontant(e.target.value)}
                        />
                        <EchoMontant brut={editFactureMontant} />
                        <label>Retenue de garantie (%)</label>
                        <input
                          className="field"
                          inputMode="decimal"
                          value={editFactureTaux}
                          onChange={(e) => setEditFactureTaux(e.target.value)}
                        />
                        {nouveauMontant !== null && nouveauTaux !== null && (
                          <p className="echo">
                            Net à payer : {euros(computeFacture({ montantTTC: nouveauMontant, tauxRetenue: nouveauTaux }).netAPayer)}
                          </p>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            className="btn sec"
                            style={{ marginTop: 0 }}
                            disabled={enregistrementFacture || !nouveauMontant || nouveauTaux === null}
                            onClick={() => enregistrerModificationFacture(f.id)}
                          >
                            {enregistrementFacture ? "Enregistrement…" : "Enregistrer"}
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ marginTop: 0 }}
                            onClick={() => setEditionFactureId(null)}
                          >
                            Annuler la modification
                          </button>
                        </div>
                      </div>
                    )}

                    {enConfirmation && (
                      <div className="note warn" style={{ marginTop: 8 }}>
                        <span className="dot warn" />
                        <div>
                          <p className="t">Annuler cette facture ?</p>
                          <p className="m">
                            {f.paiements.some((p) => !estAnnule(p.statut))
                              ? "Des paiements actifs y sont rattachés : ils restent enregistrés mais ne compteront plus dans le reste dû."
                              : "Elle sort du cumul facturé du lot."}
                          </p>
                          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            <button
                              className="btn ghost"
                              style={{ marginTop: 0 }}
                              onClick={() => setConfirmationAnnulationFactureId(null)}
                            >
                              Non
                            </button>
                            <button className="btn danger" style={{ marginTop: 0 }} onClick={() => annulerFactureAction(f.id)}>
                              Confirmer l&apos;annulation
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
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

          {fiche.reserves.length > 0 && (
            <>
              <p className="sect">Réserves</p>
              <div className="pad">
                <div className="card">
                  {fiche.reserves.map((r) => {
                    const levee = normStatut(r.statut) === "levee";
                    return (
                      <div
                        key={r.id}
                        className={`check ${levee ? "done" : ""}`}
                        style={{ cursor: levee ? "default" : "pointer" }}
                        onClick={() => !levee && levantEnCours !== r.id && cocherReserveAction(r.id)}
                      >
                        <span className={`box ${levee ? "on" : ""}`}>{levee ? "✓" : ""}</span>
                        <div>
                          <p className="t">{r.description}</p>
                          <p className="m">
                            {levee ? `Levée le ${r.dateLevee}` : `Constatée le ${r.date}`}
                            {r.driveUrl && (
                              <>
                                {" · "}
                                <a href={r.driveUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                  Voir la photo
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <p className="sect">Planning</p>
          <div className="pad">
            <div className="card">
              <label>Début prévu</label>
              <input className="field" type="date" value={debutPrevu} onChange={(e) => setDebutPrevu(e.target.value)} />
              <label>Fin prévue</label>
              <input className="field" type="date" value={finPrevue} onChange={(e) => setFinPrevue(e.target.value)} />
              {datesIncoherentes && <p className="fieldErr">La fin prévue ne peut pas être avant le début prévu.</p>}
              <label>Avancement réel (%)</label>
              <input
                className="field"
                inputMode="numeric"
                value={avancementPct}
                onChange={(e) => setAvancementPct(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              {avancementInvalide && (
                <p className="fieldErr" style={{ marginTop: 6 }}>
                  Un nombre entier entre 0 et 100, sans virgule ni symbole.
                </p>
              )}
              {!avancementInvalide && avancementSaisi !== null && fiche.engage > 0 && (
                <p className={`echo ${Math.round((fiche.facture / fiche.engage) * 100) - avancementSaisi > 20 ? "danger" : ""}`} style={{ marginTop: 6 }}>
                  Facturé à {Math.round((fiche.facture / fiche.engage) * 100)} % de l&apos;engagé, écart de{" "}
                  {Math.abs(Math.round((fiche.facture / fiche.engage) * 100) - avancementSaisi)} points avec
                  l&apos;avancement déclaré.
                </p>
              )}
              <button className="btn sec" onClick={enregistrerPlanning} disabled={enregistrementPlanning || planningInvalide}>
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

            {engagementASupprimer !== null ? (
              <div className="note warn">
                <span className="dot warn" />
                <div>
                  <p className="t">Ce lot a un devis signé</p>
                  <p className="m">
                    {euros(engagementASupprimer)} sont engagés sur {fiche.lot.nom}. La suppression ne les efface pas :
                    devis, factures et avenants resteront enregistrés, rattachés à un lot supprimé.
                  </p>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button
                      className="btn ghost"
                      style={{ marginTop: 0 }}
                      onClick={() => {
                        setEngagementASupprimer(null);
                        setConfirmerSuppression(false);
                      }}
                    >
                      Annuler
                    </button>
                    <button className="btn danger" style={{ marginTop: 0 }} onClick={() => supprimer(true)}>
                      {suppression ? "Suppression…" : "Supprimer quand même"}
                    </button>
                  </div>
                </div>
              </div>
            ) : !confirmerSuppression ? (
              <button type="button" className="destroy" onClick={() => setConfirmerSuppression(true)}>
                Supprimer ce lot
              </button>
            ) : (
              <div className="note warn">
                <span className="dot warn" />
                <div>
                  <p className="t">Supprimer {fiche.lot.nom} ?</p>
                  <p className="m">
                    {fiche.devis.length > 0 || fiche.factures.length > 0 || fiche.avenants.length > 0
                      ? `${fiche.devis.length} devis, ${fiche.factures.length} facture${fiche.factures.length > 1 ? "s" : ""} et ${fiche.avenants.length} avenant${fiche.avenants.length > 1 ? "s" : ""} resteront enregistrés, rattachés à un lot supprimé.`
                      : "Ce lot n'a ni devis, ni facture, ni avenant enregistré."}
                  </p>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setConfirmerSuppression(false)}>
                      Annuler
                    </button>
                    <button className="btn danger" style={{ marginTop: 0 }} onClick={() => supprimer(false)}>
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
