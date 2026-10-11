import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./env.js";

afterEach(() => vi.unstubAllEnvs());

function clearOrigins() {
  for (const name of [
    "CLIENT_ORIGIN",
    "API_ORIGIN",
    "GOOGLE_REDIRECT_URI",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ]) {
    vi.stubEnv(name, "");
  }
}

describe("Deployment origins and Google callbacks", () => {
  it("keeps local development defaults", () => {
    clearOrigins();
    vi.stubEnv("NODE_ENV", "development");
    expect(loadConfig()).toMatchObject({
      clientOrigin: "http://localhost:5173",
      apiOrigin: "http://localhost:3001",
      googleRedirectUri: "http://localhost:3001/api/auth/google/callback",
      production: false,
    });
  });
  it("uses the canonical Vercel production domain for same-origin cookies and callbacks", () => {
    clearOrigins();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "campus-example.vercel.app");
    vi.stubEnv("VERCEL_URL", "campus-example-preview.vercel.app");
    expect(loadConfig()).toMatchObject({
      clientOrigin: "https://campus-example.vercel.app",
      apiOrigin: "https://campus-example.vercel.app",
      googleRedirectUri:
        "https://campus-example.vercel.app/api/auth/google/callback",
      production: true,
    });
  });
  it("supports a deployment URL when no canonical project domain is provided", () => {
    clearOrigins();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "campus-example.vercel.app");
    expect(loadConfig().apiOrigin).toBe("https://campus-example.vercel.app");
  });
  it("respects operator-configured custom origins and callback", () => {
    clearOrigins();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "campus-example.vercel.app");
    vi.stubEnv("CLIENT_ORIGIN", "https://campus.example");
    vi.stubEnv("API_ORIGIN", "https://api.campus.example");
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "https://api.campus.example/api/auth/google/callback",
    );
    expect(loadConfig()).toMatchObject({
      clientOrigin: "https://campus.example",
      apiOrigin: "https://api.campus.example",
      googleRedirectUri: "https://api.campus.example/api/auth/google/callback",
    });
  });
  it("rejects insecure production origins and domains containing a path", () => {
    clearOrigins();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => loadConfig()).toThrow("must use HTTPS");
    vi.stubEnv(
      "VERCEL_PROJECT_PRODUCTION_URL",
      "campus-example.vercel.app/untrusted",
    );
    expect(() => loadConfig()).toThrow("without a path");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "campus-example.vercel.app");
    vi.stubEnv("CLIENT_ORIGIN", "http://campus.example");
    expect(() => loadConfig()).toThrow("must use HTTPS");
  });
});
