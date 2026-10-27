import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../api/send-reminders";

// In-memory stand-in for the slice of firebase-admin the sender uses:
// collection-group queries ordered by document path, with limit/startAfter.
type FakeDoc = { path: string; data: Record<string, unknown> };
const store = vi.hoisted(() => ({ docs: [] as FakeDoc[], reads: 0 }));

vi.mock("firebase-admin/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
  cert: () => ({}),
}));

vi.mock("firebase-admin/firestore", () => {
  const cmp = (a: string, b: string) => {
    const x = a.split("/");
    const y = b.split("/");
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return x.length - y.length;
  };
  const snapOf = (d: FakeDoc) => ({
    id: d.path.split("/").pop(),
    ref: { path: d.path, delete: async () => {} },
    data: () => d.data,
    get: (k: string) => d.data[k],
  });
  const query = (group: string, after?: string, max = Infinity) => ({
    where: () => query(group, after, max),
    orderBy: () => query(group, after, max),
    limit: (n: number) => query(group, after, n),
    startAfter: (c: string | { ref: { path: string } }) =>
      query(group, typeof c === "string" ? c : c.ref.path, max),
    get: async () => {
      const docs = store.docs
        .filter((d) => d.path.split("/").slice(-2)[0] === group)
        .filter((d) => after === undefined || cmp(d.path, after) > 0)
        .sort((a, b) => cmp(a.path, b.path))
        .slice(0, max)
        .map(snapOf);
      store.reads += docs.length;
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  });
  return {
    FieldPath: { documentId: () => "__name__" },
    Timestamp: { fromDate: () => ({}), fromMillis: () => ({}) },
    getFirestore: () => ({
      collectionGroup: (g: string) => query(g),
      collection: (g: string) => query(g),
    }),
  };
});

vi.mock("web-push", () => ({ default: { setVapidDetails: () => {}, sendNotification: async () => {} } }));

const call = (auth?: string) =>
  GET(new Request("https://x/api/send-reminders", { headers: auth ? { authorization: auth } : {} }));

describe("send-reminders auth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects every call when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("rejects a missing or wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
  });
});

describe("send-reminders subscription paging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    store.docs = [];
    store.reads = 0;
  });

  const sub = (uid: string, i: number, mid = ""): FakeDoc => ({
    path: `users/${uid}/${mid}pushSubs/${i.toString(16).padStart(64, "0")}`,
    data: { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "p", auth: "a" }, tz: "UTC" },
  });

  it("caps one user's subscriptions without starving users after them", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    store.docs = [
      ...Array.from({ length: 5000 }, (_, i) => sub("aaa", i)),
      sub("bbb", 1),
      sub("ccc", 1),
    ];
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ devices: 12, sent: 0 });
    // One page of the flooding user, not all 5000 of their docs.
    expect(store.reads).toBeLessThan(400);
  });

  it("ignores pushSubs nested below the top level", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    store.docs = [sub("aaa", 1, "years/2025/"), sub("bbb", 1)];
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ devices: 1, sent: 0 });
  });
});
