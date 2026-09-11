import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getTeams } from "@/lib/data";
import { computeWeeklyWinnerTotals, computeWeeklyWinners } from "@/lib/payouts";
import { leagueRules } from "@/lib/leagueConfig";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function WeeklyWinnersPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups] = await Promise.all([getTeams(season.id), getMatchups(season.id)]);
  const winners = computeWeeklyWinners(matchups);
  const totals = computeWeeklyWinnerTotals(winners, leagueRules.specialWinningsPot.weekWinner.perWeek);
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Weekly Winners</h1>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          Best category record in the league each week takes ${leagueRules.specialWinningsPot.weekWinner.perWeek}{" "}
          — {leagueRules.specialWinningsPot.weekWinner.weeks} weeks, $
          {leagueRules.specialWinningsPot.weekWinner.total} pot.
        </p>
      </div>

      {totals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
            Season Leaderboard
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {totals.map((t, i) => {
              const team = teamFor(t.espnTeamId);
              return (
                <div
                  key={t.espnTeamId}
                  className={`card card-hover p-4 flex items-center gap-3 ${i === 0 ? "medal-1 border" : ""}`}
                >
                  <span className="text-lg font-semibold text-accent w-6 text-center tabular-nums">
                    {i + 1}
                  </span>
                  <Link href={`/teams/${t.espnTeamId}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity">
                    <TeamLogo logo={team?.logo} name={team?.name ?? "Team"} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{team?.name ?? `Team ${t.espnTeamId}`}</p>
                      <p className="text-muted text-xs">
                        {t.weeksWon} week{t.weeksWon === 1 ? "" : "s"} won
                      </p>
                    </div>
                  </Link>
                  <p className="font-semibold tabular-nums text-accent">${t.totalWinnings}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Week by Week
        </h2>
        <div className="card divide-y divide-border">
          {winners.map((w) => (
            <div key={w.matchupPeriodId} className="p-4 flex items-center gap-4 text-sm card-hover">
              <span className="text-muted w-16 shrink-0">Week {w.matchupPeriodId}</span>
              <Link href={`/teams/${w.teamEspnIds[0]}`} className="flex items-center gap-2 flex-1 min-w-0 hover:text-accent transition-colors">
                {w.teamEspnIds.slice(0, 1).map((id) => (
                  <TeamLogo key={id} logo={teamFor(id)?.logo} name={teamFor(id)?.name ?? "Team"} size={26} />
                ))}
                <span className="font-medium truncate">
                  {w.teamEspnIds.map((id) => teamFor(id)?.name ?? `Team ${id}`).join(" & ")}
                  {w.teamEspnIds.length > 1 && <span className="text-muted"> (tied)</span>}
                </span>
              </Link>
              <span className="tabular-nums font-semibold shrink-0">{w.record}</span>
              <span className="tabular-nums text-accent font-medium shrink-0 w-10 text-right">
                ${leagueRules.specialWinningsPot.weekWinner.perWeek}
              </span>
            </div>
          ))}
          {winners.length === 0 && (
            <div className="p-6">
              <EmptyState title="No completed weeks yet" detail="" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
