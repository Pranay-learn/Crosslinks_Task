import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import { loadConfig, type ServerConfig } from "./config/env.js";
import { HttpError, errorHandler } from "./lib/errors.js";
import {
  authenticated,
  csrfProtection,
  requireAuth,
} from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { postRoutes } from "./routes/posts.js";
import { discussionRoutes } from "./routes/discussions.js";
import { announcementRoutes } from "./routes/announcements.js";
import { timetableRoutes } from "./routes/timetable.js";
import { userRoutes } from "./routes/users.js";
import { notificationRoutes } from "./routes/notifications.js";
import { adminRoutes } from "./routes/admin.js";
import { platformRoutes } from "./routes/platform.js";

export function createApp({
  db,
  config = loadConfig(),
}: {
  db: PrismaClient;
  config?: ServerConfig;
}) {
  const app = express();
  app.disable("x-powered-by");
  // Keep forwarded headers untrusted unless an operator explicitly configures the deployment's proxy hop count.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0)
    app.set("trust proxy", proxyHops);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === config.clientOrigin ||
          origin === config.apiOrigin
        )
          callback(null, true);
        else callback(new HttpError(403, "This origin is not allowed."));
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/api/health", async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ data: { status: "ok", database: "connected" } });
    } catch {
      res
        .status(503)
        .json({
          error:
            "Database unavailable. Configure DATABASE_URL and apply the migrations.",
        });
    }
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a moment." },
    }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 50,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path === "/me" || req.path === "/logout",
      message: {
        error: "Too many sign-in attempts. Try again in a few minutes.",
      },
    }),
    authRoutes(db, config),
  );
  app.use("/api", requireAuth(db), csrfProtection(config));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: (req) =>
        req.auth
          ? authenticated(req).user.id
          : ipKeyGenerator(req.ip || "127.0.0.1"),
      skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
      message: { error: "Too many updates. Please wait a moment." },
    }),
  );
  app.use("/api/users", userRoutes(db));
  app.use("/api/posts", postRoutes(db));
  app.use("/api/discussions", discussionRoutes(db));
  app.use("/api/announcements", announcementRoutes(db));
  app.use("/api/timetable", timetableRoutes(db));
  app.use("/api/notifications", notificationRoutes(db));
  app.use("/api/admin", adminRoutes(db));
  app.use("/api", platformRoutes(db));
  app.use((_req, _res, next) =>
    next(new HttpError(404, "API route not found.")),
  );
  app.use(errorHandler);
  return app;
}
