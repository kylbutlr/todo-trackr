import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
execFileSync("git", ["diff", "--quiet", "HEAD"]);
if (execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit reviewed source changes before packaging the public source archive.");
}
await mkdir("dist/releases", { recursive: true });
const archive = resolve(`dist/releases/todo-trackr-source-${version}.tar.gz`);
execFileSync("git", ["archive", "--format=tar.gz", `--prefix=todo-trackr-${version}/`, `--output=${archive}`, "HEAD"]);
console.log(`${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive}`);
