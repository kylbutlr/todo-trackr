import { scryptSync } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import {
  createSessionToken,
  requireSession,
  verifyPassword,
} from "../netlify/functions/lib/auth.js";
describe("authentication", () => {
  beforeAll(() => {
    const salt = Buffer.from("todo-tracker-test-salt");
    const hash = scryptSync("a-correct-test-password", salt, 64);
    process.env.TODO_TRACKER_PASSWORD_HASH = `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
    process.env.SESSION_SIGNING_SECRET = "test-signing-secret-that-is-longer-than-32-characters";
  });

  it("verifies only the configured password", () => {
    expect(verifyPassword("a-correct-test-password")).toBe(true);
    expect(verifyPassword("an-incorrect-password")).toBe(false);
  });

  it("accepts a signed bearer session", async () => {
    const token = await createSessionToken();
    const request = new Request("https://todo.example/api/tasks", {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(requireSession(request)).resolves.toBeUndefined();
  });

  it("rejects a missing session", async () => {
    const request = new Request("https://todo.example/api/tasks");

    await expect(requireSession(request)).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
  });
});
