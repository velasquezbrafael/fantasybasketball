import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getMatchups, getLatestPowerRankings, getTeams } from "@/lib/data";
import { simulatePlayoffOdds, type SimMatchup, type SimTeam } from "@/lib/playoffOdds";
import { leagueRules } from "@/lib/leagueConfig";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

function OddsBar({ autoBye, playIn, miss }: { autoBye: number; playIn: number; miss: number }) {
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-surface-2">
      <div className="bg-accent-2" style={{ width: `${autoBye}%` }} />
      <div className="bg-amber-400" style={{ width: `${playIn}%` }} />
      <div className="bg-surface-2" style={{ width: `${miss}%` }} />
    </div>
  );
}

export default async function PlayoffOddsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, matchups, powerRankings] = await Promise.all([
    getTeams(season.id),
    getMatchups(season.id),
    getLatestPowerRankings(season.id),
  ]);

  if (teams.length === 0) {
    return <EmptyState title="No teams synced yet" />;
  }

  const strengthByTeam = new Map(powerRankings.map((r) => [r.espn_team_id, r.power_score ?? 0]));
  // A team with no snapshot yet (shouldn't happen once synced, but don't
  // let a missing row crash the sim) falls back to a neutral strength
  // rather than 0, which would read as "guaranteed worst team in the league."
  const avgStrength =
    powerRankings.length > 0
      ? powerRankings.reduce((sum, r) => sum + (r.power_score ?? 0), 0) / powerRankings.length
      : 0.5;

  const simTeams: SimTeam[] = teams.map((t) => ({
    espnTeamId: t.espn_team_id,
    name: t.name,
    wins: t.wins ?? 0,
    losses: t.losses ?? 0,
    ties: t.ties ?? 0,
    strength: strengthByTeam.get(t.espn_team_id) ?? avgStrength,
  }));

  const remainingMatchups: SimMatchup[] = matchups
    .filter((m) => m.winner === "UNDECIDED" && !m.playoff_tier_type)
    .map((m) => ({
      matchupPeriodId: m.matchup_period_id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
    }));

  const decidedCount = matchups.filter((m) => m.winner !== "UNDECIDED" && !m.playoff_tier_type).length;
  const totalRegularSeasonGames = matchups.filter((m) => !m.playoff_tier_type).length;
  const seasonStarted = decidedCount > 0;

  const odds =
    remainingMatchups.length === 0 && !seasonStarted
      ? [] // nothing decided and nothing to simulate — shouldn't happen, guard anyway
      : simulatePlayoffOdds(simTeams, remainingMatchups, leagueRules.playoffFormat);

  const { autoByeCount, playInFieldSize } = leagueRules.playoffFormat;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Playoff Odds</h1>
        <p className="text-muted text-sm mt-1">
          {seasonStarted
            ? `${decidedCount} of ${totalRegularSeasonGames} regular-season games played — `
            : "Preseason — "}
          {(8000).toLocaleString()} simulated seasons using each team&rsquo;s Power Ranking score
          against the league&rsquo;s real remaining schedule.
        </p>
        <p className="text-muted text-xs mt-2">
          Top {autoByeCount} clinch the bracket outright. The next {playInFieldSize} fight for the
          final spots in a play-in round.
        </p>
      </div>

      <div className="card p-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-2 inline-block" /> Clinches bracket (top {autoByeCount})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Play-in (seeds {autoByeCount + 1}-
          {autoByeCount + playInFieldSize})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-surface-2 border border-border inline-block" /> Misses playoffs
        </span>
      </div>

      <div className="card divide-y divide-border overflow-hidden">
        <div className="p-3 flex items-center gap-4 text-xs text-muted uppercase tracking-wide">
          <span className="w-7 text-center">Seed</span>
          <span className="flex-1">Team</span>
          <span className="hidden sm:block w-16 text-right">Record</span>
          <span className="hidden md:block w-32">Odds</span>
          <span className="w-20 text-right">Make Playoffs</span>
          <span className="hidden sm:block w-28 text-right">Proj. Record</span>
        </div>
        {odds.map((o, i) => (
          <div key={o.espnTeamId} className="p-4 flex items-center gap-4 card-hover">
            <span className="text-lg font-semibold text-accent w-7 text-center tabular-nums">{i + 1}</span>
            <Link
              href={`/teams/${o.espnTeamId}`}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity"
            >
              <TeamLogo logo={teams.find((t) => t.espn_team_id === o.espnTeamId)?.logo} name={o.name} size={30} />
              <div className="min-w-0">
                <p className="font-medium truncate flex items-center gap-1.5">
                  {o.name}
                  {o.clinched && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent-2/15 text-accent-2 shrink-0">
                      Clinched
                    </span>
                  )}
                  {o.eliminated && seasonStarted && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-danger/15 text-danger shrink-0">
                      Eliminated
                    </span>
                  )}
                </p>
                <p className="text-muted text-xs mt-0.5 sm:hidden">
                  {o.currentWins}-{o.currentLosses}
                  {o.currentTies ? `-${o.currentTies}` : ""}
                </p>
              </div>
            </Link>
            <span className="hidden sm:block w-16 text-right tabular-nums text-sm">
              {o.currentWins}-{o.currentLosses}
              {o.currentTies ? `-${o.currentTies}` : ""}
            </span>
            <div className="hidden md:block w-32">
              <OddsBar autoBye={o.autoByePct} playIn={o.playInPct} miss={o.missPct} />
            </div>
            <span className="w-20 text-right font-semibold tabular-nums">{o.makePlayoffsPct.toFixed(1)}%</span>
            <span className="hidden sm:block w-28 text-right tabular-nums text-sm text-muted">
              {o.projectedWins.toFixed(1)}-{o.projectedLosses.toFixed(1)}
            </span>
          </div>
        ))}
        {odds.length === 0 && (
          <div className="p-6">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
