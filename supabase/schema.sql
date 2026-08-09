-- ============================================================
-- Lumé Studio Booking Template — Supabase Schema
-- Run this in your Supabase project's SQL editor.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

create extension if not exists "pgcrypto";

-- Lets an exclusion constraint mix an equality column with a range operator,
-- which is what stops two paid bookings claiming the same time.
create extension if not exists "btree_gist";

-- ============================================================
-- BOOKINGS
-- ============================================================
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  confirmation_no text unique not null,   -- human-readable e.g. LS-20260810-K7QM4

  -- Customer info
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text not null,

  -- Service
  service_id      text not null,          -- matches businessConfig.services[].id
  service_name    text not null,          -- denormalized so history survives config edits
  duration_min    int  not null,
  price_cents     int  not null,          -- full service price
  deposit_cents   int  not null,          -- amount charged at booking

  -- Timing (wall-clock in the business's timezone)
  date            date not null,
  start_time      time not null,
  end_time        time not null,

  -- Payment
  stripe_session_id      text unique,
  stripe_payment_intent  text,
  payment_status         text not null default 'pending',

  -- Booking status
  status          text not null default 'confirmed',

  cancelled_at    timestamptz,
  cancelled_by    text,
  cancel_reason   text,

  -- Sent in the confirmation email so the customer can self-cancel
  cancel_token    uuid not null default gen_random_uuid(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- CONSTRAINTS
-- Added separately so this file stays re-runnable against a
-- database created by an earlier version of the template.
-- ============================================================
do $$
begin
  -- Status vocabularies. Without these, a typo in application code silently
  -- writes a status nothing queries for, and the booking vanishes from every list.
  if not exists (select 1 from pg_constraint where conname = 'bookings_status_check') then
    alter table bookings add constraint bookings_status_check
      check (status in ('confirmed', 'cancelled', 'completed', 'no_show'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_payment_status_check') then
    alter table bookings add constraint bookings_payment_status_check
      check (payment_status in ('pending', 'paid', 'refunded'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_cancelled_by_check') then
    alter table bookings add constraint bookings_cancelled_by_check
      check (cancelled_by is null or cancelled_by in ('admin', 'customer'));
  end if;

  -- Money and duration must be sane.
  if not exists (select 1 from pg_constraint where conname = 'bookings_amounts_check') then
    alter table bookings add constraint bookings_amounts_check
      check (
        price_cents   >= 0 and
        deposit_cents >= 0 and
        deposit_cents <= price_cents and
        duration_min  >  0
      );
  end if;

  -- An appointment must end after it starts.
  if not exists (select 1 from pg_constraint where conname = 'bookings_time_order_check') then
    alter table bookings add constraint bookings_time_order_check
      check (end_time > start_time);
  end if;

  -- Tightened after the first release: the create table above is skipped on an
  -- existing database, so bring its column up to date here too.
  if exists (
    select 1 from information_schema.columns
    where table_name = 'bookings'
      and column_name = 'cancel_token'
      and is_nullable = 'YES'
  ) then
    update bookings set cancel_token = gen_random_uuid() where cancel_token is null;
    alter table bookings alter column cancel_token set not null;
  end if;

  -- THE double-booking guard.
  --
  -- The application checks availability before creating a Stripe session, but
  -- two customers can pass that check seconds apart and both pay. Only the
  -- database can settle it. '[)' bounds mean a 10:00-11:00 booking does not
  -- collide with an 11:00-12:00 one.
  --
  -- Cancelled and no-show bookings are excluded, so their slots free up.
  --
  -- NOTE: if this fails on an existing database you already have overlapping
  -- rows. Find them with the query at the bottom of this file, resolve them,
  -- then re-run.
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap') then
    alter table bookings add constraint bookings_no_overlap
      exclude using gist (
        tsrange("date" + start_time, "date" + end_time) with &&
      )
      where (status in ('confirmed', 'completed'));
  end if;
end $$;

-- Indexes for common queries
create index if not exists bookings_date_idx         on bookings (date);
create index if not exists bookings_status_idx       on bookings (status);
create index if not exists bookings_email_idx        on bookings (customer_email);
create index if not exists bookings_stripe_idx       on bookings (stripe_session_id);
create index if not exists bookings_date_status_idx  on bookings (date, status);
create index if not exists bookings_cancel_token_idx on bookings (cancel_token);

-- ============================================================
-- BLOCKED DATES — whole days the business is closed
-- ============================================================
create table if not exists blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  date       date unique not null,
  reason     text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BLOCKED SLOTS — individual time ranges on a specific date
-- ============================================================
create table if not exists blocked_slots (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  start_time time not null,
  end_time   time not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists blocked_slots_date_idx on blocked_slots (date);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blocked_slots_time_order_check') then
    alter table blocked_slots add constraint blocked_slots_time_order_check
      check (end_time > start_time);
  end if;
end $$;

-- ============================================================
-- SETTINGS
-- Runtime overrides for businessConfig.js values, written by the
-- admin Settings screen. The server merges these over the file at
-- request time (DB wins) — see server/services/config.js.
-- ============================================================
create table if not exists settings (
  key        text primary key,
  value      text not null,              -- JSON-stringified
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
--
-- Deliberately stricter than "public can insert a booking": the
-- browser never talks to Postgres at all. Every read and write
-- goes through the Hono server using the service role key, which
-- bypasses RLS.
--
-- That means bookings can only be created by a verified Stripe
-- webhook — there is no client-reachable path that writes one.
-- RLS is enabled with NO permissive policies, so even if the anon
-- key leaks, it grants nothing on these tables.
-- ============================================================
alter table bookings      enable row level security;
alter table blocked_dates enable row level security;
alter table blocked_slots enable row level security;
alter table settings      enable row level security;

-- Belt and braces: force RLS so even the table owner is subject to it.
alter table bookings      force row level security;
alter table blocked_dates force row level security;
alter table blocked_slots force row level security;
alter table settings      force row level security;

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

-- ============================================================
-- TROUBLESHOOTING
--
-- If bookings_no_overlap fails to apply, list the offending rows:
--
--   select a.id, a.confirmation_no, a.date, a.start_time, a.end_time,
--          b.id, b.confirmation_no, b.start_time, b.end_time
--   from bookings a
--   join bookings b
--     on a.id < b.id
--    and a.date = b.date
--    and a.start_time < b.end_time
--    and a.end_time > b.start_time
--   where a.status in ('confirmed','completed')
--     and b.status in ('confirmed','completed');
--
-- Cancel or correct one side of each pair, then re-run this file.
-- ============================================================
