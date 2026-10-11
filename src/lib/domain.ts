import type { ActionName, Input, Snapshot, User } from "../../shared/model";
const str = (v: Input, key: string) => String(v[key] ?? "").trim();
const id = () => crypto.randomUUID();
export function safeUrl(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export function validateTime(start: string, end: string) {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(end) &&
    start < end
  );
}
export function applyAction(
  state: Snapshot,
  user: User,
  action: ActionName,
  input: Input,
): Snapshot {
  if (user.status !== "ACTIVE") throw new Error("This account is suspended.");
  const s: Snapshot = structuredClone(state);
  const key = str(input, "id");
  const now = new Date().toISOString();
  const toggle = (arr: string[]) =>
    arr.includes(user.id)
      ? arr.filter((x) => x !== user.id)
      : [...arr, user.id];
  const requireText = (name: string, max = 5000) => {
    const v = str(input, name);
    if (!v || v.length > max)
      throw new Error(
        `${name === "text" ? "Content" : name} must contain 1–${max} characters.`,
      );
    return v;
  };
  const admin = () => {
    if (user.role !== "ADMIN")
      throw new Error("Administrator access required.");
  };
  const own = (authorId: string) => {
    if (authorId !== user.id)
      throw new Error("You can only edit your own content.");
  };
  const notify = (target: string, text: string, link: string) => {
    if (target !== user.id)
      s.notifications.unshift({
        id: id(),
        userId: target,
        text,
        link,
        read: false,
        createdAt: now,
      });
  };
  const audit = (name: string) =>
    s.auditLogs.unshift({
      id: id(),
      actorId: user.id,
      action: name,
      targetId: key,
      createdAt: now,
    });
  if (action.startsWith("post.")) {
    if (action === "post.create") {
      const imageUrl = str(input, "imageUrl");
      if (!safeUrl(imageUrl)) throw new Error("Use a valid HTTPS image URL.");
      s.posts.unshift({
        id: id(),
        authorId: user.id,
        text: requireText("text"),
        imageUrl,
        category: str(input, "category") || "General",
        likes: [],
        bookmarks: [],
        hidden: false,
        createdAt: now,
      });
      return s;
    }
    const p = s.posts.find((p) => p.id === key);
    if (!p || p.hidden) throw new Error("Post unavailable.");
    if (action === "post.edit") {
      own(p.authorId);
      p.text = requireText("text");
    }
    if (action === "post.delete") {
      own(p.authorId);
      s.posts = s.posts.filter((x) => x.id !== key);
      s.comments = s.comments.filter((x) => x.postId !== key);
    }
    if (action === "post.like") p.likes = toggle(p.likes);
    if (action === "post.bookmark") p.bookmarks = toggle(p.bookmarks);
    if (action === "post.comment") {
      s.comments.push({
        id: id(),
        postId: key,
        authorId: user.id,
        text: requireText("text", 2000),
        createdAt: now,
      });
      notify(
        p.authorId,
        `${user.name} commented on your post.`,
        `/feed/${key}`,
      );
    }
  } else if (action.startsWith("discussion.")) {
    if (action === "discussion.create") {
      s.discussions.unshift({
        id: id(),
        authorId: user.id,
        title: requireText("title", 180),
        text: requireText("text"),
        category: str(input, "category") || "General",
        tags: String(input.tags ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 5),
        votes: [],
        acceptedReplyId: null,
        createdAt: now,
        hidden: false,
      });
      return s;
    }
    const d = s.discussions.find((d) => d.id === key);
    if (!d || d.hidden) throw new Error("Discussion unavailable.");
    if (action === "discussion.edit") {
      own(d.authorId);
      d.title = requireText("title", 180);
      d.text = requireText("text");
      d.category = str(input, "category") || d.category;
      d.tags = String(input.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    if (action === "discussion.delete") {
      own(d.authorId);
      s.discussions = s.discussions.filter((x) => x.id !== key);
      s.replies = s.replies.filter((x) => x.discussionId !== key);
    }
    if (action === "discussion.vote") d.votes = toggle(d.votes);
    if (action === "discussion.accept") {
      own(d.authorId);
      const r = s.replies.find(
        (x) => x.id === input.replyId && x.discussionId === key,
      );
      if (!r) throw new Error("Reply unavailable.");
      d.acceptedReplyId = d.acceptedReplyId === r.id ? null : r.id;
    }
    if (action === "discussion.reply") {
      const parentId = str(input, "parentId") || null;
      if (
        parentId &&
        !s.replies.some((r) => r.id === parentId && r.discussionId === key)
      )
        throw new Error("Reply unavailable.");
      s.replies.push({
        id: id(),
        discussionId: key,
        authorId: user.id,
        text: requireText("text", 3000),
        parentId,
        createdAt: now,
      });
      notify(
        d.authorId,
        `${user.name} replied to your discussion.`,
        `/discussions/${key}`,
      );
    }
  } else if (action.startsWith("announcement.")) {
    if (action === "announcement.read") {
      const a = s.announcements.find((a) => a.id === key);
      if (!a) throw new Error("Announcement unavailable.");
      a.readBy = toggle(a.readBy);
      return s;
    }
    admin();
    if (action === "announcement.delete")
      s.announcements = s.announcements.filter((x) => x.id !== key);
    if (action === "announcement.save") {
      const old = s.announcements.find((x) => x.id === key);
      const status = str(input, "status") as "PUBLISHED" | "DRAFT" | "ARCHIVED";
      const priority = str(input, "priority") as
        "NORMAL" | "IMPORTANT" | "URGENT";
      if (
        !["PUBLISHED", "DRAFT", "ARCHIVED"].includes(status) ||
        !["NORMAL", "IMPORTANT", "URGENT"].includes(priority)
      )
        throw new Error("Invalid announcement status or priority.");
      const a = {
        id: old?.id ?? id(),
        title: requireText("title", 180),
        text: requireText("text"),
        authority: requireText("authority", 120),
        category: str(input, "category"),
        priority,
        pinned: Boolean(input.pinned),
        status,
        readBy: old?.readBy ?? [],
        createdAt: old?.createdAt ?? now,
      };
      s.announcements = [a, ...s.announcements.filter((x) => x.id !== key)];
      if (status === "PUBLISHED" && old?.status !== "PUBLISHED")
        s.users.forEach((u) =>
          notify(
            u.id,
            `New announcement: ${a.title}`,
            `/announcements/${a.id}`,
          ),
        );
    }
    audit(action);
  } else if (action.startsWith("timetable.")) {
    admin();
    if (action === "timetable.delete")
      s.timetable = s.timetable.filter((x) => x.id !== key);
    if (action === "timetable.save") {
      const start = str(input, "start"),
        end = str(input, "end"),
        day = Number(input.day),
        semester = Number(input.semester);
      if (
        !validateTime(start, end) ||
        day < 1 ||
        day > 6 ||
        semester < 1 ||
        semester > 8
      )
        throw new Error("Choose a valid day, semester and time range.");
      const branch = str(input, "branch"),
        section = str(input, "section");
      if (
        s.timetable.some(
          (t) =>
            t.id !== key &&
            t.day === day &&
            t.branch === branch &&
            t.semester === semester &&
            t.section === section &&
            t.start < end &&
            t.end > start,
        )
      )
        throw new Error("This class conflicts with another timetable entry.");
      s.timetable = [
        {
          id: key || id(),
          subject: requireText("subject", 120),
          code: requireText("code", 20),
          faculty: requireText("faculty", 120),
          room: requireText("room", 120),
          day,
          start,
          end,
          branch,
          semester,
          section,
          color: str(input, "color") || "blue",
        },
        ...s.timetable.filter((t) => t.id !== key),
      ];
    }
    audit(action);
  } else if (action === "profile.edit") {
    const u = s.users.find((u) => u.id === user.id)!;
    const avatarUrl = str(input, "avatarUrl");
    if (!safeUrl(avatarUrl)) throw new Error("Use a valid HTTPS avatar URL.");
    const year = Number(input.year),
      semester = Number(input.semester);
    if (year < 1 || year > 4 || semester < 1 || semester > 8)
      throw new Error("Select a valid academic year and semester.");
    Object.assign(u, {
      name: requireText("name", 100),
      bio: str(input, "bio").slice(0, 500),
      avatarUrl,
      branch: str(input, "branch"),
      section: str(input, "section") || "A",
      year,
      semester,
      visibility: str(input, "visibility") === "PUBLIC" ? "PUBLIC" : "CAMPUS",
    });
  } else if (
    action === "notification.read" ||
    action === "notification.readAll"
  )
    s.notifications.forEach((n) => {
      if (
        n.userId === user.id &&
        (action === "notification.readAll" || n.id === key)
      )
        n.read = true;
    });
  else if (action === "admin.moderate") {
    admin();
    const item =
      str(input, "kind") === "post"
        ? s.posts.find((x) => x.id === key)
        : s.discussions.find((x) => x.id === key);
    if (!item) throw new Error("Content unavailable.");
    item.hidden = !item.hidden;
    audit("Moderated " + str(input, "kind"));
  } else if (action === "admin.userStatus") {
    admin();
    const u = s.users.find((x) => x.id === key);
    if (!u || u.id === user.id || u.role === "ADMIN")
      throw new Error("This account cannot be suspended here.");
    u.status = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    audit("Updated account status");
  }
  return s;
}
