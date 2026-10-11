import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { timetableInput } from "../validators/input.js";

export type TimetableInput = z.infer<typeof timetableInput>;
export function timesOverlap(
  first: Pick<TimetableInput, "start" | "end">,
  second: Pick<TimetableInput, "start" | "end">,
): boolean {
  return first.start < second.end && first.end > second.start;
}
export const partialTimetableInput = z
  .object(timetableInput.shape)
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field",
  );
export async function saveTimetable(
  db: PrismaClient,
  actorId: string,
  input: TimetableInput,
  recordId?: string,
) {
  return db.$transaction(
    async (tx) => {
      // One advisory lock makes overlap checking and the following write atomic across all API instances.
      // This admin-only workload is small; global serialization also covers shared rooms and faculty.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(672886144)`;
      const conflict = await tx.timetableEntry.findFirst({
        where: {
          ...(recordId ? { id: { not: recordId } } : {}),
          day: input.day,
          start: { lt: input.end },
          end: { gt: input.start },
          OR: [
            {
              branch: { equals: input.branch, mode: "insensitive" },
              semester: input.semester,
              section: { equals: input.section, mode: "insensitive" },
            },
            { room: { equals: input.room, mode: "insensitive" } },
            { faculty: { equals: input.faculty, mode: "insensitive" } },
          ],
        },
      });
      if (conflict)
        throw new HttpError(
          409,
          "This time overlaps an existing class for the cohort, room, or faculty.",
        );
      const row = recordId
        ? await tx.timetableEntry.update({
            where: { id: recordId },
            data: input,
          })
        : await tx.timetableEntry.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId,
          action: recordId ? "timetable.update" : "timetable.create",
          targetId: row.id,
        },
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
