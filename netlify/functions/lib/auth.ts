import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { requireEnvironment } from "./config.js";
import { database } from "./database.js";
import { HttpError } from "./http.js";
import { authenticationMode } from "./installation.js";

const cookieName = "todo_tracker_session";
const issuer = "todo-tracker";
const audience = "todo-tracker-api";
const maxLoginAttempts = 5;

function signingKey(): Uint8Array {
  const secret = requireEnvironment("SESSION_SIGNING_SECRET");

  if (secret.length < 32) {
    throw new Error("SESSION_SIGNING_SECRET must be at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(signingKey());
}

export function sessionCookie(token: string, secure = true): string {
  const maxAge = 60 * 60 * 24 * 7;
  return `${cookieName}=${token}; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Strict; Max-Age=${maxAge}`;
}

export function expiredSessionCookie(secure = true): string {
  return `${cookieName}=; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Strict; Max-Age=0`;
}

function cookieValue(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === cookieName) {
      return rest.join("=");
    }
  }

  return undefined;
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export async function requireSession(request: Request): Promise<void> {
  if (authenticationMode() === "none") return;
  const token = bearerToken(request) ?? cookieValue(request);

  if (!token) {
    throw new HttpError(401, "Authentication required.");
  }

  try {
    const result = await jwtVerify(token, signingKey(), {
      issuer,
      audience,
      subject: "owner",
    });

    if (result.payload.role !== "owner") {
      throw new Error("Unexpected session role.");
    }
  } catch {
    throw new HttpError(401, "Session expired or invalid.");
  }
}

export function verifyPassword(password: string): boolean {
  const encoded = requireEnvironment("TODO_TRACKER_PASSWORD_HASH");
  const [scheme, saltBase64, hashBase64] = encoded.split("$");

  if (scheme !== "scrypt" || !saltBase64 || !hashBase64) {
    throw new Error("TODO_TRACKER_PASSWORD_HASH has an invalid format.");
  }

  const expected = Buffer.from(hashBase64, "base64");
  const actual = scryptSync(password, Buffer.from(saltBase64, "base64"), expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function loginFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-nf-client-connection-ip") ?? forwarded ?? "unknown";

  return createHmac("sha256", requireEnvironment("SESSION_SIGNING_SECRET"))
    .update(address)
    .digest("hex");
}

export async function assertLoginAllowed(request: Request): Promise<string> {
  const fingerprint = loginFingerprint(request);
  const sql = database();
  const rows = (await sql`
    SELECT count(*)::int AS count
    FROM auth_attempts
    WHERE fingerprint = ${fingerprint}
      AND attempted_at > now() - interval '15 minutes'
  `) as Array<{ count: number }>;

  if ((rows[0]?.count ?? 0) >= maxLoginAttempts) {
    throw new HttpError(429, "Too many login attempts. Try again later.");
  }

  return fingerprint;
}

export async function recordFailedLogin(fingerprint: string): Promise<void> {
  const sql = database();

  await sql`
    INSERT INTO auth_attempts (fingerprint)
    VALUES (${fingerprint})
  `;

  await sql`
    DELETE FROM auth_attempts
    WHERE attempted_at < now() - interval '1 day'
  `;
}

export async function clearFailedLogins(fingerprint: string): Promise<void> {
  const sql = database();

  await sql`
    DELETE FROM auth_attempts
    WHERE fingerprint = ${fingerprint}
  `;
}
