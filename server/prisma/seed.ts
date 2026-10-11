import "dotenv/config";
import { createDatabase } from "../src/lib/db.js";

if (process.env.SEED_DEMO_DATA !== "true") {
  console.info(
    "Seed skipped. Set SEED_DEMO_DATA=true to install clearly labeled fictional development data.",
  );
  process.exit(0);
}
if (process.env.NODE_ENV === "production")
  throw new Error("Fictional demo data cannot be seeded in production.");
const db = createDatabase();
try {
  await db.$transaction(async (tx) => {
    const people = [
      {
        id: "seed-ava",
        name: "Ava Sharma · Demo",
        email: "fictional.ava@nsut.ac.in",
        branch: "CSE",
        year: 3,
        semester: 5,
        section: "A",
        bio: "Fictional demo profile. Learning systems design and building useful campus projects.",
        avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=Ava",
        role: "STUDENT" as const,
      },
      {
        id: "seed-rohan",
        name: "Rohan Mehta · Demo",
        email: "fictional.rohan@nsut.ac.in",
        branch: "ECE",
        year: 2,
        semester: 3,
        section: "B",
        bio: "Fictional demo profile. Robotics, photography, and coffee with friends.",
        avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=Rohan",
        role: "STUDENT" as const,
      },
      {
        id: "seed-neha",
        name: "Neha Kapoor · Demo",
        email: "fictional.neha@nsut.ac.in",
        branch: "CSE",
        year: 3,
        semester: 5,
        section: "A",
        bio: "Fictional demo profile. Web development and finding new reading spots.",
        avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=Neha",
        role: "STUDENT" as const,
      },
      {
        id: "seed-admin",
        name: "Campus Moderator · Demo",
        email: "fictional.admin@nsut.ac.in",
        branch: "CSE",
        year: 4,
        semester: 7,
        section: "A",
        bio: "Fictional seeded admin record for development. This is not an official NSUT account.",
        avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=Moderator",
        role: "ADMIN" as const,
      },
    ];
    for (const person of people)
      await tx.user.upsert({
        where: { id: person.id },
        create: person,
        update: {},
      });
    const posts = [
      {
        id: "seed-post-1",
        authorId: "seed-ava",
        text: "[DEMO] Anyone interested in a weekend DSA study circle? Bring a problem you found interesting; we will work through approaches together.",
        category: "Academics",
        imageUrl: "",
      },
      {
        id: "seed-post-2",
        authorId: "seed-rohan",
        text: "[DEMO] The fictional photography club is planning a campus photo walk this Saturday. Share your favorite quiet corner below!",
        category: "Clubs",
        imageUrl:
          "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "seed-post-3",
        authorId: "seed-neha",
        text: "[DEMO] A little internship prep tip: write down what you learned after each mock interview. Progress becomes much easier to see.",
        category: "Placements",
        imageUrl: "",
      },
    ];
    for (const post of posts)
      await tx.post.upsert({
        where: { id: post.id },
        create: post,
        update: {},
      });
    await tx.comment.upsert({
      where: { id: "seed-comment-1" },
      create: {
        id: "seed-comment-1",
        postId: "seed-post-1",
        authorId: "seed-neha",
        text: "[DEMO] Count me in! I can bring a few graph traversal problems.",
      },
      update: {},
    });
    await tx.postLike.upsert({
      where: { postId_userId: { postId: "seed-post-1", userId: "seed-neha" } },
      create: { postId: "seed-post-1", userId: "seed-neha" },
      update: {},
    });
    await tx.discussion.upsert({
      where: { id: "seed-discussion-1" },
      create: {
        id: "seed-discussion-1",
        authorId: "seed-ava",
        title: "[DEMO] How do you plan a practical DSA revision schedule?",
        text: "Fictional sample discussion: I have three weeks to review fundamentals alongside coursework. What worked for you?",
        category: "Academics",
        tags: ["DSA", "Exams"],
      },
      update: {},
    });
    await tx.discussionReply.upsert({
      where: { id: "seed-reply-1" },
      create: {
        id: "seed-reply-1",
        discussionId: "seed-discussion-1",
        authorId: "seed-neha",
        text: "[DEMO] Start with one topic a day and reserve a weekly mixed practice session. Revisit the problems you could not solve independently.",
      },
      update: {},
    });
    await tx.discussionVote.upsert({
      where: {
        discussionId_userId: {
          discussionId: "seed-discussion-1",
          userId: "seed-rohan",
        },
      },
      create: { discussionId: "seed-discussion-1", userId: "seed-rohan" },
      update: {},
    });
    await tx.announcement.upsert({
      where: { id: "seed-announcement-1" },
      create: {
        id: "seed-announcement-1",
        title: "[DEMO] Sample student project showcase",
        text: "This is a fictional development notice, not an official NSUT announcement. A sample project showcase is scheduled for Friday; students can share a small project and the story behind it.",
        authority: "Demo Campus Office · Fictional",
        category: "Events",
        priority: "IMPORTANT",
        pinned: true,
        status: "PUBLISHED",
      },
      update: {},
    });
    // The schedule is explicitly fictional, with unique rooms/faculty to avoid accidental conflicts.
    const classes = [
      {
        id: "seed-class-1",
        subject: "[DEMO] Data Structures",
        code: "DEMO-CS301",
        faculty: "Fictional Faculty A",
        room: "DEMO-201",
        day: 1,
        start: "09:00",
        end: "10:00",
        branch: "CSE",
        semester: 5,
        section: "A",
        color: "#2563eb",
      },
      {
        id: "seed-class-2",
        subject: "[DEMO] Operating Systems",
        code: "DEMO-CS302",
        faculty: "Fictional Faculty B",
        room: "DEMO-202",
        day: 1,
        start: "10:15",
        end: "11:15",
        branch: "CSE",
        semester: 5,
        section: "A",
        color: "#8b5cf6",
      },
      {
        id: "seed-class-3",
        subject: "[DEMO] Computer Networks",
        code: "DEMO-CS303",
        faculty: "Fictional Faculty C",
        room: "DEMO-203",
        day: 3,
        start: "11:00",
        end: "12:00",
        branch: "CSE",
        semester: 5,
        section: "A",
        color: "#14b8a6",
      },
    ];
    for (const entry of classes)
      await tx.timetableEntry.upsert({
        where: { id: entry.id },
        create: entry,
        update: {},
      });
  });
  console.info(
    "Fictional demo records seeded. These are not official NSUT notices, profiles, or schedules. Existing records were preserved.",
  );
} finally {
  await db.$disconnect();
}
