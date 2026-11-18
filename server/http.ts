import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { publicOrigin } from "../netlify/functions/lib/installation.js";
import api from "../netlify/functions/api.mjs";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

export async function handleRequest(request: Request, webRoot = resolve("apps/web/dist")): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (host !== publicOrigin().host) return new Response("Unrecognized server address.", { status: 421 });
  if (url.pathname === "/healthz" && request.method === "GET") return Response.json({ status: "ok" });
  if (url.pathname.startsWith("/api/")) return api(request);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return new Response(null, { status: 400 }); }
  const root = resolve(webRoot);
  const target = resolve(root, `.${path}`);
  if (target !== root && !target.startsWith(`${root}/`)) return new Response(null, { status: 404 });
  // Release archives and provenance are distributed separately from the server.
  if (path.startsWith("/updates/") || path.split("/").some((part) => part.startsWith("."))) return new Response(null, { status: 404 });
  try {
    const file = path === "/" ? resolve(root, "index.html") : target;
    const bytes = await readFile(file);
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: {
        "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
        "cache-control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        ...(path === "/sw.js" ? { "service-worker-allowed": "/" } : {}),
      },
    });
  } catch {
    // App navigation uses query parameters; unknown paths must not hide missing files.
    return new Response("Not found.", { status: 404 });
  }
}
