import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { preparePublicSource } from "./prepare-public-source.mjs";
import { buildProfile } from "./build-profile.mjs";
if (buildProfile() !== "public") throw new Error("Personal source is local and cannot use public release packaging");

const { version } = JSON.parse(await readFile("package.json", "utf8"));
execFileSync("git", ["diff", "--quiet", "HEAD"]);
if (execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit reviewed source changes before packaging the public source archive.");
}
await mkdir("dist/releases", { recursive: true });
const archive = resolve(`dist/releases/todo-trackr-source-${version}.tar.gz`);
const temporary = await mkdtemp(join(tmpdir(), "todo-trackr-public-source-"));
try {
  const source = join(temporary, `todo-trackr-${version}`);
  await preparePublicSource(process.cwd(), source);
  execFileSync("tar", ["-czf", archive, "-C", temporary, `todo-trackr-${version}`]);
} finally { await rm(temporary, { recursive: true, force: true }); }
console.log(`${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive}`);
