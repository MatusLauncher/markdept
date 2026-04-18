import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { posts, users } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { generatePost } from "../services/contentGenerator";
import { schedulePost, cancelPost } from "../services/scheduler";

const router = new Hono();
router.use("*", requireAuth);

router.get("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const status = c.req.query("status");
  const where = status
    ? and(eq(posts.userId, user.id), eq(posts.status, status))
    : eq(posts.userId, user.id);
  const rows = await db.select().from(posts).where(where);
  return c.json(rows);
});

router.post("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const body = await c.req.json() as {
    platform: string;
    content: string;
    campaignId?: number;
    platformAccountId?: number;
    mediaUrls?: string[];
    scheduledAt?: string;
    videoTitle?: string;
    videoDescription?: string;
    videoTags?: string[];
  };
  const inserted = await db.insert(posts).values({
    userId: user.id,
    platform: body.platform,
    content: body.content,
    campaignId: body.campaignId ?? null,
    platformAccountId: body.platformAccountId ?? null,
    mediaUrls: body.mediaUrls ?? [],
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    status: body.scheduledAt ? "scheduled" : "draft",
    videoTitle: body.videoTitle ?? null,
    videoDescription: body.videoDescription ?? null,
    videoTags: body.videoTags ?? [],
  }).returning();
  const post = inserted[0];
  if (post.scheduledAt && post.status === "scheduled") {
    schedulePost(post.id, post.scheduledAt);
  }
  return c.json(post, 201);
});

router.get("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.userId, user.id))).limit(1);
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json(rows[0]);
});

router.put("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const body = await c.req.json() as Partial<{ content: string; scheduledAt: string; status: string; mediaUrls: string[] }>;
  const update: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (body.scheduledAt) update.scheduledAt = new Date(body.scheduledAt);
  const rows = await db.update(posts).set(update).where(and(eq(posts.id, id), eq(posts.userId, user.id))).returning();
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json(rows[0]);
});

router.delete("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  cancelPost(id);
  const rows = await db.delete(posts).where(and(eq(posts.id, id), eq(posts.userId, user.id))).returning();
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json({ ok: true });
});

router.post("/:id/generate", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.userId, user.id))).limit(1);
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  const post = rows[0];
  const body = await c.req.json() as { topic: string; campaignContext?: string };
  const content = await generatePost(user.id, post.platform, body.topic, body.campaignContext);
  const updated = await db.update(posts).set({ content, updatedAt: new Date() }).where(eq(posts.id, id)).returning();
  return c.json(updated[0]);
});

export default router;
