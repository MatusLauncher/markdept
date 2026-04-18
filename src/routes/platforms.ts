import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { platformAccounts, users } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { encrypt, decrypt } from "../services/crypto";
import { config } from "../config";

const router = new Hono();
router.use("*", requireAuth);

router.get("/", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const rows = await db.select().from(platformAccounts).where(eq(platformAccounts.userId, user.id));
  return c.json(rows.map(({ accessTokenEncrypted, refreshTokenEncrypted, extraDataEncrypted, ...safe }) => safe));
});

router.delete("/:id", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const id = Number(c.req.param("id"));
  const rows = await db.delete(platformAccounts).where(and(eq(platformAccounts.id, id), eq(platformAccounts.userId, user.id))).returning();
  if (!rows[0]) return c.json({ detail: "Not found" }, 404);
  return c.json({ ok: true });
});

// Mastodon OAuth flow
router.get("/mastodon/connect", async (c) => {
  const params = new URLSearchParams({
    client_id: config.MASTODON_CLIENT_ID,
    scope: "read write",
    redirect_uri: `${new URL(config.ANTHROPIC_REDIRECT_URI).origin}/api/platforms/mastodon/callback`,
    response_type: "code",
  });
  return c.redirect(`${config.MASTODON_INSTANCE_URL}/oauth/authorize?${params}`);
});

router.get("/mastodon/callback", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const code = c.req.query("code");
  if (!code) return c.redirect("/platforms?error=mastodon_auth_failed");

  const tokenRes = await fetch(`${config.MASTODON_INSTANCE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.MASTODON_CLIENT_ID,
      client_secret: config.MASTODON_CLIENT_SECRET,
      redirect_uri: `${new URL(config.ANTHROPIC_REDIRECT_URI).origin}/api/platforms/mastodon/callback`,
      grant_type: "authorization_code",
      code,
      scope: "read write",
    }),
  });
  if (!tokenRes.ok) return c.redirect("/platforms?error=mastodon_token_failed");
  const tokenData = await tokenRes.json() as { access_token: string };

  const verifyRes = await fetch(`${config.MASTODON_INSTANCE_URL}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const accountInfo = await verifyRes.json() as { id: string; username: string };

  await db.insert(platformAccounts).values({
    userId: user.id,
    platform: "mastodon",
    accountName: accountInfo.username,
    accountId: accountInfo.id,
    accessTokenEncrypted: await encrypt(tokenData.access_token),
  }).onConflictDoNothing();
  return c.redirect("/platforms?connected=mastodon");
});

// LinkedIn OAuth flow
router.get("/linkedin/connect", async (c) => {
  const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: `${new URL(config.ANTHROPIC_REDIRECT_URI).origin}/api/platforms/linkedin/callback`,
    scope: "openid profile email w_member_social",
    state,
  });
  return c.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get("/linkedin/callback", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const code = c.req.query("code");
  if (!code) return c.redirect("/platforms?error=linkedin_auth_failed");

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${new URL(config.ANTHROPIC_REDIRECT_URI).origin}/api/platforms/linkedin/callback`,
      client_id: config.LINKEDIN_CLIENT_ID,
      client_secret: config.LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) return c.redirect("/platforms?error=linkedin_token_failed");
  const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };

  const profileRes = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json() as { id: string; localizedFirstName?: string; localizedLastName?: string };
  const name = `${profile.localizedFirstName ?? ""} ${profile.localizedLastName ?? ""}`.trim() || profile.id;

  const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
  await db.insert(platformAccounts).values({
    userId: user.id,
    platform: "linkedin",
    accountName: name,
    accountId: profile.id,
    accessTokenEncrypted: await encrypt(tokenData.access_token),
    tokenExpiresAt: expiresAt,
  }).onConflictDoNothing();
  return c.redirect("/platforms?connected=linkedin");
});

// Lemmy — manual credential setup
router.post("/lemmy/connect", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const body = await c.req.json() as { username: string; password: string; communityId: number };
  const extra = JSON.stringify({ username: body.username, password: body.password, communityId: body.communityId });
  await db.insert(platformAccounts).values({
    userId: user.id,
    platform: "lemmy",
    accountName: body.username,
    extraDataEncrypted: await encrypt(extra),
  }).onConflictDoNothing();
  return c.json({ ok: true }, 201);
});

// YouTube OAuth flow
router.get("/youtube/connect", async (c) => {
  const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const params = new URLSearchParams({
    client_id: config.YOUTUBE_CLIENT_ID,
    redirect_uri: config.YOUTUBE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/youtube/callback", async (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  const code = c.req.query("code");
  if (!code) return c.redirect("/platforms?error=youtube_auth_failed");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.YOUTUBE_CLIENT_ID,
      client_secret: config.YOUTUBE_CLIENT_SECRET,
      redirect_uri: config.YOUTUBE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return c.redirect("/platforms?error=youtube_token_failed");
  const tokenData = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in?: number };

  const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const channelData = await channelRes.json() as { items?: Array<{ id: string; snippet: { title: string } }> };
  const channel = channelData.items?.[0];

  const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
  await db.insert(platformAccounts).values({
    userId: user.id,
    platform: "youtube",
    accountName: channel?.snippet.title ?? "YouTube Channel",
    accountId: channel?.id ?? "",
    accessTokenEncrypted: await encrypt(tokenData.access_token),
    refreshTokenEncrypted: await encrypt(tokenData.refresh_token),
    tokenExpiresAt: expiresAt,
  }).onConflictDoNothing();
  return c.redirect("/platforms?connected=youtube");
});

export default router;
