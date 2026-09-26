# AI Usage Report

**Tool used**: Claude Code (Anthropic), agentic CLI with direct file/terminal access.

## How AI was used

This entire prototype — schema design, backend logic, UI, seed data, and this
documentation — was built in a single AI-assisted session. Concretely, the AI:

1. **Made the open product/architecture decisions** the assignment leaves to the
   candidate: role model (Student/Agent/Manager/Admin), ticket state machine,
   SLA/ageing/escalation design, department-based routing and auto-assignment,
   and the API shape (Server Actions for mutations + a small REST surface for
   reads/jobs). These are recorded with rationale in `ASSUMPTIONS.md` rather
   than left implicit.
2. **Generated the Prisma schema, all application code, and the seed script** —
   auth (`src/lib/auth.ts`), the SLA/escalation engine (`src/lib/sla.ts`), the
   workflow state machine (`src/lib/workflow.ts`), Server Actions
   (`src/app/tickets/actions.ts`), and every page/component.
3. **Detected and corrected a version mismatch before writing any framework
   code**: the scaffolded project pulled Next.js 16.3.6 and a pre-release
   Prisma 8 RC by default. Rather than writing code against training-data
   assumptions, the agent read the bundled framework docs
   (`node_modules/next/dist/docs/...`, specifically the Next.js 16 upgrade
   guide) to confirm breaking changes — e.g. `middleware.ts` → `proxy.ts` with
   an exported `proxy()` function, and the fully-async `params`/`searchParams`
   contract — before implementing routing and auth. It also downgraded Prisma
   from an unstable 8.0.0-rc pre-release to the last stable 6.x line after the
   RC's new `prisma.config.ts` requirement broke `prisma generate`.

## How output was validated

- **Type checking + production build**: `npm run build` (Next.js + TypeScript)
  was run to completion and passed cleanly across every route (pages, Server
  Actions, both Route Handlers) before considering the work done. This catches
  the majority of Prisma type mismatches, incorrect async `params` usage, and
  broken imports.
- **Database migration + seed run**: `prisma migrate dev` and `prisma db seed`
  were executed against a real SQLite database (not just written and assumed
  correct) — the seed script exercises every enum, every relation, and
  representative states for each ticket status (open, escalated + breached,
  pending-on-student, resolved, closed, in-progress) so the dashboard and
  detail views have real data to render against.
- **Runtime smoke test**: the dev server was started and probed directly —
  confirmed the unauthenticated redirect (`/tickets` → `307` to `/login`),
  confirmed the JSON API's `401` when no session cookie is present, and
  confirmed the login page renders its form. Full interactive flows (submitting
  forms, status transitions, the dashboard's live numbers) rely on the type-
  checked build plus the state-machine guards rather than an automated
  browser test, given the time-boxed nature of this exercise.
- **Manual code review of security-sensitive paths**: every mutating Server
  Action re-derives identity from the session cookie (never trusts a client-
  supplied user id/role) and re-checks ownership/role via
  `canManageTicket`/`isStaffRole` server-side — not just hidden in the UI —
  matching the "don't trust render-time gating" guidance in Next.js's own
  Server Actions security docs, which were consulted directly.

## What a reviewer should still do

- **Click through the app as each seeded role** (see `README.md` for demo
  logins) — this is the one thing not exercised end-to-end by an automated
  check in this session, and is the recommended final acceptance step.
- Treat `AUTH_SECRET` in `.env` as a placeholder — it is a hardcoded local
  dev value and must be replaced with a real secret before any non-local use.
- There is no automated test suite (unit or e2e) — noted as an explicit
  limitation in `README.md`, not hidden.
