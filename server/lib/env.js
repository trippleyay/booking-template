// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================
// Imported once, before anything else touches process.env.
// Fails loudly at boot with every problem listed at once —
// never silently starts and dies on the first real booking.
// ============================================================

const REQUIRED = [
  {
    key: "SUPABASE_URL",
    hint: "Supabase dashboard > Project Settings > API > Project URL",
    check: (v) => v.startsWith("http") || "must be a URL (https://xxx.supabase.co)",
  },
  {
    key: "SUPABASE_ANON_KEY",
    hint: "Supabase dashboard > Project Settings > API > anon public key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    hint: "Supabase dashboard > Project Settings > API > service_role key (server only)",
  },
  {
    key: "STRIPE_SECRET_KEY",
    hint: "dashboard.stripe.com > Developers > API keys > Secret key",
    check: (v) => v.startsWith("sk_") || "must start with sk_ (you may have used the publishable key)",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    hint: "Output of `npm run stripe:listen`, or Stripe dashboard > Webhooks > Signing secret",
    check: (v) => v.startsWith("whsec_") || "must start with whsec_ (this is not your secret key)",
  },
  {
    key: "RESEND_API_KEY",
    hint: "resend.com > API Keys",
    check: (v) => v.startsWith("re_") || "must start with re_",
  },
  {
    key: "RESEND_FROM_EMAIL",
    hint: 'A sender on a domain you verified with Resend. Plain "you@example.com" or "Your Name <you@example.com>". Before verifying a domain, use onboarding@resend.dev',
    check: (v) => {
      // Accept both a bare address and the "Display Name <addr>" form.
      const addr = v.match(/<([^>]+)>\s*$/)?.[1] ?? v;
      return (
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr.trim()) ||
        'must be a valid email address, optionally as "Name <you@example.com>"'
      );
    },
  },
  {
    key: "ADMIN_EMAIL",
    hint: "The email of the Supabase Auth user allowed into /admin",
    check: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || "must be a valid email address",
  },
  {
    key: "PUBLIC_URL",
    hint: "Where the app is reachable — http://localhost:5173 in dev, your .replit.app URL in production",
    check: (v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return "must be an absolute URL including protocol (https://...)";
      }
    },
  },
];

function validate() {
  const missing = [];
  const invalid = [];

  for (const { key, hint, check } of REQUIRED) {
    const value = process.env[key];

    if (!value || !value.trim()) {
      missing.push({ key, hint });
      continue;
    }

    if (check) {
      const result = check(value.trim());
      if (result !== true) invalid.push({ key, hint, reason: result });
    }
  }

  if (!missing.length && !invalid.length) return;

  const lines = ["", "Cannot start — your environment is not configured.", ""];

  if (missing.length) {
    lines.push(`Missing ${missing.length} required variable${missing.length > 1 ? "s" : ""}:`);
    for (const { key, hint } of missing) lines.push(`  ${key}`, `      ${hint}`);
    lines.push("");
  }

  if (invalid.length) {
    lines.push(`Invalid ${invalid.length} variable${invalid.length > 1 ? "s" : ""}:`);
    for (const { key, hint, reason } of invalid) lines.push(`  ${key} — ${reason}`, `      ${hint}`);
    lines.push("");
  }

  lines.push("Copy .env.example to .env and fill in every value, then restart.", "");

  throw new Error(lines.join("\n"));
}

validate();

// PUBLIC_URL is used to build Stripe redirect targets and email links.
// Trailing slashes produce doubled slashes in those URLs, so normalise once.
export const PUBLIC_URL = process.env.PUBLIC_URL.trim().replace(/\/+$/, "");

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
