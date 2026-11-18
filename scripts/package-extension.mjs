import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildProfile } from "./build-profile.mjs";

const profile = buildProfile();
const common = "apps/browser-extension";
const entrypoints = profile === "personal" ? common : "apps/browser-extension-public";
const manifest = JSON.parse(await readFile(`${entrypoints}/manifest.json`, "utf8"));
const output = resolve(process.env.TODO_TRACKR_PACKAGE_OUTPUT ?? "dist/releases");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), "todo-trackr-extension-"));
try {
  const commonFiles = ["capture.js", "connection.js", "popup.js", "popup.css", "icons", "fonts", "app-stylr.css"];
  const entries = ["manifest.json", "background.js", "popup.html", "README.md"];
  const privateFiles = profile === "personal" ? ["radar.js", "radar-reader.js", "radar-assigned-reader.js", "radar-popup.js", "radar-native.js", "radar-refresh.js", "radar-session.js"] : [];
  for (const file of commonFiles) await cp(`${common}/${file}`, join(staging, file), { recursive: true });
  for (const file of entries) await cp(`${entrypoints}/${file}`, join(staging, file));
  if (profile === "public") {
    const background = await readFile(join(staging, "background.js"), "utf8");
    await writeFile(join(staging, "background.js"), background.replaceAll("../browser-extension/", "./"));
  }
  for (const file of privateFiles) await cp(`${common}/${file}`, join(staging, file));
  await cp("LICENSE", join(staging, "LICENSE"));
  await writeFile(join(staging, "build-profile.json"), JSON.stringify({ profile }) + "\n");
  const archive = join(output, `todo-trackr-extension-${profile}-${manifest.version}.zip`);
  const temporary = join(staging, "extension.zip");
  execFileSync("zip", ["-rq", temporary, ...entries, ...commonFiles, ...privateFiles, "LICENSE", "build-profile.json"], { cwd: staging });
  await cp(temporary, archive);
  console.log(`${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive}`);
} finally { await rm(staging, { recursive: true, force: true }); }
