import { configDefaults, defineConfig } from "vitest/config";
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "tests/self-hosted.integration.test.ts"] } });
