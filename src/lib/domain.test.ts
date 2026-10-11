import { describe, expect, it } from "vitest";
import { createDemo } from "../data/demo";
import { applyAction, safeUrl, validateTime } from "./domain";
describe("demo community behavior", () => {
  it("creates posts without changing source data; likes and bookmarks toggle once", () => {
    const s = createDemo(),
      u = s.users[0];
    const made = applyAction(s, u, "post.create", {
      text: "Campus question",
      category: "General",
    });
    expect(made.posts[0].text).toBe("Campus question");
    expect(s.posts).toHaveLength(4);
    const liked = applyAction(made, u, "post.like", { id: made.posts[0].id });
    expect(liked.posts[0].likes).toEqual([u.id]);
    expect(
      applyAction(liked, u, "post.like", { id: made.posts[0].id }).posts[0]
        .likes,
    ).toEqual([]);
    const bookmarked = applyAction(made, u, "post.bookmark", {
      id: made.posts[0].id,
    });
    expect(bookmarked.posts[0].bookmarks).toEqual([u.id]);
  });
  it("rejects editing another student post and privileged student actions", () => {
    const s = createDemo(),
      u = s.users[0];
    expect(() =>
      applyAction(s, u, "post.edit", { id: "p1", text: "Changed" }),
    ).toThrow("own");
    expect(() =>
      applyAction(s, u, "announcement.delete", { id: "a1" }),
    ).toThrow("Administrator");
  });
  it("creates notifications for replies and only the thread author accepts answers", () => {
    const s = createDemo(),
      u = s.users[0];
    const replied = applyAction(s, u, "discussion.reply", {
      id: "d1",
      text: "A new answer",
    });
    expect(replied.notifications[0].userId).toBe("isha");
    expect(() =>
      applyAction(replied, u, "discussion.accept", {
        id: "d1",
        replyId: replied.replies.at(-1)!.id,
      }),
    ).toThrow("own");
  });
  it("rejects overlapping classes and invalid time ranges", () => {
    const s = createDemo(),
      admin = s.users.find((u) => u.role === "ADMIN")!;
    expect(() =>
      applyAction(s, admin, "timetable.save", {
        subject: "Class",
        code: "C",
        faculty: "F",
        room: "R",
        day: 1,
        start: "09:30",
        end: "10:30",
        branch: "CSE",
        semester: 5,
        section: "A",
      }),
    ).toThrow("conflicts");
    expect(validateTime("15:00", "14:00")).toBe(false);
    expect(validateTime("25:00", "26:00")).toBe(false);
    expect(validateTime("09:00", "10:00")).toBe(true);
  });
  it("rejects unsafe images and blank content", () => {
    const s = createDemo();
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(() =>
      applyAction(s, s.users[0], "post.create", { text: " " }),
    ).toThrow("Content");
  });
});
