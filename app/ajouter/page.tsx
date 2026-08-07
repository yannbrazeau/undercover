import ScreenHeader from "@/components/ScreenHeader";

export const dynamic = "force-dynamic";

export default function AjouterPage() {
  return (
    <>
      <ScreenHeader eyebrow="Nouveau document" title="Ajouter" />
      <div className="screen-body">
        <div className="card">
          <p className="sub">
            L&apos;écran de saisie — le fichier d&apos;abord, puis enregistrer une facture —
            arrive à la prochaine étape.
          </p>
        </div>
      </div>
    </>
  );
}
