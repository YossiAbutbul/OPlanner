import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentText, { parseBlocks } from "./AgentText";

describe("AgentText", () => {
  it("renders the reply from production as lists and bold", () => {
    const reply = [
      'You have two pending tasks due this week, both for the course "תכנות מערכות דפנסיבי":',
      "",
      "1. **לסיים את הפרוייקט** (finish the project): today, Tuesday 27 Oct.",
      "2. **מטלה 06 - פרוייקט** (assignment 06): Thursday 29 Oct.",
      "",
      "The first one is the most urgent.",
    ].join("\n");
    const { container } = render(<AgentText text={reply} />);

    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect([...container.querySelectorAll("strong")].map((s) => s.textContent)).toEqual([
      "לסיים את הפרוייקט",
      "מטלה 06 - פרוייקט",
    ]);
    expect(container.textContent).not.toContain("**");
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("picks direction by majority, so English lines with Hebrew names stay left-to-right", () => {
    const { container } = render(
      <AgentText text={"1. **לסיים את הפרוייקט** (finish the project): today, Tuesday 27 Oct.\n\nמה יש לי מחר? יש לך שתי משימות."} />
    );
    expect(container.querySelector("ol")?.getAttribute("dir")).toBe("ltr");
    expect(container.querySelector("p")?.getAttribute("dir")).toBe("rtl");
  });

  it("handles bullets, headings, italic and code", () => {
    const { container } = render(<AgentText text={"## Plan\n- *Mon*: read `ch. 3`\n- Tue: exercises"} />);
    expect(container.querySelector(".rs-agent-md-h")?.textContent).toBe("Plan");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("em")?.textContent).toBe("Mon");
    expect(container.querySelector("code")?.textContent).toBe("ch. 3");
  });

  it("keeps lone stars and arithmetic as text", () => {
    const { container } = render(<AgentText text={"2 * 3 * 4 = 24"} />);
    expect(container.textContent).toBe("2 * 3 * 4 = 24");
    expect(container.querySelector("em")).toBeNull();
  });

  it("never renders HTML, links or images", () => {
    const { container } = render(
      <AgentText text={'<img src=x onerror="alert(1)"> [click](https://evil.example/?d=secret) ![x](https://evil.example/p.png)'} />
    );
    expect(container.querySelector("img, a, script")).toBeNull();
    expect(container.textContent).toContain("https://evil.example/?d=secret");
  });

  it("joins wrapped lines inside a paragraph", () => {
    expect(parseBlocks("one\ntwo\n\nthree")).toEqual([
      { kind: "p", lines: ["one", "two"] },
      { kind: "p", lines: ["three"] },
    ]);
  });
});
