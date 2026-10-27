import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAgentMessage } from "./agent";

vi.mock("../firebase", () => ({ auth: { currentUser: { getIdToken: async () => "token" } } }));

const input = { history: [], message: "hi", year: 2026, semester: "A" };

// Streams `lines` split at awkward points, like a real network would.
const ndjson = (lines: object[]) => {
  const text = lines.map((l) => JSON.stringify(l) + "\n").join("");
  const mid = Math.floor(text.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text.slice(0, mid)));
      c.enqueue(new TextEncoder().encode(text.slice(mid)));
      c.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson" } });
};

describe("sendAgentMessage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports status lines and returns the final reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ndjson([
      { type: "status", text: "Thinking…" },
      { type: "status", text: "Checking your tasks…" },
      { type: "done", reply: "Two tasks.", proposals: [] },
    ])));
    const seen: string[] = [];
    const res = await sendAgentMessage(input, (t) => seen.push(t));
    expect(seen).toEqual(["Thinking…", "Checking your tasks…"]);
    expect(res).toEqual({ reply: "Two tasks.", proposals: [] });
  });

  it("throws the streamed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ndjson([{ type: "error", error: "The assistant is busy." }])));
    await expect(sendAgentMessage(input)).rejects.toThrow("The assistant is busy.");
  });

  it("throws when the stream ends without a result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ndjson([{ type: "status", text: "Thinking…" }])));
    await expect(sendAgentMessage(input)).rejects.toThrow("Couldn't reach the assistant");
  });

  it("surfaces JSON errors sent before streaming", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "Daily limit of 200 messages reached." }, { status: 429 })
    ));
    await expect(sendAgentMessage(input)).rejects.toThrow("Daily limit of 200 messages reached.");
  });
});
