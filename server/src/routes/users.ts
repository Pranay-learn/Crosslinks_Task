import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { id, contentVisibility } from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import * as view from "../lib/serialize.js";
import { authenticated } from "../middleware/auth.js";
import { page, profileInput } from "../validators/input.js";

export function userRoutes(db: PrismaClient) {
  const router = Router();
  router.patch("/me", async (req, res) => {
    const viewer = authenticated(req).user;
    const row = await db.user.update({
      where: { id: viewer.id },
      data: profileInput.parse(req.body),
    });
    res.json({ data: view.user(row, viewer.id) });
  });
  router.get("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    const row = await db.user.findUnique({ where: { id: id(req) } });
    if (!row) throw new HttpError(404, "Profile not found.");
    res.json({ data: view.user(row, viewer.id) });
  });
  for (const method of ["post", "delete"] as const) {
    router[method]("/:id/follow", async (req, res) => {
      const viewer = authenticated(req).user;
      const targetId = id(req);
      z.object({}).strict().parse(req.body ?? {});
      if (targetId === viewer.id)
        throw new HttpError(400, "You cannot follow yourself.");
      const target = await db.user.findFirst({
        where: {
          id: targetId,
          ...(method === "post" ? { status: "ACTIVE" } : {}),
        },
        select: { id: true },
      });
      if (!target)
        throw new HttpError(404, "The campus profile is unavailable.");
      const key = { followerId: viewer.id, followingId: targetId };
      if (method === "post")
        await db.follow.createMany({ data: [key], skipDuplicates: true });
      else await db.follow.deleteMany({ where: key });
      const following = await db.follow.findMany({
        where: { followerId: viewer.id, following: { status: "ACTIVE" } },
        select: { followingId: true },
        orderBy: { createdAt: "asc" },
      });
      res.json({ data: { following: following.map((item) => item.followingId) } });
    });
  }
  router.get("/:id/activity", async (req, res) => {
    const viewer = authenticated(req).user;
    const recordId = id(req);
    const query = page(req.query);
    if (
      !(await db.user.findUnique({
        where: { id: recordId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Profile not found.");
    const visible = contentVisibility(viewer);
    const [
      posts,
      discussions,
      comments,
      replies,
      bookmarks,
      postCount,
      discussionCount,
    ] = await Promise.all([
      db.post.findMany({
        where: { authorId: recordId, ...visible },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.postInclude,
      }),
      db.discussion.findMany({
        where: { authorId: recordId, ...visible },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.discussionInclude,
      }),
      db.comment.findMany({
        where: { authorId: recordId, post: visible },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
      }),
      db.discussionReply.findMany({
        where: { authorId: recordId, discussion: visible },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
      }),
      recordId === viewer.id
        ? db.post.findMany({
            where: { ...visible, bookmarks: { some: { userId: viewer.id } } },
            orderBy: { createdAt: "desc" },
            skip: query.skip,
            take: query.take,
            include: view.postInclude,
          })
        : Promise.resolve([]),
      db.post.count({ where: { authorId: recordId, ...visible } }),
      db.discussion.count({ where: { authorId: recordId, ...visible } }),
    ]);
    res.json({
      data: {
        posts: posts.map((row) => view.post(row, viewer.id)),
        discussions: discussions.map(view.discussion),
        comments: comments.map(view.comment),
        replies: replies.map(view.reply),
        bookmarks: bookmarks.map((row) => view.post(row, viewer.id)),
        statistics: { posts: postCount, discussions: discussionCount },
      },
    });
  });
  return router;
}
