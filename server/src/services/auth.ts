import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import type { TokenPayload } from "google-auth-library";
import { HttpError } from "../lib/errors.js";

export const sessionCookie = "nsut_session";
export const oauthCookie = "nsut_oauth_state";
export function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function sameToken(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export interface Identity {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}
/** Call only after Google verifies the token signature, issuer, expiry and configured audience. */
export function verifyGoogleIdentity(
  payload: Pick<
    TokenPayload,
    "sub" | "email" | "email_verified" | "name" | "picture"
  > & { nonce?: string },
  nonce: string,
): Identity {
  if (
    !payload.sub ||
    payload.email_verified !== true ||
    !payload.email ||
    !/^[^@\s]+@nsut\.ac\.in$/i.test(payload.email)
  )
    throw new HttpError(
      403,
      "Sign in with a verified @nsut.ac.in Google account.",
    );
  if (!payload.nonce || !sameToken(payload.nonce, nonce))
    throw new HttpError(
      401,
      "The Google sign-in could not be verified. Please start again.",
    );
  let avatarUrl = "";
  if (payload.picture) {
    try {
      if (new URL(payload.picture).protocol === "https:")
        avatarUrl = payload.picture;
    } catch {
      /* Leave unsafe provider images unset. */
    }
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: (payload.name || payload.email.split("@")[0]).slice(0, 100),
    avatarUrl,
  };
}

export async function provisionGoogleUser(
  db: PrismaClient,
  identity: Identity,
  adminEmails: string[],
): Promise<User> {
  return db.$transaction(async (tx) => {
    const subjectUser = await tx.user.findUnique({
      where: { googleId: identity.googleId },
    });
    const emailUser = await tx.user.findUnique({
      where: { email: identity.email },
    });
    if (emailUser?.googleId && emailUser.googleId !== identity.googleId)
      throw new HttpError(
        403,
        "This account is already bound to a different Google identity.",
      );
    if (subjectUser && emailUser && subjectUser.id !== emailUser.id)
      throw new HttpError(
        403,
        "The Google identity cannot be linked to this account.",
      );
    const existing = subjectUser || emailUser;
    if (existing?.status === "SUSPENDED")
      throw new HttpError(
        403,
        "Your account is suspended. Contact a campus administrator.",
      );
    const trustedAdmin = adminEmails.includes(identity.email);
    if (existing)
      return tx.user.update({
        where: { id: existing.id },
        data: {
          googleId: identity.googleId,
          email: identity.email,
          ...(trustedAdmin ? { role: "ADMIN" } : {}),
        },
      });
    return tx.user.create({
      data: { ...identity, role: trustedAdmin ? "ADMIN" : "STUDENT" },
    });
  });
}

/** Internal trusted service used by OAuth and integration tests; never exposed as an HTTP login shortcut. */
export async function createSession(db: PrismaClient, userId: string) {
  const token = opaqueToken();
  const csrfToken = opaqueToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: { tokenHash: hashToken(token), csrfToken, userId, expiresAt },
  });
  return { token, csrfToken, expiresAt, session };
}
