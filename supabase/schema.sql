-- Fantasy Hoops Tracker schema
-- Run this once in the Supabase SQL editor for a new project.

create table if not exists seasons (
  id bigint primary key,          -- e.g. 2026
  league_id text not null,
  league_name text,
  is_current boolean default false,
  synced_at timestamptz
);

create table if not exists teams (
  id bigserial primary key,
  season_id bigint references seasons(id) on delete cascade,
  espn_team_id int not null,
  name text not null,
  abbrev text,
  logo text,
  wins int default 0,
  losses int default 0,
  ties int default 0,
  win_pct numeric default 0,
  points_for numeric default 0,
  points_against numeric default 0,
  streak_type text,
  streak_length int default 0,
  playoff_seed int,
  updated_at timestamptz default now(),
  unique (season_id, espn_team_id)
);

create table if not exists matchups (
  id bigserial primary key,
  season_id bigint references seasons(id) on delete cascade,
  espn_matchup_id int not null,
  matchup_period_id int not null,
  home_team_id int not null,       -- espn_team_id
  home_score numeric,
  away_team_id int,                -- espn_team_id, null on a bye
  away_score numeric,
  winner text,                     -- HOME | AWAY | TIE | UNDECIDED
  updated_at timestamptz default now(),
  unique (season_id, espn_matchup_id)
);

create table if not exists standings_snapshots (
  id bigserial primary key,
  season_id bigint references seasons(id) on delete cascade,
  matchup_period_id int not null,
  espn_team_id int not null,
  wins int,
  losses int,
  ties int,
  points_for numeric,
  points_against numeric,
  power_rank int,
  power_score numeric,
  captured_at timestamptz default now()
);

create table if not exists transactions (
  id bigserial primary key,
  season_id bigint references seasons(id) on delete cascade,
  espn_transaction_id text not null,
  type text,                       -- WAIVER | FREEAGENT | TRADE_ACCEPT | ...
  status text,
  team_espn_id int,
  processed_at timestamptz,
  items jsonb,                     -- [{playerId, playerName, type, fromTeamId, toTeamId}]
  created_at timestamptz default now(),
  unique (season_id, espn_transaction_id)
);

create index if not exists idx_teams_season on teams(season_id);
create index if not exists idx_matchups_season on matchups(season_id);
create index if not exists idx_standings_season on standings_snapshots(season_id);
create index if not exists idx_transactions_season on transactions(season_id);

-- Read-only access for the whole league via the anon key.
-- Writes only happen server-side with the service-role key from the
-- /api/sync route, so RLS just needs to allow SELECT to anon/authenticated.
alter table seasons enable row level security;
alter table teams enable row level security;
alter table matchups enable row level security;
alter table standings_snapshots enable row level security;
alter table transactions enable row level security;

create policy "public read seasons" on seasons for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read matchups" on matchups for select using (true);
create policy "public read standings_snapshots" on standings_snapshots for select using (true);
create policy "public read transactions" on transactions for select using (true);
