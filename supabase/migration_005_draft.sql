-- Auction draft results, synced from ESPN's mDraftDetail view.
create table if not exists draft_picks (
  id bigint generated always as identity primary key,
  season_id bigint not null references seasons(id) on delete cascade,
  overall_pick integer not null,
  round integer,
  espn_team_id integer not null,
  nominating_team_id integer,
  player_id integer not null,
  player_name text not null,
  bid_amount integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (season_id, overall_pick)
);

alter table draft_picks enable row level security;

drop policy if exists "Public read draft_picks" on draft_picks;
create policy "Public read draft_picks" on draft_picks
  for select using (true);

create index if not exists draft_picks_season_team_idx
  on draft_picks (season_id, espn_team_id);
