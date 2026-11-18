import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { ciComparison } from "./ci-comparison.mjs";

const repositoryRoot = new URL("../", import.meta.url);
const baseRevision = process.argv[2];

if (!baseRevision) {
  console.error("Usage: node scripts/check-macos-release-consistency.mjs BASE_REVISION");
  process.exit(64);
}

function git(...arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

function file(relativePath) {
  return readFileSync(new URL(relativePath, repositoryRoot), "utf8");
}

function plistValue(contents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = contents.match(new RegExp(`<key>${escapedKey}</key>\\s*<string>([^<]+)</string>`, "u"));
  if (!match) throw new Error(`Info.plist does not contain ${key}.`);
  return match[1];
}

function buildNumber(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) throw new Error(`macOS version ${version} is not major.minor.patch.`);
  const [, major, minor, patch] = match.map(Number);
  if ([major, minor, patch].some((component) => component > 999)) {
    throw new Error(`macOS version ${version} contains a component above 999.`);
  }
  return String((major * 1_000_000) + (minor * 1_000) + patch);
}

const comparison = ciComparison(baseRevision, { cwd: repositoryRoot });
// Local preflight must inspect pending work as well as committed changes.
// Otherwise an edited native tree reports success before its first commit.
const changedFiles = [...new Set([
  git("diff", "--name-only", ...comparison.diffArguments),
  git("diff", "--name-only", "HEAD"),
  git("ls-files", "--others", "--exclude-standard", "apps/macos"),
].flatMap((output) => output.split("\n").filter(Boolean)))];
const changed = new Set(changedFiles);
const nativeChanges = changedFiles.filter((path) => path.startsWith("apps/macos/"));

if (nativeChanges.length === 0) {
  console.log("No macOS application changes detected.");
  process.exit(0);
}

const release = JSON.parse(file("release.json"));
if (comparison.initialPush && release.distribution?.macos !== "source") {
  throw new Error("An initial import must use source distribution; a binary release requires a normal reviewed change.");
}
if (release.distribution?.macos === "source") {
  execFileSync(process.execPath, ["scripts/check-version-consistency.mjs"], { cwd: repositoryRoot, stdio: "inherit" });
  let updateChanges = changedFiles.filter((path) => path.startsWith("apps/web/public/updates/"));
  if (comparison.initialPush) {
    // Retained release tags are required. Never repoint them to the new root.
    const tag = `refs/tags/${release.tag}`;
    git("check-ref-format", tag);
    const original = git("rev-parse", "--verify", "--end-of-options", `${tag}^{commit}`);
    if (original === git("rev-parse", "HEAD")) throw new Error("The retained release tag must precede the import.");
    const previous = JSON.parse(git("show", `${original}:release.json`));
    if (previous.tag !== release.tag || previous.version !== release.version || previous.distribution?.macos !== "source") {
      throw new Error("The retained release tag does not match the source distribution metadata.");
    }
    // Existing historical assets may be imported unchanged; new or edited assets
    // still fail, including staged and unstaged local changes.
    updateChanges = [
      git("diff", "--name-only", original, "--", "apps/web/public/updates/"),
      git("ls-files", "--others", "--exclude-standard", "apps/web/public/updates/"),
    ].flatMap((output) => output.split("\n").filter(Boolean));
  }
  if (updateChanges.length > 0) {
    throw new Error("A source-only macOS release must not modify signed update assets. Select notarized distribution before publishing a binary update.");
  }
  if (file("apps/macos/Resources/Info.plist").includes("<key>SUFeedURL</key>")) {
    throw new Error("Source-only builds must not enable a binary update feed.");
  }
  console.log(`macOS ${release.tag} is distributed as source. No signed binary or appcast is being released.`);
  process.exit(0);
}
if (release.distribution?.macos !== "notarized") throw new Error("Invalid macOS distribution mode.");

const requiredChangedFiles = [
  "package.json",
  "package-lock.json",
  "apps/web/package.json",
  "apps/browser-extension-public/manifest.json",
  "apps/macos/Resources/Info.plist",
  "apps/web/public/updates/appcast.xml",
];
const missingChanges = requiredChangedFiles.filter((path) => !changed.has(path));
if (missingChanges.length > 0) {
  throw new Error(`macOS changes require a signed release update. Missing changed files: ${missingChanges.join(", ")}`);
}

const rootPackage = JSON.parse(file("package.json"));
const webPackage = JSON.parse(file("apps/web/package.json"));
const browserExtensionManifest = JSON.parse(file("apps/browser-extension-public/manifest.json"));
const packageLock = JSON.parse(file("package-lock.json"));
const infoPlist = file("apps/macos/Resources/Info.plist");
const appcast = file("apps/web/public/updates/appcast.xml");
const version = plistValue(infoPlist, "CFBundleShortVersionString");
const build = plistValue(infoPlist, "CFBundleVersion");
const expectedBuild = buildNumber(version);

const versions = new Map([
  ["package.json", rootPackage.version],
  ["apps/web/package.json", webPackage.version],
  ["apps/browser-extension-public/manifest.json", browserExtensionManifest.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json root package", packageLock.packages?.[""]?.version],
  ["package-lock.json web workspace", packageLock.packages?.["apps/web"]?.version],
]);
const mismatchedVersions = [...versions].filter(([, value]) => value !== version);
if (mismatchedVersions.length > 0) {
  throw new Error(`Version metadata must match ${version}: ${mismatchedVersions.map(([path, value]) => `${path}=${value}`).join(", ")}`);
}

if (build !== expectedBuild) {
  throw new Error(`CFBundleVersion ${build} does not match the expected build ${expectedBuild} for ${version}.`);
}

const previousInfoPlist = git("show", `${comparison.baseRevision}:apps/macos/Resources/Info.plist`);
const previousVersion = plistValue(previousInfoPlist, "CFBundleShortVersionString");
if (previousVersion === version) {
  throw new Error(`macOS source changed without incrementing CFBundleShortVersionString from ${version}.`);
}

const archivePath = `apps/web/public/updates/Todo-Trackr-${version}.zip`;
if (!changed.has(archivePath) || !existsSync(new URL(archivePath, repositoryRoot))) {
  throw new Error(`macOS release archive ${archivePath} must be generated and included in the change.`);
}

const provenancePath = `apps/web/public/updates/Todo-Trackr-${version}.source.json`;
if (!changed.has(provenancePath) || !existsSync(new URL(provenancePath, repositoryRoot))) {
  throw new Error(`macOS release source provenance ${provenancePath} must be generated and included in the change.`);
}
const provenance = JSON.parse(file(provenancePath));
const currentSourceDigest = execFileSync(
  process.execPath,
  ["scripts/macos-source-digest.mjs", "--digest-only"],
  { cwd: repositoryRoot, encoding: "utf8" },
).trim();
if (provenance.version !== version || String(provenance.build) !== build) {
  throw new Error(`${provenancePath} does not match macOS ${version} (${build}).`);
}
if (provenance.source?.algorithm !== "sha256" || provenance.source?.digest !== currentSourceDigest) {
  throw new Error(`${provenancePath} does not match the current apps/macos source tree. Regenerate the signed release after native changes.`);
}

const requiredAppcastContent = [
  `<sparkle:version>${build}</sparkle:version>`,
  `<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`,
  `Todo-Trackr-${version}.zip`,
  "sparkle:edSignature=",
  "<!-- sparkle-signatures:",
];
const missingAppcastContent = requiredAppcastContent.filter((value) => !appcast.includes(value));
if (missingAppcastContent.length > 0) {
  throw new Error(`Signed appcast is missing release metadata: ${missingAppcastContent.join(", ")}`);
}

console.log(`Verified macOS ${version} (${build}) release metadata for ${nativeChanges.length} native change(s).`);
