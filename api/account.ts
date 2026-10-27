// Account deletion (Vercel function).
//   DELETE /api/account  → { deleted: true }
//
// Deletes the caller's data, then their Firebase Auth user. Needs a sign-in
// from the last few minutes (the client re-authenticates first); an older
// token gets 401 { reauth: true }.
import { getAuth } from "firebase-admin/auth";
import { authenticate, db, json } from "../server/firebaseAdmin.js";
import { deleteUserData, signedInRecently } from "../server/userData.js";

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  if (!signedInRecently(auth.user.auth_time, Date.now())) {
    return json(401, { error: "Sign in again to delete your account.", reauth: true });
  }

  const uid = auth.user.uid;
  try {
    // Data first: if this fails the account still exists and can retry.
    await deleteUserData(db(), uid);
    await getAuth().deleteUser(uid);
  } catch (err) {
    console.error("Account: delete failed", err instanceof Error ? err.name : "unknown");
    return json(500, { error: "Couldn't delete your account. Try again." });
  }
  return json(200, { deleted: true });
}
