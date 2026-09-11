import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAllTeamSeasonRows } from "@/lib/data";
import { computeAllTimeStandings } from "@/lib/teamStats";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

const MEDAL_ROW_CLASS = ["medal-1", "medal-2", "medal-3"];

function seasonLabel(seasonId: number): string {
  return `${seasonId - 1}-${String(seasonId).slice(2)}`;
}

export default async function RecordsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const rows = await getAllTeamSeasonRows();
  if (rows.length === 0) return <EmptyState title="No seasons synced yet" />;

  const standings = computeAllTimeStandings(rows);
  const mostTitles = Math.max(...standings.map((s) => s.championships));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">All-Time Records</h1>
        <p className="text-muted text-sm mt-1">
          Every synced season rolled up by franchise — a rename doesn&rsquo;t reset the
          history, ESPN keeps the same team ID under the hood.
        </p>
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium">Team</th>
              <th className="text-right px-4 py-3 font-medium">Seasons</th>
              <th className="text-right px-4 py-3 font-medium">Titles</th>
              <th className="text-right px-4 py-3 font-medium">Career Record</th>
              <th className="text-right px-4 py-3 font-medium">Career Win%</th>
              <th className="text-right px-4 py-3 font-medium">Best Season</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.espnTeamId}
                className={`border-t border-border hover:bg-surface-2/60 transition-colors ${
                  MEDAL_ROW_CLASS[i] ?? ""
                }`}
              >
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/teams/${s.espnTeamId}`} className="flex items-center gap-2.5 hover:text-accent transition-colors">
                    <TeamLogo logo={s.logo} name={s.name} size={26} />
                    <span>
                      {s.name}
                      {s.championships === mostTitles && mostTitles > 0 && (
                        <span className="ml-1.5">👑</span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{s.seasonsPlayed}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.championships > 0 ? "🏆".repeat(Math.min(s.championships, 3)) : "—"}
                  {s.championships > 3 && ` ×${s.championships}`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.totalWins}-{s.totalLosses}
                  {s.totalTies ? `-${s.totalTies}` : ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {(s.careerWinPct * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {s.bestSeasonId != null
                    ? `${(s.bestSeasonWinPct * 100).toFixed(0)}% (${seasonLabel(s.bestSeasonId)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-xs">
        👑 marks the franchise(s) with the most championships. Titles come from ESPN&rsquo;s own
        final playoff placement (<code className="text-foreground">final_rank</code>), so a
        season only counts once its bracket is decided.
      </p>
    </div>
  );
}
