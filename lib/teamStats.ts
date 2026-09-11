// Pure computation over rows already read from Supabase (lib/data.ts does
// the fetching) — team-identity stats that span every synced season:
// all-time standings, head-to-head records, and a name/logo lookup. ESPN
// keeps espn_team_id stable for a franchise slot across seasons even when
// a manager renames their team, which is what makes "career" stats
// possible at all — a rename ("Big Ballers" -> "United Nations FBL" era)
// doesn't break the identity, it just changes what name shows up.

export interface TeamSeasonRow {
  espn_team_id: number;
  name: string;
  abbrev: string | null;
  logo: string | null;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  final_rank: number | null;
  season_id: number;
  [key: string]: unknown;
}

export interface MatchupRow {
  season_id?: number;
  matchup_period_id: number;
  home_team_id: number;
  away_team_id: number | null;
  winner: string | null;
  playoff_tier_type: string | null;
  [key: string]: unknown;
}

export interface AllTimeStanding {
  espnTeamId: number;
  name: string;
  abbrev: string | null;
  logo: string | null;
  seasonsPlayed: number;
  championships: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  careerWinPct: number;
  bestSeasonWinPct: number;
  bestSeasonId: number | null;
  bestFinish: number | null;
  bestFinishSeasonId: number | null;
}

/**
 * Rolls every synced season's team rows up into one row per franchise,
 * grouped by espn_team_id. `rows` should be ordered season_id desc so the
 * first row seen per team is its most recent name/logo/abbrev.
 */
export function computeAllTimeStandings(rows: TeamSeasonRow[]): AllTimeStanding[] {
  const byTeam = new Map<number, TeamSeasonRow[]>();
  for (const row of rows) {
    const arr = byTeam.get(row.espn_team_id) ?? [];
    arr.push(row);
    byTeam.set(row.espn_team_id, arr);
  }

  return Array.from(byTeam.entries())
    .map(([espnTeamId, allSeasons]) => {
      // A `teams` row exists for a season the moment it's synced — that
      // includes the current preseason (0-0 before the first game) and
      // any season ESPN's own archive never actually recorded results
      // for. Neither is a season the team "played", so both are excluded
      // from the counted/best-season stats below (they still can't drag
      // down career win% since they contribute 0 wins and 0 losses).
      const played = allSeasons.filter(
        (r) => (r.wins ?? 0) + (r.losses ?? 0) + (r.ties ?? 0) > 0
      );

      const totalWins = played.reduce((s, r) => s + (r.wins ?? 0), 0);
      const totalLosses = played.reduce((s, r) => s + (r.losses ?? 0), 0);
      const totalTies = played.reduce((s, r) => s + (r.ties ?? 0), 0);
      const totalGames = totalWins + totalLosses + totalTies;
      const championships = played.filter((r) => r.final_rank === 1).length;
      const bestSeason = [...played].sort((a, b) => b.win_pct - a.win_pct)[0];
      // Best career finish — the lowest final_rank across every season
      // whose playoff bracket was actually decided. A season that's still
      // in progress (final_rank null) just isn't a candidate yet.
      const decidedSeasons = played.filter((r) => r.final_rank != null);
      const bestFinishSeason = [...decidedSeasons].sort(
        (a, b) => (a.final_rank ?? Infinity) - (b.final_rank ?? Infinity)
      )[0];
      const latest = allSeasons[0];

      return {
        espnTeamId,
        name: latest.name,
        abbrev: latest.abbrev,
        logo: latest.logo,
        seasonsPlayed: played.length,
        championships,
        totalWins,
        totalLosses,
        totalTies,
        careerWinPct: totalGames > 0 ? totalWins / totalGames : 0,
        bestSeasonWinPct: bestSeason?.win_pct ?? 0,
        bestSeasonId: bestSeason?.season_id ?? null,
        bestFinish: bestFinishSeason?.final_rank ?? null,
        bestFinishSeasonId: bestFinishSeason?.season_id ?? null,
      };
    })
    .filter((s) => s.seasonsPlayed > 0)
    .sort(
      (a, b) => b.careerWinPct - a.careerWinPct || b.championships - a.championships
    );
}

/**
 * espn_team_id -> most recent name/abbrev/logo, for labeling an opponent
 * in a head-to-head row without a second round-trip per team. `rows`
 * should be ordered season_id desc, same requirement as above.
 */
export function buildTeamNameMap(
  rows: TeamSeasonRow[]
): Map<number, { name: string; abbrev: string | null; logo: string | null }> {
  const map = new Map<number, { name: string; abbrev: string | null; logo: string | null }>();
  for (const row of rows) {
    if (!map.has(row.espn_team_id)) {
      map.set(row.espn_team_id, { name: row.name, abbrev: row.abbrev, logo: row.logo });
    }
  }
  return map;
}

export interface HeadToHeadRecord {
  opponentEspnTeamId: number;
  wins: number;
  losses: number;
  ties: number;
}

/**
 * Every decided matchup a team has ever played (across every synced
 * season), rolled up by opponent. Byes (away_team_id null) and undecided
 * games are skipped.
 */
export function computeHeadToHead(
  matchups: MatchupRow[],
  espnTeamId: number
): HeadToHeadRecord[] {
  const byOpponent = new Map<number, HeadToHeadRecord>();

  for (const m of matchups) {
    if (!m.winner || m.winner === "UNDECIDED") continue;
    const isHome = m.home_team_id === espnTeamId;
    const isAway = m.away_team_id === espnTeamId;
    if (!isHome && !isAway) continue;
    const opponentId = isHome ? m.away_team_id : m.home_team_id;
    if (opponentId == null) continue; // bye week

    const rec =
      byOpponent.get(opponentId) ??
      ({ opponentEspnTeamId: opponentId, wins: 0, losses: 0, ties: 0 } as HeadToHeadRecord);
    if (m.winner === "TIE") rec.ties += 1;
    else if ((isHome && m.winner === "HOME") || (isAway && m.winner === "AWAY")) rec.wins += 1;
    else rec.losses += 1;
    byOpponent.set(opponentId, rec);
  }

  return Array.from(byOpponent.values()).sort(
    (a, b) => b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties)
  );
}
