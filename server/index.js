import "dotenv/config";
// Validates every required variable and fails loudly. Must run before any
// module that reads process.env at import time.
import { IS_PRODUCTION, PUBLIC_URL } from "./lib/env.js";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import availabilityRoutes from "./routes/availability.js";
import bookingRoutes from "./routes/bookings.js";
import webhookRoutes from "./routes/webhooks.js";
import adminRoutes from "./routes/admin.js";
import configRoutes from "./routes/config.js";

const app = new Hono();

// Request logging is useful in development but is pure noise (and disk churn)
// on a small production container.
if (!IS_PRODUCTION) app.use("*", logger());

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // Same-origin requests carry no Origin header — in production the client
      // is served by this very process, so this is the normal path.
      if (!origin) return origin;

      if (!IS_PRODUCTION && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return origin;
      }

      // Fail closed: only the configured public origin is allowed. Returning
      // the caller's own origin here would allow every site on the internet.
      return origin === PUBLIC_URL ? origin : null;
    },
    credentials: true,
  })
);

app.route("/api/availability", availabilityRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/config", configRoutes);
app.route("/webhooks", webhookRoutes);

app.get("/health", (c) => c.json({ ok: true }));

// Catch-all so an unexpected throw returns JSON instead of crashing the
// process or leaking a stack trace to the client.
app.onError((err, c) => {
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
