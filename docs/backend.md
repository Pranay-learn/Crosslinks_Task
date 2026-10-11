# Backend configuration and verification

The full-stack API persists community data in PostgreSQL through Prisma ORM. It has no demo login endpoint: only Google's verified OpenID Connect identity can create a browser session. The frontend's separate demo mode never establishes backend authorization.

## Run locally

From the repository root, configure `.env` using `.env.example`, then:

```sh
npm install
npm run db:generate
npm run db:migrate
SEED_DEMO_DATA=true npm run db:seed
npm run dev:server
```

The seed is optional, refuses production, and preserves existing records with non-overwriting upserts. Every sample notice, post, profile, and schedule is labeled fictional or demo. Sample account records have no passwords and cannot log in by choosing a name, email, or role. A real verified campus account can be given administrator access by an operator's server-side `ADMIN_EMAILS` allowlist. Do not grant administrator access from user input.

Required variables:

| Variable               | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection URI, required for startup, migration, and seeding          |
| `GOOGLE_CLIENT_ID`     | Google OAuth web application client ID                                           |
| `GOOGLE_CLIENT_SECRET` | Server-only OAuth client secret                                                  |
| `CLIENT_ORIGIN`        | Exact allowed frontend origin; default `http://localhost:5173`                   |
| `API_ORIGIN`           | API origin; default `http://localhost:3001`                                      |
| `GOOGLE_REDIRECT_URI`  | Registered callback URL; defaults to API origin plus `/api/auth/google/callback` |
| `PORT`                 | API TCP port; default `3001`                                                     |
| `ADMIN_EMAILS`         | Optional comma-separated verified campus emails authorized by the operator       |
| `NODE_ENV`             | Set `production` to enforce HTTPS origins and Secure cookies                     |
| `TRUST_PROXY_HOPS`     | Optional explicit number of trusted proxy hops; default zero                     |
| `SEED_DEMO_DATA`       | Set exactly `true` to allow fictional nonproduction seed data                    |
| `TEST_DATABASE_URL`    | Separate PostgreSQL database for real integration tests                          |

Register `GOOGLE_REDIRECT_URI` in Google Cloud exactly. Missing OAuth configuration returns an actionable HTTP 503; it never falls back to an arbitrary or simulated identity. Configure credentials in environment settings. Never commit them or provide them in chat.

Prisma uses its supported JavaScript query engine with `@prisma/adapter-pg`. Client generation uses `prisma generate --config server/prisma.config.ts`, including Prisma's packaged schema WASM rather than downloading native binaries. Prisma 6.19's experimental JS schema engine can generate SQL, but its migration deployment encounters an unsupported PostgreSQL catalog `name` type. The checked-in PostgreSQL migration runner applies the standard Prisma SQL directories with an advisory lock, one transaction per migration, SHA256 checksums, and compatible `_prisma_migrations` metadata. `npm run db:migrate` is repeatable and rejects changed or unfinished applied migration records. It does not bypass any package, TLS, or checksum verification. Further schema changes need a new reviewed SQL migration; never edit applied migration SQL.

For producing a future migration, Prisma's JS engine supports schema diff without a database connection:

```sh
npx prisma migrate diff --config server/prisma.config.ts --from-schema-datamodel /path/to/previous.prisma --to-schema-datamodel server/prisma/schema.prisma --script
```

Review the result and save it in a new ordered migration directory before applying it. The initial migration also adds database checks for academic ranges and timetable times, and triggers that enforce nested replies and accepted answers belong to their discussion.

## API and browser contract

`GET /api/health` checks the actual database and returns 503 if unavailable. Authenticated collection endpoints support bounded `page`, `limit`, `q`, `category`, and relevant sort/filter query parameters. `GET /api/search` returns grouped results. `GET /api/snapshot` returns one consistent initial snapshot for this client; a larger deployment should adopt the existing paginated REST collections for incremental loading instead of loading the entire campus history at once.

Responses use `{ "data": ... }`; errors use `{ "error": "Safe explanation" }`. Collection metadata appears in `pagination`. Date fields use ISO timestamps. The snapshot and CRUD results match `shared/model.ts`.

After OAuth, `GET /api/auth/me` returns `{ data: { user, csrfToken } }`. Send credentials with API requests and send this token in `x-csrf-token` for every write, including logout. Session cookies are host-only, HttpOnly, SameSite=Lax, and Secure in production. Tokens are random 256-bit values; only their hashes are stored in the database. The session lasts seven days and authentication checks current account status on every request. OAuth uses browser-bound, one-use hashed state, nonce, PKCE, and Google signature/issuer/expiry/audience verification. The exact `@nsut.ac.in` domain and verified-email flag are enforced on the server. Never trust a client-selected role or email.

Mutation bodies include:

- Post/discussion forms: content fields in their shared type, without server-owned IDs, author, role, timestamp, votes, or likes.
- Accepted answer: `PATCH /api/discussions/:id/accepted-answer` with `{ "replyId": "id" }` or null.
- Nested reply: `POST /api/discussions/:id/replies` with `{ "text": "...", "parentId": "id" }`; parent is optional.
- Announcement read/unread: `POST /api/announcements/:id/read` with `{ "read": true }` or false.
- Notification read/unread: `PATCH /api/notifications/:id/read` with `{ "read": true }` or false.
- Moderation: `POST /api/admin/moderation/:id/action` with `{ "type": "post", "action": "hide" }`; type may be `discussion`, action may be `restore` or `delete`.
- Account controls: `PATCH /api/admin/users/:id/status` with `{ "status": "SUSPENDED" }` or `ACTIVE`.

POST and DELETE `/api/users/:id/follow` manage the authenticated viewer’s persisted follow relationships and return `{ data: { following: string[] } }`. The request body is empty; the server derives the follower from the session. POST requires an active target and rejects self-follow. DELETE remains available for a suspended target so a viewer can remove a stale preference. Duplicate requests are idempotent. Snapshot `following` contains only the viewer’s active followed profile IDs, and `GET /api/posts?sort=following` uses these stored relationships rather than academic branch. Relationships cascade when either profile is deleted. The second ordered migration adds this relation without modifying the applied initial migration.

Timetable days are Monday=1 through Saturday=6. Times use 24-hour `HH:MM`. Admin writes reject reversed ranges and overlap for the same cohort, room, or faculty; adjacent classes are valid. A database advisory transaction lock serializes overlap checks across API instances. Timetable and moderation writes create persisted audits. Comments and replies notify content owners, and published announcement changes notify active students.

All community routes require an active verified campus session. Public/campus profile visibility therefore restricts both profiles to the signed-in campus in this API; public means discoverable to campus users, not unauthenticated internet publishing. Other users' email addresses are omitted as empty strings, bookmarks and announcement-read status show only the viewer's IDs, notifications belong only to the viewer, and audits are admin-only. Hidden content and draft/archived notices are admin-only. Profile edits cannot change email, provider ID, role, or status. Suspension revokes the target's existing sessions.

Image and avatar URLs must be HTTPS; file uploads are intentionally unsupported. Content is validated plain text, and the React client escapes rendering. Prisma parameterized queries avoid SQL injection. CORS uses exact configured origins; CSRF tokens and origin checks protect writes. Auth and general/write endpoints are rate-limited. The default limiter stores counts in each process; a horizontally scaled deployment should provide a shared rate-limit store.

## Test evidence

```sh
npm run typecheck
npm run lint
npm test
TEST_DATABASE_URL=postgresql://.../nsut_connect_test npm test -- server
```

Use a dedicated test database with PostgreSQL write permission. Integration tests migrate it and create randomly namespaced trusted fixtures through internal services; no HTTP fake-login route is introduced. They clean up only their own fixtures. If `TEST_DATABASE_URL` is absent, the API integration suite is explicitly skipped, while identity, media, profile escalation, and timetable unit tests still run. The integration suite refuses a test URI identical to `DATABASE_URL`.

Tests exercise real database health, missing configuration, unauthenticated and student admin denial, CSRF, ownership, unique concurrent likes/votes/bookmarks, private data, notifications, nested and accepted answers, announcement lifecycle, timetable concurrency, moderation/audit, search/pagination, trusted administrator provisioning, follow persistence and ownership, suspension, logout, and idempotent migrations. A live Google consent/code exchange needs securely configured OAuth credentials and an actual campus account; automated identity tests do not establish that external deployment integration has been exercised.
