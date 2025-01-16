import * as t from "drizzle-orm/sqlite-core";

/**
 * ARK: Survival Ascended dinosaur wipe polls.
 */
export const arkDinoWipes = t.sqliteTable("ark_dino_wipe", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  user_id: t.text("user_id"),
  server: t.text("server"),
  poll_id: t.text("poll_id").notNull(),
  success: t.integer({ mode: "boolean" }).default(true),
  created_at: t
    .integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});

/**
 * ARK: Survival Ascended dinosaur wipe blocks (by users).
 */
export const arkDinoWipeBlocks = t.sqliteTable("ark_dino_wipe_blocks", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  user_id: t.text("user_id"),
  server: t.text("server").unique(),
  created_at: t
    .integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
});
