"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";

type Health = { configured: boolean; status: Record<string, boolean> };

export default function ReglagesPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth(await res.json());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return (
    <>
      <ScreenHeader eyebrow="Réglages" title="Réglages" />
      <div className="screen-body">
        <div className="card">
          <h4>Connexion Google</h4>
          {health?.configured ? (
            <div className="row">
              <span className="k">Accès au chantier</span>
              <span className="v good">Configuré</span>
            </div>
          ) : (
            <div className="info">
              L&apos;accès Google n&apos;est pas encore configuré. Les identifiants se
              renseignent dans l&apos;hébergement, une seule fois.
            </div>
          )}

          {health && (
            <div style={{ marginTop: 8 }}>
              {Object.entries(health.status).map(([key, ok]) => (
                <div className="kv" key={key}>
                  <code>{key}</code>
                  <span className={ok ? "good" : "bad"}>{ok ? "présent" : "manquant"}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn sec" onClick={check} disabled={loading} style={{ marginTop: 12 }}>
            {loading ? "Vérification…" : "Vérifier la connexion"}
          </button>
        </div>
      </div>
    </>
  );
}
