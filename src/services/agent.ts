import { auth } from "../firebase";

// Client for api/agent.ts. The server decides who may use the agent; the
// client only asks so it can show or hide the tab.

export interface AgentProposal {
  action?: "delete" | "course";  // omitted for task create/edit
  id?: string;
  course: string;
  name: string;
  dueDate: string;
  startTime?: string;
  endTime?: string;
  status: "PENDING" | "DONE";
  prevCourse?: string;  // set when an edit moves the task to another course
  // Edits only: the task as currently stored, shown against the new values.
  prev?: {
    course: string;
    name: string;
    dueDate: string;
    startTime?: string;
    endTime?: string;
    status: string;
  };
}

export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentReply {
  reply: string;
  proposals: AgentProposal[];
}

const authHeader = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to use the assistant.");
  return { Authorization: `Bearer ${token}` };
};

// Non-JSON replies (e.g. the dev server's index.html fallback) mean the
// endpoint isn't there.
const readJson = async (res: Response): Promise<Record<string, unknown> | null> => {
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export interface AgentAccess {
  enabled: boolean;
  waitlisted: boolean;
}

// null when the server couldn't say (offline, error); keep what's known.
export const fetchAgentAccess = async (): Promise<AgentAccess | null> => {
  try {
    const res = await fetch("/api/agent", { headers: await authHeader() });
    const body = await readJson(res);
    if (!res.ok || !body) return null;
    return { enabled: body.enabled === true, waitlisted: body.waitlisted === true };
  } catch {
    return null;
  }
};

export const joinWaitlist = async (): Promise<void> => {
  let res: Response;
  try {
    res = await fetch("/api/waitlist", { method: "POST", headers: await authHeader() });
  } catch {
    throw new Error("You're offline. Check your connection and try again.");
  }
  if (res.ok) return;
  const body = await readJson(res);
  throw new Error(typeof body?.error === "string" ? body.error : "Couldn't join the waitlist. Try again in a moment.");
};

const UNREACHABLE = "Couldn't reach the assistant. Try again in a moment.";

const toReply = (body: Record<string, unknown>): AgentReply => ({
  reply: typeof body.reply === "string" ? body.reply : "",
  proposals: Array.isArray(body.proposals) ? (body.proposals as AgentProposal[]) : [],
});

// A successful POST streams NDJSON: {type:"status"} lines while the agent
// works, then {type:"done"} or {type:"error"}. Refusals before the stream
// starts (auth, limits, validation) come back as plain JSON errors.
export const sendAgentMessage = async (
  input: {
    history: AgentTurn[];
    message: string;
    year: number;
    semester: string;
  },
  onStatus?: (text: string) => void
): Promise<AgentReply> => {
  let res: Response;
  try {
    res = await fetch("/api/agent", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
  } catch {
    throw new Error("You're offline. Check your connection and try again.");
  }

  if (!res.ok || !res.headers.get("content-type")?.includes("application/x-ndjson") || !res.body) {
    const body = await readJson(res);
    throw new Error(typeof body?.error === "string" ? body.error : UNREACHABLE);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch {
      throw new Error(UNREACHABLE);
    }
    if (chunk.done) break;
    buffered += chunk.value;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event.type === "status" && typeof event.text === "string") onStatus?.(event.text);
      else if (event.type === "done") return toReply(event);
      else if (event.type === "error") throw new Error(typeof event.error === "string" ? event.error : UNREACHABLE);
    }
  }
  // Stream ended without a result (connection cut, function timed out).
  throw new Error(UNREACHABLE);
};
