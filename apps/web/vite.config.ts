import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const profile = process.env.TODO_TRACKR_BUILD_PROFILE ?? "public";
if (!["public", "personal"].includes(profile)) throw new Error("Unknown Todo Trackr build profile");
export default defineConfig({
  plugins: [react(), { name: "build-profile-receipt", async writeBundle(output, bundle) {
    if (!output.dir) throw new Error("Build receipt requires an output directory");
    const directory = output.dir;
    // HTML is emitted by Vite late in generateBundle. Hash the final written output.
    const files = Object.fromEntries(await Promise.all(Object.keys(bundle).map(async name => [
      name, createHash("sha256").update(await readFile(join(directory, name))).digest("hex"),
    ])));
    await writeFile(join(directory, "build-profile.json"), JSON.stringify({ profile, files }) + "\n");
  } }, ...(profile === "personal" ? [{
    name: "owner-integration-settings", enforce: "pre" as const,
    resolveId(source: string) {
      if (source === "./OptionalIntegrationSettings") return fileURLToPath(new URL("../../personal/web/WorkProviderSettingsView.tsx", import.meta.url));
    },
  }] : [])],
  build: { outDir: profile === "personal" ? "dist-personal" : "dist" },
});
