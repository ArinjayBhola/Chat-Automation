import crypto from "node:crypto";

/**
 * Authenticated symmetric encryption (AES-256-GCM) for OAuth tokens at rest.
 *
 * The key comes from TOKEN_ENCRYPTION_KEY (base64 or hex, decoding to 32 bytes).
 * If no key is configured the helpers fall back to a clearly-marked plaintext
 * passthrough so the app can still boot — set TOKEN_ENCRYPTION_KEY in production.
 */

const PREFIX = "enc:v1:";
const PLAIN_PREFIX = "plain:"; // used only when no key is configured

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  let key: Buffer;
  try {
    key = /^[0-9a-fA-F]+$/.test(raw) && raw.length === 64
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  } catch {
    throw new Error("TOKEN_ENCRYPTION_KEY is not valid base64 or hex.");
  }
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function isEncryptionEnabled(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY);
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return PLAIN_PREFIX + plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  if (payload.startsWith(PLAIN_PREFIX)) {
    return payload.slice(PLAIN_PREFIX.length);
  }
  if (!payload.startsWith(PREFIX)) {
    // Unrecognized format — return as-is to avoid hard failure on legacy rows.
    return payload;
  }
  const key = getKey();
  if (!key) {
    throw new Error(
      "Encrypted token found but TOKEN_ENCRYPTION_KEY is not configured.",
    );
  }
  const data = Buffer.from(payload.slice(PREFIX.length), "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
