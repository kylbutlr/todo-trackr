import { describe, expect, it } from "vitest";

import { nativeSourceDigest } from "../scripts/macos-source-digest.mjs";

describe("macOS source digest", () => {
  it("includes native source files while excluding ignored local Xcode state", async () => {
    const result = await nativeSourceDigest();

    expect(result.files).toContain("apps/macos/Sources/Models/ReviewSummary.swift");
    expect(result.files.some((file) => file.includes("/.swiftpm/"))).toBe(false);
    expect(result.files.some((file) => file.includes("/xcuserdata/"))).toBe(false);
  });
});
