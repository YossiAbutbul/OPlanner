// Finds and deletes data left behind by users removed from Firebase Auth
// (deleting a user in the console doesn't touch Firestore).
//   GET  /api/cleanup-orphans  → { orphans: [...] }      dry run, changes nothing
//   POST /api/cleanup-orphans  → { deleted: [...], remaining }
//
// Both need `Authorization: Bearer $CRON_SECRET`. POST deletes at most
// MAX_PER_RUN users per call; call again while `remaining` > 0.
import { timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { admin, db, json } from "../server/firebaseAdmin.js";
import { chunk, deleteUserData, uidsWithData } from "../server/userData.js";

const MAX_PER_RUN = 25;

const authorized = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

// uids with data but no Auth user. getUsers takes at most 100 at a time.
const findOrphans = async (): Promise<string[]> => {
  admin();
  const uids = await uidsWithData(db());
  const orphans: string[] = [];
  for (const group of chunk(uids, 100)) {
    const { notFound } = await getAuth().getUsers(group.map((uid) => ({ uid })));
    for (const id of notFound) if ("uid" in id) orphans.push(id.uid);
  }
  return orphans;
};

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json(401, { error: "Unauthorized" });
  return json(200, { orphans: await findOrphans() });
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return json(401, { error: "Unauthorized" });
  const orphans = await findOrphans();
  const batch = orphans.slice(0, MAX_PER_RUN);
  const deleted: string[] = [];
  for (const uid of batch) {
    try {
      await deleteUserData(db(), uid);
      deleted.push(uid);
    } catch (err) {
      console.error("Cleanup: delete failed", uid, err instanceof Error ? err.name : "unknown");
    }
  }
  return json(200, { deleted, remaining: orphans.length - deleted.length });
}
