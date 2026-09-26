# Campus Support Desk — Student Support & Ticket Management

A working prototype for Assignment 4: a ticket/support system for student requests
(fees, attendance, ID cards, documents, certificates, general administration) with
statuses, priorities, assignment/ownership, SLAs, ageing, escalation, resolution
tracking, activity history, and a management dashboard.

## Tech stack (decisions made for you, see ASSUMPTIONS.md for reasoning)

- **Next.js 16** (App Router, TypeScript, Turbopack) — full-stack in one app.
- **Prisma + SQLite** — zero-setup relational database, file-based (`prisma/dev.db`).
- **Server Actions** as the mutation API layer; two REST-style **Route Handlers**
  (`/api/tickets`, `/api/tickets/[id]`) for read-only external/integration access,
  plus a job endpoint (`/api/sla/recalculate`) for the SLA/escalation sweep.
- **Hand-rolled session auth** — httpOnly JWT cookie (`jose`), bcrypt password
  hashing (`bcryptjs`). No third-party auth provider (see assumptions).
- **Tailwind CSS v4** for styling.

## Getting started

```bash
npm install
npx prisma migrate dev      # creates prisma/dev.db and applies the schema
npx prisma db seed          # seeds demo users, SLA policy, and sample tickets
npm run dev                 # http://localhost:3000
```

Sign in at `/login`. Demo accounts (password for all: `password123`):

| Role | Email | Can edit/resolve tickets? |
|---|---|---|
| **Teacher (host)** | teacher@college.edu | **Yes — full access, every ticket** |
| Student | riya.student@college.edu | No — raise, view own, comment, reopen only |
| Student | arjun.student@college.edu | No — raise, view own, comment, reopen only |
| Agent — Fees | meera.agent@college.edu | Yes — own department only |
| Agent — ID Cards | kabir.agent@college.edu | Yes — own department only |
| Agent — Attendance/Certificates | zara.agent@college.edu | Yes — own department only |
| Manager | manager@college.edu | Yes — full access, every ticket |

The **Teacher** account (`role: ADMIN` internally) is the one meant for a single
host/instructor running the whole desk: it sees every department, can resolve,
reassign, escalate, or change priority on any ticket, and is the only role with
the management dashboard alongside Manager. Student accounts are intentionally
read/create-only — see "Ticket lifecycle" below for exactly what they can and
can't do.

## Feature walkthrough

**Student**
- Raise a ticket (category, priority, subject, description) → auto-routed to the
  right department and auto-assigned to the least-loaded agent there.
- Track ticket status, reply in the conversation thread, reopen a resolved/closed
  ticket if unsatisfied.

**Support Agent**
- Ticket queue with three views: My Tickets, Department Queue (unassigned), All
  Department Tickets. Claim unassigned tickets in their own department.
- Change status (through an enforced state machine), change priority, add
  internal notes (hidden from the student), escalate manually, resolve/close.

**Manager / Admin**
- Full cross-department ticket list with filters (status, priority, department,
  search).
- Reassign any ticket to any agent in the right department.
- **Dashboard**: open/escalated/breached/overdue/resolved-today stat tiles,
  status distribution, ageing buckets, department & agent workload tables, a
  live SLA-breach list, and a manual "Run SLA check now" trigger for the
  escalation sweep (see below).

## Ticket lifecycle (state machine)

```
OPEN → IN_PROGRESS → PENDING_STUDENT → IN_PROGRESS → RESOLVED → CLOSED
                 ↘ ESCALATED ↗                              ↘ REOPENED ↗
```

Enforced server-side in `src/lib/workflow.ts` — only valid transitions are ever
offered in the UI, and re-checked on submit regardless of what the client sends.

## SLA, ageing & escalation model

Defined in `src/lib/sla.ts`:

- Each priority (`LOW`/`MEDIUM`/`HIGH`/`URGENT`) has a **first-response** and
  **resolution** SLA target in minutes (`SlaPolicy` table, seeded with sensible
  defaults, editable directly in the DB for a future admin screen).
- Moving a ticket to **Pending on Student** pauses the SLA clock; the student
  replying resumes it (shifting the due date forward by the paused duration) —
  so a slow support team isn't rewarded, and a slow student doesn't fail the
  team's SLA.
- **Ageing** = wall-clock time since creation, bucketed (0–1 / 1–3 / 3–7 / 7+ days)
  for the dashboard.
- **Escalation** is two-level: level 1 auto-fires when the resolution SLA is
  breached (status forced to `ESCALATED`, visible on the manager dashboard);
  level 2 fires if it's *still* unresolved after a second full SLA window,
  bumping priority to `URGENT` for admin attention. A manual "Escalate" button
  is also available to agents/managers at any time.
- The sweep that detects breaches and escalates runs lazily on every ticket
  list/detail/dashboard view, and can be triggered on demand via
  `POST /api/sla/recalculate` (manager/admin) — see ASSUMPTIONS.md for how this
  would become a real cron job in production.

## Project structure

```
prisma/schema.prisma       data model
prisma/seed.ts             demo users, SLA policy, sample tickets
src/lib/                   auth, SLA engine, workflow rules, ticket queries
src/app/tickets/actions.ts all ticket mutation Server Actions
src/app/tickets/           ticket list, new-ticket form, ticket detail
src/app/dashboard/         management dashboard
src/app/api/               read-only JSON API + SLA sweep endpoint
src/proxy.ts               route protection (Next.js 16 renamed "middleware")
```

## Known limitations (prototype scope)

- No file attachments on tickets/comments.
- No email/push notifications — activity history is the audit trail.
- SLA sweep is lazy + manually triggerable, not a real background cron.
- Single SLA policy per priority (not further split by category).
- No automated test suite (manual verification only, given the timeline).

See `ASSUMPTIONS.md` for the full list of product/engineering decisions and
their rationale, and `AI_USAGE_REPORT.md` for how AI tooling was used.
