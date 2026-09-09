// These match the shape of rows read back from Supabase (lib/data.ts),
// not the ESPN transform types — snake_case, same as every other page.
export interface TeamRow {
  id: number;
  espn_team_id: number;
  name: string;
  abbrev: string | null;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  points_for: number;
  points_against: number;
  [key: string]: unknown;
}

export interface WeeklyWinner {
  matchupPeriodId: number;
  teamEspnIds: number[]; // more than one if tied
  score: number;
}

/**
 * The league's "Week Winner" award goes to whoever posts the single
 * highest score across the whole league in a given week — not just
 * whoever wins their own matchup. Only counts weeks where every
 * matchup has finished (no UNDECIDED results), so a week in progress
 * doesn't get crowned early.
 */
export function computeWeeklyWinners(
  matchups: Array<{
    matchup_period_id: number;
    home_team_id: number;
    home_score: number | null;
    away_team_id: number | null;
    away_score: number | null;
    winner: string | null;
  }>
): WeeklyWinner[] {
  const byPeriod = new Map<number, typeof matchups>();
  for (const m of matchups) {
    const arr = byPeriod.get(m.matchup_period_id) ?? [];
    arr.push(m);
    byPeriod.set(m.matchup_period_id, arr);
  }

  const winners: WeeklyWinner[] = [];

  for (const [period, periodMatchups] of byPeriod) {
    const allDecided = periodMatchups.every((m) => m.winner && m.winner !== "UNDECIDED");
    if (!allDecided) continue;

    let best = -Infinity;
    const scored: Array<{ teamId: number; score: number }> = [];
    for (const m of periodMatchups) {
      scored.push({ teamId: m.home_team_id, score: Number(m.home_score ?? 0) });
      if (m.away_team_id != null) {
        scored.push({ teamId: m.away_team_id, score: Number(m.away_score ?? 0) });
      }
    }
    for (const s of scored) best = Math.max(best, s.score);

    const winningTeams = scored.filter((s) => s.score === best).map((s) => s.teamId);

    winners.push({ matchupPeriodId: period, teamEspnIds: winningTeams, score: best });
  }

  return winners.sort((a, b) => b.matchupPeriodId - a.matchupPeriodId);
}

export interface PotStanding {
  place: "1st" | "2nd" | "3rd" | "Last";
  team: TeamRow;
}

/** Maps current standings onto the money positions everyone actually cares about. */
export function computePotStandings(teams: TeamRow[]): PotStanding[] {
  const sorted = [...teams].sort((a, b) => b.win_pct - a.win_pct);
  if (sorted.length === 0) return [];

  const standings: PotStanding[] = [];
  if (sorted[0]) standings.push({ place: "1st", team: sorted[0] });
  if (sorted[1]) standings.push({ place: "2nd", team: sorted[1] });
  if (sorted[2]) standings.push({ place: "3rd", team: sorted[2] });
  const last = sorted[sorted.length - 1];
  if (last && sorted.length > 3) standings.push({ place: "Last", team: last });

  return standings;
}
