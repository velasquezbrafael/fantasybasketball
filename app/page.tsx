import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getCurrentSeason,
  getLatestPowerRankings,
  getMatchups,
  getTeams,
  getTransactions,
} from "@/lib/data";
import { computeWeeklyWinners } from "@/lib/payouts";
import { matchupSideRecord, rankTrend } from "@/lib/format";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function teamNameFor(teams: Awaited<ReturnType<typeof getTeams>>, espnTeamId: number) {
  return teams.find((t) => t.espn_team_id === espnTeamId)?.name ?? `Team ${espnTeamId}`;
}

function teamAbbrevFor(teams: Awaited<ReturnType<typeof getTeams>>, espnTeamId: number) {
  return teams.find((t) => t.espn_team_id === espnTeamId)?.abbrev ?? null;
}

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend == null || trend === 0) {
    return <span className="text-muted text-xs w-8 text-center">—</span>;
  }
  const up = trend > 0;
  return (
    <span className={`text-xs font-medium w-8 text-center ${up ? "text-accent-2" : "text-danger"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(trend)}
    </span>
  );
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Welcome to your league dashboard</h1>
        <EmptyState
          title="Not connected yet"
          detail="Add your Supabase and ESPN credentials to .env.local (or your Vercel project settings), run the schema, then hit /api/sync to pull your league. Full steps are in README.md."
        />
      </div>
    );
  }

  const season = await getCurrentSeason();

  if (!season) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Welcome to your league dashboard</h1>
        <EmptyState title="No season synced yet" detail="Trigger a sync: POST /api/sync?secret=YOUR_SYNC_SECRET" />
      </div>
    );
  }

  const [teams, powerRankings, transactions, allMatchups] = await Promise.all([
    getTeams(season.id),
    getLatestPowerRankings(season.id),
    getTransactions(season.id, 5),
    getMatchups(season.id),
  ]);

  // powerRankings is sorted by rank, not recency — take the max period
  // across all teams' latest snapshots to find "this week".
  const currentPeriod = Math.max(0, ...powerRankings.map((r) => r.matchup_period_id ?? 0));
  const currentPeriodMatchups = currentPeriod
    ? allMatchups.filter((m) => m.matchup_period_id === currentPeriod)
    : [];

  const latestWeeklyWinner = computeWeeklyWinners(allMatchups)[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{season.league_name ?? "Your League"}</h1>
          <p className="text-muted text-sm mt-1">
            {season.id} season · last synced{" "}
            {season.synced_at ? new Date(season.synced_at).toLocaleString() : "never"}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/pot" className="px-3 py-1.5 rounded-md border border-border hover:bg-surface-2">
            The Pot →
          </Link>
          <Link href="/standings" className="px-3 py-1.5 rounded-md border border-border hover:bg-surface-2">
            Full standings →
          </Link>
        </div>
      </div>

      {latestWeeklyWinner && (
        <div className="card p-4 flex items-center justify-between bg-gradient-to-r from-surface to-surface-2 border-accent/30">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wide">
              Week {latestWeeklyWinner.matchupPeriodId} winner — $5
            </p>
            <p className="font-semibold mt-1">
              {latestWeeklyWinner.teamEspnIds
                .map((id) => teamNameFor(teams, id))
                .join(" & ")}
              {latestWeeklyWinner.teamEspnIds.length > 1 && (
                <span className="text-muted font-normal"> (tied)</span>
              )}
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-accent">
            {latestWeeklyWinner.record}
          </p>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Power Rankings
          </h2>
          <Link href="/power-rankings" className="text-sm text-accent hover:underline">
            Full breakdown →
          </Link>
        </div>
        <p className="text-muted text-xs -mt-2 mb-3">
          Record, category differential, recent form, and injury-adjusted roster talent — not just
          who&rsquo;s hot this week.
        </p>
        <div className="card divide-y divide-border">
          {powerRankings.slice(0, 5).map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-4">
              <span className="text-xl font-semibold text-accent w-7 tabular-nums">
                {r.power_rank}
              </span>
              <TrendBadge trend={rankTrend(r.power_rank, r.previous_power_rank)} />
              <div className="flex-1">
                <p className="font-medium">
                  {teamNameFor(teams, r.espn_team_id)}
                  {teamAbbrevFor(teams, r.espn_team_id) && (
                    <span className="text-muted text-xs font-normal ml-1.5">
                      {teamAbbrevFor(teams, r.espn_team_id)}
                    </span>
                  )}
                </p>
                <p className="text-muted text-xs mt-0.5">
                  {r.wins}-{r.losses}
                  {r.ties ? `-${r.ties}` : ""} · roster {Math.round((r.roster_strength ?? 0) * 100)}%
                  {r.injured_count ? (
                    <span className="text-danger"> · {r.injured_count} banged up</span>
                  ) : null}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{Number(r.power_score).toFixed(3)}</p>
            </div>
          ))}
          {powerRankings.length === 0 && <EmptyState />}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          This week&rsquo;s matchups
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentPeriodMatchups.map((m) => (
            <div key={m.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{teamNameFor(teams, m.home_team_id)}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {matchupSideRecord(m.home_cat_wins, m.home_cat_losses, m.home_cat_ties, m.home_score)}
                </p>
              </div>
              <span className="text-muted text-xs px-2">vs</span>
              <div className="text-right">
                <p className="font-medium">
                  {m.away_team_id ? teamNameFor(teams, m.away_team_id) : "Bye"}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {m.away_team_id
                    ? matchupSideRecord(m.away_cat_wins, m.away_cat_losses, m.away_cat_ties, m.away_score)
                    : "—"}
                </p>
              </div>
            </div>
          ))}
          {currentPeriodMatchups.length === 0 && <EmptyState />}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Recent moves
          </h2>
          <Link href="/transactions" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {transactions.map((t) => (
            <div key={t.id} className="p-4 text-sm flex items-center justify-between gap-4">
              <div>
                <span className="text-muted">{t.type}</span>
                {" — "}
                {(t.items ?? [])
                  .map((i: { playerName?: string }) => i.playerName)
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
              <span className="text-muted text-xs whitespace-nowrap">
                {t.processed_at ? new Date(t.processed_at).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="p-4">
              <EmptyState title="No transactions synced yet" detail="" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
