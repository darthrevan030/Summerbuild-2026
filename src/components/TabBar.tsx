"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const TABS = [
  { label: "Overview", href: "/overview" },
  { label: "Holdings", href: "/holdings" },
  { label: "FX Lab", href: "/fx-lab" },
  { label: "Charts", href: "/charts" },
  { label: "Analysis", href: "/analysis" },
  { label: "Add / Import", href: "/add" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar">
      {TABS.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={"tab" + (pathname === href ? " active" : "")}
        >
          {label}
        </Link>
      ))}
      <div className="tab-spacer" />
      <Link
        href="/settings"
        className={"tab tab-settings" + (pathname === "/settings" ? " active" : "")}
        title="Settings"
      >
        <Icon name="settings" size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />
        Settings
      </Link>
    </nav>
  );
}
