import { getSupabaseServiceClient } from "@/lib/supabase/client";

// Server-side reads use the service client so pages work even before
// you've wired up the public anon key — swap to getSupabaseBrowserClient
// in a client component if you build interactive filters later.

export async function getCurrentSeason() {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_current", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getAllSeasons() {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .order("id", { ascending: false });
  return data ?? [];
}

export async function getTeams(seasonId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .eq("season_id", seasonId)
    .order("win_pct", { ascending: false });
  return data ?? [];
}

export async function getMatchups(seasonId: number, matchupPeriodId?: number) {
  const supabase = getSupabaseServiceClient();
  let query = supabase.from("matchups").select("*").eq("season_id", seasonId);
  if (matchupPeriodId) query = query.eq("matchup_period_id", matchupPeriodId);
  const { data } = await query.order("matchup_period_id", { ascending: true });
  return data ?? [];
}

/**
 * The current power rankings, each row carrying `previousRank` for a
 * trend arrow. Deliberately NOT "the most recent matchup_period_id" —
 * the daily cron can insert several snapshots within the same period, so
 * that would return duplicate rows per team. Instead this pulls a window
 * of recent snapshots and takes, per team, the newest row as "current"
 * and the next-newest as "previous" (whatever period each happened to be).
 */
export async function getLatestPowerRankings(seasonId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("standings_snapshots")
    .select("*")
    .eq("season_id", seasonId)
    .order("captured_at", { ascending: false })
    .limit(500);

  const rows = data ?? [];
  const byTeam = new Map<number, typeof rows>();
  for (const row of rows) {
    const arr = byTeam.get(row.espn_team_id) ?? [];
    arr.push(row);
    byTeam.set(row.espn_team_id, arr);
  }

  return Array.from(byTeam.values())
    .map((teamRows) => ({
      ...teamRows[0],
      previous_power_rank: teamRows[1]?.power_rank ?? null,
    }))
    .sort((a, b) => a.power_rank - b.power_rank);
}

export async function getLeagueAwards(seasonId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("league_awards")
    .select("*")
    .eq("season_id", seasonId)
    .order("id", { ascending: true });
  return data ?? [];
}

export async function getTransactions(seasonId: number, limit = 50) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("season_id", seasonId)
    .order("processed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Every synced season's row for one franchise (grouped by espn_team_id,
 * which ESPN keeps stable across seasons even through a rename) — the
 * source for a team's season-by-season history. Ordered newest first.
 */
export async function getTeamSeasons(espnTeamId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .eq("espn_team_id", espnTeamId)
    .order("season_id", { ascending: false });
  return data ?? [];
}

/**
 * Every team row across every synced season — the raw material for
 * all-time standings and for a name/logo lookup keyed by espn_team_id
 * (see lib/teamStats.ts). Ordered season_id desc so "first row per team"
 * is always that team's most recent name.
 */
export async function getAllTeamSeasonRows() {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("teams")
    .select("espn_team_id, name, abbrev, logo, wins, losses, ties, win_pct, final_rank, season_id")
    .order("season_id", { ascending: false });
  return data ?? [];
}

/**
 * Every decided matchup a team has ever been part of, across every
 * synced season — the source for a career head-to-head breakdown.
 */
export async function getTeamMatchups(espnTeamId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("matchups")
    .select("*")
    .or(`home_team_id.eq.${espnTeamId},away_team_id.eq.${espnTeamId}`)
    .order("season_id", { ascending: false });
  return data ?? [];
}

/**
 * A team's power-rank/power-score across every synced snapshot of one
 * season — the source for the trend sparkline on its team page.
 */
export async function getPowerRankTrend(seasonId: number, espnTeamId: number) {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("standings_snapshots")
    .select("matchup_period_id, power_rank, power_score, captured_at")
    .eq("season_id", seasonId)
    .eq("espn_team_id", espnTeamId)
    .order("captured_at", { ascending: true });
  return data ?? [];
}
