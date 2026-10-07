// League-specific rules — not derived from ESPN, just your league's actual
// buy-in/payout structure. Edit this file directly when the rules change
// season to season (buy-in amount, payout splits, award categories).

export const leagueRules = {
  buyIn: 35,
  teamCount: 16,
  totalPot: 560,

  // Playoff bracket shape — not derivable from ESPN's schedule data before
  // it happens (the play-in pairings depend on final regular-season seed),
  // so this is entered by hand same as the payout structure below. Update
  // this if the league's playoff format ever changes.
  playoffFormat: {
    autoByeCount: 6, // seeds 1-6 clinch the 8-team bracket outright
    playInFieldSize: 4, // seeds 7-10 fight for the remaining bracket spots
    playInAdvanceCount: 2, // ...and only 2 of those 4 make it
  },

  championsPot: {
    label: "Champions Pot",
    range: "$450",
    payouts: [
      { place: "1st", amount: "$265", extra: "+ trophy" as string | undefined },
      { place: "2nd", amount: "$120", extra: undefined as string | undefined },
      { place: "3rd", amount: "$65", extra: undefined as string | undefined },
    ],
    lastPlace: {
      label: "Last place (worst record)",
      detail:
        "Punishment, or pay $35 into the pot — split $14 to 1st, $14 to 2nd, $7 to 3rd",
    },
  },

  specialWinningsPot: {
    label: "Special Winnings Pot",
    total: 110,
    weekWinner: {
      label: "Week Winner",
      perWeek: 5,
      weeks: 15,
      total: 75,
      detail: "Highest total score across the league each week",
    },
    numberOnes: {
      label: "Number Ones",
      perAward: 3,
      positions: ["PG", "SG", "SF", "PF", "C"],
      total: 15,
      detail: "Top-ranked player at each position — needs roster/player stat sync",
    },
  },

  cashAwards: [
    { label: "Best draft pick", detail: "(player rating × # pick)", amount: 5 },
    { label: "Best waiver wire pickup", detail: "(player rating)", amount: 5 },
    { label: "Best regular season record", amount: 10 },
  ],

  votedAwards: [
    { label: "Worst draft pick", detail: "voting" },
    { label: "Most improved league manager", detail: "voting" },
  ],
} as const;

// ESPN league settings for 2026-27 — hand-entered like the rules above, since
// none of this is derivable from the ESPN data we sync. Update this block if
// the ESPN settings change.
export const leagueSettings = {
  draft: {
    type: "Salary cap (auction)",
    date: "Fri, Oct 16",
    time: "7:30 PM EDT",
    startsAt: "2026-10-16T19:30:00-04:00", // same moment, machine-readable (for the countdown)
    cap: 200, // same for every team this year
  },
  waivers: {
    type: "Free agent budget (FAAB)",
    budget: 100,
    minBid: 1,
    addsPerMatchup: 2,
    detail: "Highest bid wins. The $100 has to last the whole season.",
  },
  roster: {
    size: 13,
    starters: 9,
    bench: 4,
    ir: 2,
  },
} as const;

// The "Teams" overlay: the 16 managers grouped into 4 teams of 4, snaked by
// last season's (2026) final finish so every team gets one manager from each
// quartile (rank sums all 34). Members are ESPN team ids — stable across
// renames — not display names. Teams compete THIS season; the reward is for
// NEXT year's auction.
export const teamBattle = {
  scoring:
    "Combined category W-L-T across all 4 managers, regular season only. Ranked by category win % (a tie counts as half a win).",
  tiebreaker: "Combined matchup W-L, then team letter.",
  rewardNote: "Next year's auction budget bonus, by team finish.",
  teams: [
    { key: "A", name: "Team A", memberIds: [6, 22, 21, 18] }, // Cream Team, Us_Whole$, Team ONT, King of NY
    { key: "B", name: "Team B", memberIds: [19, 4, 15, 9] }, // KD's Nutsack, Team Balls, Hapboarnick, Team Crippled
    { key: "C", name: "Team C", memberIds: [8, 11, 2, 5] }, // WNY Wenekleks, I Don't Have Bol Bol, Team UNited SnL, White Men Can Jump
    { key: "D", name: "Team D", memberIds: [1, 20, 23, 3] }, // The Bol Bol's, Noah's Nifty Team, Matt's Mid Team, ConstantlyBallin...
  ],
  // Extra auction budget for next year, indexed by team finish (1st..4th).
  // ESPN only has one league-wide cap, so it is set to the top tier ($220)
  // and each team's own cap is enforced by league rule.
  rewards: [
    { place: "1st", bonus: 20 },
    { place: "2nd", bonus: 10 },
    { place: "3rd", bonus: 5 },
    { place: "4th", bonus: 0 },
  ],
  nextYearBaseCap: 200,
} as const;

// This league's 9 scoring categories, in the order they cycle through the
// first 9 weeks of the season (Week 1 = PTS, Week 2 = REB, ... Week 9 = TO).
// After week 9 the "category of the week" badge is randomized instead —
// it's a decorative spotlight, not a source of truth: actual weekly
// winners are still decided by overall category record, since ESPN
// doesn't give us a per-category breakdown for each matchup.
export const NINE_CATEGORIES = [
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "3PM",
  "FG%",
  "FT%",
  "TO",
] as const;

/**
 * Deterministic pick from NINE_CATEGORIES for a given matchup period —
 * sequential for weeks 1-9, then a stable pseudo-random pick for every
 * week after that (same week always shows the same category, but the
 * weeks 10+ order doesn't follow 1-9-1-9-... again).
 */
export function categoryOfWeek(matchupPeriodId: number): string {
  if (matchupPeriodId >= 1 && matchupPeriodId <= NINE_CATEGORIES.length) {
    return NINE_CATEGORIES[matchupPeriodId - 1];
  }
  const seed = Math.sin(matchupPeriodId * 9301 + 49297) * 233280;
  const frac = seed - Math.floor(seed);
  return NINE_CATEGORIES[Math.floor(frac * NINE_CATEGORIES.length)];
}
