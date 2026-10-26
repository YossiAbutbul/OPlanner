import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../api/send-reminders";

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
