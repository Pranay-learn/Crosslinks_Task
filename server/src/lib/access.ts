import type { PrismaClient, User } from "@prisma/client";
import type { Request } from "express";
import { HttpError } from "./errors.js";
import {
  announcementInclude,
  discussionInclude,
  postInclude,
} from "./serialize.js";

export function id(req: Request): string {
  const value = req.params.id;
  if (typeof value !== "string" || value.length > 100)
    throw new HttpError(400, "A valid record ID is required.");
  return value;
}
export function own(authorId: string, viewer: User): void {
  if (authorId !== viewer.id)
    throw new HttpError(403, "You can only change content you own.");
}
export const contentVisibility = (viewer: User) =>
  viewer.role === "ADMIN" ? {} : { hidden: false };
export const announcementVisibility = (viewer: User) =>
  viewer.role === "ADMIN" ? {} : { status: "PUBLISHED" as const };
export async function accessiblePost(
  db: PrismaClient,
  recordId: string,
  viewer: User,
) {
  const row = await db.post.findFirst({
    where: { id: recordId, ...contentVisibility(viewer) },
    include: postInclude,
  });
  if (!row) throw new HttpError(404, "Post not found.");
  return row;
}
export async function accessibleDiscussion(
  db: PrismaClient,
  recordId: string,
  viewer: User,
) {
  const row = await db.discussion.findFirst({
    where: { id: recordId, ...contentVisibility(viewer) },
    include: discussionInclude,
  });
  if (!row) throw new HttpError(404, "Discussion not found.");
  return row;
}
export async function accessibleAnnouncement(
  db: PrismaClient,
  recordId: string,
  viewer: User,
) {
  const row = await db.announcement.findFirst({
    where: { id: recordId, ...announcementVisibility(viewer) },
    include: announcementInclude,
  });
  if (!row) throw new HttpError(404, "Announcement not found.");
  return row;
}
