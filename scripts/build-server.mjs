import { build } from "esbuild";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { buildProfile } from "./build-profile.mjs";
import { contentHash } from "./build-receipt.mjs";
const profile = buildProfile();
const outfile = profile === "public" ? "dist/server.mjs" : "dist/personal/server.mjs";
const result = await build({
  entryPoints: ["server/main.ts"], outfile, bundle: true,
  metafile: true, platform: "node", target: "node24", format: "esm", packages: "external", sourcemap: true,
  plugins: profile === "personal" ? [{ name: "owner-integration-routes", setup(builder) {
    builder.onResolve({ filter: /\/optional-integration\.js$/ }, () => ({ path: resolve("personal/server/routes.ts") }));
  } }] : [],
});
await writeFile(`${outfile}.profile.json`, JSON.stringify({
  profile, inputs: Object.keys(result.metafile.inputs).sort(),
  files: { "server.mjs": contentHash(await readFile(outfile)) },
}) + "\n");
