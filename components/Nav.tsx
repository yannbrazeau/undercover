"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutGrid, Plus, Settings2 } from "lucide-react";

const ENTRIES = [
  { href: "/", label: "Budget", Icon: Wallet },
  { href: "/lots", label: "Lots", Icon: LayoutGrid },
  { href: "/ajouter", label: "Ajouter", Icon: Plus },
  { href: "/reglages", label: "Réglages", Icon: Settings2 },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {ENTRIES.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
