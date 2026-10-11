import type {
  Prisma,
  User as DbUser,
  Comment as DbComment,
  DiscussionReply as DbReply,
  TimetableEntry as DbTimetable,
  Notification as DbNotification,
  AuditLog as DbAudit,
} from "@prisma/client";
import type {
  User,
  Post,
  Comment,
  Discussion,
  Reply,
  Announcement,
  TimetableEntry,
  Notification,
  AuditLog,
  CampusEvent,
} from "../../../shared/model.js";

export const postInclude = {
  likes: true,
  bookmarks: true,
} satisfies Prisma.PostInclude;
export const discussionInclude = {
  votes: true,
} satisfies Prisma.DiscussionInclude;
export const announcementInclude = {
  reads: true,
} satisfies Prisma.AnnouncementInclude;
export const eventInclude = (viewerId: string) => ({
  rsvps: { where: { userId: viewerId }, select: { userId: true } },
  _count: { select: { rsvps: true } },
}) satisfies Prisma.CampusEventInclude;
type DbEvent = Prisma.CampusEventGetPayload<{
  include: ReturnType<typeof eventInclude>;
}>;
type DbPost = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type DbDiscussion = Prisma.DiscussionGetPayload<{
  include: typeof discussionInclude;
}>;
type DbAnnouncement = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;
export function user(row: DbUser, viewerId: string): User {
  return {
    id: row.id,
    name: row.name,
    email: row.id === viewerId ? row.email : "",
    role: row.role,
    branch: row.branch,
    year: row.year,
    semester: row.semester,
    section: row.section,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    visibility: row.visibility,
  };
}
export function post(row: DbPost, viewerId: string): Post {
  return {
    id: row.id,
    authorId: row.authorId,
    text: row.text,
    imageUrl: row.imageUrl,
    category: row.category,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    likes: row.likes.map((like) => like.userId),
    bookmarks: row.bookmarks
      .filter((bookmark) => bookmark.userId === viewerId)
      .map((bookmark) => bookmark.userId),
  };
}
export function comment(row: DbComment): Comment {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}
export function discussion(row: DbDiscussion): Discussion {
  return {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    text: row.text,
    category: row.category,
    tags: row.tags,
    votes: row.votes.map((vote) => vote.userId),
    acceptedReplyId: row.acceptedReplyId,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
  };
}
export function reply(row: DbReply): Reply {
  return {
    id: row.id,
    discussionId: row.discussionId,
    authorId: row.authorId,
    text: row.text,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
  };
}
export function announcement(
  row: DbAnnouncement,
  viewerId: string,
): Announcement {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    authority: row.authority,
    category: row.category,
    priority: row.priority,
    pinned: row.pinned,
    status: row.status,
    readBy: row.reads
      .filter((read) => read.userId === viewerId)
      .map((read) => read.userId),
    createdAt: row.createdAt.toISOString(),
  };
}
export function timetable(row: DbTimetable): TimetableEntry {
  return {
    id: row.id,
    subject: row.subject,
    code: row.code,
    faculty: row.faculty,
    room: row.room,
    day: row.day,
    start: row.start,
    end: row.end,
    branch: row.branch,
    semester: row.semester,
    section: row.section,
    color: row.color,
  };
}
export function notification(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.userId,
    text: row.text,
    link: row.link,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}
export function audit(row: DbAudit): AuditLog {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function event(row: DbEvent): CampusEvent {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    attending: row.rsvps.length > 0,
    attendeeCount: row._count.rsvps,
  };
}
