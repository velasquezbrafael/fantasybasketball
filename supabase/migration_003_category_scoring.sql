-- Run this once in the Supabase SQL editor.
-- Adds: category win/loss scoring (this is a 9-cat league, not points),
-- playoff-week tagging, and ESPN's own final-rank field.

alter table teams add column if not exists final_rank int;

alter table matchups add column if not exists playoff_tier_type text;
alter table matchups add column if not exists home_cat_wins int;
alter table matchups add column if not exists home_cat_losses int;
alter table matchups add column if not exists home_cat_ties int;
alter table matchups add column if not exists away_cat_wins int;
alter table matchups add column if not exists away_cat_losses int;
alter table matchups add column if not exists away_cat_ties int;

-- Existing synced rows won't have these values yet — trigger a fresh
-- sync (POST /api/sync) after running this to backfill them.
