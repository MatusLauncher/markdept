import type { Context, MiddlewareHandler, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { verifySession } from "./session";

export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = await loadUser(c);
  if (!user) return c.json({ detail: "Not authenticated" }, 401);
  c.set("user", user);
  await next();
};

export const optionalAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = await loadUser(c);
  c.set("user", user ?? null);
  await next();
};

async function loadUser(c: Context): Promise<typeof users.$inferSelect | null> {
  const cookie = getCookie(c, "session");
  if (!cookie) return null;
  const payload = await verifySession(cookie);
  if (!payload) return null;
  const result = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  const user = result[0];
  if (!user || !user.isActive) return null;
  return user;
}

function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
