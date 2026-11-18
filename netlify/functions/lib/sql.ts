export type Row = Record<string, unknown>;
export type Statement = { text: string; values: unknown[] };
export type Query = PromiseLike<Row[]>;
export interface Database {
  (strings: TemplateStringsArray, ...values: unknown[]): Query;
  query(text: string, values?: unknown[]): Query;
  transaction(build: (sql: Database) => Query[]): Promise<Row[][]>;
}

// Queries stay lazy so a transaction builder cannot accidentally execute them
// through the pool before BEGIN. The same interface serves both drivers.
export function createDatabase(
  execute: (statement: Statement) => Promise<Row[]>,
  transaction: (statements: Statement[]) => Promise<Row[][]>,
): Database {
  const statements = new WeakMap<Query, Statement>();
  function query(text: string, values: unknown[] = []): Query {
    let result: Promise<Row[]> | undefined;
    const statement = { text, values };
    const deferred: Query = {
      then(onfulfilled, onrejected) {
        result ??= execute(statement);
        return result.then(onfulfilled, onrejected);
      },
    };
    statements.set(deferred, statement);
    return deferred;
  }
  const sql: Database = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => query(
      strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""),
      values,
    ),
    {
      query,
      async transaction(build: (tx: Database) => Query[]) {
        const plans = build(sql).map((item) => {
          const statement = statements.get(item);
          if (!statement) throw new Error("Transaction contains a query from another database.");
          return statement;
        });
        return transaction(plans);
      },
    },
  );
  return sql;
}
