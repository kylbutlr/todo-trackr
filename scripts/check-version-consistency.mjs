import { readFileSync } from "node:fs";

const repositoryRoot = new URL("../", import.meta.url);

function file(relativePath) {
  return readFileSync(new URL(relativePath, repositoryRoot), "utf8");
}

function plistValue(contents, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = contents.match(new RegExp(`<key>${escapedKey}</key>\\s*<string>([^<]+)</string>`, "u"));
  if (!match) throw new Error(`Info.plist does not contain ${key}.`);
  return match[1];
}

const rootPackage = JSON.parse(file("package.json"));
const webPackage = JSON.parse(file("apps/web/package.json"));
const packageLock = JSON.parse(file("package-lock.json"));
const browserExtensionManifest = JSON.parse(file("apps/browser-extension/manifest.json"));
const nativeVersion = plistValue(file("apps/macos/Resources/Info.plist"), "CFBundleShortVersionString");
const expectedVersion = rootPackage.version;
const release = JSON.parse(file("release.json"));
if (release.tag !== `v${expectedVersion}` || !["source", "notarized"].includes(release.distribution?.macos)) {
  throw new Error("Release tag or macOS distribution mode is inconsistent.");
}

if (!/^\d+\.\d+\.\d+$/u.test(expectedVersion)) {
  throw new Error(`Todo Trackr version ${expectedVersion} must use major.minor.patch format.`);
}

const versions = new Map([
  ["package.json", rootPackage.version],
  ["release.json", release.version],
  ["apps/web/package.json", webPackage.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json root package", packageLock.packages?.[""]?.version],
  ["package-lock.json web workspace", packageLock.packages?.["apps/web"]?.version],
  ["apps/macos/Resources/Info.plist", nativeVersion],
  ["apps/browser-extension/manifest.json", browserExtensionManifest.version],
]);
const mismatchedVersions = [...versions].filter(([, value]) => value !== expectedVersion);

if (mismatchedVersions.length > 0) {
  throw new Error(
    `Todo Trackr product versions must match ${expectedVersion}: ${mismatchedVersions
      .map(([path, value]) => `${path}=${value}`)
      .join(", ")}`,
  );
}

console.log(`Verified unified Todo Trackr version ${expectedVersion} across web, macOS, and browser extension.`);
