import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

async function nativeSourceFiles(root) {
  if (!existsSync(path.join(root, ".git"))) {
    // Downloaded source archives have no Git index. Ignore generated/local state
    // using the same native-source exclusions as the repository's .gitignore.
    const ignoredDirectories = new Set([
      ".git", ".build", ".swiftpm", "DerivedData", "xcuserdata",
      "node_modules", "dist", "coverage", "__pycache__", ".netlify", ".trigger",
    ]);
    const files = [];
    async function walk(relativeDirectory) {
      for (const entry of await readdir(path.join(root, relativeDirectory), { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in native source archive: ${relativePath}`);
        if (entry.isDirectory()) {
          if (!ignoredDirectories.has(entry.name)) await walk(relativePath);
        } else if (entry.isFile()
          && entry.name !== ".DS_Store"
          && !/\.(xcuserstate|tsbuildinfo|log)$/.test(entry.name)
          && !(entry.name === ".env" || entry.name.startsWith(".env."))) {
          files.push(relativePath);
        }
      }
    }
    await walk("apps/macos");
    return files.sort();
  }
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/macos"],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((relativePath) => relativePath && existsSync(path.join(root, relativePath)))
    .sort();
}

export async function nativeSourceDigest(root = repositoryRoot) {
  const files = await nativeSourceFiles(root);
  const hash = createHash("sha256");
  const relativeFiles = [];
  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
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
