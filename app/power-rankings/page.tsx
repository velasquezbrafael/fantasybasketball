import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getLatestPowerRankings, getTeams } from "@/lib/data";
import { rankTrend } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

const MEDAL_ROW_CLASS = ["medal-1", "medal-2", "medal-3"];

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend == null || trend === 0) {
    return <span className="text-muted text-xs w-10 text-center">—</span>;
  }
  const up = trend > 0;
  return (
    <span className={`text-xs font-medium w-10 text-center ${up ? "text-accent-2" : "text-danger"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(trend)}
    </span>
  );
}

// A tiny horizontal stacked bar showing what each weighted contribution
// is worth out of the max possible power score (1.0).
function ContributionBar({
  record,
  diff,
  form,
  roster,
}: {
  record: number;
  diff: number;
  form: number;
  roster: number;
}) {
  const segments = [
    { value: record, className: "bg-accent" },
    { value: diff, className: "bg-accent-2" },
    { value: form, className: "bg-amber-400" },
    { value: roster, className: "bg-violet-400" },
  ];
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-surface-2">
      {segments.map((s, i) => (
        <div key={i} className={s.className} style={{ width: `${Math.max(0, s.value) * 100}%` }} />
      ))}
    </div>
  );
}

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
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Power Rankings</h1>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          A blend of four signals, not just the raw ESPN standings: category record (30%),
          category win-loss differential (15%), form over the last 3 regular-season weeks (15%),
          and roster talent (40%) — each rostered player&rsquo;s preseason rank blended with their
          live ESPN ownership%, discounted for anyone currently hurt or suspended. That last piece
          is what lets a team with hurt stars or a thin bench rank below a healthier team with a
          similar record.
        </p>
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        <div className="p-3 flex items-center gap-4 text-xs text-muted uppercase tracking-wide">
          <span className="w-7 text-center">#</span>
          <span className="w-10 text-center">Trend</span>
          <span className="flex-1">Team</span>
          <span className="hidden sm:block w-40">Breakdown</span>
          <span className="w-16 text-right">Score</span>
        </div>
        {rankings.map((r, i) => {
          const team = teamFor(r.espn_team_id);
          const injured = r.injured_count ?? 0;
          return (
            <div key={r.id} className={`p-4 flex items-center gap-4 card-hover ${MEDAL_ROW_CLASS[i] ?? ""}`}>
              <span className="text-xl font-semibold text-accent w-7 text-center tabular-nums">
                {r.power_rank}
              </span>
              <TrendBadge trend={rankTrend(r.power_rank, r.previous_power_rank)} />
              <Link href={`/teams/${r.espn_team_id}`} className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-90 transition-opacity">
                <TeamLogo logo={team?.logo} name={team?.name ?? "Team"} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {team?.name ?? `Team ${r.espn_team_id}`}
                    {team?.abbrev && (
                      <span className="text-muted text-xs font-normal ml-1.5">{team.abbrev}</span>
                    )}
                  </p>
                  <p className="text-muted text-xs mt-0.5">
                    {r.wins}-{r.losses}
                    {r.ties ? `-${r.ties}` : ""} · roster {Math.round((r.roster_strength ?? 0) * 100)}%
                    {injured > 0 && (
                      <span className="text-danger">
                        {" "}
                        · {injured} player{injured > 1 ? "s" : ""} out/hurt
                      </span>
                    )}
                  </p>
                  <div className="sm:hidden mt-2">
                    <ContributionBar
                      record={r.contribution_record ?? 0}
                      diff={r.contribution_diff ?? 0}
                      form={r.contribution_form ?? 0}
                      roster={r.contribution_roster ?? 0}
                    />
                  </div>
                </div>
              </Link>
              <div className="hidden sm:block w-40">
                <ContributionBar
                  record={r.contribution_record ?? 0}
                  diff={r.contribution_diff ?? 0}
                  form={r.contribution_form ?? 0}
                  roster={r.contribution_roster ?? 0}
                />
              </div>
              <p className="w-16 text-right font-semibold tabular-nums">
                {Number(r.power_score).toFixed(3)}
              </p>
            </div>
          );
        })}
        {rankings.length === 0 && (
          <div className="p-6">
            <EmptyState />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" /> Record
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-2 inline-block" /> Differential
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Recent form
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" /> Roster talent
        </span>
      </div>
    </div>
  );
}
