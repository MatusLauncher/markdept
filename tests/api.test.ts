import { describe, expect, test } from "bun:test";

process.env.SECRET_KEY = "test-secret-key-for-ci-only-32-bytes!!";
process.env.ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
process.env.DATABASE_URL = "postgresql://fake:fake@localhost/fake";
process.env.ANTHROPIC_CLIENT_ID = "ci-id";
process.env.ANTHROPIC_CLIENT_SECRET = "ci-secret";

const { default: server } = await import("../src/index");
const { fetch: appFetch } = server;

async function req(path: string, options?: RequestInit) {
  return appFetch(new Request(`http://localhost${path}`, options));
}

describe("unauthenticated API routes return 401", () => {
  const protectedRoutes = [
    "/api/campaigns",
    "/api/posts",
    "/api/platforms",
    "/api/analytics",
    "/auth/me",
  ];

  for (const route of protectedRoutes) {
    test(`GET ${route} → 401`, async () => {
      const res = await req(route);
      expect(res.status).toBe(401);
    });
  }
});

describe("auth routes", () => {
  test("GET /auth/login redirects to Claude.ai", async () => {
    const res = await req("/auth/login");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("claude.ai");
  });

  test("POST /auth/logout clears session cookie", async () => {
    const res = await req("/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("session=;");
  });
});
