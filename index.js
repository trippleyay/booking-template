import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import app from "./server/index.js";

const port = parseInt(process.env.PORT || "3001");

// In production, Hono serves the Vite build from /dist
// In development, Vite dev server handles the client (proxied)
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("/*", serveStatic({ path: "./dist/index.html" }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on port ${port}`);
});
