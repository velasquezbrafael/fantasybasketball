// Small shared display helpers used by the matchups/pot/dashboard pages so
// the "team name + category record" formatting stays consistent everywhere.

/**
 * ESPN's playoffTierType values, turned into labels a human would use.
 */
export function prettyPlayoffTier(tier: string | null | undefined): string {
  if (!tier) return "Regular Season";
  const map: Record<string, string> = {
    WINNERS_BRACKET: "Playoffs — Championship Bracket",
    LOSERS_CONSOLATION_LADDER: "Playoffs — Consolation Bracket",
    WINNERS_CONSOLATION_LADDER: "Playoffs — Consolation Bracket",
  };
  return (
    map[tier] ??
    `Playoffs — ${tier
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())}`
  );
}

/**
 * Score/record for one side of a matchup. This is a 9-category (H2H Each
 * Category) league, so the real result is a category record like "6-3-0",
 * not a point total — ESPN doesn't even populate a numeric score for these.
 * Falls back to a raw score for a points-scoring league that has one.
 */
export function matchupSideRecord(
  catWins: number | null | undefined,
  catLosses: number | null | undefined,
  catTies: number | null | undefined,
  rawScore: number | null | undefined
): string {
  if (catWins != null) {
    return `${catWins}-${catLosses ?? 0}${catTies ? `-${catTies}` : ""}`;
  }
  return rawScore != null ? Number(rawScore).toFixed(0) : "—";
}
