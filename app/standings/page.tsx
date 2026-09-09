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
  const seasonDecided = teams.some((t) => t.final_rank != null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Standings</h1>
        <p className="text-muted text-sm mt-1">
          Record is the category record (9-Categories league) — {seasonDecided
            ? "the playoff bracket is decided, so Final Rank is the real result."
            : "sorted by regular-season win% until the playoff bracket decides it."}
        </p>
      </div>
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium">Team</th>
              <th className="text-right px-4 py-3 font-medium">Record</th>
              <th className="text-right px-4 py-3 font-medium">Win%</th>
              <th className="text-right px-4 py-3 font-medium">Streak</th>
              <th className="text-right px-4 py-3 font-medium">Final Rank</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3 font-medium">
                  {t.name}
                  {t.abbrev && <span className="text-muted text-xs font-normal ml-1.5">{t.abbrev}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {(t.win_pct * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.streak_type ? `${t.streak_type === "WIN" ? "W" : "L"}${t.streak_length}` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.final_rank != null ? `#${t.final_rank}` : "—"}
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
