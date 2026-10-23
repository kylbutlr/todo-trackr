import { timingSafeEqual } from "node:crypto";

import { requireEnvironment } from "../config.js";
import { HttpError } from "../http.js";

export function requireAutomationIngestAuthorization(request: Request): void {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const expected = requireEnvironment("TODO_TRACKR_INGEST_TOKEN");
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);

  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    throw new HttpError(401, "Invalid automation ingest token.");
  }
}
