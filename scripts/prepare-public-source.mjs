import { execFileSync } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicSource } from "./public-files.mjs";

function fileAndParents(file) {
  const parts = file.split("/");
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

export async function preparePublicSource(root, output) {
  // Explicit source list excludes ignored data, credentials, build caches and private packages.
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0");
  // Preserve the export-ignore contract previously enforced by git archive.
  // The public allowlist is an additional restriction, not a replacement for it.
  // git archive prunes a marked directory even when its children have no attribute.
  const pathsToCheck = [...new Set(files.filter(Boolean).flatMap(fileAndParents))];
  const attributes = execFileSync("git", ["check-attr", "-z", "--stdin", "export-ignore"], {
    cwd: root, encoding: "utf8", input: pathsToCheck.join("\0") + "\0",
  }).split("\0");
  const exportIgnored = new Set();
  for (let index = 0; index + 2 < attributes.length; index += 3) {
    if (attributes[index + 2] === "set") exportIgnored.add(attributes[index]);
  }
  if (existsSync(output)) throw new Error("Refusing to overwrite a source export");
  await mkdir(output, { recursive: true });
  for (const file of files.filter(file => file && !fileAndParents(file).some(path => exportIgnored.has(path)) && isPublicSource(file) && existsSync(join(root, file)))) {
    const destination = join(output, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, file), destination);
  }
  await writeFile(join(output, "build-profile.json"), JSON.stringify({ profile: "public", kind: "local-review-source" }) + "\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: node scripts/prepare-public-source.mjs OUTPUT_DIRECTORY");
  await preparePublicSource(process.cwd(), resolve(output));
  console.log("Prepared public review source; not a published release.");
}
