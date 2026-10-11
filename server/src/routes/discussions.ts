import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  accessibleDiscussion,
  contentVisibility,
  id,
  own,
} from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import * as view from "../lib/serialize.js";
import { authenticated } from "../middleware/auth.js";
import {
  acceptedInput,
  discussionInput,
  page,
  partialDiscussionInput,
  replyInput,
} from "../validators/input.js";

export function discussionRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where: Prisma.DiscussionWhereInput = {
      ...contentVisibility(viewer),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { text: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
    };
    const orderBy: Prisma.DiscussionOrderByWithRelationInput[] =
      query.sort === "votes" || query.sort === "popular"
        ? [{ votes: { _count: "desc" } }, { createdAt: "desc" }]
        : query.sort === "discussed"
          ? [{ replies: { _count: "desc" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];
    const rows = await db.discussion.findMany({
      where,
      orderBy,
      skip: query.skip,
      take: query.take,
      include: view.discussionInclude,
    });
    res.json({
      data: rows.map(view.discussion),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.discussion.count({ where }),
      },
    });
  });
  router.post("/", async (req, res) => {
    const row = await db.discussion.create({
      data: {
        ...discussionInput.parse(req.body),
        authorId: authenticated(req).user.id,
      },
      include: view.discussionInclude,
    });
    res.status(201).json({ data: view.discussion(row) });
  });
  router.get("/:id", async (req, res) => {
    res.json({
      data: view.discussion(
        await accessibleDiscussion(db, id(req), authenticated(req).user),
      ),
    });
  });
  router.patch("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    own(record.authorId, viewer);
    const row = await db.discussion.update({
      where: { id: record.id },
      data: partialDiscussionInput.parse(req.body),
      include: view.discussionInclude,
    });
    res.json({ data: view.discussion(row) });
  });
  router.delete("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    own(record.authorId, viewer);
    await db.discussion.delete({ where: { id: record.id } });
    res.json({ data: { id: record.id, deleted: true } });
  });
  router.post("/:id/votes", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    const key = { discussionId: record.id, userId: viewer.id };
    await db.discussionVote.createMany({ data: [key], skipDuplicates: true });
    res.json({
      data: view.discussion(await accessibleDiscussion(db, record.id, viewer)),
    });
  });
  router.delete("/:id/votes", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    await db.discussionVote.deleteMany({
      where: { discussionId: record.id, userId: viewer.id },
    });
    res.json({
      data: view.discussion(await accessibleDiscussion(db, record.id, viewer)),
    });
  });
  router.get("/:id/replies", async (req, res) => {
    const record = await accessibleDiscussion(
      db,
      id(req),
      authenticated(req).user,
    );
    const query = page(req.query);
    const rows = await db.discussionReply.findMany({
      where: { discussionId: record.id },
      orderBy: { createdAt: "asc" },
      skip: query.skip,
      take: query.take,
    });
    res.json({
      data: rows.map(view.reply),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.discussionReply.count({
          where: { discussionId: record.id },
        }),
      },
    });
  });
  router.post("/:id/replies", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    const input = replyInput.parse(req.body);
    const parent = input.parentId
      ? await db.discussionReply.findUnique({ where: { id: input.parentId } })
      : null;
    if (input.parentId && (!parent || parent.discussionId !== record.id))
      throw new HttpError(
        400,
        "The parent reply must belong to this discussion.",
      );
    const row = await db.$transaction(async (tx) => {
      const created = await tx.discussionReply.create({
        data: {
          ...input,
          parentId: input.parentId || null,
          discussionId: record.id,
          authorId: viewer.id,
        },
      });
      const recipients = [
        ...new Set([record.authorId, ...(parent ? [parent.authorId] : [])]),
      ].filter((userId) => userId !== viewer.id);
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            text: `${viewer.name} replied to “${record.title}”.`,
            link: `/discussions/${record.id}`,
          })),
        });
      return created;
    });
    res.status(201).json({ data: view.reply(row) });
  });
  router.patch("/:id/accepted-answer", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleDiscussion(db, id(req), viewer);
    own(record.authorId, viewer);
    const input = acceptedInput.parse(req.body);
    if (
      input.replyId &&
      !(await db.discussionReply.findFirst({
        where: { id: input.replyId, discussionId: record.id },
      }))
    )
      throw new HttpError(
        400,
        "The accepted reply must belong to this discussion.",
      );
    const row = await db.discussion.update({
      where: { id: record.id },
      data: { acceptedReplyId: input.replyId },
      include: view.discussionInclude,
    });
    res.json({ data: view.discussion(row) });
  });
  return router;
}
