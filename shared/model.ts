export type Role = "STUDENT" | "ADMIN";
export type Category =
  "General" | "Academics" | "Placements" | "Events" | "Clubs" | "Lost & Found";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branch: string;
  year: number;
  semester: number;
  section: string;
  bio: string;
  avatarUrl: string;
  createdAt: string;
  status: "ACTIVE" | "SUSPENDED";
  visibility: "PUBLIC" | "CAMPUS";
}
export interface Post {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string;
  category: string;
  createdAt: string;
  likes: string[];
  bookmarks: string[];
  hidden: boolean;
}
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}
export interface Discussion {
  id: string;
  authorId: string;
  title: string;
  text: string;
  category: string;
  tags: string[];
  votes: string[];
  acceptedReplyId: string | null;
  createdAt: string;
  hidden: boolean;
}
export interface Reply {
  id: string;
  discussionId: string;
  authorId: string;
  text: string;
  parentId: string | null;
  createdAt: string;
}
export interface Announcement {
  id: string;
  title: string;
  text: string;
  authority: string;
  category: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  pinned: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readBy: string[];
  createdAt: string;
}
export interface TimetableEntry {
  id: string;
  subject: string;
  code: string;
  faculty: string;
  room: string;
  day: number;
  start: string;
  end: string;
  branch: string;
  semester: number;
  section: string;
  color: string;
}
export interface Notification {
  id: string;
  userId: string;
  text: string;
  link: string;
  read: boolean;
  createdAt: string;
}
export interface CampusEvent {
  id: string;
  title: string;
  text: string;
  location: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  attending: boolean;
  attendeeCount: number;
}
export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
}
export interface Snapshot {
  /** Simulated attendance only; the server never emits this demo storage field. */
  demoEventRsvps?: Record<string, string[]>;
  following?: string[];
  users: User[];
  posts: Post[];
  comments: Comment[];
  discussions: Discussion[];
  replies: Reply[];
  announcements: Announcement[];
  timetable: TimetableEntry[];
  events: CampusEvent[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}
export type Input = Record<string, string | number | boolean | string[] | null>;
export type ActionName =
  | "post.create"
  | "post.edit"
  | "post.delete"
  | "post.like"
  | "post.bookmark"
  | "post.comment"
  | "discussion.create"
  | "discussion.edit"
  | "discussion.delete"
  | "discussion.vote"
  | "discussion.reply"
  | "discussion.accept"
  | "announcement.save"
  | "announcement.delete"
  | "announcement.read"
  | "timetable.save"
  | "timetable.delete"
  | "event.save"
  | "event.delete"
  | "event.rsvp"
  | "profile.edit"
  | "notification.read"
  | "notification.readAll"
  | "admin.moderate"
  | "admin.userStatus";
