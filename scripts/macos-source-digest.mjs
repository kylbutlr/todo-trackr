import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(new URL("../", import.meta.url).pathname);

function nativeSourceFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/macos"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((relativePath) => relativePath && existsSync(path.join(repositoryRoot, relativePath)))
    .sort();
}

export async function nativeSourceDigest() {
  const files = nativeSourceFiles();
  const hash = createHash("sha256");
  const relativeFiles = [];
  for (const relativePath of files) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    relativeFiles.push(relativePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(absolutePath));
    hash.update("\0");
  }
  return { algorithm: "sha256", digest: hash.digest("hex"), files: relativeFiles };
}

const command = process.argv[2];
if (command === "--digest-only") {
  console.log((await nativeSourceDigest()).digest);
} else if (command === "--json") {
  const version = process.argv[3];
  const build = process.argv[4];
  if (!version || !build) throw new Error("Usage: macos-source-digest.mjs --json VERSION BUILD");
  console.log(JSON.stringify({
    version,
    build,
    generatedAt: new Date().toISOString(),
    source: await nativeSourceDigest(),
  }, null, 2));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  throw new Error("Usage: macos-source-digest.mjs --digest-only | --json VERSION BUILD");
}
