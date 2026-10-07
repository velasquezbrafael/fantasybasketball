import Link from "next/link";
import { leagueRules, leagueSettings } from "@/lib/leagueConfig";
import TeamLogo from "@/components/TeamLogo";

type TeamLite = { espn_team_id: number; name: string; logo: string | null };

function RuleCard({
  title,
  headline,
  lines,
  children,
}: {
  title: string;
  headline: string;
  lines: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <p className="text-lg font-semibold mt-1.5 leading-snug">{headline}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}

export default function LeagueRules({ teams }: { teams: TeamLite[] }) {
  const { draft, waivers, roster } = leagueSettings;
  const { playoffFormat, championsPot, specialWinningsPot, cashAwards } = leagueRules;
  const bracketSize = playoffFormat.autoByeCount + playoffFormat.playInAdvanceCount;
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">League rules</h2>
        <Link href="/pot" className="text-sm text-accent hover:underline">
          Full pot breakdown →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RuleCard
          title="Draft"
          headline={`${draft.type} — ${draft.date}, ${draft.time}`}
          lines={[`$${draft.cap} budget for every team`, draft.detail]}
        >
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-accent hover:underline">Nomination order</summary>
            <ol className="mt-2 space-y-1.5">
              {draft.nominationOrder.map((id, i) => {
                const t = teamFor(id);
                return (
                  <li key={id} className="flex items-center gap-2">
                    <span className="text-muted w-5 tabular-nums text-right">{i + 1}</span>
                    <TeamLogo logo={t?.logo} name={t?.name ?? "Team"} size={20} />
                    <span className="truncate">{t?.name ?? `Team ${id}`}</span>
                  </li>
                );
              })}
            </ol>
          </details>
        </RuleCard>

        <RuleCard
          title="Waivers"
          headline={`${waivers.type}: $${waivers.budget}`}
          lines={[
            `$${waivers.minBid} minimum bid`,
            `${waivers.addsPerMatchup} adds per matchup`,
            waivers.detail,
          ]}
        />

        <RuleCard
          title="Roster"
          headline={`${roster.size} spots`}
          lines={[`${roster.starters} starters`, `${roster.bench} bench`, `${roster.ir} IR`]}
        />

        <RuleCard
          title="Playoffs"
          headline={`${bracketSize}-team bracket`}
          lines={[
            `Seeds 1-${playoffFormat.autoByeCount} clinch outright`,
            `Seeds ${playoffFormat.autoByeCount + 1}-${
              playoffFormat.autoByeCount + playoffFormat.playInFieldSize
            } play in for the last ${playoffFormat.playInAdvanceCount} spots`,
          ]}
        />

        <RuleCard
          title="Payouts"
          headline={championsPot.payouts.map((p) => `${p.place} ${p.amount}`).join(" · ")}
          lines={[
            `Week winner $${specialWinningsPot.weekWinner.perWeek} × ${specialWinningsPot.weekWinner.weeks} weeks`,
            `Number Ones $${specialWinningsPot.numberOnes.perAward} × ${specialWinningsPot.numberOnes.positions.length} positions`,
            cashAwards.map((a) => `${a.label} $${a.amount}`).join(" · "),
          ]}
        />

        <RuleCard
          title="Buy-in"
          headline={`$${leagueRules.buyIn} × ${leagueRules.teamCount} = $${leagueRules.totalPot}`}
          lines={[championsPot.lastPlace.detail]}
        />
      </div>
    </section>
  );
}
