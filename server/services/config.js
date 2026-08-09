// ============================================================
// RUNTIME CONFIG
// ============================================================
// businessConfig.js is the forker's source of truth, but the admin
// Settings screen writes overrides to the `settings` table. Anything
// server-side that reads business values must read the MERGED result
// — otherwise Settings appears to work while slot generation and
// deposit pricing quietly keep using the file.
//
// Cached briefly so the booking flow doesn't hit the DB per slot
// lookup; writes invalidate immediately.
// ============================================================

import { supabase } from "../lib/supabase.js";
import { businessConfig } from "../../businessConfig.js";

const TTL_MS = 30_000;

let cached = null;
let cachedAt = 0;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merges DB overrides over the file config.
 * Objects (theme, hours, socials) merge one level deep so a partial save
 * doesn't wipe sibling keys. Arrays and scalars replace outright.
 */
function merge(base, overrides) {
  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    result[key] =
      isPlainObject(value) && isPlainObject(base[key])
        ? { ...base[key], ...value }
        : value;
  }

  return result;
}

export async function getConfig() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const { data, error } = await supabase.from("settings").select("key, value");

  if (error) {
    // Never let a settings-table hiccup take down booking — fall back to file
    console.error("Failed to load settings overrides, using businessConfig.js:", error.message);
    return businessConfig;
  }

  const overrides = {};
  for (const row of data || []) {
    try {
      overrides[row.key] = JSON.parse(row.value);
    } catch {
      overrides[row.key] = row.value;
    }
  }

  cached = merge(businessConfig, overrides);
  cachedAt = Date.now();

  return cached;
}

export function invalidateConfigCache() {
  cached = null;
  cachedAt = 0;
}

/** Looks up a service by id in the live config. */
export async function getService(serviceId) {
  const config = await getConfig();
  return (config.services || []).find((s) => s.id === serviceId) || null;
}
