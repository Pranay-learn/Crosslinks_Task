import { describe, expect, it } from "vitest";
import { eventInstant, eventLocalTime } from "./events";
describe("campus event time conversion", () => {
  it("uses IST even for midnight dates and round-trips existing UTC records", () => {
    expect(eventInstant("2027-01-01T00:15")).toBe("2026-12-31T18:45:00.000Z");
    expect(eventLocalTime("2026-12-31T18:45:00.000Z")).toBe("2027-01-01T00:15");
    expect(eventInstant("2027-01-01T09:30:00.000Z")).toBe(
      "2027-01-01T09:30:00.000Z",
    );
  });
  it("rejects invalid dates, missing times, and implicit browser timezone values", () => {
    for (const value of [
      "2027-02-30T09:00",
      "2027-01-01",
      "2027-01-01T09:00:00",
      "",
    ]) {
      expect(() => eventInstant(value)).toThrow("valid event");
    }
  });
});
