import { describe, expect, test, beforeAll } from "bun:test";

// Set env before importing the module
process.env.SECRET_KEY = "test-secret-key-for-ci-only-32-bytes!!";
process.env.ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
process.env.DATABASE_URL = "postgresql://fake:fake@localhost/fake";
process.env.ANTHROPIC_CLIENT_ID = "ci-id";
process.env.ANTHROPIC_CLIENT_SECRET = "ci-secret";

const { encrypt, decrypt } = await import("../src/services/crypto");

describe("crypto", () => {
  test("roundtrip basic string", async () => {
    const plain = "hello world";
    expect(await decrypt(await encrypt(plain))).toBe(plain);
  });

  test("roundtrip unicode", async () => {
    const plain = "こんにちは 🌍";
    expect(await decrypt(await encrypt(plain))).toBe(plain);
  });

  test("roundtrip empty string", async () => {
    expect(await decrypt(await encrypt(""))).toBe("");
  });

  test("unique IV per encrypt call", async () => {
    const a = await encrypt("same");
    const b = await encrypt("same");
    expect(a).not.toBe(b);
  });

  test("decrypt wrong ciphertext throws", async () => {
    await expect(decrypt("notbase64!!@#$")).rejects.toThrow();
  });
});
