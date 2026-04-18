import { eq } from "drizzle-orm";
import { db } from "../db";
import { oauthTokens } from "../db/schema";
import { decrypt, encrypt } from "./crypto";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

async function getAccessToken(userId: number): Promise<string> {
  const rows = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId)).limit(1);
  const token = rows[0];
  if (!token) throw new Error("No token for user");

  const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
  const needsRefresh = expiresAt && expiresAt.getTime() - Date.now() < 60_000;

  if (needsRefresh && token.refreshTokenEncrypted) {
    const refreshToken = await decrypt(token.refreshTokenEncrypted);
    const res = await fetch("https://api.anthropic.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.ANTHROPIC_CLIENT_ID!,
        client_secret: process.env.ANTHROPIC_CLIENT_SECRET!,
      }),
    });
    if (!res.ok) throw new Error("Token refresh failed");
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    const newExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await db.update(oauthTokens).set({
      accessTokenEncrypted: await encrypt(data.access_token),
      refreshTokenEncrypted: data.refresh_token ? await encrypt(data.refresh_token) : token.refreshTokenEncrypted,
      expiresAt: newExpiry,
      updatedAt: new Date(),
    }).where(eq(oauthTokens.userId, userId));
    return data.access_token;
  }

  return decrypt(token.accessTokenEncrypted);
}

export async function generate(
  userId: number,
  messages: Message[],
  system?: string,
  maxTokens = 1024,
): Promise<string> {
  const accessToken = await getAccessToken(userId);
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages,
  };
  if (system) {
    body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find((b) => b.type === "text")?.text ?? "";
}
