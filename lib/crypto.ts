import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
/** Stored format: version prefix + base64(iv || ciphertext+tag) where GCM appends auth tag to ciphertext in Node API */
export const ENCRYPTED_PREFIX = "enc1:";

let warnedMissingKey = false;
let cachedKey: Buffer | null | undefined;

/** Clears cached key (for tests only). */
export function __resetEncryptionKeyCacheForTests(): void {
  cachedKey = undefined;
  warnedMissingKey = false;
}

function getKeyBytes(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return null;
  }
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error(`ENCRYPTION_KEY must decode to 32 bytes, got ${buf.length}`);
    }
    cachedKey = buf;
    return buf;
  } catch (e) {
    throw new Error(
      `Invalid ENCRYPTION_KEY: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True when AES-GCM is active (key present and valid). */
export function isEncryptionEnabled(): boolean {
  return getKeyBytes() !== null;
}

/**
 * Encrypt UTF-8 plaintext to a prefixed token (IV unique per call).
 * Without ENCRYPTION_KEY in development: returns plaintext and logs once.
 * In production without a key: throws.
 */
export function encrypt(plaintext: string): string {
  const key = getKeyBytes();
  if (!key) {
    if (isProduction()) {
      throw new Error("ENCRYPTION_KEY is required in production");
    }
    if (!warnedMissingKey) {
      console.warn(
        "[crypto] ENCRYPTION_KEY is not set; storing data in plaintext (dev only)."
      );
      warnedMissingKey = true;
    }
    return plaintext;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, enc, tag]);
  return `${ENCRYPTED_PREFIX}${combined.toString("base64")}`;
}

/**
 * Decrypt a token produced by encrypt(). Throws on tampering or wrong key if ciphertext.
 */
export function decrypt(token: string): string {
  const key = getKeyBytes();
  if (!key) {
    if (isProduction()) {
      throw new Error("ENCRYPTION_KEY is required in production");
    }
    return token;
  }
  if (!token.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error("Invalid ciphertext: missing version prefix");
  }
  const b64 = token.slice(ENCRYPTED_PREFIX.length);
  const combined = Buffer.from(b64, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const enc = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/**
 * If value looks like our ciphertext, decrypt; otherwise return as-is (legacy plaintext).
 */
export function decryptMaybe(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Constant-time compare of two strings (for tests / optional use).
 */
export function secureCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
