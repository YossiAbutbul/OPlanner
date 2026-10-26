# Push reminders (installed app)

Installed OPlanner apps get reminders as Web Push, so they arrive while the app
is closed. Everything runs on free tiers:

- **Client** (`src/utility/push.ts`, `src/sw.ts`): the installed app subscribes
  and stores the device at `users/{uid}/pushSubs/{id}`.
- **Sender** (`api/send-reminders.ts`): a Vercel function on the Hobby plan.
- **Trigger** (`cron/`): a Cloudflare Worker Cron Trigger (free plan) calls the
  sender every 5 minutes. Vercel Hobby cron only runs once a day.
- **Firestore**: stays on the free Spark plan.

Browser tabs keep the in-app desktop popups (`src/hooks/useReminders.ts`).

## One-time setup

1. Generate a VAPID key pair:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Create a Firebase service account key: Firebase console → Project settings →
   Service accounts → Generate new private key. Never commit it.

3. In the Vercel project → Settings → Environment Variables (Production):

   | Name | Value |
   | --- | --- |
   | `VITE_VAPID_PUBLIC_KEY` | VAPID public key |
   | `VAPID_PRIVATE_KEY` | VAPID private key |
   | `VAPID_SUBJECT` | `mailto:<your email>` |
   | `FIREBASE_SERVICE_ACCOUNT` | the service account JSON, pasted as-is |
   | `CRON_SECRET` | a long random string |

   Add `VITE_VAPID_PUBLIC_KEY` to your local `.env` too, then redeploy.

4. Deploy the Firestore indexes the sender's queries need:

   ```bash
   firebase deploy --only firestore:indexes
   ```

   If the CLI offers to delete indexes that exist only in the console, say no.

5. Deploy the cron Worker (free Cloudflare account; `TARGET_URL` in
   `cron/wrangler.jsonc` points at the production domain):

   ```bash
   npx wrangler login
   npx wrangler secret put CRON_SECRET --config cron/wrangler.jsonc
   npx wrangler deploy --config cron/wrangler.jsonc
   ```

   Use the same `CRON_SECRET` as in Vercel. Each run logs the sender's reply,
   `{"devices": N, "sent": M}`, under Workers → oplanner-reminders-cron → Logs;
   a 401 there means the secrets don't match.

## Timing

- Task start: `leadMinutes` before `startTime` on the due day (per device).
- Due tomorrow / exam tomorrow: from 18:00 device-local the evening before.

Each reminder is sent once per device (markers in `pushSent/`, pruned after
30 days).
