import { Resend } from "resend";
import { PUBLIC_URL } from "../lib/env.js";
import { getConfig } from "./config.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL;

/**
 * Customer-supplied values land inside HTML templates, so they must be
 * escaped — a name containing "<" would otherwise break the layout, and
 * an injected tag would render in the recipient's mail client.
 */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

/** "2026-08-10" -> "Monday, August 10, 2026", read as a plain calendar date. */
function formatDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "14:30:00" -> "2:30 PM" */
function formatTime(timeStr) {
  const [h, m] = String(timeStr).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

async function send({ to, subject, html }) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });

  if (error) {
    // Never throw into a booking flow — the booking stands regardless of email.
    console.error(`Email "${subject}" to ${to} failed:`, error);
    return false;
  }

  return true;
}

// ─── Public senders ───────────────────────────────────────────────────────────

export async function sendBookingConfirmation(booking) {
  const config = await getConfig();

  return send({
    to: booking.customer_email,
    subject: `Booking confirmed — ${booking.service_name} at ${config.name}`,
    html: confirmationEmailHtml({
      name: booking.customer_name,
      service: booking.service_name,
      date: formatDate(booking.date),
      time: formatTime(booking.start_time),
      confirmationNo: booking.confirmation_no,
      deposit: formatMoney(booking.deposit_cents, config.currency),
      total: formatMoney(booking.price_cents, config.currency),
      balance: formatMoney(booking.price_cents - booking.deposit_cents, config.currency),
      cancelUrl: `${PUBLIC_URL}/cancel/${booking.cancel_token}`,
      config,
    }),
  });
}

export async function sendCancellationNotice(booking, cancelledBy = "admin") {
  const config = await getConfig();

  return send({
    to: booking.customer_email,
    subject: `Booking cancelled — ${booking.service_name} at ${config.name}`,
    html: cancellationEmailHtml({
      name: booking.customer_name,
      service: booking.service_name,
      date: formatDate(booking.date),
      time: formatTime(booking.start_time),
      confirmationNo: booking.confirmation_no,
      cancelledBy,
      config,
    }),
  });
}

/**
 * Sent when a customer paid but the slot was claimed first. `refunded` is
 * false only if the Stripe refund itself failed, in which case the copy has
 * to promise a manual follow-up rather than a completed refund.
 */
export async function sendSlotUnavailableRefund({ metadata, refunded, config }) {
  return send({
    to: metadata.customerEmail,
    subject: `We couldn't confirm your booking — ${config.name}`,
    html: refundEmailHtml({
      name: metadata.customerName,
      service: metadata.serviceName,
      date: formatDate(metadata.date),
      time: formatTime(metadata.startTime),
      amount: formatMoney(parseInt(metadata.depositCents, 10), config.currency),
      refunded,
      config,
    }),
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

const shell = (accent, heading, subheading, body, config) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:12px;overflow:hidden;max-width:100%;">
        <tr><td style="background:${accent};padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">${esc(config.name)}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${heading}</p>
        </td></tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          ${config.address ? `<p style="margin:0;font-size:12px;color:#9ca3af;">${esc(config.address)}</p>` : ""}
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${esc(config.phone)} · ${esc(config.email)}</p>
          ${subheading}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const row = (label, value, shaded) => `
  <tr${shaded ? ' style="background:#f9fafb;"' : ""}>
    <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${label}</td>
    <td style="padding:12px 16px;font-size:14px;color:#1a1a1a;">${value}</td>
  </tr>`;

const detailTable = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
    ${rows.map((r, i) => row(r[0], r[1], i % 2 === 0)).join("")}
  </table>`;

function confirmationEmailHtml({ name, service, date, time, confirmationNo, deposit, total, balance, cancelUrl, config }) {
  const body = `
    <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;">Hi ${esc(name)},</p>
    <p style="margin:0 0 24px;color:#374151;">Your booking is confirmed. See you soon!</p>
    ${detailTable([
      ["Service", esc(service)],
      ["Date", esc(date)],
      ["Time", esc(time)],
      ["Deposit paid", esc(deposit)],
      ["Balance at appointment", esc(balance)],
      ["Total", esc(total)],
      ["Confirmation #", `<span style="font-family:monospace;">${esc(confirmationNo)}</span>`],
    ])}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Need to cancel? You can do so up to ${esc(config.cancellationHours)} hours before your appointment.</p>
    <a href="${esc(cancelUrl)}" style="font-size:13px;color:${esc(config.theme.primary)};">Cancel this booking</a>`;

  return shell(config.theme.primary, "Booking Confirmed", "", body, config);
}

function cancellationEmailHtml({ name, service, date, time, confirmationNo, cancelledBy, config }) {
  const body = `
    <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;">Hi ${esc(name)},</p>
    <p style="margin:0 0 24px;color:#374151;">${
      cancelledBy === "admin"
        ? `Your booking has been cancelled by ${esc(config.name)}. We're sorry for the inconvenience — please contact us to rebook.`
        : "Your booking has been cancelled as requested."
    }</p>
    ${detailTable([
      ["Service", esc(service)],
      ["Date", esc(date)],
      ["Time", esc(time)],
      ["Confirmation #", `<span style="font-family:monospace;">${esc(confirmationNo)}</span>`],
    ])}
    <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Contact us at ${esc(config.email)} or ${esc(config.phone)}.</p>`;

  return shell("#6b7280", "Booking Cancelled", "", body, config);
}

function refundEmailHtml({ name, service, date, time, amount, refunded, config }) {
  const body = `
    <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;">Hi ${esc(name)},</p>
    <p style="margin:0 0 24px;color:#374151;">
      We're sorry — the time you chose was booked by someone else moments before your payment completed,
      so we weren't able to confirm your appointment.
    </p>
    ${detailTable([
      ["Service", esc(service)],
      ["Requested date", esc(date)],
      ["Requested time", esc(time)],
      ["Deposit", esc(amount)],
    ])}
    <p style="margin:0 0 16px;color:#374151;">${
      refunded
        ? `Your ${esc(amount)} deposit has been refunded in full and should reach your account within 5–10 business days.`
        : `We're processing a full refund of your ${esc(amount)} deposit and will be in touch shortly to confirm it.`
    }</p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">We'd love to get you booked in — pick another time whenever you're ready.</p>
    <a href="${esc(PUBLIC_URL)}/booking" style="font-size:13px;color:${esc(config.theme.primary)};">Choose another time</a>`;

  return shell(config.theme.primary, "Booking Not Confirmed", "", body, config);
}
