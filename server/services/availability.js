// ============================================================
// AVAILABILITY ENGINE
// ============================================================
// The single authority on whether a slot can be booked. Both the
// public slot list and the checkout guard go through here, so they
// can never disagree about what "available" means.
//
// All time arithmetic is done in minutes-since-midnight rather than
// Date objects: the DB stores wall-clock `time` values with no zone,
// and round-tripping those through Date drags them across whatever
// timezone the container happens to run in.
// ============================================================

import { supabase } from "../lib/supabase.js";
import { getConfig } from "./config.js";
import { today, currentTime } from "../lib/time.js";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Day-of-week key for a "YYYY-MM-DD" string, read as a plain calendar date. */
function dayNameFor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "09:30" or "09:30:00" -> 570. Seconds are ignored. */
function toMinutes(timeStr) {
  const [h, m] = String(timeStr).split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Half-open overlap: [startA,endA) intersects [start,end) */
function overlaps(startA, endA, intervals) {
  return intervals.some(({ start, end }) => startA < end && endA > start);
}

/**
 * Everything about a given day that constrains booking, in one round trip.
 */
async function fetchDayState(dateStr) {
  const [blockedDateRes, bookingsRes, blockedSlotsRes] = await Promise.all([
    supabase.from("blocked_dates").select("id").eq("date", dateStr).maybeSingle(),
    supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("date", dateStr)
      .in("status", ["confirmed", "completed"]),
    supabase.from("blocked_slots").select("start_time, end_time").eq("date", dateStr),
  ]);

  if (bookingsRes.error) throw new Error("Failed to fetch bookings: " + bookingsRes.error.message);
  if (blockedSlotsRes.error) throw new Error("Failed to fetch blocked slots: " + blockedSlotsRes.error.message);

  const taken = [...(bookingsRes.data || []), ...(blockedSlotsRes.data || [])].map((r) => ({
    start: toMinutes(r.start_time),
    end: toMinutes(r.end_time),
  }));

  return { isBlockedDate: !!blockedDateRes.data, taken };
}

/**
 * Earliest bookable minute on a given date.
 * Past times on today's date are excluded, plus any required notice period.
 * Returns -Infinity for future dates.
 */
function earliestBookableMinute(dateStr, config) {
  if (dateStr !== today()) return -Infinity;

  const noticeHours = Number(config.minimumNoticeHours) || 0;
  return toMinutes(currentTime()) + noticeHours * 60;
}

/**
 * All bookable start times for a date and service duration.
 * Excludes closed days, past dates, past times, blocked dates,
 * admin-blocked slots and existing bookings.
 */
export async function getAvailableSlots(dateStr, durationMin) {
  const config = await getConfig();

  if (dateStr < today()) return [];

  const hours = config.hours?.[dayNameFor(dateStr)];
  if (!hours?.open || !hours?.close) return [];

  const { isBlockedDate, taken } = await fetchDayState(dateStr);
  if (isBlockedDate) return [];

  const openMin = toMinutes(hours.open);
  const closeMin = toMinutes(hours.close);
  const interval = Number(config.slotInterval) || 15;
  const earliest = earliestBookableMinute(dateStr, config);

  const slots = [];

  for (let start = openMin; start + durationMin <= closeMin; start += interval) {
    if (start < earliest) continue;
    if (overlaps(start, start + durationMin, taken)) continue;

    slots.push({ start: toTimeStr(start), end: toTimeStr(start + durationMin) });
  }

  return slots;
}

/**
 * Authoritative pre-payment check.
 *
 * The client sends only a date, a start time and a service id — the end time
 * is DERIVED here from the service duration, never accepted from the request.
 * Otherwise a crafted payload could claim a 120-minute service occupies one
 * minute of the calendar.
 *
 * Returns { ok: true, startTime, endTime } or { ok: false, error }.
 */
export async function validateSlot(dateStr, startTime, service) {
  const config = await getConfig();

  if (dateStr < today()) {
    return { ok: false, error: "That date has already passed." };
  }

  const hours = config.hours?.[dayNameFor(dateStr)];
  if (!hours?.open || !hours?.close) {
    return { ok: false, error: "We're closed on that day." };
  }

  const startMin = toMinutes(startTime);
  const endMin = startMin + service.duration;
  const openMin = toMinutes(hours.open);
  const closeMin = toMinutes(hours.close);

  if (startMin < openMin || endMin > closeMin) {
    return { ok: false, error: "That time is outside our opening hours." };
  }

  const interval = Number(config.slotInterval) || 15;
  if ((startMin - openMin) % interval !== 0) {
    return { ok: false, error: "That isn't one of our bookable start times." };
  }

  if (startMin < earliestBookableMinute(dateStr, config)) {
    const noticeHours = Number(config.minimumNoticeHours) || 0;
    return {
      ok: false,
      error: noticeHours
        ? `Bookings need at least ${noticeHours} hour${noticeHours === 1 ? "" : "s"} notice.`
        : "That time has already passed.",
    };
  }

  const { isBlockedDate, taken } = await fetchDayState(dateStr);

  if (isBlockedDate) {
    return { ok: false, error: "We're closed on that date." };
  }

  if (overlaps(startMin, endMin, taken)) {
    return { ok: false, error: "That slot is no longer available. Please choose another time." };
  }

  return { ok: true, startTime: toTimeStr(startMin), endTime: toTimeStr(endMin) };
}
