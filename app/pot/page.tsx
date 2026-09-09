import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getLeagueAwards, getMatchups, getTeams } from "@/lib/data";
import { computePotStandings, computeWeeklyWinners } from "@/lib/payouts";
import { leagueRules } from "@/lib/leagueConfig";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

const MEDAL_CLASS: Record<string, string> = {
  "1st": "medal-1",
  "2nd": "medal-2",
  "3rd": "medal-3",
  Last: "medal-last",
};

const MEDAL_ICON: Record<string, string> = {
  "1st": "🏆",
  "2nd": "🥈",
  "3rd": "🥉",
  Last: "💀",
};

export default async function PotPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups, awards] = await Promise.all([
    getTeams(season.id),
    getMatchups(season.id),
    getLeagueAwards(season.id),
  ]);

  const potStandings = computePotStandings(teams);
  const weeklyWinners = computeWeeklyWinners(matchups);
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);
  const nameFor = (id: number) => teamFor(id)?.name ?? `Team ${id}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">The Pot</h1>
        <p className="text-muted text-sm mt-1">
          ${leagueRules.buyIn} buy-in × {leagueRules.teamCount} teams = ${leagueRules.totalPot} total pot.
          Updated live off the current standings — not final until the season ends.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          If the season ended today
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {potStandings.map((s) => {
            const payout = leagueRules.championsPot.payouts.find((p) => p.place === s.place);
            return (
              <div
                key={s.place}
                className={`card card-hover p-4 border ${MEDAL_CLASS[s.place] ?? ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {s.place}
                  </p>
                  <span className="text-lg leading-none">{MEDAL_ICON[s.place]}</span>
                </div>
                <div className="flex items-center gap-2.5 mt-2.5">
                  <TeamLogo logo={s.team.logo} name={s.team.name} size={32} />
                  <p className="font-medium leading-tight">
                    {s.team.name}
                    {s.team.abbrev && (
                      <span className="text-muted text-xs font-normal block mt-0.5">{s.team.abbrev}</span>
                    )}
                  </p>
                </div>
                <p className="text-muted text-sm mt-2">
                  {s.team.wins}-{s.team.losses}
                  {s.team.ties ? `-${s.team.ties}` : ""}
                </p>
                <p className="text-lg font-semibold mt-2 tabular-nums">
                  {s.place === "Last"
                    ? leagueRules.championsPot.lastPlace.label
                    : `${payout?.amount ?? ""}${payout?.extra ? ` ${payout.extra}` : ""}`}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-muted text-xs mt-3">
          {leagueRules.championsPot.lastPlace.detail}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Weekly Winners — ${leagueRules.specialWinningsPot.weekWinner.perWeek} each,{" "}
            {leagueRules.specialWinningsPot.weekWinner.weeks} weeks ($
            {leagueRules.specialWinningsPot.weekWinner.total} pot)
          </h2>
          <Link href="/weekly-winners" className="text-sm text-accent hover:underline shrink-0 ml-4">
            Full history →
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {weeklyWinners.slice(0, 5).map((w) => (
            <div key={w.matchupPeriodId} className="p-4 flex items-center gap-4 text-sm card-hover">
              <span className="text-muted w-16 shrink-0">Week {w.matchupPeriodId}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {w.teamEspnIds.slice(0, 1).map((id) => (
                  <TeamLogo key={id} logo={teamFor(id)?.logo} name={nameFor(id)} size={24} />
                ))}
                <span className="font-medium truncate">
                  {w.teamEspnIds.map(nameFor).join(" & ")}
                  {w.teamEspnIds.length > 1 && <span className="text-muted"> (tied)</span>}
                </span>
              </div>
              <span className="tabular-nums font-semibold shrink-0">{w.record}</span>
            </div>
          ))}
          {weeklyWinners.length === 0 && (
            <div className="p-6">
              <EmptyState title="No completed weeks yet" detail="" />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Number Ones — best player per position (${leagueRules.specialWinningsPot.numberOnes.perAward}{" "}
          each, ${leagueRules.specialWinningsPot.numberOnes.total} pot)
        </h2>
        <div className="card p-4">
          <p className="text-muted text-sm">
            {leagueRules.specialWinningsPot.numberOnes.positions.join(" · ")} — coming soon. This one
            needs live player stats synced from ESPN, which isn&rsquo;t wired up yet.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          League Awards
        </h2>
        <div className="card divide-y divide-border">
          {(awards.length > 0
            ? awards
            : [...leagueRules.cashAwards, ...leagueRules.votedAwards]
          ).map((a: { category?: string; label?: string; detail?: string | null; amount?: number | null; winner_note?: string | null }, i: number) => (
            <div key={i} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{a.category ?? a.label}</p>
                {a.detail && <p className="text-muted text-xs mt-0.5">{a.detail}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted text-xs">
                  {a.amount ? `$${a.amount}` : "voted"}
                </p>
                <p className="font-medium">{a.winner_note ?? "TBD"}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted text-xs mt-3">
          These get decided at season end — update them anytime in Supabase&rsquo;s Table editor
          (<code className="text-foreground">league_awards</code>, columns{" "}
          <code className="text-foreground">winner_note</code> /{" "}
          <code className="text-foreground">winner_team_espn_id</code>).
        </p>
      </section>
    </div>
  );
}
