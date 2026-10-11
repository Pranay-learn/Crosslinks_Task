import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import { createDatabase } from "../../server/src/lib/db";
import { createApp } from "../../server/src/app";
import { createSession } from "../../server/src/services/auth";
import { applyMigrations } from "../../server/scripts/migrate";

// These internal trusted fixtures exercise API integration, not Google's external consent flow.
const url = process.env.TEST_DATABASE_URL;
test.skip(
  !url,
  "TEST_DATABASE_URL is required for real PostgreSQL browser integration.",
);
const db = url ? createDatabase(url) : undefined;
const prefix = "browser-" + randomUUID();
const cohort = prefix.slice(0, 18);
const classTitle = `${cohort} Early class`;
let server: Server;
let studentId: string;
let adminId: string;
let student: Awaited<ReturnType<typeof createSession>>;
let admin: Awaited<ReturnType<typeof createSession>>;
test.beforeAll(async () => {
  if (!db || !url || url === process.env.DATABASE_URL)
    throw new Error("Use a separate TEST_DATABASE_URL.");
  await applyMigrations(url);
  const u = await db.user.create({
    data: {
      name: "Browser Student",
      email: `${prefix}@nsut.ac.in`,
      branch: "CSE",
      semester: 5,
      year: 3,
      section: cohort,
    },
  });
  studentId = u.id;
  const a = await db.user.create({
    data: {
      name: "Browser Admin",
      email: `${prefix}.admin@nsut.ac.in`,
      role: "ADMIN",
      branch: "CSE",
      semester: 5,
      year: 3,
      section: cohort,
    },
  });
  adminId = a.id;
  await db.post.create({
    data: {
      authorId: adminId,
      text: `${prefix} Followed campus update`,
      category: "General",
    },
  });
  student = await createSession(db, u.id);
  admin = await createSession(db, a.id);
  const app = createApp({
    db,
    config: {
      port: 3002,
      clientOrigin: "http://localhost:5174",
      apiOrigin: "http://localhost:3002",
      googleClientId: "",
      googleClientSecret: "",
      googleRedirectUri: "http://localhost:3002/api/auth/google/callback",
      production: false,
      adminEmails: [],
    },
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(3002, "127.0.0.1", () => resolve(s));
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  if (db) {
    await db.timetableEntry.deleteMany({ where: { faculty: prefix } });
    await db.announcement.deleteMany({
      where: { title: { startsWith: prefix } },
    });
    await db.campusEvent.deleteMany({
      where: { title: { startsWith: prefix } },
    });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [studentId, adminId].filter(Boolean) } },
    });
    await db.user.deleteMany({
      where: { id: { in: [studentId, adminId].filter(Boolean) } },
    });
    await db.$disconnect();
  }
});
async function session(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: "nsut_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  await expect(
    page.getByText("Fictional campus content", { exact: true }),
  ).toHaveCount(0);
}
test("live student posts, edits discussion tags, bookmarks, persists and logs out", async ({
  page,
}) => {
  await session(page, student.token);
  await page.goto("/feed");
  await page
    .getByRole("textbox", { name: "Write a post" })
    .fill(`${prefix} persistent student post`);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    page.getByText(`${prefix} persistent student post`, { exact: true }),
  ).toBeVisible();
  const post = page
    .locator("article")
    .filter({ hasText: `${prefix} persistent student post` });
  await post.getByRole("button", { name: "Bookmark post" }).click();
  await expect(
    post.getByRole("button", { name: "Bookmark post" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await db!.post.count({
      where: { authorId: studentId, text: `${prefix} persistent student post` },
    }),
  ).toBe(1);
  await page.goto("/discussions");
  await page
    .getByRole("button", { name: "New discussion", exact: true })
    .click();
  await page.getByLabel("Discussion title").fill(`${prefix} live question`);
  await page
    .getByLabel("Start the conversation")
    .fill("A real database-backed discussion.");
  await page.getByLabel("Tags (comma separated)").fill("DSA, Exams");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("link", { name: `${prefix} live question`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit discussion", exact: true })
    .click();
  await page
    .getByLabel("Tags (comma separated)")
    .fill("Web Development, Internships");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("#Web Development · #Internships", { exact: true }),
  ).toBeVisible();
  const thread = await db!.discussion.findFirstOrThrow({
    where: { authorId: studentId, title: `${prefix} live question` },
  });
  expect(thread.tags).toEqual(["Web Development", "Internships"]);
  await page.goto(`/profile/${adminId}`);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.goto("/feed");
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(
    page.getByText(`${prefix} Followed campus update`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${prefix} persistent student post`, { exact: true }),
  ).toHaveCount(0);
  await page.goto(`/discussions/${thread.id}`);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `${prefix} live question`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  expect(await db!.session.count({ where: { id: student.session.id } })).toBe(
    0,
  );
});
test("live admin creates a hex-color timetable class and publishes a notice", async ({
  page,
}) => {
  await session(page, admin.token);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Timetable", exact: true }).click();
  await page.getByRole("button", { name: "Add class", exact: true }).click();
  await page.getByLabel("Subject", { exact: true }).fill(classTitle);
  await page.getByLabel("Course code").fill("TEST101");
  await page.getByLabel("Faculty", { exact: true }).fill(prefix);
  await page.getByLabel("Room", { exact: true }).fill(prefix.slice(0, 35));
  await page.getByLabel("Starts at").fill("08:00");
  await page.getByLabel("Ends at").fill("09:00");
  await page.getByLabel("Section", { exact: true }).fill(cohort);
  await page.getByLabel("Color", { exact: true }).selectOption("violet");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(classTitle, { exact: true })).toBeVisible();
  expect(
    (await db!.timetableEntry.findFirstOrThrow({ where: { faculty: prefix } }))
      .color,
  ).toBe("#8b5cf6");
  await page.goto("/timetable");
  const block = page.locator(".class-block").filter({ hasText: classTitle });
  await expect(block).toBeVisible();
  await expect(block).toHaveClass(/violet/);
  expect(
    await block.evaluate(
      (el) =>
        el.getBoundingClientRect().top >=
        el.parentElement!.getBoundingClientRect().top,
    ),
  ).toBe(true);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "New announcement", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill(`${prefix} campus announcement`);
  await page
    .getByLabel("Announcement content")
    .fill("Verified live database notice.");
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText(`${prefix} campus announcement`, { exact: true }),
  ).toBeVisible();
  expect(
    await db!.announcement.count({
      where: { title: `${prefix} campus announcement`, status: "PUBLISHED" },
    }),
  ).toBe(1);
});
test("admin publishes and edits an IST event; student RSVP persists and can be removed", async ({
  page,
}) => {
  const title = `${prefix} campus workshop`;
  await session(page, admin.token);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("button", { name: "New event", exact: true }).click();
  await page.getByLabel("Event title").fill(title);
  await page
    .getByLabel("Event description")
    .fill("A database-backed campus workshop.");
  await page.getByLabel("Event location").fill("APJ 1");
  await page.getByLabel("Starts (IST)").fill("2030-11-18T17:30");
  await page.getByLabel("Ends (IST)").fill("2030-11-18T19:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const event = await db!.campusEvent.findFirstOrThrow({ where: { title } });
  expect(event.startsAt.toISOString()).toBe("2030-11-18T12:00:00.000Z");
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(page.getByLabel("Starts (IST)")).toHaveValue("2030-11-18T17:30");
  await page.getByLabel("Event location").fill("APJ 2");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/APJ 2/)).toBeVisible();
  // The earlier logout test deliberately revoked its student session.
  const attendeeSession = await createSession(db!, studentId);
  await page.setViewportSize({ width: 390, height: 844 });
  await session(page, attendeeSession.token);
  await page
    .getByRole("button", { name: `Join ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Leave ${title}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Leave ${title}`, exact: true }),
  ).toBeVisible();
  expect(
    await db!.eventRsvp.count({
      where: { eventId: event.id, userId: studentId },
    }),
  ).toBe(1);
  await page
    .getByRole("button", { name: `Leave ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Join ${title}`, exact: true }),
  ).toBeVisible();
  expect(
    await db!.eventRsvp.count({
      where: { eventId: event.id, userId: studentId },
    }),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("unconfigured live OAuth keeps simulated accounts out of campus access", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("nsut-demo-user", "admin"));
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Google sign-in is not available yet. Please contact a campus administrator.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Student demo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Admin demo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Explore the simulated demo", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
});
test("unavailable API denies simulated login and retry returns to the real sign-in check", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Service unavailable" }),
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByText(
      "Sign-in is temporarily unavailable. Please try again later.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Admin demo", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/health");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText(
      "Google sign-in is not available yet. Please contact a campus administrator.",
    ),
  ).toBeVisible();
});
