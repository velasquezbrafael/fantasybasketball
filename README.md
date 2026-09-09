# Fantasy Hoops Tracker

A shared dashboard for your ESPN Fantasy Basketball league — standings, matchups,
power rankings (a smarter blend than ESPN's raw record), a trade/waiver feed, and
a season-over-season history archive. Everyone in the league gets a read-only link;
only you hold the ESPN login credentials that pull the data.

Stack: Next.js (App Router) → Vercel, Supabase (Postgres) for storage, a scheduled
sync job pulling from ESPN's private Fantasy API.

## How it works

ESPN doesn't publish an official public API for fantasy basketball. This app uses
the same private endpoints the ESPN.com website itself calls, authenticated with
two cookies from your own logged-in browser session (`SWID` and `espn_s2`). A
`/api/sync` route hits those endpoints, normalizes the data, and writes it into
Supabase. Every page just reads from Supabase — so the site stays fast and ESPN
never sees your league's visitors, only your own server making the sync calls.

## 1. Get your ESPN credentials

1. Log into your league at [fantasy.espn.com](https://fantasy.espn.com) in Chrome.
2. Open DevTools → **Application** tab → **Cookies** → `https://fantasy.espn.com`.
3. Copy the values of `SWID` (looks like `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`,
   including the curly braces) and `espn_s2` (a long string).
4. Grab your league ID from the URL when viewing your league, e.g.
   `.../league?leagueId=123456` → `123456`.

These cookies are tied to your ESPN login. Anyone with them could read (not modify)
your league's data via the API, so treat them like a password — only put them in
environment variables, never commit them to the repo.

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run everything in `supabase/schema.sql`.
3. From **Settings → API**, grab the Project URL, the `anon` public key, and the
   `service_role` secret key.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ESPN_LEAGUE_ID`, `ESPN_SWID`, `ESPN_S2`
- `ESPN_CURRENT_SEASON` (e.g. `2026`)
- `ESPN_HISTORICAL_SEASONS` (optional, e.g. `2023,2024,2025` — only needed once
  to backfill the History page)
- `SYNC_SECRET` — invent any random string; it's the password the sync endpoint
  requires so randoms can't trigger it

## 4. Run it locally

```bash
npm install
npm run dev
```

Then trigger a first sync in another terminal:

```bash
curl -X POST "http://localhost:3000/api/sync?secret=YOUR_SYNC_SECRET"

# to also backfill historical seasons listed in ESPN_HISTORICAL_SEASONS:
curl -X POST "http://localhost:3000/api/sync?secret=YOUR_SYNC_SECRET&full=true"
```

Refresh `http://localhost:3000` — you should see your league.

## 5. Deploy

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add all the same environment variables from step 3 in the Vercel project
   settings (Production + Preview).
4. Additionally set `CRON_SECRET` in Vercel to the **exact same value** as your
   `SYNC_SECRET`. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`
   when it fires the scheduled job defined in `vercel.json`, and the sync route
   checks that against `SYNC_SECRET` — so the two must match.
5. Deploy. `vercel.json` schedules `/api/sync` every 6 hours automatically
   (adjust the cron expression there if you want it more/less frequent — ESPN
   doesn't need much more than a few times a day except on trade-deadline day).
6. Share the deployed URL with your league. It's read-only for everyone but you.

## Pages

- `/` — dashboard: current standings snapshot, this week's matchups, recent moves
- `/standings` — full sortable standings table
- `/matchups` — every matchup, grouped by week
- `/power-rankings` — power score = 30% record + 15% differential + 15% recent
  form + 40% injury-adjusted roster talent, recalculated on every sync
- `/weekly-winners` — every week's best category record, plus a season leaderboard
- `/pot` — live payout standings, weekly winners, and league awards
- `/league-news` — trades/waiver moves as headlines, plus real NBA news for
  anyone's rostered players (fetched live from ESPN's public site API)
- `/history` — final standings for every season you've synced

## Notes & limits

- **Private league** (this setup): your cookies authenticate every request, so
  the whole league sees data through your account without needing their own
  ESPN login.
- If ESPN rotates your session (rare, but happens if you log out elsewhere),
  `/api/sync` will start failing with a 401/403 from ESPN — just grab fresh
  cookies and update the env vars.
- Player-name resolution for transactions makes one extra ESPN call per sync;
  if that call fails for any reason, moves still show with a `Player #12345`
  fallback rather than breaking the page.
- This is unofficial — it uses ESPN's own private website API, not a published
  public API, so ESPN could change the response shape without notice. If a
  sync starts erroring after ESPN ships a site update, check
  `lib/espn/types.ts` and `lib/espn/transform.ts` against the new payload shape.
