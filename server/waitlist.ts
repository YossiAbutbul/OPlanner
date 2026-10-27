// Pure rules for the assistant waitlist (api/waitlist.ts).

// Emails to the owner per UTC day. Requests past this are still saved, just
// not emailed, so a run of throwaway accounts can't flood the inbox.
export const WAITLIST_EMAILS_PER_DAY = 20;

// Display names come from the user's account; keep them to one short line.
export const cleanName = (name: unknown): string =>
  typeof name === "string"
    ? [...name].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("").trim().slice(0, 100)
    : "";

export const takeEmailSlot = (
  prev: { day?: unknown; count?: unknown } | undefined,
  now: number
): { notify: boolean; next: { day: string; count: number } } => {
  const day = new Date(now).toISOString().slice(0, 10);
  const count = prev?.day === day && typeof prev.count === "number" ? prev.count : 0;
  return count < WAITLIST_EMAILS_PER_DAY
    ? { notify: true, next: { day, count: count + 1 } }
    : { notify: false, next: { day, count } };
};

export const waitlistEmail = (r: { email: string; name: string; verified: boolean }) => ({
  subject: `OPlanner assistant waitlist: ${r.email}`,
  text: [
    `${r.name || "Someone"} asked to join the assistant waitlist.`,
    "",
    `Email: ${r.email}${r.verified ? "" : " (not verified)"}`,
    "",
    "To let them in, add the email to AGENT_ALLOWED_EMAILS in Vercel and redeploy.",
  ].join("\n"),
});
