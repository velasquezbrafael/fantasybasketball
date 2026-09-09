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
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function teamNameFor(teams: Awaited<ReturnType<typeof getTeams>>, espnTeamId: number) {
  return teams.find((t) => t.espn_team_id === espnTeamId)?.name ?? `Team ${espnTeamId}`;
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

  const currentPeriodMatchups = powerRankings[0]?.matchup_period_id
    ? allMatchups.filter((m) => m.matchup_period_id === powerRankings[0].matchup_period_id)
    : [];

  const latestWeeklyWinner = computeWeeklyWinners(allMatchups)[0];

  const topTeams = [...teams]
    .sort((a, b) => b.win_pct - a.win_pct)
    .slice(0, 3);

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
            {latestWeeklyWinner.score.toFixed(0)}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Top of the standings
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topTeams.map((t, i) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-accent">#{i + 1}</span>
                {t.streak_type && (
                  <span
                    className={`text-xs font-medium ${
                      t.streak_type === "WIN" ? "text-accent-2" : "text-danger"
                    }`}
                  >
                    {t.streak_type === "WIN" ? "W" : "L"}{t.streak_length}
                  </span>
                )}
              </div>
              <p className="font-semibold mt-2">{t.name}</p>
              <p className="text-muted text-sm mt-1">
                {t.wins}-{t.losses}
                {t.ties ? `-${t.ties}` : ""} · {t.points_for.toFixed(0)} PF
              </p>
            </div>
          ))}
          {topTeams.length === 0 && <EmptyState />}
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
                  {Number(m.home_score ?? 0).toFixed(0)}
                </p>
              </div>
              <span className="text-muted text-xs px-2">vs</span>
              <div className="text-right">
                <p className="font-medium">
                  {m.away_team_id ? teamNameFor(teams, m.away_team_id) : "Bye"}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {m.away_score != null ? Number(m.away_score).toFixed(0) : "—"}
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
