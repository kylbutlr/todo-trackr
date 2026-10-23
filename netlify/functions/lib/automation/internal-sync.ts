import { timingSafeEqual } from "node:crypto";

export function verifyInternalSyncSecret(
  suppliedSecret: string,
  expectedSecret: string,
): boolean {
  const suppliedBytes = Buffer.from(suppliedSecret, "utf8");
  const expectedBytes = Buffer.from(expectedSecret, "utf8");
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}
