import { createHash } from "node:crypto";

const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers,
    },
  });
}

export function noContent(headers?: HeadersInit): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function conditionalJson(request: Request, data: unknown): Response {
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  const headers = {
    "cache-control": "private, no-cache",
    etag,
    vary: "authorization, cookie",
  };

  if (request.headers.get("if-none-match")?.split(",").map((value) => value.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, {
    status: 200,
    headers: {
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}
