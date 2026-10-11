import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { User } from "@prisma/client";
import { createApp } from "./app.js";
import { createDatabase } from "./lib/db.js";
import {
  createSession,
  hashToken,
  oauthCookie,
  provisionGoogleUser,
  sessionCookie,
} from "./services/auth.js";
import { applyMigrations } from "../scripts/migrate.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite(
  "PostgreSQL API authentication, authorization, persistence, and privacy",
  () => {
    const db = databaseUrl ? createDatabase(databaseUrl) : undefined;
    let app: Express;
    let alice: User;
    let bob: User;
    let admin: User;
    let aliceSession: Awaited<ReturnType<typeof createSession>>;
    let bobSession: Awaited<ReturnType<typeof createSession>>;
    let adminSession: Awaited<ReturnType<typeof createSession>>;
    let postId: string;
    let discussionId: string;
    let otherDiscussionId: string;
    const prefix = `test-${randomUUID()}`;
    const userIds: string[] = [];
    const announcementIds: string[] = [];
    const timetableIds: string[] = [];
    const headers = (session: Awaited<ReturnType<typeof createSession>>) => ({
      Cookie: `${sessionCookie}=${session.token}`,
      "x-csrf-token": session.csrfToken,
    });
    const run = (
      method: "get" | "post" | "patch" | "delete",
      path: string,
      session = aliceSession,
    ) => request(app)[method](path).set(headers(session));
    beforeAll(async () => {
      if (!db) throw new Error("TEST_DATABASE_URL required.");
      if (databaseUrl === process.env.DATABASE_URL)
        throw new Error(
          "Use a separate TEST_DATABASE_URL database, not the application database.",
        );
      await applyMigrations(databaseUrl!);
      app = createApp({
        db,
        config: {
          port: 3001,
          clientOrigin: "http://localhost:5173",
          apiOrigin: "http://localhost:3001",
          googleClientId: "",
          googleClientSecret: "",
          googleRedirectUri: "http://localhost:3001/api/auth/google/callback",
          adminEmails: [],
          production: false,
        },
      });
      const makeUser = async (
        suffix: string,
        role: "STUDENT" | "ADMIN" = "STUDENT",
      ) => {
        const row = await db.user.create({
          data: {
            id: `${prefix}-${suffix}`,
            name: `Test ${suffix}`,
            email: `${prefix}.${suffix}@nsut.ac.in`,
            role,
            branch: "TEST",
            semester: 3,
            section: "A",
          },
        });
        userIds.push(row.id);
        return row;
      };
      alice = await makeUser("alice");
      bob = await makeUser("bob");
      admin = await makeUser("admin", "ADMIN");
      aliceSession = await createSession(db, alice.id);
      bobSession = await createSession(db, bob.id);
      adminSession = await createSession(db, admin.id);
      const post = await db.post.create({
        data: {
          authorId: alice.id,
          text: `Persistence ${prefix}`,
          category: "General",
        },
      });
      postId = post.id;
      const discussion = await db.discussion.create({
        data: {
          authorId: alice.id,
          title: `Thread ${prefix}`,
          text: "A real persisted question",
          tags: ["DSA"],
        },
      });
      discussionId = discussion.id;
      const otherDiscussion = await db.discussion.create({
        data: {
          authorId: bob.id,
          title: `Other ${prefix}`,
          text: "Another persisted question",
          tags: [],
        },
      });
      otherDiscussionId = otherDiscussion.id;
    });
    afterAll(async () => {
      if (!db) return;
      await db.announcement.deleteMany({
        where: { id: { in: announcementIds } },
      });
      await db.timetableEntry.deleteMany({
        where: { id: { in: timetableIds } },
      });
      await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    });
    it("checks real database connectivity and rejects unauthenticated requests", async () => {
      expect((await request(app).get("/api/health")).body.data.database).toBe(
        "connected",
      );
      expect((await request(app).get("/api/snapshot")).status).toBe(401);
      expect(
        (await request(app).post("/api/posts").send({ text: "Unauthorized" }))
          .status,
      ).toBe(401);
    });
    it("returns the authenticated profile and a security token, with no fake OAuth fallback", async () => {
      const me = await run("get", "/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe(alice.email);
      expect(me.body.data.csrfToken).toBe(aliceSession.csrfToken);
      const missing = await request(app).get("/api/auth/google");
      expect(missing.status).toBe(503);
      expect(missing.body.error).toContain("GOOGLE_CLIENT_ID");
      const status = await request(app).get("/api/auth/status");
      expect(status.status).toBe(200);
      expect(status.body).toEqual({ data: { configured: false } });
    });
    it("rejects malformed OAuth configuration before creating sign-in state", async () => {
      const invalid = createApp({
        db: db!,
        config: {
          port: 3001,
          clientOrigin: "http://localhost:5173",
          apiOrigin: "http://localhost:3001",
          googleClientId: "not-an-oauth-web-client",
          googleClientSecret: "test-placeholder",
          googleRedirectUri: "http://localhost:3001/api/auth/google/callback",
          adminEmails: [],
          production: false,
        },
      });
      const before = await db!.oAuthState.count();
      expect((await request(invalid).get("/api/auth/status")).body).toEqual({
        data: { configured: false },
      });
      expect((await request(invalid).get("/api/auth/google")).status).toBe(503);
      expect(await db!.oAuthState.count()).toBe(before);
    });
    it("binds one-use OAuth state to its browser and sets production-safe cookies", async () => {
      const oauthApp = createApp({
        db: db!,
        config: {
          port: 3001,
          clientOrigin: "https://campus.example",
          apiOrigin: "https://api.example",
          googleClientId: "1234567890-integration.apps.googleusercontent.com",
          googleClientSecret: "integration-placeholder",
          googleRedirectUri: "https://api.example/api/auth/google/callback",
          adminEmails: [],
          production: true,
        },
      });
      const status = await request(oauthApp).get("/api/auth/status");
      expect(status.status).toBe(200);
      expect(status.body).toEqual({ data: { configured: true } });
      const begin = await request(oauthApp).get("/api/auth/google");
      expect(begin.status).toBe(302);
      const location = new URL(begin.headers.location);
      expect(location.origin).toBe("https://accounts.google.com");
      const state = location.searchParams.get("state")!;
      const nonce = location.searchParams.get("nonce")!;
      const stateRow = await db!.oAuthState.findUniqueOrThrow({
        where: { stateHash: hashToken(state) },
      });
      expect(stateRow.nonce).toBe(nonce);
      expect(stateRow.stateHash).not.toBe(state);
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      const cookie = begin.headers["set-cookie"][0];
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(
        (
          await request(oauthApp)
            .get(`/api/auth/google/callback?state=${state}`)
            .set("Cookie", `${oauthCookie}=wrong-state`)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(oauthApp)
            .get(`/api/auth/google/callback?state=${state}`)
            .set("Cookie", `${oauthCookie}=${state}`)
        ).status,
      ).toBe(400);
      expect(
        await db!.oAuthState.findUnique({
          where: { stateHash: hashToken(state) },
        }),
      ).toBeNull();
      expect(
        (
          await request(oauthApp)
            .get(`/api/auth/google/callback?state=${state}`)
            .set("Cookie", `${oauthCookie}=${state}`)
        ).status,
      ).toBe(401);
    });
    it("rejects expired sessions and stores only hashes of the browser token", async () => {
      const stale = await createSession(db!, alice.id);
      expect(stale.session.tokenHash).toBe(hashToken(stale.token));
      expect(stale.session.tokenHash).not.toBe(stale.token);
      await db!.session.update({
        where: { id: stale.session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await run("get", "/api/auth/me", stale)).status).toBe(401);
    });
    it("rejects missing or invalid CSRF and untrusted request origins", async () => {
      const cookie = `${sessionCookie}=${aliceSession.token}`;
      expect(
        (
          await request(app)
            .post("/api/posts")
            .set("Cookie", cookie)
            .send({ text: "Bad CSRF" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/posts")
            .set("Cookie", cookie)
            .set("x-csrf-token", "invalid")
            .send({ text: "Bad CSRF" })
        ).status,
      ).toBe(403);
      expect(
        (
          await run("post", "/api/posts")
            .set("Origin", "https://attacker.example")
            .send({ text: "Bad origin" })
        ).status,
      ).toBe(403);
    });
    it.each([
      ["get", "/api/admin/overview"],
      ["get", "/api/admin/users"],
      ["get", "/api/admin/moderation"],
      ["get", "/api/admin/audit-logs"],
      ["post", "/api/announcements"],
      ["post", "/api/timetable"],
      ["patch", "/api/admin/users/irrelevant/status"],
      ["post", "/api/admin/moderation/irrelevant/action"],
    ] as const)(
      "blocks student access to %s %s on the server",
      async (method, path) => {
        expect((await run(method, path).send({})).status).toBe(403);
      },
    );
    it("enforces post ownership, rejects role escalation, and persists an authorized edit", async () => {
      expect(
        (
          await run("patch", `/api/posts/${postId}`, bobSession).send({
            text: "Stolen",
          })
        ).status,
      ).toBe(403);
      expect(
        (await run("delete", `/api/posts/${postId}`, bobSession)).status,
      ).toBe(403);
      expect(
        (await run("patch", "/api/users/me").send({ role: "ADMIN" })).status,
      ).toBe(400);
      expect(
        (
          await run("patch", "/api/users/me").send({
            name: "Updated Alice",
            year: 2,
          })
        ).status,
      ).toBe(200);
      const updated = await run("patch", `/api/posts/${postId}`).send({
        text: `Edited persistence ${prefix}`,
      });
      expect(updated.status).toBe(200);
      expect(
        (await db!.post.findUniqueOrThrow({ where: { id: postId } })).text,
      ).toBe(`Edited persistence ${prefix}`);
      expect(
        (await db!.user.findUniqueOrThrow({ where: { id: alice.id } })).role,
      ).toBe("STUDENT");
    });
    it("uses unique constraints for idempotent likes, votes, and private bookmarks", async () => {
      const likes = await Promise.all([
        run("post", `/api/posts/${postId}/likes`, bobSession),
        run("post", `/api/posts/${postId}/likes`, bobSession),
      ]);
      expect(likes.map((response) => response.status)).toEqual([200, 200]);
      expect(
        await db!.postLike.count({ where: { postId, userId: bob.id } }),
      ).toBe(1);
      const votes = await Promise.all([
        run("post", `/api/discussions/${discussionId}/votes`, bobSession),
        run("post", `/api/discussions/${discussionId}/votes`, bobSession),
      ]);
      expect(votes.map((response) => response.status)).toEqual([200, 200]);
      expect(
        await db!.discussionVote.count({
          where: { discussionId, userId: bob.id },
        }),
      ).toBe(1);
      const bookmarks = await Promise.all([
        run("post", `/api/posts/${postId}/bookmark`, bobSession),
        run("post", `/api/posts/${postId}/bookmark`, bobSession),
      ]);
      expect(bookmarks.map((response) => response.status)).toEqual([200, 200]);
      expect(
        await db!.bookmark.count({ where: { postId, userId: bob.id } }),
      ).toBe(1);
      expect(
        (await run("get", `/api/posts/${postId}`)).body.data.bookmarks,
      ).toEqual([]);
      expect(
        (await run("get", `/api/posts/${postId}`, bobSession)).body.data
          .bookmarks,
      ).toEqual([bob.id]);
      await run("delete", `/api/posts/${postId}/likes`, bobSession);
      await run("delete", `/api/discussions/${discussionId}/votes`, bobSession);
      expect(
        await db!.postLike.count({ where: { postId, userId: bob.id } }),
      ).toBe(0);
      expect(
        await db!.discussionVote.count({
          where: { discussionId, userId: bob.id },
        }),
      ).toBe(0);
    });
    it("persists comments, creates owner notifications, and enforces notification ownership", async () => {
      const response = await run(
        "post",
        `/api/posts/${postId}/comments`,
        bobSession,
      ).send({ text: "Useful post!" });
      expect(response.status).toBe(201);
      expect(
        await db!.comment.findUnique({ where: { id: response.body.data.id } }),
      ).not.toBeNull();
      const notification = await db!.notification.findFirstOrThrow({
        where: { userId: alice.id, link: `/feed?post=${postId}` },
      });
      expect(
        (
          await run(
            "patch",
            `/api/notifications/${notification.id}/read`,
            bobSession,
          ).send({ read: true })
        ).status,
      ).toBe(404);
      expect(
        (
          await run("patch", `/api/notifications/${notification.id}/read`).send(
            { read: true },
          )
        ).body.data.read,
      ).toBe(true);
      const snapshot = (await run("get", "/api/snapshot", bobSession)).body
        .data;
      expect(
        snapshot.notifications.every(
          (row: { userId: string }) => row.userId === bob.id,
        ),
      ).toBe(true);
      expect(
        snapshot.users.find((row: { id: string }) => row.id === alice.id).email,
      ).toBe("");
      expect(snapshot.auditLogs).toEqual([]);
    });
    it("keeps replies and accepted answers in their thread and restricts acceptance to its owner", async () => {
      const foreign = await run(
        "post",
        `/api/discussions/${otherDiscussionId}/replies`,
        bobSession,
      ).send({ text: "A reply in another thread." });
      expect(
        (
          await run("post", `/api/discussions/${discussionId}/replies`).send({
            text: "Cross-thread nested reply",
            parentId: foreign.body.data.id,
          })
        ).status,
      ).toBe(400);
      const answer = await run(
        "post",
        `/api/discussions/${discussionId}/replies`,
        bobSession,
      ).send({ text: "A helpful answer." });
      expect(answer.status).toBe(201);
      const nested = await run(
        "post",
        `/api/discussions/${discussionId}/replies`,
      ).send({ text: "A follow-up question.", parentId: answer.body.data.id });
      expect(nested.body.data.parentId).toBe(answer.body.data.id);
      expect(
        (
          await run(
            "patch",
            `/api/discussions/${discussionId}/accepted-answer`,
            bobSession,
          ).send({ replyId: answer.body.data.id })
        ).status,
      ).toBe(403);
      expect(
        (
          await run(
            "patch",
            `/api/discussions/${discussionId}/accepted-answer`,
          ).send({ replyId: foreign.body.data.id })
        ).status,
      ).toBe(400);
      expect(
        (
          await run(
            "patch",
            `/api/discussions/${discussionId}/accepted-answer`,
          ).send({ replyId: answer.body.data.id })
        ).body.data.acceptedReplyId,
      ).toBe(answer.body.data.id);
      expect(
        await db!.notification.count({
          where: { userId: alice.id, link: `/discussions/${discussionId}` },
        }),
      ).toBeGreaterThan(0);
    });
    it("publishes administrator notices with notifications and private read status", async () => {
      const created = await run(
        "post",
        "/api/announcements",
        adminSession,
      ).send({
        title: `TEST notice ${prefix}`,
        text: "Fictional integration notice",
        authority: "Test only",
        category: "General",
        status: "PUBLISHED",
        priority: "IMPORTANT",
        pinned: true,
      });
      expect(created.status).toBe(201);
      const recordId = created.body.data.id;
      announcementIds.push(recordId);
      expect(
        await db!.notification.count({
          where: { userId: alice.id, link: `/announcements/${recordId}` },
        }),
      ).toBe(1);
      expect(
        (
          await run("post", `/api/announcements/${recordId}/read`).send({
            read: true,
          })
        ).body.data.readBy,
      ).toEqual([alice.id]);
      expect(
        (await run("get", `/api/announcements/${recordId}`, bobSession)).body
          .data.readBy,
      ).toEqual([]);
      await run("post", `/api/announcements/${recordId}/read`).send({
        read: false,
      });
      expect(
        await db!.announcementRead.count({
          where: { announcementId: recordId, userId: alice.id },
        }),
      ).toBe(0);
      const draft = await run("post", "/api/announcements", adminSession).send({
        title: `TEST draft ${prefix}`,
        text: "Draft",
        authority: "Test only",
      });
      announcementIds.push(draft.body.data.id);
      expect(
        (await run("get", `/api/announcements/${draft.body.data.id}`)).status,
      ).toBe(404);
      const published = await run(
        "patch",
        `/api/announcements/${draft.body.data.id}`,
        adminSession,
      ).send({ status: "PUBLISHED" });
      expect(published.status).toBe(200);
      const archived = await run(
        "patch",
        `/api/announcements/${draft.body.data.id}`,
        adminSession,
      ).send({ status: "ARCHIVED" });
      expect(archived.body.data.status).toBe("ARCHIVED");
      expect(
        (await run("get", `/api/announcements/${draft.body.data.id}`)).status,
      ).toBe(404);
    });
    it("validates timetable ranges, rejects shared resources, and allows adjacent classes", async () => {
      const entry = {
        subject: "Test Algebra",
        code: "TEST101",
        faculty: `${prefix}-Faculty`,
        room: `${prefix.slice(0, 20)}-Room`,
        day: 2,
        start: "09:00",
        end: "10:00",
        branch: prefix,
        semester: 3,
        section: "A",
        color: "#2563eb",
      };
      expect(
        (
          await run("post", "/api/timetable", adminSession).send({
            ...entry,
            end: "08:00",
          })
        ).status,
      ).toBe(400);
      const created = await run("post", "/api/timetable", adminSession).send(
        entry,
      );
      expect(created.status).toBe(201);
      timetableIds.push(created.body.data.id);
      expect(
        (
          await run("post", "/api/timetable", adminSession).send({
            ...entry,
            start: "09:30",
            end: "10:30",
            room: "Different",
            faculty: "Other",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await run("post", "/api/timetable", adminSession).send({
            ...entry,
            branch: "OTHER",
            section: "B",
            faculty: "Other",
          })
        ).status,
      ).toBe(409);
      const adjacent = await run("post", "/api/timetable", adminSession).send({
        ...entry,
        start: "10:00",
        end: "11:00",
      });
      expect(adjacent.status).toBe(201);
      timetableIds.push(adjacent.body.data.id);
      const update = await run(
        "patch",
        `/api/timetable/${adjacent.body.data.id}`,
        adminSession,
      ).send({ subject: "Updated Algebra" });
      expect(update.status).toBe(200);
      expect(update.body.data.subject).toBe("Updated Algebra");
    });
    it("serializes concurrent timetable overlap checks across requests", async () => {
      const entry = {
        subject: "Concurrent Test",
        code: "TEST102",
        faculty: `${prefix}-ConcurrentFaculty`,
        room: `${prefix.slice(0, 20)}-ConcurrentRoom`,
        day: 4,
        start: "12:00",
        end: "13:00",
        branch: prefix,
        semester: 3,
        section: "A",
      };
      const responses = await Promise.all([
        run("post", "/api/timetable", adminSession).send(entry),
        run("post", "/api/timetable", adminSession).send({
          ...entry,
          start: "12:30",
          end: "13:30",
        }),
      ]);
      expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
      for (const response of responses)
        if (response.status === 201) timetableIds.push(response.body.data.id);
    });
    it("moderates hidden content and records server-owned audits", async () => {
      const response = await run(
        "post",
        `/api/admin/moderation/${postId}/action`,
        adminSession,
      ).send({ type: "post", action: "hide" });
      expect(response.status).toBe(200);
      expect((await run("get", `/api/posts/${postId}`)).status).toBe(404);
      expect(
        (await run("get", "/api/snapshot")).body.data.posts.some(
          (row: { id: string }) => row.id === postId,
        ),
      ).toBe(false);
      const adminSnapshot = (await run("get", "/api/snapshot", adminSession))
        .body.data;
      expect(
        adminSnapshot.posts.some((row: { id: string }) => row.id === postId),
      ).toBe(true);
      expect(
        adminSnapshot.auditLogs.some(
          (row: { targetId: string; actorId: string }) =>
            row.targetId === postId && row.actorId === admin.id,
        ),
      ).toBe(true);
      expect(
        (
          await run(
            "post",
            `/api/admin/moderation/${postId}/action`,
            adminSession,
          ).send({ type: "post", action: "restore" })
        ).status,
      ).toBe(200);
    });
    it("searches persisted content and returns pagination for collections", async () => {
      const results = await run(
        "get",
        `/api/search?q=${encodeURIComponent(prefix)}`,
      );
      expect(results.status).toBe(200);
      expect(
        results.body.data.posts.some(
          (row: { id: string }) => row.id === postId,
        ),
      ).toBe(true);
      const collection = await run("get", "/api/posts?limit=1&page=1");
      expect(collection.body.data).toHaveLength(1);
      expect(collection.body.pagination.limit).toBe(1);
      expect((await run("get", "/api/posts?limit=999")).status).toBe(400);
    });
    it("defaults provisioned identities to students and preserves the trusted administrator boundary", async () => {
      const email = `${prefix}.google@nsut.ac.in`;
      const identity = {
        googleId: `${prefix}-google`,
        email,
        name: "Verified student",
        avatarUrl: "",
      };
      const account = await provisionGoogleUser(db!, identity, []);
      userIds.push(account.id);
      expect(account.role).toBe("STUDENT");
      const elevated = await provisionGoogleUser(db!, identity, [email]);
      expect(elevated.role).toBe("ADMIN");
      await expect(
        provisionGoogleUser(
          db!,
          { ...identity, googleId: `${prefix}-another-google` },
          [],
        ),
      ).rejects.toThrow(/different Google identity/);
    });
    it("persists student follows with idempotent concurrent writes and separate viewer lists", async () => {
      const responses = await Promise.all([
        run("post", `/api/users/${bob.id}/follow`).send({}),
        run("post", `/api/users/${bob.id}/follow`).send({}),
      ]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(responses[0].body.data).toEqual({ following: [bob.id] });
      expect(
        await db!.follow.count({
          where: { followerId: alice.id, followingId: bob.id },
        }),
      ).toBe(1);
      expect((await run("get", "/api/snapshot")).body.data.following).toEqual([
        bob.id,
      ]);
      expect(
        (await run("get", "/api/snapshot", bobSession)).body.data.following,
      ).toEqual([]);
      const freshSession = await createSession(db!, alice.id);
      expect(
        (await run("get", "/api/snapshot", freshSession)).body.data.following,
      ).toEqual([bob.id]);
    });
    it("filters following posts by persisted relationships instead of shared branch", async () => {
      const created = await run("post", "/api/posts", bobSession).send({
        text: `Followed author ${prefix}`,
      });
      expect(created.status).toBe(201);
      const followed = await run("get", "/api/posts?sort=following");
      expect(followed.status).toBe(200);
      expect(followed.body.data.map((row: { id: string }) => row.id)).toEqual([
        created.body.data.id,
      ]);
      expect(
        (await run("get", "/api/posts?sort=following", bobSession)).body.data,
      ).toEqual([]);
      expect(
        (await run("delete", `/api/users/${bob.id}/follow`)).body.data
          .following,
      ).toEqual([]);
      expect((await run("delete", `/api/users/${bob.id}/follow`)).status).toBe(
        200,
      );
      expect((await run("get", "/api/posts?sort=following")).body.data).toEqual(
        [],
      );
    });
    it("rejects self-follow, nonexistent targets, missing authentication, and forged follower IDs", async () => {
      expect(
        (await run("post", `/api/users/${alice.id}/follow`).send({})).status,
      ).toBe(400);
      expect(
        (await run("post", "/api/users/nonexistent/follow").send({})).status,
      ).toBe(404);
      expect(
        (await request(app).post(`/api/users/${bob.id}/follow`).send({}))
          .status,
      ).toBe(401);
      expect(
        (
          await run("post", `/api/users/${bob.id}/follow`).send({
            followerId: admin.id,
          })
        ).status,
      ).toBe(400);
      expect(await db!.follow.count({ where: { followerId: admin.id } })).toBe(
        0,
      );
    });
    it("excludes suspended follow targets and still permits unfollow cleanup", async () => {
      const target = await db!.user.create({
        data: {
          name: "Temporary follow target",
          email: `${prefix}.follow-target@nsut.ac.in`,
        },
      });
      userIds.push(target.id);
      expect(
        (await run("post", `/api/users/${target.id}/follow`).send({})).status,
      ).toBe(200);
      await db!.user.update({
        where: { id: target.id },
        data: { status: "SUSPENDED" },
      });
      expect(
        (await run("post", `/api/users/${target.id}/follow`).send({})).status,
      ).toBe(404);
      expect((await run("get", "/api/snapshot")).body.data.following).toEqual(
        [],
      );
      expect(
        (await run("delete", `/api/users/${target.id}/follow`)).status,
      ).toBe(200);
      expect(
        await db!.follow.count({ where: { followingId: target.id } }),
      ).toBe(0);
    });
    it("cascades follow relationships when a target profile is deleted", async () => {
      const target = await db!.user.create({
        data: {
          name: "Temporary follow cascade",
          email: `${prefix}.follow-cascade@nsut.ac.in`,
        },
      });
      userIds.push(target.id);
      expect(
        (await run("post", `/api/users/${target.id}/follow`).send({})).status,
      ).toBe(200);
      await db!.user.delete({ where: { id: target.id } });
      expect(
        await db!.follow.count({ where: { followingId: target.id } }),
      ).toBe(0);
      expect((await run("get", "/api/snapshot")).body.data.following).toEqual(
        [],
      );
    });
    it("revokes suspended accounts and destroys the session on logout", async () => {
      expect(
        (
          await run(
            "patch",
            `/api/admin/users/${bob.id}/status`,
            adminSession,
          ).send({ status: "SUSPENDED" })
        ).status,
      ).toBe(200);
      expect(await db!.session.count({ where: { userId: bob.id } })).toBe(0);
      expect((await run("get", "/api/auth/me", bobSession)).status).toBe(401);
      const logout = await run("post", "/api/auth/logout");
      expect(logout.status).toBe(200);
      expect(logout.headers["set-cookie"][0]).toContain("HttpOnly");
      expect((await run("get", "/api/auth/me")).status).toBe(401);
    });
    it("can re-run the migration runner without mutating the applied history", async () => {
      expect(await applyMigrations(databaseUrl!)).toEqual([]);
    });
  },
);
