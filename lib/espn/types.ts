// Minimal typings for the shapes we actually use from ESPN's
// unofficial Fantasy Basketball API. ESPN does not publish an OpenAPI
// spec for this, so these are deliberately loose (lots of `any`
// fallbacks) rather than a full reverse-engineered schema.

export interface EspnTeam {
  id: number;
  location: string;
  nickname: string;
  abbrev: string;
  logo?: string;
  record: {
    overall: {
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
