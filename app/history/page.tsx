import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAllSeasons, getTeams } from "@/lib/data";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const seasons = await getAllSeasons();

  if (seasons.length === 0) {
    return <EmptyState title="No seasons synced yet" />;
  }

  const seasonsWithTeams = await Promise.all(
    seasons.map(async (s) => ({
      season: s,
      teams: (await getTeams(s.id)).sort(
        (a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99) || b.win_pct - a.win_pct
      ),
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-4xl tracking-wide text-gradient">League History</h1>
          <Link href="/records" className="text-sm text-accent hover:underline shrink-0">
            All-time records →
          </Link>
        </div>
        <p className="text-muted text-sm mt-1">
          Every synced season, most recent first.
        </p>
      </div>

      {seasonsWithTeams.map(({ season, teams }) => (
        <section key={season.id} className="card card-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl tracking-wide">
              {season.id - 1}-{String(season.id).slice(2)}{" "}
              {season.is_current && <span className="text-accent text-sm ml-2 font-sans">current</span>}
            </h2>
            <span className="text-muted text-xs">{season.league_name}</span>
          </div>
          <ol className="text-sm space-y-1">
            {teams.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3 justify-between border-t border-border py-1.5">
                <Link href={`/teams/${t.espn_team_id}`} className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors">
                  <span className="text-muted w-5 shrink-0">{i + 1}.</span>
                  <TeamLogo logo={t.logo} name={t.name} size={22} />
                  {i === 0 && <span className="shrink-0">🏆</span>}
                  <span className="truncate">{t.name}</span>
                </Link>
                <span className="text-muted tabular-nums shrink-0">
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
