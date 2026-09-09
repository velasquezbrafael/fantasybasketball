import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MatchupsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups] = await Promise.all([getTeams(season.id), getMatchups(season.id)]);
  const nameFor = (id: number | null) =>
    id == null ? "Bye" : teams.find((t) => t.espn_team_id === id)?.name ?? `Team ${id}`;

  const byPeriod = new Map<number, typeof matchups>();
  for (const m of matchups) {
    const arr = byPeriod.get(m.matchup_period_id) ?? [];
    arr.push(m);
    byPeriod.set(m.matchup_period_id, arr);
  }
  const periods = Array.from(byPeriod.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Matchups</h1>
      {periods.map((period) => (
        <section key={period}>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
            Week {period}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {byPeriod.get(period)!.map((m) => {
              const homeWon = m.winner === "HOME";
              const awayWon = m.winner === "AWAY";
              return (
                <div key={m.id} className="card p-4 flex items-center justify-between">
                  <div className={homeWon ? "text-foreground" : "text-muted"}>
                    <p className="font-medium">{nameFor(m.home_team_id)}</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {Number(m.home_score ?? 0).toFixed(0)}
                    </p>
                  </div>
                  <span className="text-muted text-xs px-2">vs</span>
                  <div className={`text-right ${awayWon ? "text-foreground" : "text-muted"}`}>
                    <p className="font-medium">{nameFor(m.away_team_id)}</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {m.away_score != null ? Number(m.away_score).toFixed(0) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {periods.length === 0 && <EmptyState />}
    </div>
  );
}
