import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { createHash } from "node:crypto";
import { googleSignInConfigured, type ServerConfig } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { user } from "../lib/serialize.js";
import {
  authenticated,
  csrfProtection,
  requireAuth,
} from "../middleware/auth.js";
import {
  createSession,
  hashToken,
  oauthCookie,
  opaqueToken,
  provisionGoogleUser,
  sameToken,
  sessionCookie,
  verifyGoogleIdentity,
} from "../services/auth.js";

export function authRoutes(db: PrismaClient, config: ServerConfig) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax" as const,
    path: "/",
  };
  const oauth = new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
  const configured = () => {
    if (!googleSignInConfigured(config))
      throw new HttpError(
        503,
        "Google sign-in is not configured. Set GOOGLE_CLIENT_ID to a Google OAuth web application client ID ending in .apps.googleusercontent.com, set GOOGLE_CLIENT_SECRET on the server, and register GOOGLE_REDIRECT_URI in Google Cloud.",
      );
  };
  router.get("/status", (_req, res) => {
    res.json({
      data: {
        configured: googleSignInConfigured(config),
      },
    });
  });
  router.get("/google", async (req, res) => {
    configured();
    const callback = new URL(config.googleRedirectUri);
    if (config.production && req.get("host")?.toLowerCase() !== callback.host) {
      // Host-only cookies must be created on the domain that receives Google's callback.
      // The redirect destination comes only from server configuration, never request headers.
      res.redirect(new URL("/api/auth/google", callback.origin).href);
      return;
    }
    const state = opaqueToken();
    const nonce = opaqueToken();
    const codeVerifier = opaqueToken();
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    await db.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await db.oAuthState.create({
      data: {
        stateHash: hashToken(state),
        nonce,
        codeVerifier,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    res.cookie(oauthCookie, state, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(
      oauth.generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        hd: "nsut.ac.in",
        prompt: "select_account",
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    );
  });
  router.get("/google/callback", async (req, res) => {
    configured();
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookieState =
      typeof req.cookies?.[oauthCookie] === "string"
        ? (req.cookies[oauthCookie] as string)
        : "";
    res.clearCookie(oauthCookie, cookieOptions);
    if (!state || !cookieState || !sameToken(state, cookieState))
      throw new HttpError(
        401,
        "The Google sign-in state is invalid. Please start again.",
      );
    const saved = await db.$transaction(async (tx) => {
      const saved = await tx.oAuthState.findUnique({
        where: { stateHash: hashToken(state) },
      });
      if (!saved || saved.expiresAt <= new Date())
        throw new HttpError(
          401,
          "The Google sign-in expired. Please start again.",
        );
      const consumed = await tx.oAuthState.deleteMany({
        where: { stateHash: saved.stateHash },
      });
      if (consumed.count !== 1)
        throw new HttpError(
          401,
          "This Google sign-in was already used. Please start again.",
        );
      return saved;
    });
    if (req.query.error)
      throw new HttpError(
        401,
        "Google sign-in was cancelled. Please try again.",
      );
    if (typeof req.query.code !== "string")
      throw new HttpError(400, "Google did not return an authorization code.");
    let identity;
    try {
      const { tokens } = await oauth.getToken({
        code: req.query.code,
        codeVerifier: saved.codeVerifier,
      });
      if (!tokens.id_token)
        throw new HttpError(401, "Google did not return a verified identity.");
      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new HttpError(401, "The Google identity is missing.");
      identity = verifyGoogleIdentity(payload, saved.nonce);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        401,
        "The Google identity could not be verified. Please start again.",
      );
    }
    const account = await provisionGoogleUser(db, identity, config.adminEmails);
    // Rotate any preexisting session during authentication, preventing session fixation.
    const oldToken: unknown = req.cookies?.[sessionCookie];
    if (typeof oldToken === "string")
      await db.session.deleteMany({
        where: { tokenHash: hashToken(oldToken) },
      });
    const session = await createSession(db, account.id);
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    res.cookie(sessionCookie, session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });
    res.redirect(`${config.clientOrigin}/dashboard`);
  });
  router.get("/me", requireAuth(db), (req, res) => {
    const auth = authenticated(req);
    res.json({
      data: {
        user: user(auth.user, auth.user.id),
        csrfToken: auth.session.csrfToken,
      },
    });
  });
  router.post(
    "/logout",
    requireAuth(db),
    csrfProtection(config),
    async (req, res) => {
      await db.session.delete({ where: { id: authenticated(req).session.id } });
      res.clearCookie(sessionCookie, cookieOptions);
      res.json({ data: { success: true } });
    },
  );
  return router;
}
