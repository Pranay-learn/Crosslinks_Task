# Deploy NSUT Connect on Vercel and Neon

The frontend and Express API deploy together to one HTTPS Vercel domain. Neon supplies PostgreSQL. Start with Vercel Hobby and Neon Free; each plan has usage limits. A hosting account and a hosted database are required. Google OAuth credentials still control real sign-in.

## 1. Create your accounts

Create a [Vercel account](https://vercel.com/signup) with **Continue with GitHub**, and grant access to `Pranay-learn/Crosslinks_Task` when importing it. Create a [Neon Free project](https://console.neon.tech). Choose a nearby region, retain the generated database password securely, and use an authenticated database.

In Neon's **Connect** panel, copy two connection strings: pooling **on** for application requests, and pooling **off** for database migrations. Retain the supplied TLS parameters. These values belong in Vercel's environment settings; never paste them into chat or commit them.

## 2. Import the correct GitHub branch

Open [Vercel New Project](https://vercel.com/new) and import `Pranay-learn/Crosslinks_Task`. The implementation is on branch **`nsut-connect`**; `main` contains the original repository. Select `nsut-connect` as the Production Branch in **Settings → Environments → Production → Branch Tracking** (or the Git settings in the dashboard version you see).

If the initial import builds `main`, change the Production Branch before expecting the app to appear, then create a deployment of `nsut-connect` from **Deployments → Create Deployment**. A Deploy Button may instead copy the prepared branch into a new repository; importing the existing repository preserves its connection and branch history.

Use the repository root as Root Directory. The checked-in `vercel.json` supplies Vite, the install/build commands, `dist` output, API routing, and SPA navigation. Node 24 is selected by `package.json`. Keep these settings; avoid treating this app as plain static HTML.

## 3. Configure Production environment variables

| Variable               | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`         | Neon's **pooled**, TLS-enabled PostgreSQL connection string                    |
| `DIRECT_DATABASE_URL`  | Neon's **direct**, TLS-enabled PostgreSQL connection string                    |
| `VITE_APP_MODE`        | `live`                                                                         |
| `NODE_ENV`             | `production`                                                                   |
| `TRUST_PROXY_HOPS`     | `1` for the Vercel proxy                                                       |
| `GOOGLE_CLIENT_ID`     | An OAuth **web application** client ID ending in `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | The matching OAuth client secret                                               |
| `ADMIN_EMAILS`         | Comma-separated trusted administrator addresses ending in `@nsut.ac.in`        |

Connecting Neon through your Vercel project's Storage/Marketplace supplies `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically. The production build accepts `DATABASE_URL_UNPOOLED` when `DIRECT_DATABASE_URL` is unset; the explicit override takes priority. Those integration-managed secrets can remain in Vercel without being downloaded locally.

Keep `VITE_API_URL` unset so browser requests use the same site's `/api`. The Google secret and database strings must remain server variables without a `VITE_` prefix. No local PostgreSQL address or test database belongs in the deployment. Production builds compile the app and apply the checked-in migrations through the direct connection. They do not seed fictional students or content.

Vercel supplies `VERCEL_PROJECT_PRODUCTION_URL`. The API uses that HTTPS domain as the frontend/API origin and derives `/api/auth/google/callback` automatically. Explicit `CLIENT_ORIGIN`, `API_ORIGIN`, and `GOOGLE_REDIRECT_URI` overrides take priority. When adding a custom domain, set all three to your actual chosen origins and callback. Remove old localhost overrides.

Preview deployments skip schema migration. Give previews a separate database branch if enabling their API; do not copy production credentials into previews. Validate real login on the canonical Production domain, since its callback is the one registered with Google.

## 4. Deploy and configure Google

Deploy `nsut-connect`. Vercel returns your site's actual HTTPS address. In [Google Cloud credentials](https://console.cloud.google.com/apis/credentials), create or edit your OAuth **Web application** client:

- Authorized JavaScript origin: your site's HTTPS origin.
- Authorized redirect URI: that same origin followed by `/api/auth/google/callback`.
- Configure the OAuth consent screen. If Google keeps the app in Testing mode, add the campus accounts that will test it; broader availability needs the appropriate Google publishing status.

Store the matching client ID/secret in Vercel Production environment settings and redeploy after changes. A Google `hd` hint is not authorization: the API verifies Google's token, requires verified email, and enforces the exact `@nsut.ac.in` domain. `ADMIN_EMAILS` grants roles only to the specified campus accounts.

Production Google login redirects alternate deployment addresses to the configured callback domain before creating the sign-in cookie. Use the canonical Production address when sharing the site. Starting login on one domain and returning on another would otherwise lose the host-only cookie and produce an invalid sign-in state error.

## 5. Verify the published application

Visit the actual Production deployment and check:

- `/login` renders, and refreshing `/timetable` preserves SPA routing.
- `/api/health` reports `database: connected`.
- `/api/auth/status` reports `configured: true` after valid OAuth settings are supplied. This checks credential presence/format; successful Google consent remains a separate verification step.
- `/api/auth/me` returns HTTP 401 before sign-in, and APIs cannot be opened through simulated roles.
- A real verified campus account completes Google sign-in; an account with another email domain is rejected.
- A trusted administrator can create a timetable entry with faculty and room details, and students can view the matching timetable.

If sign-in is disabled, correct the OAuth client ID/secret. If health returns 503, check both hosted database connection strings and the migration build logs. A localhost callback cannot serve visitors to a hosted site. Database passwords and OAuth secrets should never appear in diagnostic output.

## Operational limits

Vercel and Neon free plans have quotas, and Neon may suspend idle compute, adding delay to the first request. The current in-memory request limiters apply per function instance; use hosting firewall rules or a shared limiter when a global limit is needed. Session, OAuth state, authorization, community data, and RSVPs persist in PostgreSQL across function restarts.

Google login does not import UMS records. Official UMS synchronization still needs a supported authorized data source. This deployment does not publish fictional demo data as university records.
