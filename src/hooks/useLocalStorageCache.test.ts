import { afterEach, describe, expect, it } from "vitest";
import { lsCache } from "./useLocalStorageCache";

describe("lsCache", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips arbitrary JSON", () => {
    lsCache.write("k", { a: 1, b: ["x", "y"], c: null });
    expect(lsCache.read("k")).toEqual({ a: 1, b: ["x", "y"], c: null });
  });

  it("returns null for missing key", () => {
    expect(lsCache.read("nope")).toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", () => {
    localStorage.setItem("bad", "{not json");
    expect(lsCache.read("bad")).toBeNull();
  });

  it("remove clears the key", () => {
    lsCache.write("k", "v");
    lsCache.remove("k");
    expect(lsCache.read("k")).toBeNull();
  });

  it("write swallows quota errors silently", () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    expect(() => lsCache.write("k", "v")).not.toThrow();
    Storage.prototype.setItem = setItem;
  });
});
