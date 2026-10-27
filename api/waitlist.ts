// Assistant waitlist (Vercel function).
//   POST /api/waitlist  → { waitlisted: true }
//
// Saves one request per account at agentWaitlist/{uid} (server-only; no
// Firestore rule matches it) and emails the owner, at most
// WAITLIST_EMAILS_PER_DAY a day.
//
// Env (Vercel project settings), both optional; without them requests are
// only saved:
//   RESEND_API_KEY         Resend API key
//   WAITLIST_NOTIFY_EMAIL  where to send them (the Resend account's email)
import { FieldValue } from "firebase-admin/firestore";
import { authenticate, db, json } from "../server/firebaseAdmin.js";
import { cleanName, takeEmailSlot, waitlistEmail } from "../server/waitlist.js";

const sendEmail = async (message: { subject: string; text: string }) => {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.WAITLIST_NOTIFY_EMAIL;
  if (!key || !to) {
    console.warn("Waitlist: email skipped, RESEND_API_KEY or WAITLIST_NOTIFY_EMAIL is not set");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // resend.dev is Resend's shared sender; it can mail the account's own address.
    body: JSON.stringify({ from: "OPlanner <onboarding@resend.dev>", to: [to], ...message }),
  });
  if (res.ok) {
    console.info("Waitlist: owner emailed");
    return;
  }
  // Resend's error says why (e.g. the test sender only mails the account's
  // own address). It holds no secrets; keep it short.
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  console.error("Waitlist: email failed", res.status, detail);
};

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  if (auth.allowed) return json(409, { error: "You already have access." });
  const email = auth.user.email;
  if (!email) return json(400, { error: "Your account has no email address." });

  const entry = { email, name: cleanName(auth.user.name), verified: auth.user.email_verified === true };
  const ref = db().collection("agentWaitlist").doc(auth.user.uid);
  const metaRef = db().collection("agentWaitlistMeta").doc("daily");

  let notify: boolean;
  try {
    notify = await db().runTransaction(async (tx) => {
      const [snap, meta] = await Promise.all([tx.get(ref), tx.get(metaRef)]);
      // Asking again changes nothing and sends nothing.
      if (snap.exists) {
        console.info("Waitlist: already on the list, no email");
        return false;
      }
      const slot = takeEmailSlot(meta.data(), Date.now());
      tx.set(ref, { ...entry, requestedAt: FieldValue.serverTimestamp() });
      if (slot.notify) tx.set(metaRef, slot.next);
      else console.warn("Waitlist: daily email cap reached, saved without email");
      return slot.notify;
    });
  } catch (err) {
    console.error("Waitlist: save failed", err instanceof Error ? err.name : "unknown");
    return json(503, { error: "Couldn't join the waitlist. Try again in a moment." });
  }

  if (notify) await sendEmail(waitlistEmail(entry)).catch(() => console.error("Waitlist: email failed"));
  return json(200, { waitlisted: true });
}
