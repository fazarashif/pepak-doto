// Menjalankan migrasi Drizzle ke database di DATABASE_URL (Neon).
//
// - `npm run db:migrate` menjalankannya secara manual.
// - `npm run build` juga memanggilnya, tapi di Vercel hanya untuk deploy production,
//   supaya preview dari branch lain tidak mengubah database production.
// - Tanpa DATABASE_URL tidak ada yang dijalankan (lokal memakai PGlite yang migrasi sendiri).

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const fromBuild = process.argv.includes("--from-build");

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // tidak ada .env.local
  }
}

const url = process.env.DATABASE_URL;

if (fromBuild && process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] skipped for ${process.env.VERCEL_ENV} deployment`);
  process.exit(0);
}

if (!url) {
  console.log("[migrate] DATABASE_URL is not set, nothing to migrate");
  process.exit(0);
}

const db = drizzle({ client: neon(url) });
await migrate(db, { migrationsFolder: "drizzle" });
console.log("[migrate] done");
