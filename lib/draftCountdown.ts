// Time left until the auction draft, for the dashboard countdown. Pure
// function of (now, draft start) — the caller passes `now` so the result is
// always fresh on a force-dynamic page. Returns null once the draft has
// started, so the countdown just disappears afterwards.

export interface DraftCountdown {
  days: number;
  hours: number;
  label: string; // "9 days", "1 day, 4 hrs", "6 hrs", "under an hour"
  short: string; // "9d", "1d 4h", "6h", "<1h" — for the hero chip
}

export function draftCountdown(now: Date, startsAtIso: string): DraftCountdown | null {
  const ms = new Date(startsAtIso).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);

  if (days >= 2) return { days, hours, label: `${days} days`, short: `${days}d` };
  if (days === 1) {
    return {
      days,
      hours,
      label: hours > 0 ? `1 day, ${hours} hr${hours === 1 ? "" : "s"}` : "1 day",
      short: hours > 0 ? `1d ${hours}h` : "1d",
    };
  }
  if (hours >= 1) return { days, hours, label: `${hours} hr${hours === 1 ? "" : "s"}`, short: `${hours}h` };
  return { days, hours, label: "under an hour", short: "<1h" };
}
