-- Run this once in the Supabase SQL editor.
-- Adds real player-driven power rankings: roster talent (preseason rank +
-- live ownership%, injury-adjusted) blended with record, category
-- differential, and recent form. See lib/espn/transform.ts
-- (computePowerRankings) for the algorithm and weights.

alter table teams add column if not exists roster_score numeric;
alter table teams add column if not exists roster_size int;
alter table teams add column if not exists injured_count int;

alter table standings_snapshots add column if not exists contribution_record numeric;
alter table standings_snapshots add column if not exists contribution_diff numeric;
alter table standings_snapshots add column if not exists contribution_form numeric;
alter table standings_snapshots add column if not exists contribution_roster numeric;
alter table standings_snapshots add column if not exists roster_strength numeric;
alter table standings_snapshots add column if not exists injured_count int;

-- Existing rows won't have these values yet — trigger a fresh sync
-- (POST /api/sync) after running this to backfill them.
