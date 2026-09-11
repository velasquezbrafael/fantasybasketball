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
import { buildLeagueHeadlines } from "@/lib/espn/news";
import { matchupSideRecord, rankTrend } from "@/lib/format";
import { leagueRules } from "@/lib/leagueConfig";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

type TeamRow = Awaited<ReturnType<typeof getTeams>>[number];

function teamFor(teams: TeamRow[], espnTeamId: number) {
  return teams.find((t) => t.espn_team_id === espnTeamId);
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
          detail="Check back once this league's data has synced."
        />
      </div>
    );
  }

  const season = await getCurrentSeason();

  if (!season) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Welcome to your league dashboard</h1>
        <EmptyState title="No season synced yet" />
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
  const seasonNotStarted = allMatchups.length === 0;
  const seasonStarted = teams.some((t) => (t.wins ?? 0) + (t.losses ?? 0) + (t.ties ?? 0) > 0);
  const nameOfTeam = (id: number) => teamFor(teams, id)?.name ?? "";
  // Before the season starts every team displays as #1 (the underlying
  // power_rank is a meaningless preseason tiebreak, not a real ranking),
  // so sort by name alphabetically instead of by that number. Once real
  // games are in, sort by power_rank and fall back to name only for a
  // genuine tie.
  const rankedPowerRankings = [...powerRankings].sort((a, b) =>
    seasonStarted
      ? a.power_rank - b.power_rank || nameOfTeam(a.espn_team_id).localeCompare(nameOfTeam(b.espn_team_id))
      : nameOfTeam(a.espn_team_id).localeCompare(nameOfTeam(b.espn_team_id))
  );
  const newsHeadlines = buildLeagueHeadlines(transactions, teams);

  return (
    <div className="space-y-8">
      {/* The sticky positioning lives on this outer div, kept free of any
          filter/backdrop-blur. Safari has a long-standing bug where a
          `position: sticky` element that also carries `backdrop-filter`
          stops repainting while pinned — the content behind it visibly
          "freezes" mid-scroll instead of blurring live. Putting the
          background/blur on a separate, non-sticky inner div avoids it
          entirely while looking identical. */}
      <div className="sticky top-[61px] z-[5]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/90 backdrop-blur-md shadow-lg p-6 sm:p-8">
          <div className="court-decoration" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-1">
                {season.id - 1}-{String(season.id).slice(2)} Season
              </p>
              <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-gradient leading-none">
                {season.league_name ?? "Your League"}
              </h1>
            </div>
            <div className="flex gap-2 text-sm">
              <Link
                href="/pot"
                className="px-3 py-1.5 rounded-md border border-border bg-surface/80 hover:bg-surface-2 transition-colors"
              >
                The Pot →
              </Link>
              <Link
                href="/standings"
                className="px-3 py-1.5 rounded-md border border-border bg-surface/80 hover:bg-surface-2 transition-colors"
              >
                Full standings →
              </Link>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2 mt-6">
            <span className="stat-chip">
              <strong>{teams.length}</strong> teams
            </span>
            <span className="stat-chip">
              {currentPeriod > 0 ? (
                <>
                  Week <strong>{currentPeriod}</strong>
                </>
              ) : (
                "Preseason"
              )}
            </span>
            <span className="stat-chip">
              Pot <strong>${leagueRules.totalPot}</strong>
            </span>
            <span className="stat-chip">
              Buy-in <strong>${leagueRules.buyIn}</strong>
            </span>
          </div>
        </div>
      </div>

      {seasonNotStarted ? (
        <EmptyState
          title="Season hasn't tipped off yet"
          detail="Rosters and matchups will show up here once the draft happens and games start."
        />
      ) : (
        <>
          {latestWeeklyWinner && (
            <div className="card card-hover glow-accent p-4 flex items-center justify-between">
              <Link
                href={`/teams/${latestWeeklyWinner.teamEspnIds[0]}`}
                className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity"
              >
                <TeamLogo
                  logo={teamFor(teams, latestWeeklyWinner.teamEspnIds[0])?.logo}
                  name={teamFor(teams, latestWeeklyWinner.teamEspnIds[0])?.name ?? "Team"}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide">
                    Week {latestWeeklyWinner.matchupPeriodId} winner — $5
                  </p>
                  <p className="font-semibold mt-0.5 truncate">
                    {latestWeeklyWinner.teamEspnIds
                      .map((id) => teamFor(teams, id)?.name ?? `Team ${id}`)
                      .join(" & ")}
                    {latestWeeklyWinner.teamEspnIds.length > 1 && (
                      <span className="text-muted font-normal"> (tied)</span>
                    )}
                  </p>
                </div>
              </Link>
              <p className="text-2xl font-semibold tabular-nums text-accent shrink-0 ml-4">
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
              Record, category differential, recent form, and injury-adjusted roster talent — not
              just who&rsquo;s hot this week.
            </p>
            <div className="card divide-y divide-border">
              {rankedPowerRankings.slice(0, 5).map((r) => {
                const team = teamFor(teams, r.espn_team_id);
                return (
                  <div key={r.id} className="p-4 flex items-center gap-4">
                    <span className="text-xl font-semibold text-accent w-7 tabular-nums">
                      {seasonStarted ? r.power_rank : 1}
                    </span>
                    <TrendBadge trend={seasonStarted ? rankTrend(r.power_rank, r.previous_power_rank) : null} />
                    <Link
                      href={`/teams/${r.espn_team_id}`}
                      className="flex-1 flex items-center gap-4 min-w-0 hover:opacity-90 transition-opacity"
                    >
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
                          {r.injured_count ? (
                            <span className="text-danger"> · {r.injured_count} banged up</span>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                    <p className="font-semibold tabular-nums">{Number(r.power_score).toFixed(3)}</p>
                  </div>
                );
              })}
              {powerRankings.length === 0 && <EmptyState />}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
              This week&rsquo;s matchups
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentPeriodMatchups.map((m) => {
                const home = teamFor(teams, m.home_team_id);
                const away = m.away_team_id ? teamFor(teams, m.away_team_id) : null;
                return (
                  <div key={m.id} className="card card-hover p-4 flex items-center justify-between gap-2">
                    <Link href={`/teams/${m.home_team_id}`} className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity">
                      <TeamLogo logo={home?.logo} name={home?.name ?? "Team"} size={36} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{home?.name ?? `Team ${m.home_team_id}`}</p>
                        <p className="text-2xl font-semibold tabular-nums">
                          {matchupSideRecord(m.home_cat_wins, m.home_cat_losses, m.home_cat_ties, m.home_score)}
                        </p>
                      </div>
                    </Link>
                    <span className="text-muted text-xs px-2 font-display tracking-widest shrink-0">VS</span>
                    {away ? (
                      <Link
                        href={`/teams/${m.away_team_id}`}
                        className="flex items-center gap-3 flex-row-reverse text-right min-w-0 hover:opacity-90 transition-opacity"
                      >
                        <TeamLogo logo={away.logo} name={away.name} size={36} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{away.name}</p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {matchupSideRecord(m.away_cat_wins, m.away_cat_losses, m.away_cat_ties, m.away_score)}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 flex-row-reverse text-right min-w-0">
                        <TeamLogo logo={null} name="Bye" size={36} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">Bye</p>
                          <p className="text-2xl font-semibold tabular-nums">—</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {currentPeriodMatchups.length === 0 && <EmptyState />}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            League News
          </h2>
          <Link href="/league-news" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {newsHeadlines.slice(0, 5).map((n) => (
            <div key={n.id} className="p-4 text-sm flex items-center gap-3">
              <TeamLogo logo={n.teamLogo} name={n.teamName ?? "League"} size={24} />
              <span className="flex-1">{n.headline}</span>
              <span className="text-muted text-xs whitespace-nowrap">
                {new Date(n.publishedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {newsHeadlines.length === 0 && (
            <div className="p-4">
              <EmptyState title="No moves synced yet" detail="" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
