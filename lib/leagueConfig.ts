// League-specific rules — not derived from ESPN, just your league's actual
// buy-in/payout structure. Edit this file directly when the rules change
// season to season (buy-in amount, payout splits, award categories).

export const leagueRules = {
  buyIn: 25,
  teamCount: 16,
  totalPot: 400,

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
    range: "$310–335",
    payouts: [
      { place: "1st", amount: "$160–165", extra: "+ trophy" as string | undefined },
      { place: "2nd", amount: "$75", extra: undefined as string | undefined },
      { place: "3rd", amount: "$40", extra: undefined as string | undefined },
    ],
    lastPlace: {
      label: "Last place (worst record)",
      detail:
        "Punishment, or pay $25 into the pot — split $10 to 1st, $10 to 2nd, $5 to 3rd",
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
