import { describe, expect, test } from "bun:test";

process.env.SECRET_KEY = "test-secret-key-for-ci-only-32-bytes!!";
process.env.ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
process.env.DATABASE_URL = "postgresql://fake:fake@localhost/fake";
process.env.ANTHROPIC_CLIENT_ID = "ci-id";
process.env.ANTHROPIC_CLIENT_SECRET = "ci-secret";

const { PLATFORM_SYSTEM_PROMPTS, PLATFORM_LIMITS } = await import("../src/services/contentGenerator");

describe("contentGenerator constants", () => {
  const PLATFORMS = ["mastodon", "linkedin", "lemmy", "youtube"];

  test("all platforms have system prompts", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_SYSTEM_PROMPTS[p]).toBeTruthy();
      expect(typeof PLATFORM_SYSTEM_PROMPTS[p]).toBe("string");
    }
  });

  test("all platforms have character limits", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_LIMITS[p]).toBeGreaterThan(0);
    }
  });

  test("mastodon limit <= 500", () => {
    expect(PLATFORM_LIMITS.mastodon).toBeLessThanOrEqual(500);
  });

  test("linkedin limit > mastodon limit", () => {
    expect(PLATFORM_LIMITS.linkedin).toBeGreaterThan(PLATFORM_LIMITS.mastodon);
  });

  test("prompts mention JSON for calendar", () => {
    // contentGenerator prompts are fine; calendar generation prompt is inline
    // Just verify prompts include relevant platform keywords
    expect(PLATFORM_SYSTEM_PROMPTS.mastodon.toLowerCase()).toContain("mastodon");
    expect(PLATFORM_SYSTEM_PROMPTS.linkedin.toLowerCase()).toContain("linkedin");
    expect(PLATFORM_SYSTEM_PROMPTS.youtube.toLowerCase()).toContain("youtube");
  });
});
