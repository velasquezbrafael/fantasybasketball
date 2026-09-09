import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getTeams } from "@/lib/data";
import { matchupSideRecord, prettyPlayoffTier } from "@/lib/format";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MatchupsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups] = await Promise.all([getTeams(season.id), getMatchups(season.id)]);
  const nameFor = (id: number | null) => (id == null ? null : teams.find((t) => t.espn_team_id === id));

  // Regular season and playoffs are fundamentally different things — a
  // flat "Week 16, Week 15, Week 14…" list buries that split. Group them
  // into two sections, most recent week first within each.
  const regularSeason = matchups.filter((m) => !m.playoff_tier_type);
  const playoffs = matchups.filter((m) => m.playoff_tier_type);

  function groupByPeriod(rows: typeof matchups) {
    const byPeriod = new Map<number, typeof matchups>();
    for (const m of rows) {
      const arr = byPeriod.get(m.matchup_period_id) ?? [];
      arr.push(m);
      byPeriod.set(m.matchup_period_id, arr);
    }
    return Array.from(byPeriod.entries()).sort((a, b) => b[0] - a[0]);
  }

  function MatchupCard({ m }: { m: (typeof matchups)[number] }) {
    const homeWon = m.winner === "HOME";
    const awayWon = m.winner === "AWAY";
    const home = nameFor(m.home_team_id);
    const away = nameFor(m.away_team_id);
    return (
      <div className="card p-4 flex items-center justify-between">
        <div className={homeWon ? "text-foreground" : "text-muted"}>
          <p className="font-medium">
            {home?.name ?? `Team ${m.home_team_id}`}
            {home?.abbrev && <span className="text-muted text-xs font-normal ml-1.5">{home.abbrev}</span>}
          </p>
          <p className="text-xl font-semibold tabular-nums">
            {matchupSideRecord(m.home_cat_wins, m.home_cat_losses, m.home_cat_ties, m.home_score)}
          </p>
        </div>
        <span className="text-muted text-xs px-2">vs</span>
        <div className={`text-right ${awayWon ? "text-foreground" : "text-muted"}`}>
          <p className="font-medium">
            {away ? away.name : "Bye"}
            {away?.abbrev && <span className="text-muted text-xs font-normal ml-1.5">{away.abbrev}</span>}
          </p>
          <p className="text-xl font-semibold tabular-nums">
            {m.away_team_id
              ? matchupSideRecord(m.away_cat_wins, m.away_cat_losses, m.away_cat_ties, m.away_score)
              : "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Matchups</h1>

      {playoffs.length > 0 && (
        <div className="space-y-8">
          <h2 className="text-xs font-semibold text-accent uppercase tracking-wide">Playoffs</h2>
          {groupByPeriod(playoffs).map(([period, rows]) => {
            const tiers = Array.from(new Set(rows.map((m) => m.playoff_tier_type)));
            return (
              <section key={period}>
                <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
                  Week {period}
                  {tiers.length === 1 && ` · ${prettyPlayoffTier(tiers[0])}`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rows.map((m) => (
                    <div key={m.id}>
                      {tiers.length > 1 && (
                        <p className="text-muted text-xs mb-1">{prettyPlayoffTier(m.playoff_tier_type)}</p>
                      )}
                      <MatchupCard m={m} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {playoffs.length > 0 && (
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Regular Season</h2>
        )}
        {groupByPeriod(regularSeason).map(([period, rows]) => (
          <section key={period}>
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Week {period}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map((m) => (
                <MatchupCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {matchups.length === 0 && <EmptyState />}
    </div>
  );
}
