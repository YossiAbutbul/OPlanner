// FIREBASE_SERVICE_ACCOUNT (one-line service account JSON), parsed for
// firebase-admin's cert(). A JSON.parse SyntaxError can quote part of its
// input, which would print private key material into Vercel logs, so the
// original error is dropped and only a fixed message is thrown.
export const serviceAccount = (): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON");
};
