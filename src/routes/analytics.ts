import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { analytics, posts, platformAccounts, users } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { generateAnalyticsReport } from "../services/contentGenerator";
import { MastodonClient } from "../services/platforms/mastodon";
import { LinkedInClient } from "../services/platforms/linkedin";
import { LemmyClient } from "../services/platforms/lemmy";
import { YouTubeClient } from "../services/platforms/youtube";
import { decrypt } from "../services/crypto";
import { config } from "../config";

const router = new Hono();
router.use("*", requireAuth);

router.get("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const rows = await db.select().from(analytics).where(eq(analytics.userId, user.id));
  return c.json(rows);
});

router.post("/fetch/:postId", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const postId = Number(c.req.param("postId"));

  const postRows = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.userId, user.id))).limit(1);
  const post = postRows[0];
  if (!post) return c.json({ detail: "Post not found" }, 404);
  if (!post.platformPostId) return c.json({ detail: "Post not yet published" }, 400);
  if (!post.platformAccountId) return c.json({ detail: "No platform account" }, 400);

  const acctRows = await db.select().from(platformAccounts).where(eq(platformAccounts.id, post.platformAccountId)).limit(1);
  const acct = acctRows[0];
  if (!acct) return c.json({ detail: "Platform account not found" }, 404);

  let metrics;
  switch (post.platform) {
    case "mastodon": {
      const token = await decrypt(acct.accessTokenEncrypted!);
      metrics = await new MastodonClient(config.MASTODON_INSTANCE_URL, token).getMetrics(post.platformPostId);
      break;
    }
    case "linkedin": {
      const token = await decrypt(acct.accessTokenEncrypted!);
      metrics = await new LinkedInClient(token).getMetrics(post.platformPostId);
      break;
    }
    case "lemmy": {
      const extra = JSON.parse(await decrypt(acct.extraDataEncrypted!));
      metrics = await new LemmyClient(config.LEMMY_INSTANCE_URL, extra).getMetrics(post.platformPostId);
      break;
    }
    case "youtube": {
      const accessToken = await decrypt(acct.accessTokenEncrypted!);
      const refreshToken = await decrypt(acct.refreshTokenEncrypted!);
      metrics = await new YouTubeClient(accessToken, refreshToken, config.YOUTUBE_CLIENT_ID, config.YOUTUBE_CLIENT_SECRET).getMetrics(post.platformPostId);
      break;
    }
    default:
      return c.json({ detail: "Unknown platform" }, 400);
  }

  const inserted = await db.insert(analytics).values({
    postId,
    userId: user.id,
    platform: post.platform,
    ...metrics,
  }).returning();
  return c.json(inserted[0], 201);
});

router.post("/report", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const body = await c.req.json() as { campaignId?: number; campaignName?: string };
  const rows = await db.select().from(analytics).where(eq(analytics.userId, user.id));
  const report = await generateAnalyticsReport(user.id, rows as Record<string, unknown>[], body.campaignName);
  return c.json({ report });
});

export default router;
