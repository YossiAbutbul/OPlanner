// Cloudflare Worker whose only job is a Cron Trigger: every 5 minutes it calls
// the Vercel reminder sender (api/send-reminders.ts). Vercel Hobby cron runs
// once a day, too coarse for "starts in N min" reminders.
interface Env {
  TARGET_URL: string;
  CRON_SECRET: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const ping = async (env: Env): Promise<void> => {
  const res = await fetch(env.TARGET_URL, {
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  // Non-2xx fails the invocation so it shows as an error in the Cron Events log.
  if (!res.ok) throw new Error(`send-reminders ${res.status}: ${body.slice(0, 200)}`);
  console.log(body);
};

export default {
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ping(env));
  },
};
