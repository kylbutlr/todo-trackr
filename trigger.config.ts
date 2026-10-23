import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_patwitpayvznbucohnpn",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
