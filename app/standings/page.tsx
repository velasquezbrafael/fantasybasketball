import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const metadata: Metadata = { title: "Standings" };

export const dynamic = "force-dynamic";

const MEDAL_ROW_CLASS = ["medal-1", "medal-2", "medal-3"];

export default async function StandingsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups] = await Promise.all([getTeams(season.id), getMatchups(season.id)]);

  // ESPN doesn't fill in streaks for category leagues, so work them out from
  // finished matchups: the run of identical results (W/L/T) ending at the
  // team's most recent decided week.
  const streakByTeam = new Map<number, string>();
  {
    const results = new Map<number, string[]>();
    const decided = matchups
      .filter((m) => !m.playoff_tier_type && m.winner !== "UNDECIDED" && m.away_team_id != null)
      .sort((a, b) => a.matchup_period_id - b.matchup_period_id);
    for (const m of decided) {
      const home = m.winner === "HOME" ? "W" : m.winner === "AWAY" ? "L" : "T";
      const away = m.winner === "AWAY" ? "W" : m.winner === "HOME" ? "L" : "T";
      results.set(m.home_team_id, [...(results.get(m.home_team_id) ?? []), home]);
      results.set(m.away_team_id as number, [...(results.get(m.away_team_id as number) ?? []), away]);
    }
    for (const [id, seq] of results) {
      const last = seq[seq.length - 1];
      let n = 0;
      for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++;
      streakByTeam.set(id, `${last}${n}`);
    }
  }
  // Same win% (everyone at 0-0 preseason, or a genuine tie) falls back to
  // alphabetical — same rule as Power Rankings — instead of whatever order
  // the DB happened to return.
  const sorted = [...teams].sort(
    (a, b) => b.win_pct - a.win_pct || a.name.localeCompare(b.name)
  );
  const seasonDecided = teams.some((t) => t.final_rank != null);
  // Preseason everyone is 0-0: no medals, no 0.0%, no "L0" streaks.
  const started = teams.some((t) => t.wins + t.losses + t.ties > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Standings</h1>
        <p className="text-muted text-sm mt-1">
          Record is the category record (9-Categories league) — {seasonDecided
            ? "the playoff bracket is decided, so Final Rank is the real result."
            : started
              ? "sorted by regular-season win% until the playoff bracket decides it."
              : "everyone is 0-0 until the first games are played (listed A-Z for now)."}
        </p>
      </div>
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 sm:px-4 py-3 font-medium">#</th>
              <th className="text-left px-3 sm:px-4 py-3 font-medium">Team</th>
              <th className="text-right px-3 sm:px-4 py-3 font-medium">Record</th>
              <th className="text-right px-3 sm:px-4 py-3 font-medium">Win%</th>
              <th className="hidden sm:table-cell text-right px-4 py-3 font-medium">Streak</th>
              <th className="hidden sm:table-cell text-right px-4 py-3 font-medium">Final Rank</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr
                key={t.id}
                className={`border-t border-border hover:bg-surface-2/60 transition-colors ${
                  (started ? MEDAL_ROW_CLASS[i] : undefined) ?? ""
                }`}
              >
                <td className="px-3 sm:px-4 py-3 text-muted">{started ? i + 1 : "—"}</td>
                <td className="px-3 sm:px-4 py-3 font-medium">
                  <Link href={`/teams/${t.espn_team_id}`} className="flex items-center gap-2.5 hover:text-accent transition-colors">
                    <TeamLogo logo={t.logo} name={t.name} size={26} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {t.name}
                      {t.abbrev && <span className="hidden sm:inline text-muted text-xs font-normal ml-1.5">{t.abbrev}</span>}
                    </span>
                  </Link>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""}
                </td>
                <td className="px-3 sm:px-4 py-3 text-right tabular-nums">
                  {started ? `${(t.win_pct * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums">
                  {streakByTeam.get(t.espn_team_id) ??
                    (t.streak_type && t.streak_length > 0
                      ? `${t.streak_type === "WIN" ? "W" : "L"}${t.streak_length}`
                      : "—")}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums">
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
