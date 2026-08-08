"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutGrid, Plus, Home } from "lucide-react";

const ENTRIES = [
  { href: "/", label: "Budget", Icon: Wallet, match: (p: string) => p === "/" },
  { href: "/lots", label: "Lots", Icon: LayoutGrid, match: (p: string) => p.startsWith("/lots") },
  { href: "/ajouter", label: "Ajouter", Icon: Plus, match: (p: string) => p.startsWith("/ajouter") },
  {
    href: "/chantier",
    label: "Chantier",
    Icon: Home,
    match: (p: string) => p.startsWith("/chantier") || p.startsWith("/entreprises"),
  },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {ENTRIES.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link key={href} href={href} className={active ? "on" : undefined} aria-current={active ? "page" : undefined}>
            <Icon strokeWidth={1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
