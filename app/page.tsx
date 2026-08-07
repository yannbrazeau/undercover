import ScreenHeader from "@/components/ScreenHeader";
import { isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function BudgetPage() {
  const configured = isConfigured();
  return (
    <>
      <ScreenHeader eyebrow="Chantier Bouchemaine" title="Budget" />
      <div className="screen-body">
        {!configured && (
          <div className="info">
            L&apos;accès Google n&apos;est pas encore configuré. Les chiffres du chantier
            s&apos;afficheront une fois la connexion établie, dans Réglages.
          </div>
        )}
        <div className="card">
          <p className="sub">Il vous reste</p>
          <p className="amount">—</p>
          <p className="sub">sur 629 850 € prévus</p>
        </div>
        <div className="card">
          <h4>À surveiller</h4>
          <p className="sub">
            Les lots en dépassement apparaîtront ici, du plus grave au moins grave.
          </p>
        </div>
      </div>
    </>
  );
}
