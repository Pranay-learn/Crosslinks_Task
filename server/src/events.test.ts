import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { User } from "@prisma/client";
import { createApp } from "./app.js";
import { createDatabase } from "./lib/db.js";
import { createSession, sessionCookie } from "./services/auth.js";
import { applyMigrations } from "../scripts/migrate.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite("Persisted campus events and private RSVP APIs", () => {
  const db = databaseUrl ? createDatabase(databaseUrl) : undefined;
  let app: Express;
  let student: User; let other: User; let admin: User;
  let studentSession: Awaited<ReturnType<typeof createSession>>;
  let otherSession: Awaited<ReturnType<typeof createSession>>;
  let adminSession: Awaited<ReturnType<typeof createSession>>;
  let eventId: string;
  const prefix = `event-test-${randomUUID()}`;
  const userIds: string[] = []; const eventIds: string[] = [];
  const input = {
    title: `Student project showcase ${prefix}`,
    text: "An integration-test event; this is not an official university notice.",
    location: "Test collaboration room",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000 + 7_200_000).toISOString(),
  };
  const config = { port: 3001, clientOrigin: "http://localhost:5173", apiOrigin: "http://localhost:3001", googleClientId: "", googleClientSecret: "", googleRedirectUri: "http://localhost:3001/api/auth/google/callback", adminEmails: [], production: false };
  const headers = (session: Awaited<ReturnType<typeof createSession>>) => ({ Cookie: `${sessionCookie}=${session.token}`, "x-csrf-token": session.csrfToken });
  const run = (method: "get" | "post" | "patch" | "delete", path: string, session = studentSession) => request(app)[method](path).set(headers(session));
  beforeAll(async () => {
    if (!db || !databaseUrl) throw new Error("TEST_DATABASE_URL required.");
    if (databaseUrl === process.env.DATABASE_URL) throw new Error("Use a separate integration-test database.");
    await applyMigrations(databaseUrl);
    app = createApp({ db, config });
    const makeUser = async (name: string, role: "STUDENT" | "ADMIN" = "STUDENT") => {
      const user = await db.user.create({ data: { name, email: `${prefix}.${name.toLowerCase()}@nsut.ac.in`, role } });
      userIds.push(user.id); return user;
    };
    student = await makeUser("Student"); other = await makeUser("Other"); admin = await makeUser("Admin", "ADMIN");
    studentSession = await createSession(db, student.id); otherSession = await createSession(db, other.id); adminSession = await createSession(db, admin.id);
  });
  afterAll(async () => {
    if (!db) return;
    await db.campusEvent.deleteMany({ where: { id: { in: eventIds } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  it("requires a verified campus session and server-owned administrator permission", async () => {
    expect((await request(app).get("/api/events")).status).toBe(401);
    expect((await run("post", "/api/events").send(input)).status).toBe(403);
    expect((await run("patch", "/api/events/irrelevant").send({ title: "Changed" })).status).toBe(403);
    expect((await run("delete", "/api/events/irrelevant")).status).toBe(403);
  });
  it("validates ISO event ranges and rejects server-owned fields", async () => {
    for (const patch of [{ startsAt: "2026-10-11T10:00" }, { endsAt: input.startsAt }, { endsAt: "invalid" }, { title: " ", }, { location: "x".repeat(161) }, { attending: true }, { attendeeCount: 12 }, { userId: student.id }, { createdAt: input.startsAt }]) {
      expect((await run("post", "/api/events", adminSession).send({ ...input, ...patch })).status).toBe(400);
    }
  });
  it("creates and updates persisted events with administrative audit records", async () => {
    const response = await run("post", "/api/events", adminSession).send(input);
    expect(response.status).toBe(201); eventId = response.body.data.id; eventIds.push(eventId);
    expect(response.body.data).toMatchObject({ ...input, attending: false, attendeeCount: 0 });
    expect((await db!.campusEvent.findUniqueOrThrow({ where: { id: eventId } })).title).toBe(input.title);
    const update = await run("patch", `/api/events/${eventId}`, adminSession).send({ title: `Updated showcase ${prefix}` });
    expect(update.status).toBe(200); expect(update.body.data.title).toBe(`Updated showcase ${prefix}`);
    expect((await run("patch", `/api/events/${eventId}`, adminSession).send({ endsAt: input.startsAt })).status).toBe(400);
    const audits = await db!.auditLog.findMany({ where: { actorId: admin.id, targetId: eventId } });
    expect(audits.map((row) => row.action).sort()).toEqual(["event.create", "event.update"]);
  });
  it("persists idempotent concurrent RSVPs without revealing attendee identities", async () => {
    const responses = await Promise.all([run("post", `/api/events/${eventId}/rsvp`).send({}), run("post", `/api/events/${eventId}/rsvp`).send({})]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0].body.data.attending).toBe(true); expect(responses[0].body.data.attendeeCount).toBe(1);
    expect(await db!.eventRsvp.count({ where: { eventId, userId: student.id } })).toBe(1);
    const anotherViewer = await run("get", `/api/events/${eventId}`, otherSession);
    expect(anotherViewer.body.data.attending).toBe(false); expect(anotherViewer.body.data.attendeeCount).toBe(1);
    expect(Object.keys(anotherViewer.body.data).sort()).toEqual(["attendeeCount", "attending", "createdAt", "endsAt", "id", "location", "startsAt", "text", "title"]);
    expect(JSON.stringify(anotherViewer.body.data)).not.toContain(student.id);
    const newApp = createApp({ db: db!, config });
    expect((await request(newApp).get(`/api/events/${eventId}`).set(headers(studentSession))).body.data.attending).toBe(true);
    const snapshot = await run("get", "/api/snapshot");
    expect(snapshot.body.data.events.find((event: { id: string }) => event.id === eventId).attending).toBe(true);
    expect((await run("post", `/api/events/${eventId}/rsvp`, otherSession).send({})).body.data.attendeeCount).toBe(2);
  });
  it("rejects forged RSVP user fields and missing security tokens", async () => {
    expect((await run("post", `/api/events/${eventId}/rsvp`).send({ userId: admin.id })).status).toBe(400);
    expect((await run("delete", `/api/events/${eventId}/rsvp`).send({ userId: other.id })).status).toBe(400);
    expect(await db!.eventRsvp.count({ where: { eventId, userId: admin.id } })).toBe(0);
    expect((await request(app).post(`/api/events/${eventId}/rsvp`).set("Cookie", `${sessionCookie}=${studentSession.token}`).send({})).status).toBe(403);
    expect((await run("post", "/api/events/missing/rsvp").send({})).status).toBe(404);
  });
  it("searches and paginates events with bounded current and past filters", async () => {
    const collection = await run("get", `/api/events?q=${encodeURIComponent(prefix)}&scope=upcoming&limit=1`);
    expect(collection.status).toBe(200); expect(collection.body.data.map((row: { id: string }) => row.id)).toEqual([eventId]);
    expect(collection.body.pagination.total).toBe(1);
    expect((await run("get", `/api/events?q=${encodeURIComponent(prefix)}&scope=past`)).body.data).toEqual([]);
    expect((await run("get", "/api/events?scope=unsupported")).status).toBe(400);
  });
  it("removes only the current viewer RSVP and cascades attendance on event deletion", async () => {
    expect((await run("delete", `/api/events/${eventId}/rsvp`)).body.data).toMatchObject({ attending: false, attendeeCount: 1 });
    expect((await run("delete", `/api/events/${eventId}/rsvp`)).status).toBe(200);
    expect(await db!.eventRsvp.count({ where: { eventId, userId: other.id } })).toBe(1);
    const deleted = await run("delete", `/api/events/${eventId}`, adminSession);
    expect(deleted.status).toBe(200); expect(deleted.body.data.deleted).toBe(true);
    expect(await db!.eventRsvp.count({ where: { eventId } })).toBe(0);
    expect((await run("get", `/api/events/${eventId}`)).status).toBe(404);
    expect(await db!.auditLog.count({ where: { actorId: admin.id, targetId: eventId, action: "event.delete" } })).toBe(1);
  });
});
