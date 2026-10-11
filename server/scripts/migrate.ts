import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

const migrationsDirectory = fileURLToPath(
  new URL("../prisma/migrations/", import.meta.url),
);
/** Apply the checked-in Prisma SQL migrations atomically using PostgreSQL's driver.
 * Prisma 6's experimental JS schema engine cannot deserialize a PostgreSQL catalog `name` column.
 * Keep standard Prisma migration metadata so a native Prisma CLI can be used later without a second history.
 */
export async function applyMigrations(
  connectionString: string,
): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  const applied: string[] = [];
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(672886145)");
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    const folders = (
      await readdir(migrationsDirectory, { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of folders) {
      const sql = await readFile(
        resolve(migrationsDirectory, name, "migration.sql"),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const result = await client.query<{
        checksum: string;
        finished_at: Date | null;
      }>(
        'SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL',
        [name],
      );
      if (result.rows.length > 1)
        throw new Error(
          `Duplicate migration history for ${name}. Review migration history before proceeding.`,
        );
      if (result.rows[0]) {
        if (!result.rows[0].finished_at)
          throw new Error(
            `An unfinished migration (${name}) needs operator review.`,
          );
        if (result.rows[0].checksum !== checksum)
          throw new Error(
            `Applied migration ${name} changed. Restore it and add a new migration.`,
          );
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)',
          [randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
        applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return applied;
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(672886145)")
      .catch(() => undefined);
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to apply migrations.");
    process.exitCode = 1;
  } else {
    try {
      const names = await applyMigrations(url);
      console.info(
        names.length
          ? `Applied migrations: ${names.join(", ")}.`
          : "Database migrations are up to date.",
      );
    } catch (error) {
      // Driver errors can contain connection details. Show only migration-specific messages we own.
      const message =
        error instanceof Error &&
        /^(Applied migration|An unfinished migration|Duplicate migration)/.test(
          error.message,
        )
          ? error.message
          : "Migration failed and its SQL transaction was rolled back. Check database access and migration SQL.";
      console.error(message);
      process.exitCode = 1;
    }
  }
}
