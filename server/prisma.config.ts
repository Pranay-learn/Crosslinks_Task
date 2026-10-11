import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// This supported CLI configuration uses Prisma's packaged JS schema engine instead of downloading native binaries.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx server/prisma/seed.ts",
  },
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for database schema operations.",
      );
    return new PrismaPg({ connectionString: process.env.DATABASE_URL });
  },
});
