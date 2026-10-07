"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  // "/teams" is exact-match only: /teams/<id> is an individual manager's
  // page, not the 4-team overlay, so it shouldn't light up this tab.
  const isActive = (href: string) =>
    href === "/" || href === "/teams" ? pathname === href : pathname?.startsWith(href);

  // Fully opaque — see the comment on the dashboard hero: a translucent
  // + blurred sticky header lets scrolling content ghost through it.
  //
  // The full tab row needs ~1250px, so below `xl` the tabs collapse into a
  // menu button — on a phone a sideways-scrolling row hid most of the tabs.
  return (
    <header className="border-b border-border bg-surface sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setOpen(false)}>
          <BallMark />
          <span className="font-display text-xl tracking-wide text-gradient">
            United Nations FBL
          </span>
        </Link>

        <nav className="hidden xl:flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = isActive(l.href);
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

        <button
          type="button"
          className="xl:hidden h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? (
              <path d="M4 4l12 12M16 4L4 16" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="xl:hidden border-t border-border bg-surface max-h-[calc(100vh-61px)] overflow-y-auto"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-sm transition-colors ${
                    active
                      ? "text-foreground bg-surface-2 font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
