import type { EspnLeagueResponse, EspnTransaction } from "./types";

// ESPN migrated this API off fantasy.espn.com to a dedicated read host at
// some point in 2026. The old host now just 302s to the fantasy homepage
// instead of erroring, which is what makes this easy to miss — you get
// back an HTML page instead of a clear "not found".
const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba";

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
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json",
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

  // ESPN sometimes returns a 200 HTML page (e.g. if it silently redirected
  // to the fantasy homepage) instead of an error status. Catch that here
  // with a clear message rather than letting JSON.parse blow up cryptically.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `ESPN returned non-JSON content (${contentType || "unknown content-type"}) for season ${season}. ` +
        `This usually means the league/season doesn't exist or your ESPN_SWID/ESPN_S2 cookies are stale. ` +
        `Body preview: ${body.slice(0, 200)}`
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
  // Requesting this view on the main league fetch does NOT actually
  // return a `transactions` array (confirmed against a live league —
  // the key is simply absent from the response). Kept here because it's
  // harmless to request, but real transaction data comes from
  // fetchRecentActivity below instead.
  transactions: "mTransactions2",
  // Full draft results (auction bids, nominators). Empty `picks` until
  // the draft has happened.
  draft: "mDraftDetail",
} as const;

// ESPN's own message-type codes for a roster-activity message, as seen in
// the `communication/` topics feed below. Reverse-engineered (ESPN
// doesn't document these) — matches what other unofficial ESPN Fantasy
// API clients have found. Unrecognized codes are ignored rather than
// guessed at.
const ACTIVITY_MESSAGE_TYPE: Record<number, "ADD" | "DROP" | "TRADE"> = {
  178: "ADD", // free agent add
  180: "ADD", // waiver add
  179: "DROP",
  181: "TRADE",
  239: "TRADE",
};

interface EspnActivityMessage {
  messageId?: number;
  type?: number;
  from?: number;
  to?: number;
  targetId?: number;
  memberId?: string;
}

interface EspnActivityTopic {
  id?: string;
  type?: string;
  date?: number;
  messages?: EspnActivityMessage[];
}

/**
 * Real roster transactions (waiver claims, free-agent adds/drops, trades)
 * live in a completely separate endpoint from the main league fetch — a
 * per-season "communication group" that ESPN's own app polls for its
 * activity feed. It only exists for a season that's currently live;
 * once a season ends ESPN tears the group down (a 404 here just means
 * "no activity feed for this season anymore", not a real error).
 */
export async function fetchRecentActivity(
  season: number,
  auth: EspnAuth,
  limit = 50,
  // Optional: filled with how many messages of each ESPN message-type code
  // came back (known or not). Lets the sync report codes we don't map yet —
  // e.g. if this league's FAAB claims use a different code than ESPN's
  // regular waiver add, they show up here instead of vanishing silently.
  typesSeen?: Record<number, number>
): Promise<EspnTransaction[]> {
  const filter = {
    topics: {
      filterType: { value: ["ACTIVITY_TRANSACTIONS"] },
      limit,
      limitPerMessageSet: { value: limit },
      offset: 0,
      sortMessageDate: { sortPriority: 1, sortAsc: false },
      sortTopicDate: { sortPriority: 2, sortAsc: false },
      // No message-type filter on purpose: filtering to a fixed list of codes
      // dropped every FAAB (budget) claim in this league's first week, so the
      // News page showed zero moves. We take everything and only turn the
      // codes we recognise (ACTIVITY_MESSAGE_TYPE) into transactions.
    },
  };

  const res = await fetch(
    `${BASE}/seasons/${season}/segments/0/leagues/${auth.leagueId}/communication/?view=kona_league_communication`,
    {
      headers: {
        Cookie: `espn_s2=${auth.espnS2}; SWID=${auth.swid}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/json",
        "x-fantasy-filter": JSON.stringify(filter),
      },
      cache: "no-store",
    }
  );

  // 404 = this season's activity feed no longer exists (season is over)
  // — not an error, just nothing to report.
  if (res.status === 404) return [];
  if (!res.ok) return [];

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return [];

  const json = await res.json();
  const topics: EspnActivityTopic[] = json?.topics ?? [];

  const transactions: EspnTransaction[] = [];
  for (const topic of topics) {
    if (topic.type !== "ACTIVITY_TRANSACTIONS" || !topic.messages) continue;

    if (typesSeen) {
      for (const m of topic.messages) {
        if (m.type != null) typesSeen[m.type] = (typesSeen[m.type] ?? 0) + 1;
      }
    }

    const items = topic.messages
      .map((m) => {
        const kind = m.type != null ? ACTIVITY_MESSAGE_TYPE[m.type] : undefined;
        if (!kind || m.targetId == null) return null;
        return {
          playerId: m.targetId,
          type: kind,
          fromTeamId: m.from || undefined,
          toTeamId: m.to || undefined,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (items.length === 0) continue;

    const isTrade = items.some((i) => i.type === "TRADE");
    transactions.push({
      id: topic.id ?? `${season}-${topic.date}`,
      type: isTrade ? "TRADE_ACCEPT" : items[0].type === "ADD" ? "WAIVER" : "ROSTER",
      status: "EXECUTED",
      processDate: topic.date,
      teamId: items[0].toTeamId ?? items[0].fromTeamId,
      items,
    });
  }

  return transactions;
}

interface EspnTxItem {
  playerId: number;
  type: string;
  fromTeamId?: number;
  toTeamId?: number;
}

interface EspnTxRow {
  id: string;
  type: string;
  status: string;
  teamId?: number;
  proposedDate?: number;
  processDate?: number;
  items?: EspnTxItem[];
}

/**
 * Second source for roster moves, used when the activity feed above comes
 * back empty (it did for this league's first week of FAAB claims, even
 * though adds had clearly happened). ESPN's `mTransactions2` view only
 * returns rows when asked for a specific scoring period, so this walks back
 * through the most recent ones. Executed moves only. `debug` records what
 * each call returned so a sync response shows exactly where data is missing.
 */
export async function fetchTransactionsByPeriod(
  season: number,
  auth: EspnAuth,
  latestScoringPeriod: number,
  periodsBack = 21,
  debug?: Record<string, unknown>
): Promise<EspnTransaction[]> {
  const periods: number[] = [];
  for (let p = latestScoringPeriod; p >= Math.max(1, latestScoringPeriod - periodsBack); p--) {
    periods.push(p);
  }

  const statuses: Record<string, number> = {};
  const rows = await Promise.all(
    periods.map(async (p) => {
      try {
        const res = await fetch(
          `${BASE}/seasons/${season}/segments/0/leagues/${auth.leagueId}?view=mTransactions2&scoringPeriodId=${p}`,
          {
            headers: {
              Cookie: `espn_s2=${auth.espnS2}; SWID=${auth.swid}`,
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );
        statuses[String(res.status)] = (statuses[String(res.status)] ?? 0) + 1;
        if (!res.ok) return [] as EspnTxRow[];
        const json = await res.json();
        return (json?.transactions ?? []) as EspnTxRow[];
      } catch {
        statuses.error = (statuses.error ?? 0) + 1;
        return [] as EspnTxRow[];
      }
    })
  );

  const seen = new Map<string, EspnTransaction>();
  const typesSeen: Record<string, number> = {};
  for (const row of rows.flat()) {
    typesSeen[`${row.type}/${row.status}`] = (typesSeen[`${row.type}/${row.status}`] ?? 0) + 1;
    if (!row.id || row.status !== "EXECUTED" || !row.items?.length) continue;
    if (seen.has(row.id)) continue;
    seen.set(row.id, {
      id: row.id,
      type: row.type,
      status: row.status,
      teamId: row.teamId,
      processDate: row.processDate ?? row.proposedDate,
      items: row.items.map((i) => ({
        playerId: i.playerId,
        type: i.type,
        fromTeamId: i.fromTeamId || undefined,
        toTeamId: i.toTeamId || undefined,
      })),
    });
  }

  if (debug) {
    debug.periodsTried = periods.length;
    debug.httpStatuses = statuses;
    debug.rowTypes = typesSeen;
    debug.executedKept = seen.size;
  }
  return Array.from(seen.values());
}
