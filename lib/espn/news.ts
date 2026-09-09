import { fetchEspnLeague, VIEWS, type EspnAuth } from "./client";
import type { EspnTransaction } from "./types";

export interface NewsItem {
  id: string;
  kind: "league" | "nba";
  headline: string;
  detail?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  publishedAt: string; // ISO
  teamName?: string | null;
  teamLogo?: string | null;
}

const TRANSACTION_TYPE_VERB: Record<string, string> = {
  WAIVER: "claimed",
  FREEAGENT: "signed",
  ROSTER: "moved",
};

/**
 * Turns raw transaction rows (already stored in Supabase, player names
 * already resolved by the sync job) into news-style headlines instead of
 * a flat "type — player" list. Trades get a two-team headline; waiver/FA
 * moves read as "{team} adds {player}" (plus "(dropped {player})" when a
 * drop rode along in the same transaction, which ESPN does for a
 * straight swap).
 */
export function buildLeagueHeadlines(
  transactions: Array<{
    id: number;
    type: string;
    team_espn_id: number | null;
    processed_at: string | null;
    items: Array<{
      playerId: number;
      playerName?: string;
      type?: string;
      fromTeamId?: number;
      toTeamId?: number;
    }> | null;
  }>,
  teams: Array<{ espn_team_id: number; name: string; logo: string | null }>
): NewsItem[] {
  const teamById = new Map(teams.map((t) => [t.espn_team_id, t]));
  const teamLabel = (id: number | null | undefined) =>
    id != null ? teamById.get(id)?.name ?? `Team ${id}` : null;

  const news: NewsItem[] = [];

  for (const t of transactions) {
    const items = t.items ?? [];
    const isTrade = t.type === "TRADE_ACCEPT" || t.type === "TRADE_ACCEPTED";
    const team = teamById.get(t.team_espn_id ?? -1);

    if (isTrade) {
      const byTeam = new Map<number, string[]>();
      for (const item of items) {
        const dest = item.toTeamId;
        if (dest == null) continue;
        const arr = byTeam.get(dest) ?? [];
        arr.push(item.playerName ?? `Player #${item.playerId}`);
        byTeam.set(dest, arr);
      }
      const sides = Array.from(byTeam.entries());
      if (sides.length >= 2) {
        const [aId, aPlayers] = sides[0];
        const [bId, bPlayers] = sides[1];
        news.push({
          id: `txn-${t.id}`,
          kind: "league",
          headline: `${teamLabel(aId)} and ${teamLabel(bId)} swing a trade`,
          detail: `${teamLabel(aId)} gets ${aPlayers.join(", ")} · ${teamLabel(bId)} gets ${bPlayers.join(", ")}`,
          publishedAt: t.processed_at ?? new Date().toISOString(),
          teamName: teamLabel(aId),
          teamLogo: teamById.get(aId)?.logo ?? null,
        });
        continue;
      }
    }

    const adds = items.filter((i) => i.type === "ADD" || i.type === "WAIVER_ADD");
    const drops = items.filter((i) => i.type === "DROP");

    if (adds.length === 0 && drops.length === 0) continue;

    const verb = TRANSACTION_TYPE_VERB[t.type] ?? "added";
    const addNames = adds.map((i) => i.playerName ?? `Player #${i.playerId}`);
    const dropNames = drops.map((i) => i.playerName ?? `Player #${i.playerId}`);

    let headline: string;
    if (addNames.length > 0 && dropNames.length > 0) {
      headline = `${teamLabel(t.team_espn_id) ?? "A team"} ${verb} ${addNames.join(", ")}, dropped ${dropNames.join(", ")}`;
    } else if (addNames.length > 0) {
      headline = `${teamLabel(t.team_espn_id) ?? "A team"} ${verb} ${addNames.join(", ")}`;
    } else {
      headline = `${teamLabel(t.team_espn_id) ?? "A team"} dropped ${dropNames.join(", ")}`;
    }

    news.push({
      id: `txn-${t.id}`,
      kind: "league",
      headline,
      detail: null,
      publishedAt: t.processed_at ?? new Date().toISOString(),
      teamName: team?.name ?? null,
      teamLogo: team?.logo ?? null,
    });
  }

  return news;
}

interface EspnArticle {
  headline?: string;
  description?: string;
  published?: string;
  images?: Array<{ url?: string }>;
  links?: { web?: { href?: string } };
}

/**
 * Fetches this season's full rosters directly from ESPN (not from
 * Supabase — we don't persist individual player lists) so we know which
 * real NBA players belong to someone in this league.
 */
async function fetchRosteredPlayerNames(season: number, auth: EspnAuth): Promise<Map<string, number>> {
  const league = await fetchEspnLeague(season, [VIEWS.team, VIEWS.roster], { auth });
  const nameToTeam = new Map<string, number>();
  for (const t of league.teams ?? []) {
    for (const entry of t.roster?.entries ?? []) {
      const name = entry.playerPoolEntry?.player?.fullName;
      if (name) nameToTeam.set(name, t.id);
    }
  }
  return nameToTeam;
}

/**
 * Real NBA news (ESPN's public site API, not the fantasy API) filtered
 * down to articles that mention a player someone in this league has
 * rostered. Best-effort: ESPN's site API is a different host with its
 * own bot protections, so any failure here just means an empty list —
 * the league-moves headlines still render fine on their own.
 */
export async function fetchRosterRelevantNbaNews(
  season: number,
  auth: EspnAuth,
  teams: Array<{ espn_team_id: number; name: string; logo: string | null }>
): Promise<NewsItem[]> {
  try {
    const rosteredNames = await fetchRosteredPlayerNames(season, auth);
    if (rosteredNames.size === 0) return [];

    const teamNameById = new Map(teams.map((t) => [t.espn_team_id, t]));

    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        // Real-world news, not our own league data — a short cache is fine
        // and saves hitting ESPN on every page view.
        next: { revalidate: 900 },
      }
    );
    if (!res.ok) return [];
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return [];

    const json = await res.json();
    const articles: EspnArticle[] = json?.articles ?? [];

    const items: NewsItem[] = [];
    for (const a of articles) {
      const haystack = `${a.headline ?? ""} ${a.description ?? ""}`;
      let matchedPlayer: string | null = null;
      let matchedTeamId: number | null = null;
      for (const [name, teamId] of rosteredNames) {
        if (name.length > 3 && haystack.includes(name)) {
          matchedPlayer = name;
          matchedTeamId = teamId;
          break;
        }
      }
      if (!matchedPlayer || !a.headline) continue;

      const team = matchedTeamId != null ? teamNameById.get(matchedTeamId) : null;
      items.push({
        id: `nba-${a.headline}-${a.published ?? ""}`,
        kind: "nba",
        headline: a.headline,
        detail: a.description ?? null,
        link: a.links?.web?.href ?? null,
        imageUrl: a.images?.[0]?.url ?? null,
        publishedAt: a.published ?? new Date().toISOString(),
        teamName: team ? `Rostered by ${team}` : null,
        teamLogo: team?.logo ?? null,
      });
    }

    return items.slice(0, 20);
  } catch {
    // ESPN's site API is unofficial and occasionally blocks non-browser
    // traffic outright — fail open rather than break the page.
    return [];
  }
}

export type { EspnTransaction };
