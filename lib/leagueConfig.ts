// League-specific rules — not derived from ESPN, just your league's actual
// buy-in/payout structure. Edit this file directly when the rules change
// season to season (buy-in amount, payout splits, award categories).

export const leagueRules = {
  buyIn: 25,
  teamCount: 16,
  totalPot: 400,

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
