import { randomBytes } from "node:crypto";
import { today } from "./time.js";

// Crockford-ish alphabet: no I, L, O, 0 or 1, so confirmation numbers
// survive being read down the phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RANDOM_LENGTH = 5;

/** Business initials, stripped of accents and punctuation. */
function initialsFor(businessName) {
  const cleaned = String(businessName || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3);

  return cleaned || "BK";
}

/**
 * Human-readable confirmation number, e.g. LS-20260810-K7QM4.
 *
 * Uses crypto rather than Math.random: the column is UNIQUE, so a collision
 * costs a failed insert, and Math.random().toString(36) can also return
 * fewer characters than asked for.
 */
export function generateConfirmationNo(businessName) {
  const bytes = randomBytes(RANDOM_LENGTH);

  let random = "";
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    random += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `${initialsFor(businessName)}-${today().replace(/-/g, "")}-${random}`;
}
