# Assumptions & Product Decisions

The assignment intentionally leaves requirements, tech choices, and workflows
open. Decisions made, and why:

## Scope / roles
- Four roles: **Student**, **Support Agent**, **Manager**, **Admin**. Agents
  belong to one department (Fees, Attendance, ID Cards, Documents, Certificates,
  General); Manager/Admin see everything. Assumed a small college support desk,
  not a multi-tenant SaaS — no institution/organization boundary was modeled.
- Categories double as department queues (`category` on the ticket = routing
  key). A ticket cannot be re-categorized after creation in this prototype
  (re-routing would need a "move to department" action — flagged as a possible
  extension, not built to keep the state machine simple).

## Authentication
- Hand-rolled email+password auth (bcrypt hash, httpOnly JWT session cookie)
  instead of a third-party provider (NextAuth/Clerk/etc.) or SSO — appropriate
  for a self-contained prototype graded on engineering decisions, and avoids
  external service dependencies for someone running this locally. **Production
  note**: a real deployment should sit behind institutional SSO and would swap
  `src/lib/auth.ts` for that provider's session model; the rest of the app
  (role/department checks) is unaffected because it only depends on the
  `SessionUser` shape.
- No self-service signup: accounts are seeded (`prisma/seed.ts`). Assumed
  student/staff accounts are provisioned centrally (from the college ERP), not
  self-registered.

## SLA & escalation
- SLA targets are per **priority**, not per category (`SlaPolicy` table). A
  real desk might want e.g. "ID card" issues to always be High regardless of
  what the student picks — out of scope here; the student currently self-selects
  priority (with a UI nudge not to over-select Urgent).
- SLA clock uses **calendar time**, not business hours/holidays — simplest
  correct-by-construction option for a prototype; a real system would need an
  academic-calendar-aware clock.
- "Pending on Student" **pauses** the SLA clock (assumption: SLA should measure
  support-team performance, not the student's response time). Resuming shifts
  the due date forward by exactly the paused duration.
- Escalation sweep (`runEscalationSweep`) is invoked **lazily** — every time a
  ticket list, ticket detail, or the dashboard is rendered — plus manually via
  a dashboard button. This is a deliberate prototype shortcut: in production
  it would be a scheduled job (cron / queue worker) hitting
  `POST /api/sla/recalculate` on a timer with a service credential, independent
  of anyone viewing the UI. The endpoint already exists and is separated from
  the UI-triggered mutations for exactly this reason.
- Two-level escalation ladder (breach → manager visibility; unresolved through
  a second SLA window → admin + auto-bumped to Urgent) was chosen as a
  reasonable default; thresholds live in one function and are easy to retune.

## Workflow
- Status state machine (`src/lib/workflow.ts`) intentionally restricts what
  students vs. staff can do: students can comment, respond to a pending
  request (auto-clears pending → in progress), and reopen a resolved/closed
  ticket. All other transitions (assign, escalate, resolve, close, priority
  change) are staff-only. This matches how real helpdesks scope
  self-service vs. agent actions.
- Auto-assignment on creation picks the **least-loaded agent** in the target
  department (round-robin by current open-ticket count). If no agent exists
  for a department yet, the ticket sits unassigned in that department's queue.
- Internal notes (`Comment.isInternal`) are staff-only and hidden from the
  student's view of the conversation — modeling the common "internal vs.
  customer-visible" helpdesk pattern.

## API design
- **Server Actions** are the mutation layer for everything triggered from the
  UI (create ticket, change status/priority/assignee, comment, escalate,
  reopen). Next.js 16's own guidance treats Server Actions as the idiomatic
  way to mutate data from the App Router UI (built-in CSRF/origin checks,
  no hand-written fetch/JSON boilerplate, works without client-side JS).
- Two **read-only REST endpoints** (`GET /api/tickets`, `GET /api/tickets/[id]`)
  are exposed anyway, to demonstrate a conventional API surface for external
  consumers (a BI tool, a status-page widget) that Server Actions can't serve
  (they're POST-only, framework-internal RPC). Session-cookie authenticated,
  same authorization rules as the UI.
- `POST /api/sla/recalculate` is a plain Route Handler, not a Server Action, on
  purpose — Server Actions carry a CSRF check tied to browser navigation, which
  would block a real external scheduler; a Route Handler is the natural shape
  for a job-trigger endpoint. Currently gated by the manager/admin session
  cookie for the demo; a production deployment would add a service-token
  allowlist so an external cron can call it without a browser session.

## Data & tech
- **SQLite via Prisma** — zero external services to install, still a real
  relational schema with migrations. Swapping to Postgres for production is a
  one-line `datasource` change plus re-running migrations; nothing in the
  application code is SQLite-specific except that text search uses
  case-sensitive `contains` (SQLite has no `mode: "insensitive"` — Postgres
  would restore case-insensitive search for free).
- Ticket numbers (`TCK-00001…`) are generated from a simple row count. Fine at
  prototype scale/single-writer SQLite; a concurrent multi-writer production
  database would use a DB sequence instead to avoid a collision race.
- No attachments, no email/SMS notifications, no automated test suite — noted
  as out of scope in README.md given the assignment's time-boxed nature; the
  activity log is the audit trail in place of notifications.
