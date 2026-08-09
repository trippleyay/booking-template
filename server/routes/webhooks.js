import { Hono } from "hono";
import { stripe } from "../lib/stripe.js";
import { supabase } from "../lib/supabase.js";
import { generateConfirmationNo } from "../lib/confirmationNo.js";
import { sendBookingConfirmation, sendSlotUnavailableRefund } from "../services/email.js";
import { getConfig } from "../services/config.js";

const app = new Hono();

// Postgres SQLSTATE codes we treat as meaningful rather than "unknown failure"
const PG_UNIQUE_VIOLATION = "23505";
const PG_EXCLUSION_VIOLATION = "23P01";

const CONFIRMATION_NO_ATTEMPTS = 5;

/**
 * Inserts the booking, retrying only on a confirmation-number collision.
 *
 * Returns { booking } on success, or { conflict: "slot" | "duplicate" } when the
 * failure is deterministic and retrying the webhook would never help.
 */
async function insertBooking(payload, businessName) {
  for (let attempt = 0; attempt < CONFIRMATION_NO_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...payload, confirmation_no: generateConfirmationNo(businessName) })
      .select()
      .single();

    if (!error) return { booking: data };

    // Another delivery of this same event won the race — nothing left to do.
    if (error.code === PG_UNIQUE_VIOLATION && error.message?.includes("stripe_session_id")) {
      return { conflict: "duplicate" };
    }

    // Someone else's payment already claimed this time range.
    if (error.code === PG_EXCLUSION_VIOLATION) {
      return { conflict: "slot" };
    }

    // Confirmation number collided — generate a new one and try again.
    if (error.code === PG_UNIQUE_VIOLATION && error.message?.includes("confirmation_no")) {
      continue;
    }

    throw new Error(`Booking insert failed: ${error.message}`);
  }

  throw new Error("Could not allocate a unique confirmation number");
}

/**
 * The customer paid but their slot was taken between checkout and webhook.
 * Give the money back before telling them — a failed email must not leave
 * a charge sitting on their card.
 */
async function refundAndApologise(session, metadata, config) {
  let refunded = false;

  if (session.payment_intent) {
    try {
      await stripe.refunds.create({
        payment_intent: session.payment_intent,
        reason: "requested_by_customer",
        metadata: { reason: "slot_taken_before_confirmation" },
      });
      refunded = true;
    } catch (err) {
      console.error(
        `URGENT: could not refund payment_intent ${session.payment_intent} for a double-booked slot. Refund manually.`,
        err
      );
    }
  }

  try {
    await sendSlotUnavailableRefund({ metadata, refunded, config });
  } catch (err) {
    console.error("Could not email the customer about their refunded booking:", err);
  }
}

// POST /webhooks/stripe
// Raw body is required for signature verification — this route must never sit
// behind body-parsing middleware.
app.post("/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  const rawBody = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return c.text("Webhook signature verification failed", 400);
  }

  if (event.type !== "checkout.session.completed") {
    // Nothing else affects bookings — expired sessions never created one.
    return c.text("OK");
  }

  const session = event.data.object;

  if (session.payment_status !== "paid") return c.text("OK");

  const m = session.metadata || {};

  // Guard against a session created outside this flow (or an older schema).
  const required = ["serviceId", "serviceName", "durationMin", "priceCents", "depositCents", "date", "startTime", "endTime", "customerName", "customerEmail", "customerPhone"];
  const missing = required.filter((k) => !m[k]);

  if (missing.length) {
    console.error(`Webhook session ${session.id} is missing metadata: ${missing.join(", ")}`);
    return c.text("OK");
  }

  // Fast path for Stripe's at-least-once delivery.
  const { data: existing, error: lookupErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (lookupErr) {
    console.error("Webhook duplicate check failed:", lookupErr);
    return c.text("Database error", 500); // retryable
  }

  if (existing) return c.text("OK");

  const config = await getConfig();

  let result;
  try {
    result = await insertBooking(
      {
        customer_name: m.customerName,
        customer_email: m.customerEmail,
        customer_phone: m.customerPhone,
        service_id: m.serviceId,
        service_name: m.serviceName,
        duration_min: parseInt(m.durationMin, 10),
        price_cents: parseInt(m.priceCents, 10),
        deposit_cents: parseInt(m.depositCents, 10),
        date: m.date,
        start_time: m.startTime,
        end_time: m.endTime,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        payment_status: "paid",
        status: "confirmed",
      },
      config.name
    );
  } catch (err) {
    // Genuinely unexpected — 500 so Stripe retries with backoff.
    console.error("Failed to write booking:", err);
    return c.text("Database error", 500);
  }

  if (result.conflict === "duplicate") return c.text("OK");

  if (result.conflict === "slot") {
    console.error(
      `Slot ${m.date} ${m.startTime}-${m.endTime} was taken before session ${session.id} could be confirmed. Refunding.`
    );
    await refundAndApologise(session, m, config);
    return c.text("OK"); // deterministic — retrying would conflict again
  }

  // Email failure must not fail the webhook; the booking is already confirmed.
  sendBookingConfirmation(result.booking).catch((err) =>
    console.error("Confirmation email failed:", err)
  );

  return c.text("OK");
});

export default app;
