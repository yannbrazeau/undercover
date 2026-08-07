"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletIcon, GridIcon, PlusIcon, GearIcon } from "./Icons";

const ENTRIES = [
  { href: "/", label: "Budget", Icon: WalletIcon },
  { href: "/lots", label: "Lots", Icon: GridIcon },
  { href: "/ajouter", label: "Ajouter", Icon: PlusIcon },
  { href: "/reglages", label: "Réglages", Icon: GearIcon },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav-inner">
        {ENTRIES.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "on" : undefined} aria-current={active ? "page" : undefined}>
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
