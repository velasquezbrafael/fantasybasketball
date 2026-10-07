// The "Teams" overlay: 4 teams of 4 managers, scored by the team's combined
// category W-L-T. Pure computation over matchup rows already read from
// Supabase (lib/data.ts does the fetching). Only finished regular-season
// matchups count — playoff weeks only involve some managers, so including
// them would make the teams unequal.

export interface TeamBattleMatchup {
  home_team_id: number;
  away_team_id: number | null;
  winner: string | null;
  playoff_tier_type: string | null;
  home_cat_wins: number | null;
  home_cat_losses: number | null;
  home_cat_ties: number | null;
  away_cat_wins: number | null;
  away_cat_losses: number | null;
  away_cat_ties: number | null;
}

export interface TeamBattleConfig {
  key: string;
  name: string;
  memberIds: readonly number[];
}

export interface Tally {
  catWins: number;
  catLosses: number;
  catTies: number;
  matchupWins: number;
  matchupLosses: number;
  matchupTies: number;
}

export interface MemberLine extends Tally {
  espnTeamId: number;
}

export interface TeamBattleRow extends Tally {
  key: string;
  name: string;
  members: MemberLine[];
  catWinPct: number;
  rank: number;
}

const emptyTally = (): Tally => ({
  catWins: 0,
  catLosses: 0,
  catTies: 0,
  matchupWins: 0,
  matchupLosses: 0,
  matchupTies: 0,
});

function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games === 0 ? 0 : (wins + ties * 0.5) / games;
}

/**
 * Category win % per team, ties counted as half a win. Ranked by that,
 * then combined matchup win % (same half-tie rule), then team letter.
 * Before any matchup is decided every team ties at 0, so the order is
 * simply A-D — callers should check `started` before showing a rank.
 */
export function computeTeamBattle(
  teams: readonly TeamBattleConfig[],
  matchups: TeamBattleMatchup[]
): { rows: TeamBattleRow[]; started: boolean } {
  const memberTally = new Map<number, Tally>();
  for (const t of teams) for (const id of t.memberIds) memberTally.set(id, emptyTally());

  let started = false;

  for (const m of matchups) {
    if (m.playoff_tier_type) continue; // regular season only
    if (!m.winner || m.winner === "UNDECIDED") continue; // not finished
    if (m.away_team_id == null) continue; // bye — no opponent, nothing to count

    const sides: Array<{ id: number; w: number | null; l: number | null; t: number | null; result: "W" | "L" | "T" }> = [
      {
        id: m.home_team_id,
        w: m.home_cat_wins,
        l: m.home_cat_losses,
        t: m.home_cat_ties,
        result: m.winner === "HOME" ? "W" : m.winner === "AWAY" ? "L" : "T",
      },
      {
        id: m.away_team_id,
        w: m.away_cat_wins,
        l: m.away_cat_losses,
        t: m.away_cat_ties,
        result: m.winner === "AWAY" ? "W" : m.winner === "HOME" ? "L" : "T",
      },
    ];

    for (const s of sides) {
      const tally = memberTally.get(s.id);
      if (!tally) continue; // a manager not on any team
      started = true;
      tally.catWins += s.w ?? 0;
      tally.catLosses += s.l ?? 0;
      tally.catTies += s.t ?? 0;
      if (s.result === "W") tally.matchupWins++;
      else if (s.result === "L") tally.matchupLosses++;
      else tally.matchupTies++;
    }
  }

  const rows = teams.map((t): TeamBattleRow => {
    const members: MemberLine[] = t.memberIds.map((id) => ({
      espnTeamId: id,
      ...(memberTally.get(id) ?? emptyTally()),
    }));
    const total = members.reduce<Tally>((acc, mem) => {
      acc.catWins += mem.catWins;
      acc.catLosses += mem.catLosses;
      acc.catTies += mem.catTies;
      acc.matchupWins += mem.matchupWins;
      acc.matchupLosses += mem.matchupLosses;
      acc.matchupTies += mem.matchupTies;
      return acc;
    }, emptyTally());
    return {
      key: t.key,
      name: t.name,
      members,
      ...total,
      catWinPct: winPct(total.catWins, total.catLosses, total.catTies),
      rank: 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.catWinPct - a.catWinPct ||
      winPct(b.matchupWins, b.matchupLosses, b.matchupTies) -
        winPct(a.matchupWins, a.matchupLosses, a.matchupTies) ||
      a.key.localeCompare(b.key)
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Members sorted best-first inside each team (same rule, per manager).
  for (const r of rows) {
    r.members.sort(
      (a, b) =>
        winPct(b.catWins, b.catLosses, b.catTies) - winPct(a.catWins, a.catLosses, a.catTies) ||
        a.espnTeamId - b.espnTeamId
    );
  }

  return { rows, started };
}

export function formatCatRecord(t: Pick<Tally, "catWins" | "catLosses" | "catTies">): string {
  return `${t.catWins}-${t.catLosses}-${t.catTies}`;
}
