import { palette } from "../lib/colors";
import type { ActionName, Input, Snapshot, User } from "../../shared/model";
const base = import.meta.env.VITE_API_URL || "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  csrfToken?: string,
): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!response.ok)
    throw new ApiError(
      result.error || `Request failed (${response.status}).`,
      response.status,
    );
  return result.data as T;
}
export const getSession = () =>
  request<{ user: User; csrfToken: string }>("/auth/me");
export const getSnapshot = () => request<Snapshot>("/snapshot");
export function googleLogin() {
  window.location.assign(`${base}/api/auth/google`);
}
export async function apiAction(
  name: ActionName,
  input: Input,
  state: Snapshot,
  user: User,
  csrf: string,
) {
  const id = encodeURIComponent(String(input.id ?? ""));
  const body = { ...input };
  delete body.id;
  let path = "",
    method = "POST";
  switch (name) {
    case "post.create":
      path = "/posts";
      break;
    case "post.edit":
      path = `/posts/${id}`;
      method = "PATCH";
      break;
    case "post.delete":
      path = `/posts/${id}`;
      method = "DELETE";
      break;
    case "post.like":
      path = `/posts/${id}/likes`;
      method = state.posts
        .find((p) => p.id === input.id)
        ?.likes.includes(user.id)
        ? "DELETE"
        : "POST";
      break;
    case "post.bookmark":
      path = `/posts/${id}/bookmark`;
      method = state.posts
        .find((p) => p.id === input.id)
        ?.bookmarks.includes(user.id)
        ? "DELETE"
        : "POST";
      break;
    case "post.comment":
      path = `/posts/${id}/comments`;
      break;
    case "discussion.create":
      path = "/discussions";
      body.tags = String(body.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      break;
    case "discussion.edit":
      path = `/discussions/${id}`;
      method = "PATCH";
      body.tags = String(body.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      break;
    case "discussion.delete":
      path = `/discussions/${id}`;
      method = "DELETE";
      break;
    case "discussion.vote":
      path = `/discussions/${id}/votes`;
      method = state.discussions
        .find((d) => d.id === input.id)
        ?.votes.includes(user.id)
        ? "DELETE"
        : "POST";
      break;
    case "discussion.reply":
      path = `/discussions/${id}/replies`;
      break;
    case "discussion.accept":
      path = `/discussions/${id}/accepted-answer`;
      method = "PATCH";
      if (
        state.discussions.find((d) => d.id === input.id)?.acceptedReplyId ===
        input.replyId
      )
        body.replyId = null;
      break;
    case "announcement.save":
      path = `/announcements${id ? "/" + id : ""}`;
      method = id ? "PATCH" : "POST";
      break;
    case "announcement.delete":
      path = `/announcements/${id}`;
      method = "DELETE";
      break;
    case "announcement.read":
      path = `/announcements/${id}/read`;
      body.read = !state.announcements
        .find((a) => a.id === input.id)
        ?.readBy.includes(user.id);
      break;
    case "timetable.save":
      path = `/timetable${id ? "/" + id : ""}`;
      method = id ? "PATCH" : "POST";
      body.color = palette[String(body.color)] || body.color;
      break;
    case "timetable.delete":
      path = `/timetable/${id}`;
      method = "DELETE";
      break;
    case "profile.edit":
      path = "/users/me";
      method = "PATCH";
      break;
    case "notification.read":
      path = `/notifications/${id}/read`;
      method = "PATCH";
      body.read = true;
      break;
    case "notification.readAll":
      path = "/notifications/read-all";
      break;
    case "admin.moderate":
      path = `/admin/moderation/${id}/action`;
      body.type = input.kind;
      body.action = (input.kind === "post"
        ? state.posts
        : state.discussions
      ).find((p) => p.id === input.id)?.hidden
        ? "restore"
        : "hide";
      delete body.kind;
      break;
    case "admin.userStatus":
      path = `/admin/users/${id}/status`;
      method = "PATCH";
      body.status =
        state.users.find((u) => u.id === input.id)?.status === "ACTIVE"
          ? "SUSPENDED"
          : "ACTIVE";
      break;
  }
  await request(path, method, method === "DELETE" ? undefined : body, csrf);
  return getSnapshot();
}
