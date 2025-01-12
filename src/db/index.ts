import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { labels, log } from "../logging.ts";

const sqlite = new Database(process.env.HLNA_DATABASE_URL ?? "sqlite.db");

export const db = drizzle(sqlite);

/**
 * Migrates the database.
 *
 * @throws Error if unable to migrate the database.
 */
export async function migrateDatabase() {
  log.info(`Migrating database '${db.$client.filename}'...`, labels.db);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } catch (error: unknown) {
    log.error("Could not migrate database!\n%s", error, labels.db);
    throw error;
  }
  log.log("success", "Successfully migrated database!", labels.db);
}
