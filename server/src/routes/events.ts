import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { id } from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import * as view from "../lib/serialize.js";
import { authenticated, requireAdmin } from "../middleware/auth.js";
import { page } from "../validators/input.js";
import { emptyRsvpInput, eventInput, eventQuery, partialEventInput } from "../validators/events.js";

export function eventRoutes(db: PrismaClient) {
  const router = Router();
  async function findEvent(recordId: string, viewerId: string) {
    const row = await db.campusEvent.findUnique({
      where: { id: recordId },
      include: view.eventInclude(viewerId),
    });
    if (!row) throw new HttpError(404, "Campus event not found.");
    return row;
  }
  router.get("/", async (req, res) => {
    const viewer = authenticated(req).user;
    const query = page(req.query);
    const { scope } = eventQuery.parse(req.query);
    const where: Prisma.CampusEventWhereInput = {
      ...(scope === "upcoming" ? { endsAt: { gte: new Date() } } : scope === "past" ? { endsAt: { lt: new Date() } } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { text: { contains: query.q, mode: "insensitive" } }, { location: { contains: query.q, mode: "insensitive" } }] } : {}),
    };
    const rows = await db.campusEvent.findMany({
      where,
      orderBy: { startsAt: scope === "past" ? "desc" : "asc" },
      skip: query.skip,
      take: query.take,
      include: view.eventInclude(viewer.id),
    });
    res.json({ data: rows.map(view.event), pagination: { page: query.page, limit: query.limit, total: await db.campusEvent.count({ where }) } });
  });
  router.get("/:id", async (req, res) => {
    res.json({ data: view.event(await findEvent(id(req), authenticated(req).user.id)) });
  });
  router.post("/", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const input = eventInput.parse(req.body);
    const row = await db.$transaction(async (tx) => {
      const created = await tx.campusEvent.create({
        data: { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) },
        include: view.eventInclude(viewer.id),
      });
      await tx.auditLog.create({ data: { actorId: viewer.id, action: "event.create", targetId: created.id } });
      return created;
    });
    res.status(201).json({ data: view.event(row) });
  });
  router.patch("/:id", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const existing = await findEvent(id(req), viewer.id);
    const patch = partialEventInput.parse(req.body);
    const input = eventInput.parse({ title: existing.title, text: existing.text, location: existing.location, startsAt: existing.startsAt.toISOString(), endsAt: existing.endsAt.toISOString(), ...patch });
    const row = await db.$transaction(async (tx) => {
      const updated = await tx.campusEvent.update({
        where: { id: existing.id },
        data: { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) },
        include: view.eventInclude(viewer.id),
      });
      await tx.auditLog.create({ data: { actorId: viewer.id, action: "event.update", targetId: existing.id } });
      return updated;
    });
    res.json({ data: view.event(row) });
  });
  router.delete("/:id", requireAdmin, async (req, res) => {
    const viewer = authenticated(req).user;
    const recordId = id(req);
    await db.$transaction([
      db.campusEvent.delete({ where: { id: recordId } }),
      db.auditLog.create({ data: { actorId: viewer.id, action: "event.delete", targetId: recordId } }),
    ]);
    res.json({ data: { id: recordId, deleted: true } });
  });
  for (const method of ["post", "delete"] as const) {
    router[method]("/:id/rsvp", async (req, res) => {
      const viewer = authenticated(req).user;
      emptyRsvpInput.parse(req.body ?? {});
      const record = await findEvent(id(req), viewer.id);
      const key = { eventId: record.id, userId: viewer.id };
      if (method === "post") await db.eventRsvp.createMany({ data: [key], skipDuplicates: true });
      else await db.eventRsvp.deleteMany({ where: key });
      res.json({ data: view.event(await findEvent(record.id, viewer.id)) });
    });
  }
  return router;
}
