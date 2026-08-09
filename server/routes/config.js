import { Hono } from "hono";
import { getConfig } from "../services/config.js";

const app = new Hono();

// Keys that must never reach the browser. businessConfig.js is currently all
// public, but a forker adding a private value shouldn't leak it by accident.
const PRIVATE_KEYS = new Set(["adminEmail", "apiKeys", "secrets", "webhookSecret"]);

// GET /api/config
// businessConfig.js merged with any admin Settings overrides (DB wins).
// The frontend reads this and never the raw file, which is what lets the
// Settings screen rebrand a live site without a redeploy.
app.get("/", async (c) => {
  const config = await getConfig();

  const publicConfig = Object.fromEntries(
    Object.entries(config).filter(([key]) => !PRIVATE_KEYS.has(key))
  );

  // Config changes are rare and the client caches them anyway; a short
  // shared cache keeps a busy landing page off the database.
  c.header("Cache-Control", "public, max-age=30");

  return c.json({ config: publicConfig });
});

export default app;
