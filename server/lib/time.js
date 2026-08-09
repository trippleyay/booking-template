// ============================================================
// TIMEZONE HELPERS
// ============================================================
// The server may run anywhere (Replit containers are UTC), but
// "today" and "has this slot already passed" only make sense in
// the business's own timezone. Everything that compares against
// the current moment goes through here.
//
// Uses Intl — no extra dependency, no tz database to ship.
// ============================================================

import { businessConfig } from "../../businessConfig.js";

const FALLBACK_TZ = "UTC";

function timezone() {
  const tz = businessConfig.timezone;
  if (!tz) return FALLBACK_TZ;

  try {
    // Throws RangeError on an unknown zone name
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    console.error(
      `Invalid businessConfig.timezone "${tz}" — falling back to ${FALLBACK_TZ}. ` +
        `Use an IANA name such as "America/New_York" or "Europe/London".`
    );
    return FALLBACK_TZ;
  }
}

/**
 * Current date in the business's timezone as "YYYY-MM-DD".
 * en-CA formats as ISO, which saves reassembling the parts by hand.
 */
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Current wall-clock time in the business's timezone as "HH:mm".
 */
export function currentTime(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/**
 * Start of the current week (Sunday) in the business's timezone, "YYYY-MM-DD".
 * Used for the admin revenue stat.
 */
export function weekStart(now = new Date()) {
  const todayStr = today(now);
  const [y, m, d] = todayStr.split("-").map(Number);

  // Build the date in UTC so the arithmetic can't be dragged across a
  // boundary by the host timezone — we only care about the calendar shift.
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());

  return utc.toISOString().slice(0, 10);
}

/**
 * Hours from now until a booking's local start time.
 * Negative once the appointment has begun.
 *
 * `date` is "YYYY-MM-DD" and `time` is "HH:mm" or "HH:mm:ss", both
 * interpreted as wall-clock time in the business's timezone.
 */
export function hoursUntil(date, time, now = new Date()) {
  const target = zonedToUtc(date, time.slice(0, 5));
  return (target.getTime() - now.getTime()) / 3_600_000;
}

/**
 * Converts a wall-clock date+time in the business's timezone to a real UTC instant.
 *
 * Interprets the wall-clock reading as if it were UTC, measures how far that
 * guess lands from the target zone, then corrects. One correction pass is
 * enough for every real zone offset.
 */
function zonedToUtc(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = guess.getTime() - wallClockAsUtc(guess).getTime();

  return new Date(guess.getTime() + offset);
}

/** Reads an instant's wall-clock parts in the business timezone, as a UTC Date. */
function wallClockAsUtc(instant) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(instant)
    .reduce((acc, p) => {
      if (p.type !== "literal") acc[p.type] = Number(p.value);
      return acc;
    }, {});

  // Intl can render midnight as hour 24 in some environments
  const hour = parts.hour === 24 ? 0 : parts.hour;

  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second)
  );
}
