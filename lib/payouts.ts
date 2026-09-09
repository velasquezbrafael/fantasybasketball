// These match the shape of rows read back from Supabase (lib/data.ts),
// not the ESPN transform types — snake_case, same as every other page.
export interface TeamRow {
  id: number;
  espn_team_id: number;
  name: string;
  abbrev: string | null;
  logo: string | null;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  points_for: number;
  points_against: number;
  final_rank: number | null;
  [key: string]: unknown;
}

export interface MatchupRow {
  matchup_period_id: number;
  home_team_id: number;
  home_score: number | null;
  away_team_id: number | null;
  away_score: number | null;
  winner: string | null;
  playoff_tier_type: string | null;
  home_cat_wins: number | null;
  home_cat_losses: number | null;
  home_cat_ties: number | null;
  away_cat_wins: number | null;
  away_cat_losses: number | null;
  away_cat_ties: number | null;
  [key: string]: unknown;
}

export interface WeeklyWinner {
  matchupPeriodId: number;
  teamEspnIds: number[]; // more than one if tied
  // Category record for the week (e.g. "6-3-0"). Falls back to raw score
  // for a points-scoring league that doesn't have category data.
  record: string;
}

/**
 * The league's "Week Winner" award goes to whoever has the single best
 * week across the whole league — for this category-scoring league that
 * means most categories won, not "highest score" (ESPN doesn't populate
 * a numeric score at all for category leagues). Only regular-season
 * weeks count (playoff_tier_type is null), matching the league rules'
 * "15 week winners" for a 15-week regular season — and only weeks where
 * every matchup has finished.
 */
export function computeWeeklyWinners(matchups: MatchupRow[]): WeeklyWinner[] {
  const regularSeason = matchups.filter((m) => !m.playoff_tier_type);

  const byPeriod = new Map<number, MatchupRow[]>();
  for (const m of regularSeason) {
    const arr = byPeriod.get(m.matchup_period_id) ?? [];
    arr.push(m);
    byPeriod.set(m.matchup_period_id, arr);
  }

  const winners: WeeklyWinner[] = [];

  for (const [period, periodMatchups] of byPeriod) {
    const allDecided = periodMatchups.every((m) => m.winner && m.winner !== "UNDECIDED");
    if (!allDecided) continue;

    const usesCategoryScoring = periodMatchups.some((m) => m.home_cat_wins != null);

    type Scored = { teamId: number; sortKey: number; record: string };
    const scored: Scored[] = [];

    for (const m of periodMatchups) {
      if (usesCategoryScoring) {
        scored.push({
          teamId: m.home_team_id,
          sortKey: m.home_cat_wins ?? 0,
          record: `${m.home_cat_wins ?? 0}-${m.home_cat_losses ?? 0}${
            m.home_cat_ties ? `-${m.home_cat_ties}` : ""
          }`,
        });
        if (m.away_team_id != null) {
          scored.push({
            teamId: m.away_team_id,
            sortKey: m.away_cat_wins ?? 0,
            record: `${m.away_cat_wins ?? 0}-${m.away_cat_losses ?? 0}${
              m.away_cat_ties ? `-${m.away_cat_ties}` : ""
            }`,
          });
        }
      } else {
        const homeScore = Number(m.home_score ?? 0);
        scored.push({ teamId: m.home_team_id, sortKey: homeScore, record: homeScore.toFixed(0) });
        if (m.away_team_id != null) {
          const awayScore = Number(m.away_score ?? 0);
          scored.push({ teamId: m.away_team_id, sortKey: awayScore, record: awayScore.toFixed(0) });
        }
      }
    }

    if (scored.length === 0) continue;
    const best = Math.max(...scored.map((s) => s.sortKey));
    const winningEntries = scored.filter((s) => s.sortKey === best);

    winners.push({
      matchupPeriodId: period,
      teamEspnIds: winningEntries.map((s) => s.teamId),
      record: winningEntries[0].record,
    });
  }

  return winners.sort((a, b) => b.matchupPeriodId - a.matchupPeriodId);
}

export interface PotStanding {
  place: "1st" | "2nd" | "3rd" | "Last";
  team: TeamRow;
}

/**
 * Maps current standings onto the money positions. Once the playoff
 * bracket is decided, 1st/2nd/3rd have to come from ESPN's own
 * `final_rank` (the actual bracket result) — regular-season record and
 * final placement can differ a lot (a team can back into the playoffs
 * with a losing record and still win it all). Falls back to win_pct
 * ordering mid-season, before any bracket result exists.
 *
 * "Last" is always by regular-season record — the punishment pool is
 * about who had the worst season, not who lost early in the playoffs.
 */
export function computePotStandings(teams: TeamRow[]): PotStanding[] {
  if (teams.length === 0) return [];

  const seasonDecided = teams.some((t) => t.final_rank != null);
  const byRecord = [...teams].sort((a, b) => b.win_pct - a.win_pct);

  const topThree = seasonDecided
    ? [...teams].sort((a, b) => (a.final_rank ?? Infinity) - (b.final_rank ?? Infinity))
    : byRecord;

  const standings: PotStanding[] = [];
  if (topThree[0]) standings.push({ place: "1st", team: topThree[0] });
  if (topThree[1]) standings.push({ place: "2nd", team: topThree[1] });
  if (topThree[2]) standings.push({ place: "3rd", team: topThree[2] });

  const last = byRecord[byRecord.length - 1];
  if (last && byRecord.length > 3) standings.push({ place: "Last", team: last });

  return standings;
}
