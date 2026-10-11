import { createApp } from "../server/src/app.js";
import { createDatabase } from "../server/src/lib/db.js";

// Reuse the app and connection pool across requests in a warm Vercel function.
// Vercel manages the listener; the local server entry continues to use app.listen.
export default createApp({ db: createDatabase() });
