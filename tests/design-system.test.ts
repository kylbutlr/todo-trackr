import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

type AppStylrManifest = {
  exceptions: string;
  name: string;
  release: string;
  theme: "dark" | "light";
  version: string;
};

type Tokens = {
  brand: Record<string, string>;
  themes: {
    dark: Record<string, string>;
    light: Record<string, string>;
  };
  typography: {
    families: {
      mono: string;
      sans: string;
    };
  };
  version: string;
};

const repositoryRoot = new URL("../", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("app-stylr.json", repositoryRoot), "utf8"),
) as AppStylrManifest;
const tokens = JSON.parse(
  readFileSync(new URL("design/tokens.json", repositoryRoot), "utf8"),
) as Tokens;
const appStylrCss = readFileSync(
  new URL("design/app-stylr.css", repositoryRoot),
  "utf8",
);
const appStylrSwift = readFileSync(
  new URL("apps/macos/Sources/Design/AppStylrTokens.swift", repositoryRoot),
  "utf8",
);
const appStylrExceptions = readFileSync(
  new URL("docs/app-stylr-exceptions.md", repositoryRoot),
  "utf8",
);
const webStyles = readFileSync(
  new URL("apps/web/src/styles.css", repositoryRoot),
  "utf8",
);
const webDocument = readFileSync(
  new URL("apps/web/index.html", repositoryRoot),
  "utf8",
);

function cssName(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function sha256(path: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(path, repositoryRoot)))
    .digest("hex");
}

describe("App Stylr adoption", () => {
  it("pins the complete v1.2.0 source consumer contract", () => {
    expect(manifest).toEqual({
      name: "App Stylr",
      version: "1.2.0",
      sourceRevision: "b3ca31ea264d5dd233fd871ac167247f1c306985",
      release: "https://github.com/kylbutlr/app-stylr/tree/b3ca31ea264d5dd233fd871ac167247f1c306985",
      theme: "dark",
      exceptions: "docs/app-stylr-exceptions.md",
    });
  });

  it("keeps web and native adapters on the same pin", () => {
    expect(tokens.version).toBe(manifest.version);
    expect(appStylrCss).toContain(`--app-stylr-version: "${manifest.version}"`);
    expect(appStylrSwift).toContain(`public static let version = "${manifest.version}"`);
    expect(webStyles).toContain('@import "../../../design/app-stylr.css";');
  });

  it("exposes every canonical brand and dark-theme color through the web adapter", () => {
    for (const [name, value] of Object.entries(tokens.brand)) {
      expect(appStylrCss).toContain(`--brand-${cssName(name)}: ${value};`);
    }

    for (const [name, value] of Object.entries(tokens.themes.dark)) {
      expect(appStylrCss).toContain(`--ui-${cssName(name)}: ${value};`);
    }

    expect(webStyles).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("uses and bundles the pinned Geist fonts for both clients", () => {
    expect(tokens.typography.families.sans).toBe("Geist Sans");
    expect(tokens.typography.families.mono).toBe("Geist Mono");
    expect(webStyles).toContain(`font-family: "${tokens.typography.families.sans}"`);
    expect(webStyles).toContain(`font-family: "${tokens.typography.families.mono}"`);

    const fontPaths = [
      "apps/web/public/fonts/Geist-Variable.woff2",
      "apps/web/public/fonts/GeistMono-Variable.woff2",
      "apps/macos/Sources/Resources/Fonts/Geist-Variable.ttf",
      "apps/macos/Sources/Resources/Fonts/GeistMono-Variable.ttf",
    ];

    for (const path of fontPaths) {
      const url = new URL(path, repositoryRoot);
      expect(existsSync(url)).toBe(true);
      expect(statSync(url).size).toBeGreaterThan(0);
    }

    expect(sha256(fontPaths[0])).toBe(
      "a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8",
    );
    expect(sha256(fontPaths[1])).toBe(
      "fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab",
    );
  });

  it("declares the dark theme and shared app icon in the web shell", () => {
    expect(webDocument).toContain('data-app-stylr-theme="dark"');

    const faviconPath = new URL("apps/web/public/favicon.svg", repositoryRoot);
    expect(existsSync(faviconPath)).toBe(true);
    expect(statSync(faviconPath).size).toBeGreaterThan(0);
    expect(webDocument).toContain('rel="icon" href="/favicon.svg"');
    expect(webDocument).toContain('name="theme-color" content="#0E0E10"');
  });

  it("places the App Stylr icon highlight in the upper-right", () => {
    const iconRenderer = readFileSync(
      new URL("scripts/render-macos-icon.swift", repositoryRoot),
      "utf8",
    );

    expect(iconRenderer).toContain("gradient.draw(in: iconPath, angle: 45)");
  });
});
