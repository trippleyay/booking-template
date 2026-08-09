# Local Business Booking Template

A booking website for local service businesses — salons, barbers, clinics, gyms, tutors,
anyone who books appointments and wants a deposit up front.

Fork it, edit **one file**, add your photos, and deploy. No coding needed for the basics.

**What your customers get:** browse services, pick a date and time, pay a deposit by card,
receive a confirmation email with a link to cancel themselves.

**What you get:** an admin dashboard showing today's appointments and revenue, a full
bookings list you can cancel from, and a settings screen to change your colours, hours,
and prices without touching code.

---

## Before you start

You will need four free accounts. Budget about 30 minutes for the whole setup.

| Service | What it does | Free tier |
|---|---|---|
| [Supabase](https://supabase.com) | Database + your admin login | Yes |
| [Stripe](https://stripe.com) | Takes card payments | Yes (pay per transaction) |
| [Resend](https://resend.com) | Sends confirmation emails | Yes (100/day) |
| [Replit](https://replit.com) | Hosts the site | Yes |

You also need [Node.js](https://nodejs.org) 18 or newer if you want to run it on your own
machine first. You can skip that and work entirely in Replit if you prefer.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the database

1. Create a project at [supabase.com](https://supabase.com). Save the database password
   somewhere — you will not be shown it again.
2. Open **SQL Editor** in the sidebar, click **New query**.
3. Copy the entire contents of `supabase/schema.sql`, paste, and click **Run**.
   You should see "Success. No rows returned."
4. Go to **Authentication → Users → Add user**. Use an email you control and a strong
   password. This is how you will log into your admin panel.
5. Go to **Project Settings → API** and keep that tab open — you need three values from it
   in step 5.

> Re-running `schema.sql` later is safe. It only adds what is missing and never deletes data.

### 3. Set up payments

1. Create a [Stripe](https://stripe.com) account.
2. Leave **Test mode** switched on while you are building. Test cards work; real cards are
   not charged.
3. Go to **Developers → API keys** and copy your **Secret key** (`sk_test_…`).
4. Install the Stripe CLI so payments work on your own machine —
   [installation guide](https://stripe.com/docs/stripe-cli). On a Mac:
   ```bash
   brew install stripe/stripe-cli/stripe
   stripe login
   ```

### 4. Set up email

1. Create a [Resend](https://resend.com) account and an **API key**.
2. **Just testing?** Use `onboarding@resend.dev` as your sender. It works immediately but
   only delivers to the email address you signed up to Resend with.
3. **Going live?** Add your own domain under **Domains**, add the DNS records it shows you,
   wait for it to verify, then send from `bookings@yourdomain.com`.

Resend refuses to send from a domain you have not verified, so this step is not optional
once you have real customers.

### 5. Fill in your settings

```bash
cp .env.example .env
```

Open `.env` and fill in every value. Each one is commented in the file. Never commit this
file — it is already in `.gitignore`.

Two that catch people out:

- **`ADMIN_EMAIL`** must be *exactly* the email of the Supabase user you made in step 2.
  If they differ, you will log in successfully and then get "Forbidden" on every save.
- **`VITE_API_URL`** should be left **empty**. It only exists for unusual hosting setups.
  Filling it in will break the site on phones.

### 6. Run it

You need three terminals:

```bash
npm run dev            # terminal 1 — the website
npm run stripe:listen  # terminal 2 — payment notifications
```

`stripe listen` prints a secret starting `whsec_…`. Copy it into `STRIPE_WEBHOOK_SECRET`
in `.env`, then restart `npm run dev`.

Open **http://localhost:5173** — admin panel at **http://localhost:5173/admin**.

> **If you skip `stripe:listen`, bookings will never appear.** Payment succeeds, but
> nothing tells your site about it, so the confirmation page spins forever. This is the
> most common setup problem by far.

Test a booking with card `4242 4242 4242 4242`, any future expiry, any CVC.

---

## Making it yours

### The config file

Open **`businessConfig.js`**. This is the only file you need to edit. It controls:

- Your name, tagline, description, phone, email, address
- Colours, fonts, and corner roundness
- Your services — name, how long each takes, and the price
- Opening hours for each day
- How big a deposit to charge, and your cancellation window
- Social media links, gallery images, customer reviews

Everything is commented. A few worth understanding:

```js
timezone: "America/New_York",   // Your local timezone — see the note below
depositPercent: 30,             // Charge 30% up front, rest paid in person
cancellationHours: 24,          // Customers can self-cancel up to 24h before
minimumNoticeHours: 1,          // Nobody can book a slot starting within the hour
slotInterval: 15,               // Offer start times every 15 minutes
```

**Prices are in cents**, so `price: 3500` means £35.00 or $35.00. This avoids rounding
bugs. A price of `3500` with `depositPercent: 30` charges 1050 (£10.50) up front.

**Set your timezone properly.** Use a name from the
[IANA list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List) such as
`Europe/London` or `America/Chicago`. Hosted servers run on UTC, so leaving this wrong
means "today" is wrong and customers see the wrong slots.

**Closing a day:** set it to `null`.

```js
hours: {
  mon: { open: "09:00", close: "18:00" },
  sun: null,     // closed
},
```

### Your images and video

Put files in **`public/assets/`**. Note the paths in the config say `/assets/…` — the
`public` part is left out on purpose, because that is how the web server sees it.

| Config setting | File | Best size |
|---|---|---|
| `logo` | `logo.svg` | Any — it is scaled by height |
| `logoOnDark` | `logo-on-dark.svg` | A light version for the dark hero |
| `heroVideo` | `hero.webm`, `hero.mp4` | 1920×1080, under 3MB, **no sound** |
| `heroImage` | `hero.webp` | 1920×1080 |
| `gallery` | `gallery1.webp` … | Square, around 1200×1200 |

**Two logos, because one never works everywhere.** The header sits on a light background
and the hero sits over a dark image, so a single-colour logo disappears on one of them.
If you only have one, set both to the same file.

**About the hero video.** It plays automatically, silently, on a loop. If it cannot play —
missing file, unsupported format, or the visitor's phone is in Low Power Mode — the site
falls back to `heroImage`, and then to a plain gradient. Nothing ever looks broken.
Provide both `.webm` and `.mp4`: Safari often refuses WebM.

Keep it short and small. A 6–10 second loop under 3MB is plenty. Large videos make the
page slow on mobile data.

**Different filenames are fine** — just update the path in `businessConfig.js` to match.
The config decides, not the filename.

### The settings screen

Once running, log into `/admin` to change your business details, colours, opening hours,
and to block specific dates — all without editing code. These changes are saved to the
database and override `businessConfig.js`.

That means **once you change something in the admin panel, editing that value in the file
stops having an effect.** That is intentional, so a redeploy never wipes your settings.

---

## Deploying to Replit

1. Push your project to GitHub.
2. In Replit: **Create Repl → Import from GitHub**.
3. Open the **Secrets** panel (padlock icon) and add every variable from your `.env`.
   Your `.env` file is not in the repo, so this step is required.
4. Set `PUBLIC_URL` to your full Replit URL, e.g. `https://your-app.replit.app`.
5. Click **Run**, then **Deploy**.
6. Back in Stripe: **Developers → Webhooks → Add endpoint**.
   - URL: `https://your-app.replit.app/webhooks/stripe`
   - Event: `checkout.session.completed`
   - Copy the new signing secret into your Replit Secrets as `STRIPE_WEBHOOK_SECRET`.

That last secret is **different** from the one `stripe listen` gave you locally. Using the
local one in production means no bookings are ever created.

### Going live for real

- Switch Stripe out of Test mode and swap in your live `sk_live_…` key.
- Create a **new** webhook endpoint in live mode and use its signing secret.
- Verify your own domain with Resend and update `RESEND_FROM_EMAIL`.
- Change your admin password to something strong.

---

## How it works

```
src/            The website your customers see (React)
  pages/        One file per screen
  components/   Reusable pieces
  hooks/        Loads your config, applies your colours
server/         The API (Hono)
  routes/       Handles bookings, admin actions, Stripe notifications
  services/     Working out available times, sending email
supabase/       The database setup file
businessConfig.js   ← the file you edit
public/assets/      ← your images and video
```

### Payments

1. Customer picks a slot and fills in their details.
2. The server checks the slot is genuinely free and creates a Stripe Checkout session.
3. Customer pays on Stripe's own secure page. Their card details never touch this site.
4. Stripe notifies the server, which verifies the message is authentic.
5. **Only then** is the booking saved and the confirmation email sent.

The booking is created from Stripe's confirmation, never from the customer's browser
saying payment worked. Somebody closing the tab mid-payment cannot create a fake booking,
and nobody can book without paying.

### Double bookings

If two customers pay for the same slot at the same moment, the database rejects the second
one. That customer is **automatically refunded** and emailed an explanation, rather than
being left with a charge and no appointment.

---

## Troubleshooting

**"Forbidden" when saving settings**
`ADMIN_EMAIL` does not match your Supabase user's email. Check for typos and extra spaces,
then restart the server — environment variables are only read at startup.

**Booking never confirms, page spins forever**
`stripe listen` is not running, or `STRIPE_WEBHOOK_SECRET` is wrong. In production, check
your Stripe webhook points at the deployed URL and uses that endpoint's secret.

**Site loads on my laptop but not my phone**
`VITE_API_URL` should be empty. If it says `http://localhost:3001`, your phone tries to
call *itself*. Clear it and restart.

**No emails arriving**
Sending from an unverified domain. Use `onboarding@resend.dev` for testing — but it only
delivers to your own Resend signup address.

**Hero video will not play on iPhone**
Low Power Mode blocks autoplay. The site correctly shows your still image instead. Turn
Low Power Mode off to see the video.

**Wrong times, or "today" looks off by a day**
`timezone` in `businessConfig.js` is wrong or missing.

**`schema.sql` fails with an overlap error**
You have test bookings that overlap. Cancel one of each pair, then run it again. There is
a query at the bottom of `schema.sql` that finds them.

---

## Security

- Your browser never talks to the database directly. Everything goes through the server.
- Database access rules are locked down completely — a leaked public key grants nothing.
- Card details are handled entirely by Stripe and never reach this site.
- Payment notifications are cryptographically verified before anything is saved.
- Prices and deposits are always recalculated on the server, so they cannot be tampered with.
- `.env` is gitignored. **Never commit it or paste your keys anywhere public.**

If you accidentally expose a key, rotate it immediately in that service's dashboard.
