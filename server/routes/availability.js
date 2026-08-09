import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getAvailableSlots } from "../services/availability.js";
import { getService } from "../services/config.js";

const app = new Hono();

// GET /api/availability?date=2026-08-20&serviceId=haircut
app.get(
  "/",
  zValidator(
    "query",
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
      serviceId: z.string().min(1),
    })
  ),
  async (c) => {
    const { date, serviceId } = c.req.valid("query");

    const service = await getService(serviceId);
    if (!service) return c.json({ error: "Unknown service" }, 400);

    // Past dates, closed days and already-passed times are all handled
    // inside the availability engine so this route and checkout agree.
    const slots = await getAvailableSlots(date, service.duration);

    return c.json({ slots });
  }
);

export default app;
