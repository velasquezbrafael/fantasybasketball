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
  final_rank int,                  -- ESPN's own final placement after playoffs; null until decided
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
  playoff_tier_type text,          -- null = regular season; WINNERS_BRACKET | LOSERS_CONSOLATION_LADDER | WINNERS_CONSOLATION_LADDER
  home_cat_wins int,                -- category (H2H Each Category) record for the week, e.g. 6-3-0
  home_cat_losses int,
  home_cat_ties int,
  away_cat_wins int,
  away_cat_losses int,
  away_cat_ties int,
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

create table if not exists league_awards (
  id bigserial primary key,
  season_id bigint references seasons(id) on delete cascade,
  category text not null,          -- e.g. "Best draft pick"
  detail text,                     -- e.g. "(player rating x # pick)"
  amount numeric,                  -- null for non-cash awards
  winner_team_espn_id int,         -- null until decided
  winner_note text,                -- free text, e.g. player name or manager name
  updated_at timestamptz default now(),
  unique (season_id, category)
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

alter table league_awards enable row level security;
create policy "public read league_awards" on league_awards for select using (true);
