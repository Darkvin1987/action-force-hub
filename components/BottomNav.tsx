"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVIGATION_PERMISSIONS } from "@/lib/navigation-permissions";

type BottomNavProps = {
  role?: string;
};

const ALL_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/crm", label: "CRM", icon: "♙" },
  { href: "/sales", label: "Sales Results", icon: "▥" },
  { href: "/memo", label: "Memo", icon: "▤" },
  { href: "/team", label: "Team", icon: "♧" },
  { href: "/staff", label: "Staff", icon: "⚙" },
];

export default function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    const allowedRoles = NAVIGATION_PERMISSIONS[item.href] ?? [];
    return role ? allowedRoles.includes(role) : false;
  });

  const isDirector = role === "DIRECTOR";

  return (
    <nav
      className={`af-bottom-nav${
        isDirector ? " af-bottom-nav-director" : ""
      }`}
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`af-bottom-nav-item${
              active ? " active" : ""
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="af-bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>

            <span className="af-bottom-nav-label">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}