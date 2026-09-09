import type { EspnLeagueResponse, EspnMatchup, EspnPlayer, EspnTeam } from "./types";

export interface Team {
  espnTeamId: number;
  name: string;
  abbrev: string;
  logo: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  streakType: string | null;
  streakLength: number;
  playoffSeed: number | null;
  finalRank: number | null;
  // Raw (not yet league-normalized) roster talent score, 0..1 per player
  // averaged across the roster — see computeRosterStrength below.
  rosterScoreRaw: number;
  rosterSize: number;
  // Rostered players currently anything other than fully active
  // (OUT, DAY_TO_DAY, DOUBTFUL, SUSPENSION, INJURY_RESERVE, ...).
  injuredCount: number;
}

export interface Matchup {
  espnMatchupId: number;
  matchupPeriodId: number;
  homeTeamId: number;
  homeScore: number;
  awayTeamId: number | null;
  awayScore: number | null;
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
  playoffTierType: string | null;
  // Category (H2H Each Category) win/loss/tie for each side, e.g. 6-3-0.
  // Null for a points-scoring league where this doesn't apply.
  homeCatWins: number | null;
  homeCatLosses: number | null;
  homeCatTies: number | null;
  awayCatWins: number | null;
  awayCatLosses: number | null;
  awayCatTies: number | null;
}

export function teamName(t: EspnTeam): string {
  // ESPN's current team model uses a single `name` field ("The Bol Bol's").
  // Older `location`/`nickname` fields are a legacy fallback — most teams
  // in a modern league won't have those set at all.
  if (t.name && t.name.trim().length > 0) return t.name.trim();
  const legacy = `${t.location ?? ""} ${t.nickname ?? ""}`.trim();
  if (legacy.length > 0) return legacy;
  return t.abbrev ?? `Team ${t.id}`;
}

/**
 * How much of a player's talent still counts toward their team's current
 * strength, given their injury status. Not binary — a day-to-day guy
 * still counts for most of his value, a guy on IR counts for almost none.
 */
export function injuryAvailabilityFactor(status: string | undefined | null): number {
  switch (status) {
    case "ACTIVE":
    case "NORMAL":
    case "PROBABLE":
      return 1.0;
    case "DAY_TO_DAY":
    case "QUESTIONABLE":
      return 0.75;
    case "DOUBTFUL":
      return 0.5;
    case "OUT":
    case "SUSPENSION":
      return 0.15;
    case "INJURY_RESERVE":
      return 0.05;
    default:
      // Unknown/unset — don't let an unrecognized ESPN status code zero
      // out a player, just treat it as a mild discount.
      return 0.9;
  }
}

/**
 * A single player's fantasy value, 0..1, blending two signals ESPN
 * actually exposes without a full per-category stat pull:
 *   - preseason STANDARD rank (a fixed prior — rank 1 is the best)
 *   - live percentOwned (reacts to the player's actual role/performance
 *     all season, so it self-corrects for breakouts and busts)
 * This is intentionally a lightweight proxy, not a full 9-category
 * z-score model (that would need every player's per-stat averages).
 */
export function playerTalentScore(player: EspnPlayer): number {
  const rank = player.draftRanksByRankType?.STANDARD?.rank;
  // Rank 1 -> 1.0, rank 300+ -> ~0. Unranked (deep waiver wire) -> a low
  // floor rather than 0, since an unranked player can still contribute.
  const rankScore = rank && rank > 0 ? Math.max(0, 1 - (rank - 1) / 300) : 0.05;

  const owned = player.ownership?.percentOwned;
  const ownScore = owned != null ? Math.min(1, Math.max(0, owned / 100)) : rankScore;

  return 0.5 * rankScore + 0.5 * ownScore;
}

/**
 * A team's raw roster strength: average injury-adjusted player talent
 * across the full roster (bench included — depth matters in a
 * category league). Not yet normalized against the rest of the league;
 * computePowerRankings does that once it has every team's raw score.
 */
export function computeRosterStrength(t: EspnTeam): {
  rosterScoreRaw: number;
  rosterSize: number;
  injuredCount: number;
} {
  const entries = t.roster?.entries ?? [];
  if (entries.length === 0) {
    return { rosterScoreRaw: 0, rosterSize: 0, injuredCount: 0 };
  }

  let total = 0;
  let injuredCount = 0;

  for (const entry of entries) {
    const player = entry.playerPoolEntry?.player;
    if (!player) continue;

    const availability = injuryAvailabilityFactor(player.injuryStatus);
    if (availability < 1.0) injuredCount += 1;

    total += playerTalentScore(player) * availability;
  }

  return {
    rosterScoreRaw: total / entries.length,
    rosterSize: entries.length,
    injuredCount,
  };
}

export function normalizeTeams(league: EspnLeagueResponse): Team[] {
  return (league.teams ?? []).map((t) => {
    const rec = t.record?.overall ?? {
      wins: 0,
      losses: 0,
      ties: 0,
      percentage: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
    const roster = computeRosterStrength(t);
    return {
      espnTeamId: t.id,
      name: teamName(t),
      abbrev: t.abbrev,
      logo: t.logo ?? null,
      wins: rec.wins,
      losses: rec.losses,
      ties: rec.ties,
      winPct: rec.percentage,
      pointsFor: rec.pointsFor,
      pointsAgainst: rec.pointsAgainst,
      streakType: rec.streakType ?? null,
      streakLength: rec.streakLength ?? 0,
      playoffSeed: t.playoffSeed ?? null,
      finalRank: t.rankCalculatedFinal && t.rankCalculatedFinal > 0 ? t.rankCalculatedFinal : null,
      rosterScoreRaw: roster.rosterScoreRaw,
      rosterSize: roster.rosterSize,
      injuredCount: roster.injuredCount,
    };
  });
}

export function normalizeMatchups(league: EspnLeagueResponse): Matchup[] {
  return (league.schedule ?? []).map((m: EspnMatchup) => ({
    espnMatchupId: m.id,
    matchupPeriodId: m.matchupPeriodId,
    homeTeamId: m.home.teamId,
    homeScore: m.home.totalPoints,
    awayTeamId: m.away?.teamId ?? null,
    awayScore: m.away?.totalPoints ?? null,
    winner: m.winner,
    playoffTierType: m.playoffTierType && m.playoffTierType !== "NONE" ? m.playoffTierType : null,
    homeCatWins: m.home.cumulativeScore?.wins ?? null,
    homeCatLosses: m.home.cumulativeScore?.losses ?? null,
    homeCatTies: m.home.cumulativeScore?.ties ?? null,
    awayCatWins: m.away?.cumulativeScore?.wins ?? null,
    awayCatLosses: m.away?.cumulativeScore?.losses ?? null,
    awayCatTies: m.away?.cumulativeScore?.ties ?? null,
  }));
}

export interface PowerRanking extends Team {
  rank: number;
  previousRank: number | null;
  powerScore: number;
  recentForm: number; // win pct over last 3 completed matchups
  rosterStrength: number; // roster score, normalized 0..1 against the league
  // Each already multiplied by its weight, so they sum to powerScore —
  // lets the UI show a literal stacked breakdown per team.
  contributions: {
    record: number;
    diff: number;
    form: number;
    roster: number;
  };
}

/**
 * Power rankings blend four signals so a team that's 8-2 but limped
 * across the last 3 weeks — or is 8-2 with three starters hurt — doesn't
 * automatically outrank a healthier, hotter 6-4 team:
 *
 *   - 30% overall category win% (the season-long record)
 *   - 15% win-loss differential, normalized against the league
 *   - 15% recent form — win% over the last 3 completed REGULAR SEASON
 *     matchups (playoff matchups are excluded so a bad consolation-
 *     bracket week doesn't drag down a title contender's form score)
 *   - 40% roster strength — average injury-adjusted player talent
 *     (blends ESPN's preseason player rank with live ownership%, see
 *     playerTalentScore), normalized against the best roster in the
 *     league. This is what actually captures "player rankings" and
 *     "injury status": a team sitting hurt studs scores lower here even
 *     if their record hasn't caught up to it yet.
 *
 * Note this intentionally uses category wins/losses rather than
 * pointsFor/pointsAgainst — in this category-scoring league those are
 * always 0.
 */
export function computePowerRankings(
  teams: Team[],
  matchups: Matchup[],
  previousRankByTeam?: Map<number, number>
): PowerRanking[] {
  const maxDiff = Math.max(1, ...teams.map((t) => Math.abs(t.wins - t.losses)));
  const maxRosterScore = Math.max(0.0001, ...teams.map((t) => t.rosterScoreRaw));

  const recentFormByTeam = new Map<number, number>();
  for (const team of teams) {
    const played = matchups
      .filter(
        (m) =>
          (m.homeTeamId === team.espnTeamId || m.awayTeamId === team.espnTeamId) &&
          m.winner !== "UNDECIDED" &&
          !m.playoffTierType
      )
      .sort((a, b) => b.matchupPeriodId - a.matchupPeriodId)
      .slice(0, 3);

    if (played.length === 0) {
      recentFormByTeam.set(team.espnTeamId, team.winPct);
      continue;
    }

    const wins = played.filter((m) => {
      const isHome = m.homeTeamId === team.espnTeamId;
      return (isHome && m.winner === "HOME") || (!isHome && m.winner === "AWAY");
    }).length;

    recentFormByTeam.set(team.espnTeamId, wins / played.length);
  }

  const WEIGHT_RECORD = 0.3;
  const WEIGHT_DIFF = 0.15;
  const WEIGHT_FORM = 0.15;
  const WEIGHT_ROSTER = 0.4;

  const ranked = teams
    .map((team) => {
      const diffScore = (team.wins - team.losses + maxDiff) / (2 * maxDiff); // 0..1
      const recentForm = recentFormByTeam.get(team.espnTeamId) ?? team.winPct;
      const rosterStrength = team.rosterScoreRaw / maxRosterScore; // 0..1

      const contributions = {
        record: WEIGHT_RECORD * team.winPct,
        diff: WEIGHT_DIFF * diffScore,
        form: WEIGHT_FORM * recentForm,
        roster: WEIGHT_ROSTER * rosterStrength,
      };

      const powerScore =
        contributions.record + contributions.diff + contributions.form + contributions.roster;

      return { ...team, powerScore, recentForm, rosterStrength, contributions };
    })
    .sort((a, b) => b.powerScore - a.powerScore)
    .map((t, i) => ({
      ...t,
      rank: i + 1,
      previousRank: previousRankByTeam?.get(t.espnTeamId) ?? null,
    }));

  return ranked;
}
