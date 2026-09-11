// Monte Carlo playoff odds. Runs the REAL remaining schedule (ESPN
// pre-generates all 16 teams' round-robin pairings for the full regular
// season up front, even for weeks that haven't happened yet — see the
// `matchups` rows with winner = "UNDECIDED") through many randomized
// outcomes, using each team's Power Ranking score as its underlying
// strength. This is far more accurate than assuming a random schedule,
// because it isn't — some teams genuinely have a harder back-half.
//
// Playoff format (see lib/leagueConfig.ts `playoffFormat`): the top
// `autoByeCount` seeds clinch the bracket outright; the next
// `playInFieldSize` seeds fight for `playInAdvanceCount` remaining bracket
// spots in a single-elimination play-in (seed N vs seed
// autoByeCount+playInFieldSize+1-N, higher seed always hosts); everyone
// else is done for the year.

export interface SimTeam {
  espnTeamId: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  strength: number; // Power Ranking score, roughly 0..1 — higher is better
}

export interface SimMatchup {
  matchupPeriodId: number;
  homeTeamId: number;
  awayTeamId: number | null; // null = a bye week, doesn't affect record
}

export interface PlayoffFormat {
  autoByeCount: number; // seeds 1..N clinch the bracket with no play-in
  playInFieldSize: number; // the next M seeds fight for the remaining spots
  playInAdvanceCount: number; // how many of those M make the bracket
}

export interface TeamOdds {
  espnTeamId: number;
  name: string;
  currentWins: number;
  currentLosses: number;
  currentTies: number;
  autoByePct: number; // % of sims finishing in the top autoByeCount, no play-in needed
  playInPct: number; // % of sims landing in the play-in field
  makePlayoffsPct: number; // % of sims that end up in the 8-team bracket (auto-bye + won play-in)
  missPct: number; // % of sims finishing outside the playoff picture entirely
  projectedWins: number; // average simulated final win total
  projectedLosses: number;
  projectedSeed: number; // average simulated final regular-season seed
  clinched: boolean; // true in every single simulation
  eliminated: boolean; // false (can't make it) in every single simulation
}

const SIMULATIONS = 8000;

// Mulberry32 — fast, deterministic-if-seeded PRNG so results are stable
// within a single render instead of jittering every request.
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Win probability for `strengthA` facing `strengthB`, as a logistic curve
 * over the Power Ranking score gap. Power scores cluster roughly 0..1, so a
 * ~0.15 gap (a clearly-better team) lands around 80/20, and a ~0.3 gap
 * (best vs. worst in the league) lands around 95/5 — a big favorite can
 * still lose some weeks, same as real fantasy basketball.
 */
function winProbability(strengthA: number, strengthB: number): number {
  const SCALE = 0.09;
  const diff = strengthA - strengthB;
  return 1 / (1 + Math.pow(10, -diff / SCALE));
}

// H2H Each Category matchups can genuinely tie (e.g. 4-4-1 across 9 cats).
// Small, fixed probability — doesn't swing on strength.
const TIE_PROBABILITY = 0.04;

function simulateGame(
  strengthHome: number,
  strengthAway: number,
  rng: () => number
): "HOME" | "AWAY" | "TIE" {
  const roll = rng();
  if (roll < TIE_PROBABILITY) return "TIE";
  const pHome = winProbability(strengthHome, strengthAway) * (1 - TIE_PROBABILITY);
  return roll < TIE_PROBABILITY + pHome ? "HOME" : "AWAY";
}

function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games === 0 ? 0 : (wins + ties * 0.5) / games;
}

export function simulatePlayoffOdds(
  teams: SimTeam[],
  remainingMatchups: SimMatchup[],
  format: PlayoffFormat,
  seed = 42
): TeamOdds[] {
  const rng = makeRng(seed);

  const autoByeCount = new Map<number, number>();
  const playInFieldCount = new Map<number, number>();
  const madePlayoffsCount = new Map<number, number>();
  const seedSum = new Map<number, number>();
  const winsSum = new Map<number, number>();
  const lossesSum = new Map<number, number>();

  for (const t of teams) {
    autoByeCount.set(t.espnTeamId, 0);
    playInFieldCount.set(t.espnTeamId, 0);
    madePlayoffsCount.set(t.espnTeamId, 0);
    seedSum.set(t.espnTeamId, 0);
    winsSum.set(t.espnTeamId, 0);
    lossesSum.set(t.espnTeamId, 0);
  }

  const strengthById = new Map(teams.map((t) => [t.espnTeamId, t.strength]));

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    const record = new Map(
      teams.map((t) => [t.espnTeamId, { wins: t.wins, losses: t.losses, ties: t.ties }])
    );

    for (const m of remainingMatchups) {
      if (m.awayTeamId == null) continue; // bye week
      const homeStrength = strengthById.get(m.homeTeamId) ?? 0.5;
      const awayStrength = strengthById.get(m.awayTeamId) ?? 0.5;
      const result = simulateGame(homeStrength, awayStrength, rng);
      const home = record.get(m.homeTeamId)!;
      const away = record.get(m.awayTeamId)!;
      if (result === "HOME") {
        home.wins++;
        away.losses++;
      } else if (result === "AWAY") {
        away.wins++;
        home.losses++;
      } else {
        home.ties++;
        away.ties++;
      }
    }

    // Final seeding: win% desc, alphabetical tiebreak — same rule used
    // everywhere else in the app (Standings, History, Power Rankings).
    const finalOrder = [...teams].sort((a, b) => {
      const ra = record.get(a.espnTeamId)!;
      const rb = record.get(b.espnTeamId)!;
      return (
        winPct(rb.wins, rb.losses, rb.ties) - winPct(ra.wins, ra.losses, ra.ties) ||
        a.name.localeCompare(b.name)
      );
    });

    finalOrder.forEach((t, i) => {
      const seedNum = i + 1;
      const r = record.get(t.espnTeamId)!;
      seedSum.set(t.espnTeamId, seedSum.get(t.espnTeamId)! + seedNum);
      winsSum.set(t.espnTeamId, winsSum.get(t.espnTeamId)! + r.wins);
      lossesSum.set(t.espnTeamId, lossesSum.get(t.espnTeamId)! + r.losses);

      if (seedNum <= format.autoByeCount) {
        autoByeCount.set(t.espnTeamId, autoByeCount.get(t.espnTeamId)! + 1);
        madePlayoffsCount.set(t.espnTeamId, madePlayoffsCount.get(t.espnTeamId)! + 1);
      } else if (seedNum <= format.autoByeCount + format.playInFieldSize) {
        playInFieldCount.set(t.espnTeamId, playInFieldCount.get(t.espnTeamId)! + 1);
      }
    });

    // Single-elimination play-in among seeds (autoByeCount+1) .. (autoByeCount+playInFieldSize):
    // best seed hosts worst seed, 2nd-best hosts 2nd-worst, etc. — the
    // standard "top half of the play-in field gets the easier draw" shape.
    const playInField = finalOrder.slice(
      format.autoByeCount,
      format.autoByeCount + format.playInFieldSize
    );
    const winners: typeof playInField = [];
    for (let i = 0; i < Math.floor(playInField.length / 2); i++) {
      const higher = playInField[i];
      const lower = playInField[playInField.length - 1 - i];
      const result = simulateGame(
        strengthById.get(higher.espnTeamId) ?? 0.5,
        strengthById.get(lower.espnTeamId) ?? 0.5,
        rng
      );
      winners.push(result === "AWAY" ? lower : higher);
    }
    // If playInAdvanceCount doesn't neatly match one game per two teams,
    // just take the game winners in seed order up to the advance count.
    for (const w of winners.slice(0, format.playInAdvanceCount)) {
      madePlayoffsCount.set(w.espnTeamId, madePlayoffsCount.get(w.espnTeamId)! + 1);
    }
  }

  return teams
    .map((t) => {
      const autoBye = autoByeCount.get(t.espnTeamId)!;
      const playIn = playInFieldCount.get(t.espnTeamId)!;
      const madePlayoffs = madePlayoffsCount.get(t.espnTeamId)!;
      return {
        espnTeamId: t.espnTeamId,
        name: t.name,
        currentWins: t.wins,
        currentLosses: t.losses,
        currentTies: t.ties,
        autoByePct: (autoBye / SIMULATIONS) * 100,
        playInPct: (playIn / SIMULATIONS) * 100,
        makePlayoffsPct: (madePlayoffs / SIMULATIONS) * 100,
        missPct: 100 - (madePlayoffs / SIMULATIONS) * 100,
        projectedWins: winsSum.get(t.espnTeamId)! / SIMULATIONS,
        projectedLosses: lossesSum.get(t.espnTeamId)! / SIMULATIONS,
        projectedSeed: seedSum.get(t.espnTeamId)! / SIMULATIONS,
        clinched: madePlayoffs === SIMULATIONS,
        eliminated: madePlayoffs === 0,
      };
    })
    .sort((a, b) => a.projectedSeed - b.projectedSeed);
}
