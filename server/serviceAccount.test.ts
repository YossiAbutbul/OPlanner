import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceAccount } from "./serviceAccount";

describe("serviceAccount", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("parses valid JSON", () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", '{"project_id":"p"}');
    expect(serviceAccount()).toEqual({ project_id: "p" });
  });

  it("never echoes a malformed value in the error", () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", '{"private_key":"-----BEGIN SECRET');
    expect(() => serviceAccount()).toThrow(/^FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON$/);
    try {
      serviceAccount();
    } catch (err) {
      expect(String(err)).not.toContain("SECRET");
      expect((err as Error).cause).toBeUndefined();
    }
  });

  it("rejects unset and non-object values", () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
    expect(() => serviceAccount()).toThrow();
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "42");
    expect(() => serviceAccount()).toThrow();
  });
});
