import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { accessiblePost, contentVisibility, id, own } from "../lib/access.js";
import * as view from "../lib/serialize.js";
import { authenticated } from "../middleware/auth.js";
import {
  commentInput,
  page,
  partialPostInput,
  postInput,
} from "../validators/input.js";

export function postRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where: Prisma.PostWhereInput = {
      ...contentVisibility(viewer),
      ...(query.q ? { text: { contains: query.q, mode: "insensitive" } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.sort === "following"
        ? {
            author: {
              status: "ACTIVE",
              followers: { some: { followerId: viewer.id } },
            },
          }
        : {}),
    };
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      query.sort === "popular"
        ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];
    const rows = await db.post.findMany({
      where,
      orderBy,
      skip: query.skip,
      take: query.take,
      include: view.postInclude,
    });
    res.json({
      data: rows.map((row) => view.post(row, viewer.id)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.post.count({ where }),
      },
    });
  });
  router.post("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const row = await db.post.create({
      data: { ...postInput.parse(req.body), authorId: viewer.id },
      include: view.postInclude,
    });
    res.status(201).json({ data: view.post(row, viewer.id) });
  });
  router.get("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    res.json({
      data: view.post(await accessiblePost(db, id(req), viewer), viewer.id),
    });
  });
  router.patch("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessiblePost(db, id(req), viewer);
    own(record.authorId, viewer);
    const row = await db.post.update({
      where: { id: record.id },
      data: partialPostInput.parse(req.body),
      include: view.postInclude,
    });
    res.json({ data: view.post(row, viewer.id) });
  });
  router.delete("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessiblePost(db, id(req), viewer);
    own(record.authorId, viewer);
    await db.post.delete({ where: { id: record.id } });
    res.json({ data: { id: record.id, deleted: true } });
  });
  for (const kind of ["likes", "bookmark"] as const) {
    router.post(`/:id/${kind}`, async (req, res) => {
      const viewer = authenticated(req).user;
      const record = await accessiblePost(db, id(req), viewer);
      const key = { postId: record.id, userId: viewer.id };
      if (kind === "likes")
        await db.postLike.createMany({ data: [key], skipDuplicates: true });
      else await db.bookmark.createMany({ data: [key], skipDuplicates: true });
      res.json({
        data: view.post(await accessiblePost(db, record.id, viewer), viewer.id),
      });
    });
    router.delete(`/:id/${kind}`, async (req, res) => {
      const viewer = authenticated(req).user;
      const record = await accessiblePost(db, id(req), viewer);
      const where = { postId: record.id, userId: viewer.id };
      if (kind === "likes") await db.postLike.deleteMany({ where });
      else await db.bookmark.deleteMany({ where });
      res.json({
        data: view.post(await accessiblePost(db, record.id, viewer), viewer.id),
      });
    });
  }
  router.get("/:id/comments", async (req, res) => {
    const record = await accessiblePost(db, id(req), authenticated(req).user);
    const query = page(req.query);
    const rows = await db.comment.findMany({
      where: { postId: record.id },
      orderBy: { createdAt: "asc" },
      skip: query.skip,
      take: query.take,
    });
    res.json({
      data: rows.map(view.comment),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.comment.count({ where: { postId: record.id } }),
      },
    });
  });
  router.post("/:id/comments", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessiblePost(db, id(req), viewer);
    const input = commentInput.parse(req.body);
    const row = await db.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { ...input, postId: record.id, authorId: viewer.id },
      });
      if (record.authorId !== viewer.id)
        await tx.notification.create({
          data: {
            userId: record.authorId,
            text: `${viewer.name} commented on your post.`,
            link: `/feed?post=${record.id}`,
          },
        });
      return created;
    });
    res.status(201).json({ data: view.comment(row) });
  });
  return router;
}
