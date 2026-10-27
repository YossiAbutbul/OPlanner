// Web Push reminder sender (Vercel function, GET /api/send-reminders).
// A Cloudflare Worker Cron Trigger (cron/) calls it every 5 minutes with
// `Authorization: Bearer $CRON_SECRET`. Each run: page through device push
// subscriptions (users/{uid}/pushSubs), find each user's tasks and finals due
// today/tomorrow, and push the reminders that are live on that device's wall
// clock and haven't been sent yet.
//
// Env (Vercel project settings, see docs/push-reminders.md):
//   FIREBASE_SERVICE_ACCOUNT  service account JSON (one line)
//   VITE_VAPID_PUBLIC_KEY     same key the client subscribes with
//   VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import { createHash, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  getFirestore,
  Timestamp,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
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
import { serviceAccount } from "../server/serviceAccount.js";

const DEFAULT_LEAD_MINUTES = 15;
const SENT_TTL_MS = 30 * 86400000;

// pushSubs is user-writable, so the sender bounds its own work: subscriptions
// are read a page at a time, at most MAX_SUBS_PER_USER per user (extras are
// skipped) and MAX_SUBS per run. One user writing thousands of docs can't
// time the run out for everyone.
const SUB_PAGE = 300;
const MAX_SUBS = 3000;
const MAX_SUBS_PER_USER = 10;
// Same idea for due tasks: a hard read ceiling, and per-user list length.
const MAX_TASKS = 5000;
const MAX_TASKS_PER_USER = 200;

const db = () => {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount()) });
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

type DueData = { tasksByUid: Map<string, TaskInput[]>; finalsByUid: Map<string, FinalInput[]> };

// One query per kind across all users, bounded to dates that are today or
// tomorrow in some zone. Fine at this app's scale; per-user queries would
// need a path-prefix index if it grows.
const loadDue = async (now: Date): Promise<DueData> => {
  const dates = candidateDates(now);
  const [tasksSnap, coursesSnap] = await Promise.all([
    db()
      .collectionGroup("tasks")
      .where("status", "==", "PENDING")
      .where("dueDate", "in", dates)
      .limit(MAX_TASKS)
      .get(),
    db().collectionGroup("courses").where("finalDate", "in", dates).limit(MAX_TASKS).get(),
  ]);
  if (tasksSnap.size >= MAX_TASKS) console.warn(`Due tasks capped at ${MAX_TASKS}`);

  const tasksByUid = new Map<string, TaskInput[]>();
  for (const d of tasksSnap.docs) {
    const uid = uidOf(d.ref);
    const data = d.data();
    if (!uid || typeof data.name !== "string" || typeof data.dueDate !== "string") continue;
    if ((tasksByUid.get(uid)?.length ?? 0) >= MAX_TASKS_PER_USER) continue;
    pushToMap(tasksByUid, uid, {
      id: d.id,
      name: data.name.slice(0, 200),
      dueDate: data.dueDate,
      startTime: typeof data.startTime === "string" ? data.startTime : undefined,
    });
  }

  const finalsByUid = new Map<string, FinalInput[]>();
  for (const d of coursesSnap.docs) {
    const uid = uidOf(d.ref);
    const finalDate = d.get("finalDate");
    if (!uid || typeof finalDate !== "string") continue;
    if ((finalsByUid.get(uid)?.length ?? 0) >= MAX_TASKS_PER_USER) continue;
    pushToMap(finalsByUid, uid, { course: d.id, finalDate });
  }
  return { tasksByUid, finalsByUid };
};

// Send this device its live, not-yet-sent reminders. Returns how many went out.
const sendToDevice = async (sub: QueryDocumentSnapshot, uid: string, due: DueData, now: Date) => {
  const data = sub.data();
  const keys = data.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!isAllowedEndpoint(data.endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    console.warn("Skipping malformed push subscription", sub.ref.path);
    return 0;
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
    tasks: due.tasksByUid.get(uid) ?? [],
    finals: due.finalsByUid.get(uid) ?? [],
    leadMinutes: lead,
  });
  const fresh = await claimFresh(sub.id, reminders, now);
  const messages = planMessages(fresh, wall.toISOString().slice(0, 10));

  let sent = 0;
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
        return sent;
      }
      console.error("Push send failed", sub.ref.path, status);
    }
  }
  return sent;
};

// users/{uid}/pushSubs/{id} → uid. The collection group also matches a
// pushSubs collection nested deeper (users/{uid}/years/.../pushSubs), which
// the rules don't validate, so only the top-level one counts.
const subOwner = (ref: DocumentReference): string | null => {
  const parts = ref.path.split("/");
  return parts.length === 4 && parts[2] === "pushSubs" ? uidOf(ref) : null;
};

// Sorts after every document under users/{uid} and before the next user's,
// so a cursor here skips the rest of this user's subtree.
const pastUser = (uid: string) => `users/${uid}//`;

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  let due: DueData | null = null;
  const perUser = new Map<string, number>();
  let cursor: QueryDocumentSnapshot | string | undefined;
  let read = 0;
  let devices = 0;
  let sent = 0;

  // Page through pushSubs across all users in document-id order.
  while (read < MAX_SUBS) {
    let q = db()
      .collectionGroup("pushSubs")
      .orderBy(FieldPath.documentId())
      .limit(Math.min(SUB_PAGE, MAX_SUBS - read));
    if (cursor !== undefined) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    read += snap.size;
    cursor = snap.docs[snap.docs.length - 1];

    if (!due) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? "",
        process.env.VITE_VAPID_PUBLIC_KEY ?? "",
        process.env.VAPID_PRIVATE_KEY ?? ""
      );
      due = await loadDue(now);
    }
    const dueNow = due;
    const batch: Promise<number>[] = [];
    for (const sub of snap.docs) {
      const uid = uidOf(sub.ref);
      if (!uid) continue;
      // Every doc under the user counts, valid or not; past the cap, jump
      // the cursor over the rest of this user's docs.
      const count = (perUser.get(uid) ?? 0) + 1;
      perUser.set(uid, count);
      if (count > MAX_SUBS_PER_USER) {
        console.warn("Push subscriptions capped for user", uid);
        cursor = pastUser(uid);
        break;
      }
      if (subOwner(sub.ref) !== uid) continue;
      devices++;
      batch.push(sendToDevice(sub, uid, dueNow, now));
    }
    sent += (await Promise.all(batch)).reduce((a, b) => a + b, 0);
    if (snap.size < SUB_PAGE && cursor === snap.docs[snap.docs.length - 1]) break;
  }
  if (read >= MAX_SUBS) console.warn(`Stopped after reading ${MAX_SUBS} push subscriptions`);

  await pruneSent(now);
  return Response.json({ devices, sent });
}
