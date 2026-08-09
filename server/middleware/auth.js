import { createClient } from "@supabase/supabase-js";

// Anon client used only to verify the JWT from the request header
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Hono middleware that verifies a Supabase session token.
 * Attach to all /api/admin/* routes.
 * The client sends the token as: Authorization: Bearer <access_token>
 */
export async function requireAdmin(c, next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorised" }, 401);
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return c.json({ error: "Unauthorised" }, 401);
  }

  // Only the configured admin email can access admin routes.
  // Compared case-insensitively — mail providers treat the local part as
  // case-insensitive in practice, and Supabase stores whatever was typed.
  const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();

  if (data.user.email?.trim().toLowerCase() !== adminEmail) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("user", data.user);
  await next();
}
