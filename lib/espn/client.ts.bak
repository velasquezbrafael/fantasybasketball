import type { EspnLeagueResponse } from "./types";

const BASE = "https://fantasy.espn.com/apis/v3/games/fba";

export interface EspnAuth {
  leagueId: string;
  swid: string; // looks like "{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
  espnS2: string;
}

function getAuthFromEnv(): EspnAuth {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const swid = process.env.ESPN_SWID;
  const espnS2 = process.env.ESPN_S2;

  if (!leagueId || !swid || !espnS2) {
    throw new Error(
      "Missing ESPN credentials. Set ESPN_LEAGUE_ID, ESPN_SWID, and ESPN_S2 " +
        "in your environment. See README.md for how to find these."
    );
  }

  return { leagueId, swid, espnS2 };
}

/**
 * Fetches raw league data for a given season. `views` controls which
 * slices of data ESPN includes in the response — see README for the
 * full list of views this app relies on.
 *
 * For the CURRENT season, ESPN serves data from /seasons/{year}/segments/0/leagues/{id}.
 * For PAST seasons, it's served from /leagueHistory/{id}?seasonId={year} instead
 * and the response comes back as an array with one league object per call.
 */
export async function fetchEspnLeague(
  season: number,
  views: string[],
  { historical = false, auth }: { historical?: boolean; auth?: EspnAuth } = {}
): Promise<EspnLeagueResponse> {
  const creds = auth ?? getAuthFromEnv();
  const viewQuery = views.map((v) => `view=${v}`).join("&");

  const url = historical
    ? `${BASE}/leagueHistory/${creds.leagueId}?seasonId=${season}&${viewQuery}`
    : `${BASE}/seasons/${season}/segments/0/leagues/${creds.leagueId}?${viewQuery}`;

  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${creds.espnS2}; SWID=${creds.swid}`,
      "User-Agent": "Mozilla/5.0 (compatible; FantasyHoopsTracker/1.0)",
    },
    // ESPN data changes at most a few times a day for most of these
    // views; the sync route controls how often we actually call this.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `ESPN API request failed (${res.status} ${res.statusText}) for season ${season}: ${body.slice(
        0,
        300
      )}`
    );
  }

  const json = await res.json();

  // Historical endpoint returns an array (one entry, sometimes more if
  // the league changed IDs across seasons) — normalize to a single object.
  return historical ? (Array.isArray(json) ? json[0] : json) : json;
}

export const VIEWS = {
  team: "mTeam",
  roster: "mRoster",
  matchup: "mMatchup",
  matchupScore: "mMatchupScore",
  settings: "mSettings",
  standings: "mStandings",
  schedule: "mScoreboard",
  transactions: "mTransactions2",
} as const;
