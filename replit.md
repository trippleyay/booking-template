# Project Overview

A **booking website template for local service businesses** — salons, barbers, clinics,
gyms, tutors. A business owner forks it, edits one config file, drops in their images,
sets environment variables, and has a working site that takes deposits.

Customers pick a service, choose a slot, pay a deposit through Stripe Checkout, and get
a confirmation email with a self-service cancellation link. The owner gets an admin area
to see bookings, edit settings, and block dates.

**Tech stack**

- React 18 + Vite 6 (plain JavaScript with JSX — **not** TypeScript)
- React Router 7, TanStack Query 5, Tailwind CSS 3
- Hono 4 on Node (API server), Zod 3 for request validation
- Supabase (PostgreSQL + Auth)
- Stripe Checkout (hosted payment page)
- Resend (transactional email)
- date-fns 4 for date handling
- npm as the package manager (`package-lock.json` is committed — do not switch to yarn or pnpm)

In development the Vite dev server (5173) proxies `/api` and `/webhooks` to Hono (3001).
In production `npm run build` emits `dist/`, and `index.js` has Hono serve those static
files **and** the API on a single port. That is what Replit runs.

---

## The one rule that matters most

**`businessConfig.js` is the only file a business owner should ever need to edit.**

Every business-specific value — name, tagline, contacts, colours, fonts, services,
prices, opening hours, deposit percentage, timezone, socials, gallery, reviews — lives
there. Nothing business-specific belongs anywhere else in the codebase.

When adding a feature, ask: "would a different business want a different value here?"
If yes, it becomes a config key with a sensible default and an explanatory comment,
never a literal in a component.

```js
// Wrong — the next business that forks this now has to hunt through components
<h1 className="text-4xl">Lumé Studio</h1>
<div style={{ background: "#C084FC" }}>

// Right
const { config } = useConfig();
<h1 className="text-4xl">{config.name}</h1>
<div style={{ background: "var(--primary)" }}>
```

---

## Architecture

```
businessConfig.js        The only file a forker edits. Defaults for everything.
index.js                 Production entry: serves dist/ + mounts the API.
replit.md                This file.

src/
  App.jsx                Routes. Blocks render until /api/config resolves.
  main.jsx               React root, QueryClient, Toaster.
  index.css              Tailwind entry + CSS custom property defaults.
  pages/                 One file per public route (LandingPage, BookingPage,
                         BookingSuccessPage, CancelPage).
  pages/admin/           AdminLoginPage, AdminDashboardPage, AdminBookingsPage,
                         AdminSettingsPage.
  components/admin/      AdminLayout, RequireAdmin.
  hooks/                 useConfig (fetches /api/config), useTheme (applies CSS
                         vars), useAdmin (Supabase auth session).
  lib/                   api.js (fetch wrapper), format.js (money/time display).

server/
  index.js               Hono app; CORS, route mounting, global error handler.
  routes/                config.js, availability.js, bookings.js, admin.js,
                         webhooks.js
  services/              availability.js (slot engine), config.js (merged
                         runtime config), email.js (Resend templates)
  middleware/auth.js     requireAdmin — verifies JWT, checks ADMIN_EMAIL
  lib/                   env.js (boot validation), time.js (timezone maths),
                         supabase.js, stripe.js, confirmationNo.js

supabase/schema.sql      Tables, constraints, indexes, RLS. Run this first.
public/assets/           Logo, hero image/video, gallery images.
```

There is currently no `components/ui/` directory — page-level components hold their own
markup, and shared pieces live beside the pages that use them. If you extract reusable
primitives, `src/components/ui/` is the right home, but do not assume it already exists.

### Data flow for configuration

`businessConfig.js` holds **defaults**. The admin Settings screen writes overrides into a
`settings` table, and `server/services/config.js` merges them with the DB winning.

The frontend never imports `businessConfig.js`. It calls `GET /api/config` via the
`useConfig` hook. That is what lets an owner rebrand a live site without a redeploy.

```js
// Server code — always read through the service, never the raw file
import { getConfig } from "../services/config.js";
const config = await getConfig();     // includes admin overrides

// Wrong — silently ignores everything the owner set in the admin panel
import { businessConfig } from "../../businessConfig.js";
```

Theme values become CSS custom properties at runtime (`useTheme`), so components style
off `var(--primary)`, `var(--surface)`, `var(--radius)` and never hold hex codes.

---

## Invariants — do not break these

These encode real bugs that were found and fixed. Changing them reintroduces the bug.

**1. Only the verified Stripe webhook may create a booking.**
The client is never trusted to say "payment succeeded". `POST /webhooks/stripe` verifies
the Stripe signature against the **raw** request body, then inserts the row. The success
page polls `GET /api/bookings/confirmation`, which returns **202** until the webhook has
landed. Never write a booking from a client-side signal, and never add body-parsing
middleware ahead of the webhook route — it needs the untouched raw body.

**2. Never trust the client for anything derivable.**
The checkout request accepts only `serviceId`, `date`, `startTime`, and customer details.
Duration, end time, price, and deposit are all recomputed on the server from config.

```js
// Wrong — lets a caller book a 5-minute slot for a 2-hour service, or pay a 1¢ deposit
const { endTime, priceCents, depositCents } = c.req.valid("json");

// Right
const service = config.services.find((s) => s.id === serviceId);
const endTime = addMinutes(startTime, service.duration);
const depositCents = Math.round(service.price * (config.depositPercent / 100));
```

**3. The browser never touches PostgreSQL directly.**
RLS is enabled on every table with **no policies at all**, so the anon key can read
nothing. All data access goes through Hono using the service-role key. If a client query
returns zero rows, that is the design working — do **not** "fix" it by adding a permissive
RLS policy. Add or use a server route instead.

**4. All dates and times go through `server/lib/time.js`.**
The business timezone comes from `config.timezone`. A deployed container runs in UTC, so
host-clock date maths silently books the wrong day.

```js
// Wrong — this is "today" in UTC, not in the salon's timezone
const today = new Date().toISOString().slice(0, 10);

// Right
import { todayInTz, nowInTz } from "../lib/time.js";
const today = todayInTz(config.timezone);
```

**5. The database prevents double-booking, not just the application code.**
`supabase/schema.sql` has an exclusion constraint (`bookings_no_overlap`) that makes two
overlapping active bookings physically impossible. Two customers paying at the same instant
will race past any application-level check. If an insert fails with `23P01`, that is the
constraint doing its job — surface a friendly "slot just taken" message. Never drop the
constraint to make an error go away.

**6. Money is integer cents. Never floats.**
`price: 3500` is £35.00. Use `Math.round` when taking percentages, and format for display
only at the very edge, via `src/lib/format.js`.

**7. `VITE_` prefixed variables are public.**
Vite inlines them into the browser bundle. Only the Supabase **anon** key and the Stripe
**publishable** key may carry that prefix. The service-role key, Stripe secret key, and
Resend key must never be `VITE_`-prefixed.

**8. Leave `VITE_API_URL` empty.**
Empty means requests go to the same origin, which is what makes the site work on a phone
and behind Replit's proxy. Hardcoding `http://localhost:3001` breaks every device except
the dev machine.

**9. New required environment variables must be registered in `server/lib/env.js`.**
The server validates env at boot and exits with an actionable message listing what is
missing. A variable read with `process.env.FOO` but absent from that list will fail
confusingly at runtime instead of clearly at startup.

**10. Every route validates its input with Zod.**
Use `@hono/zod-validator`. Admin write routes additionally use `requireAdmin`.

```js
routes.post("/checkout", zValidator("json", checkoutSchema), async (c) => { … });
routes.put("/settings", requireAdmin, zValidator("json", settingsSchema), async (c) => { … });
```

---

## Coding style

- **Plain JavaScript with JSX. Do not introduce TypeScript** — no `.ts`/`.tsx` files, no
  type annotations. The project is deliberately JS so that forkers with modest experience
  can edit it.
- ES modules everywhere (`import`/`export`). The package is `"type": "module"`.
- Functional React components with hooks. No class components.
- Named exports for components: `export function Button() {}`.
- Tailwind classes for layout, spacing, and typography. For themeable colours use an
  inline style referencing a CSS variable — that is the established pattern here, and the
  one exception to avoiding inline styles:
  ```jsx
  <div className="rounded-lg p-4" style={{ background: "var(--surface)" }}>
  ```
- Server errors: throw `HTTPException` with a message safe to show a customer. The global
  handler in `server/index.js` logs details server-side and returns a generic message in
  production, so internals never leak.
- Comments explain **why**, not what. Do not narrate obvious code.
- Reuse `src/components/ui/` primitives rather than restyling raw elements.
- Keep the customer-facing copy plain and warm. No emoji in the UI.

---

## Accessibility

The template is used by real businesses with real customers, so this is not optional.

- Every interactive element must be reachable and operable by keyboard.
- Icon-only buttons need an `aria-label`.
- Selected states (time slots, service cards) need `aria-pressed` or `aria-selected` —
  colour alone is not enough.
- Modals trap focus, close on `Escape`, and restore focus to the trigger on close.
- Form errors are associated with their input and announced, not just coloured red.
- Body text must clear 4.5:1 contrast against its background.

---

## Local development

```bash
npm install
cp .env.example .env      # then fill it in
# run supabase/schema.sql in the Supabase SQL editor
npm run dev               # client on 5173, server on 3001
npm run stripe:listen     # separate terminal — needed for bookings to be created
```

Without `stripe:listen`, payment succeeds but no booking row is ever written, because the
webhook never arrives. The confirmation page will poll and stay pending. This is the single
most common local-setup confusion.

## Deploying on Replit

- `.replit` is configured: build runs `npm run build && npm start`, and port 3001 maps to 80.
- **Set every variable from `.env.example` in Replit's Secrets panel.** `.env` is
  gitignored and will not be in the repo.
- `PUBLIC_URL` must be the full `https://…replit.app` URL. Stripe redirects and the
  cancellation links in emails are built from it, so a stale value sends customers
  to the wrong place.
- `ADMIN_EMAIL` must exactly match the email of the Supabase Auth user who signs in.
  A mismatch produces a valid login followed by `403 Forbidden` on every admin write.
- Point the Stripe webhook at `https://your-app.replit.app/webhooks/stripe` and put that
  endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`. The CLI secret from
  `stripe:listen` is a different value and will not verify in production.
- `RESEND_FROM_EMAIL` must be on a domain verified with Resend. Before verifying one,
  `onboarding@resend.dev` works but only delivers to the Resend account holder.

## Things deliberately left out

Not oversights — scope decisions. Ask before adding.

- **Single admin only.** Access is one email compared against `ADMIN_EMAIL`. No roles,
  no staff accounts.
- **No per-staff calendars.** Availability is modelled for one chair or one room.
- **Services and gallery are file-only.** Editable in `businessConfig.js`, deliberately
  not in the admin UI, since changing a price mid-booking has consequences worth thinking
  through.
- **Reviews are static** in config. No review submission or moderation.
- **No recurring or group bookings.**
