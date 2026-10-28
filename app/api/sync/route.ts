import { NextRequest, NextResponse } from "next/server";
import { fetchEspnLeague, fetchRecentActivity, VIEWS, type EspnAuth } from "@/lib/espn/client";
import {
  computePowerRankings,
  normalizeMatchups,
  normalizeTeams,
} from "@/lib/espn/transform";
import { resolvePlayerNames } from "@/lib/espn/players";
import { getSupabaseServiceClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function syncSeason(
  season: number,
  { historical, auth }: { historical: boolean; auth: EspnAuth }
) {
  const supabase = getSupabaseServiceClient();

  // A season rollover (e.g. 2026 -> 2027) leaves the old season's
  // is_current flag stuck true otherwise — getCurrentSeason() still picks
  // the right one (highest id wins), but the History page would show
  // "current" on more than one season.
  if (!historical) {
    await supabase.from("seasons").update({ is_current: false }).neq("id", season);
  }

  const league = await fetchEspnLeague(
    season,
    [
      VIEWS.team,
      VIEWS.roster,
      VIEWS.matchup,
      VIEWS.matchupScore,
      VIEWS.settings,
      VIEWS.standings,
      VIEWS.transactions,
      VIEWS.draft,
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
  const powerRankingByTeam = new Map(powerRankings.map((r) => [r.espnTeamId, r]));
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
        // League-normalized 0..1 roster strength (injury-adjusted player
        // talent) — see computePowerRankings in lib/espn/transform.ts.
        roster_score: powerRankingByTeam.get(t.espnTeamId)?.rosterStrength ?? null,
        roster_size: t.rosterSize,
        injured_count: t.injuredCount,
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
        // Each already weighted, so they sum to power_score — lets the
        // UI show a literal breakdown of what's driving each team's rank.
        contribution_record: r.contributions.record,
        contribution_diff: r.contributions.diff,
        contribution_form: r.contributions.form,
        contribution_roster: r.contributions.roster,
        roster_strength: r.rosterStrength,
        injured_count: r.injuredCount,
      }))
    );
  }

  // Real transaction data doesn't come back from the main league fetch
  // (see the comment on VIEWS.transactions) — it lives in a separate
  // activity-feed endpoint that only exists for the currently-live
  // season, so this is a no-op (not an error) for historical seasons.
  const activityTypesSeen: Record<number, number> = {};
  const transactions = historical
    ? []
    : await fetchRecentActivity(season, auth, 100, activityTypesSeen);
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

  // Auction draft results. Tolerant by design: if the draft_picks table
  // hasn't been created yet (migration_005_draft.sql) we report it and
  // carry on instead of failing the whole sync.
  const picks = league.draftDetail?.picks ?? [];
  let draftPicks = 0;
  let draftNote: string | undefined;
  if (picks.length > 0) {
    const nameMap = await resolvePlayerNames(
      season,
      picks.map((p) => p.playerId),
      auth
    );
    const { error } = await supabase.from("draft_picks").upsert(
      picks.map((p) => ({
        season_id: season,
        overall_pick: p.overallPickNumber,
        round: p.roundId ?? null,
        espn_team_id: p.teamId,
        nominating_team_id: p.nominatingTeamId ?? null,
        player_id: p.playerId,
        player_name: nameMap.get(p.playerId) ?? `Player #${p.playerId}`,
        bid_amount: p.bidAmount ?? 0,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "season_id,overall_pick" }
    );
    if (error) draftNote = `draft_picks not saved: ${error.message}`;
    else draftPicks = picks.length;
  }

  return {
    season,
    teams: teams.length,
    matchups: matchups.length,
    transactions: transactions.length,
    draftPicks,
    // ESPN activity message-type codes seen this sync (code -> count). If
    // League News is empty but this isn't, one of these is the missing code.
    activityTypesSeen,
    ...(draftNote ? { draftNote } : {}),
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

  // Trim both sides: a trailing space or newline pasted into the Vercel
  // env var (or the curl) is the most common reason a "matching" secret fails.
  const expected = process.env.SYNC_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "unauthorized", reason: "SYNC_SECRET is empty or missing on the server (check Vercel env vars, then redeploy)" },
      { status: 401 }
    );
  }
  if (secret?.trim() !== expected) {
    return NextResponse.json(
      { error: "unauthorized", reason: secret ? "secret does not match SYNC_SECRET" : "no secret was sent" },
      { status: 401 }
    );
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
