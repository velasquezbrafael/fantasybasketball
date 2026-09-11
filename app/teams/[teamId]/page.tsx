import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getAllTeamSeasonRows,
  getCurrentSeason,
  getLatestPowerRankings,
  getPowerRankTrend,
  getTeamMatchups,
  getTeamSeasons,
} from "@/lib/data";
import { buildTeamNameMap, computeHeadToHead } from "@/lib/teamStats";
import { fetchEspnLeague, VIEWS } from "@/lib/espn/client";
import type { EspnRosterEntry } from "@/lib/espn/types";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

function seasonLabel(seasonId: number): string {
  return `${seasonId - 1}-${String(seasonId).slice(2)}`;
}

// A team's power-rank history for the current season, drawn as a tiny
// inline sparkline — no charting library needed for something this small.
// Rank 1 (best) plots at the top, so an upward line reads as "getting
// better" the same way the trend arrows elsewhere on the site do.
function PowerRankSparkline({
  points,
}: {
  points: { matchup_period_id: number; power_rank: number }[];
}) {
  if (points.length < 2) {
    return (
      <p className="text-muted text-xs">
        Trend shows up after a couple of syncs — check back once more of the season is in.
      </p>
    );
  }

  const ranks = points.map((p) => p.power_rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const range = Math.max(1, maxRank - minRank);
  const w = 200;
  const h = 44;
  const pad = 4;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * w : w / 2;
    const y = pad + ((p.power_rank - minRank) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-11" preserveAspectRatio="none">
        <polyline
          points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted mt-1">
        <span>Best: #{minRank}</span>
        <span>Worst: #{maxRank}</span>
      </div>
    </div>
  );
}

async function fetchTeamRoster(
  seasonId: number,
  espnTeamId: number
): Promise<EspnRosterEntry[] | null> {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const swid = process.env.ESPN_SWID;
  const espnS2 = process.env.ESPN_S2;
  if (!leagueId || !swid || !espnS2) return null;

  try {
    const league = await fetchEspnLeague(seasonId, [VIEWS.team, VIEWS.roster], {
      auth: { leagueId, swid, espnS2 },
    });
    const team = league.teams?.find((t) => t.id === espnTeamId);
    return team?.roster?.entries ?? [];
  } catch {
    // Best-effort — a roster fetch failing shouldn't take down the whole
    // team page, which has plenty to show from Supabase alone.
    return null;
  }
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const { teamId: teamIdParam } = await params;
  const espnTeamId = Number(teamIdParam);
  if (!Number.isFinite(espnTeamId)) {
    return <EmptyState title="Team not found" detail="That doesn't look like a valid team." />;
  }

  const [currentSeason, teamSeasons, matchups, allRows] = await Promise.all([
    getCurrentSeason(),
    getTeamSeasons(espnTeamId),
    getTeamMatchups(espnTeamId),
    getAllTeamSeasonRows(),
  ]);

  if (teamSeasons.length === 0) {
    return (
      <EmptyState
        title="Team not found"
        detail="No synced seasons have a team with this ID."
      />
    );
  }

  const latest = teamSeasons[0];
  const nameMap = buildTeamNameMap(allRows);
  const headToHead = computeHeadToHead(matchups, espnTeamId);
  // A `teams` row exists for a season the moment it's synced — that
  // includes an unstarted current season (0-0) and any season ESPN's own
  // archive never recorded results for. Neither is a season "played".
  const playedSeasons = teamSeasons.filter(
    (s) => (s.wins ?? 0) + (s.losses ?? 0) + (s.ties ?? 0) > 0
  );
  const championships = playedSeasons.filter((s) => s.final_rank === 1).length;
  const totalWins = playedSeasons.reduce((s, r) => s + (r.wins ?? 0), 0);
  const totalLosses = playedSeasons.reduce((s, r) => s + (r.losses ?? 0), 0);
  const totalTies = playedSeasons.reduce((s, r) => s + (r.ties ?? 0), 0);
  const totalGames = totalWins + totalLosses + totalTies;
  const careerWinPct = totalGames > 0 ? totalWins / totalGames : 0;

  const currentSeasonRow = currentSeason
    ? teamSeasons.find((s) => s.season_id === currentSeason.id) ?? null
    : null;

  const [trend, roster, powerRankings] = await Promise.all([
    currentSeason ? getPowerRankTrend(currentSeason.id, espnTeamId) : Promise.resolve([]),
    currentSeason ? fetchTeamRoster(currentSeason.id, espnTeamId) : Promise.resolve(null),
    currentSeason ? getLatestPowerRankings(currentSeason.id) : Promise.resolve([]),
  ]);
  const latestRanking = powerRankings.find((r) => r.espn_team_id === espnTeamId) ?? null;

  const starters = (roster ?? [])
    .filter((e) => e.lineupSlotId < 12)
    .sort((a, b) => a.lineupSlotId - b.lineupSlotId);
  const bench = (roster ?? []).filter((e) => e.lineupSlotId >= 12);

  function PlayerRow({ entry }: { entry: EspnRosterEntry }) {
    const player = entry.playerPoolEntry?.player;
    if (!player) return null;
    const hurt = player.injuryStatus && !["ACTIVE", "NORMAL"].includes(player.injuryStatus);
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="truncate">{player.fullName}</span>
        {hurt && (
          <span className="text-danger text-xs font-medium shrink-0 ml-2">
            {player.injuryStatus?.replace(/_/g, " ")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <TeamLogo logo={latest.logo} name={latest.name} size={56} />
        <div>
          <h1 className="font-display text-4xl tracking-wide text-gradient">{latest.name}</h1>
          <p className="text-muted text-sm mt-1">
            {latest.abbrev && <span className="mr-2">{latest.abbrev}</span>}
            {playedSeasons.length} season{playedSeasons.length === 1 ? "" : "s"} played
            {championships > 0 && (
              <span className="text-foreground ml-2">
                {"🏆".repeat(Math.min(championships, 5))} {championships} title
                {championships === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="stat-chip">
          Career <strong>
            {totalWins}-{totalLosses}
            {totalTies ? `-${totalTies}` : ""}
          </strong>
        </span>
        <span className="stat-chip">
          Career win% <strong>{(careerWinPct * 100).toFixed(1)}%</strong>
        </span>
        {currentSeasonRow && (
          <span className="stat-chip">
            {seasonLabel(currentSeason!.id)} record{" "}
            <strong>
              {currentSeasonRow.wins}-{currentSeasonRow.losses}
              {currentSeasonRow.ties ? `-${currentSeasonRow.ties}` : ""}
            </strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
            Season by Season
          </h2>
          <div className="card divide-y divide-border">
            {teamSeasons.map((s) => {
              const played = (s.wins ?? 0) + (s.losses ?? 0) + (s.ties ?? 0) > 0;
              const isCurrent = currentSeason?.id === s.season_id;
              return (
                <div key={s.season_id} className="p-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {seasonLabel(s.season_id)}
                    {s.final_rank === 1 && <span>🏆</span>}
                  </span>
                  {played ? (
                    <span className="flex items-center gap-3 tabular-nums">
                      <span className="text-muted">
                        {s.wins}-{s.losses}
                        {s.ties ? `-${s.ties}` : ""}
                      </span>
                      <span className="w-12 text-right">{(s.win_pct * 100).toFixed(0)}%</span>
                      <span className="w-10 text-right text-muted">
                        {s.final_rank != null ? `#${s.final_rank}` : "—"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">{isCurrent ? "Not started" : "No data"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
            Head-to-Head
          </h2>
          <div className="card divide-y divide-border">
            {headToHead.map((h) => {
              const opp = nameMap.get(h.opponentEspnTeamId);
              const games = h.wins + h.losses + h.ties;
              return (
                <Link
                  key={h.opponentEspnTeamId}
                  href={`/teams/${h.opponentEspnTeamId}`}
                  className="p-3 flex items-center justify-between text-sm hover:bg-surface-2/60 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <TeamLogo logo={opp?.logo} name={opp?.name ?? `Team ${h.opponentEspnTeamId}`} size={22} />
                    <span className="truncate">{opp?.name ?? `Team ${h.opponentEspnTeamId}`}</span>
                  </span>
                  <span className="tabular-nums shrink-0 ml-2">
                    {h.wins}-{h.losses}
                    {h.ties ? `-${h.ties}` : ""}
                    <span className="text-muted ml-1">
                      ({games > 0 ? Math.round((h.wins / games) * 100) : 0}%)
                    </span>
                  </span>
                </Link>
              );
            })}
            {headToHead.length === 0 && (
              <div className="p-6">
                <EmptyState title="No matchups played yet" detail="" />
              </div>
            )}
          </div>
        </section>
      </div>

      {currentSeason && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
              Power Rank Trend — {seasonLabel(currentSeason.id)}
            </h2>
            <div className="card p-4">
              <PowerRankSparkline points={trend} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
              Power Ranking Breakdown
            </h2>
            <div className="card p-4">
              {latestRanking ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-semibold tabular-nums">
                      #{latestRanking.power_rank}
                    </span>
                    <span className="text-muted text-xs">
                      Score <span className="text-foreground font-medium tabular-nums">
                        {Number(latestRanking.power_score).toFixed(3)}
                      </span>
                    </span>
                  </div>
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-surface-2">
                    <div
                      className="bg-accent"
                      style={{ width: `${Math.max(0, latestRanking.contribution_record ?? 0) * 100}%` }}
                    />
                    <div
                      className="bg-accent-2"
                      style={{ width: `${Math.max(0, latestRanking.contribution_diff ?? 0) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ width: `${Math.max(0, latestRanking.contribution_form ?? 0) * 100}%` }}
                    />
                    <div
                      className="bg-violet-400"
                      style={{ width: `${Math.max(0, latestRanking.contribution_roster ?? 0) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      Record
                      <span className="ml-auto tabular-nums text-muted">
                        {((latestRanking.contribution_record ?? 0) * 100).toFixed(1)} / 30
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-accent-2 shrink-0" />
                      Differential
                      <span className="ml-auto tabular-nums text-muted">
                        {((latestRanking.contribution_diff ?? 0) * 100).toFixed(1)} / 15
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      Recent form
                      <span className="ml-auto tabular-nums text-muted">
                        {((latestRanking.contribution_form ?? 0) * 100).toFixed(1)} / 15
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                      Roster talent
                      <span className="ml-auto tabular-nums text-muted">
                        {((latestRanking.contribution_roster ?? 0) * 100).toFixed(1)} / 40
                      </span>
                    </span>
                  </div>
                  <p className="text-muted text-xs pt-2 border-t border-border">
                    {latestRanking.wins}-{latestRanking.losses}
                    {latestRanking.ties ? `-${latestRanking.ties}` : ""} · roster{" "}
                    {Math.round((latestRanking.roster_strength ?? 0) * 100)}%
                    {latestRanking.injured_count ? (
                      <span className="text-danger">
                        {" "}
                        · {latestRanking.injured_count} out/hurt
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : (
                <p className="text-muted text-sm">No power ranking data yet.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
              Current Roster
            </h2>
            <div className="card p-4">
              {roster === null && (
                <p className="text-muted text-sm">
                  Live roster isn&rsquo;t available right now.
                </p>
              )}
              {roster !== null && roster.length === 0 && (
                <p className="text-muted text-sm">No roster set yet.</p>
              )}
              {roster !== null && roster.length > 0 && (
                <div>
                  {starters.length > 0 && (
                    <div className="divide-y divide-border">
                      {starters.map((e) => (
                        <PlayerRow key={e.playerId} entry={e} />
                      ))}
                    </div>
                  )}
                  {bench.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-muted text-xs uppercase tracking-wide mb-1">Bench / IR</p>
                      <div className="divide-y divide-border">
                        {bench.map((e) => (
                          <PlayerRow key={e.playerId} entry={e} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
