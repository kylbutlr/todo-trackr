import { afterEach, expect, test } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ciComparison } from "../scripts/ci-comparison.mjs";

const zero = "0".repeat(40);
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "todo-ci-bootstrap-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (path: string, contents: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), contents); };
  const identity = () => {
    for (const key of ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]) expect(git("var", key)).toMatch(/^Kyle Butler <kylbutlr@gmail\.com> /u);
  };
  const commit = (message = "Synthetic CI fixture") => { identity(); git("add", "."); git("-c", "commit.gpgsign=false", "commit", "-qm", message); return git("rev-parse", "HEAD"); };
  git("init", "--quiet", "--initial-branch=kylebutler/ci-fixture");
  git("config", "user.name", "Kyle Butler"); git("config", "user.email", "kylbutlr@gmail.com");
  for (const name of ["ci-comparison.mjs", "check-changed-lines.mjs", "check-macos-release-consistency.mjs", "check-version-consistency.mjs"]) {
    mkdirSync(join(root, "scripts"), { recursive: true });
    cpSync(new URL(`../scripts/${name}`, import.meta.url), join(root, "scripts", name));
  }
  const version = "1.0.0";
  write("package.json", JSON.stringify({ version, type: "module" }));
  write("apps/web/package.json", JSON.stringify({ version }));
  write("apps/browser-extension-public/manifest.json", JSON.stringify({ version }));
  write("package-lock.json", JSON.stringify({ version, packages: { "": { version }, "apps/web": { version } } }));
  write("release.json", JSON.stringify({ version, tag: "v1.0.0", distribution: { macos: "source" } }));
  write("apps/macos/Resources/Info.plist", "<plist><key>CFBundleShortVersionString</key><string>1.0.0</string></plist>\n");
  write("apps/macos/Sources/Example.swift", "// Synthetic native source\n");
  write("apps/web/public/updates/legacy.txt", "synthetic preserved update\n");
  write("README.md", "Synthetic root import\n");
  const original = commit(); git("tag", "v1.0.0");
  identity();
  const head = execFileSync("git", ["commit-tree", git("rev-parse", "HEAD^{tree}")], { cwd: root, input: "Synthetic parentless import\n", encoding: "utf8" }).trim();
  git("update-ref", "refs/heads/kylebutler/ci-fixture", head);
  const event = { created: true, deleted: false, before: zero, after: head, ref: "refs/heads/main", repository: { full_name: "fixture-owner/example" } };
  const eventPath = join(root, ".git", "push-event.json");
  const env = { ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: head, GITHUB_REF: event.ref, GITHUB_REPOSITORY: event.repository.full_name };
  const saveEvent = () => writeFileSync(eventPath, JSON.stringify(event));
  saveEvent();
  const run = (name: string, base = zero, overrides = {}) => spawnSync(process.execPath, [`scripts/${name}`, base], { cwd: root, env: { ...env, ...overrides }, encoding: "utf8" });
  const native = () => run("check-macos-release-consistency.mjs");
  return { root, git, write, commit, original, head, event, env, saveEvent, run, native };
}

// These use real synthetic Git histories, not mocked revision strings.
test("verified parentless first push checks the whole tree with retained history in tags", () => {
  const f = fixture();
  expect(ciComparison(zero, { cwd: f.root, env: f.env }).initialPush).toBe(true);
  expect(f.run("check-changed-lines.mjs").status).toBe(0);
  expect(f.git("rev-list", "--count", "HEAD")).toBe("1");
  expect(f.git("rev-parse", "refs/tags/v1.0.0")).toBe(f.original);
});

test.each(["pr", "not-created", "deleted", "wrong-before", "wrong-after", "wrong-ref", "wrong-repository", "missing-event", "malformed-event", "wrong-env-head", "missing-repository", "wrong-env-ref"])("zero base rejects %s evidence", (kind) => {
  const f = fixture();
  if (kind === "pr") f.env.GITHUB_EVENT_NAME = "pull_request";
  if (kind === "not-created") f.event.created = false;
  if (kind === "deleted") f.event.deleted = true;
  if (kind === "wrong-before") f.event.before = "1".repeat(40);
  if (kind === "wrong-after") f.event.after = f.original;
  if (kind === "wrong-ref") f.event.ref = "refs/heads/other";
  if (kind === "wrong-repository") f.event.repository.full_name = "fixture-owner/other";
  if (kind === "wrong-env-head") f.env.GITHUB_SHA = f.original;
  if (kind === "missing-repository") f.env.GITHUB_REPOSITORY = "";
  if (kind === "wrong-env-ref") f.env.GITHUB_REF = "refs/heads/other";
  f.saveEvent();
  if (kind === "missing-event") f.env.GITHUB_EVENT_PATH = join(f.root, "absent.json");
  if (kind === "malformed-event") writeFileSync(f.env.GITHUB_EVENT_PATH, "{");
  expect(() => ciComparison(zero, { cwd: f.root, env: f.env })).toThrow();
});

test("branch creation with existing ancestry cannot use the bootstrap exception", () => {
  const f = fixture(); f.write("extra.txt", "synthetic child\n"); const child = f.commit();
  f.event.after = child; f.env.GITHUB_SHA = child; f.saveEvent();
  expect(() => ciComparison(zero, { cwd: f.root, env: f.env })).toThrow(/parentless/u);
});

test.each(["push", "pull_request"])("normal %s keeps its real merge-base comparison", (event) => {
  const f = fixture(); f.write("extra.txt", "synthetic change\n"); f.commit();
  expect(ciComparison(f.head, { cwd: f.root, env: { ...f.env, GITHUB_EVENT_NAME: event } }).diffArguments).toEqual([`${f.head}...HEAD`]);
  expect(f.run("check-changed-lines.mjs", f.head).status).toBe(0);
});

test.each([undefined, "", "not-a-revision", "1".repeat(40)])("missing or invalid ordinary base fails closed: %s", (base) => {
  const f = fixture(); expect(() => ciComparison(base, { cwd: f.root, env: f.env })).toThrow();
});

test("unrelated retained tag is not silently used as a normal push base", () => {
  const f = fixture(); expect(() => ciComparison(f.original, { cwd: f.root, env: f.env })).toThrow();
});

test("initial import whitespace failure is detected", () => {
  const f = fixture(); f.write("README.md", "bad whitespace \n"); f.git("add", "README.md");
  // Create a second synthetic root with malformed content, preserving tag ancestry.
  for (const key of ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]) expect(f.git("var", key)).toMatch(/^Kyle Butler <kylbutlr@gmail\.com> /u);
  const head = execFileSync("git", ["commit-tree", f.git("write-tree")], { cwd: f.root, input: "Synthetic whitespace failure\n", encoding: "utf8" }).trim();
  f.git("update-ref", "refs/heads/kylebutler/ci-fixture", head); f.event.after = head; f.env.GITHUB_SHA = head; f.saveEvent();
  expect(f.run("check-changed-lines.mjs").status).not.toBe(0);
});

test("source import passes with original historical update assets unchanged", () => {
  const f = fixture(); const result = f.native(); expect(result.status, result.stderr).toBe(0);
});

test.each(["missing-tag", "root-tag", "wrong-metadata", "changed-asset", "new-asset", "untracked-asset", "removed-asset", "feed-enabled", "wrong-version", "binary-mode"])("source import rejects %s", (kind) => {
  const f = fixture();
  if (kind === "missing-tag") f.git("update-ref", "-d", "refs/tags/v1.0.0");
  if (kind === "root-tag") f.git("update-ref", "refs/tags/v1.0.0", f.head);
  if (kind === "wrong-metadata") f.write("release.json", JSON.stringify({ version: "1.0.0", tag: "v9.0.0", distribution: { macos: "source" } }));
  if (kind === "changed-asset") f.write("apps/web/public/updates/legacy.txt", "changed\n");
  if (kind === "new-asset") { f.write("apps/web/public/updates/new.txt", "new\n"); f.git("add", "apps/web/public/updates/new.txt"); }
  if (kind === "untracked-asset") f.write("apps/web/public/updates/untracked.txt", "synthetic untracked update\n");
  if (kind === "removed-asset") rmSync(join(f.root, "apps/web/public/updates/legacy.txt"));
  if (kind === "feed-enabled") f.write("apps/macos/Resources/Info.plist", "<key>CFBundleShortVersionString</key><string>1.0.0</string><key>SUFeedURL</key>");
  if (kind === "wrong-version") f.write("apps/web/package.json", JSON.stringify({ version: "9.0.0" }));
  if (kind === "binary-mode") f.write("release.json", JSON.stringify({ version: "1.0.0", tag: "v1.0.0", distribution: { macos: "notarized" } }));
  expect(f.native().status).not.toBe(0);
});

test("normal source updates still reject signed-update changes", () => {
  const f = fixture(); f.write("apps/web/public/updates/legacy.txt", "changed\n"); f.write("apps/macos/Sources/Example.swift", "// changed\n");
  const result = f.run("check-macos-release-consistency.mjs", f.head);
  expect(result.status).not.toBe(0); expect(result.stderr).toContain("must not modify signed update assets");
});

test("normal native preflight includes untracked native source", () => {
  const f = fixture(); f.write("apps/macos/Sources/New.swift", "// synthetic pending source\n"); f.write("apps/web/package.json", JSON.stringify({ version: "9.0.0" }));
  expect(f.run("check-macos-release-consistency.mjs", f.head).status).not.toBe(0);
});

test("normal binary release still requires all signed release changes", () => {
  const f = fixture(); f.write("apps/macos/Sources/Example.swift", "// changed\n"); f.write("release.json", JSON.stringify({ version: "1.0.0", tag: "v1.0.0", distribution: { macos: "notarized" } }));
  const result = f.run("check-macos-release-consistency.mjs", f.head);
  expect(result.status).not.toBe(0); expect(result.stderr).toContain("Missing changed files");
});


test("ordinary push whitespace checks still reject a bad committed line", () => {
  const f = fixture(); f.write("README.md", "bad line \n"); f.commit();
  expect(f.run("check-changed-lines.mjs", f.head).status).not.toBe(0);
});
