import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const zero = "0".repeat(40);

export function ciComparison(baseRevision, { cwd, env = process.env } = {}) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  if (!baseRevision) throw new Error("A base revision is required.");
  if (baseRevision !== zero) {
    const base = git("rev-parse", "--verify", "--end-of-options", `${baseRevision}^{commit}`);
    // Missing or unrelated history must fail, never become a bootstrap fallback.
    git("merge-base", base, "HEAD");
    return { initialPush: false, baseRevision: base, diffArguments: [`${base}...HEAD`] };
  }

  if (env.GITHUB_EVENT_NAME !== "push" || !env.GITHUB_EVENT_PATH) {
    throw new Error("A zero base requires a verified initial push event.");
  }
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const head = git("rev-parse", "HEAD");
  if (event.created !== true || event.deleted !== false || event.before !== zero ||
      event.after !== head || env.GITHUB_SHA !== head ||
      event.ref !== "refs/heads/main" || env.GITHUB_REF !== event.ref ||
      !env.GITHUB_REPOSITORY || event.repository?.full_name !== env.GITHUB_REPOSITORY ||
      git("rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/u).length !== 1) {
    throw new Error("A zero base is allowed only for a verified parentless initial main push.");
  }
  const emptyTree = execFileSync("git", ["hash-object", "-w", "-t", "tree", "--stdin"], {
    cwd, input: "", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  return { initialPush: true, baseRevision: null, diffArguments: [emptyTree, "HEAD"] };
}
