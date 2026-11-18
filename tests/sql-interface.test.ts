import { expect, it, vi } from "vitest";
import { createDatabase } from "../netlify/functions/lib/sql.js";

it("parameterizes values and executes a deferred query only once", async () => {
  const execute = vi.fn(async () => [{ id: "one" }]);
  const sql = createDatabase(execute, async () => []);
  const value = "'; DROP TABLE tasks; --";
  const query = sql`SELECT id FROM tasks WHERE title = ${value}`;
  expect(execute).not.toHaveBeenCalled();
  expect(await query).toEqual([{ id: "one" }]);
  await query;
  expect(execute).toHaveBeenCalledOnce();
  expect(execute).toHaveBeenCalledWith({ text: "SELECT id FROM tasks WHERE title = $1", values: [value] });
});

it("sends a transaction batch to one executor without pooled side effects", async () => {
  const execute = vi.fn(async () => []);
  const batch = vi.fn(async () => [[{ id: "saved" }]]);
  const sql = createDatabase(execute, batch);
  const result = await sql.transaction((tx) => [tx`INSERT INTO tasks VALUES (${"saved"}) RETURNING id`]);
  expect(execute).not.toHaveBeenCalled();
  expect(batch).toHaveBeenCalledWith([{ text: "INSERT INTO tasks VALUES ($1) RETURNING id", values: ["saved"] }]);
  expect(result).toEqual([[{ id: "saved" }]]);
});
