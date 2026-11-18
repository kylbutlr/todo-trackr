import { execFileSync } from "node:child_process";
import { ciComparison } from "./ci-comparison.mjs";

const cwd = new URL("../", import.meta.url);
const comparison = ciComparison(process.argv[2], { cwd });
execFileSync("git", ["diff", "--check", ...comparison.diffArguments], { cwd, stdio: "inherit" });
