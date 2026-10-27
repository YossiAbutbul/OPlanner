# Study agent (Agent tab)

The Agent tab in the right sidebar is a chat with Claude Haiku 5.5 that can read
the open semester's courses and tasks and propose task changes.

- **Client**: `src/components/RightSidebar/AgentPanel.tsx`, `src/services/agent.ts`
- **Server**: `api/agent.ts` (Vercel function), rules in `server/agent.ts`

## Setup

In the Vercel project → Settings → Environment Variables (Production):

| Name | Type | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | API key from console.anthropic.com |
| `AGENT_ALLOWED_EMAILS` | Config | comma-separated emails, e.g. `me@example.com`, or `*` for every verified account |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | already set for push reminders |

Redeploy after changing them. Type the names by hand: copying them from
right-to-left text can add invisible characters Vercel rejects.

Set a monthly spend limit in the Anthropic Console as the final backstop.

## Protections

| Protection | Prevents |
| --- | --- |
| API key only in Vercel env, never `VITE_` | Key leaking to the browser |
| Firebase ID token verified on every request (revocation checked) | Anonymous calls, impersonation |
| Allowlist + `email_verified` required | Use by anyone not listed, or by an unverified signup with a listed address |
| Per user: 20 requests/min, 200/day, $0.50/day (`agentUsage/{uid}`, transaction) | Spam and runaway cost; clients can't reset it (no rules match) |
| Whole app: $5/day (`agentUsageMeta/daily`, same transaction) | Many new accounts each using their own per-user budget |
| Input caps: 2000 chars per message, 20 turns, 64 KB body, 5 tool rounds, 4096 output tokens | Oversized requests, loops |
| Tools use the uid from the token only | A hijacked model reading other users' data |
| The model can't write; `propose_task` returns a card the user must confirm | Injected text in task names silently changing data |
| Task notes are never sent to the model | Most room for injected instructions |
| No web, fetch or messaging tools | Exfiltrating data |
| Replies rendered as plain text | XSS, image/link exfiltration |

## Known limits

- Prompt injection can't be fully prevented: text in the student's own data can
  still lead to a wrong answer or a bad proposal. Confirming is the safeguard.
- A compromised Google account on the allowlist gets agent access, within its
  limits.
- Course and task names, dates and times are sent to Anthropic.
- The daily budget is checked before each request, so one request can go
  slightly past it.
