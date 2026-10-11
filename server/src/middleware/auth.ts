import type { Request, RequestHandler } from "express";
import type { PrismaClient, Session, User } from "@prisma/client";
import type { ServerConfig } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { hashToken, sameToken, sessionCookie } from "../services/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: { user: User; session: Session };
  }
}
export function authenticated(req: Request) {
  if (!req.auth)
    throw new HttpError(401, "Sign in with your NSUT account to continue.");
  return req.auth;
}
export function requireAuth(db: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[sessionCookie];
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new HttpError(401, "Sign in with your NSUT account to continue.");
    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date())
      throw new HttpError(401, "Your session expired. Please sign in again.");
    if (session.user.status !== "ACTIVE")
      throw new HttpError(
        403,
        "Your account is suspended. Contact a campus administrator.",
      );
    req.auth = { session, user: session.user };
    next();
  };
}
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (authenticated(req).user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access is required.");
  next();
};
export function csrfProtection(config: ServerConfig): RequestHandler {
  return (req, _res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    const origin = req.get("Origin");
    if (origin && origin !== config.clientOrigin && origin !== config.apiOrigin)
      throw new HttpError(403, "This request came from an untrusted origin.");
    const token = req.get("x-csrf-token") || "";
    if (!sameToken(token, authenticated(req).session.csrfToken))
      throw new HttpError(
        403,
        "The security token is missing or invalid. Refresh and try again.",
      );
    next();
  };
}
