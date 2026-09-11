import type { EspnAuth } from "./client";

const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba";

/**
 * ESPN's transaction payloads only include numeric playerIds. To show
 * real names we have to hit the player-info endpoint separately with an
 * `x-fantasy-filter` header scoped to the IDs we care about (fetching
 * the full player universe is a multi-MB response).
 */
export async function resolvePlayerNames(
  season: number,
  playerIds: number[],
  auth: EspnAuth
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (playerIds.length === 0) return names;

  const uniqueIds = Array.from(new Set(playerIds));

  const res = await fetch(
    `${BASE}/seasons/${season}/segments/0/leagues/${auth.leagueId}?view=kona_player_info`,
    {
      headers: {
        Cookie: `espn_s2=${auth.espnS2}; SWID=${auth.swid}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "x-fantasy-filter": JSON.stringify({
          players: { filterIds: { value: uniqueIds } },
        }),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    // Non-fatal: transactions still render with "Player #id" fallback.
    return names;
  }

  const json = await res.json();
  const players: Array<{ id: number; player?: { fullName?: string } }> =
    json?.players ?? [];

  for (const p of players) {
    if (p.player?.fullName) {
      names.set(p.id, p.player.fullName);
    }
  }

  return names;
}

export interface TopPlayer {
  playerId: number;
  fullName: string;
  rank: number | null;
  ownedByEspnTeamId: number | null; // null = free agent
}

// ESPN's `defaultPositionId` for basketball is 1-indexed (confirmed
// against a live league) — NOT the same as `lineupSlotId` (0-indexed)
// used elsewhere for roster starters/bench.
const POSITION_LABELS: Record<number, string> = {
  1: "PG",
  2: "SG",
  3: "SF",
  4: "PF",
  5: "C",
};

/**
 * Top N players at each starting position (PG/SG/SF/PF/C) by ESPN's own
 * draft rank, plus who owns each one right now. Uses the same
 * `kona_player_info` view ESPN's own app uses for player search, asking
 * it to sort by rank server-side (`sortDraftRanks`) so we don't have to
 * page through the whole player universe — `fetchLimit` just needs to be
 * generous enough that every position fills up before the ranked list
 * runs out.
 *
 * Each player entry's `onTeamId` is 0 for a free agent, otherwise the
 * owning team's espn_team_id directly — no separate roster cross-
 * reference needed.
 */
export async function fetchTopPlayersByPosition(
  season: number,
  auth: EspnAuth,
  perPosition = 3,
  fetchLimit = 200
): Promise<Record<string, TopPlayer[]>> {
  const result: Record<string, TopPlayer[]> = {};
  for (const label of Object.values(POSITION_LABELS)) result[label] = [];

  const filter = {
    players: {
      limit: fetchLimit,
      sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "STANDARD" },
    },
  };

  const res = await fetch(
    `${BASE}/seasons/${season}/segments/0/leagues/${auth.leagueId}?view=kona_player_info`,
    {
      headers: {
        Cookie: `espn_s2=${auth.espnS2}; SWID=${auth.swid}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "x-fantasy-filter": JSON.stringify(filter),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return result;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return result;

  const json = await res.json();
  const players: Array<{
    id: number;
    onTeamId?: number;
    player?: {
      fullName?: string;
      defaultPositionId?: number;
      draftRanksByRankType?: { STANDARD?: { rank?: number } };
    };
  }> = json?.players ?? [];

  for (const entry of players) {
    const positionId = entry.player?.defaultPositionId;
    const label = positionId != null ? POSITION_LABELS[positionId] : undefined;
    if (!label) continue;
    if (result[label].length >= perPosition) continue;

    result[label].push({
      playerId: entry.id,
      fullName: entry.player?.fullName ?? `Player #${entry.id}`,
      rank: entry.player?.draftRanksByRankType?.STANDARD?.rank ?? null,
      ownedByEspnTeamId: entry.onTeamId && entry.onTeamId > 0 ? entry.onTeamId : null,
    });
  }

  return result;
}
