import {
  bigint,
  boolean,
  date,
  doublePrecision,
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

/**
 * Data hero hasil sinkron harian (STRATZ dan OpenDota): posisi, matchup, build item, durasi.
 * hero_id 0 dan position 0 berarti "semua". Lihat src/lib/hero-data/types.ts untuk isi `value`.
 */
export const heroData = pgTable(
  "hero_data",
  {
    kind: text("kind").notNull(),
    bracket: text("bracket").notNull(),
    heroId: smallint("hero_id").notNull(),
    position: smallint("position").notNull(),
    value: jsonb("value").notNull(),
    source: text("source").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.bracket, t.heroId, t.position] })],
);

/**
 * Ringkasan match pemain yang login (lihat src/lib/players/summary.ts untuk isi `data`).
 * Dipakai target latihan dan parse otomatis. Akun lain hanya di-cache, tidak disimpan di sini.
 */
export const matchSummaries = pgTable(
  "match_summaries",
  {
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    matchId: bigint("match_id", { mode: "number" }).notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    heroId: smallint("hero_id").notNull(),
    parsed: boolean("parsed").notNull().default(false),
    /** Sudah dicoba ambil statistik replay (LH@10, ward) dari detail match. */
    replayChecked: boolean("replay_checked").notNull().default(false),
    parseRequestedAt: timestamp("parse_requested_at", { withTimezone: true }),
    data: jsonb("data").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.matchId] }),
    index("match_summaries_account_time_idx").on(t.accountId, t.startTime),
  ],
);

/** Target latihan buatan user. Progres dihitung dari match_summaries setelah target dibuat. */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    /** "atLeast" (≥) atau "atMost" (≤). */
    direction: text("direction").notNull(),
    target: doublePrecision("target").notNull(),
    /** Jumlah game yang harus mencapai target. */
    games: smallint("games").notNull(),
    /** Opsional: hanya hitung match dengan hero ini. */
    heroId: smallint("hero_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

/** Pemakaian LLM per hari, provider, model, dan fitur (untuk panel admin dan perkiraan biaya). */
export const llmUsage = pgTable(
  "llm_usage",
  {
    day: date("day").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    feature: text("feature").notNull(),
    requests: integer("requests").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider, t.model, t.feature] })],
);

/**
 * Narasi coaching yang sudah dibuat LLM. Kunci per jenis:
 * match = "matchId:slot", trends = "accountId:matchId terbaru:jumlah", hero = "heroId:bracket:patch".
 * Teks template (saat semua LLM gagal) tidak disimpan, supaya bisa dicoba lagi nanti.
 */
export const narratives = pgTable(
  "narratives",
  {
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    version: smallint("version").notNull(),
    content: jsonb("content").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.key, t.version] }),
    index("narratives_created_idx").on(t.createdAt),
    index("narratives_creator_idx").on(t.createdBy, t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Goal = typeof goals.$inferSelect;
