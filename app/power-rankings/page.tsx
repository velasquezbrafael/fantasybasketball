import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getLatestPowerRankings, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, rankings] = await Promise.all([
    getTeams(season.id),
    getLatestPowerRankings(season.id),
  ]);
  const nameFor = (id: number) => teams.find((t) => t.espn_team_id === id)?.name ?? `Team ${id}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Power Rankings</h1>
        <p className="text-muted text-sm mt-1">
          Blends win% (50%), point differential (30%), and form over the last 3 weeks (20%) —
          not just the raw ESPN standings.
        </p>
      </div>
      <div className="card divide-y divide-border">
        {rankings.map((r) => (
          <div key={r.id} className="p-4 flex items-center gap-4">
            <span className="text-2xl font-semibold text-accent w-8 tabular-nums">
              {r.power_rank}
            </span>
            <div className="flex-1">
              <p className="font-medium">{nameFor(r.espn_team_id)}</p>
              <p className="text-muted text-sm">
                {r.wins}-{r.losses}
                {r.ties ? `-${r.ties}` : ""} · {Number(r.points_for).toFixed(0)} PF
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">Power score</p>
              <p className="font-semibold tabular-nums">{Number(r.power_score).toFixed(3)}</p>
            </div>
          </div>
        ))}
        {rankings.length === 0 && (
          <div className="p-6">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
