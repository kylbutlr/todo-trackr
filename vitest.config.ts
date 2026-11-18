import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const personal = process.env.TODO_TRACKR_BUILD_PROFILE === "personal";
export default defineConfig({
  plugins: personal ? [{ name: "owner-integration-routes", enforce: "pre", resolveId(source) {
    if (source.endsWith("/optional-integration.js")) return fileURLToPath(new URL("./personal/server/routes.ts", import.meta.url));
  } }] : [],
  test: { exclude: [...configDefaults.exclude, "dist/**", "tests/self-hosted.integration.test.ts", "tests/radar-auth-local.integration.test.ts", ...(personal ? [] : ["tests/radar*", "tests/work-provider-safety.test.ts", "personal/**"])] },
});
