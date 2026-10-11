import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, admin = false) {
  await page.goto("/login");
  await page
    .getByRole("button", {
      name: admin ? "Admin demo" : "Student demo",
      exact: true,
    })
    .click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
}
test("student logs in, navigates, creates a persistent post, comments, and logs out", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Campus feed", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Write a post" })
    .fill("A new campus coding circle meets on Fridays.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const post = page
    .locator("article")
    .filter({ hasText: "A new campus coding circle meets on Fridays." });
  await expect(post).toBeVisible();
  await post
    .getByRole("button", { name: "Bookmark post", exact: true })
    .click();
  await expect(
    post.getByRole("button", { name: "Bookmark post", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await post
    .getByRole("button", { name: "Comments on post by Aarav Sharma" })
    .click();
  await post
    .getByRole("textbox", { name: "Write a comment" })
    .fill("Bring your laptop!");
  await post.getByRole("button", { name: "Send comment" }).click();
  await expect(
    post.getByText("Bring your laptop!", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A new campus coding circle meets on Fridays.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});
test("discussion creation, replies, and accepted answers work", async ({
  page,
}) => {
  await login(page);
  await page.goto("/discussions");
  await page
    .getByRole("button", { name: "New discussion", exact: true })
    .click();
  await page
    .getByLabel("Discussion title")
    .fill("Where do we meet for DSA practice?");
  await page
    .getByLabel("Start the conversation")
    .fill("Looking for a good place on campus.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("link", {
      name: "Where do we meet for DSA practice?",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Your reply", exact: true })
    .fill("Meet at the library entrance.");
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page
    .getByRole("button", { name: "Accept answer", exact: true })
    .click();
  await expect(
    page.getByText("Accepted answer", { exact: true }),
  ).toBeVisible();
});
test("search filters real content and announcements retain read status", async ({
  page,
}) => {
  await login(page);
  await page.goto("/search?q=DSA&type=Discussions");
  await expect(
    page.getByRole("link", {
      name: /Let’s build a consistent DSA study group/,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", {
      name: "Search posts, discussions, announcements, or people…",
    })
    .fill("no-such-campus-record");
  await expect(
    page.getByRole("heading", { name: "No matches yet" }),
  ).toBeVisible();
  await page.goto("/announcements");
  const notice = page
    .locator("article")
    .filter({ hasText: "Semester registration window is opening" });
  await notice.getByRole("button", { name: "Mark read", exact: true }).click();
  await page.reload();
  await expect(
    notice.getByRole("button", { name: "Mark unread", exact: true }),
  ).toBeVisible();
});
test("students cannot use admin UI; own profile edits persist", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("About you")
    .fill("Frontend developer and campus volunteer.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(
    page.getByText("Frontend developer and campus volunteer.", { exact: true }),
  ).toBeVisible();
});
test("admin publishes notices and confirms moderation with audits", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "New announcement", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Demo campus meetup");
  await page
    .getByLabel("Announcement content")
    .fill("A fictional meetup for the community.");
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Demo campus meetup", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Moderation", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide post", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByText("Moderated post", { exact: true })).toBeVisible();
});
test("mobile navigation, day timetable, dark theme, and layouts have no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Timetable", exact: true }).click();
  await expect(page.locator(".day-view")).toBeVisible();
  await page
    .locator(".day-view")
    .getByRole("button", { name: "Mon", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Design & Analysis of Algorithms",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const route of [
    "/",
    "/feed",
    "/discussions",
    "/announcements",
    "/timetable",
    "/profile",
    "/search",
    "/notifications",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
