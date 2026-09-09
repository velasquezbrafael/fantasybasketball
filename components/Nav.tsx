import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/standings", label: "Standings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/pot", label: "The Pot" },
  { href: "/transactions", label: "Transactions" },
  { href: "/history", label: "History" },
];

export default function Nav() {
  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🏀</span>
          <span className="font-semibold tracking-tight">
            League Tracker
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
