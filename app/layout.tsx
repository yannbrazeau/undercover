import type { Metadata, Viewport } from "next";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/screens.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Pilotage chantier HMP",
  description: "Suivi du chantier — budget, factures, paiements.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#153b32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="app">
          {children}
          <Nav />
        </div>
      </body>
    </html>
  );
}
