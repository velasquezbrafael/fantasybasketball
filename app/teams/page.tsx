import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getTeams } from "@/lib/data";
import { teamBattle } from "@/lib/leagueConfig";
import { computeTeamBattle, formatCatRecord } from "@/lib/teamBattle";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

const MEDAL_CLASS = ["medal-1", "medal-2", "medal-3", ""];

export default async function TeamsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups] = await Promise.all([getTeams(season.id), getMatchups(season.id)]);
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);

  const { rows, started } = computeTeamBattle(teamBattle.teams, matchups);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Teams</h1>
        <p className="text-muted text-sm mt-1">
          The 16 managers are split into 4 teams of 4. Every category you win counts for your team.
          The best team earns extra auction budget next year.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Team standings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r) => {
            const reward = teamBattle.rewards[r.rank - 1];
            return (
              <div
                key={r.key}
                className={`card card-hover p-5 border ${started ? MEDAL_CLASS[r.rank - 1] : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl font-semibold text-accent tabular-nums w-8">
                      {started ? r.rank : "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-2xl tracking-wide leading-none">{r.name}</p>
                      <p className="text-muted text-xs mt-1">
                        {started
                          ? `${(r.catWinPct * 100).toFixed(1)}% category win rate`
                          : "Standings start once games are played"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-semibold tabular-nums">{formatCatRecord(r)}</p>
                    <p className="text-muted text-xs">cats W-L-T</p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-border border-t border-border">
                  {r.members.map((mem) => {
                    const t = teamFor(mem.espnTeamId);
                    return (
                      <Link
                        key={mem.espnTeamId}
                        href={`/teams/${mem.espnTeamId}`}
                        className="flex items-center gap-3 py-2.5 text-sm hover:opacity-90 transition-opacity"
                      >
                        <TeamLogo logo={t?.logo} name={t?.name ?? "Team"} size={26} />
                        <span className="flex-1 min-w-0 truncate font-medium">
                          {t?.name ?? `Team ${mem.espnTeamId}`}
                        </span>
                        <span className="tabular-nums text-muted shrink-0">{formatCatRecord(mem)}</span>
                      </Link>
                    );
                  })}
                </div>

                <p className="text-xs text-muted mt-3">
                  {started ? `Finish: ${reward.place}. ` : ""}Next year&rsquo;s auction budget:{" "}
                  <span className="text-foreground font-medium">
                    {started
                      ? `$${teamBattle.nextYearBaseCap + reward.bonus} (${reward.bonus > 0 ? `+$${reward.bonus}` : "no bonus"})`
                      : "decided by final standing"}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">How it works</h2>
        <div className="card p-5 space-y-4 text-sm">
          <div>
            <p className="font-medium">Scoring</p>
            <p className="text-muted mt-0.5">{teamBattle.scoring}</p>
          </div>
          <div>
            <p className="font-medium">Tiebreaker</p>
            <p className="text-muted mt-0.5">{teamBattle.tiebreaker}</p>
          </div>
          <div>
            <p className="font-medium">How the teams were picked</p>
            <p className="text-muted mt-0.5">
              Managers were ranked by last season&rsquo;s final finish, then snaked into the four
              teams (1-8-9-16, 2-7-10-15, 3-6-11-14, 4-5-12-13) so every team has one manager from
              each quarter of the league.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Reward — next year&rsquo;s auction
        </h2>
        <div className="card divide-y divide-border">
          <div className="p-3 flex items-center text-xs text-muted uppercase tracking-wide">
            <span className="w-16">Finish</span>
            <span className="flex-1">Bonus budget</span>
            <span className="w-20 text-right">Your cap</span>
          </div>
          {teamBattle.rewards.map((rw) => (
            <div key={rw.place} className="p-4 flex items-center text-sm">
              <span className="w-16 font-medium">{rw.place}</span>
              <span className="flex-1 tabular-nums">{rw.bonus > 0 ? `+$${rw.bonus}` : "—"}</span>
              <span className="w-20 text-right font-semibold tabular-nums">
                ${teamBattle.nextYearBaseCap + rw.bonus}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted text-xs mt-3">
          ESPN only allows one cap for the whole league, so it gets set to the top tier and each
          team&rsquo;s own cap is enforced by league rule.
        </p>
      </section>
    </div>
  );
}
