import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { posts, platformAccounts } from "../db/schema";
import { decrypt } from "./crypto";
import { MastodonClient } from "./platforms/mastodon";
import { LinkedInClient } from "./platforms/linkedin";
import { LemmyClient } from "./platforms/lemmy";
import { YouTubeClient } from "./platforms/youtube";
import { config } from "../config";
import type { PostPayload } from "./platforms/types";

const pending = new Map<number, Timer>();

export function schedulePost(postId: number, scheduledAt: Date): void {
  const delay = scheduledAt.getTime() - Date.now();
  if (delay <= 0) {
    void executePost(postId);
    return;
  }
  const timer = setTimeout(() => void executePost(postId), delay);
  pending.set(postId, timer);
}

export function cancelPost(postId: number): void {
  const timer = pending.get(postId);
  if (timer) {
    clearTimeout(timer);
    pending.delete(postId);
  }
}

async function executePost(postId: number): Promise<void> {
  pending.delete(postId);
  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  const post = rows[0];
  if (!post || post.status !== "scheduled") return;

  try {
    const client = await buildClient(post);
    const payload: PostPayload = {
      content: post.content,
      mediaUrls: post.mediaUrls ?? [],
      videoTitle: post.videoTitle ?? undefined,
      videoDescription: post.videoDescription ?? undefined,
      videoTags: post.videoTags ?? [],
    };
    const result = await client.post(payload);
    await db.update(posts).set({
      status: "published",
      publishedAt: new Date(),
      platformPostId: result.platformPostId,
      updatedAt: new Date(),
    }).where(eq(posts.id, postId));
  } catch (err) {
    await db.update(posts).set({
      status: "failed",
      updatedAt: new Date(),
    }).where(eq(posts.id, postId));
    console.error(`Post ${postId} failed:`, err);
  }
}

async function buildClient(post: typeof posts.$inferSelect) {
  if (!post.platformAccountId) throw new Error("No platform account");
  const acctRows = await db.select().from(platformAccounts).where(eq(platformAccounts.id, post.platformAccountId)).limit(1);
  const acct = acctRows[0];
  if (!acct) throw new Error("Platform account not found");

  switch (post.platform) {
    case "mastodon": {
      const token = await decrypt(acct.accessTokenEncrypted!);
      return new MastodonClient(config.MASTODON_INSTANCE_URL, token);
    }
    case "linkedin": {
      const token = await decrypt(acct.accessTokenEncrypted!);
      return new LinkedInClient(token);
    }
    case "lemmy": {
      const extra = JSON.parse(await decrypt(acct.extraDataEncrypted!));
      return new LemmyClient(config.LEMMY_INSTANCE_URL, extra);
    }
    case "youtube": {
      const accessToken = await decrypt(acct.accessTokenEncrypted!);
      const refreshToken = await decrypt(acct.refreshTokenEncrypted!);
      return new YouTubeClient(accessToken, refreshToken, config.YOUTUBE_CLIENT_ID, config.YOUTUBE_CLIENT_SECRET);
    }
    default:
      throw new Error(`Unknown platform: ${post.platform}`);
  }
}

export async function startScheduler(): Promise<void> {
  const now = new Date();
  const rows = await db.select().from(posts).where(
    and(eq(posts.status, "scheduled"), gt(posts.scheduledAt!, now)),
  );
  for (const post of rows) {
    if (post.scheduledAt) schedulePost(post.id, post.scheduledAt);
  }

  setInterval(async () => {
    const fresh = await db.select().from(posts).where(
      and(eq(posts.status, "scheduled"), gt(posts.scheduledAt!, new Date())),
    );
    for (const post of fresh) {
      if (post.scheduledAt && !pending.has(post.id)) {
        schedulePost(post.id, post.scheduledAt);
      }
    }
  }, 5 * 60 * 1000);
}
