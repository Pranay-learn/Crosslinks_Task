import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 || code === 9 || code === 10 || code === 13;
        }),
      "Unsupported control characters",
    );
export const httpsImage = z.union([
  z.literal(""),
  z
    .url()
    .max(2048)
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Images must use a secure HTTPS URL",
    ),
]);
export const categories = [
  "General",
  "Academics",
  "Placements",
  "Events",
  "Clubs",
  "Lost & Found",
] as const;
export const postInput = z
  .object({
    text: text(5000),
    imageUrl: httpsImage.default(""),
    category: z.enum(categories).default("General"),
  })
  .strict();
export const discussionInput = z
  .object({
    title: text(200),
    text: text(10000),
    category: z.enum(categories).default("General"),
    tags: z.array(text(30)).max(8).default([]),
  })
  .strict();
export const commentInput = z.object({ text: text(3000) }).strict();
export const replyInput = z
  .object({
    text: text(5000),
    parentId: z.string().min(1).max(100).nullable().optional(),
  })
  .strict();
export const acceptedInput = z
  .object({ replyId: z.string().min(1).max(100).nullable() })
  .strict();
export const readInput = z.object({ read: z.boolean().default(true) }).strict();
export const profileInput = z
  .object({
    name: text(100).optional(),
    bio: z.string().trim().max(600).optional(),
    avatarUrl: httpsImage.optional(),
    branch: z.string().trim().max(80).optional(),
    year: z.number().int().min(1).max(6).optional(),
    semester: z.number().int().min(1).max(12).optional(),
    section: z.string().trim().max(20).optional(),
    visibility: z.enum(["PUBLIC", "CAMPUS"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one profile field",
  );
export const announcementInput = z
  .object({
    title: text(200),
    text: text(15000),
    authority: text(100),
    category: z
      .enum([
        "Academic",
        "Examination",
        "Placement",
        "Events",
        "Administration",
        "General",
      ])
      .default("General"),
    priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
    pinned: z.boolean().default(false),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  })
  .strict();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time");
export const timetableInput = z
  .object({
    subject: text(100),
    code: text(30),
    faculty: text(100),
    room: text(40),
    day: z.number().int().min(1).max(6),
    start: time,
    end: time,
    branch: text(80),
    semester: z.number().int().min(1).max(12),
    section: text(20),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color")
      .default("#2563eb"),
  })
  .strict()
  .refine((value) => value.end > value.start, {
    path: ["end"],
    message: "End time must be after start time",
  });
export const moderationInput = z
  .object({
    type: z.enum(["post", "discussion"]),
    action: z.enum(["hide", "restore", "delete"]),
  })
  .strict();
export const statusInput = z
  .object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })
  .strict();
export const partialPostInput = postInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field",
  );
export const partialDiscussionInput = discussionInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field",
  );
export const partialAnnouncementInput = announcementInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field",
  );
export const pageInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(200).default(""),
    category: z.string().trim().max(80).optional(),
    sort: z
      .enum([
        "latest",
        "popular",
        "following",
        "votes",
        "discussed",
        "priority",
      ])
      .default("latest"),
    authorId: z.string().max(100).optional(),
    tag: z.string().max(30).optional(),
    status: z
      .enum(["ACTIVE", "SUSPENDED", "DRAFT", "PUBLISHED", "ARCHIVED"])
      .optional(),
  })
  .passthrough();
export function page(query: unknown) {
  const data = pageInput.parse(query);
  return { ...data, skip: (data.page - 1) * data.limit, take: data.limit };
}
