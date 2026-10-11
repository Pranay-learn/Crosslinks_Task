import { describe, expect, it } from "vitest";
import { hashToken, sameToken, verifyGoogleIdentity } from "./auth.js";
import { timesOverlap } from "./timetable.js";
import {
  profileInput,
  postInput,
  timetableInput,
} from "../validators/input.js";

const identity = {
  sub: "verified-google-subject",
  email: "student@nsut.ac.in",
  email_verified: true,
  name: "Student",
  nonce: "expected-nonce",
};
describe("Verified Google identity rules", () => {
  it("accepts the exact verified campus domain and normalizes its email", () => {
    expect(
      verifyGoogleIdentity(
        { ...identity, email: "Student@NSUT.AC.IN" },
        "expected-nonce",
      ).email,
    ).toBe("student@nsut.ac.in");
  });
  it.each([
    "student@gmail.com",
    "student@nsut.ac.in.attacker.com",
    "student@students.nsut.ac.in",
    "student@evilnsut.ac.in",
    "student@@nsut.ac.in",
  ])("rejects %s", (email) => {
    expect(() =>
      verifyGoogleIdentity({ ...identity, email }, "expected-nonce"),
    ).toThrow(/verified @nsut/);
  });
  it("rejects unverified emails and mismatched nonces", () => {
    expect(() =>
      verifyGoogleIdentity(
        { ...identity, email_verified: false },
        "expected-nonce",
      ),
    ).toThrow();
    expect(() => verifyGoogleIdentity(identity, "different-nonce")).toThrow(
      /verified/,
    );
  });
  it("discards unsafe provider image URLs", () => {
    expect(
      verifyGoogleIdentity(
        { ...identity, picture: "javascript:alert(1)" },
        "expected-nonce",
      ).avatarUrl,
    ).toBe("");
  });
  it("stores a one-way hash and compares tokens safely", () => {
    expect(hashToken("secret")).toHaveLength(64);
    expect(hashToken("secret")).not.toBe("secret");
    expect(sameToken("same", "same")).toBe(true);
    expect(sameToken("same", "longer")).toBe(false);
  });
});
describe("Input and timetable boundaries", () => {
  const entry = {
    subject: "Calculus",
    code: "M101",
    faculty: "Faculty",
    room: "A101",
    day: 1,
    start: "09:00",
    end: "10:00",
    branch: "CSE",
    semester: 1,
    section: "A",
  };
  it("rejects invalid hours and reversed or empty ranges", () => {
    for (const patch of [
      { start: "25:00" },
      { end: "09:00" },
      { end: "08:00" },
      { day: 0 },
      { day: 7 },
    ])
      expect(timetableInput.safeParse({ ...entry, ...patch }).success).toBe(
        false,
      );
  });
  it("allows adjacent classes, and detects a true overlap", () => {
    expect(timesOverlap(entry, { start: "10:00", end: "11:00" })).toBe(false);
    expect(timesOverlap(entry, { start: "09:30", end: "10:30" })).toBe(true);
  });
  it("rejects unsafe media and attempted profile role escalation", () => {
    expect(
      postInput.safeParse({ text: "Hello", imageUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(profileInput.safeParse({ role: "ADMIN" }).success).toBe(false);
    expect(profileInput.safeParse({ email: "admin@nsut.ac.in" }).success).toBe(
      false,
    );
    expect(profileInput.safeParse({ name: "Student" }).success).toBe(true);
  });
});
