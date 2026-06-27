import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Database connection.
 *
 * Demo-first design: if `DATABASE_URL` is not set, `db` is `null` and the app
 * transparently falls back to an in-memory store (see lib/demo-store.ts).
 * Call sites should use `requireDb()` only on paths that truly need Postgres,
 * or branch on `isDbEnabled`.
 */
export const isDbEnabled = Boolean(process.env.DATABASE_URL);

export const db = isDbEnabled
  ? drizzle(neon(process.env.DATABASE_URL!), { schema })
  : null;

export type Database = NonNullable<typeof db>;

export function requireDb(): Database {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. This action requires a Postgres database. " +
        "Set DATABASE_URL in .env.local or use Demo mode.",
    );
  }
  return db;
}

export { schema };
