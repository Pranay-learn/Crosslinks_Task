# NSUT Connect

A responsive student community platform for NSUT, built with React, Vite, TypeScript, Tailwind CSS, React Router, Lucide, and Framer Motion. Express, PostgreSQL, and Prisma provide the separate full-stack mode.

The default demo is fully usable without a database or credentials. Sample notices, events, identities, and timetables are fictional and are clearly labeled. This project is independent of official NSUT services.

## Quick start: frontend demo

Requires Node 22.12+ (verified with Node 24), npm, and a modern browser.

```sh
cd /workspace/Crosslinks_Task
npm ci
npm run dev
```

Open the Vite address locally. Use **Student demo** or **Admin demo** on the login screen. The Google button simulates a student login in demo mode; it does not validate a Google identity. Use **Switch demo role** in the sidebar to explore both experiences. Demo content, profiles, interactions, following preferences, event RSVPs, and sessions persist in this browser's local storage. Logout removes the demo session while retaining community data. Clear this site's storage to reset the demo.

The app includes:

- Personalized dashboard, campus feed, and working post creation, editing, deletion, likes, comments, private bookmarks, sharing, search, category filters, and following preferences.
- Discussions with tags, sorting, upvotes, detailed threads, nested replies, and author-controlled accepted answers.
- Announcements with priorities, pins, read status, detail pages, and administrator publication/archive controls.
- Responsive day/week timetables, batch filters, week navigation, campus time indicators, and conflict-checked administrator editing. Click a week-grid class to see its complete day view.
- Own-profile editing, student profiles, grouped global search, notifications, light/dark themes, and mobile navigation.
- Protected administration for notices, classes, moderation, account status, and audit history. Destructive actions require confirmation.

## Full-stack development

Use an existing PostgreSQL 16+ database, or start the optional local development database:

```sh
bash scripts/dev-db.sh
```

This helper creates or resumes `nsut-connect-db`, stores data in ignored `.local/postgres`, and binds its trust-authenticated development port exclusively to `127.0.0.1:5432`. It creates separate application and test databases. Use authenticated PostgreSQL for shared or production systems. The helper preserves existing data and refuses to start a container with a different data mount.

Create `.env` from `.env.example` if you do not already have one. Never overwrite existing credentials. Configure `DATABASE_URL` for your database, then:

```sh
npm run db:generate
npm run db:migrate
# Optional fictional seed; existing records are preserved.
SEED_DEMO_DATA=true npm run db:seed
npm run dev:server
```

In another terminal, start the frontend in live mode:

```sh
VITE_APP_MODE=live npm run dev
```

Vite proxies `/api` to port 3001. `VITE_API_URL` may instead select a separately deployed API. Configure exact CORS origins on the server. If the live service or sign-in configuration is unavailable, the frontend explains the issue and offers the working demo. Demo authentication never establishes a backend session.

For real sign-in, configure a Google OAuth web application with the exact callback `http://localhost:3001/api/auth/google/callback` in local development. Supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` securely through environment settings or an ignored local `.env`. The server verifies Google's identity and email status, requires the exact `@nsut.ac.in` domain, and uses HttpOnly sessions, CSRF protection, and server-side authorization. New accounts are students; an operator's `ADMIN_EMAILS` allowlist can grant administrator access. Never accept a role from the client.

Live Google consent/code exchange has not been exercised in this environment because OAuth credentials and a campus account were not supplied. Automated security tests exercise the identity and authorization boundaries; they do not replace a real provider sign-in check.

Production requires HTTPS `CLIENT_ORIGIN` and `API_ORIGIN`, `NODE_ENV=production`, an authenticated database, real OAuth configuration, and the correct registered callback. Serve the built SPA with history fallback, and run the compiled API separately. Following preferences and community mutations in live mode persist in PostgreSQL. Optional fictional demo-event RSVPs remain browser-local.

See [backend configuration and API documentation](docs/backend.md) for all variables, endpoints, privacy rules, and deployment considerations. Prisma uses its JavaScript query engine. The migration runner applies checked-in Prisma SQL transactionally with checksums and locks because Prisma 6.19's experimental JS migration deployment has a PostgreSQL catalog-type limitation. No TLS or artifact checks were disabled.

## Validation

```sh
npm run typecheck
npm run lint
npm run build
# TEST_DATABASE_URL in .env enables real PostgreSQL API integration tests.
npm test
# Chromium defaults to /usr/bin/chromium; override CHROMIUM_PATH if needed.
npm run test:e2e
# Frontend against actual PostgreSQL/API, using isolated trusted test sessions.
npm run test:live
```

Database tests require the dedicated `nsut_connect_test` database and refuse to use the application's `DATABASE_URL`. Without `TEST_DATABASE_URL`, integration tests are reported as skipped. Browser tests run isolated demo sessions and exercise login/logout, navigation, persistence, post interactions, discussions, profiles, search, announcements, administration, mobile layouts, and themes. Unit and API tests cover ownership, authorization, non-campus identities, CSRF, session state, concurrency, notifications, migration repeatability, and timetable validation.

## Project structure

```text
src/
  components/       Reusable controls, dialogs, forms, and content cards
  context/          Session, demo state, live API mutations, and feedback
  data/             Fictional demo fixtures
  lib/              Domain validation and color mapping
  pages/            Campus, conversations, people, and administration
  services/         Typed API client and REST action mappings
shared/             Frontend/backend data contracts
server/
  prisma/           Normalized schema, SQL migrations, and safe seed
  scripts/          Transactional PostgreSQL migration runner
  src/              Routes, middleware, services, validation, and API tests
tests/e2e/          Browser workflow tests
scripts/            Optional local database startup helper
docs/               Backend documentation
```

Each cloud task is already isolated. Use its existing checkout; do not create a worktree unless explicitly requested. Dependencies and generated files may be retained in the environment snapshot, but development servers and database processes must restart in a new task.
