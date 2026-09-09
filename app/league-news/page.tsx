import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getTeams, getTransactions } from "@/lib/data";
import { buildLeagueHeadlines, fetchRosterRelevantNbaNews, type NewsItem } from "@/lib/espn/news";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="card card-hover p-4 flex gap-4">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="hidden sm:block w-28 h-20 rounded-lg object-cover shrink-0 bg-surface-2 border border-border"
        />
      ) : (
        <div className="hidden sm:flex w-28 h-20 rounded-lg shrink-0 bg-surface-2 border border-border items-center justify-center">
          <TeamLogo logo={item.teamLogo} name={item.teamName ?? "League"} size={36} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              item.kind === "league"
                ? "bg-accent/15 text-accent"
                : "bg-accent-2/15 text-accent-2"
            }`}
          >
            {item.kind === "league" ? "League Move" : "NBA News"}
          </span>
          <span className="text-muted text-xs">{timeAgo(item.publishedAt)}</span>
        </div>
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium leading-snug hover:text-accent transition-colors"
          >
            {item.headline}
          </a>
        ) : (
          <p className="font-medium leading-snug flex items-center gap-2">
            <TeamLogo logo={item.teamLogo} name={item.teamName ?? "League"} size={20} />
            {item.headline}
          </p>
        )}
        {item.detail && <p className="text-muted text-sm mt-1 leading-snug">{item.detail}</p>}
        {item.teamName && item.kind === "nba" && (
          <p className="text-accent-2 text-xs mt-1.5">{item.teamName}</p>
        )}
      </div>
    </div>
  );
}

export default async function LeagueNewsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, transactions] = await Promise.all([
    getTeams(season.id),
    getTransactions(season.id, 100),
  ]);

  const leagueHeadlines = buildLeagueHeadlines(transactions, teams);

  let nbaHeadlines: NewsItem[] = [];
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const swid = process.env.ESPN_SWID;
  const espnS2 = process.env.ESPN_S2;
  if (leagueId && swid && espnS2) {
    nbaHeadlines = await fetchRosterRelevantNbaNews(
      season.id,
      { leagueId, swid, espnS2 },
      teams
    );
  }

  const feed = [...leagueHeadlines, ...nbaHeadlines].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">League News</h1>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          Every trade and waiver move in the league, plus real NBA headlines about players
          someone here has rostered.
        </p>
      </div>

      <div className="space-y-3">
        {feed.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
        {feed.length === 0 && (
          <EmptyState
            title="No news yet"
            detail="Trades, waiver moves, and NBA headlines about your rostered players will show up here."
          />
        )}
      </div>
    </div>
  );
}
