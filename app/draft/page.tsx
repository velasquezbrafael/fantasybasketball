import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getDraftPicks, getTeams } from "@/lib/data";
import { leagueSettings } from "@/lib/leagueConfig";
import EmptyState from "@/components/EmptyState";
import TeamLogo from "@/components/TeamLogo";

export const metadata: Metadata = { title: "Draft Recap" };

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="Check back once this league's data has synced." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [picks, teams] = await Promise.all([getDraftPicks(season.id), getTeams(season.id)]);

  if (picks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-4xl tracking-wide text-gradient">Draft Recap</h1>
        <EmptyState
          title="No draft results yet"
          detail="Auction results show up here after the next sync once the draft is done."
        />
      </div>
    );
  }

  const cap = leagueSettings.draft.cap;
  const teamById = new Map(teams.map((t) => [t.espn_team_id, t]));
  const nameOf = (id: number | null) => (id != null ? teamById.get(id)?.name ?? `Team ${id}` : "—");

  const totalSpent = picks.reduce((s, p) => s + p.bid_amount, 0);
  const avg = totalSpent / picks.length;
  const topBids = [...picks]
    .sort((a, b) => b.bid_amount - a.bid_amount || a.overall_pick - b.overall_pick)
    .slice(0, 15);
  const dollarOnes = picks.filter((p) => p.bid_amount <= 1).length;

  const perTeam = teams
    .map((t) => {
      const mine = picks.filter((p) => p.espn_team_id === t.espn_team_id);
      const spent = mine.reduce((s, p) => s + p.bid_amount, 0);
      const best = [...mine].sort((a, b) => b.bid_amount - a.bid_amount)[0];
      return { team: t, mine, spent, left: cap - spent, best };
    })
    .sort((a, b) => b.spent - a.spent || a.team.name.localeCompare(b.team.name));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-gradient">Draft Recap</h1>
        <p className="text-muted text-sm mt-1">
          {leagueSettings.draft.type} · ${cap} cap per team · {picks.length} players drafted
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="stat-chip">
          Total spent <strong>${totalSpent.toLocaleString()}</strong>
        </span>
        <span className="stat-chip">
          Average price <strong>${avg.toFixed(1)}</strong>
        </span>
        <span className="stat-chip">
          Top bid{" "}
          <strong>
            {topBids[0].player_name} ${topBids[0].bid_amount}
          </strong>
        </span>
        <span className="stat-chip">
          $1 players <strong>{dollarOnes}</strong>
        </span>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Spending by team</h2>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Team</th>
                <th className="text-right px-3 sm:px-4 py-3 font-medium">Spent</th>
                <th className="text-right px-3 sm:px-4 py-3 font-medium">Left</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 font-medium">Players</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-medium">Biggest buy</th>
              </tr>
            </thead>
            <tbody>
              {perTeam.map(({ team, mine, spent, left, best }) => (
                <tr key={team.id} className="border-t border-border hover:bg-surface-2/60 transition-colors">
                  <td className="px-3 sm:px-4 py-3 font-medium">
                    <Link href={`/teams/${team.espn_team_id}`} className="flex items-center gap-2.5 hover:text-accent transition-colors">
                      <TeamLogo logo={team.logo} name={team.name} size={26} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{team.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums">${spent}</td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-muted">${left}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums">{mine.length}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-muted">
                    {best ? `${best.player_name} ($${best.bid_amount})` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Biggest bids</h2>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">#</th>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Player</th>
                <th className="text-right px-3 sm:px-4 py-3 font-medium">Price</th>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Bought by</th>
              </tr>
            </thead>
            <tbody>
              {topBids.map((p, i) => (
                <tr key={p.overall_pick} className="border-t border-border">
                  <td className="px-3 sm:px-4 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-3 sm:px-4 py-2.5 font-medium">{p.player_name}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right tabular-nums">${p.bid_amount}</td>
                  <td className="px-3 sm:px-4 py-2.5 [overflow-wrap:anywhere]">{nameOf(p.espn_team_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Every pick, in order</h2>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Pick</th>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Player</th>
                <th className="text-right px-3 sm:px-4 py-3 font-medium">Price</th>
                <th className="text-left px-3 sm:px-4 py-3 font-medium">Team</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-medium">Nominated by</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p) => (
                <tr key={p.overall_pick} className="border-t border-border">
                  <td className="px-3 sm:px-4 py-2 text-muted tabular-nums">{p.overall_pick}</td>
                  <td className="px-3 sm:px-4 py-2 font-medium">{p.player_name}</td>
                  <td className="px-3 sm:px-4 py-2 text-right tabular-nums">${p.bid_amount}</td>
                  <td className="px-3 sm:px-4 py-2 [overflow-wrap:anywhere]">{nameOf(p.espn_team_id)}</td>
                  <td className="hidden sm:table-cell px-4 py-2 text-muted">{nameOf(p.nominating_team_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
