// In-app study agent (Vercel function).
//   GET  /api/agent  → { enabled } for the signed-in user (shows or hides the tab)
//   POST /api/agent  → one chat turn: { reply, proposals }
//
// Every request carries `Authorization: Bearer <Firebase ID token>`. The guard
// rules (allowlist, limits, validation, prompt) live in server/agent.ts.
//
// Env (Vercel project settings):
//   ANTHROPIC_API_KEY         Claude API key (Secret)
//   AGENT_ALLOWED_EMAILS      comma-separated emails that may use the agent
//   FIREBASE_SERVICE_ACCOUNT  service account JSON (shared with send-reminders)
import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  MAX_BODY_BYTES,
  MAX_PROPOSALS,
  MAX_TOKENS,
  MAX_TOOL_ROUNDS,
  MODEL,
  RESERVE_MICROS,
  SYSTEM_PROMPT,
  TOOLS,
  contextBlock,
  costMicros,
  emptyUsage,
  filterTasks,
  isAllowed,
  parseAgentRequest,
  parseAllowlist,
  parseProposal,
  parseTaskFilter,
  takeRequest,
  type TaskProposal,
  type TaskView,
  type UsageState,
} from "../server/agent.js";
import { serviceAccount } from "../server/serviceAccount.js";

const REMINDERS = "reminders";

const admin = () => {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount()) });
  }
};
const db = () => {
  admin();
  return getFirestore();
};

let anthropic: Anthropic | null = null;
const claude = () => (anthropic ??= new Anthropic({ maxRetries: 1, timeout: 60_000 }));

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// Verified token of an allowed user, or the error response to send.
const authenticate = async (
  request: Request
): Promise<{ user: DecodedIdToken; allowed: boolean } | Response> => {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json(401, { error: "Sign in to use the assistant." });
  admin();
  try {
    // checkRevoked: a signed-out or disabled account stops working at once.
    const user = await getAuth().verifyIdToken(token, true);
    const allowed = isAllowed(user.email, user.email_verified, parseAllowlist(process.env.AGENT_ALLOWED_EMAILS));
    return { user, allowed };
  } catch {
    return json(401, { error: "Your session expired. Sign in again." });
  }
};

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  return json(200, { enabled: auth.allowed });
}

// ---------------------------------------------------------------- data

// Reads one semester of the caller's planner. The uid comes from the verified
// token only, so the model can't point a tool at someone else's data.
const semesterData = (uid: string, year: number, semester: string) => {
  const base = `users/${uid}/years/${year}/semesters/${semester}/courses`;
  let courses: Promise<{ name: string; finalDate?: string }[]> | null = null;
  let tasks: Promise<TaskView[]> | null = null;

  const loadCourses = () =>
    (courses ??= db()
      .collection(base)
      .get()
      .then((snap) =>
        snap.docs
          .filter((d) => d.id !== REMINDERS)
          .map((d) => {
            const finalDate = d.get("finalDate");
            return { name: d.id, ...(typeof finalDate === "string" ? { finalDate } : {}) };
          })
      ));

  const loadTasks = () =>
    (tasks ??= loadCourses().then(async (list) => {
      const names = [...list.map((c) => c.name), REMINDERS];
      const snaps = await Promise.all(names.map((c) => db().collection(`${base}/${c}/tasks`).get()));
      return snaps.flatMap((snap, i) =>
        snap.docs.map((d): TaskView => {
          const t = d.data();
          return {
            id: d.id,
            course: names[i],
            name: typeof t.name === "string" ? t.name.slice(0, 200) : "",
            dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
            ...(typeof t.startTime === "string" ? { startTime: t.startTime } : {}),
            ...(typeof t.endTime === "string" ? { endTime: t.endTime } : {}),
            status: typeof t.status === "string" ? t.status : "PENDING",
          };
        })
      );
    }));

  return { loadCourses, loadTasks };
};

// A proposal the client shows as a confirm card. `prevCourse` is set when an
// edit moves a task to another course; `prev` is the task as stored, so the
// card can show old against new and an injected edit can't slip by unnoticed.
export type ClientProposal = TaskProposal & { prevCourse?: string; prev?: Omit<TaskView, "id"> };

type ToolOutcome = { content: string; isError?: boolean; proposal?: ClientProposal };

const runTool = async (
  name: string,
  input: unknown,
  data: ReturnType<typeof semesterData>
): Promise<ToolOutcome> => {
  switch (name) {
    case "list_courses":
      return { content: JSON.stringify(await data.loadCourses()) };

    case "list_tasks": {
      const f = parseTaskFilter(input);
      if (!f.ok) return { content: f.error, isError: true };
      return { content: JSON.stringify(filterTasks(await data.loadTasks(), f.value)) };
    }

    case "propose_task": {
      const p = parseProposal(input);
      if (!p.ok) return { content: p.error, isError: true };
      const courses = await data.loadCourses();
      if (p.value.course !== REMINDERS && !courses.some((c) => c.name === p.value.course)) {
        return { content: `No course named "${p.value.course}". Use list_courses.`, isError: true };
      }
      let proposal: ClientProposal = p.value;
      if (p.value.id) {
        const existing = (await data.loadTasks()).find((t) => t.id === p.value.id);
        if (!existing) return { content: `No task with id "${p.value.id}". Use list_tasks.`, isError: true };
        // Fields the model left out keep their current values.
        const raw = (input ?? {}) as Record<string, unknown>;
        proposal = {
          ...p.value,
          ...(raw.startTime === undefined && existing.startTime ? { startTime: existing.startTime } : {}),
          ...(raw.endTime === undefined && existing.endTime ? { endTime: existing.endTime } : {}),
          status: raw.status === undefined && existing.status === "DONE" ? "DONE" : p.value.status,
          ...(existing.course !== p.value.course ? { prevCourse: existing.course } : {}),
          prev: {
            course: existing.course,
            name: existing.name,
            dueDate: existing.dueDate,
            ...(existing.startTime ? { startTime: existing.startTime } : {}),
            ...(existing.endTime ? { endTime: existing.endTime } : {}),
            status: existing.status,
          },
        };
      }
      return {
        content: "Proposal shown to the student. It is saved only if they tap Confirm.",
        proposal,
      };
    }

    default:
      return { content: `Unknown tool ${name}.`, isError: true };
  }
};

// ---------------------------------------------------------------- chat

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  if (!auth.allowed) return json(403, { error: "The assistant isn't enabled for this account." });
  const uid = auth.user.uid;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: "Request is too large." });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return json(413, { error: "Request is too large." });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const parsed = parseAgentRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const req = parsed.value;

  // Rate limit + daily budget, atomically. agentUsage/ sits outside users/ so
  // firestore.rules deny clients; only this function can move the counters.
  // takeRequest reserves RESERVE_MICROS here; the finally below settles it
  // against what was actually spent.
  const usageRef = db().collection("agentUsage").doc(uid);
  let gate: ReturnType<typeof takeRequest>;
  try {
    gate = await db().runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const result = takeRequest({ ...emptyUsage(), ...(snap.data() as Partial<UsageState> | undefined) }, Date.now());
      if (result.ok) tx.set(usageRef, result.next);
      return result;
    });
  } catch (err) {
    console.error("Agent: usage check failed", err instanceof Error ? err.name : "unknown");
    return json(503, { error: "The assistant is unavailable right now." });
  }
  if (!gate.ok) {
    return json(429, { error: gate.reason }, { "Retry-After": String(gate.retryAfterSec) });
  }

  const data = semesterData(uid, req.year, req.semester);
  const messages: Anthropic.MessageParam[] = [
    ...req.history.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.text })),
    {
      role: "user",
      content: [
        { type: "text", text: contextBlock(new Date(), req.tz, req.year, req.semester) },
        { type: "text", text: req.message },
      ],
    },
  ];

  const proposals: ClientProposal[] = [];
  let spent = 0;
  let reply: string;

  try {
    for (let round = 0; ; round++) {
      const response = await claude().messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        output_config: { effort: "low" },
        messages,
      });
      spent += costMicros(response.usage);

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (response.stop_reason === "refusal") {
        reply = "I can't help with that one. Try asking about your courses or schedule.";
        break;
      }
      if (response.stop_reason !== "tool_use") {
        reply = text || "Done.";
        if (response.stop_reason === "max_tokens") reply += "\n\n(Answer cut short.)";
        break;
      }
      if (round >= MAX_TOOL_ROUNDS) {
        reply = text || "That took too many steps. Try a narrower question.";
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const out: ToolOutcome =
          block.name === "propose_task" && proposals.length >= MAX_PROPOSALS
            ? { content: `At most ${MAX_PROPOSALS} proposals per reply. Stop proposing.`, isError: true }
            : await runTool(block.name, block.input, data);
        if (out.proposal) proposals.push(out.proposal);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: out.content,
          ...(out.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json(503, { error: "The assistant is busy. Try again in a minute." });
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("Agent: Anthropic credentials rejected", err.status);
      return json(500, { error: "The assistant isn't configured correctly." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Agent: Anthropic API error", err.status);
      return json(502, { error: "The assistant is unavailable right now." });
    }
    console.error("Agent: unexpected error", err);
    return json(500, { error: "Something went wrong." });
  } finally {
    // Settle the reservation against what was actually spent, even when the
    // loop failed part-way.
    if (spent !== RESERVE_MICROS) {
      await usageRef
        .set({ dayMicros: FieldValue.increment(spent - RESERVE_MICROS) }, { merge: true })
        .catch((e) => {
          console.error("Agent: failed to record usage", e);
        });
    }
  }

  return json(200, { reply, proposals });
}
