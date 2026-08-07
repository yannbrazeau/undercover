import ScreenHeader from "@/components/ScreenHeader";

export const dynamic = "force-dynamic";

export default function LotsPage() {
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
        <input className="field" placeholder="Chercher un lot" aria-label="Chercher un lot" />
        <div className="card">
          <p className="sub">
            La liste des lots, l&apos;écart au budget et la barre de scénario apparaîtront ici
            une fois la connexion Google configurée.
          </p>
        </div>
      </div>
    </>
  );
}
