import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { stripe } from "../lib/stripe.js";
import { supabase } from "../lib/supabase.js";
import { PUBLIC_URL } from "../lib/env.js";
import { hoursUntil } from "../lib/time.js";
import { validateSlot } from "../services/availability.js";
import { getConfig, getService } from "../services/config.js";
import { sendCancellationNotice } from "../services/email.js";

const app = new Hono();

// Stripe rejects charges below this; a deposit percent that rounds under it
// would fail at the API with an opaque error, so we catch it here instead.
const STRIPE_MIN_CHARGE_CENTS = 50;

// Note: endTime is deliberately NOT accepted from the client. It is derived
// server-side from the service duration in validateSlot().
const checkoutSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().trim().email().max(254),
  customerPhone: z.string().trim().min(6).max(30),
});

// POST /api/bookings/checkout — creates a Stripe Checkout session.
// The booking is NOT written to the DB here; the webhook does that after payment.
app.post("/checkout", zValidator("json", checkoutSchema), async (c) => {
  const { serviceId, date, startTime, customerName, customerEmail, customerPhone } =
    c.req.valid("json");

  const config = await getConfig();
  const service = await getService(serviceId);

  if (!service) return c.json({ error: "Unknown service" }, 400);

  // Authoritative availability + shape check. Also hands back the derived end time.
  const slot = await validateSlot(date, startTime, service);
  if (!slot.ok) return c.json({ error: slot.error }, 409);

  const depositPercent = Number(config.depositPercent);
  if (!Number.isFinite(depositPercent) || depositPercent <= 0 || depositPercent > 100) {
    console.error(`Invalid depositPercent in config: ${config.depositPercent}`);
    return c.json({ error: "Booking is temporarily unavailable. Please contact us." }, 500);
  }

  const depositCents = Math.round(service.price * (depositPercent / 100));

  if (depositCents < STRIPE_MIN_CHARGE_CENTS) {
    console.error(
      `Deposit for "${service.name}" is ${depositCents} cents, below Stripe's ${STRIPE_MIN_CHARGE_CENTS}-cent minimum. ` +
        `Raise depositPercent or the service price.`
    );
    return c.json({ error: "Booking is temporarily unavailable. Please contact us." }, 500);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: (config.currency || "USD").toLowerCase(),
            product_data: {
              name: `${service.name} — Deposit`,
              description: `Booking deposit for ${service.name} on ${date} at ${slot.startTime}. Remaining balance due at your appointment.`,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      // The webhook rebuilds the booking from this. Everything here is
      // server-derived or already validated above.
      metadata: {
        serviceId,
        serviceName: service.name,
        durationMin: String(service.duration),
        priceCents: String(service.price),
        depositCents: String(depositCents),
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        customerName,
        customerEmail,
        customerPhone,
      },
      customer_email: customerEmail,
      success_url: `${PUBLIC_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/booking?cancelled=true`,
      // Stripe requires at least 30 minutes; the extra minute absorbs clock skew.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });

    return c.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Stripe session error:", err);
    return c.json({ error: "Failed to start payment. Please try again." }, 502);
  }
});

// GET /api/bookings/confirmation?session_id=cs_...
// Polled by the success page while the webhook lands.
app.get("/confirmation", async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) return c.json({ error: "Missing session_id" }, 400);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "confirmation_no, customer_email, service_name, duration_min, price_cents, deposit_cents, date, start_time, end_time, status"
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Confirmation lookup failed:", error);
    return c.json({ error: "Could not load your booking." }, 500);
  }

  // Webhook may not have fired yet — 202 tells the client to keep polling.
  if (!booking) return c.json({ status: "pending" }, 202);

  return c.json({ booking });
});

// POST /api/bookings/cancel/:token — customer self-cancel via the emailed link
app.post("/cancel/:token", async (c) => {
  const token = c.req.param("token");

  // Postgres errors on a malformed uuid comparison, so reject early.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return c.json({ error: "Booking not found or already cancelled." }, 404);
  }

  const config = await getConfig();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("cancel_token", token)
    .eq("status", "confirmed")
    .maybeSingle();

  if (error) {
    console.error("Cancel lookup failed:", error);
    return c.json({ error: "Could not cancel your booking." }, 500);
  }

  if (!booking) {
    return c.json({ error: "Booking not found or already cancelled." }, 404);
  }

  const cancellationHours = Number(config.cancellationHours) || 0;
  const remaining = hoursUntil(booking.date, booking.start_time);

  if (remaining < cancellationHours) {
    return c.json(
      {
        error: `Cancellations must be made at least ${cancellationHours} hours in advance. Please call us instead.`,
      },
      400
    );
  }

  // Guarded on status so two clicks of the emailed link can't double-cancel.
  const { data: updated, error: updateErr } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: "customer",
    })
    .eq("id", booking.id)
    .eq("status", "confirmed")
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error("Cancel update failed:", updateErr);
    return c.json({ error: "Could not cancel your booking." }, 500);
  }

  if (!updated) {
    return c.json({ error: "Booking not found or already cancelled." }, 404);
  }

  sendCancellationNotice(booking, "customer").catch((err) =>
    console.error("Cancellation email failed:", err)
  );

  return c.json({ ok: true, message: "Booking cancelled." });
});

export default app;
