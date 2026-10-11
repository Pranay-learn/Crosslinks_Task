import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Snapshot } from "../../../shared/model.js";
import { announcementVisibility, contentVisibility } from "../lib/access.js";
import * as view from "../lib/serialize.js";
import { authenticated } from "../middleware/auth.js";
import { page } from "../validators/input.js";

export function platformRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/snapshot", async (req, res) => {
    const viewer = authenticated(req).user;
    const visible = contentVisibility(viewer);
    // A consistent database snapshot supplies the initial client cache; individual REST collection routes are paginated.
    const [
      users,
      posts,
      comments,
      discussions,
      replies,
      announcements,
      timetable,
      notifications,
      auditLogs,
      following,
    ] = await db.$transaction(
      [
        db.user.findMany({ orderBy: { createdAt: "asc" } }),
        db.post.findMany({
          where: visible,
          orderBy: { createdAt: "desc" },
          include: view.postInclude,
        }),
        db.comment.findMany({
          where: { post: visible },
          orderBy: { createdAt: "asc" },
        }),
        db.discussion.findMany({
          where: visible,
          orderBy: { createdAt: "desc" },
          include: view.discussionInclude,
        }),
        db.discussionReply.findMany({
          where: { discussion: visible },
          orderBy: { createdAt: "asc" },
        }),
        db.announcement.findMany({
          where: announcementVisibility(viewer),
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          include: view.announcementInclude,
        }),
        db.timetableEntry.findMany({
          orderBy: [{ day: "asc" }, { start: "asc" }],
        }),
        db.notification.findMany({
          where: { userId: viewer.id },
          orderBy: { createdAt: "desc" },
        }),
        db.auditLog.findMany({
          where:
            viewer.role === "ADMIN"
              ? {}
              : { id: "__no_student_audit_access__" },
          orderBy: { createdAt: "desc" },
        }),
        db.follow.findMany({
          where: { followerId: viewer.id, following: { status: "ACTIVE" } },
          select: { followingId: true },
          orderBy: { createdAt: "asc" },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const data: Snapshot = {
      users: users.map((row) => view.user(row, viewer.id)),
      posts: posts.map((row) => view.post(row, viewer.id)),
      comments: comments.map(view.comment),
      discussions: discussions.map(view.discussion),
      replies: replies.map(view.reply),
      announcements: announcements.map((row) =>
        view.announcement(row, viewer.id),
      ),
      timetable: timetable.map(view.timetable),
      notifications: notifications.map(view.notification),
      auditLogs: auditLogs.map(view.audit),
      following: following.map((item) => item.followingId),
    };
    res.json({ data });
  });
  router.get("/search", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const match = { contains: query.q, mode: "insensitive" as const };
    if (!query.q) {
      res.json({
        data: { posts: [], discussions: [], announcements: [], users: [] },
      });
      return;
    }
    const category = query.category ? { category: query.category } : {};
    const [posts, discussions, announcements, users] = await Promise.all([
      db.post.findMany({
        where: { ...contentVisibility(viewer), ...category, text: match },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.postInclude,
      }),
      db.discussion.findMany({
        where: {
          ...contentVisibility(viewer),
          ...category,
          OR: [{ title: match }, { text: match }, { tags: { has: query.q } }],
        },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.discussionInclude,
      }),
      db.announcement.findMany({
        where: {
          ...announcementVisibility(viewer),
          ...category,
          OR: [{ title: match }, { text: match }],
        },
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: view.announcementInclude,
      }),
      db.user.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ name: match }, { branch: match }, { bio: match }],
        },
        orderBy: { name: "asc" },
        skip: query.skip,
        take: query.take,
      }),
    ]);
    res.json({
      data: {
        posts: posts.map((row) => view.post(row, viewer.id)),
        discussions: discussions.map(view.discussion),
        announcements: announcements.map((row) =>
          view.announcement(row, viewer.id),
        ),
        users: users.map((row) => view.user(row, viewer.id)),
      },
      pagination: { page: query.page, limit: query.limit },
    });
  });
  return router;
}
