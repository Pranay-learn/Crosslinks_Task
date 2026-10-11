import { z } from "zod";

const content = (max: number) => z.string().trim().min(1).max(max).refine(
  (value) => [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10 || code === 13;
  }),
  "Unsupported control characters",
);
const timestamp = z.iso.datetime({ offset: true }).max(40);
export const eventFields = z.object({
  title: content(200),
  text: content(5000),
  location: content(160),
  startsAt: timestamp,
  endsAt: timestamp,
}).strict();
export const eventInput = eventFields.refine(
  (value) => new Date(value.endsAt) > new Date(value.startsAt),
  { path: ["endsAt"], message: "The event must end after it starts." },
);
export const partialEventInput = eventFields.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Supply at least one event field.",
);
export const emptyRsvpInput = z.object({}).strict();
export const eventQuery = z.object({
  scope: z.enum(["all", "upcoming", "past"]).default("all"),
});
