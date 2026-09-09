import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentSeason, getTeams, getTransactions } from "@/lib/data";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  WAIVER: "Waiver claim",
  FREEAGENT: "Free agent add",
  TRADE_ACCEPT: "Trade",
  TRADE_ACCEPTED: "Trade",
  ROSTER: "Roster move",
};

export default async function TransactionsPage() {
  if (!isSupabaseConfigured()) {
    return <EmptyState title="Not connected yet" detail="See README.md to configure Supabase and ESPN credentials." />;
  }

  const season = await getCurrentSeason();
  if (!season) return <EmptyState title="No season synced yet" />;

  const [teams, transactions] = await Promise.all([
    getTeams(season.id),
    getTransactions(season.id, 200),
  ]);
  const nameFor = (id: number | null) =>
    id == null ? null : teams.find((t) => t.espn_team_id === id)?.name ?? `Team ${id}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <div className="card divide-y divide-border">
        {transactions.map((t) => (
          <div key={t.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm">
                <span className="font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                {nameFor(t.team_espn_id) && (
                  <span className="text-muted"> · {nameFor(t.team_espn_id)}</span>
                )}
              </p>
              <p className="text-muted text-sm mt-1">
                {(t.items ?? [])
                  .map((i: { playerName?: string; type?: string }) =>
                    i.type ? `${i.type}: ${i.playerName}` : i.playerName
                  )
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
            <span className="text-muted text-xs whitespace-nowrap">
              {t.processed_at ? new Date(t.processed_at).toLocaleDateString() : ""}
            </span>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="p-6">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
