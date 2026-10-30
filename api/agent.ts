// In-app study agent (Vercel function).
//   GET  /api/agent  → { enabled } for the signed-in user (shows or hides the tab)
//   POST /api/agent  → one chat turn: { reply, proposals }
//
// Every request carries `Authorization: Bearer <Firebase ID token>`. The guard
// rules (allowlist, limits, validation, prompt) live in server/agent.ts.
//
// Env (Vercel project settings):
//   ANTHROPIC_API_KEY         Claude API key (Secret)
//   AGENT_ALLOWED_EMAILS      comma-separated emails that may use the agent, or * for every verified account
//   FIREBASE_SERVICE_ACCOUNT  service account JSON (shared with send-reminders)
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import {
  MAX_BODY_BYTES,
  MAX_PROPOSALS,
  MAX_TOOLS_PER_ROUND,
  REQUEST_DEADLINE_MS,
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
  parseAgentRequest,
  parseProposal,
  parseOtherTaskRange,
  parseTaskFilter,
  parseDeleteProposal,
  parseCourseProposal,
  parseBlockProposal,
  parseGradeWeightsProposal,
  gradeSheetView,
  filterTimeBlocks,
  takeGlobal,
  takeRequest,
  replyCacheKey,
  isFreshReply,
  type TaskProposal,
  type TaskView,
  type TimeBlockView,
  type GlobalUsage,
  type UsageState,
} from "../server/agent.js";
import { authenticate, db, json } from "../server/firebaseAdmin.js";

const REMINDERS = "reminders";

let anthropic: Anthropic | null = null;
const claude = () => (anthropic ??= new Anthropic({ maxRetries: 1, timeout: 60_000 }));

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  if (auth.allowed) return json(200, { enabled: true, waitlisted: false });
  const entry = await db().collection("agentWaitlist").doc(auth.user.uid).get();
  return json(200, { enabled: false, waitlisted: entry.exists });
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
            ...(t.study === true ? { study: true } : {}),
            // Stored as COMPLETED; the model's tools speak DONE/PENDING.
            status: t.status === "COMPLETED" || t.status === "DONE" ? "DONE" : "PENDING",
          };
        })
      );
    }));

  // Time blocks aren't per semester; the date filter scopes them.
  let blocks: Promise<TimeBlockView[]> | null = null;
  const loadTimeBlocks = () =>
    (blocks ??= db()
      .collection(`users/${uid}/timeBlocks`)
      .get()
      .then((snap) =>
        snap.docs.flatMap((d): TimeBlockView[] => {
          const b = d.data();
          if (typeof b.date !== "string" || typeof b.startTime !== "string" || typeof b.endTime !== "string") return [];
          const course = typeof b.courseId === "string" ? b.courseId.split("|").pop() : undefined;
          return [{
            title: typeof b.title === "string" ? b.title.slice(0, 200) : "",
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            ...(course ? { course } : {}),
          }];
        })
      ));

  // Tasks due in a date range across the caller's other semesters. Walks
  // years → semesters → courses (plus reminders) and asks each task list
  // for the range only, so it reads just what's due then.
  const loadOtherTasks = async (from: string, to: string) => {
    const root = `users/${uid}/years`;
    const years = await db().collection(root).get();
    const lists = await Promise.all(
      years.docs.map(async (y) => {
        const sems = await db().collection(`${root}/${y.id}/semesters`).get();
        return Promise.all(
          sems.docs
            .filter((s) => !(Number(y.id) === year && s.id === semester))
            .map(async (s) => {
              const semBase = `${root}/${y.id}/semesters/${s.id}/courses`;
              const courseDocs = await db().collection(semBase).get();
              const names = [...courseDocs.docs.map((c) => c.id).filter((n) => n !== REMINDERS), REMINDERS];
              const snaps = await Promise.all(
                names.map((c) =>
                  db().collection(`${semBase}/${c}/tasks`).where("dueDate", ">=", from).where("dueDate", "<=", to).get()
                )
              );
              const semName = typeof s.get("name") === "string" ? (s.get("name") as string) : s.id;
              return snaps.flatMap((snap, i) =>
                snap.docs.map((d) => {
                  const t = d.data();
                  return {
                    year: Number(y.id),
                    semester: semName,
                    course: names[i],
                    name: typeof t.name === "string" ? t.name.slice(0, 200) : "",
                    dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
                    ...(typeof t.startTime === "string" ? { startTime: t.startTime } : {}),
                    ...(typeof t.endTime === "string" ? { endTime: t.endTime } : {}),
                    ...(t.study === true ? { study: true } : {}),
                    status: t.status === "COMPLETED" || t.status === "DONE" ? "DONE" : "PENDING",
                  };
                })
              );
            })
        );
      })
    );
    return lists
      .flat(2)
      .sort((a, b) => (a.dueDate + (a.startTime ?? "")).localeCompare(b.dueDate + (b.startTime ?? "")))
      .slice(0, 100);
  };

  // One course's grade sheet, from its course doc, or its starting rows
  // when it has none yet.
  const loadGradeSheet = async (course: string) => {
    const snap = await db().doc(`${base}/${course}`).get();
    const tasks = (await loadTasks()).filter((t) => t.course === course);
    return gradeSheetView(snap.get("gradeItems"), tasks);
  };

  return { loadCourses, loadTasks, loadTimeBlocks, loadOtherTasks, loadGradeSheet };
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

    case "list_other_semesters_tasks": {
      const r = parseOtherTaskRange(input);
      if (!r.ok) return { content: r.error, isError: true };
      return { content: JSON.stringify(await data.loadOtherTasks(r.value.from, r.value.to)) };
    }

    case "list_time_blocks": {
      const f = parseTaskFilter(input);
      if (!f.ok) return { content: f.error, isError: true };
      return { content: JSON.stringify(filterTimeBlocks(await data.loadTimeBlocks(), f.value)) };
    }

    case "propose_block": {
      const p = parseBlockProposal(input);
      if (!p.ok) return { content: p.error, isError: true };
      const { date, startTime, endTime, title } = p.value;
      // Use the course's stored spelling so the block links to it.
      let course = "";
      if (p.value.course) {
        const match = (await data.loadCourses()).find((c) => c.name.toLowerCase() === p.value.course!.toLowerCase());
        if (!match) return { content: `No course named "${p.value.course}". Use list_courses.`, isError: true };
        course = match.name;
      }
      // Busy: anything on their Schedule, and open tasks with set hours
      // (all-day ones, 07:00-23:00 or no times, don't take up the day).
      const blocks = (await data.loadTimeBlocks()).map((b) => ({ ...b }));
      const timed = (await data.loadTasks())
        .filter(
          (t) =>
            t.status !== "DONE" &&
            t.dueDate === date &&
            t.startTime &&
            t.endTime &&
            !(t.startTime === "07:00" && t.endTime === "23:00")
        )
        .map((t) => ({ date: t.dueDate, title: t.name, startTime: t.startTime!, endTime: t.endTime! }));
      const clash = [...blocks, ...timed].find(
        (b) => b.date === date && b.startTime < endTime && startTime < b.endTime
      );
      if (clash) {
        return {
          content: `That overlaps "${clash.title}" (${clash.startTime}-${clash.endTime}) on ${date}. Pick another time.`,
          isError: true,
        };
      }
      return {
        content: "Proposal shown to the student. It's added as a task only if they confirm.",
        proposal: { action: "block", course, name: title, dueDate: date, startTime, endTime, status: "PENDING" },
      };
    }

    case "get_grade_sheet": {
      const course = ((input ?? {}) as Record<string, unknown>).course;
      const match =
        typeof course === "string"
          ? (await data.loadCourses()).find((c) => c.name.toLowerCase() === course.toLowerCase())
          : undefined;
      if (!match) return { content: `No course named "${String(course)}". Use list_courses.`, isError: true };
      return { content: JSON.stringify(await data.loadGradeSheet(match.name)) };
    }

    case "propose_grade_weights": {
      const p = parseGradeWeightsProposal(input);
      if (!p.ok) return { content: p.error, isError: true };
      const match = (await data.loadCourses()).find((c) => c.name.toLowerCase() === p.value.course.toLowerCase());
      if (!match) return { content: `No course named "${p.value.course}". Use list_courses.`, isError: true };
      const total = p.value.rows.reduce((n, r) => n + (r.weight ?? 0), 0);
      const open = p.value.rows.filter((r) => r.weight === null).length;
      return {
        content:
          `Weights table shown to the student; saved only if they confirm. Given weights total ${Math.round(total * 10) / 10}%` +
          (open ? `, ${open} left for them to fill in.` : "."),
        proposal: {
          action: "grades",
          course: match.name,
          name: match.name,
          dueDate: "",
          status: "PENDING",
          weights: p.value.rows,
        },
      };
    }

    case "propose_course": {
      const p = parseCourseProposal(input);
      if (!p.ok) return { content: p.error, isError: true };
      const taken = (await data.loadCourses()).some((c) => c.name.toLowerCase() === p.value.name.toLowerCase());
      if (taken) return { content: `A course named "${p.value.name}" already exists.`, isError: true };
      return {
        content: "Proposal shown to the student. The course is added only if they confirm.",
        proposal: {
          action: "course",
          course: p.value.name,
          name: p.value.name,
          dueDate: p.value.finalDate ?? "",
          status: "PENDING",
        },
      };
    }

    case "propose_delete": {
      const p = parseDeleteProposal(input);
      if (!p.ok) return { content: p.error, isError: true };
      const t = (await data.loadTasks()).find((x) => x.id === p.value.id);
      if (!t) return { content: `No task with id "${p.value.id}". Use list_tasks.`, isError: true };
      return {
        content: "Proposal shown to the student. The task is deleted only if they confirm.",
        proposal: {
          action: "delete",
          id: t.id,
          course: t.course,
          name: t.name,
          dueDate: t.dueDate,
          ...(t.startTime ? { startTime: t.startTime } : {}),
          ...(t.endTime ? { endTime: t.endTime } : {}),
          status: t.status === "DONE" ? "DONE" : "PENDING",
        },
      };
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
          ...(raw.dueDate === undefined ? { dueDate: existing.dueDate } : {}),
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
        content: "Proposal shown to the student. It is saved only if they confirm.",
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
  const globalRef = db().collection("agentUsageMeta").doc("daily");
  let gate: ReturnType<typeof takeRequest> | ReturnType<typeof takeGlobal>;
  try {
    gate = await db().runTransaction(async (tx) => {
      const [snap, globalSnap] = await Promise.all([tx.get(usageRef), tx.get(globalRef)]);
      const now = Date.now();
      const result = takeRequest({ ...emptyUsage(), ...(snap.data() as Partial<UsageState> | undefined) }, now);
      if (!result.ok) return result;
      const app = takeGlobal(globalSnap.data() as Partial<GlobalUsage> | undefined, now);
      if (!app.ok) {
        console.warn("Agent: app-wide daily budget reached");
        return app;
      }
      tx.set(usageRef, result.next);
      tx.set(globalRef, app.next);
      return result;
    });
  } catch (err) {
    console.error("Agent: usage check failed", err instanceof Error ? err.name : "unknown");
    return json(503, { error: "The assistant is unavailable right now." });
  }
  if (!gate.ok) {
    return json(429, { error: gate.reason }, { "Retry-After": String(gate.retryAfterSec) });
  }

  // A repeat of a recent message that needed no planner data gets the saved
  // reply: no model call, and the reservation is refunded below. It still
  // counted against the per-minute and daily message limits above.
  const cacheRef = db()
    .collection("agentReplyCache")
    .doc(uid)
    .collection("replies")
    .doc(replyCacheKey(req.message, req.history, req.year, req.semester));
  const cached = await cacheRef.get().catch(() => null);
  const cachedReply = cached?.exists && isFreshReply(cached.get("savedAt"), Date.now()) ? cached.get("reply") : null;

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

  // From here the reply streams as NDJSON so the panel can show what the
  // agent is doing: {type:"status"} lines, then one {type:"done"} or
  // {type:"error"}. Failures before this point stay plain JSON with a status.
  let spent = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        if (typeof cachedReply === "string") {
          emit({ type: "done", reply: cachedReply, proposals: [] });
          return;
        }
        emit({ type: "status", text: "Thinking…" });
        const result = await runAgent(
          messages,
          data,
          (text) => emit({ type: "status", text }),
          (micros) => (spent += micros)
        );
        emit(result.event);
        if (result.cacheable && result.event.type === "done") {
          await cacheRef.set({ reply: result.event.reply, savedAt: Date.now() }).catch(() => {});
        }
      } catch (err) {
        emit({ type: "error", error: describeError(err) });
      } finally {
        // Settle the reservation against what was actually spent, even when
        // the loop failed part-way.
        if (spent !== RESERVE_MICROS) {
          const delta = FieldValue.increment(spent - RESERVE_MICROS);
          await Promise.all([
            usageRef.set({ dayMicros: delta }, { merge: true }),
            globalRef.set({ micros: delta }, { merge: true }),
          ]).catch((e) => {
            console.error("Agent: failed to record usage", e);
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type AgentEvent =
  | { type: "status"; text: string }
  | { type: "done"; reply: string; proposals: ClientProposal[] }
  | { type: "error"; error: string };

// What the panel shows while each tool runs.
const TOOL_STATUS: Record<string, string> = {
  list_courses: "Reading your courses…",
  list_tasks: "Checking your tasks…",
  list_time_blocks: "Checking your schedule…",
  list_other_semesters_tasks: "Checking your other semesters…",
  propose_task: "Preparing a suggestion…",
  propose_delete: "Preparing a suggestion…",
  propose_course: "Preparing a suggestion…",
  propose_block: "Planning a study session…",
  get_grade_sheet: "Reading the grade sheet…",
  propose_grade_weights: "Filling in the weights…",
};

const describeError = (err: unknown): string => {
  if (err instanceof Anthropic.RateLimitError) return "The assistant is busy. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("Agent: Anthropic credentials rejected", err.status);
    return "The assistant isn't configured correctly.";
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Agent: Anthropic API error", err.status);
    return "The assistant is unavailable right now.";
  }
  console.error("Agent: unexpected error", err);
  return "Something went wrong.";
};

// The tool loop. Reports each tool as it starts and each call's cost.
// Stays within the request's reservation (RESERVE_MICROS): once a round has
// used it up, or the deadline passes, it returns what it has instead of
// starting another round, so one request can't spend past the daily budget
// by more than a single call.
const runAgent = async (
  messages: Anthropic.MessageParam[],
  data: ReturnType<typeof semesterData>,
  onStatus: (text: string) => void,
  onSpend: (micros: number) => void
): Promise<{ event: AgentEvent; cacheable: boolean }> => {
  const proposals: ClientProposal[] = [];
  const deadline = Date.now() + REQUEST_DEADLINE_MS;
  let spent = 0;
  for (let round = 0; ; round++) {
    if (round > 0 && (spent >= RESERVE_MICROS || Date.now() > deadline)) {
      return {
        event: { type: "done", reply: "That one took too long to work out. Try a narrower question.", proposals },
        cacheable: false,
      };
    }
    const response = await claude().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      // Second breakpoint on the last block: each tool round, and the next
      // message, reads the conversation so far from cache instead of paying
      // for it again.
      cache_control: { type: "ephemeral" },
      tools: TOOLS,
      output_config: { effort: "low" },
      messages,
    });
    const cost = costMicros(response.usage);
    spent += cost;
    onSpend(cost);

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (response.stop_reason === "refusal") {
      return {
        event: { type: "done", reply: "I can't help with that one. Try asking about your courses or schedule.", proposals },
        cacheable: true,
      };
    }
    if (response.stop_reason !== "tool_use") {
      let reply = text || "Done.";
      if (response.stop_reason === "max_tokens") reply += "\n\n(Answer cut short.)";
      // Only a first-round reply with no tools is safe to reuse: it didn't
      // read the planner, so it doesn't go stale when the planner changes.
      return {
        event: { type: "done", reply, proposals },
        cacheable: round === 0 && proposals.length === 0 && response.stop_reason === "end_turn" && !!text,
      };
    }
    if (round >= MAX_TOOL_ROUNDS) {
      return {
        event: { type: "done", reply: text || "That took too many steps. Try a narrower question.", proposals },
        cacheable: false,
      };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    let calls = 0;
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      calls++;
      if (calls <= MAX_TOOLS_PER_ROUND) onStatus(TOOL_STATUS[block.name] ?? "Working…");
      const out: ToolOutcome =
        calls > MAX_TOOLS_PER_ROUND
          ? { content: `At most ${MAX_TOOLS_PER_ROUND} tool calls at once. Use filters instead.`, isError: true }
          : block.name.startsWith("propose_") && proposals.length >= MAX_PROPOSALS
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
};
