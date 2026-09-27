import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __d2Db?: Promise<Database> };

/**
 * Production (Vercel) memakai Neon lewat HTTP driver.
 * Tanpa DATABASE_URL, development memakai PGlite yang disimpan di `.data/pglite`,
 * dan migrasi dijalankan otomatis supaya tidak perlu setup database di tiap laptop.
 */
async function connect(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle({ client: neon(url), schema }) as unknown as Database;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  // PGlite tidak membuat folder induk sendiri.
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Database;
}

export function getDb(): Promise<Database> {
  g.__d2Db ??= connect().catch((err) => {
    g.__d2Db = undefined;
    throw err;
  });
  return g.__d2Db;
}

export { schema };
