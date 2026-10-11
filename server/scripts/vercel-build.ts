import { spawnSync } from "node:child_process";
import { applyMigrations } from "./migrate.js";

function run(script: string) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

// Preview deployments must not change the production database schema.
if (process.env.VERCEL_ENV === "production") {
  const directUrl = process.env.DIRECT_DATABASE_URL;
  if (!directUrl) {
    console.error(
      "Set DIRECT_DATABASE_URL to the database's direct connection in Vercel Production settings before deploying.",
    );
    process.exit(1);
  }
  try {
    const parsed = new URL(directUrl);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      parsed.hostname.includes("-pooler.")
    ) {
      throw new Error("A direct PostgreSQL connection is required.");
    }
  } catch {
    console.error(
      "DIRECT_DATABASE_URL must be a valid direct PostgreSQL connection, without Neon's pooler hostname.",
    );
    process.exit(1);
  }
  // Compile before applying migrations so a source build failure leaves the schema alone.
  run("db:generate");
  run("build");
  try {
    const applied = await applyMigrations(directUrl);
    console.info(
      applied.length
        ? `Applied migrations: ${applied.join(", ")}.`
        : "Database migrations are up to date.",
    );
  } catch {
    console.error(
      "Production migration failed. Check DIRECT_DATABASE_URL and migration history; credential values have been withheld.",
    );
    process.exit(1);
  }
} else {
  run("db:generate");
  run("build");
}
