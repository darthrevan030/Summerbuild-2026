"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const TABS = [
  { label: "Overview",    href: "/overview",  icon: "layout-dashboard" },
  { label: "Holdings",    href: "/holdings",  icon: "list"             },
  { label: "FX Lab",      href: "/fx-lab",    icon: "repeat"           },
  { label: "Charts",      href: "/charts",    icon: "bar-chart"        },
  { label: "Analysis",    href: "/analysis",  icon: "sparkles"         },
  { label: "Add / Import",href: "/add",       icon: "circle-plus"      },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar">
      {TABS.map(({ label, href, icon }) => (
        <Link
          key={href}
          href={href}
          className={"tab" + (pathname === href ? " active" : "")}
        >
          <Icon name={icon} size={13} strokeWidth={1.9} />
          {label}
        </Link>
      ))}
      <div className="tab-spacer" />
      <Link
        href="/settings"
        className={"tab tab-settings" + (pathname === "/settings" ? " active" : "")}
        title="Settings"
      >
        <Icon name="settings" size={13} strokeWidth={1.9} />
        Settings
      </Link>
    </nav>
  );
}
