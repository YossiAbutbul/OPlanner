// A single Firestore path segment built from user data (course or semester
// name). A "/" would re-root the write deeper in the user's tree, and Firestore
// itself rejects ".", "..", "__x__" and ids over 1500 bytes.
export const isSafeSegment = (s: unknown): s is string =>
  typeof s === "string" &&
  s.length > 0 &&
  !s.includes("/") &&
  s !== "." &&
  s !== ".." &&
  !/^__.*__$/.test(s) &&
  new TextEncoder().encode(s).length <= 1500;

export const seg = (s: string): string => {
  if (!isSafeSegment(s)) throw new Error(`Invalid path segment: "${String(s).slice(0, 50)}"`);
  return s;
};
