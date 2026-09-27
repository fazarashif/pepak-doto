import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  steamId: text("steam_id").notNull().unique(), // SteamID64
  accountId: bigint("account_id", { mode: "number" }).notNull(), // 32-bit Dota account ID
  personaName: text("persona_name").notNull(),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  rankTier: smallint("rank_tier"),
  // 0 = ikuti rank dari OpenDota
  preferredBracket: smallint("preferred_bracket").notNull().default(0),
  // 0 = semua posisi
  preferredPosition: smallint("preferred_position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Konfigurasi yang bisa diubah admin tanpa deploy ulang. Rahasia tetap di env var. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export const apiCache = pgTable(
  "api_cache",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_cache_expires_at_idx").on(t.expiresAt)],
);

/** Jumlah request per layanan eksternal per hari, untuk panel admin. */
export const apiUsage = pgTable(
  "api_usage",
  {
    day: date("day").notNull(),
    provider: text("provider").notNull(),
    requests: integer("requests").notNull().default(0),
    // Sisa kuota harian terakhir yang dilaporkan header provider
    remaining: integer("remaining"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider] })],
);

export type User = typeof users.$inferSelect;
