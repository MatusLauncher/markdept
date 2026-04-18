import { config } from "../config";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const keyData = encoder.encode(config.SECRET_KEY.slice(0, 32).padEnd(32, "0"));
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function signSession(payload: { userId: number }): Promise<string> {
  const key = await getKey();
  const data = b64url(encoder.encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const sig = b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(data).buffer as ArrayBuffer));
  return `${data}.${sig}`;
}

export async function verifySession(cookie: string): Promise<{ userId: number } | null> {
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify("HMAC", key, fromB64url(sig).buffer as ArrayBuffer, encoder.encode(data).buffer as ArrayBuffer);
    if (!valid) return null;
    return JSON.parse(decoder.decode(fromB64url(data)));
  } catch {
    return null;
  }
}
