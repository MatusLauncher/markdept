import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, oauthTokens } from "../db/schema";
import { signSession } from "../auth/session";
import { requireAuth } from "../auth/middleware";
import { encrypt } from "../services/crypto";
import { config } from "../config";

const router = new Hono();

function generateCodeVerifier(): string {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

router.get("/login", async (c) => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.ANTHROPIC_CLIENT_ID,
    redirect_uri: config.ANTHROPIC_REDIRECT_URI,
    scope: "org:read_claude",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const res = c.redirect(`https://claude.ai/oauth/authorize?${params}`);
  res.headers.set("Set-Cookie", `pkce_verifier=${verifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  res.headers.append("Set-Cookie", `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  return res;
});

router.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieHeader = c.req.header("cookie") ?? "";
  const verifier = parseCookie(cookieHeader, "pkce_verifier");
  const savedState = parseCookie(cookieHeader, "oauth_state");

  if (!code || !verifier || state !== savedState) return c.redirect("/?error=auth_failed");

  const tokenRes = await fetch("https://api.anthropic.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.ANTHROPIC_REDIRECT_URI,
      client_id: config.ANTHROPIC_CLIENT_ID,
      client_secret: config.ANTHROPIC_CLIENT_SECRET,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return c.redirect("/?error=token_exchange_failed");
  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const userRes = await fetch("https://api.anthropic.com/v1/oauth/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) return c.redirect("/?error=userinfo_failed");
  const userInfo = await userRes.json() as { sub: string; email: string; name?: string };

  const existing = await db.select().from(users).where(eq(users.anthropicUserId, userInfo.sub)).limit(1);
  let userId: number;
  if (existing[0]) {
    userId = existing[0].id;
    await db.update(users).set({ email: userInfo.email, name: userInfo.name ?? userInfo.email, updatedAt: new Date() }).where(eq(users.id, userId));
  } else {
    const inserted = await db.insert(users).values({
      anthropicUserId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name ?? userInfo.email,
    }).returning({ id: users.id });
    userId = inserted[0].id;
  }

  const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
  const existingToken = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId)).limit(1);
  const tokenValues = {
    accessTokenEncrypted: await encrypt(tokenData.access_token),
    refreshTokenEncrypted: tokenData.refresh_token ? await encrypt(tokenData.refresh_token) : null,
    expiresAt,
    tokenType: tokenData.token_type,
    scope: tokenData.scope ?? null,
    updatedAt: new Date(),
  };
  if (existingToken[0]) {
    await db.update(oauthTokens).set(tokenValues).where(eq(oauthTokens.userId, userId));
  } else {
    await db.insert(oauthTokens).values({ userId, ...tokenValues });
  }

  const session = await signSession({ userId });
  const res = c.redirect("/");
  res.headers.set("Set-Cookie", `session=${session}; HttpOnly; Path=/; SameSite=Lax`);
  res.headers.append("Set-Cookie", "pkce_verifier=; HttpOnly; Path=/; Max-Age=0");
  res.headers.append("Set-Cookie", "oauth_state=; HttpOnly; Path=/; Max-Age=0");
  return res;
});

router.post("/logout", (c) => {
  const res = c.json({ ok: true });
  res.headers.set("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0");
  return res;
});

router.get("/me", requireAuth, (c) => {
  const user = c.get("user" as never) as typeof users.$inferSelect;
  return c.json({ id: user.id, email: user.email, name: user.name });
});

function parseCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export default router;
