import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAllSeasons, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const seasons = await getAllSeasons();

  if (seasons.length === 0) {
    return <EmptyState title="No seasons synced yet" />;
  }

  const seasonsWithTeams = await Promise.all(
    seasons.map(async (s) => ({
      season: s,
      teams: (await getTeams(s.id)).sort((a, b) => b.win_pct - a.win_pct),
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">League History</h1>
        <p className="text-muted text-sm mt-1">
          Add past seasons via <code className="text-foreground">ESPN_HISTORICAL_SEASONS</code>{" "}
          and run a full sync — see README.md.
        </p>
      </div>

      {seasonsWithTeams.map(({ season, teams }) => (
        <section key={season.id} className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              {season.id} {season.is_current && <span className="text-accent text-sm ml-2">current</span>}
            </h2>
            <span className="text-muted text-xs">{season.league_name}</span>
          </div>
          <ol className="text-sm space-y-1">
            {teams.map((t, i) => (
              <li key={t.id} className="flex items-center justify-between border-t border-border py-1.5">
                <span>
                  <span className="text-muted w-6 inline-block">{i + 1}.</span>
                  {i === 0 && "🏆 "}
                  {t.name}
                </span>
                <span className="text-muted tabular-nums">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""}
                </span>
              </li>
            ))}
          </ol>
          {teams.length === 0 && <p className="text-muted text-sm">No data for this season yet.</p>}
        </section>
      ))}
    </div>
  );
}
