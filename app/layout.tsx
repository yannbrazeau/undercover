import type { Metadata, Viewport } from "next";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/screens.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Pilotage chantier HMP",
  description: "Suivi du chantier : budget, factures, paiements.",
  appleWebApp: {
    title: "Chantier",
    capable: true,
    statusBarStyle: "default",
  },
  // Icônes déclarées explicitement, vers des fichiers statiques de public/
  // sans paramètre de cache-busting — ce paramètre, ajouté par la
  // convention app/apple-icon.png, est documenté comme cassant la
  // détection d'icône par « Sur l'écran d'accueil » sur iOS. Renseigner
  // `icons` retire aussi la détection automatique de app/icon.png (mais
  // pas celle de app/favicon.ico, toujours active) : le rôle « icon » est
  // donc redéclaré ici, pas seulement « apple ».
  icons: {
    icon: { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f5f8",
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
