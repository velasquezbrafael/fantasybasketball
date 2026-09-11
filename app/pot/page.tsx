import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getCurrentSeason,
  getLatestPowerRankings,
  getLeagueAwards,
  getMatchups,
  getTeams,
} from "@/lib/data";
import { computePotStandings, computeWeeklyWinnerRows } from "@/lib/payouts";
import { categoryOfWeek, leagueRules } from "@/lib/leagueConfig";
import { fetchTopPlayersByPosition, type TopPlayer } from "@/lib/espn/players";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

async function fetchNumberOnes(
  seasonId: number
): Promise<Record<string, TopPlayer[]> | null> {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const swid = process.env.ESPN_SWID;
  const espnS2 = process.env.ESPN_S2;
  if (!leagueId || !swid || !espnS2) return null;

  try {
    return await fetchTopPlayersByPosition(
      seasonId,
      { leagueId, swid, espnS2 },
      3
    );
  } catch {
    // Best-effort — a live player-data hiccup shouldn't take down the
    // rest of the pot page, which has plenty to show without it.
    return null;
  }
}

const MEDAL_CLASS: Record<string, string> = {
  "1st": "medal-1",
  "2nd": "medal-2",
  "3rd": "medal-3",
  Last: "medal-last",
};

const MEDAL_ICON: Record<string, string> = {
  "1st": "🏆",
  "2nd": "🥈",
  "3rd": "🥉",
  Last: "💀",
};

export default async function PotPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups, awards, powerRankings, numberOnes] = await Promise.all([
    getTeams(season.id),
    getMatchups(season.id),
    getLeagueAwards(season.id),
    getLatestPowerRankings(season.id),
    fetchNumberOnes(season.id),
  ]);

  const seasonStarted = teams.some((t) => (t.wins ?? 0) + (t.losses ?? 0) + (t.ties ?? 0) > 0);
  const potStandings = seasonStarted ? computePotStandings(teams) : [];
  const currentPeriod = Math.max(0, ...powerRankings.map((r) => r.matchup_period_id ?? 0));
  const weeklyRows = computeWeeklyWinnerRows(
    matchups,
    leagueRules.specialWinningsPot.weekWinner.weeks,
    currentPeriod
  );
  const teamFor = (id: number) => teams.find((t) => t.espn_team_id === id);
  const nameFor = (id: number) => teamFor(id)?.name ?? `Team ${id}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">The Pot</h1>
        <p className="text-muted text-sm mt-1">
          ${leagueRules.buyIn} buy-in × {leagueRules.teamCount} teams = ${leagueRules.totalPot} total pot.
          Updated live off the current standings — not final until the season ends.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          If the season ended today
        </h2>
        {seasonStarted ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {potStandings.map((s) => {
                const payout = leagueRules.championsPot.payouts.find((p) => p.place === s.place);
                return (
                  <div
                    key={s.place}
                    className={`card card-hover p-4 border ${MEDAL_CLASS[s.place] ?? ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {s.place}
                      </p>
                      <span className="text-lg leading-none">{MEDAL_ICON[s.place]}</span>
                    </div>
                    <Link href={`/teams/${s.team.espn_team_id}`} className="flex items-center gap-2.5 mt-2.5 min-w-0 hover:opacity-90 transition-opacity">
                      <TeamLogo logo={s.team.logo} name={s.team.name} size={32} />
                      <p className="font-medium leading-tight min-w-0 truncate">
                        {s.team.name}
                        {s.team.abbrev && (
                          <span className="text-muted text-xs font-normal block mt-0.5">{s.team.abbrev}</span>
                        )}
                      </p>
                    </Link>
                    <p className="text-muted text-sm mt-2">
                      {s.team.wins}-{s.team.losses}
                      {s.team.ties ? `-${s.team.ties}` : ""}
                    </p>
                    <p className="text-lg font-semibold mt-2 tabular-nums">
                      {s.place === "Last"
                        ? leagueRules.championsPot.lastPlace.label
                        : `${payout?.amount ?? ""}${payout?.extra ? ` ${payout.extra}` : ""}`}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-muted text-xs mt-3">
              {leagueRules.championsPot.lastPlace.detail}
            </p>
          </>
        ) : (
          <div className="card p-6">
            <EmptyState title="Season hasn't started" detail="Standings will fill in once games are underway." />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Weekly Winners — ${leagueRules.specialWinningsPot.weekWinner.perWeek} each,{" "}
            {leagueRules.specialWinningsPot.weekWinner.weeks} weeks ($
            {leagueRules.specialWinningsPot.weekWinner.total} pot)
          </h2>
          <Link href="/weekly-winners" className="text-sm text-accent hover:underline shrink-0 ml-4">
            Full history →
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {weeklyRows.slice(0, 5).map((row) => (
            <div key={row.matchupPeriodId} className="p-4 flex items-center gap-4 text-sm card-hover">
              <span className="text-muted w-16 shrink-0">Week {row.matchupPeriodId}</span>
              <span className="hidden sm:inline-flex shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                {categoryOfWeek(row.matchupPeriodId)}
              </span>

              {row.status === "not-started" && (
                <span className="flex-1 text-muted">Not started yet</span>
              )}

              {row.status !== "not-started" && (
                <>
                  {row.status === "live" && (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live
                    </span>
                  )}
                  <Link href={`/teams/${row.teamEspnIds[0]}`} className="flex items-center gap-2 flex-1 min-w-0 hover:text-accent transition-colors">
                    {row.teamEspnIds.slice(0, 1).map((id) => (
                      <TeamLogo key={id} logo={teamFor(id)?.logo} name={nameFor(id)} size={24} />
                    ))}
                    <span className="font-medium truncate">
                      {row.teamEspnIds.map(nameFor).join(" & ")}
                      {row.teamEspnIds.length > 1 && <span className="text-muted"> (tied)</span>}
                    </span>
                  </Link>
                  <span className={`tabular-nums font-semibold shrink-0 ${row.status === "live" ? "text-muted" : ""}`}>
                    {row.record}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Number Ones — best player per position (${leagueRules.specialWinningsPot.numberOnes.perAward}{" "}
          each, ${leagueRules.specialWinningsPot.numberOnes.total} pot)
        </h2>
        {numberOnes ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leagueRules.specialWinningsPot.numberOnes.positions.map((position) => (
              <div key={position} className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                  {position}
                </p>
                <div className="space-y-2">
                  {(numberOnes[position] ?? []).map((p, i) => {
                    const owner = p.ownedByEspnTeamId != null ? teamFor(p.ownedByEspnTeamId) : null;
                    return (
                      <div key={p.playerId} className="flex items-center gap-2 text-sm">
                        <span className="text-muted w-4 shrink-0 tabular-nums">{i + 1}</span>
                        <span className="font-medium flex-1 min-w-0 truncate">{p.fullName}</span>
                        {owner ? (
                          <Link
                            href={`/teams/${owner.espn_team_id}`}
                            className="flex items-center gap-1.5 shrink-0 text-muted hover:text-accent transition-colors min-w-0"
                          >
                            <TeamLogo logo={owner.logo} name={owner.name} size={18} />
                            <span className="truncate max-w-[7rem]">{owner.name}</span>
                          </Link>
                        ) : (
                          <span className="text-muted shrink-0">Free agent</span>
                        )}
                      </div>
                    );
                  })}
                  {(numberOnes[position] ?? []).length === 0 && (
                    <p className="text-muted text-sm">No data yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-4">
            <p className="text-muted text-sm">
              {leagueRules.specialWinningsPot.numberOnes.positions.join(" · ")} — live player data isn&rsquo;t
              available right now.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          League Awards
        </h2>
        <div className="card divide-y divide-border">
          {(awards.length > 0
            ? awards
            : [...leagueRules.cashAwards, ...leagueRules.votedAwards]
          ).map((a: { category?: string; label?: string; detail?: string | null; amount?: number | null; winner_note?: string | null }, i: number) => (
            <div key={i} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{a.category ?? a.label}</p>
                {a.detail && <p className="text-muted text-xs mt-0.5">{a.detail}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted text-xs">
                  {a.amount ? `$${a.amount}` : "voted"}
                </p>
                <p className="font-medium">{a.winner_note ?? "TBD"}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted text-xs mt-3">
          These get decided at season end.
        </p>
      </section>
    </div>
  );
}
