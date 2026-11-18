import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export function contentHash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A profile label alone cannot establish which compiled bytes are being shipped. */
export async function verifyBuildReceipt(receiptPath, directory, requiredFile) {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  if (receipt.profile !== "public" || !receipt.files || !Object.hasOwn(receipt.files, requiredFile)) {
    throw new Error("Rebuild the public artifacts before packaging: missing public content receipt.");
  }
  const root = resolve(directory);
  for (const [file, expected] of Object.entries(receipt.files)) {
    const path = resolve(root, file);
    if (!path.startsWith(root + sep) || typeof expected !== "string" || !/^[a-f0-9]{64}$/u.test(expected)) {
      throw new Error("Invalid public build receipt.");
    }
    if (contentHash(await readFile(path)) !== expected) {
      throw new Error("Compiled output changed after its public build. Rebuild before packaging.");
    }
  }
}
