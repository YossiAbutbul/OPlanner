// Firebase Admin setup and sign-in checks shared by the agent and waitlist
// functions (api/agent.ts, api/waitlist.ts).
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isAllowed, parseAllowlist } from "./agent.js";
import { serviceAccount } from "./serviceAccount.js";

export const admin = () => {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount()) });
  }
};

export const db = () => {
  admin();
  return getFirestore();
};

export const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// Verified token and whether its account may use the agent, or the error
// response to send.
export const authenticate = async (
  request: Request
): Promise<{ user: DecodedIdToken; allowed: boolean } | Response> => {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json(401, { error: "Sign in to use the assistant." });
  admin();
  try {
    // checkRevoked: a signed-out or disabled account stops working at once.
    const user = await getAuth().verifyIdToken(token, true);
    const allowed = isAllowed(user.email, user.email_verified, parseAllowlist(process.env.AGENT_ALLOWED_EMAILS));
    return { user, allowed };
  } catch {
    return json(401, { error: "Your session expired. Sign in again." });
  }
};
