import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const manifest = JSON.parse(await readFile("apps/browser-extension/manifest.json", "utf8"));
const output = resolve("dist/releases");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), "todo-trackr-extension-"));
try {
  for (const file of ["manifest.json", "background.js", "capture.js", "connection.js", "popup.js", "popup.html", "popup.css", "icons", "README.md"]) {
    await cp(`apps/browser-extension/${file}`, join(staging, file), { recursive: true });
  }
  await cp("LICENSE", join(staging, "LICENSE"));
  const archive = join(output, `todo-trackr-extension-${manifest.version}.zip`);
  // Rebuilding a local artifact must not retain removed entries from an old zip.
  const temporary = join(staging, "extension.zip");
  execFileSync("zip", ["-rq", temporary, "manifest.json", "background.js", "capture.js", "connection.js", "popup.js", "popup.html", "popup.css", "icons", "README.md", "LICENSE"], { cwd: staging });
  await cp(temporary, archive);
  console.log(`${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive}`);
} finally { await rm(staging, { recursive: true, force: true }); }
