import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { nativeSourceDigest } from "../scripts/macos-source-digest.mjs";

describe("macOS source digest", () => {
  it("includes native source files while excluding ignored local Xcode state", async () => {
    const result = await nativeSourceDigest();

    expect(result.files).toContain("apps/macos/Sources/Models/ReviewSummary.swift");
    expect(result.files.some((file) => file.includes("/.swiftpm/"))).toBe(false);
    expect(result.files.some((file) => file.includes("/xcuserdata/"))).toBe(false);
  });

  it("digests a source archive without Git metadata, including paths with spaces", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "todo source archive "));
    try {
      await mkdir(path.join(root, "apps/macos/Sources"), { recursive: true });
      await mkdir(path.join(root, "apps/macos/.build"));
      await mkdir(path.join(root, "apps/macos/xcuserdata"));
      await writeFile(path.join(root, "apps/macos/Sources/Fixture.swift"), "struct Fixture {}\n");
      await writeFile(path.join(root, "apps/macos/Package.swift"), "// source fixture\n");
      await writeFile(path.join(root, "apps/macos/.build/cache"), "ignored build output");
      await writeFile(path.join(root, "apps/macos/xcuserdata/local.xcuserstate"), "ignored editor state");
      const first = await nativeSourceDigest(root);
      expect(first.files).toEqual(["apps/macos/Package.swift", "apps/macos/Sources/Fixture.swift"]);
      await writeFile(path.join(root, "apps/macos/.build/cache"), "changed ignored output");
      expect((await nativeSourceDigest(root)).digest).toBe(first.digest);
      await writeFile(path.join(root, "apps/macos/Sources/Fixture.swift"), "struct ChangedFixture {}\n");
      expect((await nativeSourceDigest(root)).digest).not.toBe(first.digest);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
