import { beforeAll, afterAll, describe, expect, it } from "vitest";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("crypto (with key)", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });
  afterAll(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips ciphertext", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const secret = "ya29.super-secret-token";
    const enc = encrypt(secret);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });
});

describe("crypto (no key → plaintext passthrough)", () => {
  it("uses plain prefix and round-trips", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const enc = encrypt("hello");
    expect(enc).toBe("plain:hello");
    expect(decrypt(enc)).toBe("hello");
  });
});
