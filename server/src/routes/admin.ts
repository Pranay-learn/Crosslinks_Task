import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { id } from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import * as view from "../lib/serialize.js";
import { authenticated, requireAdmin } from "../middleware/auth.js";
import { moderationInput, page, statusInput } from "../validators/input.js";

export function adminRoutes(db: PrismaClient) {
  const router = Router();
  router.use(requireAdmin);
  router.get("/overview", async (_req, res) => {
    const [
      users,
      posts,
      discussions,
      announcements,
      activeUsers,
      hiddenPosts,
      hiddenDiscussions,
    ] = await Promise.all([
      db.user.count(),
      db.post.count(),
      db.discussion.count(),
      db.announcement.count(),
      db.user.count({ where: { status: "ACTIVE" } }),
      db.post.count({ where: { hidden: true } }),
      db.discussion.count({ where: { hidden: true } }),
    ]);
    res.json({
      data: {
        users,
        posts,
        discussions,
        announcements,
        activeUsers,
        hiddenPosts,
        hiddenDiscussions,
      },
    });
  });
  router.get("/users", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { branch: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(["ACTIVE", "SUSPENDED"].includes(query.status || "")
        ? { status: query.status as "ACTIVE" | "SUSPENDED" }
        : {}),
    };
    const rows = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.skip,
      take: query.take,
    });
    res.json({
      data: rows.map((row) => view.user(row, viewer.id)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.user.count({ where }),
      },
    });
  });
  router.patch("/users/:id/status", async (req, res) => {
    const viewer = authenticated(req).user;
    const recordId = id(req);
    const input = statusInput.parse(req.body);
    if (viewer.id === recordId && input.status === "SUSPENDED")
      throw new HttpError(
        400,
        "You cannot suspend your own administrator account.",
      );
    const row = await db.$transaction(
      async (tx) => {
        const account = await tx.user.findUnique({ where: { id: recordId } });
        if (!account) throw new HttpError(404, "User not found.");
        if (
          account.role === "ADMIN" &&
          input.status === "SUSPENDED" &&
          (await tx.user.count({
            where: { role: "ADMIN", status: "ACTIVE" },
          })) <= 1
        )
          throw new HttpError(
            409,
            "The last active administrator cannot be suspended.",
          );
        const updated = await tx.user.update({
          where: { id: recordId },
          data: input,
        });
        if (input.status === "SUSPENDED")
          await tx.session.deleteMany({ where: { userId: recordId } });
        await tx.auditLog.create({
          data: {
            actorId: viewer.id,
            action: `user.${input.status.toLowerCase()}`,
            targetId: recordId,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    res.json({ data: view.user(row, viewer.id) });
  });
  router.get("/moderation", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where = query.q
      ? { text: { contains: query.q, mode: "insensitive" as const } }
      : {};
    const [posts, discussions] = await Promise.all([
      db.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.postInclude,
      }),
      db.discussion.findMany({
        where: query.q
          ? {
              OR: [
                where,
                { title: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.discussionInclude,
      }),
    ]);
    res.json({
      data: {
        posts: posts.map((row) => view.post(row, viewer.id)),
        discussions: discussions.map(view.discussion),
      },
    });
  });
  router.post("/moderation/:id/action", async (req, res) => {
    const viewer = authenticated(req).user;
    const recordId = id(req);
    const input = moderationInput.parse(req.body);
    await db.$transaction(async (tx) => {
      if (input.type === "post") {
        if (input.action === "delete")
          await tx.post.delete({ where: { id: recordId } });
        else
          await tx.post.update({
            where: { id: recordId },
            data: { hidden: input.action === "hide" },
          });
      } else {
        if (input.action === "delete")
          await tx.discussion.delete({ where: { id: recordId } });
        else
          await tx.discussion.update({
            where: { id: recordId },
            data: { hidden: input.action === "hide" },
          });
      }
      await tx.auditLog.create({
        data: {
          actorId: viewer.id,
          action: `${input.type}.${input.action}`,
          targetId: recordId,
        },
      });
    });
    res.json({ data: { id: recordId, ...input } });
  });
  router.get("/audit-logs", async (req, res) => {
    const query = page(req.query);
    const where = query.q
      ? { action: { contains: query.q, mode: "insensitive" as const } }
      : {};
    const rows = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.skip,
      take: query.take,
    });
    res.json({
      data: rows.map(view.audit),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.auditLog.count({ where }),
      },
    });
  });
  return router;
}
