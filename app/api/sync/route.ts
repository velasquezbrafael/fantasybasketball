import { NextRequest, NextResponse } from "next/server";
import { fetchEspnLeague, VIEWS, type EspnAuth } from "@/lib/espn/client";
import {
  computePowerRankings,
  normalizeMatchups,
  normalizeTeams,
} from "@/lib/espn/transform";
import { resolvePlayerNames } from "@/lib/espn/players";
import { getSupabaseServiceClient } from "@/lib/supabase/client";
import type { EspnTransaction } from "@/lib/espn/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function syncSeason(
  season: number,
  { historical, auth }: { historical: boolean; auth: EspnAuth }
) {
  const supabase = getSupabaseServiceClient();

  const league = await fetchEspnLeague(
    season,
    [
      VIEWS.team,
      VIEWS.matchup,
      VIEWS.matchupScore,
      VIEWS.settings,
      VIEWS.standings,
      VIEWS.transactions,
    ],
    { historical, auth }
  );

  await supabase.from("seasons").upsert(
    {
      id: season,
      league_id: auth.leagueId,
      league_name: league.settings?.name ?? null,
      is_current: !historical,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const teams = normalizeTeams(league);
  const matchups = normalizeMatchups(league);
  const powerRankings = computePowerRankings(teams, matchups);
  const currentPeriod = league.status?.currentMatchupPeriod ?? 0;

  if (teams.length > 0) {
    await supabase.from("teams").upsert(
      teams.map((t) => ({
        season_id: season,
        espn_team_id: t.espnTeamId,
        name: t.name,
        abbrev: t.abbrev,
        logo: t.logo,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        win_pct: t.winPct,
        points_for: t.pointsFor,
        points_against: t.pointsAgainst,
        streak_type: t.streakType,
        streak_length: t.streakLength,
        playoff_seed: t.playoffSeed,
        final_rank: t.finalRank,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "season_id,espn_team_id" }
    );
  }

  if (matchups.length > 0) {
    await supabase.from("matchups").upsert(
      matchups.map((m) => ({
        season_id: season,
        espn_matchup_id: m.espnMatchupId,
        matchup_period_id: m.matchupPeriodId,
        home_team_id: m.homeTeamId,
        home_score: m.homeScore,
        away_team_id: m.awayTeamId,
        away_score: m.awayScore,
        winner: m.winner,
        playoff_tier_type: m.playoffTierType,
        home_cat_wins: m.homeCatWins,
        home_cat_losses: m.homeCatLosses,
        home_cat_ties: m.homeCatTies,
        away_cat_wins: m.awayCatWins,
        away_cat_losses: m.awayCatLosses,
        away_cat_ties: m.awayCatTies,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "season_id,espn_matchup_id" }
    );
  }

  if (powerRankings.length > 0 && !historical) {
    await supabase.from("standings_snapshots").insert(
      powerRankings.map((r) => ({
        season_id: season,
        matchup_period_id: currentPeriod,
        espn_team_id: r.espnTeamId,
        wins: r.wins,
        losses: r.losses,
        ties: r.ties,
        points_for: r.pointsFor,
        points_against: r.pointsAgainst,
        power_rank: r.rank,
        power_score: r.powerScore,
      }))
    );
  }

  const transactions: EspnTransaction[] = league.transactions ?? [];
  if (transactions.length > 0) {
    const allPlayerIds = transactions.flatMap(
      (t) => t.items?.map((i) => i.playerId) ?? []
    );
    const nameMap = await resolvePlayerNames(season, allPlayerIds, auth);

    await supabase.from("transactions").upsert(
      transactions.map((t) => ({
        season_id: season,
        espn_transaction_id: t.id,
        type: t.type,
        status: t.status,
        team_espn_id: t.teamId ?? null,
        processed_at: t.processDate
          ? new Date(t.processDate).toISOString()
          : null,
        items: (t.items ?? []).map((i) => ({
          ...i,
          playerName: nameMap.get(i.playerId) ?? `Player #${i.playerId}`,
        })),
      })),
      { onConflict: "season_id,espn_transaction_id" }
    );
  }

  return {
    season,
    teams: teams.length,
    matchups: matchups.length,
    transactions: transactions.length,
  };
}

export async function POST(req: NextRequest) {
  // Accept the secret from any of: Vercel Cron's auto-injected
  // `Authorization: Bearer <CRON_SECRET>` header, a custom header, or a
  // query param — so this works whether it's triggered by Vercel Cron
  // (set the CRON_SECRET env var and Vercel adds the header for you) or
  // by hand while testing.
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret =
    bearerSecret ??
    req.headers.get("x-sync-secret") ??
    req.nextUrl.searchParams.get("secret");

  if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
    return unauthorized();
  }

  const auth: EspnAuth = {
    leagueId: process.env.ESPN_LEAGUE_ID!,
    swid: process.env.ESPN_SWID!,
    espnS2: process.env.ESPN_S2!,
  };

  const currentSeason = Number(
    process.env.ESPN_CURRENT_SEASON ?? new Date().getFullYear()
  );
  const historicalSeasons = (process.env.ESPN_HISTORICAL_SEASONS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

  const fullSync = req.nextUrl.searchParams.get("full") === "true";

  try {
    const results = [await syncSeason(currentSeason, { historical: false, auth })];

    if (fullSync) {
      for (const season of historicalSeasons) {
        results.push(await syncSeason(season, { historical: true, auth }));
      }
    }

    return NextResponse.json({ ok: true, synced: results });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

// Allow triggering via GET too (Vercel Cron sends GET requests).
export async function GET(req: NextRequest) {
  return POST(req);
}
