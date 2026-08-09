import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useConfig } from "../hooks/useConfig.jsx";
import { apiFetch } from "../lib/api.js";
import { formatMoney, formatTime } from "../lib/format.js";

// The webhook usually lands within a second or two, but Stripe makes no
// promise about delivery latency — poll for ~30s before falling back to
// "check your email".
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15;

export default function BookingSuccessPage() {
  const { config } = useConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [booking, setBooking] = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }

    let cancelled = false;

    // The booking only exists once Stripe's webhook has been delivered and
    // verified, so the success page polls rather than assuming it is there.
    // A 202 response carries { status: "pending" } and means "keep waiting".
    const poll = async (attempt) => {
      try {
        const data = await apiFetch(
          `/api/bookings/confirmation?session_id=${encodeURIComponent(sessionId)}`
        );

        if (cancelled) return;

        if (data.booking) {
          setBooking(data.booking);
          return;
        }

        if (attempt >= MAX_ATTEMPTS) {
          setError(
            "Your payment went through, but we're still finalising your booking. Your confirmation email will arrive shortly."
          );
          return;
        }

        setTimeout(() => {
          if (!cancelled) poll(attempt + 1);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "We couldn't reach the server to confirm your booking.");
        }
      }
    };

    poll(0);

    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  if (!config) return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">✉️</div>
          <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Check your email</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 text-white text-sm font-medium"
            style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Confirming your booking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto text-center">
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 text-3xl"
          style={{ background: "var(--secondary)" }}
        >
          ✓
        </div>

        <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          You're booked!
        </h1>
        <p className="text-base mb-2" style={{ color: "var(--text-muted)" }}>
          Confirmation sent to <strong>{booking.customer_email}</strong>
        </p>
        <p
          className="text-xs font-mono mb-10 px-3 py-1 rounded-full inline-block"
          style={{ background: "var(--surface)", color: "var(--text-muted)" }}
        >
          {booking.confirmation_no}
        </p>

        {/* Booking details */}
        <div
          className="p-6 border text-left mb-8"
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <div className="space-y-4 text-sm">
            {[
              ["Service",     booking.service_name],
              ["Date",        format(parseISO(booking.date), "EEEE, MMMM d, yyyy")],
              ["Time",        formatTime(booking.start_time.slice(0, 5))],
              ["Duration",    `${booking.duration_min} min`],
              ["Deposit paid", formatMoney(booking.deposit_cents, config.currency)],
              ["Balance due at appointment", formatMoney(booking.price_cents - booking.deposit_cents, config.currency)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-start gap-4">
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Need to cancel? Check your email for a cancellation link. Cancellations must be made at least {config.cancellationHours} hours before your appointment.
        </p>

        <button
          onClick={() => navigate("/")}
          className="px-8 py-3 text-white font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
        >
          Back to {config.name}
        </button>
      </div>
    </div>
  );
}
