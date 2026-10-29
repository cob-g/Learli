import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { GoogleMeetConfig } from "./config";

export const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomSecret = () => randomBytes(32).toString("base64url");
export const tokenContext = (
  connectionId: string,
  owner: string,
  subject: string,
  fingerprint: string,
) =>
  JSON.stringify([
    "meet-refresh-v1",
    connectionId,
    owner,
    subject,
    fingerprint,
  ]);
export const attemptContext = (
  owner: string,
  stateHash: string,
  fingerprint: string,
) => JSON.stringify(["meet-verifier-v1", owner, stateHash, fingerprint]);

export function encryptSecret(
  config: GoogleMeetConfig,
  value: string,
  context: string,
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(config.keys[config.activeKeyId], "hex"),
    nonce,
  );
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    config.activeKeyId,
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptSecret(
  config: GoogleMeetConfig,
  value: string,
  context: string,
) {
  try {
    const [keyId, nonce, tag, ciphertext, extra] = value.split(".");
    if (
      extra !== undefined ||
      !keyId ||
      !config.keys[keyId] ||
      !nonce ||
      !tag ||
      !ciphertext ||
      value.length > 16384
    )
      throw new Error();
    const iv = Buffer.from(nonce, "base64url"),
      authTag = Buffer.from(tag, "base64url");
    if (iv.length !== 12 || authTag.length !== 16) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(config.keys[keyId], "hex"),
      iv,
    );
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Google credential unavailable. Details omitted.");
  }
}
