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
      <ScreenHeader title="Réglages" />
      <div className="screen-body">
        <div className="card">
          {health?.configured ? (
            <div className="row">
              <span className="k">Connexion au chantier</span>
              <span className="v good">établie</span>
            </div>
          ) : (
            <div className="info">
              La connexion au chantier n&apos;est pas encore établie. Elle se renseigne dans
              l&apos;hébergement, une seule fois.
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
