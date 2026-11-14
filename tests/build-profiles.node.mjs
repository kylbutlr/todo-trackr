import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProfile } from "../scripts/build-profile.mjs";
import { isPublicSource } from "../scripts/public-files.mjs";
import { contentHash, verifyBuildReceipt } from "../scripts/build-receipt.mjs";

test("profile selection defaults to public and rejects unknown variants", () => {
  assert.equal(buildProfile("public"), "public");
  assert.equal(buildProfile("personal"), "personal");
  assert.throws(() => buildProfile("typo"));
});
test("public source retains the shared core and excludes all owner package surfaces", () => {
  for (const file of ["apps/macos/Sources/TodoTrackerApp.swift", "apps/browser-extension/capture.js", "apps/browser-extension-public/background.js", "netlify/functions/lib/optional-integration.ts"]) assert.equal(isPublicSource(file), true, file);
  for (const file of ["apps/macos/Personal/Sources/Custom.swift", "personal/server/routes.ts", "apps/browser-extension/radar.js", "apps/browser-extension/radar-diagnostics-local/check.js", "apps/browser-extension/background.js", "docs/radar-read-receipt.json", "scripts/radar/auth.ts", "tests/radar-provider.test.ts", "hosting/client.json"]) assert.equal(isPublicSource(file), false, file);
});
test("extension archives match the explicitly selected profile", async () => {
  const output = await mkdtemp(join(tmpdir(), "todo-profile-test-"));
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  try {
    // A public source distribution deliberately has no owner extension files.
    // Exercise personal packaging only when the caller selects that profile.
    const profiles = buildProfile() === "personal" ? ["public", "personal"] : ["public"];
    for (const profile of profiles) {
      execFileSync(process.execPath, ["scripts/package-extension.mjs"], { env: { ...process.env, TODO_TRACKR_BUILD_PROFILE: profile, TODO_TRACKR_PACKAGE_OUTPUT: output }, stdio: "pipe" });
      const archive = join(output, `todo-trackr-extension-${profile}-${version}.zip`);
      const files = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).split("\n");
      const entry = name => execFileSync("unzip", ["-p", archive, name], { encoding: "utf8" });
      const manifest = JSON.parse(entry("manifest.json"));
      const native = manifest.optional_permissions?.includes("nativeMessaging") === true;
      assert.equal(native, profile === "personal");
      assert.equal(files.includes("radar-refresh.js"), profile === "personal");
      assert.equal(entry("background.js").includes("./radar"), profile === "personal");
      assert.equal(entry("popup.html").includes("radar-enable-refresh"), profile === "personal");
      assert.equal(JSON.parse(entry("build-profile.json")).profile, profile);
      assert.ok(files.includes("capture.js"));
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("packaging rejects stale public receipts and accepts the original compiled bytes", async () => {
  const output = await mkdtemp(join(tmpdir(), "todo-receipt-test-"));
  try {
    const bundle = join(output, "server.mjs");
    const receipt = join(output, "receipt.json");
    await writeFile(bundle, "synthetic public bundle");
    await writeFile(receipt, JSON.stringify({ profile: "public", files: { "server.mjs": contentHash(await readFile(bundle)) } }));
    await verifyBuildReceipt(receipt, output, "server.mjs");
    await writeFile(bundle, "synthetic replaced bundle");
    await assert.rejects(verifyBuildReceipt(receipt, output, "server.mjs"), /changed after its public build/u);
    await writeFile(receipt, JSON.stringify({ profile: "public" }));
    await assert.rejects(verifyBuildReceipt(receipt, output, "server.mjs"), /missing public content receipt/u);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("personal receipts cannot label an artifact as public", async () => {
  const output = await mkdtemp(join(tmpdir(), "todo-receipt-test-"));
  try {
    const bundle = join(output, "index.html");
    const receipt = join(output, "receipt.json");
    await writeFile(bundle, "synthetic personal workspace");
    await writeFile(receipt, JSON.stringify({ profile: "personal", files: { "index.html": contentHash(await readFile(bundle)) } }));
    await assert.rejects(verifyBuildReceipt(receipt, output, "index.html"), /missing public content receipt/u);
  } finally { await rm(output, { recursive: true, force: true }); }
});
