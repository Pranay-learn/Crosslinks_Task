import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        error: error.issues
          .map(
            (issue) => `${issue.path.join(".") || "Request"}: ${issue.message}`,
          )
          .join("; "),
      });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "This record already exists." });
      return;
    }
    if (error.code === "P2003") {
      res
        .status(409)
        .json({
          error:
            "A referenced record changed or was removed. Refresh and try again.",
        });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    if (error.code === "P2034") {
      res
        .status(409)
        .json({ error: "A concurrent update occurred. Please try again." });
      return;
    }
  }
  if (error instanceof Error && "status" in error && error.status === 413) {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  // Log a category only. Database errors can contain connection details and OAuth errors may contain credentials.
  console.error(
    "API request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  res
    .status(500)
    .json({
      error: "The server could not complete this request. Please try again.",
    });
};
