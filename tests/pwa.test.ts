import { existsSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

type WebManifest = {
  display: string;
  icons: Array<{ sizes: string; src: string; type: string }>;
  name: string;
  start_url: string;
  theme_color: string;
};

const repositoryRoot = new URL("../", import.meta.url);
const webRoot = new URL("apps/web/", repositoryRoot);
const manifest = JSON.parse(
  readFileSync(new URL("public/manifest.webmanifest", webRoot), "utf8"),
) as WebManifest;
const document = readFileSync(new URL("index.html", webRoot), "utf8");
const main = readFileSync(new URL("src/main.tsx", webRoot), "utf8");
const api = readFileSync(new URL("src/api.ts", webRoot), "utf8");
const styles = readFileSync(new URL("src/styles.css", webRoot), "utf8");
const serviceWorker = readFileSync(new URL("public/sw.js", webRoot), "utf8");

describe("Todo Trackr Home Screen app", () => {
  it("declares a standalone dark web app", () => {
    expect(manifest.name).toBe("Todo Trackr");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#0E0E10");
    expect(document).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(document).toContain("viewport-fit=cover");
  });

  it("provides iPhone and manifest icons", () => {
    const iconPaths = [
      "public/apple-touch-icon.png",
      ...manifest.icons.map((icon) => `public${icon.src}`),
    ];

    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
    for (const path of iconPaths) {
      const url = new URL(path, webRoot);
      expect(existsSync(url)).toBe(true);
      expect(statSync(url).size).toBeGreaterThan(0);
    }
  });

  it("registers shell caching only in production", () => {
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain('serviceWorker.register("/sw.js"');
    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/.netlify/functions/")');
    expect(serviceWorker).toContain('self.addEventListener("push"');
    expect(serviceWorker).toContain('self.addEventListener("notificationclick"');
    expect(api).toContain('cache: init?.cache ?? "no-store"');
    expect(api).toContain('{ cache: "no-cache" }');
  });

  it("accounts for iPhone safe areas and compact task details", () => {
    expect(styles).toContain("env(safe-area-inset-top)");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".detail-overlay.is-open");
  });
});
