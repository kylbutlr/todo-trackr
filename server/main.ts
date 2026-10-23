import { createServer, type IncomingMessage } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { closeDatabase, database } from "../netlify/functions/lib/database.js";
import { authenticationMode, installationCapabilities, isLoopback, publicOrigin } from "../netlify/functions/lib/installation.js";
import { verifyPassword } from "../netlify/functions/lib/auth.js";
import { deliverDueAlarms } from "./alarms.js";
import { handleRequest } from "./http.js";

process.env.TODO_TRACKER_RUNTIME = "standalone";
const origin = publicOrigin();
const host = process.env.TODO_TRACKER_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.TODO_TRACKER_PORT || "8888");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid server port.");
installationCapabilities();
if (authenticationMode() === "password") {
  verifyPassword("startup-configuration-check");
  if ((process.env.SESSION_SIGNING_SECRET?.trim().length ?? 0) < 32) throw new Error("Set a session-signing secret of at least 32 characters.");
} else if ((!isLoopback(host) || !isLoopback(origin.hostname)) && process.env.TODO_TRACKER_ALLOW_UNAUTHENTICATED_REMOTE !== "true") {
  throw new Error("Passwordless access outside a loopback listener requires explicit TODO_TRACKER_ALLOW_UNAUTHENTICATED_REMOTE=true and a private access boundary.");
}

async function requestBody(message: IncomingMessage): Promise<ArrayBuffer | undefined> {
  if (message.method === "GET" || message.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of message) {
    length += chunk.length;
    if (length > 8 * 1024 * 1024) throw new Error("BODY_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  return Uint8Array.from(Buffer.concat(chunks)).buffer;
}

await database().query("SELECT 1");
const shutdown = new AbortController();
const server = createServer(async (message, reply) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(message.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    // Rate limits use the transport peer. Forwarded headers are not proof of identity.
    headers.delete("x-forwarded-for");
    headers.set("x-nf-client-connection-ip", message.socket.remoteAddress || "unknown");
    const request = new Request(new URL(message.url || "/", origin), {
      method: message.method, headers, body: await requestBody(message),
    });
    const response = await handleRequest(request);
    reply.writeHead(response.status, Object.fromEntries(response.headers));
    reply.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const oversized = error instanceof Error && error.message === "BODY_TOO_LARGE";
    reply.writeHead(oversized ? 413 : 500, { "content-type": "application/json" });
    reply.end(JSON.stringify({ error: oversized ? "Request body is too large." : "Unexpected server error." }));
    if (!oversized) console.error("Request handling failed.");
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
try {
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once("error", failed);
    server.listen(port, host, () => {
      server.removeListener("error", failed);
      resolve();
    });
  });
} catch (error) {
  await closeDatabase();
  throw error;
}
console.log(`Todo Trackr listening at ${origin.origin} (${authenticationMode()} authentication).`);

const alarmWorker = (async () => {
  while (!shutdown.signal.aborted) {
    try { await deliverDueAlarms(); } catch { console.error("Alarm delivery failed; the next scan will retry pending alarms."); }
    try { await delay(15_000, undefined, { signal: shutdown.signal }); } catch { break; }
  }
})();

async function stop() {
  if (shutdown.signal.aborted) return;
  shutdown.abort();
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await alarmWorker;
  await closeDatabase();
}
process.on("SIGINT", () => { void stop(); });
process.on("SIGTERM", () => { void stop(); });
server.on("error", (error) => {
  console.error("Server failed:", error.message);
  process.exitCode = 1;
  void stop();
});
