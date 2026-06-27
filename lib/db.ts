import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database connection (postgres-js driver).
 *
 * Works with ANY Postgres — Neon (use the pooled connection string), Supabase,
 * RDS, or a local/Docker Postgres — so the same code runs in dev, Docker, and
 * serverless. `DATABASE_URL` is required in production; if it's unset, `db` is
 * `null` and the query layer no-ops so the app can still boot (e.g. before the
 * database is provisioned) without crashing at import time.
 *
 * A single client is cached on `globalThis` to survive Next.js HMR and to keep
 * the connection count low in serverless environments.
 */
export const isDbEnabled = Boolean(process.env.DATABASE_URL);

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

const client = isDbEnabled
  ? (globalForDb.__pgClient ??= postgres(process.env.DATABASE_URL!, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      // Neon/serverless connection strings already include sslmode; postgres-js
      // honors it. `prepare: false` plays nicely with transaction poolers.
      prepare: false,
    }))
  : null;

export const db = client ? drizzle(client, { schema }) : null;

export type Database = NonNullable<typeof db>;

export function requireDb(): Database {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. This action requires a Postgres database.",
    );
  }
  return db;
}

export { schema };
