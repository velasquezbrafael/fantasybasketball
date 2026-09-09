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

export async function getLatestPowerRankings(seasonId: number) {
  const supabase = getSupabaseServiceClient();
  const { data: latest } = await supabase
    .from("standings_snapshots")
    .select("matchup_period_id")
    .eq("season_id", seasonId)
    .order("matchup_period_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return [];

  const { data } = await supabase
    .from("standings_snapshots")
    .select("*")
    .eq("season_id", seasonId)
    .eq("matchup_period_id", latest.matchup_period_id)
    .order("power_rank", { ascending: true });

  return data ?? [];
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
