import { describe, expect, it } from "vitest";
import { joinResults } from "./useDictation";

const results = (...t: string[]) => t.map((transcript) => ({ 0: { transcript }, length: 1 }));

describe("joinResults", () => {
  it("doesn't repeat a phrase a phone reports again as it grows", () => {
    expect(joinResults(results("תוסיף", "תוסיף משימה", "תוסיף משימה למחר"))).toBe("תוסיף משימה למחר");
    expect(joinResults(results("תוסיף משימה למחר", "תוסיף משימה למחר"))).toBe("תוסיף משימה למחר");
  });

  it("joins separate phrases", () => {
    expect(joinResults(results("plan my week", "and the exam"))).toBe("plan my week and the exam");
  });
});
