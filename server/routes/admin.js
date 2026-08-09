import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { today, weekStart } from "../lib/time.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendCancellationNotice } from "../services/email.js";
import { invalidateConfigCache } from "../services/config.js";

const app = new Hono();

// Router-level auth — every route below is admin-only.
app.use("*", requireAdmin);

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ─── Dashboard stats ──────────────────────────────────────────────────────────

app.get("/stats", async (c) => {
  // "Today" and "this week" are the business's, not the container's UTC clock.
  const todayStr = today();
  const weekStartStr = weekStart();

  const [todayRes, upcomingRes, weekRevenueRes, totalRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("date", todayStr)
      .in("status", ["confirmed", "completed"])
      .order("start_time"),

    supabase
      .from("bookings")
      .select("*")
      .gt("date", todayStr)
      .eq("status", "confirmed")
      .order("date")
      .order("start_time")
      .limit(10),

    supabase
      .from("bookings")
      .select("deposit_cents")
      .gte("date", weekStartStr)
      .eq("payment_status", "paid")
      .in("status", ["confirmed", "completed"]),

    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "completed"]),
  ]);

  const failed = [todayRes, upcomingRes, weekRevenueRes, totalRes].find((r) => r.error);
  if (failed) {
    console.error("Stats query failed:", failed.error);
    return c.json({ error: "Could not load dashboard stats." }, 500);
  }

  const weekRevenueCents = (weekRevenueRes.data || []).reduce(
    (sum, b) => sum + (b.deposit_cents || 0),
    0
  );

  return c.json({
    todayBookings: todayRes.data || [],
    upcomingBookings: upcomingRes.data || [],
    weekRevenueCents,
    totalBookings: totalRes.count || 0,
  });
});

// ─── Bookings management ──────────────────────────────────────────────────────

app.get(
  "/bookings",
  zValidator(
    "query",
    z.object({
      date: z.string().regex(DATE_RE).optional(),
      status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
    })
  ),
  async (c) => {
    const { date, status, page } = c.req.valid("query");
    const pageSize = 20;
    const from = (page - 1) * pageSize;

    let query = supabase
      .from("bookings")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .range(from, from + pageSize - 1);

    if (date) query = query.eq("date", date);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) {
      console.error("Bookings query failed:", error);
      return c.json({ error: "Could not load bookings." }, 500);
    }

    return c.json({ bookings: data, total: count ?? 0, page, pageSize });
  }
);

app.post(
  "/bookings/:id/cancel",
  zValidator("json", z.object({ reason: z.string().trim().max(500).optional() })),
  async (c) => {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("status", "confirmed")
      .maybeSingle();

    if (fetchErr) {
      console.error("Cancel lookup failed:", fetchErr);
      return c.json({ error: "Could not cancel booking." }, 500);
    }

    if (!booking) return c.json({ error: "Booking not found or already cancelled." }, 404);

    // Status guard makes a double-click a no-op rather than a second email.
    const { data: updated, error: updateErr } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "admin",
        cancel_reason: reason || null,
      })
      .eq("id", id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();

    if (updateErr) {
      console.error("Cancel update failed:", updateErr);
      return c.json({ error: "Could not cancel booking." }, 500);
    }

    if (!updated) return c.json({ error: "Booking not found or already cancelled." }, 404);

    sendCancellationNotice(booking, "admin").catch((err) =>
      console.error("Cancellation email failed:", err)
    );

    return c.json({ ok: true });
  }
);

app.post("/bookings/:id/complete", async (c) => {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", c.req.param("id"))
    .eq("status", "confirmed")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Complete update failed:", error);
    return c.json({ error: "Could not update booking." }, 500);
  }

  if (!data) return c.json({ error: "Booking not found or not confirmed." }, 404);

  return c.json({ ok: true });
});

// ─── Blocked dates ────────────────────────────────────────────────────────────

app.get("/blocked-dates", async (c) => {
  const { data, error } = await supabase.from("blocked_dates").select("*").order("date");

  if (error) {
    console.error("Blocked dates query failed:", error);
    return c.json({ error: "Could not load blocked dates." }, 500);
  }

  return c.json({ blockedDates: data });
});

app.post(
  "/blocked-dates",
  zValidator(
    "json",
    z.object({
      date: z.string().regex(DATE_RE, "Invalid date"),
      reason: z.string().trim().max(200).optional(),
    })
  ),
  async (c) => {
    const { date, reason } = c.req.valid("json");

    const { error } = await supabase
      .from("blocked_dates")
      .insert({ date, reason: reason || null });

    if (error) {
      if (error.code === "23505") return c.json({ error: "That date is already blocked." }, 409);
      console.error("Block date failed:", error);
      return c.json({ error: "Could not block that date." }, 500);
    }

    return c.json({ ok: true });
  }
);

app.delete("/blocked-dates/:date", async (c) => {
  const date = c.req.param("date");

  if (!DATE_RE.test(date)) return c.json({ error: "Invalid date" }, 400);

  const { error } = await supabase.from("blocked_dates").delete().eq("date", date);

  if (error) {
    console.error("Unblock date failed:", error);
    return c.json({ error: "Could not unblock that date." }, 500);
  }

  return c.json({ ok: true });
});

// ─── Blocked slots ────────────────────────────────────────────────────────────

app.get(
  "/blocked-slots",
  zValidator("query", z.object({ date: z.string().regex(DATE_RE).optional() })),
  async (c) => {
    const { date } = c.req.valid("query");

    let query = supabase.from("blocked_slots").select("*").order("date").order("start_time");
    if (date) query = query.eq("date", date);

    const { data, error } = await query;

    if (error) {
      console.error("Blocked slots query failed:", error);
      return c.json({ error: "Could not load blocked slots." }, 500);
    }

    return c.json({ blockedSlots: data });
  }
);

app.post(
  "/blocked-slots",
  zValidator(
    "json",
    z
      .object({
        date: z.string().regex(DATE_RE, "Invalid date"),
        startTime: z.string().regex(TIME_RE, "Invalid start time"),
        endTime: z.string().regex(TIME_RE, "Invalid end time"),
        reason: z.string().trim().max(200).optional(),
      })
      .refine((v) => v.startTime < v.endTime, {
        message: "Start time must be before end time",
        path: ["endTime"],
      })
  ),
  async (c) => {
    const { date, startTime, endTime, reason } = c.req.valid("json");

    const { error } = await supabase
      .from("blocked_slots")
      .insert({ date, start_time: startTime, end_time: endTime, reason: reason || null });

    if (error) {
      console.error("Block slot failed:", error);
      return c.json({ error: "Could not block that time." }, 500);
    }

    return c.json({ ok: true });
  }
);

app.delete("/blocked-slots/:id", async (c) => {
  const { error } = await supabase.from("blocked_slots").delete().eq("id", c.req.param("id"));

  if (error) {
    console.error("Unblock slot failed:", error);
    return c.json({ error: "Could not unblock that time." }, 500);
  }

  return c.json({ ok: true });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

const dayHours = z
  .object({
    open: z.string().regex(TIME_RE, "Invalid opening time"),
    close: z.string().regex(TIME_RE, "Invalid closing time"),
  })
  .refine((v) => v.open < v.close, { message: "Opening time must be before closing time" })
  .nullable();

// Explicit allow-list: a typo'd key would otherwise be written straight into
// the live config and silently override a real value.
const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    tagline: z.string().trim().max(200),
    description: z.string().trim().max(2000),
    phone: z.string().trim().max(40),
    email: z.string().trim().email(),
    address: z.string().trim().max(300),

    // Zero would produce a deposit Stripe refuses to charge, which breaks the
    // whole webhook-gated booking flow.
    depositPercent: z.coerce.number().min(1).max(100),
    cancellationHours: z.coerce.number().int().min(0).max(720),
    minimumNoticeHours: z.coerce.number().min(0).max(168),
    slotInterval: z.coerce.number().int().min(5).max(240),

    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone — use an IANA name like America/New_York"),

    theme: z.object({
      primary: z.string().regex(HEX_RE),
      secondary: z.string().regex(HEX_RE),
      accent: z.string().regex(HEX_RE),
      background: z.string().regex(HEX_RE),
      surface: z.string().regex(HEX_RE),
      text: z.string().regex(HEX_RE),
      textMuted: z.string().regex(HEX_RE),
      border: z.string().regex(HEX_RE),
      borderRadius: z.string().regex(/^\d+(px|rem|em)$/),
      font: z.object({ heading: z.string().max(60), body: z.string().max(60) }).partial(),
    }).partial(),

    hours: z
      .object({
        mon: dayHours, tue: dayHours, wed: dayHours, thu: dayHours,
        fri: dayHours, sat: dayHours, sun: dayHours,
      })
      .partial(),
  })
  .partial()
  .strict();

app.get("/settings", async (c) => {
  const { data, error } = await supabase.from("settings").select("*");

  if (error) {
    console.error("Settings query failed:", error);
    return c.json({ error: "Could not load settings." }, 500);
  }

  const settings = {};
  for (const row of data || []) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }

  return c.json({ settings });
});

app.put("/settings", zValidator("json", settingsSchema), async (c) => {
  const updates = c.req.valid("json");
  const entries = Object.entries(updates);

  if (!entries.length) return c.json({ error: "Nothing to save." }, 400);

  const rows = entries.map(([key, value]) => ({
    key,
    value: JSON.stringify(value),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });

  if (error) {
    console.error("Settings save failed:", error);
    return c.json({ error: "Could not save settings." }, 500);
  }

  // Availability and pricing read the merged config — drop the cache now so
  // the change takes effect on the very next request.
  invalidateConfigCache();

  return c.json({ ok: true });
});

export default app;
