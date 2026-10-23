import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

import { requireEnvironment } from "./config.js";
import { isStandalone } from "./installation.js";
import { createDatabase, type Database } from "./sql.js";

let pool: Pool | undefined;
let standaloneDatabase: Database | undefined;

export function database(): Database {
  if (!isStandalone()) {
    const sql = neon(requireEnvironment("DATABASE_URL"));
    return createDatabase(
      async ({ text, values }) => sql.query(text, values),
      async (statements) => sql.transaction(statements.map(({ text, values }) => sql.query(text, values))),
    );
  }
  if (standaloneDatabase) return standaloneDatabase;
  pool = new Pool({ connectionString: requireEnvironment("DATABASE_URL"), max: 5, connectionTimeoutMillis: 10_000 });
  const connectionPool = pool;
  connectionPool.on("error", () => console.error("Idle PostgreSQL connection failed."));
  standaloneDatabase = createDatabase(
    async ({ text, values }) => (await connectionPool.query(text, values)).rows,
    async (statements) => {
      const client = await connectionPool.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const { text, values } of statements) results.push((await client.query(text, values)).rows);
        await client.query("COMMIT");
        return results;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
        throw error;
      } finally {
        client.release();
      }
    },
  );
  return standaloneDatabase;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  standaloneDatabase = undefined;
}
