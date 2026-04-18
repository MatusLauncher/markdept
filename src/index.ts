import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { startScheduler } from "./services/scheduler";
import authRouter from "./routes/auth";
import campaignsRouter from "./routes/campaigns";
import postsRouter from "./routes/posts";
import platformsRouter from "./routes/platforms";
import analyticsRouter from "./routes/analytics";
import { config } from "./config";

const app = new Hono();

app.route("/auth", authRouter);
app.route("/api/campaigns", campaignsRouter);
app.route("/api/posts", postsRouter);
app.route("/api/platforms", platformsRouter);
app.route("/api/analytics", analyticsRouter);

// Serve static assets from Vite build
app.use("/assets/*", serveStatic({ root: "./dist" }));
app.use("/favicon.ico", serveStatic({ path: "./dist/favicon.ico" }));

// SPA fallback — serve index.html for all non-API routes
app.get("*", async (c) => {
  try {
    const html = await Bun.file("./dist/index.html").text();
    return c.html(html);
  } catch {
    return c.html("<html><body><h1>Run `bun run build` first</h1></body></html>", 503);
  }
});

void startScheduler().catch((err) => console.error("Scheduler error:", err));

export default {
  port: config.PORT,
  fetch: app.fetch,
};
