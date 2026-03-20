import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  decrypt,
  decryptMaybe,
  encrypt,
  ENCRYPTED_PREFIX,
  __resetEncryptionKeyCacheForTests,
} from "./crypto";
import {
  decryptSessionFields,
  encryptSessionFields,
  decryptMessageFields,
  encryptMessageFields,
  decryptUserMentalModelFields,
} from "./crypto-fields";

const testKeyB64 = Buffer.alloc(32, 0x42).toString("base64");

const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };

describe("lib/crypto", () => {
  const prevKey = process.env.ENCRYPTION_KEY;
  const prevNodeEnv = env.NODE_ENV;

  beforeEach(() => {
    __resetEncryptionKeyCacheForTests();
    process.env.ENCRYPTION_KEY = testKeyB64;
    env.NODE_ENV = "test";
  });

  afterEach(() => {
    __resetEncryptionKeyCacheForTests();
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
    env.NODE_ENV = prevNodeEnv;
  });

  it("encrypt/decrypt round-trip", () => {
    const plain = "hello world — unicode αβ";
    const token = encrypt(plain);
    assert.ok(token.startsWith(ENCRYPTED_PREFIX));
    assert.equal(decrypt(token), plain);
  });

  it("decryptMaybe passes through legacy plaintext", () => {
    assert.equal(decryptMaybe("not encrypted"), "not encrypted");
  });

  it("decrypt rejects tampered ciphertext", () => {
    const token = encrypt("secret");
    const buf = Buffer.from(token.slice(ENCRYPTED_PREFIX.length), "base64");
    buf[buf.length - 1] ^= 0xff;
    const bad = `${ENCRYPTED_PREFIX}${buf.toString("base64")}`;
    assert.throws(() => decrypt(bad));
  });

  it("handles empty string", () => {
    assert.equal(decrypt(encrypt("")), "");
  });

  it("handles long content", () => {
    const long = "x".repeat(500_000);
    assert.equal(decrypt(encrypt(long)), long);
  });
});

describe("lib/crypto-fields", () => {
  const prevKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    __resetEncryptionKeyCacheForTests();
    process.env.ENCRYPTION_KEY = testKeyB64;
  });

  afterEach(() => {
    __resetEncryptionKeyCacheForTests();
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
  });

  it("session fields round-trip", () => {
    const doc = {
      title: "T",
      mentalModelTags: ["a", "b"],
      perspectiveCardPrompt: "p",
      userId: "u",
    };
    const enc = encryptSessionFields<typeof doc>(doc);
    assert.notEqual(enc.title, doc.title);
    const dec = decryptSessionFields<typeof doc>(enc);
    assert.deepEqual(dec, doc);
  });

  it("message fields partial update semantics", () => {
    const original = { sessionId: "s", role: "user" as const, content: "c", createdAt: new Date() };
    const enc = encryptMessageFields<typeof original>(original);
    assert.notEqual(enc.content, original.content);
    const dec = decryptMessageFields<typeof original>(enc);
    assert.equal(dec.content, original.content);
    assert.equal(dec.sessionId, original.sessionId);
  });

  it("user mental model tolerates null array fields (Mongo)", () => {
    const doc = {
      userId: "u",
      id: "m1",
      name: "n",
      when_to_use: null,
      related_content: null,
      try_this: null,
      ask_yourself: null,
      quick_introduction: "qi",
      in_more_detail: "d",
      why_this_is_important: "w",
      how_can_you_spot_it: {},
      examples: {},
      real_world_implications: "",
      professional_application: {},
      how_can_this_be_misapplied: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    assert.doesNotThrow(() => decryptUserMentalModelFields<typeof doc>(doc));
  });
});
