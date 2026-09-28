// Sinkron data hero (STRATZ + OpenDota) ke database.
//
//   npm run sync:hero-data                     ke database di DATABASE_URL (Neon)
//   npm run sync:hero-data -- --local          ke PGlite lokal (.data/pglite); matikan `npm run dev` dulu
//   npm run sync:hero-data -- --brackets ALL --heroes 1,2,3 --skip-durations   untuk mencoba
//
// Di production script ini dijalankan GitHub Actions setiap hari
// (.github/workflows/sync-hero-data.yml). Butuh STRATZ_TOKEN.

import path from "node:path";
import { syncHeroData, SYNC_BRACKETS } from "../src/lib/hero-data/sync";
import type { StratzBracket } from "../src/lib/stratz/brackets";

try {
  process.loadEnvFile(".env.local");
} catch {
  // di GitHub Actions semua datang dari secrets
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => (flag(name) ? args[args.indexOf(name) + 1] : undefined);

const token = process.env.STRATZ_TOKEN;
if (!token) {
  console.error("STRATZ_TOKEN is not set.");
  process.exit(1);
}

const brackets = value("--brackets")
  ?.split(",")
  .map((b) => b.trim().toUpperCase())
  .filter((b): b is StratzBracket => (SYNC_BRACKETS as string[]).includes(b));
const heroIds = value("--heroes")
  ?.split(",")
  .map(Number)
  .filter((n) => Number.isInteger(n) && n > 0);

async function connect() {
  if (flag("--local")) {
    const { mkdirSync } = await import("node:fs");
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = path.join(process.cwd(), ".data", "pglite");
    mkdirSync(path.dirname(dir), { recursive: true });
    const db = drizzle({ client: new PGlite(dir) });
    await migrate(db, { migrationsFolder: "drizzle" });
    return db;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Use --local to write to the local PGlite database.");
    process.exit(1);
  }
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle({ client: neon(url) });
}

async function main() {
  const started = Date.now();
  const db = await connect();
  const status = await syncHeroData({
    db,
    stratzToken: token!,
    opendotaKey: process.env.OPENDOTA_API_KEY || undefined,
    brackets,
    heroIds,
    skipDurations: flag("--skip-durations"),
    log: (msg) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`),
  });

  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  console.log(
    `Done in ${minutes} min: ${status.rows} rows, ${status.stratzRequests} STRATZ requests` +
      (status.stratzRemainingDay !== null ? `, ${status.stratzRemainingDay} left today` : ""),
  );
  if (status.errors.length) {
    console.log(`${status.errors.length} error(s):`);
    for (const e of status.errors) console.log(`  ${e}`);
  }
  process.exit(status.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
