import type { EspnLeagueResponse, EspnMatchup, EspnTeam } from "./types";

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
}

export interface Matchup {
  espnMatchupId: number;
  matchupPeriodId: number;
  homeTeamId: number;
  homeScore: number;
  awayTeamId: number | null;
  awayScore: number | null;
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
}

export interface PowerRanking extends Team {
  rank: number;
  powerScore: number;
  recentForm: number; // win pct over last 3 completed matchups
}

export function teamName(t: EspnTeam): string {
  const raw = `${t.location ?? ""} ${t.nickname ?? ""}`.trim();
  return raw.length > 0 ? raw : t.abbrev ?? `Team ${t.id}`;
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
  }));
}

/**
 * Power rankings blend three signals so a team that's 8-2 but limped
 * across the last 3 weeks doesn't outrank a 6-4 team that's heating up:
 *   - 50% overall win percentage
 *   - 30% point differential, normalized against the league
 *   - 20% win percentage over the last 3 completed matchups (form)
 */
export function computePowerRankings(
  teams: Team[],
  matchups: Matchup[]
): PowerRanking[] {
  const maxDiff = Math.max(
    1,
    ...teams.map((t) => Math.abs(t.pointsFor - t.pointsAgainst))
  );

  const recentFormByTeam = new Map<number, number>();
  for (const team of teams) {
    const played = matchups
      .filter(
        (m) =>
          (m.homeTeamId === team.espnTeamId || m.awayTeamId === team.espnTeamId) &&
          m.winner !== "UNDECIDED"
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

  const ranked = teams
    .map((team) => {
      const diffScore =
        (team.pointsFor - team.pointsAgainst + maxDiff) / (2 * maxDiff); // 0..1
      const recentForm = recentFormByTeam.get(team.espnTeamId) ?? team.winPct;

      const powerScore =
        0.5 * team.winPct + 0.3 * diffScore + 0.2 * recentForm;

      return { ...team, powerScore, recentForm };
    })
    .sort((a, b) => b.powerScore - a.powerScore)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  return ranked;
}
