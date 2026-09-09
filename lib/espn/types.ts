// Minimal typings for the shapes we actually use from ESPN's
// unofficial Fantasy Basketball API. ESPN does not publish an OpenAPI
// spec for this, so these are deliberately loose (lots of `any`
// fallbacks) rather than a full reverse-engineered schema.

export interface EspnTeam {
  id: number;
  // `name` is the current, user-set display name ("The Bol Bol's"). Older
  // ESPN league data sometimes only has `location`/`nickname` instead —
  // both are kept so teamName() can fall back gracefully.
  name?: string;
  location?: string;
  nickname?: string;
  abbrev: string;
  logo?: string;
  record: {
    overall: {
      // For a category-scoring (H2H Each Category) league, these are
      // CATEGORY win/loss/tie tallies across the season (e.g. 71-63-1 for
      // a 9-cat league over 15 weeks), not matchup counts — this matches
      // what ESPN's own "REC" column shows. pointsFor/pointsAgainst are
      // always 0 for category leagues; they only mean something in a
      // points-scoring league.
      wins: number;
      losses: number;
      ties: number;
      percentage: number;
      pointsFor: number;
      pointsAgainst: number;
      streakType?: string;
      streakLength?: number;
    };
  };
  playoffSeed?: number;
  // ESPN's own computed final standing after playoffs — 0/absent until
  // the playoff bracket is decided. This is the source of truth for who
  // actually won 1st/2nd/3rd, since that's a bracket result, not just
  // whoever had the best regular-season record.
  rankCalculatedFinal?: number;
  points?: number;
  owners?: string[];
}

export interface EspnMatchupSide {
  teamId: number;
  totalPoints: number;
  cumulativeScore?: {
    wins: number;
    losses: number;
    ties: number;
  };
}

export interface EspnMatchup {
  id: number;
  matchupPeriodId: number;
  home: EspnMatchupSide;
  away?: EspnMatchupSide;
  winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
  playoffTierType?: string;
}

export interface EspnTransactionItem {
  playerId: number;
  type: string; // ADD, DROP, TRADE, etc.
  fromTeamId?: number;
  toTeamId?: number;
}

export interface EspnTransaction {
  id: string;
  type: string; // WAIVER, FREEAGENT, TRADE_ACCEPT, ROSTER, etc.
  status: string; // EXECUTED, PENDING, INVALID, ...
  proposedDate?: number;
  processDate?: number;
  teamId?: number;
  items?: EspnTransactionItem[];
}

export interface EspnLeagueSettings {
  name: string;
  size: number;
  scoringSettings?: Record<string, unknown>;
  scheduleSettings?: {
    matchupPeriodCount?: number;
    playoffTeamCount?: number;
  };
}

export interface EspnLeagueResponse {
  id: number;
  seasonId: number;
  status: {
    currentMatchupPeriod: number;
    latestScoringPeriod: number;
    isActive: boolean;
  };
  settings: EspnLeagueSettings;
  teams: EspnTeam[];
  schedule: EspnMatchup[];
  transactions?: EspnTransaction[];
}
