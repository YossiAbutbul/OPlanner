// Web Push reminder sender (Vercel function, GET /api/send-reminders).
// A Cloudflare Worker Cron Trigger (cron/) calls it every 5 minutes with
// `Authorization: Bearer $CRON_SECRET`. Each run: load every device push
// subscription (users/{uid}/pushSubs), find each user's tasks and finals due
// today/tomorrow, and push the reminders that are live on that device's wall
// clock and haven't been sent yet.
//
// Env (Vercel project settings, see docs/push-reminders.md):
//   FIREBASE_SERVICE_ACCOUNT  service account JSON (one line)
//   VITE_VAPID_PUBLIC_KEY     same key the client subscribes with
//   VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import { createHash, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import webpush from "web-push";
import {
  buildReminders,
  candidateDates,
  isAllowedEndpoint,
  planMessages,
  wallClock,
  type FinalInput,
  type Reminder,
  type TaskInput,
} from "../server/reminders.js";

const DEFAULT_LEAD_MINUTES = 15;
const SENT_TTL_MS = 30 * 86400000;

const db = () => {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}")) });
  }
  return getFirestore();
};

const authorized = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

// users/{uid}/... → uid
const uidOf = (ref: DocumentReference): string | null => {
  const [root, uid] = ref.path.split("/");
  return root === "users" && uid ? uid : null;
};

const pushToMap = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

// Dedupe marker per device + reminder key, at pushSent/{hash}. Not under
// users/ so clients can't read or forge them (rules deny by default).
const sentRef = (subId: string, key: string) =>
  db().collection("pushSent").doc(createHash("sha256").update(`${subId}|${key}`).digest("hex"));

// Claim the reminders this device hasn't been sent yet. Returns the claimed ones.
const claimFresh = async (subId: string, reminders: Reminder[], now: Date): Promise<Reminder[]> => {
  if (reminders.length === 0) return [];
  const refs = reminders.map((r) => sentRef(subId, r.key));
  const snaps = await db().getAll(...refs);
  const fresh: Reminder[] = [];
  await Promise.all(
    reminders.map(async (r, i) => {
      if (snaps[i].exists) return;
      try {
        await refs[i].create({ expireAt: Timestamp.fromMillis(now.getTime() + SENT_TTL_MS) });
        fresh.push(r);
      } catch {
        /* claimed by an overlapping run */
      }
    })
  );
  return fresh;
};

// Prune expired dedupe markers a page at a time (TTL policies aren't free).
const pruneSent = async (now: Date) => {
  const old = await db()
    .collection("pushSent")
    .where("expireAt", "<", Timestamp.fromDate(now))
    .limit(200)
    .get();
  if (old.empty) return;
  const batch = db().batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const subsSnap = await db().collectionGroup("pushSubs").get();
  if (subsSnap.empty) {
    await pruneSent(now);
    return Response.json({ devices: 0, sent: 0 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "",
    process.env.VITE_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );

  // One query per kind across all users, bounded to dates that are today or
  // tomorrow in some zone. Fine at this app's scale; per-user queries would
  // need a path-prefix index if it grows.
  const dates = candidateDates(now);
  const [tasksSnap, coursesSnap] = await Promise.all([
    db().collectionGroup("tasks").where("status", "==", "PENDING").where("dueDate", "in", dates).get(),
    db().collectionGroup("courses").where("finalDate", "in", dates).get(),
  ]);

  const tasksByUid = new Map<string, TaskInput[]>();
  for (const d of tasksSnap.docs) {
    const uid = uidOf(d.ref);
    const data = d.data();
    if (!uid || typeof data.name !== "string" || typeof data.dueDate !== "string") continue;
    pushToMap(tasksByUid, uid, {
      id: d.id,
      name: data.name,
      dueDate: data.dueDate,
      startTime: typeof data.startTime === "string" ? data.startTime : undefined,
    });
  }

  const finalsByUid = new Map<string, FinalInput[]>();
  for (const d of coursesSnap.docs) {
    const uid = uidOf(d.ref);
    const finalDate = d.get("finalDate");
    if (!uid || typeof finalDate !== "string") continue;
    pushToMap(finalsByUid, uid, { course: d.id, finalDate });
  }

  let sent = 0;
  await Promise.all(
    subsSnap.docs.map(async (sub) => {
      const uid = uidOf(sub.ref);
      const data = sub.data();
      const keys = data.keys as { p256dh?: unknown; auth?: unknown } | undefined;
      if (
        !uid ||
        !isAllowedEndpoint(data.endpoint) ||
        typeof keys?.p256dh !== "string" ||
        typeof keys?.auth !== "string"
      ) {
        console.warn("Skipping malformed push subscription", sub.ref.path);
        return;
      }

      let wall: Date;
      try {
        wall = wallClock(now, typeof data.tz === "string" ? data.tz : "UTC");
      } catch {
        wall = wallClock(now, "UTC");
      }
      const lead =
        typeof data.leadMinutes === "number" && data.leadMinutes >= 0 && data.leadMinutes <= 1440
          ? data.leadMinutes
          : DEFAULT_LEAD_MINUTES;

      const reminders = buildReminders({
        wall,
        tasks: tasksByUid.get(uid) ?? [],
        finals: finalsByUid.get(uid) ?? [],
        leadMinutes: lead,
      });
      const fresh = await claimFresh(sub.id, reminders, now);
      const messages = planMessages(fresh, wall.toISOString().slice(0, 10));

      for (const msg of messages) {
        try {
          await webpush.sendNotification(
            { endpoint: data.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
            JSON.stringify(msg),
            { TTL: 6 * 3600, urgency: "high" }
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // Gone: the device unsubscribed or the app was uninstalled.
          if (status === 404 || status === 410) {
            await sub.ref.delete();
            return;
          }
          console.error("Push send failed", sub.ref.path, status);
        }
      }
    })
  );

  await pruneSent(now);
  return Response.json({ devices: subsSnap.size, sent });
}
