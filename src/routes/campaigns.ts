import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { campaigns } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { generateContentCalendar } from "../services/contentGenerator";
import { users } from "../db/schema";

const router = new Hono();
router.use("*", requireAuth);

router.get("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const rows = await db.select().from(campaigns).where(eq(campaigns.userId, user.id));
  return c.json(rows);
});

router.post("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const body = await c.req.json() as {
    name: string;
    description?: string;
    targetAudience?: string;
    targetPlatforms?: string[];
    startDate?: string;
    endDate?: string;
  };
  const inserted = await db.insert(campaigns).values({
    userId: user.id,
    name: body.name,
    description: body.description ?? null,
    targetAudience: body.targetAudience ?? null,
    targetPlatforms: body.targetPlatforms ?? [],
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
  }).returning();
  return c.json(inserted[0], 201);
});

router.get("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id))).limit(1);
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json(rows[0]);
});

router.put("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const body = await c.req.json() as Partial<{ name: string; description: string; targetAudience: string; targetPlatforms: string[]; status: string; startDate: string; endDate: string }>;
  const rows = await db.update(campaigns).set({
    ...body,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    updatedAt: new Date(),
  }).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id))).returning();
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json(rows[0]);
});

router.delete("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id))).returning();
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json({ ok: true });
});

router.post("/:id/generate-calendar", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id))).limit(1);
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  const campaign = rows[0];
  const calendar = await generateContentCalendar(
    user.id,
    campaign.name,
    campaign.description ?? "",
    campaign.targetPlatforms ?? [],
  );
  await db.update(campaigns).set({ contentCalendar: calendar, updatedAt: new Date() }).where(eq(campaigns.id, id));
  return c.json({ contentCalendar: calendar });
});

export default router;
