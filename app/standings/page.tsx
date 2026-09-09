import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const teams = await getTeams(season.id);
  const sorted = [...teams].sort((a, b) => b.win_pct - a.win_pct);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Standings</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium">Team</th>
              <th className="text-right px-4 py-3 font-medium">Record</th>
              <th className="text-right px-4 py-3 font-medium">Win%</th>
              <th className="text-right px-4 py-3 font-medium">PF</th>
              <th className="text-right px-4 py-3 font-medium">PA</th>
              <th className="text-right px-4 py-3 font-medium">Streak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {(t.win_pct * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{t.points_for.toFixed(0)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.points_against.toFixed(0)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.streak_type ? `${t.streak_type === "WIN" ? "W" : "L"}${t.streak_length}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-6">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
