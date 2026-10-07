"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/playoff-odds", label: "Playoff Odds" },
  { href: "/weekly-winners", label: "Weekly Winners" },
  { href: "/standings", label: "Standings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/pot", label: "The Pot" },
  { href: "/league-news", label: "League News" },
  { href: "/history", label: "History" },
  { href: "/records", label: "Records" },
];

function BallMark() {
  return (
    <span
      className="relative shrink-0 w-7 h-7 rounded-full"
      style={{ background: "linear-gradient(135deg, var(--accent), #c9500f)" }}
    >
      <span className="absolute inset-0 rounded-full border-2 border-background/80" />
      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-background/80" />
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-background/80" />
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();

  // Fully opaque — see the comment on the dashboard hero: a translucent
  // + blurred sticky header lets scrolling content ghost through it.
  return (
    <header className="border-b border-border bg-surface sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <BallMark />
          <span className="font-display text-xl tracking-wide text-gradient">
            United Nations FBL
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => {
            // "/teams" is exact-match only: /teams/<id> is an individual
            // manager's page, not the 4-team overlay, so it shouldn't light
            // up this tab.
            const active =
              l.href === "/" || l.href === "/teams"
                ? pathname === l.href
                : pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  active
                    ? "text-foreground bg-surface-2 font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute left-2.5 right-2.5 -bottom-[13px] h-[2px] rounded-full bg-gradient-to-r from-accent to-accent-2" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
