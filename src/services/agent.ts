import { auth } from "../firebase";

// Client for api/agent.ts. The server decides who may use the agent; the
// client only asks so it can show or hide the tab.

export interface AgentProposal {
  id?: string;
  course: string;
  name: string;
  dueDate: string;
  startTime?: string;
  endTime?: string;
  status: "PENDING" | "DONE";
  prevCourse?: string;  // set when an edit moves the task to another course
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

export const fetchAgentEnabled = async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/agent", { headers: await authHeader() });
    const body = await readJson(res);
    return res.ok && body?.enabled === true;
  } catch {
    return false;
  }
};

export const sendAgentMessage = async (input: {
  history: AgentTurn[];
  message: string;
  year: number;
  semester: string;
}): Promise<AgentReply> => {
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
  const body = await readJson(res);
  if (!res.ok || !body) {
    throw new Error(typeof body?.error === "string" ? body.error : "The assistant is unavailable right now.");
  }
  return {
    reply: typeof body.reply === "string" ? body.reply : "",
    proposals: Array.isArray(body.proposals) ? (body.proposals as AgentProposal[]) : [],
  };
};
