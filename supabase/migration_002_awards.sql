-- Run this once in the Supabase SQL editor to add league awards support
-- (the voted/subjective end-of-season awards from your league rules).

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

alter table league_awards enable row level security;
create policy "public read league_awards" on league_awards for select using (true);

-- Seed this season's award categories (edit the season id if needed).
-- Re-run is safe — ON CONFLICT just leaves existing rows alone.
insert into league_awards (season_id, category, detail, amount)
select 2026, category, detail, amount
from (values
  ('Best draft pick', '(player rating x # pick)', 5),
  ('Best waiver wire pickup', '(player rating)', 5),
  ('Best regular season record', null, 10),
  ('Worst draft pick', 'voting', null),
  ('Most improved league manager', 'voting', null)
) as v(category, detail, amount)
on conflict (season_id, category) do nothing;
