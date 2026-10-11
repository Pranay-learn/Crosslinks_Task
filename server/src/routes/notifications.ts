import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { id } from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import { notification } from "../lib/serialize.js";
import { authenticated } from "../middleware/auth.js";
import { page, readInput } from "../validators/input.js";

export function notificationRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const where = { userId: viewer.id };
    const rows = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.skip,
      take: query.take,
    });
    res.json({
      data: rows.map(notification),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: await db.notification.count({ where }),
      },
    });
  });
  router.post("/read-all", async (req, res) => {
    const result = await db.notification.updateMany({
      where: { userId: authenticated(req).user.id, read: false },
      data: { read: true },
    });
    res.json({ data: { updated: result.count } });
  });
  router.patch("/:id/read", async (req, res) => {
    const viewer = authenticated(req).user;
    const recordId = id(req);
    const input = readInput.parse(req.body ?? {});
    if (
      !(await db.notification.findFirst({
        where: { id: recordId, userId: viewer.id },
      }))
    )
      throw new HttpError(404, "Notification not found.");
    const row = await db.notification.update({
      where: { id: recordId },
      data: { read: input.read },
    });
    res.json({ data: notification(row) });
  });
  return router;
}
