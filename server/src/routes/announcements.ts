import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  accessibleAnnouncement,
  announcementVisibility,
  id,
} from "../lib/access.js";
import * as view from "../lib/serialize.js";
import { authenticated, requireAdmin } from "../middleware/auth.js";
import {
  announcementInput,
  page,
  partialAnnouncementInput,
  readInput,
} from "../validators/input.js";

export function announcementRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where: Prisma.AnnouncementWhereInput = {
      ...announcementVisibility(viewer),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { text: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(viewer.role === "ADMIN" &&
      ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(query.status || "")
        ? { status: query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" }
        : {}),
    };
    const orderBy: Prisma.AnnouncementOrderByWithRelationInput[] =
      query.sort === "priority"
        ? [{ pinned: "desc" }, { priority: "desc" }, { createdAt: "desc" }]
        : [{ pinned: "desc" }, { createdAt: "desc" }];
    const rows = await db.announcement.findMany({
      where,
      orderBy,
      skip: query.skip,
      take: query.take,
      include: view.announcementInclude,
    });
    res.json({
      data: rows.map((row) => view.announcement(row, viewer.id)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.announcement.count({ where }),
      },
    });
  });
  router.get("/:id", async (req, res) => {
    const viewer = authenticated(req).user;
    res.json({
      data: view.announcement(
        await accessibleAnnouncement(db, id(req), viewer),
        viewer.id,
      ),
    });
  });
  router.post("/", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const input = announcementInput.parse(req.body);
    const row = await db.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: input,
        include: view.announcementInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: viewer.id,
          action: `announcement.create.${created.status.toLowerCase()}`,
          targetId: created.id,
        },
      });
      if (created.status === "PUBLISHED") {
        const recipients = await tx.user.findMany({
          where: { status: "ACTIVE", id: { not: viewer.id } },
          select: { id: true },
        });
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              text: `Campus announcement: ${created.title}`,
              link: `/announcements/${created.id}`,
            })),
          });
      }
      return created;
    });
    res.status(201).json({ data: view.announcement(row, viewer.id) });
  });
  router.patch("/:id", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const input = partialAnnouncementInput.parse(req.body);
    const record = await accessibleAnnouncement(db, id(req), viewer);
    const row = await db.$transaction(async (tx) => {
      const updated = await tx.announcement.update({
        where: { id: record.id },
        data: input,
        include: view.announcementInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: viewer.id,
          action: `announcement.update.${updated.status.toLowerCase()}`,
          targetId: record.id,
        },
      });
      if (updated.status === "PUBLISHED") {
        // An edited notice becomes unread again, and its audience gets a persisted update notification.
        await tx.announcementRead.deleteMany({
          where: { announcementId: record.id },
        });
        const recipients = await tx.user.findMany({
          where: { status: "ACTIVE", id: { not: viewer.id } },
          select: { id: true },
        });
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              text: `Announcement updated: ${updated.title}`,
              link: `/announcements/${updated.id}`,
            })),
          });
        return tx.announcement.findUniqueOrThrow({
          where: { id: record.id },
          include: view.announcementInclude,
        });
      }
      return updated;
    });
    res.json({ data: view.announcement(row, viewer.id) });
  });
  router.delete("/:id", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleAnnouncement(db, id(req), viewer);
    await db.$transaction([
      db.announcement.delete({ where: { id: record.id } }),
      db.auditLog.create({
        data: {
          actorId: viewer.id,
          action: "announcement.delete",
          targetId: record.id,
        },
      }),
    ]);
    res.json({ data: { id: record.id, deleted: true } });
  });
  router.post("/:id/read", async (req, res) => {
    const viewer = authenticated(req).user;
    const record = await accessibleAnnouncement(db, id(req), viewer);
    const input = readInput.parse(req.body ?? {});
    const key = { announcementId: record.id, userId: viewer.id };
    if (input.read)
      await db.announcementRead.createMany({
        data: [key],
        skipDuplicates: true,
      });
    else await db.announcementRead.deleteMany({ where: key });
    res.json({
      data: view.announcement(
        await accessibleAnnouncement(db, record.id, viewer),
        viewer.id,
      ),
    });
  });
  return router;
}
