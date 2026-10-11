export interface ServerConfig {
  port: number;
  clientOrigin: string;
  apiOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  adminEmails: string[];
  production: boolean;
}

export function loadConfig(): ServerConfig {
  const production = process.env.NODE_ENV === "production";
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const apiOrigin = process.env.API_ORIGIN || "http://localhost:3001";
  for (const value of [clientOrigin, apiOrigin]) {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      !["http:", "https:"].includes(parsed.protocol)
    )
      throw new Error(
        "Origins must be absolute HTTP(S) origins without a path.",
      );
    if (production && parsed.protocol !== "https:")
      throw new Error(
        "Production CLIENT_ORIGIN and API_ORIGIN must use HTTPS.",
      );
  }
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid TCP port.");
  return {
    port,
    clientOrigin,
    apiOrigin,
    production,
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleRedirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${apiOrigin}/api/auth/google/callback`,
    adminEmails: (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^@\s]+@nsut\.ac\.in$/.test(email)),
  };
}
