import type { EspnAuth } from "./client";

const BASE = "https://fantasy.espn.com/apis/v3/games/fba";

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
        "User-Agent": "Mozilla/5.0 (compatible; FantasyHoopsTracker/1.0)",
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
