import "dotenv/config";
import type { Server } from "node:http";
import { createDatabase } from "./lib/db.js";
import { loadConfig } from "./config/env.js";
import { createApp } from "./app.js";

const config = loadConfig();
const db = createDatabase();
try {
  await db.$connect();
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = createApp({ db, config }).listen(config.port, "0.0.0.0", (error) => {
      if (error) reject(error);
      else resolve(listener);
    });
  });
  console.info(`NSUT Connect API listening on port ${config.port}.`);
  const shutdown = () => {
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch {
  console.error(
    "API startup failed. Check port availability and DATABASE_URL, generate Prisma Client, and apply database migrations.",
  );
  await db.$disconnect();
  process.exit(1);
}
